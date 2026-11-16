// The context bar as VS Code draws it, measured (see bar-metrics.mjs for what it is held to).
// `npm run test:visual` from the repository root, after `npm install --prefix test/harness`.
// Writes the pictures it measured to test/harness/out/; BAR_METRICS=1 also prints the numbers.
// The lines are drawn the way Claude Code prints them; claude.check.mjs checks that against a
// real Claude Code. A last check renders the 0.1.x bar and expects it to fail, so the checks can
// tell.

import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { renderStatusLine } from '../../src/statusline.mjs';
import { asClaudeCodePrintsIt, barParts, barProblems } from './bar-metrics.mjs';
import { THEMES, dimmed, openBrowser } from './terminal.mjs';

const OUT = join(import.meta.dirname, 'out');
const COLS = 120;
const GUTTER = '  '; // Claude Code prints the status line two columns in

const context = (used, size = 1_000_000) => ({ used_percentage: Math.round((used / size) * 100), total_input_tokens: used, context_window_size: size });
const BASE = { model: { display_name: 'Opus 5.5' }, workspace: { current_dir: '/work/sushi-belt' }, effort: { level: 'medium' } };
const SCENES = {
    low: renderStatusLine({ ...BASE, context_window: context(97_900) }, { columns: COLS }),
    marker: renderStatusLine({ ...BASE, context_window: context(620_000) }, { columns: COLS, compactWindow: 700_000 }),
    yellow: renderStatusLine({ ...BASE, context_window: context(750_000) }, { columns: COLS }),
    red: renderStatusLine({ ...BASE, context_window: context(950_000) }, { columns: COLS }),
};
// WebGL only at 1x: under Chrome's device-scale emulation the WebGL addon draws at twice the
// size it should, an artifact of the emulation rather than of the terminal.
const MATRIX = [...[1, 1.25, 1.5, 2].map((dpr) => ({ renderer: 'dom', dpr })), { renderer: 'webgl', dpr: 1 }];

let browser;
before(async () => {
    browser = await openBrowser();
    mkdirSync(OUT, { recursive: true });
});
after(() => browser?.close());

// One status line on the middle of three rows.
const check = (line, parts, { renderer, dpr, theme }, name) =>
    barProblems(browser, { text: `\r\n${GUTTER}${asClaudeCodePrintsIt(line)}\r\n`, cols: COLS, rows: 3, row: 1, parts, renderer, dpr, theme }, join(OUT, `${name}.png`));

for (const theme of Object.keys(THEMES)) {
    for (const { renderer, dpr } of MATRIX) {
        for (const [scene, line] of Object.entries(SCENES)) {
            test(`the bar reads cleanly: ${scene}, ${renderer} ${dpr}x, ${theme}`, async () => {
                const parts = barParts(line, GUTTER.length);
                assert.ok(parts.filled && parts.track, 'the line has a bar with both parts');
                assert.deepEqual(await check(line, parts, { renderer, dpr, theme }, `${scene}-${renderer}-${dpr}x-${theme}`), []);
            });
        }
    }
}

test('the checks catch the 0.1.x bar in the DOM renderer', async () => {
    // Blocks, the whole bar in the dimmed percentage color.
    const line = `\x1b[2m/work/sushi-belt\x1b[0m\x1b[2m | \x1b[0m\x1b[2;32m██░░░░░░░░░░░░░░ 10%\x1b[0m`;
    const at = GUTTER.length + '/work/sushi-belt | '.length;
    const color = dimmed(THEMES.dark.green, THEMES.dark.background);
    const parts = { track: { cols: Array.from({ length: 14 }, (_, i) => at + 2 + i), color } };
    const problems = await check(line, parts, { renderer: 'dom', dpr: 1, theme: 'dark' }, 'old-bar-dom-1x-dark');
    assert.ok(problems.some((p) => p.startsWith('track: paint outside')), problems.join('\n'));
    assert.ok(problems.some((p) => p.startsWith('track: broken')), problems.join('\n'));
});
