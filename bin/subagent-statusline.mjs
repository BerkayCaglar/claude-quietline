#!/usr/bin/env node
// Claude Code agent-panel entry: stdin { columns, tasks, ... } in, one JSON line per row out.
// Everything that touches the outside world lives here and in src/inputs.mjs; src/subagent.mjs
// is pure.

import { readStdinJson, sessionEffort } from '../src/inputs.mjs';
import { renderAgentRows } from '../src/subagent.mjs';

const data = await readStdinJson();

const rows = renderAgentRows(
    data,
    {
        columns: Number(process.env.COLUMNS) || 0,
        inheritedEffort: sessionEffort(data?.session_id),
    },
    Date.now(),
);

if (rows.length) process.stdout.write(`${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
