---
description: Remove the claude-quietline status line and restore the one the user had before
disable-model-invocation: true
---

Remove the claude-quietline status line for the user. Stop at the first failure.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/bin/cli.mjs" uninstall --dry-run` and show the user what
   will change.
2. Ask the user to confirm. Continue only on an explicit yes.
3. Run `node "${CLAUDE_PLUGIN_ROOT}/bin/cli.mjs" uninstall` and report its output, including
   every `[warn]` line.
4. Tell the user they can now remove the plugin itself with
   `claude plugin uninstall claude-quietline@claude-quietline`.
