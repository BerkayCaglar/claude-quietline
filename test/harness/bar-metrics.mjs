// Measures the context bar in a rendered terminal and says what is wrong with it. Shared by the
// visual check (lines drawn here, across renderers, scales and themes) and the end-to-end check
// (the screen a real Claude Code drew).
//
// The bar is cells painted with a background color. What it is held to:
// - its paint stays inside the status line's own row (Consolas's `░`, the 0.1.x bar, spilled into
//   the row above);
// - it fills the row's height, so it reads as one solid bar (a font-drawn glyph covers only part
//   of the cell, and how much depends on the font);
// - it runs unbroken along the row (a dimmed `░` is a sparse dot pattern that reads as nothing);
// - it is drawn in its full color: the strongest pixel reaches the contrast that color has against
//   the terminal's background.

import { writeFileSync } from 'node:fs';
import { THEMES, contrast, measure, renderTerminal } from './terminal.mjs';

const STRENGTH = 0.9; // the strongest pixel reaches this share of its color's contrast
const UNBROKEN = 0.9; // the fullest pixel row is painted across this share of the part's width
const FILLS = 0.9; // the part is painted across this share of the row's height
const fmt = (n) => +n.toFixed(2);

// The xterm 256-color palette, beyond the 16 theme colors.
export function xterm256(n) {
    const hex = (v) => v.toString(16).padStart(2, '0');
    if (n >= 232) return `#${hex(8 + (n - 232) * 10).repeat(3)}`;
    const level = (v) => (v ? 55 + v * 40 : 0);
    const c = n - 16;
    return `#${[Math.floor(c / 36), Math.floor(c / 6) % 6, c % 6].map((v) => hex(level(v))).join('')}`;
}

// Claude Code prints the status line's default-colored text in palette color 246 (recorded from
// 2.1.325).
export const asClaudeCodePrintsIt = (line) => `\x1b[38;5;246m${line.replaceAll('\x1b[0m', '\x1b[0m\x1b[38;5;246m')}\x1b[0m`;

// The columns and colors of the bar in one printed line: { filled, track } as { cols, color },
// read from its 256-color backgrounds. The track is the gray one (238), the filled part any other.
export function barParts(ansi, offset = 0) {
    const parts = { filled: { cols: [], color: null }, track: { cols: [], color: null } };
    let background = null;
    let col = offset;
    const re = /\x1b\[([0-9;]*)m|\x1b\]8;;[^\x07]*\x07/g;
    let last = 0;
    const put = (text) => {
        for (const _ of text) {
            if (background != null) {
                const part = background === 238 ? parts.track : parts.filled;
                part.cols.push(col);
                part.color = xterm256(background);
            }
            col++;
        }
    };
    for (const m of ansi.matchAll(re)) {
        put(ansi.slice(last, m.index));
        last = m.index + m[0].length;
        if (m[1] === undefined) continue;
        const codes = m[1].split(';').map(Number);
        for (let k = 0; k < codes.length; k++) {
            if (codes[k] === 0 || codes[k] === 49) background = null;
            else if (codes[k] === 48 && codes[k + 1] === 5) {
                background = codes[k + 2];
                k += 2;
            }
        }
    }
    put(ansi.slice(last));
    return Object.fromEntries(Object.entries(parts).filter(([, p]) => p.cols.length));
}

// text: raw terminal output; row: the row the status line is on, or a function that finds it in
// the rendered rows' text; parts: { name: { cols, color } }, color being what that part is painted in.
export async function barProblems(browser, { text, cols, rows, row: rowOrFind, parts, renderer = 'dom', dpr = 1, theme = 'dark' }, file) {
    const shot = await renderTerminal(browser, { text, cols, rows, renderer, dpr, theme });
    if (file) writeFileSync(file, shot.png);
    const row = typeof rowOrFind === 'function' ? rowOrFind(shot.lines) : rowOrFind;
    if (!(row >= 0)) return ['no status line on screen'];
    if (!Object.keys(parts).length) return ['no bar found on the row'];
    const { width: cw, height: ch } = shot.cell;
    const background = THEMES[theme].background;
    const barCols = Object.values(parts).flatMap((p) => p.cols);
    // Spilled paint only shows where the rows above and below are blank over the bar. On a real
    // screen they hold other things (the prompt's border, the mode line); then only the bar's own
    // row is measured, and the spill check is left to lines drawn with blank neighbours.
    const blank = (y) => y < 0 || y >= rows || barCols.every((i) => ([...(shot.lines[y] ?? '')][i] ?? ' ') === ' ');
    const spillChecked = blank(row - 1) && blank(row + 1);
    const y0 = (blank(row - 1) ? Math.max(0, row - 1) : row) * ch;
    const y1 = (blank(row + 1) ? Math.min(rows, row + 2) : row + 1) * ch;
    // One region per column, inset a pixel so a neighbour's antialiasing does not count.
    const regions = Object.entries(parts).flatMap(([name, p]) => p.cols.map((i) => ({ name: `${name}:${i}`, x0: i * cw + 1, x1: (i + 1) * cw - 1, y0, y1 })));
    const perColumn = await measure(browser, shot.png, background, regions);
    const m = {};
    for (const [key, r] of Object.entries(perColumn)) {
        const name = key.split(':')[0];
        const g = (m[name] ??= { rows: new Set(), rowInk: {}, width: 0, maxContrast: 1 });
        r.inkRows.forEach((y) => g.rows.add(y));
        for (const [y, n] of Object.entries(r.rowInk)) g.rowInk[y] = (g.rowInk[y] ?? 0) + n;
        g.width += r.width;
        g.maxContrast = Math.max(g.maxContrast, r.maxContrast);
    }
    const [top, bottom] = [row * ch, (row + 1) * ch];
    for (const [name, g] of Object.entries(m)) {
        g.inkRows = [...g.rows].sort((a, b) => a - b);
        g.unbroken = Math.max(0, ...Object.values(g.rowInk)) / g.width;
        g.fills = g.inkRows.filter((y) => y >= top && y < bottom).length / (bottom - top);
        g.strength = g.maxContrast / contrast(parts[name].color, background);
    }
    if (process.env.BAR_METRICS) {
        const list = Object.entries(m).map(([k, g]) => `${k} strength ${fmt(g.strength)} unbroken ${fmt(g.unbroken)} fills ${fmt(g.fills)} y${g.inkRows[0]}-${g.inkRows.at(-1)}`);
        console.log(`METRIC ${file ?? ''} row ${fmt(top)}-${fmt(bottom)}${spillChecked ? '' : ' (own row only)'} | ${list.join(' | ')}`);
    }

    const problems = [];
    for (const [name, g] of Object.entries(m)) {
        // A pixel of slack: at a fractional scale the row's edge falls inside a pixel row, and the
        // renderer paints that shared pixel row from either side.
        const outside = g.inkRows.filter((y) => y < top - 1 || y >= bottom + 1);
        if (spillChecked && outside.length) problems.push(`${name}: paint outside its row at y=${outside.join(',')} (row ${fmt(top)}-${fmt(bottom)})`);
        if (g.fills < FILLS) problems.push(`${name}: fills ${fmt(g.fills)} of the row's height, under ${FILLS}`);
        if (g.unbroken < UNBROKEN) problems.push(`${name}: broken, its fullest pixel row is painted across ${fmt(g.unbroken)} of its width`);
        if (g.strength < STRENGTH) problems.push(`${name}: reaches ${fmt(g.strength)} of its color's contrast, under ${STRENGTH}`);
    }
    return problems;
}
