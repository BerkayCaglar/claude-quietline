# `cache 12%`

This turn's cache hit rate: `cache_read / (input + cache_creation + cache_read)`. **Shown only
below 90%**; the rest of the time it stays out of the way.

A low rate means the cached prefix broke. Typical causes: switching models, adding or removing
an MCP server (tool definitions sit at the very start of the prompt), editing CLAUDE.md, or the
cache expiring. A single low turn is normal — it is the turn that writes the cache. If it stays
low turn after turn, something is changing the prefix every turn. `/usage` shows the session's
cache statistics.

---

[← All segments](./index.md)
