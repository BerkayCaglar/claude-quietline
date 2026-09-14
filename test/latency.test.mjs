// Guards the per-tick cost: the status line runs on every refresh, and Claude Code cancels a
// run that is still going when the next one starts. Measured as overhead over a bare
// `node -e ""`, so the speed of the machine cancels out.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { before, test } from 'node:test';
import { SOURCE_ROOT } from '../src/install/installer.mjs';

const RUNS = 15;
// Generous on purpose: CI runners are noisy. On a developer machine the overhead is a few ms.
const BUDGET_MS = 60;

function medianMs(args, input) {
    const times = [];
    for (let i = 0; i < RUNS; i++) {
        const started = process.hrtime.bigint();
        spawnSync(process.execPath, args, { input });
        times.push(Number(process.hrtime.bigint() - started) / 1e6);
    }
    return times.sort((a, b) => a - b)[Math.floor(RUNS / 2)];
}

const MAIN_INPUT = JSON.stringify({
    model: { display_name: 'Opus 5 (1M)' },
    workspace: { current_dir: '/work/my-app' },
    context_window: { used_percentage: 19, context_window_size: 1_000_000, total_input_tokens: 192_300 },
});

const AGENT_INPUT = JSON.stringify({
    columns: 120,
    tasks: [{ id: 't', type: 'local_agent', status: 'running', description: 'List files', model: 'claude-opus-5', contextWindowSize: 1_000_000, tokenCount: 84_369, startTime: Date.now() - 5000 }],
});

let bare;
before(() => {
    bare = medianMs(['-e', ''], '');
});

test('the status line adds little over starting Node itself', () => {
    const line = medianMs([join(SOURCE_ROOT, 'bin', 'statusline.mjs')], MAIN_INPUT);
    assert.ok(line - bare < BUDGET_MS, `status line ${line.toFixed(1)} ms, bare node ${bare.toFixed(1)} ms`);
});

test('the agent rows add little over starting Node itself', () => {
    const rows = medianMs([join(SOURCE_ROOT, 'bin', 'subagent-statusline.mjs')], AGENT_INPUT);
    assert.ok(rows - bare < BUDGET_MS, `agent rows ${rows.toFixed(1)} ms, bare node ${bare.toFixed(1)} ms`);
});
