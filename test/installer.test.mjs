import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { InstallError, SOURCE_ROOT, doctor, install, runInShell, statusLineShell, uninstall } from '../src/install/installer.mjs';

const slash = (p) => p.replace(/\\/g, '/');
const PREVIOUS = `${JSON.stringify({ model: 'opus', statusLine: { type: 'command', command: 'node ~/.claude/statusline.mjs', padding: 1 } }, null, 2)}\n`;

// A config folder whose path holds a space and a non-ASCII character, like many real homes.
function configFolder(t, settings) {
    const dir = mkdtempSync(join(tmpdir(), 'quietline ç-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    if (settings !== undefined) writeFileSync(join(dir, 'settings.json'), settings);
    return { dir, env: { ...process.env, CLAUDE_CONFIG_DIR: dir }, settingsPath: join(dir, 'settings.json') };
}

function runtimeCopy(t) {
    const dir = mkdtempSync(join(tmpdir(), 'quietline-source-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    for (const entry of ['bin', 'src', 'docs/legend', 'package.json']) cpSync(join(SOURCE_ROOT, entry), join(dir, entry), { recursive: true });
    return dir;
}

function snapshot(dir) {
    const files = {};
    const walk = (d) => {
        for (const name of readdirSync(d)) {
            const p = join(d, name);
            if (statSync(p).isDirectory()) walk(p);
            else files[slash(relative(dir, p))] = readFileSync(p, 'utf8');
        }
    };
    walk(dir);
    return files;
}

const readSettings = (path) => JSON.parse(readFileSync(path, 'utf8'));

test('install points both keys at an installed copy and keeps everything else', async (t) => {
    const { dir, env, settingsPath } = configFolder(t, PREVIOUS);
    const result = await install({ env });
    const bin = slash(join(dir, 'claude-quietline', 'bin'));
    assert.deepEqual(readSettings(settingsPath), {
        model: 'opus',
        statusLine: { type: 'command', command: `node '${bin}/statusline.mjs'`, padding: 1 },
        subagentStatusLine: { type: 'command', command: `node '${bin}/subagent-statusline.mjs'` },
    });
    assert.ok(existsSync(join(dir, 'claude-quietline', 'docs', 'legend', 'index.md')));
    assert.ok(!existsSync(join(dir, 'claude-quietline', 'test')));
    assert.equal(result.settingsChanged, true);
    assert.ok(existsSync(result.backupPath));
});

test('the installed copy links to legend pages that exist', async (t) => {
    const { dir, env } = configFolder(t, '{}');
    await install({ env });
    const script = join(dir, 'claude-quietline', 'bin', 'statusline.mjs');
    const run = spawnSync(process.execPath, [script], { input: JSON.stringify({ model: { display_name: 'M' } }), encoding: 'utf8' });
    const url = run.stdout.match(/\x1b\]8;;([^\x07]+)\x07/)[1];
    assert.ok(!url.includes(' '), url);
    assert.ok(existsSync(fileURLToPath(url)), url);
});

test('the written command renders the same through Git Bash and PowerShell', { skip: process.platform !== 'win32' ? 'Windows shells' : false }, async (t) => {
    const { env, settingsPath } = configFolder(t, '{}');
    await install({ env });
    const { command } = readSettings(settingsPath).statusLine;
    const input = JSON.stringify({ model: { display_name: 'shell-check' }, context_window: { used_percentage: 40, context_window_size: 200_000 } });
    const powershell = { name: 'PowerShell', file: 'powershell.exe', args: (c) => ['-NoProfile', '-NonInteractive', '-Command', c] };
    const [viaDefault, viaPowerShell] = [statusLineShell(env), powershell].map((shell) => runInShell(shell, command, input, env));
    assert.ok(viaDefault.ok && viaDefault.stdout.includes('shell-check'), viaDefault.stderr);
    assert.ok(viaPowerShell.ok && viaPowerShell.stdout.includes('shell-check'), viaPowerShell.stderr);
    assert.equal(viaPowerShell.stdout, viaDefault.stdout);
});

test('installing twice writes nothing the second time', async (t) => {
    const { dir, env, settingsPath } = configFolder(t, PREVIOUS);
    await install({ env });
    const settings = readFileSync(settingsPath);
    const backups = readdirSync(join(dir, 'claude-quietline', 'backups'));
    const again = await install({ env });
    assert.equal(again.settingsChanged, false);
    assert.equal(again.copied.written, 0);
    assert.ok(readFileSync(settingsPath).equals(settings));
    assert.deepEqual(readdirSync(join(dir, 'claude-quietline', 'backups')), backups);
});

test('uninstall restores the previous settings byte for byte; a second uninstall does nothing', async (t) => {
    const { dir, env, settingsPath } = configFolder(t, PREVIOUS);
    await install({ env });
    await install({ env });
    const first = await uninstall({ env });
    assert.equal(readFileSync(settingsPath, 'utf8'), PREVIOUS);
    assert.match(first.outcome.statusLine, /^restored/);
    assert.equal(first.outcome.subagentStatusLine, 'removed');
    assert.deepEqual(readdirSync(join(dir, 'claude-quietline')), ['backups']);
    const second = await uninstall({ env });
    assert.equal(second.installed, false);
    assert.equal(readFileSync(settingsPath, 'utf8'), PREVIOUS);
});

test('installing over another tool records that tool for uninstall', async (t) => {
    const { env, settingsPath } = configFolder(t, PREVIOUS);
    await install({ env });
    const switched = readSettings(settingsPath);
    switched.statusLine = { type: 'command', command: 'other-tool' };
    writeFileSync(settingsPath, JSON.stringify(switched, null, 2));
    await install({ env });
    await uninstall({ env });
    assert.equal(readSettings(settingsPath).statusLine.command, 'other-tool');
});

test('uninstall leaves a key alone when something else has replaced it since', async (t) => {
    const { env, settingsPath } = configFolder(t, PREVIOUS);
    await install({ env });
    const replaced = readSettings(settingsPath);
    replaced.statusLine = { type: 'command', command: 'other-tool' };
    writeFileSync(settingsPath, JSON.stringify(replaced, null, 2));
    const result = await uninstall({ env });
    assert.match(result.outcome.statusLine, /^left alone/);
    assert.equal(readSettings(settingsPath).statusLine.command, 'other-tool');
});

test('a dry run changes no file', async (t) => {
    const { dir, env } = configFolder(t, PREVIOUS);
    const before = snapshot(dir);
    const result = await install({ env, dryRun: true });
    assert.equal(result.dryRun, true);
    assert.equal(result.changes[0].from, 'node ~/.claude/statusline.mjs');
    assert.deepEqual(snapshot(dir), before);
});

test('a command that does not render never reaches settings.json', async (t) => {
    const { env, settingsPath } = configFolder(t, PREVIOUS);
    const source = runtimeCopy(t);
    writeFileSync(join(source, 'bin', 'statusline.mjs'), "throw new Error('broken on purpose');\n");
    await assert.rejects(install({ env, sourceRoot: source }), InstallError);
    assert.equal(readFileSync(settingsPath, 'utf8'), PREVIOUS);
});

test('--dev points settings at a git checkout and refuses anything else', async (t) => {
    const { env, settingsPath } = configFolder(t, '{}');
    const source = runtimeCopy(t);
    await assert.rejects(install({ env, dev: true, sourceRoot: source }), InstallError);
    mkdirSync(join(source, '.git'));
    const result = await install({ env, dev: true, sourceRoot: source });
    assert.equal(result.mode, 'dev');
    assert.equal(readSettings(settingsPath).statusLine.command, `node '${slash(join(source, 'bin', 'statusline.mjs'))}'`);
});

test('refuses an install path containing a single quote', async (t) => {
    const dir = mkdtempSync(join(tmpdir(), "quietline o'brien-"));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    await assert.rejects(install({ env: { ...process.env, CLAUDE_CONFIG_DIR: dir } }), InstallError);
    assert.deepEqual(readdirSync(dir), []);
});

test('the CLI prints help and its version, and rejects unknown flags', () => {
    const cli = join(SOURCE_ROOT, 'bin', 'cli.mjs');
    const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
    assert.equal(help.status, 0);
    assert.match(help.stdout, /claude-quietline install/);
    const version = spawnSync(process.execPath, [cli, '--version'], { encoding: 'utf8' });
    assert.equal(version.stdout.trim(), JSON.parse(readFileSync(join(SOURCE_ROOT, 'package.json'), 'utf8')).version);
    assert.equal(spawnSync(process.execPath, [cli, 'install', '--bogus'], { encoding: 'utf8' }).status, 1);
});

test('doctor flags a missing install and passes a fresh one', async (t) => {
    const { dir, env } = configFolder(t, PREVIOUS);
    const before = doctor({ env, cwd: dir });
    assert.ok(before.some((c) => c.status === 'fail' && c.label === 'claude-quietline'));
    assert.ok(before.some((c) => c.status === 'warn' && c.label === 'statusLine'));
    await install({ env });
    assert.deepEqual(doctor({ env, cwd: dir }).filter((c) => c.status === 'fail'), []);
});
