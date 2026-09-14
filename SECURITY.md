# Security

## What claude-quietline touches

On every refresh, the status line reads the JSON Claude Code sends on stdin and, for the
auto-compact marker, `autoCompactWindow` from the project's `.claude/settings.local.json` and
`.claude/settings.json` and from your user `settings.json`. Claude Code does not tell the agent
rows the session's effort level, so the main line keeps it in
`<config>/claude-quietline/state/<session id>.json`, rewritten only when the level changes;
files untouched for a week are deleted. Nothing else is written, and nothing goes over the
network.

`install` and `uninstall` write only:

- `<config>/claude-quietline/`: the installed copy, its manifest `install.json`, the state
  folder and the settings backups;
- the `statusLine` and `subagentStatusLine` keys of `<config>/settings.json`, after taking a
  backup.

`<config>` is `~/.claude`, or `CLAUDE_CONFIG_DIR` when it is set.

## Reporting a vulnerability

Please report it privately through
[GitHub's private vulnerability reporting](https://github.com/BerkayCaglar/claude-quietline/security/advisories/new),
not in a public issue.
