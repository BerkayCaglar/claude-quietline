# `cache 47m` / `cache cold`

How long ago the last response was — the age of the prompt cache. Once the cache expires, the
next message **reprocesses the whole conversation**, which in a long session is a lot of usage
on its own.

The lifetime comes from Claude Code itself: one hour or five minutes, depending on how the
session is billed ([cache lifetime](https://code.claude.com/docs/en/prompt-caching#cache-lifetime)).

Hidden under 10 minutes. Yellow at 75% of the lifetime; `cache cold` in red once it has
expired. Needs Claude Code 2.1.251 or later — older versions don't report the cache, and the
segment stays hidden.

When you see `cache cold`, even a short question reprocesses the whole context. Picking a
large session back up after a long break is fine when you mean to; for unrelated work,
`/clear` is cheaper.

---

[← All segments](./index.md)
