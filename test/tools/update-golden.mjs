// Rewrites test/golden/ from the current renderers: `node test/tools/update-golden.mjs`. Run it
// after changing what the line prints on purpose, then review the diff; it should touch only
// what you meant to change.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGENT_CASES } from '../fixtures/agent-cases.mjs';
import { STATUSLINE_CASES } from '../fixtures/statusline-cases.mjs';
import { GOLDEN_DIR, renderAgentCase, renderStatuslineCase } from '../helpers.mjs';

const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

mkdirSync(join(GOLDEN_DIR, 'statusline'), { recursive: true });
mkdirSync(join(GOLDEN_DIR, 'agents'), { recursive: true });
for (const c of STATUSLINE_CASES) writeJson(join(GOLDEN_DIR, 'statusline', `${c.name}.json`), renderStatuslineCase(c));
for (const c of AGENT_CASES) writeJson(join(GOLDEN_DIR, 'agents', `${c.name}.json`), renderAgentCase(c));

console.log(`wrote ${STATUSLINE_CASES.length} status line and ${AGENT_CASES.length} agent goldens to ${GOLDEN_DIR}`);
