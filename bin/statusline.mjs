#!/usr/bin/env node
// Claude Code status line entry: stdin JSON in, one line out. Everything that touches the
// outside world lives here and in src/inputs.mjs; src/statusline.mjs is pure.

import { autoCompactWindow, readStdinJson, rememberSessionEffort } from '../src/inputs.mjs';
import { renderStatusLine } from '../src/statusline.mjs';

const data = await readStdinJson();

const out = renderStatusLine(
    data,
    {
        columns: Number(process.env.COLUMNS) || 0,
        compactWindow: autoCompactWindow(data?.workspace?.project_dir ?? data?.workspace?.current_dir),
    },
    Date.now(),
);

// A single row, so no trailing newline.
process.stdout.write(out);

// The agent rows cannot see the session's effort; hand it over after the line is out.
rememberSessionEffort(data?.session_id, data?.effort?.level);
