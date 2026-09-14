// Agent-panel rows: replaces the default "name · description · token count" row for each
// subagent, mirroring the main line field for field:
//   <glyph> model | cwd | name description | effort | bar pct tokens | elapsed
// Every row arrives in one call, so column widths are computed across all tasks and the
// fields line up regardless of value length. Pure: see renderAgentRows.

import { BAR_EMPTY, BAR_FULL, BLUE, CYAN, DIM, GREEN, MAGENTA, R, RED, SEP, SEP_WIDTH, YELLOW, pctColor, visLen } from './ansi.mjs';
import { baseName, elapsed, fmtTokens, modelDisplay, truncate } from './format.mjs';
import { legendLink } from './legend.mjs';

const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length));
const maxLen = (arr) => arr.reduce((m, s) => Math.max(m, s.length), 0);

// Status values vary by Claude Code version, so match loosely and fall back to neutral.
function statusGlyph(status) {
    const s = String(status ?? '').toLowerCase();
    if (s.includes('run') || s.includes('progress') || s.includes('active')) return `${GREEN}▸${R}`;
    if (s.includes('pend') || s.includes('queue') || s.includes('wait')) return `${DIM}◦${R}`;
    if (s.includes('done') || s.includes('complete') || s.includes('success')) return `${BLUE}✓${R}`;
    if (s.includes('fail') || s.includes('error')) return `${RED}✗${R}`;
    if (s.includes('cancel') || s.includes('stop') || s.includes('kill')) return `${YELLOW}⊘${R}`;
    return `${DIM}·${R}`;
}

// One { id, content } per task that has an id. inputs.columns is the fallback width when the
// payload has none; inputs.inheritedEffort is the session's level, shown dimmed for tasks that
// inherit it, because the payload omits `effort` for those.
export function renderAgentRows(data, { columns: fallbackColumns = 0, inheritedEffort = null } = {}, now = Date.now()) {
    const tasks = (Array.isArray(data?.tasks) ? data.tasks : []).filter((t) => t?.id);
    const columns = Number(data?.columns) || fallbackColumns || 120;
    const budget = columns - 2;
    const barWidth = columns >= 140 ? 16 : columns >= 100 ? 10 : 8;

    // Pass 1: raw cell text, no colors and no padding yet.
    const cells = tasks.map((t) => {
        const size = t.contextWindowSize;
        const tokens = t.tokenCount;
        // Both context fields are omitted until the task's model resolves; tokenCount alone
        // still tells you the spend.
        const pct = tokens != null && size ? Math.min(100, (tokens / size) * 100) : null;
        return {
            task: t,
            model: modelDisplay(t.model),
            cwd: baseName(t.cwd),
            name: String(t.name ?? t.type ?? 'agent'),
            desc: String(t.label ?? t.description ?? '').replace(/\s+/g, ' ').trim(),
            effort: t.effort != null ? String(t.effort) : (inheritedEffort ?? ''),
            inherited: t.effort == null,
            pct,
            pctText: pct != null ? `${Math.round(pct)}%` : '',
            tokText: tokens != null ? (size ? `${fmtTokens(tokens)}/${fmtTokens(size)}` : fmtTokens(tokens)) : '',
            elapsed: elapsed(t.startTime, now),
        };
    });

    // Pass 2: one shared width per column so values line up across rows.
    const W = {
        model: maxLen(cells.map((x) => x.model)),
        cwd: maxLen(cells.map((x) => x.cwd)),
        name: maxLen(cells.map((x) => x.name)),
        effort: maxLen(cells.map((x) => x.effort)),
        pct: maxLen(cells.map((x) => x.pctText)),
        tok: maxLen(cells.map((x) => x.tokText)),
        elapsed: maxLen(cells.map((x) => x.elapsed)),
    };

    // The bar column only exists if at least one row has a resolvable percentage.
    const anyPct = cells.some((x) => x.pct != null);
    const barCol = anyPct ? barWidth + 1 + W.pct : 0;
    const ctxWidth = barCol + (W.tok ? W.tok + (barCol ? 1 : 0) : 0);

    // Fixed-width tail, so the flexible description absorbs all the slack.
    const tailWidth =
        (W.effort ? W.effort + SEP_WIDTH : 0) + (ctxWidth ? ctxWidth + SEP_WIDTH : 0) + (W.elapsed ? W.elapsed + SEP_WIDTH : 0);

    return cells.map((x) => {
        const head = [statusGlyph(x.task.status)];
        if (W.model) head.push(`${CYAN}${pad(x.model, W.model)}${R}`);
        if (W.cwd) head.push(`${DIM}${pad(x.cwd, W.cwd)}${R}`);

        // The glyph is joined with a plain space; the rest use the main line's separator.
        const headStr = head[0] + ' ' + head.slice(1).join(SEP);

        const nameStr = legendLink('agents', `${CYAN}${pad(x.name, W.name)}${R}`);
        const usedByRest = visLen(headStr) + SEP_WIDTH + W.name + tailWidth;
        const spare = budget - usedByRest - 1;
        const descStr = x.desc && spare > 6 ? ` ${DIM}${truncate(x.desc, spare)}${R}` : '';

        const left = headStr + SEP + nameStr + descStr;

        const tail = [];
        if (W.effort) tail.push(`${x.inherited ? DIM : MAGENTA}${pad(x.effort, W.effort)}${R}`);
        if (ctxWidth) {
            let seg = '';
            if (barCol) {
                if (x.pct != null) {
                    const filled = Math.min(barWidth, Math.max(0, Math.round((barWidth * x.pct) / 100)));
                    seg = `${pctColor(x.pct)}${BAR_FULL.repeat(filled)}${BAR_EMPTY.repeat(barWidth - filled)} ${x.pctText.padStart(W.pct)}${R}`;
                } else {
                    seg = ' '.repeat(barCol); // keep the column; this row has nothing for it
                }
            }
            if (W.tok) seg += `${barCol ? ' ' : ''}${DIM}${x.tokText.padStart(W.tok)}${R}`;
            tail.push(seg);
        }
        if (W.elapsed) tail.push(`${DIM}${x.elapsed.padStart(W.elapsed)}${R}`);

        const tailStr = tail.length ? SEP + tail.join(SEP) : '';
        const gap = Math.max(0, budget - visLen(left) - visLen(tailStr));
        return { id: x.task.id, content: left + ' '.repeat(gap) + tailStr };
    });
}
