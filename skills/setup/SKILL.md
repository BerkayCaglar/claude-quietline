---
description: Install or update the claude-quietline status line in Claude Code's settings
disable-model-invocation: true
---

Install the claude-quietline status line for the user. Follow these steps in order and stop at
the first failure.

1. Run `node --version`. If Node.js is missing or older than 22, stop and tell the user to
   install a current LTS from https://nodejs.org. Do not install Node.js yourself.
2. Run `node "${CLAUDE_PLUGIN_ROOT}/bin/cli.mjs" install --dry-run` and show the user its
   output: the files it will copy and how `statusLine` and `subagentStatusLine` in
   settings.json will change.
3. Ask the user to confirm. Continue only on an explicit yes.
4. Run `node "${CLAUDE_PLUGIN_ROOT}/bin/cli.mjs" install` and report its output. The status
   line takes effect on the next refresh; no restart is needed.
5. If any line starts with `[fail]`, show it to the user and stop. Never edit settings.json by
   hand.

The status line runs from its own copy, which only install refreshes, so run this skill again
after the plugin updates.
