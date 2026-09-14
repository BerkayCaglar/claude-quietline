// Holds the renderers to the exact bytes in test/golden/: first captured from the scripts this
// project was extracted from, and since then updated only on purpose (tools/update-golden.mjs).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { AGENT_CASES } from './fixtures/agent-cases.mjs';
import { STATUSLINE_CASES } from './fixtures/statusline-cases.mjs';
import { GOLDEN_DIR, renderAgentCase, renderStatuslineCase } from './helpers.mjs';

const readGolden = (kind, name) => JSON.parse(readFileSync(join(GOLDEN_DIR, kind, `${name}.json`), 'utf8'));

for (const c of STATUSLINE_CASES) {
    test(`status line matches golden: ${c.name}`, () => {
        assert.deepEqual(renderStatuslineCase(c), readGolden('statusline', c.name));
    });
}

for (const c of AGENT_CASES) {
    test(`agent rows match golden: ${c.name}`, () => {
        assert.deepEqual(renderAgentCase(c), readGolden('agents', c.name));
    });
}
