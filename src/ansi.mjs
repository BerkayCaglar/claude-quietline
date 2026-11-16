// ANSI styling and terminal-width helpers.

export const R = '\x1b[0m';
export const DIM = '\x1b[2m';
const dim = (code) => `\x1b[2;${code}m`; // dim + color
export const CYAN = dim(36);
export const GREEN = dim(32);
export const YELLOW = dim(33);
export const RED = dim(31);
export const MAGENTA = dim(35);

export const SEP = `${DIM} | ${R}`;
// The bar is cells painted with a background color, not glyphs. A terminal that draws block
// characters from the font (VS Code's DOM renderer, which it uses when GPU acceleration is off)
// lets Consolas's `░` spill into the row above and turns it into a faint dot pattern once dimmed;
// a background fills the cell exactly in every font. Dim does not reach a background, so these
// are fixed, muted 256-color shades rather than the terminal's bright palette; Claude Code passes
// 256-color backgrounds through unchanged (recorded from 2.1.325) and turns RGB into them anyway.
// They suit a dark theme; on a light one the track reads as a dark block.
const bg = (n) => `\x1b[48;5;${n}m`;
export const BAR_TRACK = bg(238); // #444444
export const pctBackground = (p) => (p >= 90 ? bg(124) : p >= 70 ? bg(136) : bg(29)); // #af0000 #af8700 #00875f

// Closes any SGR style and any hyperlink a cut left open; an unterminated OSC 8 would
// swallow the rest of the terminal line.
export const RESET_ALL = `${R}\x1b]8;;\x07`;

export const pctColor = (p) => (p >= 90 ? RED : p >= 70 ? YELLOW : GREEN);

// OSC 8 hyperlink: terminals have no hover tooltips, so the hover shows the target and
// Ctrl/Cmd+click opens it.
export const hyperlink = (url, text) => `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;

// SGR colors and OSC 8 hyperlink wrappers both occupy zero terminal columns.
const ESC = /\x1b(?:\[[0-9;]*m|\]8;;[^\x07]*\x07)/g;
export const visLen = (s) => s.replace(ESC, '').length;

// Cut to a visible-character budget without slicing through an escape sequence.
export function visTruncate(s, max) {
    let out = '';
    let vis = 0;
    const re = new RegExp(ESC.source, 'g');
    let i = 0;
    while (i < s.length) {
        re.lastIndex = i;
        const m = re.exec(s);
        if (m && m.index === i) {
            out += m[0];
            i = re.lastIndex;
            continue;
        }
        if (vis >= max) break;
        out += s[i++];
        vis++;
    }
    return out;
}
