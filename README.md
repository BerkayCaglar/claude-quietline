<div align="center">

# claude-quietline

**A status line for [Claude Code](https://code.claude.com/docs) that stays quiet until something needs your attention.**

[![CI](https://github.com/BerkayCaglar/claude-quietline/actions/workflows/ci.yml/badge.svg)](https://github.com/BerkayCaglar/claude-quietline/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/claude-quietline)](https://www.npmjs.com/package/claude-quietline)
[![downloads](https://img.shields.io/npm/dm/claude-quietline)](https://www.npmjs.com/package/claude-quietline)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/BerkayCaglar/claude-quietline/main/docs/media/hero-dark.svg">
  <img alt="The claude-quietline status line and two agent rows under the Claude Code prompt" src="https://raw.githubusercontent.com/BerkayCaglar/claude-quietline/main/docs/media/hero-light.svg" width="100%">
</picture>

</div>

```sh
npx -y claude-quietline@latest install
```

Needs Node.js 22 or later. Works on macOS, Linux and Windows.

## Why

- **Quiet by default.** The model, the folder, the effort level and a context bar. Compaction
  headroom, cache age, cache misses and plan limits appear only once they are worth acting on.
- **Fast.** No dependencies, about 15 ms on top of Node's own startup, and never `npx` on the
  path that runs at every refresh.
- **Every segment explains itself.** Ctrl+click (Cmd+click on macOS) a segment to open a short
  page about it.
- **Agents too.** The rows in the agent panel get the same fields, lined up in columns.

## A session, as the line tells it

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/BerkayCaglar/claude-quietline/main/docs/media/story-dark.svg">
  <img alt="An animated walk through a session: the line starts with only the model, folder and effort, then gains the context bar, the auto-compact marker, the headroom, the cache age, a cold cache and plan limits" src="https://raw.githubusercontent.com/BerkayCaglar/claude-quietline/main/docs/media/story-light.svg" width="100%">
</picture>

| Segment | Appears when |
|---|---|
| `┃` inside the bar | an auto-compact window is set — it marks where compaction starts |
| `compact 20k` | you are past half that window — tokens left before compaction |
| `cache 47m` | the prompt cache is 10 minutes old or more; yellow at 75% of its lifetime |
| `cache cold` | the cache has expired — the next message reprocesses the whole conversation |
| `cache 12%` | this turn's cache hit rate is below 90% |
| `200k+` | the context went past 200k tokens |
| `5h 91%` `(14m)` | a plan usage window is past 70%; the time until it resets joins past 85% |

## In Claude Code

<img alt="claude-quietline in the VS Code terminal right after Claude Code starts: only the model, the folder and the effort level" src="https://raw.githubusercontent.com/BerkayCaglar/claude-quietline/main/docs/media/claude-code.png" width="538">

Right after a session starts there is nothing to report yet, so the line holds just the model,
the folder and the effort level. The dotted underlines are the links to the legend pages.

## Narrow terminals

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/BerkayCaglar/claude-quietline/main/docs/media/narrow-dark.svg">
  <img alt="The same status line at 120, 100, 80, 60 and 40 columns: segments give way one by one and the context bar stays" src="https://raw.githubusercontent.com/BerkayCaglar/claude-quietline/main/docs/media/narrow-light.svg" width="100%">
</picture>

As the terminal narrows, segments give way in a fixed order; the context bar goes last.

## Install

```sh
npx -y claude-quietline@latest install
```

`install` copies the status line into `~/.claude/claude-quietline/` (or
`$CLAUDE_CONFIG_DIR/claude-quietline/`), checks that it renders through the shell Claude Code
will use, backs up `settings.json`, and points `statusLine` and `subagentStatusLine` at the copy.
Nothing else in `settings.json` changes. Add `--dry-run` to see the changes first, and run
`install` again to update. Running sessions pick the change up on their next refresh.

<details>
<summary><b>Let Claude Code install it</b></summary>

Paste this into a session:

> Install claude-quietline by following https://raw.githubusercontent.com/BerkayCaglar/claude-quietline/main/INSTALL.md

</details>

<details>
<summary><b>As a Claude Code plugin</b></summary>

```sh
claude plugin marketplace add BerkayCaglar/claude-quietline
claude plugin install claude-quietline@claude-quietline
```

Then run `/claude-quietline:setup` in a session.

</details>

<details>
<summary><b>From a clone</b></summary>

```sh
git clone https://github.com/BerkayCaglar/claude-quietline
node claude-quietline/bin/cli.mjs install
```

</details>

```sh
npx -y claude-quietline@latest doctor      # check the installation and time one render
npx -y claude-quietline@latest uninstall   # put back the status line you had before
```

The cache segment needs Claude Code 2.1.251 or later.

## How it stays fast

Claude Code runs the status line on every refresh, and cancels a run that is still going when
the next one starts. So `settings.json` runs `node` directly on the installed copy — never
`npx`, which costs hundreds of milliseconds per refresh. There are no dependencies, and a render
loads six small files: about 15 ms on top of Node's own startup on a Windows laptop.

## Troubleshooting

Start with `doctor`: it checks the installation, the shell Claude Code uses and the Node.js it
finds there, and times one render.

<details>
<summary><b>The line is blank in one project</b></summary>

That project's `.claude/settings.json` or `.claude/settings.local.json` sets its own
`statusLine`, which wins over yours; `doctor` run from the project says so.
`disableAllHooks: true` also turns the status line off.

</details>

<details>
<summary><b>Links print as plain text</b></summary>

Claude Code decides whether your terminal supports hyperlinks. In VS Code and Windows Terminal,
start Claude Code with `FORCE_HYPERLINK=1`. Everything else still renders; it just isn't
clickable.

</details>

<details>
<summary><b>Windows</b></summary>

Claude Code runs the command through Git Bash when it is installed, otherwise through
PowerShell. `install` checks the one it will use.

</details>

<details>
<summary><b>macOS, started from an app rather than a terminal</b></summary>

The app may not see the `node` your shell finds through nvm or fnm. Start Claude Code from a
terminal, or install Node.js system-wide.

</details>

<details>
<summary><b>The bar is misaligned in a CJK terminal</b></summary>

`█` and `┃` are East Asian Ambiguous width; a terminal set to draw those characters wide shifts
everything after the bar.

</details>

## Development

```sh
npm test
npm run media                    # regenerate the pictures in this README from the renderer
node bin/cli.mjs install --dev   # point your settings at this checkout while you work on it
```

The pictures above are rendered from the same code as the status line, and a test fails when
one of them no longer matches it. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
