import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderStatusLine } from '../src/statusline.mjs';

const NOW = Date.UTC(2026, 8, 14, 12);
const MIN = 60_000;
const plain = (s) => s.replace(/\x1b(?:\[[0-9;]*m|\]8;;[^\x07]*\x07)/g, '');
const render = (data) => plain(renderStatusLine(data, {}, NOW));

// The last response was `ageMs` ago; prompt_cache reports when that prefix goes cold.
const withCache = (ageMs, ttl, fields = {}) => ({
    model: { display_name: 'M' },
    prompt_cache: {
        caching_observed: true,
        ttl,
        expires_at: Math.floor((NOW - ageMs + (ttl === '1h' ? 60 : 5) * MIN) / 1000),
        ...fields,
    },
});

test('the cache segment shows the age from prompt_cache', () => {
    assert.match(render(withCache(30.5 * MIN, '1h')), /cache 30m/);
    assert.match(render(withCache(12.5 * MIN, '5m')), /cache cold/);
});

test('the cache segment stays hidden until there is something to act on', () => {
    assert.doesNotMatch(render({ model: { display_name: 'M' } }), /cache/);
    assert.doesNotMatch(render(withCache(3.5 * MIN, '1h')), /cache/);
    assert.doesNotMatch(render(withCache(30.5 * MIN, '1h', { caching_observed: false })), /cache/);
    assert.doesNotMatch(render(withCache(30.5 * MIN, '1h', { expires_at: null })), /cache/);
    assert.doesNotMatch(render(withCache(30.5 * MIN, '2h')), /cache/);
});
