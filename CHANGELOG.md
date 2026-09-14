# Changelog

Notable changes to this project. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.1] - 2026-09-15

### Changed

- The README now shows the status line: pictures rendered from the code in light and dark, an
  animated walk through a session, a screenshot from Claude Code, and the line at five terminal
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

[Unreleased]: https://github.com/BerkayCaglar/claude-quietline/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/BerkayCaglar/claude-quietline/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/BerkayCaglar/claude-quietline/releases/tag/v0.1.0
