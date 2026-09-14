# Contributing

Thanks for helping. A bug report is most useful with the output of `doctor` — the issue template
asks for it.

## Development loop

```sh
git clone https://github.com/BerkayCaglar/claude-quietline
cd claude-quietline
npm test
node bin/cli.mjs install --dev   # every Claude Code session now runs this checkout
node bin/cli.mjs install         # back to a copied install when you are done
```

To try a change in one session without touching your settings, start Claude Code with
`claude --settings <file>`, where the file sets `statusLine` and `subagentStatusLine` to
`node '<checkout>/bin/statusline.mjs'` and `node '<checkout>/bin/subagent-statusline.mjs'`.

## Ground rules

- **No runtime dependencies.** The status line runs on every refresh, so startup time is the
  product.
- **The renderers are pure.** `src/statusline.mjs` and `src/subagent.mjs` get the payload, what
  the payload lacks (`inputs`) and the clock (`now`). All I/O stays in `bin/` and
  `src/inputs.mjs`.
- **Six files or fewer on the per-tick import chain.** `test/latency.test.mjs` guards the cost.
- **A segment stays hidden until it has something to act on.** A new segment needs a page in
  `docs/legend/` and an entry in `LEGEND_IDS`.
- **Commands written into `settings.json` must work in Git Bash, PowerShell and POSIX shells:**
  bare `node`, a single-quoted path, forward slashes.

## Tests

`npm test` runs the whole suite with `node:test`. `test/golden/` holds the exact output of every
fixture in `test/fixtures/` across a range of terminal widths. When you change what the line
prints on purpose, regenerate the goldens with `node test/tools/update-golden.mjs` and review the
diff: it should touch only what you meant to change.

## Pull requests

- Keep a pull request to one change, and add it to `CHANGELOG.md` under "Unreleased".
- CI runs the suite on Linux, macOS and Windows with Node.js 22 and 24.

## Releasing

1. Set the new version in `package.json` and `.claude-plugin/plugin.json` (a test keeps the two
   equal), and move the "Unreleased" entries in `CHANGELOG.md` under it.
2. Commit, then tag and push: `git tag -a vX.Y.Z -m vX.Y.Z` and `git push origin main vX.Y.Z`.
3. Once CI is green, create the GitHub release from the tag with the changelog entry as its
   notes, and publish to npm with `npm publish`.

Plugin users receive the new version through `claude plugin update`, but their status line only
changes when they run `/claude-quietline:setup` (or `install`) again.
