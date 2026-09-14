# Installing claude-quietline — instructions for an AI coding agent

You are installing a status line into the user's Claude Code settings. Follow these steps in
order. Stop at the first failure and show the user the output; do not improvise a workaround.

## 1. Check the prerequisites

Run `node --version`. If Node.js is missing or older than v22, stop: tell the user that
claude-quietline needs Node.js 22 or later and point them to https://nodejs.org. Do not install
Node.js yourself.

## 2. Get the code

Clone into a new folder under the system temp directory — for example one made with
`mktemp -d`, or under `$env:TEMP` in PowerShell. The installer copies what it needs, so the clone
can go afterwards. Below, `<clone>` is the folder you cloned into.

```sh
git clone --depth 1 https://github.com/BerkayCaglar/claude-quietline "<clone>"
```

If git is not available but npm is, skip the clone and replace `node "<clone>/bin/cli.mjs"` with
`npx -y claude-quietline@latest` in every step below — for example
`npx -y claude-quietline@latest install --dry-run`.

## 3. Preview

```sh
node "<clone>/bin/cli.mjs" install --dry-run
```

Show the user the output: the files it will copy and how `statusLine` and `subagentStatusLine`
in their `settings.json` will change. If they already have a status line, tell them it will be
replaced and that `uninstall` puts it back.

## 4. Confirm

Ask the user for an explicit yes before you continue.

## 5. Install

```sh
node "<clone>/bin/cli.mjs" install
```

Every line of output starts with `[ok]`, `[warn]` or `[fail]`. On `[fail]`, show the message to
the user and stop.

## 6. Verify

```sh
node "<clone>/bin/cli.mjs" doctor
```

Report the result. `[warn]` lines are advice, not failures. Running Claude Code sessions,
including the one you are working in, pick the status line up on their next refresh; no restart
is needed.

## 7. Clean up

Delete `<clone>`. With npx there is nothing to clean up.

## Do not

- Do not edit `settings.json` by hand, and never write an `npx` command into it: the status line
  runs on every refresh, and `npx` adds hundreds of milliseconds each time.
- Do not use backslashes in a path you write into a command; Git Bash on Windows drops them.
- Do not install Node.js, change the user's shell, or set environment variables for them.

## Uninstall

```sh
node "$HOME/.claude/claude-quietline/bin/cli.mjs" uninstall
```

When `CLAUDE_CONFIG_DIR` is set, the copy lives in `$CLAUDE_CONFIG_DIR/claude-quietline/`
instead. Uninstall restores the status line the user had before and removes the installed copy;
settings backups stay in `claude-quietline/backups/`.
