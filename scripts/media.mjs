// Builds the README's pictures from the real renderers, so a picture shows exactly what the code
// prints. `npm run media` writes docs/media/*.svg, and test/media.test.mjs fails when a committed
// picture no longer matches the code. Dev-only: not part of the npm package.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderStatusLine } from '../src/statusline.mjs';
import { renderAgentRows } from '../src/subagent.mjs';

export const MEDIA_DIR = fileURLToPath(new URL('../docs/media/', import.meta.url));

const NOW = Date.UTC(2026, 8, 14, 12, 0, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const epochS = (ms) => Math.floor(ms / 1000);

// VS Code's default terminal colors. Dim text is drawn part of the way to the background, as a
// terminal draws it; `dim` is how far.
const THEMES = {
    dark: {
        window: '#181818',
        border: '#2b2b2b',
        rule: '#3c3c3c',
        fg: '#cccccc',
        caption: '#9d9d9d',
        dim: 0.4,
        ansi: { 31: '#f14c4c', 32: '#23d18b', 33: '#f5f543', 34: '#3b8eea', 35: '#d670d6', 36: '#29b8db' },
    },
    light: {
        window: '#ffffff',
        border: '#e5e5e5',
        rule: '#d4d4d4',
        fg: '#3b3b3b',
        caption: '#6f6f6f',
        dim: 0.25,
        ansi: { 31: '#cd3131', 32: '#00a36c', 33: '#8a6a00', 34: '#0451a5', 35: '#bc05bc', 36: '#0598bc' },
    },
};

const COLS = 120;
const CW = 8.4; // one terminal column at 14px monospace
const LINE = 22;
const PAD = 20;
const TOP = 36; // below the window buttons
const FONT = `ui-monospace, SFMono-Regular, 'Cascadia Mono', Menlo, Consolas, 'Liberation Mono', monospace`;

const fx = (n) => String(+n.toFixed(2));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function mix(a, b, t) {
    const channel = (hex, i) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
    return `#${[0, 1, 2].map((i) => Math.round(channel(a, i) * (1 - t) + channel(b, i) * t).toString(16).padStart(2, '0')).join('')}`;
}

// ---- terminal output to SVG --------------------------------------------------------------

const TOKEN = /\x1b\[([0-9;]*)m|\x1b\]8;;[^\x07]*\x07/g;

// One cell per column, each with the color it is drawn in. The renderers only emit reset, dim
// and foreground colors, plus OSC 8 link wrappers, which draw nothing.
function cells(ansi) {
    const out = [];
    let dim = false;
    let color = null;
    let last = 0;
    const put = (text) => {
        for (const ch of text) out.push({ ch, dim, color });
    };
    for (const m of ansi.matchAll(TOKEN)) {
        put(ansi.slice(last, m.index));
        last = m.index + m[0].length;
        if (m[1] === undefined) continue;
        for (const code of m[1].split(';').map(Number)) {
            if (code === 0) {
                dim = false;
                color = null;
            } else if (code === 2) dim = true;
            else if (code >= 30 && code <= 37) color = code;
        }
    }
    put(ansi.slice(last));
    return out;
}

const fillOf = (cell, t) => {
    const base = cell.color ? t.ansi[cell.color] : t.fg;
    return cell.dim ? mix(base, t.window, t.dim) : base;
};

// The bar is drawn as shapes, so it looks the same whatever font the viewer has.
const SHADE = { '█': 1, '░': 0.28 };
const isShape = (ch) => ch in SHADE || ch === '┃';

// Each text run is stretched to exactly its column count, so columns line up in any font.
function row(ansi, x0, y, t) {
    const cs = cells(ansi);
    const out = [];
    for (let i = 0; i < cs.length; ) {
        const x = x0 + i * CW;
        const fill = fillOf(cs[i], t);
        const { ch } = cs[i];
        if (ch in SHADE) {
            out.push(`<rect x="${fx(x)}" y="${fx(y - 11)}" width="${fx(CW + 0.4)}" height="14" fill="${fill}" fill-opacity="${SHADE[ch]}"/>`);
            i++;
        } else if (ch === '┃') {
            out.push(`<rect x="${fx(x + CW / 2 - 1.25)}" y="${fx(y - 14)}" width="2.5" height="20" rx="1" fill="${fill}"/>`);
            i++;
        } else {
            let j = i;
            while (j < cs.length && !isShape(cs[j].ch) && fillOf(cs[j], t) === fill) j++;
            const text = cs.slice(i, j).map((c) => c.ch).join('');
            if (text.trim()) {
                out.push(`<text x="${fx(x)}" y="${fx(y)}" fill="${fill}" textLength="${fx((j - i) * CW)}" lengthAdjust="spacingAndGlyphs">${esc(text)}</text>`);
            }
            i = j;
        }
    }
    return out.join('');
}

function windowSvg(t, { width, height, label, body, style = '' }) {
    const buttons = ['#ff5f57', '#febc2e', '#28c840'].map((c, i) => `<circle cx="${PAD + i * 20}" cy="18" r="6" fill="${c}"/>`);
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${fx(width)}" height="${fx(height)}" viewBox="0 0 ${fx(width)} ${fx(height)}" role="img" aria-label="${esc(label)}">`,
        `<title>${esc(label)}</title>`,
        `<style>text{font-family:${FONT};font-size:14px;white-space:pre}${style}</style>`,
        `<rect x="0.5" y="0.5" width="${fx(width - 1)}" height="${fx(height - 1)}" rx="10" fill="${t.window}" stroke="${t.border}"/>`,
        ...buttons,
        body,
        '</svg>',
        '',
    ].join('\n');
}

// ---- what the pictures show --------------------------------------------------------------

const WINDOW = 700_000; // an auto-compact window, so the marker and the headroom have a point

function cache(ageMs, ttl) {
    const ttlMs = ttl === '1h' ? HOUR : 5 * MIN;
    return { caching_observed: true, warm: ageMs < ttlMs, ttl, expires_at: epochS(NOW - ageMs + ttlMs) };
}

const context = (used, size = 1_000_000) => ({
    used_percentage: Math.round((used / size) * 100),
    total_input_tokens: used,
    context_window_size: size,
    current_usage: { input_tokens: 40, cache_creation_input_tokens: 900, cache_read_input_tokens: 61_000 },
});

const limits = (fiveHour) => ({
    five_hour: { used_percentage: fiveHour, resets_at: epochS(NOW + 14.5 * MIN) },
    seven_day: { used_percentage: 40, resets_at: epochS(NOW + 3 * DAY) },
});

const BASE = { model: { display_name: 'Opus 5 (1M)' }, workspace: { current_dir: '/work/my-app' }, effort: { level: 'xhigh' } };
const WORKING = { ...BASE, session_name: 'release prep' };

const HERO = { ...WORKING, context_window: context(620_000), prompt_cache: cache(47.5 * MIN, '1h'), rate_limits: limits(91) };

const HERO_AGENTS = {
    columns: COLS,
    tasks: [
        { id: 'a', type: 'local_agent', status: 'running', label: 'Survey status line projects', model: 'claude-opus-5[1m]', effort: 'high', contextWindowSize: 1_000_000, tokenCount: 184_000, startTime: NOW - 134_500, cwd: '/work/my-app' },
        { id: 'b', type: 'Explore', status: 'completed', label: 'Find where settings are written', model: 'claude-haiku-4-5-20251001', contextWindowSize: 200_000, tokenCount: 42_000, startTime: NOW - 38_500, cwd: '/work/my-app' },
    ],
};

// [caption, payload, auto-compact window]
const STORY = [
    ['A new session: model, folder and effort. Nothing else to say yet.', BASE, null],
    ['Work starts: the context bar, yellow from 70%, red from 90%.', { ...WORKING, context_window: context(180_000) }, null],
    ['With an auto-compact window set, ┃ marks where compaction starts.', { ...WORKING, context_window: context(300_000) }, WINDOW],
    ['Past half that window, the headroom before compaction appears.', { ...WORKING, context_window: context(520_000) }, WINDOW],
    ['A long pause: the cache age, yellow at 75% of its lifetime.', { ...WORKING, context_window: context(520_000), prompt_cache: cache(47.5 * MIN, '1h') }, WINDOW],
    ['Expired: the next message re-reads the whole conversation.', { ...WORKING, context_window: context(520_000), prompt_cache: cache(75.5 * MIN, '1h') }, WINDOW],
    ['Plan limits speak up past 70%; the reset time joins past 85%.', { ...WORKING, context_window: context(580_000), rate_limits: limits(91) }, WINDOW],
    ['Close to compaction: /clear is free, compacting later is not.', { ...WORKING, context_window: context(660_000), rate_limits: limits(91) }, WINDOW],
];
const FRAME_SECONDS = 2.6;

// The full-width line is the hero; this picture is about what gives way.
const NARROW = [100, 80, 60, 40];

function hero(t) {
    const width = PAD * 2 + COLS * CW;
    const rule = (y) => `<line x1="${PAD}" x2="${fx(width - PAD)}" y1="${y}" y2="${y}" stroke="${t.rule}"/>`;
    const line = renderStatusLine(HERO, { columns: COLS, compactWindow: WINDOW }, NOW);
    const agents = renderAgentRows(HERO_AGENTS, { inheritedEffort: 'xhigh' }, NOW).map((r) => r.content);
    const first = TOP + 64;
    const body = [
        rule(TOP + 6),
        `<text x="${PAD}" y="${TOP + 28}" fill="${t.fg}">❯ ship the release notes</text>`,
        rule(TOP + 40),
        row(line, PAD + CW, first, t),
        ...agents.map((a, i) => row(a, PAD + CW, first + (i + 1) * LINE, t)),
    ].join('\n');
    const height = first + agents.length * LINE + 20;
    return windowSvg(t, { width, height, label: 'The claude-quietline status line and agent rows under the Claude Code prompt', body });
}

function story(t) {
    const width = PAD * 2 + COLS * CW;
    const n = STORY.length;
    const total = n * FRAME_SECONDS;
    // Every frame runs the same keyframes, shifted by a negative delay so frame i shows during
    // the i-th slot. Without motion, the last and busiest frame stands still.
    const style = [
        `.f{opacity:0;animation:show ${fx(total)}s steps(1,end) infinite}`,
        `@keyframes show{0%{opacity:1}${fx(100 / n)}%{opacity:0}100%{opacity:0}}`,
        ...STORY.map((_, i) => `.f${i}{animation-delay:${fx(i * FRAME_SECONDS - total)}s}`),
        `@media (prefers-reduced-motion:reduce){.f{animation:none}.f${n - 1}{opacity:1}}`,
    ].join('');
    const body = STORY.map(([caption, data, compactWindow], i) => {
        const line = renderStatusLine(data, { columns: COLS, compactWindow }, NOW);
        return `<g class="f f${i}"><text x="${PAD}" y="${TOP + 14}" fill="${t.caption}">${esc(caption)}</text>${row(line, PAD + CW, TOP + 46, t)}</g>`;
    }).join('\n');
    return windowSvg(t, { width, height: TOP + 66, label: 'How the claude-quietline status line changes during a session', body, style });
}

function narrow(t) {
    const labelCols = 9;
    const width = PAD * 2 + (labelCols + Math.max(...NARROW)) * CW + 12;
    const x0 = PAD + labelCols * CW;
    const step = LINE + 10;
    const body = NARROW.map((cols, i) => {
        const y = TOP + 22 + i * step;
        const line = renderStatusLine(HERO, { columns: cols, compactWindow: WINDOW }, NOW);
        return [
            `<text x="${PAD}" y="${y}" fill="${t.caption}">${cols} cols</text>`,
            `<rect x="${fx(x0 - 6)}" y="${y - 17}" width="${fx(cols * CW + 12)}" height="${LINE + 3}" rx="4" fill="none" stroke="${t.rule}" stroke-dasharray="3 3"/>`,
            row(line, x0, y, t),
        ].join('');
    }).join('\n');
    const height = TOP + 22 + (NARROW.length - 1) * step + 22;
    return windowSvg(t, { width, height, label: 'The status line at four terminal widths: segments give way in a fixed order, the context bar last', body });
}

export function buildMedia() {
    const media = {};
    for (const [name, theme] of Object.entries(THEMES)) {
        media[`hero-${name}.svg`] = hero(theme);
        media[`story-${name}.svg`] = story(theme);
        media[`narrow-${name}.svg`] = narrow(theme);
    }
    return media;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    mkdirSync(MEDIA_DIR, { recursive: true });
    const media = buildMedia();
    for (const [name, svg] of Object.entries(media)) writeFileSync(join(MEDIA_DIR, name), svg);
    console.log(`wrote ${Object.keys(media).length} pictures to ${MEDIA_DIR}`);
}
