# Changelog

Notable changes to this project. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-11-16

### Removed

- The agent-panel rows. Claude Code 2.1.323 removed the `subagentStatusLine` setting, so agent
  rows always use Claude Code's own look. `install` and `uninstall` take the setting 0.1.x wrote
  back out of `settings.json` (what it replaced is not put back, since nothing reads it either),
  `install` deletes the effort state the rows read, and `doctor` warns while any
  `subagentStatusLine` is still there.

### Changed

- The context bar is painted with background colors instead of `█` and `░`. With VS Code's GPU
  acceleration off, Consolas's `░` spilled into the row above and was too faint to see once
  dimmed. The used part is a muted green, yellow or red, the rest gray (fixed 256-color shades
  chosen for a dark terminal), and the bar is no longer underlined as part of the legend link;
  the percentage still is.
- `install` sets `refreshInterval: 30` on the status line unless you set your own, so the cache
  age and reset times keep counting while nothing else happens.

### Added

- `cache cold` shows how many tokens the next message writes to the cache again
  (`prompt_cache.recache_tokens_if_cold`).
- `spend 92%`: a Claude gateway's spend limit, past 70% like the plan limits.
- `npm run test:visual` measures the bar as VS Code's terminal draws it, and `npm run test:e2e`
  runs a real Claude Code against a mock API, with no account. Both are dev-only; see
  CONTRIBUTING.md.

## [0.1.1] - 2026-09-15

### Changed

- The README now shows the status line: pictures rendered from the code in light and dark, an
  animated walk through a session, a screenshot from Claude Code, and the line at four terminal
  widths.

### Added

- `npm run media` regenerates the README pictures, and a test fails when a committed picture no
  longer matches the code.

## [0.1.0] - 2026-09-14

### Added

- Main status line: model, folder, session name, effort and a context bar, plus the auto-compact
  marker and headroom, cache age, cache hit rate, the 200k badge and plan limits, each shown only
  once it matters.
- Agent-panel rows with the same fields, aligned in columns.
- A legend page for every segment, linked from the segment itself.
- `install`, `uninstall` and `doctor` commands, and a Claude Code plugin with `setup` and
  `uninstall` skills.

[Unreleased]: https://github.com/BerkayCaglar/claude-quietline/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/BerkayCaglar/claude-quietline/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/BerkayCaglar/claude-quietline/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/BerkayCaglar/claude-quietline/releases/tag/v0.1.0
