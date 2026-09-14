// Every segment links to its legend page. The pages ship next to the code in docs/legend/,
// so the links resolve for a copied install and for a dev checkout alike, and a URL built
// from import.meta.url is a valid, percent-encoded file: URL on every OS. One page per
// segment rather than anchors into one document: VS Code ignores #fragments on file: URLs.

import { hyperlink } from './ansi.mjs';

const LEGEND_DIR = new URL('../docs/legend/', import.meta.url);

export const LEGEND_IDS = ['model', 'cwd', 'session', 'effort', 'ctx', 'compact', 'cacheage', 'cachehit', 'exceeds200k', 'limits', 'agents'];
const KNOWN = new Set(LEGEND_IDS);

export const legendUrl = (id) => new URL(`${id}.md`, LEGEND_DIR).href;

export const legendLink = (id, text) => (KNOWN.has(id) ? hyperlink(legendUrl(id), text) : text);
