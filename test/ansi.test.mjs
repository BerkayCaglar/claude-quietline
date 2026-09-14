import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CYAN, DIM, GREEN, R, RED, YELLOW, hyperlink, pctColor, visLen, visTruncate } from '../src/ansi.mjs';

test('visLen ignores SGR colors and OSC 8 wrappers', () => {
    const s = `${CYAN}abc${R}` + hyperlink('file:///x.md', `${DIM}de${R}`);
    assert.equal(visLen(s), 5);
});

test('visTruncate keeps escape sequences whole', () => {
    const cut = visTruncate(hyperlink('file:///x.md', `${CYAN}abcdef${R}`), 3);
    assert.equal(visLen(cut), 3);
    assert.ok(cut.startsWith('\x1b]8;;file:///x.md\x07'));
    assert.ok(cut.endsWith('abc'));
});

test('pctColor turns yellow at 70 and red at 90', () => {
    assert.equal(pctColor(69), GREEN);
    assert.equal(pctColor(70), YELLOW);
    assert.equal(pctColor(90), RED);
});
