// Everything the renderer needs from outside the stdin payload: the payload itself, Claude
// Code's config folder, and the one setting stdin does not carry (the auto-compact window).

import { readFileSync } from 'node:fs';
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
