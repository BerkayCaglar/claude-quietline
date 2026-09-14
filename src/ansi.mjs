// ANSI styling and terminal-width helpers shared by both status lines.

export const R = '\x1b[0m';
export const DIM = '\x1b[2m';
const dim = (code) => `\x1b[2;${code}m`; // dim + color
export const CYAN = dim(36);
export const GREEN = dim(32);
export const YELLOW = dim(33);
export const RED = dim(31);
export const MAGENTA = dim(35);
export const BLUE = dim(34);

export const SEP = `${DIM} | ${R}`;
export const SEP_WIDTH = 3;
export const BAR_FULL = '█';
export const BAR_EMPTY = '░';

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
