// install, uninstall and doctor. The per-tick command must never run npx or a version-scoped
// plugin path, so install copies the runtime into a folder it owns inside Claude Code's config
// folder and points settings.json there. Running install again is also how an update lands.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDir, parseJson } from '../inputs.mjs';
import { replaceFile } from './files.mjs';
import { updateSettings } from './settings-file.mjs';

export const PACKAGE_NAME = 'claude-quietline';
export const SOURCE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const MIN_NODE_MAJOR = 22;

const RUNTIME = ['bin', 'src', 'docs/legend', 'package.json'];
const ENTRIES = { statusLine: 'bin/statusline.mjs', subagentStatusLine: 'bin/subagent-statusline.mjs' };
const KEYS = Object.keys(ENTRIES);

const SAMPLE_MAIN = JSON.stringify({
    model: { display_name: 'claude-quietline check' },
    context_window: { used_percentage: 12, context_window_size: 200_000, total_input_tokens: 24_000 },
});
const SAMPLE_AGENTS = JSON.stringify({
    columns: 100,
    tasks: [{ id: 'check', name: 'install-check', status: 'running', description: 'verifying the install', model: 'claude-opus-5', contextWindowSize: 200_000, tokenCount: 24_000 }],
});

export class InstallError extends Error {}

export const packageVersion = (root = SOURCE_ROOT) => parseJson(readFileSync(join(root, 'package.json'), 'utf8')).version;

export function locations(env = process.env) {
    const config = configDir(env);
    const installDir = join(config, PACKAGE_NAME);
    return {
        config,
        installDir,
        settings: join(config, 'settings.json'),
        manifest: join(installDir, 'install.json'),
        backups: join(installDir, 'backups'),
    };
}

// One command shape for every shell Claude Code may run it through (Git Bash or PowerShell on
// Windows, a POSIX shell elsewhere): bare `node`, then the script path in single quotes, which
// all of them take literally. Forward slashes, because Git Bash drops unquoted backslashes.
export function commandFor(scriptPath) {
    const path = scriptPath.replace(/\\/g, '/');
    if (path.includes("'")) throw new InstallError(`The install path contains a single quote, which no shell-neutral command can quote: ${path}`);
    return `node '${path}'`;
}

// The script a `node <path>` command runs, for commands this tool did not write too.
function scriptOf(command) {
    const m = String(command ?? '').match(/^\s*node\s+(?:'([^']+)'|"([^"]+)"|(\S+))\s*$/);
    const path = m && (m[1] ?? m[2] ?? m[3]);
    return path ? path.replace(/^~(?=[\\/])/, homedir()) : null;
}

function readJsonFile(path) {
    try {
        return parseJson(readFileSync(path, 'utf8'));
    } catch {
        return null;
    }
}

function runtimeFiles(root) {
    const files = [];
    const walk = (rel) => {
        const abs = join(root, rel);
        if (statSync(abs).isDirectory()) for (const name of readdirSync(abs)) walk(join(rel, name));
        else files.push(rel);
    };
    for (const entry of RUNTIME) if (existsSync(join(root, entry))) walk(entry);
    return files.sort();
}

// File by file through a temp file and a rename: swapping the whole folder fails on Windows
// while any running status line holds a file in it open.
async function copyRuntime(sourceRoot, installDir) {
    const files = runtimeFiles(sourceRoot);
    let written = 0;
    for (const rel of files) {
        const dest = join(installDir, rel);
        mkdirSync(dirname(dest), { recursive: true });
        if (await replaceFile(dest, readFileSync(join(sourceRoot, rel)))) written++;
    }
    const current = new Set(files);
    const stale = runtimeFiles(installDir).filter((rel) => !current.has(rel));
    for (const rel of stale) rmSync(join(installDir, rel), { force: true });
    return { total: files.length, written, removed: stale.length };
}

function checkDevSource(sourceRoot) {
    if (!existsSync(join(sourceRoot, '.git'))) {
        throw new InstallError(`--dev points every session at a git checkout you work in, and ${sourceRoot} is not one. Run install without --dev.`);
    }
    if (/[\\/](plugins[\\/]cache|_npx|node_modules)[\\/]/i.test(sourceRoot)) {
        throw new InstallError(`--dev cannot point at ${sourceRoot}: a package cache manages that folder and may delete it.`);
    }
    return sourceRoot;
}

function envPath(env) {
    const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH');
    return key ? env[key] : '';
}

function findOnPath(name, env) {
    for (const dir of envPath(env).split(delimiter)) {
        if (dir && existsSync(join(dir, name))) return join(dir, name);
    }
    return null;
}

function gitBash(env) {
    if (env.CLAUDE_CODE_GIT_BASH_PATH && existsSync(env.CLAUDE_CODE_GIT_BASH_PATH)) return env.CLAUDE_CODE_GIT_BASH_PATH;
    const git = findOnPath('git.exe', env);
    if (!git) return null;
    const gitRoot = dirname(dirname(git));
    const candidates = [join(gitRoot, 'bin', 'bash.exe'), join(gitRoot, 'usr', 'bin', 'bash.exe'), join(dirname(gitRoot), 'bin', 'bash.exe')];
    return candidates.find((c) => existsSync(c)) ?? null;
}

// The shell Claude Code runs status line commands through: on Windows Git Bash when it is
// installed, otherwise PowerShell; a POSIX shell everywhere else.
export function statusLineShell(env = process.env) {
    if (process.platform !== 'win32') return { name: 'sh', file: '/bin/sh', args: (command) => ['-c', command] };
    const bash = gitBash(env);
    if (bash) return { name: 'Git Bash', file: bash, args: (command) => ['-c', command] };
    return { name: 'PowerShell', file: 'powershell.exe', args: (command) => ['-NoProfile', '-NonInteractive', '-Command', command] };
}

export function runInShell(shell, command, input, env) {
    const started = process.hrtime.bigint();
    const r = spawnSync(shell.file, shell.args(command), { input, env: { ...env, COLUMNS: '120' }, encoding: 'utf8', timeout: 15_000, windowsHide: true });
    return {
        ok: r.status === 0,
        stdout: r.stdout ?? '',
        stderr: `${r.stderr ?? ''}${r.error ? r.error.message : ''}`.trim(),
        ms: Number(process.hrtime.bigint() - started) / 1e6,
    };
}

function nodeInShell(shell, env) {
    const r = runInShell(shell, 'node --version', '', env);
    const version = r.stdout.trim();
    return { version, ok: r.ok && Number(version.replace(/^v/, '').split('.')[0]) >= MIN_NODE_MAJOR, error: r.stderr };
}

// Runs the exact command strings through the shell Claude Code will use, before settings.json
// is touched, so a command that cannot run is never written.
function verify(commands, env) {
    const shell = statusLineShell(env);
    const node = nodeInShell(shell, env);
    if (!node.ok) {
        throw new InstallError(`${shell.name} has no Node.js ${MIN_NODE_MAJOR}+ on its PATH (found "${node.version || node.error || 'nothing'}"). Claude Code runs the status line through ${shell.name}, so install a current Node.js LTS from https://nodejs.org first.`);
    }
    const main = runInShell(shell, commands.statusLine, SAMPLE_MAIN, env);
    if (!main.ok || !main.stdout.includes('claude-quietline check')) {
        throw new InstallError(`The status line did not render through ${shell.name}: ${main.stderr || 'no output'}. settings.json was not changed.`);
    }
    const agents = runInShell(shell, commands.subagentStatusLine, SAMPLE_AGENTS, env);
    if (!agents.ok || !agents.stdout.includes('"id":"check"')) {
        throw new InstallError(`The agent rows did not render through ${shell.name}: ${agents.stderr || 'no output'}. settings.json was not changed.`);
    }
    return { shell: shell.name, node: node.version, mainMs: main.ms, agentsMs: agents.ms };
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Keeps Claude Code-level options the user set on the entry (padding, refreshInterval, ...).
function applyCommands(settings, commands) {
    for (const key of KEYS) settings[key] = { ...(isObject(settings[key]) ? settings[key] : {}), type: 'command', command: commands[key] };
    return settings;
}

// What uninstall should restore. A value that is already ours keeps whatever the manifest
// recorded, so installing twice never records itself; anything else is what the user had.
function recordPrevious(settings, manifest, commands) {
    return Object.fromEntries(
        KEYS.map((key) => {
            const command = settings[key]?.command;
            if (command != null && (command === commands[key] || command === manifest?.keys?.[key]?.command)) {
                return [key, manifest?.keys?.[key]?.previous ?? { present: false }];
            }
            return [key, key in settings ? { present: true, value: settings[key] } : { present: false }];
        }),
    );
}

const describe = (value) => (value === undefined ? '(not set)' : (value?.command ?? JSON.stringify(value)));

export async function install({ env = process.env, dev = false, dryRun = false, sourceRoot = SOURCE_ROOT } = {}) {
    const loc = locations(env);
    const root = dev ? checkDevSource(sourceRoot) : loc.installDir;
    const commands = Object.fromEntries(KEYS.map((key) => [key, commandFor(join(root, ENTRIES[key]))]));
    const manifest = readJsonFile(loc.manifest);

    if (dryRun) {
        const preview = await updateSettings(loc.settings, (s) => applyCommands(s, commands), { dryRun: true });
        return {
            dryRun: true,
            mode: dev ? 'dev' : 'copy',
            root,
            files: dev ? [] : runtimeFiles(sourceRoot),
            changes: KEYS.map((key) => ({ key, from: describe(preview.before[key]), to: commands[key] })),
        };
    }

    const copied = dev ? null : await copyRuntime(sourceRoot, loc.installDir);
    const verification = verify(commands, env);

    let previous;
    const result = await updateSettings(
        loc.settings,
        (s) => {
            previous = recordPrevious(s, manifest, commands);
            return applyCommands(s, commands);
        },
        { backupDir: loc.backups },
    );

    const keys = Object.fromEntries(KEYS.map((key) => [key, { command: commands[key], previous: previous[key] }]));
    const nextManifest = { name: PACKAGE_NAME, version: packageVersion(sourceRoot), mode: dev ? 'dev' : 'copy', root, keys };
    mkdirSync(loc.installDir, { recursive: true });
    await replaceFile(loc.manifest, `${JSON.stringify(nextManifest, null, 2)}\n`);

    return { dryRun: false, mode: nextManifest.mode, root, version: nextManifest.version, installDir: loc.installDir, copied, verification, settingsChanged: result.changed, backupPath: result.backupPath };
}

export async function uninstall({ env = process.env, dryRun = false } = {}) {
    const loc = locations(env);
    const manifest = readJsonFile(loc.manifest);
    if (!manifest) return { installed: false, installDir: loc.installDir };

    let outcome;
    const result = await updateSettings(
        loc.settings,
        (s) => {
            outcome = {};
            for (const key of KEYS) {
                const entry = manifest.keys?.[key];
                if (!entry || s[key]?.command !== entry.command) {
                    outcome[key] = 'left alone: it no longer points at claude-quietline';
                } else if (entry.previous?.present) {
                    s[key] = entry.previous.value;
                    outcome[key] = `restored: ${describe(entry.previous.value)}`;
                } else {
                    delete s[key];
                    outcome[key] = 'removed';
                }
            }
            return s;
        },
        { backupDir: loc.backups, dryRun },
    );

    const warnings = [];
    for (const key of KEYS) {
        const previous = manifest.keys?.[key]?.previous;
        const script = previous?.present ? scriptOf(previous.value?.command) : null;
        if (outcome[key].startsWith('restored') && script && !existsSync(script)) {
            warnings.push(`${key} is back to "${previous.value.command}", but ${script} no longer exists.`);
        }
    }
    if (!dryRun) {
        for (const name of readdirSync(loc.installDir)) if (name !== 'backups') rmSync(join(loc.installDir, name), { recursive: true, force: true });
    }
    return { installed: true, dryRun, installDir: loc.installDir, backups: loc.backups, outcome, warnings, settingsChanged: result.changed, backupPath: result.backupPath };
}

export function doctor({ env = process.env, cwd = process.cwd() } = {}) {
    const loc = locations(env);
    const checks = [];
    const add = (status, label, detail = '') => checks.push({ status, label, detail });

    const major = Number(process.versions.node.split('.')[0]);
    add(major >= MIN_NODE_MAJOR ? 'ok' : 'fail', 'Node.js running this command', process.version);

    let settings = {};
    if (!existsSync(loc.settings)) add('warn', 'settings.json', `${loc.settings} does not exist yet`);
    else {
        try {
            settings = parseJson(readFileSync(loc.settings, 'utf8'));
            add('ok', 'settings.json', loc.settings);
        } catch (err) {
            add('fail', 'settings.json', `not valid JSON: ${err.message}`);
        }
    }

    const manifest = readJsonFile(loc.manifest);
    if (!manifest) add('fail', PACKAGE_NAME, `not installed in ${loc.installDir}`);
    else if (manifest.mode === 'dev') add('warn', PACKAGE_NAME, `${manifest.version}, dev mode: every session runs the checkout at ${manifest.root}`);
    else add('ok', PACKAGE_NAME, `${manifest.version} in ${loc.installDir}`);

    const commands = {};
    for (const key of KEYS) {
        const command = settings?.[key]?.command;
        const script = scriptOf(command);
        if (!command) add('fail', key, 'not set in settings.json');
        else if (command !== manifest?.keys?.[key]?.command) add('warn', key, `points at something other than claude-quietline: ${command}`);
        else if (script && !existsSync(script)) add('fail', key, `${script} is missing; run install again`);
        else {
            add('ok', key, command);
            commands[key] = command;
        }
    }

    for (const name of ['settings.local.json', 'settings.json']) {
        const project = join(cwd, '.claude', name);
        if (project !== loc.settings && readJsonFile(project)?.statusLine) add('warn', project, 'sets its own statusLine, which overrides yours in this project');
    }
    if (settings?.disableAllHooks === true) add('warn', 'disableAllHooks', 'is true, which turns the status line off too');

    const shell = statusLineShell(env);
    const node = nodeInShell(shell, env);
    add(node.ok ? 'ok' : 'fail', `Node.js in ${shell.name}`, node.version || node.error || 'not found on PATH');
    if (node.ok && commands.statusLine) {
        const r = runInShell(shell, commands.statusLine, SAMPLE_MAIN, env);
        add(r.ok && r.stdout ? 'ok' : 'fail', 'status line renders', r.ok ? `${Math.round(r.ms)} ms through ${shell.name}` : r.stderr);
    }
    if (node.ok && commands.subagentStatusLine) {
        const r = runInShell(shell, commands.subagentStatusLine, SAMPLE_AGENTS, env);
        add(r.ok && r.stdout ? 'ok' : 'fail', 'agent rows render', r.ok ? `${Math.round(r.ms)} ms through ${shell.name}` : r.stderr);
    }
    if (process.platform === 'win32' && !env.FORCE_HYPERLINK) {
        add('warn', 'hyperlinks', 'VS Code and Windows Terminal may print links as plain text; start Claude Code with FORCE_HYPERLINK=1');
    }
    return checks;
}
