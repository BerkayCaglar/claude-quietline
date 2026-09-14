import assert from 'node:assert/strict';
import { test } from 'node:test';
import { baseName, elapsed, fmtAge, fmtEta, fmtTokens, modelDisplay, truncate } from '../src/format.mjs';

test('fmtTokens scales to k and M and drops trailing zeros', () => {
    assert.equal(fmtTokens(null), null);
    assert.equal(fmtTokens(999), '999');
    assert.equal(fmtTokens(192_300), '192.3k');
    assert.equal(fmtTokens(200_000), '200k');
    assert.equal(fmtTokens(1_000_000), '1M');
    assert.equal(fmtTokens(1_234_567), '1.23M');
});

test('truncate keeps short strings and marks a cut with an ellipsis', () => {
    assert.equal(truncate('abc', 5), 'abc');
    assert.equal(truncate('abcdef', 4), 'abc…');
    assert.equal(truncate('abc', 1), '');
});

test('baseName handles both separators and trailing slashes', () => {
    assert.equal(baseName('C:\\Users\\me\\project\\'), 'project');
    assert.equal(baseName('/home/me/project'), 'project');
    assert.equal(baseName(''), '');
    assert.equal(baseName(undefined), '');
});

test('fmtAge and fmtEta round down', () => {
    assert.equal(fmtAge(47.9 * 60_000), '47m');
    assert.equal(fmtAge(125 * 60_000), '2h05m');
    const now = 1_000_000_000_000;
    assert.equal(fmtEta(null, now), null);
    assert.equal(fmtEta(now / 1000 - 1, now), 'now');
    assert.equal(fmtEta(now / 1000 + 14.5 * 60, now), '14m');
    assert.equal(fmtEta(now / 1000 + (3 * 24 + 14) * 3600 + 30 * 60, now), '3d14h');
});

test('elapsed accepts epoch seconds, epoch milliseconds and date strings', () => {
    const now = Date.UTC(2026, 8, 14, 12);
    assert.equal(elapsed((now - 45_500) / 1000, now), '45s');
    assert.equal(elapsed(now - 7.5 * 60_000, now), '7m30s');
    assert.equal(elapsed(new Date(now - 125.5 * 60_000).toISOString(), now), '2h05m');
    assert.equal(elapsed('yesterday', now), '');
    assert.equal(elapsed(now + 1000, now), '');
    assert.equal(elapsed(null, now), '');
});

test('modelDisplay renders family and version from a model id', () => {
    assert.equal(modelDisplay('claude-opus-5'), 'Opus 5');
    assert.equal(modelDisplay('claude-opus-5[1m]'), 'Opus 5 (1M)');
    assert.equal(modelDisplay('claude-fable-5-1'), 'Fable 5.1');
    assert.equal(modelDisplay('claude-haiku-4-5-20251001'), 'Haiku 4.5');
    assert.equal(modelDisplay('something-custom-and-quite-long'), 'something-custom-an…');
    assert.equal(modelDisplay(undefined), '');
});

test('modelDisplay never reads a snapshot date as the minor version', () => {
    assert.equal(modelDisplay('claude-sonnet-4-20250514'), 'Sonnet 4');
    assert.equal(modelDisplay('claude-opus-4-1-20250805'), 'Opus 4.1');
});
