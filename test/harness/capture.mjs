// Status line command for the end-to-end check: runs the real status line on the payload Claude
// Code sends, prints what it prints, and appends both (and COLUMNS) to a JSON-lines file.
// Usage: node capture.mjs <statusline.mjs> <log.jsonl>

import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

const [script, log] = process.argv.slice(2);
const input = readFileSync(0);
const run = spawnSync(process.execPath, [script], { input, env: process.env });
appendFileSync(log, `${JSON.stringify({ at: Date.now(), columns: process.env.COLUMNS ?? null, payload: input.toString('utf8'), stdout: run.stdout.toString('utf8'), stderr: run.stderr.toString('utf8') })}\n`);
process.stdout.write(run.stdout);
