// Everything the renderers need from outside the stdin payload: the payload itself, Claude
// Code's config folder, the one setting stdin does not carry (the auto-compact window), and the
// session effort the main line hands over to the agent rows.

import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export async function readStdinJson() {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        return null;
    }
}

// CLAUDE_CONFIG_DIR relocates everything Claude Code keeps in ~/.claude.
export const configDir = (env = process.env) => env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');

// Editors on Windows may save settings.json with a byte order mark, which JSON.parse rejects.
export const parseJson = (text) => JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

function readJson(path) {
    try {
        return parseJson(readFileSync(path, 'utf8'));
    } catch {
        return null;
    }
}

// The forms /autocompact and the autoCompactWindow setting accept: a plain token count, a
// `k`/`M` suffix, or a bare 100-1000 meaning thousands.
export function parseWindow(v) {
    if (v == null) return null;
    if (typeof v === 'number') return v >= 100 && v <= 1000 ? v * 1000 : v;
    const m = String(v).trim().match(/^(\d+(?:\.\d+)?)\s*([kM])?$/);
    if (!m) return null;
    const n = Number(m[1]);
    if (m[2] === 'k') return n * 1e3;
    if (m[2] === 'M') return n * 1e6;
    return n >= 100 && n <= 1000 ? n * 1000 : n;
}

// CLAUDE_CODE_AUTO_COMPACT_WINDOW takes a plain token count only.
const parseEnvWindow = (v) => (v != null && /^\s*\d+\s*$/.test(v) ? Number(v) : null);

// Claude Code's precedence: CLAUDE_CODE_AUTO_COMPACT_WINDOW, then autoCompactWindow from the
// project's local and shared settings and the user settings. The --autocompact flag and
// managed settings are not visible from here. Null means no window is set.
export function autoCompactWindow(projectDir, env = process.env) {
    const fromEnv = parseEnvWindow(env.CLAUDE_CODE_AUTO_COMPACT_WINDOW);
    if (fromEnv) return fromEnv;
    const files = [];
    if (projectDir) {
        files.push(join(projectDir, '.claude', 'settings.local.json'));
        files.push(join(projectDir, '.claude', 'settings.json'));
    }
    files.push(join(configDir(env), 'settings.json'));
    for (const file of files) {
        const window = parseWindow(readJson(file)?.autoCompactWindow);
        if (window) return window;
    }
    return null;
}

// The agent panel's payload carries no session effort, neither on stdin nor as CLAUDE_EFFORT,
// and a subagent that inherits the level has no `effort` of its own (recorded from Claude Code
// 2.1.270). The main line does receive it, so it leaves it here for the agent rows: one small
// file per session, written only when the level changes.
const STATE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const stateDir = (env) => join(configDir(env), 'claude-quietline', 'state');
const statePath = (sessionId, env) => (/^[\w-]{1,128}$/.test(sessionId ?? '') ? join(stateDir(env), `${sessionId}.json`) : null);

export function sessionEffort(sessionId, env = process.env) {
    const path = statePath(sessionId, env);
    return (path && readJson(path)?.effort) || null;
}

export function rememberSessionEffort(sessionId, effort, env = process.env) {
    const path = statePath(sessionId, env);
    if (!path || !effort || readJson(path)?.effort === effort) return;
    const tmp = `${path}.${process.pid}.tmp`;
    try {
        mkdirSync(stateDir(env), { recursive: true });
        // Through a temp file, so the agent rows never read half a file.
        writeFileSync(tmp, JSON.stringify({ effort }));
        renameSync(tmp, path);
        pruneState(stateDir(env));
    } catch {
        // The status line must still render when the folder is read-only or a rename is
        // refused. The stored level still differs, so the next refresh writes it again.
        rmSync(tmp, { force: true });
    }
}

// Sessions end without saying so; each write clears out files nobody has touched in a week.
function pruneState(dir) {
    const cutoff = Date.now() - STATE_MAX_AGE_MS;
    for (const name of readdirSync(dir)) {
        const file = join(dir, name);
        if (statSync(file).mtimeMs < cutoff) rmSync(file, { force: true });
    }
}
