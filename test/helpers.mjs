// Shared by the golden tools and the tests.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderStatusLine } from '../src/statusline.mjs';
import { renderAgentRows } from '../src/subagent.mjs';

export const TEST_DIR = dirname(fileURLToPath(import.meta.url));
export const GOLDEN_DIR = join(TEST_DIR, 'golden');

export const MAIN_WIDTHS = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 140, 160, 180, 200, 220];
export const AGENT_WIDTHS = [40, 60, 80, 100, 120, 140, 160, 200];

const GOLDEN_NOW = Date.UTC(2026, 8, 14, 12, 0, 0);
const PROJECT_DIR = '/work/my-app';

// Link targets differ between installs, so a golden keeps only the legend page id.
const LINK_OPEN = /\x1b\]8;;[^\x07]*?([\w-]+)\.md\x07/g;
export const normalizeLinks = (s) => s.replace(LINK_OPEN, '\x1b]8;;<legend:$1>\x07');

// Claude Code sends the payload as JSON text; give the renderers exactly what parsing it yields.
function payload(data) {
    try {
        return JSON.parse(typeof data === 'string' ? data : JSON.stringify(data));
    } catch {
        return null;
    }
}

// What the renderers print for one fixture at every width, in golden form.
export function renderStatuslineCase(c, now = GOLDEN_NOW) {
    const out = {};
    for (const width of [...MAIN_WIDTHS, 'none']) {
        const built = c.build(now, { projectDir: PROJECT_DIR });
        const inputs = { columns: width === 'none' ? 0 : width, compactWindow: built.inputs?.compactWindow ?? null };
        out[width] = normalizeLinks(renderStatusLine(payload(built.data), inputs, now));
    }
    return out;
}

export function renderAgentCase(c, now = GOLDEN_NOW) {
    const out = {};
    const viaEnv = c.widthVia === 'env';
    for (const width of viaEnv ? [...AGENT_WIDTHS, 'none'] : AGENT_WIDTHS) {
        const built = c.build(now);
        let data = payload(built.data);
        if (data && typeof data === 'object' && !viaEnv) data = { ...data, columns: width };
        const inputs = { columns: viaEnv && width !== 'none' ? width : 0, inheritedEffort: built.inputs?.inheritedEffort ?? null };
        out[width] = renderAgentRows(data, inputs, now).map((row) => ({ ...row, content: normalizeLinks(row.content) }));
    }
    return out;
}
