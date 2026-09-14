# Agent panel rows

Each subagent row in the panel below the prompt carries the same fields as the main line:

`▸ Opus 5 (1M) | my-app | general-purpose Survey status line projects | high | ██░░ 18% 184k/1M | 2m14s`

- **Status glyph:** `▸` running · `◦` pending · `✓` done · `✗` failed · `⊘` cancelled
- **Context bar:** that agent's own window. Subagents run in a context separate from the main
  conversation — that is their main benefit: large reads don't fill yours.
- **effort:** in color when the agent sets its own level, dim when it inherits the session's.
- **Time:** since the agent started.

Column widths are shared across rows, so values line up.

---

[← All segments](./index.md)
