// The README's pictures are generated from the renderers (scripts/media.mjs). A committed picture
// that no longer matches the code would show users a status line that does not exist.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { MEDIA_DIR, buildMedia } from '../scripts/media.mjs';

const media = buildMedia();

test('every README picture matches what the renderers print', () => {
    for (const [name, svg] of Object.entries(media)) {
        assert.equal(readFileSync(join(MEDIA_DIR, name), 'utf8'), svg, `${name} is stale; run npm run media`);
    }
});

test('the pictures carry no terminal escape codes', () => {
    for (const [name, svg] of Object.entries(media)) {
        assert.doesNotMatch(svg, /\x1b/, name);
        assert.match(svg, /^<svg [^>]+>/, name);
    }
});
