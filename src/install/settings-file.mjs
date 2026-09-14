// Safe read-modify-write of Claude Code's settings.json. Claude Code writes this file too
// (model, effort, plugins) and offers no lock to take, so the writer:
// - parses strictly, and never writes over a file it could not parse;
// - writes nothing when nothing changes;
// - backs the file up, writes a temp file next to it and renames it into place, starting over
//   from the new version if the file changed underneath;
// - keeps the file's BOM, line endings, indent, final newline and mode, so a one-key change
//   stays a one-key diff;
// - writes a symlinked settings.json (dotfiles) through to its target.

import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parseJson } from '../inputs.mjs';
import { renameWithRetry, tempPathFor } from './files.mjs';

export class SettingsFileError extends Error {}

const MAX_ATTEMPTS = 3;
const KEEP_BACKUPS = 5;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function read(path) {
    if (!existsSync(path)) return { raw: null, hash: null, data: {} };
    const raw = readFileSync(path);
    let data;
    try {
        data = parseJson(raw.toString('utf8'));
    } catch (err) {
        throw new SettingsFileError(`${path} is not valid JSON (${err.message}). Nothing was written; fix the file or restore a backup, then try again.`);
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        throw new SettingsFileError(`${path} does not hold a JSON object. Nothing was written.`);
    }
    return { raw, hash: sha256(raw), data };
}

function formatOf(raw) {
    if (raw == null) return { bom: false, eol: '\n', indent: 2, finalNewline: true };
    const text = raw.toString('utf8');
    const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const indent = body.match(/^[ \t]+(?=\S)/m)?.[0] ?? (body.trim().includes('\n') ? 2 : undefined);
    return {
        bom: body !== text,
        eol: body.includes('\r\n') ? '\r\n' : '\n',
        indent,
        finalNewline: /\n$/.test(body),
    };
}

function serialize(data, fmt) {
    let text = JSON.stringify(data, null, fmt.indent);
    if (fmt.eol !== '\n') text = text.replace(/\n/g, fmt.eol);
    if (fmt.finalNewline) text += fmt.eol;
    return (fmt.bom ? String.fromCharCode(0xfeff) : '') + text;
}

function backup(raw, backupDir, stamp) {
    mkdirSync(backupDir, { recursive: true });
    const path = join(backupDir, `settings-${stamp}.json`);
    writeFileSync(path, raw);
    const all = readdirSync(backupDir).filter((f) => /^settings-.+\.json$/.test(f)).sort();
    for (const old of all.slice(0, Math.max(0, all.length - KEEP_BACKUPS))) rmSync(join(backupDir, old), { force: true });
    return path;
}

// Applies `mutate` to a copy of the parsed settings and writes back what it returns. `mutate`
// runs again if the file changes between the read and the write, so it must be a pure
// function of its argument. Returns { changed, backupPath, before, after }.
export async function updateSettings(path, mutate, { backupDir = null, dryRun = false, stamp = new Date().toISOString().replace(/[:.]/g, '-') } = {}) {
    const target = existsSync(path) ? realpathSync(path) : path;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const { raw, hash, data } = read(target);
        const next = mutate(structuredClone(data));
        if (isDeepStrictEqual(next, data)) return { changed: false, backupPath: null, before: data, after: data };
        if (dryRun) return { changed: true, backupPath: null, before: data, after: next };

        mkdirSync(dirname(target), { recursive: true });
        const tmp = tempPathFor(target);
        writeFileSync(tmp, serialize(next, formatOf(raw)));
        if (raw != null) chmodSync(tmp, statSync(target).mode & 0o777);

        // Someone else wrote the file since we read it: start over from their version.
        const current = existsSync(target) ? sha256(readFileSync(target)) : null;
        if (current !== hash) {
            rmSync(tmp, { force: true });
            continue;
        }

        const backupPath = raw != null && backupDir ? backup(raw, backupDir, stamp) : null;
        try {
            await renameWithRetry(tmp, target);
        } catch (err) {
            rmSync(tmp, { force: true });
            throw new SettingsFileError(`Could not replace ${target} (${err.code ?? err.message}); it was left unchanged.`);
        }

        if (!isDeepStrictEqual(parseJson(readFileSync(target, 'utf8')), next)) {
            throw new SettingsFileError(`${target} does not read back as written; restore it from ${backupPath}.`);
        }
        return { changed: true, backupPath, before: data, after: next };
    }
    throw new SettingsFileError(`${target} kept changing while it was being updated. Nothing was written; try again.`);
}
