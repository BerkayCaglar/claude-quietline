# The `┃` marker and `compact 20k`

`┃` marks the point on the bar where auto-compaction starts. `compact 20k` is how many tokens
are left until then. It appears once you are past half the threshold, turns yellow with 25%
left and red with 10% left.

The threshold is the auto-compact window, which you can set in three ways
([docs](https://code.claude.com/docs/en/model-config#set-the-auto-compact-window)):

- `/autocompact 500k` — saved to your user settings as `autoCompactWindow`
- `claude --autocompact 500k` — this launch only
- `CLAUDE_CODE_AUTO_COMPACT_WINDOW=500000` — a plain token count; overrides both

The status line reads the environment variable first, then `autoCompactWindow` from the
project's `.claude/settings.local.json`, the project's `.claude/settings.json` and your user
settings. It cannot see the `--autocompact` flag or managed settings. With no window set, it
measures against the model's full context window and draws no marker.

**Why it matters:** compaction is not free. It reads the conversation it summarizes, so in a
large context the compaction itself is a large request. If you are switching to unrelated work,
`/clear` costs nothing. For a focused summary, use `/compact <what to keep>`.

---

[← All segments](./index.md)
