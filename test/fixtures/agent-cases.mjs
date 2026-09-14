// Agent-panel fixtures, shared by the golden capture tool and the golden test.
//
// build(now) returns:
//   data   - the stdin payload; the capture sets `columns` per width
//   inputs - what the renderer gets from outside the payload: { inheritedEffort }
//   legacy - how the pre-extraction script sees the same world: the session state file
//
// A case with widthVia: 'env' leaves `columns` out and sweeps the COLUMNS variable instead.
// Start times sit mid-second, so a slow run cannot tip an elapsed value.

const SEC = 1000;
const MIN = 60 * SEC;

// When the recorded payload below was captured; its start time is replayed relative to it.
const RECORDED_AT = Date.parse('2026-09-14T19:36:42.222Z');

const task = (fields) => ({ type: 'general-purpose', status: 'running', cwd: '/work/my-app', ...fields });

export const AGENT_CASES = [
    {
        name: 'single-running',
        build: (now) => ({
            data: {
                session_id: 'sess-agents-single',
                tasks: [
                    task({
                        id: 't1',
                        name: 'general-purpose',
                        description: 'Survey status line projects',
                        startTime: now - 134.5 * SEC,
                        model: 'claude-opus-5[1m]',
                        effort: 'high',
                        contextWindowSize: 1_000_000,
                        tokenCount: 184_000,
                    }),
                ],
            },
        }),
    },
    {
        name: 'mixed-statuses-inherited-effort',
        build: (now) => ({
            data: {
                session_id: 'sess-agents-mixed',
                tasks: [
                    task({
                        id: 'a',
                        name: 'Explore',
                        type: 'Explore',
                        description: 'Find the settings writer',
                        startTime: now - 12.5 * SEC,
                        model: 'claude-haiku-4-5-20251001',
                        contextWindowSize: 200_000,
                        tokenCount: 42_000,
                    }),
                    task({ id: 'b', name: 'Plan', type: 'Plan', status: 'pending', description: 'Design the installer' }),
                    task({
                        id: 'c',
                        name: 'general-purpose',
                        status: 'completed',
                        description: 'Capture golden outputs',
                        startTime: now - 3725.5 * SEC,
                        model: 'claude-sonnet-5',
                        effort: 'medium',
                        contextWindowSize: 200_000,
                        tokenCount: 160_000,
                    }),
                    task({
                        id: 'd',
                        name: 'reviewer',
                        status: 'failed',
                        description: 'Review the diff',
                        startTime: new Date(now - 61.5 * SEC).toISOString(),
                        model: 'claude-fable-5-1',
                        contextWindowSize: 1_000_000,
                        tokenCount: 950_000,
                    }),
                    task({
                        id: 'e',
                        name: 'custom',
                        status: 'killed',
                        label: 'Stopped by user',
                        description: 'ignored because the label wins',
                        model: 'some-custom-model-without-family',
                        tokenCount: 5_000,
                    }),
                ],
            },
            inputs: { inheritedEffort: 'xhigh' },
            legacy: { state: { sessionId: 'sess-agents-mixed', effort: 'xhigh' } },
        }),
    },
    {
        name: 'inherited-effort-unknown',
        build: (now) => ({
            data: {
                session_id: 'sess-agents-no-state',
                tasks: [
                    task({
                        id: 't',
                        name: 'general-purpose',
                        description: 'No state file exists for this session',
                        startTime: now - 5.5 * SEC,
                        model: 'claude-opus-5',
                        contextWindowSize: 200_000,
                        tokenCount: 1_000,
                    }),
                ],
            },
        }),
    },
    {
        name: 'long-descriptions',
        build: (now) => ({
            data: {
                session_id: 'sess-agents-long',
                tasks: [
                    task({
                        id: 'x',
                        name: 'general-purpose',
                        description: 'Read every legend page, compare each threshold with the code, and list every sentence that no longer matches',
                        startTime: now - 42.5 * SEC,
                        model: 'claude-opus-5',
                        effort: 'low',
                        contextWindowSize: 200_000,
                        tokenCount: 99_000,
                    }),
                    task({
                        id: 'y',
                        name: 'a-much-longer-agent-name',
                        label: 'Label text wins over the description   with   collapsed    whitespace',
                        description: 'unused',
                        startTime: now - 9.5 * MIN,
                        model: 'claude-sonnet-5',
                        effort: 'max',
                        contextWindowSize: 200_000,
                        tokenCount: 185_000,
                    }),
                ],
            },
        }),
    },
    {
        name: 'start-time-formats',
        build: (now) => ({
            data: {
                session_id: 'sess-agents-times',
                tasks: [
                    task({ id: 's', name: 'epoch-seconds', startTime: (now - 45.5 * SEC) / 1000, tokenCount: 10 }),
                    task({ id: 'm', name: 'epoch-ms', startTime: now - 7 * MIN - 30.5 * SEC, tokenCount: 20 }),
                    task({ id: 'i', name: 'iso', startTime: new Date(now - 2 * 60 * MIN - 5.5 * MIN).toISOString(), tokenCount: 30 }),
                    task({ id: 'g', name: 'garbage', startTime: 'yesterday', tokenCount: 40 }),
                    task({ id: 'f', name: 'future', startTime: now + MIN, tokenCount: 50 }),
                    task({ id: 'n', name: 'missing' }),
                ],
            },
        }),
    },
    { name: 'empty-tasks', build: () => ({ data: { session_id: 'sess-agents-empty', tasks: [] } }) },
    {
        name: 'tasks-without-ids',
        build: (now) => ({
            data: {
                session_id: 'sess-agents-ids',
                tasks: [{ name: 'no id at all' }, task({ id: 'ok', name: 'general-purpose', description: 'The only row', startTime: now - 3.5 * SEC })],
            },
        }),
    },
    { name: 'malformed-json', build: () => ({ data: 'nope' }) },
    {
        name: 'columns-from-env',
        widthVia: 'env',
        build: (now) => ({
            data: {
                session_id: 'sess-agents-env',
                tasks: [
                    task({
                        id: 'e1',
                        name: 'general-purpose',
                        description: 'Width comes from COLUMNS, then the 120 default',
                        startTime: now - 20.5 * SEC,
                        model: 'claude-opus-5',
                        contextWindowSize: 200_000,
                        tokenCount: 50_000,
                    }),
                ],
            },
        }),
    },
    // A real payload recorded from Claude Code 2.1.270, with paths and names replaced. The task
    // has no `name`, and no `effort` because it inherits the session's level.
    {
        name: 'recorded-2.1.270',
        build: (now) => ({
            data: {
                session_id: 'sess-recorded',
                transcript_path: '/home/me/.claude/projects/my-app/sess-recorded.jsonl',
                cwd: '/work/my-app',
                scratchpad_dir: '/tmp/claude/sess-recorded/scratchpad',
                prompt_id: '00000000-0000-4000-8000-000000000000',
                columns: 266,
                tasks: [
                    {
                        id: 'a525ac74d796f2267',
                        type: 'local_agent',
                        status: 'completed',
                        description: 'List files in repo root',
                        label: 'Compiling my-app directory listing',
                        startTime: now + (1789414406778 - RECORDED_AT),
                        model: 'claude-opus-5',
                        contextWindowSize: 1_000_000,
                        tokenCount: 84369,
                        tokenSamples: [80102, 84369],
                        cwd: '/work/my-app',
                    },
                ],
            },
            inputs: { inheritedEffort: 'xhigh' },
            legacy: { state: { sessionId: 'sess-recorded', effort: 'xhigh' } },
        }),
    },
];
