// Main status line fixtures, shared by the golden capture tool and the golden test.
//
// build(now, { projectDir }) returns:
//   data   - the stdin payload (an object, or a raw string for malformed input)
//   inputs - what the renderer gets from outside the payload: { compactWindow }
//   legacy - how the pre-extraction script sees the same world: env, settings files, state file
//
// Time offsets sit mid-interval, so a run that takes a few hundred milliseconds cannot tip a
// value that is rounded down to the minute.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const epochS = (ms) => Math.floor(ms / 1000);

// When the recorded payload below was captured; its timestamps are replayed relative to it.
const RECORDED_AT = Date.parse('2026-09-14T19:36:47.049Z');

const OPUS_1M = { id: 'claude-opus-5[1m]', display_name: 'Opus 5 (1M)' };
const SONNET = { id: 'claude-sonnet-5', display_name: 'Sonnet 5' };

const workspace = (dir) => ({ current_dir: dir, project_dir: dir });

function contextWindow(used, size, usage = { input: 20, create: 300, read: 9000 }) {
    const pct = Math.round((used / size) * 100);
    return {
        total_input_tokens: used,
        total_output_tokens: 1200,
        context_window_size: size,
        used_percentage: pct,
        remaining_percentage: 100 - pct,
        current_usage: {
            input_tokens: usage.input,
            output_tokens: 500,
            cache_creation_input_tokens: usage.create,
            cache_read_input_tokens: usage.read,
        },
    };
}

const LOW_HIT = { input: 60_000, create: 30_000, read: 40_000 };

function limits(now, fiveHour, sevenDay) {
    return {
        five_hour: { used_percentage: fiveHour.pct, resets_at: epochS(now + fiveHour.in) },
        seven_day: { used_percentage: sevenDay.pct, resets_at: epochS(now + sevenDay.in) },
    };
}

const quietLimits = (now) => limits(now, { pct: 20, in: 2 * HOUR + 30.5 * MIN }, { pct: 30, in: 4 * DAY });

// A prompt cache whose last response was `ageMs` ago, as both implementations see it: the
// legacy script infers the age from its state file, the new one reads prompt_cache.
function cache(now, { ageMs, ttl, sessionId, tokens, effort }) {
    const at = now - ageMs;
    const expiresAt = at + (ttl === '1h' ? HOUR : 5 * MIN);
    return {
        prompt_cache: {
            warm: now < expiresAt,
            caching_observed: true,
            ttl,
            expires_at: epochS(expiresAt),
            requests: 14,
            misses: 0,
            hit_ratio: 0.93,
        },
        state: { sessionId, tokens, at, effort },
    };
}

function cacheCase(name, { ageMs, ttl, subscriber }) {
    return {
        name,
        build(now, { projectDir }) {
            const sessionId = `sess-${name}`;
            const c = cache(now, { ageMs, ttl, sessionId, tokens: 150_000, effort: 'high' });
            return {
                data: {
                    session_id: sessionId,
                    model: OPUS_1M,
                    workspace: workspace(projectDir),
                    effort: { level: 'high' },
                    context_window: contextWindow(150_000, 1_000_000),
                    ...(subscriber ? { rate_limits: quietLimits(now) } : {}),
                    prompt_cache: c.prompt_cache,
                },
                legacy: { state: c.state },
            };
        },
    };
}

function compactCase(name, { used, size = 1_000_000, window, legacy }) {
    return {
        name,
        build: (now, { projectDir }) => ({
            data: {
                model: size === 1_000_000 ? OPUS_1M : SONNET,
                workspace: workspace(projectDir),
                context_window: contextWindow(used, size),
            },
            inputs: { compactWindow: window },
            legacy,
        }),
    };
}

export const STATUSLINE_CASES = [
    { name: 'minimal', build: () => ({ data: { model: OPUS_1M } }) },
    { name: 'workspace-only', build: (now, { projectDir }) => ({ data: { workspace: workspace(projectDir) } }) },
    {
        name: 'typical',
        build: (now, { projectDir }) => ({
            data: {
                model: OPUS_1M,
                workspace: workspace(projectDir),
                session_name: 'refactor status line',
                effort: { level: 'xhigh' },
                context_window: contextWindow(192_300, 1_000_000),
            },
        }),
    },
    {
        name: 'ctx-yellow-200k',
        build: (now, { projectDir }) => ({
            data: {
                model: SONNET,
                workspace: workspace(projectDir),
                effort: { level: 'high' },
                context_window: contextWindow(150_000, 200_000),
            },
        }),
    },
    {
        name: 'ctx-red-low-cache-hit',
        build: (now, { projectDir }) => ({
            data: { model: SONNET, workspace: workspace(projectDir), context_window: contextWindow(186_000, 200_000, LOW_HIT) },
        }),
    },
    {
        name: 'exceeds-200k',
        build: (now, { projectDir }) => ({
            data: {
                model: OPUS_1M,
                workspace: workspace(projectDir),
                context_window: contextWindow(450_000, 1_000_000),
                exceeds_200k_tokens: true,
            },
        }),
    },
    compactCase('compact-env-window', { used: 300_000, window: 500_000, legacy: { env: { CLAUDE_CODE_AUTO_COMPACT_WINDOW: '500k' } } }),
    compactCase('compact-user-settings-red', { used: 372_000, window: 400_000, legacy: { userSettings: { autoCompactWindow: '400k' } } }),
    compactCase('compact-project-precedence-yellow', {
        used: 240_000,
        window: 300_000,
        legacy: {
            projectLocalSettings: { autoCompactWindow: 300 },
            projectSettings: { autoCompactWindow: 900 },
            userSettings: { autoCompactWindow: '800k' },
        },
    }),
    compactCase('compact-below-half', { used: 200_000, window: 600_000, legacy: { env: { CLAUDE_CODE_AUTO_COMPACT_WINDOW: '600k' } } }),
    compactCase('compact-window-over-size', {
        used: 150_000,
        size: 200_000,
        window: 500_000,
        legacy: { env: { CLAUDE_CODE_AUTO_COMPACT_WINDOW: '500k' } },
    }),
    {
        name: 'limits-five-hour-hot',
        build: (now, { projectDir }) => ({
            data: {
                model: OPUS_1M,
                workspace: workspace(projectDir),
                context_window: contextWindow(90_000, 1_000_000),
                rate_limits: limits(now, { pct: 91, in: 14.5 * MIN }, { pct: 72, in: 3 * DAY + 14.5 * HOUR }),
            },
        }),
    },
    {
        name: 'limits-both-with-eta',
        build: (now, { projectDir }) => ({
            data: {
                model: OPUS_1M,
                workspace: workspace(projectDir),
                context_window: contextWindow(90_000, 1_000_000),
                rate_limits: limits(now, { pct: 97, in: 14.5 * MIN }, { pct: 93, in: 3 * DAY + 14 * HOUR + 30.5 * MIN }),
            },
        }),
    },
    {
        name: 'limits-quiet',
        build: (now, { projectDir }) => ({
            data: {
                model: OPUS_1M,
                workspace: workspace(projectDir),
                context_window: contextWindow(90_000, 1_000_000),
                rate_limits: quietLimits(now),
            },
        }),
    },
    {
        name: 'limits-reset-passed',
        build: (now, { projectDir }) => ({
            data: {
                model: OPUS_1M,
                workspace: workspace(projectDir),
                context_window: contextWindow(90_000, 1_000_000),
                rate_limits: limits(now, { pct: 99, in: -5.5 * MIN }, { pct: 40, in: DAY }),
            },
        }),
    },
    cacheCase('cache-subscriber-dim', { ageMs: 20.5 * MIN, ttl: '1h', subscriber: true }),
    cacheCase('cache-subscriber-yellow', { ageMs: 47.5 * MIN, ttl: '1h', subscriber: true }),
    cacheCase('cache-below-ten-minutes', { ageMs: 3.5 * MIN, ttl: '1h', subscriber: true }),
    cacheCase('cache-api-cold', { ageMs: 12.5 * MIN, ttl: '5m', subscriber: false }),
    cacheCase('cache-subscriber-cold-hours', { ageMs: 2 * HOUR + 5.5 * MIN, ttl: '1h', subscriber: true }),
    {
        name: 'long-session-name',
        build: (now, { projectDir }) => ({
            data: {
                model: OPUS_1M,
                workspace: workspace(projectDir),
                session_name: 'An unusually long session title that keeps going well past any sensible width',
                effort: { level: 'medium' },
                context_window: contextWindow(64_000, 1_000_000),
            },
        }),
    },
    {
        name: 'unicode-session-name',
        build: (now, { projectDir }) => ({
            data: {
                model: OPUS_1M,
                workspace: workspace(projectDir),
                session_name: 'Çağlar oturumu — ölçüm',
                context_window: contextWindow(64_000, 1_000_000),
            },
        }),
    },
    {
        name: 'kitchen-sink',
        build(now, { projectDir }) {
            const c = cache(now, { ageMs: 50.5 * MIN, ttl: '1h', sessionId: 'sess-kitchen-sink', tokens: 470_000, effort: 'max' });
            return {
                data: {
                    session_id: 'sess-kitchen-sink',
                    model: OPUS_1M,
                    workspace: workspace(projectDir),
                    session_name: 'kitchen sink: every segment at once',
                    effort: { level: 'max' },
                    context_window: contextWindow(470_000, 1_000_000, LOW_HIT),
                    exceeds_200k_tokens: true,
                    rate_limits: limits(now, { pct: 96, in: 42.5 * MIN }, { pct: 88, in: 2 * DAY + 3.5 * HOUR }),
                    prompt_cache: c.prompt_cache,
                },
                inputs: { compactWindow: 500_000 },
                legacy: { env: { CLAUDE_CODE_AUTO_COMPACT_WINDOW: '500k' }, state: c.state },
            };
        },
    },
    { name: 'malformed-json', build: () => ({ data: 'not json {' }) },
    { name: 'empty-object', build: () => ({ data: {} }) },
    // A real payload recorded from Claude Code 2.1.270, with paths, ids and repo names replaced.
    {
        name: 'recorded-2.1.270',
        build(now, { projectDir }) {
            const shift = (epochSeconds) => epochS(now + (epochSeconds * 1000 - RECORDED_AT));
            const promptCache = {
                warm: true,
                caching_observed: true,
                ttl: '1h',
                expires_at: shift(1789418176),
                requests: 3,
                misses: 0,
                expected_rebuilds: 0,
                hit_ratio: 0.8149294228142852,
                cache_write_tokens: 40751,
                miss_recache_tokens: 0,
                last_miss_at: null,
                last_miss_cause: null,
                miss_causes: {},
                recache_tokens_if_cold: 79969,
            };
            return {
                data: {
                    session_id: 'sess-recorded',
                    transcript_path: '/home/me/.claude/projects/my-app/sess-recorded.jsonl',
                    cwd: projectDir,
                    scratchpad_dir: '/tmp/claude/sess-recorded/scratchpad',
                    prompt_id: '00000000-0000-4000-8000-000000000000',
                    effort: { level: 'xhigh' },
                    session_name: 'List files in folder',
                    model: { id: 'claude-opus-5', display_name: 'Opus 5' },
                    workspace: {
                        current_dir: projectDir,
                        project_dir: projectDir,
                        added_dirs: ['/work/shared', '/work/docs'],
                        repo: { host: 'github.com', owner: 'example', name: 'my-app' },
                    },
                    version: '2.1.270',
                    output_style: { name: 'default' },
                    cost: { total_cost_usd: 1.79, total_duration_ms: 216962, total_api_duration_ms: 210845, total_lines_added: 0, total_lines_removed: 0 },
                    context_window: {
                        total_input_tokens: 79969,
                        total_output_tokens: 2335,
                        context_window_size: 1_000_000,
                        current_usage: { input_tokens: 4, output_tokens: 2335, cache_creation_input_tokens: 9244, cache_read_input_tokens: 70721 },
                        used_percentage: 8,
                        remaining_percentage: 92,
                    },
                    exceeds_200k_tokens: false,
                    prompt_cache: promptCache,
                    fast_mode: false,
                    thinking: { enabled: true },
                    rate_limits: {
                        five_hour: { used_percentage: 44, resets_at: shift(1789425000) },
                        seven_day: { used_percentage: 25, resets_at: shift(1789945200) },
                    },
                },
                legacy: { state: { sessionId: 'sess-recorded', tokens: 79969, at: promptCache.expires_at * 1000 - HOUR, effort: 'xhigh' } },
            };
        },
    },
];
