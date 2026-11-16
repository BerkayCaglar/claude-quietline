// Runs the real Claude Code with this checkout's status line, in a pseudo-terminal, against a mock
// API on 127.0.0.1: no account, no usage spent. `npm run test:e2e` from the repository root
// (after `npm install --prefix test/harness`); CLAUDE_BIN picks the binary, else `claude` on PATH.
//
// It answers what the unit tests cannot: does this Claude Code still send the fields the line
// reads, does it print the line as the line printed it, with the styles intact, and does it honour
// refreshInterval. It leaves the payload, the raw terminal output and a picture of the screen in
// test/harness/out/ — a new payload is the start of a recorded golden fixture.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { after, before, test } from 'node:test';
import pty from '@lydell/node-pty';
import xh from '@xterm/headless';
import { barProblems, xterm256 } from './bar-metrics.mjs';
import { startMockApi } from './mock-api.mjs';
import { openBrowser } from './terminal.mjs';

const HERE = import.meta.dirname;
const REPO = join(HERE, '..', '..');
const OUT = join(HERE, 'out');
const COLS = 120;
const ROWS = 30;
const REFRESH_S = 2;
const KEY = 'sk-ant-api03-quietline-mock-key-not-a-real-one-000000000000';
const slash = (p) => p.replace(/\\/g, '/');
const plain = (s) => s.replace(/\x1b(?:\[[0-9;]*m|\]8;;[^\x07]*\x07)/g, '');

// Every payload field src/statusline.mjs reads, that a session with an API key always has after
// its first answer. rate_limits (subscribers only) and session_name (once titled) are left out.
const FIELDS = [
    'model.display_name',
    'workspace.current_dir',
    'workspace.project_dir',
    'effort.level',
    'context_window.used_percentage',
    'context_window.total_input_tokens',
    'context_window.context_window_size',
    'context_window.current_usage.input_tokens',
    'context_window.current_usage.cache_creation_input_tokens',
    'context_window.current_usage.cache_read_input_tokens',
    'exceeds_200k_tokens',
    'prompt_cache.caching_observed',
    'prompt_cache.ttl',
    'prompt_cache.expires_at',
    'prompt_cache.recache_tokens_if_cold',
];
const at = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

function claudeBin() {
    if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
    const names = process.platform === 'win32' ? ['claude.exe', 'claude.cmd'] : ['claude'];
    for (const dir of (process.env.PATH ?? '').split(delimiter)) for (const n of names) if (dir && existsSync(join(dir, n))) return join(dir, n);
    return null;
}

async function waitFor(what, fn, timeoutMs = 30_000) {
    const until = Date.now() + timeoutMs;
    for (;;) {
        const v = fn();
        if (v) return v;
        if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
        await new Promise((r) => setTimeout(r, 200));
    }
}

const BIN = claudeBin();
let run;

before(async () => {
    if (!BIN) return;
    mkdirSync(OUT, { recursive: true });
    const root = mkdtempSync(join(tmpdir(), 'quietline-e2e-'));
    const config = join(root, 'config');
    const work = join(root, 'work');
    mkdirSync(config);
    mkdirSync(work);
    const log = join(root, 'statusline.jsonl');
    // A config folder of its own: onboarding done, this mock key approved, the folder trusted.
    writeFileSync(join(config, '.claude.json'), JSON.stringify({
        hasCompletedOnboarding: true,
        theme: 'dark',
        customApiKeyResponses: { approved: [KEY.slice(-20)], rejected: [] },
        projects: { [slash(work)]: { hasTrustDialogAccepted: true }, [work]: { hasTrustDialogAccepted: true } },
    }));
    writeFileSync(join(config, 'settings.json'), JSON.stringify({
        statusLine: { type: 'command', command: `node '${slash(join(HERE, 'capture.mjs'))}' '${slash(join(REPO, 'bin', 'statusline.mjs'))}' '${slash(log)}'`, refreshInterval: REFRESH_S },
    }));

    const api = await startMockApi();
    const term = new xh.Terminal({ cols: COLS, rows: ROWS, allowProposedApi: true });
    let raw = '';
    // Nothing that ties it to the session running the tests, or to a real account.
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDE|ANTHROPIC)/i.test(k)));
    const child = pty.spawn(BIN, [], {
        name: 'xterm-256color', cols: COLS, rows: ROWS, cwd: work,
        env: { ...env, CLAUDE_CONFIG_DIR: config, ANTHROPIC_BASE_URL: `http://127.0.0.1:${api.port}`, ANTHROPIC_API_KEY: KEY, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', DISABLE_AUTOUPDATER: '1', COLORTERM: 'truecolor' },
    });
    child.onData((d) => {
        raw += d;
        term.write(d);
    });
    const entries = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : []);
    const screen = () => Array.from({ length: term.buffer.active.length }, (_, i) => term.buffer.active.getLine(i).translateToString(true));
    run = { root, api, term, child, entries, screen, raw: () => raw };

    await waitFor('the first status line', () => entries().length, 60_000);
    child.write('hello');
    await new Promise((r) => setTimeout(r, 300));
    child.write('\r');
    await waitFor('a status line with the context bar', () => entries().some((e) => JSON.parse(e.payload).context_window?.used_percentage != null));
    // Let Claude Code draw the line it was just handed.
    await new Promise((r) => setTimeout(r, 1500));
});

after(async () => {
    if (!run) return;
    // Windows refuses to delete the config folder while Claude Code still has files in it open.
    await new Promise((resolve) => {
        run.child.onExit(resolve);
        run.child.kill();
        setTimeout(resolve, 10_000);
    });
    run.api.close();
    writeFileSync(join(OUT, 'claude-raw.log'), run.raw());
    const last = run.entries().at(-1);
    if (last) writeFileSync(join(OUT, `payload-${JSON.parse(last.payload).version ?? 'unknown'}.json`), `${JSON.stringify(JSON.parse(last.payload), null, 2)}\n`);
    // Its child processes (the status line runs) can close their handles a moment later.
    rmSync(run.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
});

const skip = BIN ? false : 'no Claude Code binary: set CLAUDE_BIN or put claude on PATH';
const lastWithBar = () => run.entries().filter((e) => JSON.parse(e.payload).context_window?.used_percentage != null).at(-1);

test('the session ran on the mock API only', { skip }, () => {
    assert.ok(run.api.requests.some((r) => r.stream), JSON.stringify(run.api.requests));
});

test('Claude Code still sends every field the line reads', { skip }, () => {
    const payload = JSON.parse(lastWithBar().payload);
    const missing = FIELDS.filter((f) => at(payload, f) === undefined);
    assert.deepEqual(missing, [], `Claude Code ${payload.version} no longer sends these`);
});

test('Claude Code shows the line as the line printed it', { skip }, () => {
    const expected = plain(lastWithBar().stdout).trimEnd();
    const rows = run.screen().map((r) => r.trimEnd());
    assert.ok(rows.some((r) => r.trimStart() === expected), `not on screen: ${JSON.stringify(expected)}\n${rows.filter(Boolean).join('\n')}`);
});

// The status line is the row with the context percentage and its tokens (`10% 97.9k/1M`).
const STATUS_ROW = /\d+% [\d.]+[kM]?\/[\d.]+[kM]?/;

// The bar's cells on the screen Claude Code drew, by their 256-color backgrounds:
// { filled, track } as { cols, color, codes }.
function screenBar() {
    const buffer = run.term.buffer.active;
    const y = Array.from({ length: buffer.length }, (_, i) => i).findLast((i) => STATUS_ROW.test(buffer.getLine(i).translateToString(true)));
    assert.ok(y != null, 'no status line on screen');
    const line = buffer.getLine(y);
    const parts = {};
    for (let x = 0; x < COLS; x++) {
        const c = line.getCell(x);
        if (!c?.isBgPalette()) continue;
        const n = c.getBgColor();
        const p = (parts[n === 238 ? 'track' : 'filled'] ??= { cols: [], color: xterm256(n), codes: new Set() });
        p.cols.push(x);
        p.codes.add(n);
    }
    return parts;
}

test('the bar reaches the screen in its colors: green while the context is low, gray for the rest', { skip }, () => {
    const { filled, track } = screenBar();
    assert.ok(filled && track, 'bar has both parts');
    assert.deepEqual([...filled.codes], [29], 'filled cells are 256-color 29');
    assert.deepEqual([...track.codes], [238], 'track cells are 256-color 238');
    assert.equal(filled.cols.length + track.cols.length, 16, 'the whole bar is there');
});

test('the bar on the real screen reads cleanly in the DOM and WebGL renderers', { skip }, async () => {
    const parts = screenBar();
    const browser = await openBrowser();
    try {
        for (const renderer of ['dom', 'webgl']) {
            const problems = await barProblems(
                browser,
                { text: run.raw(), cols: COLS, rows: ROWS, row: (lines) => lines.findLastIndex((l) => STATUS_ROW.test(l)), parts, renderer, theme: 'dark' },
                join(OUT, `claude-screen-${renderer}.png`),
            );
            assert.deepEqual(problems, [], renderer);
        }
    } finally {
        await browser.close();
    }
});

test('refreshInterval re-runs the line while nothing happens', { skip }, async () => {
    const before = run.entries().length;
    await new Promise((r) => setTimeout(r, (REFRESH_S * 2 + 1.5) * 1000));
    assert.ok(run.entries().length - before >= 2, `${run.entries().length - before} runs in ${REFRESH_S * 2 + 1.5} s`);
});
