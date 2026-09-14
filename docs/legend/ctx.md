# Context bar — `███░░░░ 19% 192.3k/1M`

How full the context window is. The percentage counts **input tokens only** (input, cache
reads and cache writes); output tokens are not part of it. The number beside it uses the same
count: `used/total`.

Colors: green below 70%, yellow from 70%, red from 90%.

The `┃` inside the bar is the auto-compact threshold — see [compact](./compact.md).

To bring it down: `/clear` when you switch to unrelated work, hand large reads and research to
a subagent, and turn off MCP servers you don't need (`/mcp`). `/context` shows what takes the
space.

---

[← All segments](./index.md)
