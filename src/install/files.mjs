// File replacement shared by the installer and the settings writer, written for Windows as
// much as for POSIX: a replace goes through a temp file and a rename, and the rename is retried
// briefly when antivirus, the indexer or another process holds the target open. Nothing else
// is retried.

import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';

const RENAME_RETRY_MS = [50, 100, 200, 400, 800];
const LOCKED = new Set(['EPERM', 'EBUSY', 'EACCES']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const tempPathFor = (target) => `${target}.${randomBytes(4).toString('hex')}.tmp`;

export async function renameWithRetry(from, to) {
    for (let attempt = 0; ; attempt++) {
        try {
            renameSync(from, to);
            return;
        } catch (err) {
            if (!LOCKED.has(err.code) || attempt >= RENAME_RETRY_MS.length) throw err;
            await sleep(RENAME_RETRY_MS[attempt]);
        }
    }
}

// Writes `data` to `target` through a temp file, and skips the write when the target already
// holds exactly that content. Returns whether it wrote.
export async function replaceFile(target, data, { mode } = {}) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (existsSync(target) && readFileSync(target).equals(bytes)) return false;
    const tmp = tempPathFor(target);
    writeFileSync(tmp, bytes);
    try {
        if (mode != null) chmodSync(tmp, mode);
        await renameWithRetry(tmp, target);
    } catch (err) {
        rmSync(tmp, { force: true });
        throw err;
    }
    return true;
}
