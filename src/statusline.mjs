// Main status line: model | cwd | session | effort | context bar | compact | cache | badges.
// Every segment stays hidden until it has something worth saying. Pure: what the stdin
// payload does not carry arrives in `inputs`, and the clock in `now`.

import { BAR_EMPTY, BAR_FULL, CYAN, DIM, MAGENTA, R, RED, RESET_ALL, SEP, YELLOW, pctColor, visLen, visTruncate } from './ansi.mjs';
import { baseName, fmtAge, fmtEta, fmtTokens, truncate } from './format.mjs';
import { legendLink as link } from './legend.mjs';

const BAR_MARK = '┃'; // auto-compact threshold marker
const MIN = 60_000;
const CACHE_TTL_MS = { '5m': 5 * MIN, '1h': 60 * MIN };

function render(d, ctx, opts) {
    const parts = [];

    const model = d?.model?.display_name ?? d?.model?.id;
    if (model) parts.push(link('model', `${CYAN}${model}${R}`));

    if (opts.showCwd) {
        const cwd = d?.workspace?.current_dir ?? d?.cwd;
        if (cwd) parts.push(link('cwd', `${DIM}${baseName(cwd) || cwd}${R}`));
    }

    // session_name is absent until the session has a custom or AI-generated title.
    if (opts.nameMax > 0 && d?.session_name) {
        parts.push(link('session', `${DIM}${truncate(d.session_name, opts.nameMax)}${R}`));
    }

    if (opts.showEffort && d?.effort?.level) parts.push(link('effort', `${MAGENTA}${d.effort.level}${R}`));

    const used = d?.context_window?.used_percentage;
    if (used != null) {
        const pct = Number(used);
        const col = pctColor(pct);
        let seg = '';
        if (opts.barWidth > 0) {
            const w = opts.barWidth;
            const filled = Math.min(w, Math.max(0, Math.round((w * pct) / 100)));
            const cells = Array.from({ length: w }, (_, i) => (i < filled ? BAR_FULL : BAR_EMPTY));
            // Mark where auto-compaction kicks in, unless it sits at the very end.
            if (ctx.compactPct != null && ctx.compactPct < 99) {
                const at = Math.min(w - 1, Math.max(0, Math.round((w * ctx.compactPct) / 100)));
                cells[at] = BAR_MARK;
            }
            seg += cells.join('') + ' ';
        }
        seg += `${Math.round(pct)}%`;
        seg = col + seg + R;

        if (opts.showTokens) {
            // used_percentage is input-only, so pair it with total_input_tokens to match.
            const size = d?.context_window?.context_window_size;
            if (ctx.usedTokens != null && size) seg += ` ${DIM}${fmtTokens(ctx.usedTokens)}/${fmtTokens(size)}${R}`;
            else if (size) seg += ` ${DIM}${fmtTokens(size)}${R}`;
        }
        parts.push(link('ctx', seg));
    }

    // Headroom before auto-compaction. Compacting is itself a large request (it reads what
    // it summarizes), so knowing it is close is worth a segment; `/clear` is free.
    if (opts.showCompact && ctx.compactLeft != null) {
        const frac = ctx.compactLeft / ctx.compactAt;
        const col = frac <= 0.1 ? RED : frac <= 0.25 ? YELLOW : DIM;
        parts.push(link('compact', `${col}compact ${fmtTokens(ctx.compactLeft)}${R}`));
    }

    if (opts.showCache && ctx.cacheAge != null) {
        const col = ctx.cacheAge >= ctx.cacheTtl ? RED : ctx.cacheAge >= ctx.cacheTtl * 0.75 ? YELLOW : DIM;
        const label = ctx.cacheAge >= ctx.cacheTtl ? 'cache cold' : `cache ${fmtAge(ctx.cacheAge)}`;
        parts.push(link('cacheage', `${col}${label}${R}`));
    }

    if (opts.showBadges) {
        // Only worth the space when the cache is actually underperforming.
        if (ctx.cacheHit != null && ctx.cacheHit < 90) {
            parts.push(link('cachehit', `${YELLOW}cache ${Math.round(ctx.cacheHit)}%${R}`));
        }
        // Not a pricing tier, but plan usage attributes "long context" separately, so it is
        // worth a quiet badge.
        if (d?.exceeds_200k_tokens) parts.push(link('exceeds200k', `${DIM}200k+${R}`));
        for (const rl of ctx.limits) {
            // The reset clock only matters once the window is nearly spent: that is when the
            // question changes from "how much is left" to "how long until it comes back".
            // Plain parentheses, not a glyph: U+21BB and friends are East Asian Ambiguous
            // width, so terminals reserve one column, the font paints two, and the clock ends
            // up overlapping whatever follows it.
            const eta = opts.showLimitEta && rl.eta && rl.pct >= 85 ? `${DIM} (${rl.eta})${R}` : '';
            parts.push(link('limits', `${pctColor(rl.pct)}${rl.label}${R}${eta}`));
        }
    }

    return parts.join(SEP);
}

// Progressive degradation, cheapest loss first. The context bar is the point of the line, so
// it is the last thing to shrink and never the first thing dropped.
const STEPS = [
    { barWidth: 16, nameMax: 40, showTokens: true, showCwd: true, showEffort: true, showCompact: true, showCache: true, showBadges: true, showLimitEta: true },
    { barWidth: 12, nameMax: 30, showTokens: true, showCwd: true, showEffort: true, showCompact: true, showCache: true, showBadges: true, showLimitEta: true },
    { barWidth: 10, nameMax: 20, showTokens: true, showCwd: true, showEffort: true, showCompact: true, showCache: true, showBadges: true, showLimitEta: true },
    { barWidth: 10, nameMax: 14, showTokens: true, showCwd: true, showEffort: true, showCompact: true, showCache: true, showBadges: true, showLimitEta: true },
    { barWidth: 8, nameMax: 0, showTokens: true, showCwd: true, showEffort: true, showCompact: true, showCache: true, showBadges: true, showLimitEta: true },
    { barWidth: 8, nameMax: 0, showTokens: true, showCwd: true, showEffort: true, showCompact: true, showCache: true, showBadges: true },
    { barWidth: 8, nameMax: 0, showTokens: true, showCwd: true, showEffort: true, showCompact: true, showCache: true, showBadges: false },
    { barWidth: 8, nameMax: 0, showTokens: false, showCwd: true, showEffort: true, showCompact: true, showCache: true, showBadges: false },
    { barWidth: 8, nameMax: 0, showTokens: false, showCwd: true, showEffort: true, showCompact: false, showCache: true, showBadges: false },
    { barWidth: 6, nameMax: 0, showTokens: false, showCwd: false, showEffort: true, showCompact: false, showCache: false, showBadges: false },
    { barWidth: 6, nameMax: 0, showTokens: false, showCwd: false, showEffort: false, showCompact: false, showCache: false, showBadges: false },
    { barWidth: 0, nameMax: 0, showTokens: false, showCwd: false, showEffort: false, showCompact: false, showCache: false, showBadges: false },
];

// prompt_cache (Claude Code 2.1.251+) carries the cache lifetime and the moment the cached
// prefix goes cold, so the last response was at expires_at - ttl. The next message after it
// goes cold reprocesses the whole conversation, which is what the segment warns about.
function promptCacheAge(pc, now) {
    const ttl = CACHE_TTL_MS[pc?.ttl];
    if (!pc?.caching_observed || pc.expires_at == null || !ttl) return { age: null, ttl: null };
    return { age: now - (Number(pc.expires_at) * 1000 - ttl), ttl };
}

function deriveContext(data, compactWindow, now) {
    const cw = data?.context_window ?? {};
    const size = cw.context_window_size;
    const usedTokens = cw.total_input_tokens ?? null;

    // With no window set, Claude Code compacts at the model's own limit.
    const compactAt = Math.min(compactWindow ?? size ?? Infinity, size ?? Infinity);
    const compactPct = Number.isFinite(compactAt) && size ? (compactAt / size) * 100 : null;
    const compactLeft = Number.isFinite(compactAt) && usedTokens != null ? Math.max(0, compactAt - usedTokens) : null;

    const cache = promptCacheAge(data?.prompt_cache, now);
    // Below 10 minutes there is nothing to act on; keep the line quiet.
    const cacheAge = cache.age != null && cache.age >= 10 * MIN ? cache.age : null;

    const cu = cw.current_usage;
    const cacheTotal = cu ? (cu.input_tokens ?? 0) + (cu.cache_creation_input_tokens ?? 0) + (cu.cache_read_input_tokens ?? 0) : 0;
    const cacheHit = cacheTotal > 0 ? ((cu.cache_read_input_tokens ?? 0) / cacheTotal) * 100 : null;

    // Surface plan limits only once they matter, so the line stays quiet the rest of the time.
    const limits = [];
    for (const [key, label] of [['five_hour', '5h'], ['seven_day', '7d']]) {
        const rl = data?.rate_limits?.[key];
        const pct = rl?.used_percentage;
        if (pct != null && pct >= 70) limits.push({ pct, label: `${label} ${Math.round(pct)}%`, eta: fmtEta(rl.resets_at, now) });
    }

    return { usedTokens, compactAt, compactPct, compactLeft, cacheAge, cacheTtl: cache.ttl, cacheHit, limits };
}

// inputs.columns: terminal width (0 = unknown); inputs.compactWindow: auto-compact window in
// tokens, or null when none is set.
export function renderStatusLine(data, { columns = 0, compactWindow = null } = {}, now = Date.now()) {
    const ctx = deriveContext(data, compactWindow, now);
    // Leave room for Claude Code's built-in left gutter.
    const budget = columns > 0 ? columns - 4 : Infinity;

    let out = '';
    for (const step of STEPS) {
        // Once the conversation is past half the compact window, the headroom is news.
        const showCompact = step.showCompact && ctx.compactLeft != null && ctx.usedTokens != null && ctx.usedTokens >= ctx.compactAt * 0.5;
        out = render(data, ctx, { ...step, showCompact });
        if (visLen(out) <= budget) break;
    }
    if (visLen(out) > budget && budget > 1) {
        // Drop a separator left dangling by the cut, then close whatever the cut left open.
        out = visTruncate(out, budget).replace(/(\x1b\[[0-9;]*m|\s|\|)*$/, '') + RESET_ALL;
    }
    return out;
}
