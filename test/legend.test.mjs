import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { LEGEND_IDS, legendUrl } from '../src/legend.mjs';

const DIR = fileURLToPath(new URL('../docs/legend/', import.meta.url));
const PAGES = readdirSync(DIR).filter((f) => f.endsWith('.md'));

test('every linked segment has a legend page', () => {
    for (const id of LEGEND_IDS) assert.ok(existsSync(fileURLToPath(legendUrl(id))), id);
});

test('the index lists every page', () => {
    const index = readFileSync(join(DIR, 'index.md'), 'utf8');
    for (const page of PAGES.filter((p) => p !== 'index.md')) assert.ok(index.includes(`](./${page})`), page);
});

test('no page points at a path on one machine', () => {
    for (const page of PAGES) {
        assert.doesNotMatch(readFileSync(join(DIR, page), 'utf8'), /(?<![\w.])[A-Za-z]:[\\/]|\/Users\/|\/home\/|~\/\.claude/, page);
    }
});
