# claude-quietline

[![CI](https://github.com/BerkayCaglar/claude-quietline/actions/workflows/ci.yml/badge.svg)](https://github.com/BerkayCaglar/claude-quietline/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/claude-quietline)](https://www.npmjs.com/package/claude-quietline)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A fast, zero-dependency status line for [Claude Code](https://code.claude.com/docs) that stays
quiet until something needs your attention.

```text
Opus 5 (1M) | my-app | refactor status line | xhigh | ███░░░░░░░░░░░░░ 19% 192.3k/1M
```

The line always shows the model, the folder, the session name, the reasoning effort and how
full the context window is. Everything else appears only when it matters:

| Segment | Appears when |
|---|---|
| `┃` inside the bar | an auto-compact window is set — it marks where compaction starts |
| `compact 20k` | you are past half that window — tokens left before compaction |
| `cache 47m` | the prompt cache is 10 minutes old or more; yellow at 75% of its lifetime |
| `cache cold` | the cache has expired — the next message reprocesses the whole conversation |
| `cache 12%` | this turn's cache hit rate is below 90% |
| `200k+` | the context went past 200k tokens |
| `5h 91%` `(14m)` | a plan usage window is past 70%; the time until it resets joins past 85% |

Every segment links to a short page that explains it: hover to see the link, Ctrl+click
(Cmd+click on macOS) to open it. When the terminal gets narrow, segments give way in a fixed
order, and the context bar goes last.

The rows in the agent panel get the same fields, lined up in columns:

```text
▸ Opus 5 (1M) | my-app | general-purpose Survey status line projects | high | ██░░░░░░░░ 18% 184k/1M | 2m14s
```

## Install

Needs Node.js 22 or later, and Claude Code 2.1.251 or later for the cache segment.

```sh
npx -y claude-quietline@latest install
```

Or from a clone:

```sh
git clone https://github.com/BerkayCaglar/claude-quietline
node claude-quietline/bin/cli.mjs install
```

**Let Claude Code do it.** Paste this into a session:

> Install claude-quietline by following https://raw.githubusercontent.com/BerkayCaglar/claude-quietline/main/INSTALL.md

**As a plugin:**

```sh
claude plugin marketplace add BerkayCaglar/claude-quietline
claude plugin install claude-quietline@claude-quietline
```

Then run `/claude-quietline:setup` in a session.

`install` copies the status line into `~/.claude/claude-quietline/` (or
`$CLAUDE_CONFIG_DIR/claude-quietline/`), checks that it renders through the shell Claude Code
will use, backs up `settings.json`, and points `statusLine` and `subagentStatusLine` at the copy.
Nothing else in `settings.json` changes. Add `--dry-run` to see the changes first. Run `install`
again to update; running sessions pick the change up on their next refresh.

```sh
npx -y claude-quietline@latest doctor      # check the installation and time one render
npx -y claude-quietline@latest uninstall   # put back the status line you had before
```

## Why it is fast

Claude Code runs the status line on every refresh, and cancels a run that is still going when
the next one starts. So `settings.json` runs `node` directly on the installed copy — never
`npx`, which costs hundreds of milliseconds per refresh. There are no dependencies, and a render
loads six small files: about 15 ms on top of Node's own startup on a Windows laptop.

## Troubleshooting

Start with `doctor`: it checks the installation, the shell Claude Code uses and the Node.js it
finds there, and times one render.

- **The line is blank in one project.** That project's `.claude/settings.json` or
  `.claude/settings.local.json` sets its own `statusLine`, which wins over yours; `doctor` run
  from the project says so. `disableAllHooks: true` also turns the status line off.
- **Links print as plain text.** Claude Code decides whether your terminal supports hyperlinks.
  In VS Code and Windows Terminal, start Claude Code with `FORCE_HYPERLINK=1`. Everything else
  still renders; it just isn't clickable.
- **Windows.** Claude Code runs the command through Git Bash when it is installed, otherwise
  through PowerShell. `install` checks the one it will use.
- **macOS, started from an app rather than a terminal.** The app may not see the `node` your
  shell finds through nvm or fnm. Start Claude Code from a terminal, or install Node.js
  system-wide.
- **The bar is misaligned in a CJK terminal.** `█` and `┃` are East Asian Ambiguous width; a
  terminal set to draw those characters wide shifts everything after the bar.

## Development

```sh
npm test
node bin/cli.mjs install --dev   # point your settings at this checkout while you work on it
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
