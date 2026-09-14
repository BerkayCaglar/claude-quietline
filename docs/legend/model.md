# Model

The model the session runs on, as Claude Code names it — for example `Opus 5 (1M)`. Change it
with `/model`.

Switching models invalidates the prompt cache: the cache belongs to one model, so the first
request on the new model reprocesses the whole context.

---

[← All segments](./index.md)
