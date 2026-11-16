# Security

## What claude-quietline touches

On every refresh, the status line reads the JSON Claude Code sends on stdin and, for the
auto-compact marker, `autoCompactWindow` from the project's `.claude/settings.local.json` and
`.claude/settings.json` and from your user `settings.json`. It writes nothing, and nothing goes
over the network.

`install` and `uninstall` write only:

- `<config>/claude-quietline/`: the installed copy, its manifest `install.json` and the settings
  backups;
- the `statusLine` key of `<config>/settings.json`, after taking a backup. Over an install of
  0.1.x, `install` also takes out the `subagentStatusLine` key 0.1.x wrote, and the `state`
  folder it kept.

`<config>` is `~/.claude`, or `CLAUDE_CONFIG_DIR` when it is set.

## Reporting a vulnerability

Please report it privately through
[GitHub's private vulnerability reporting](https://github.com/BerkayCaglar/claude-quietline/security/advisories/new),
not in a public issue.
