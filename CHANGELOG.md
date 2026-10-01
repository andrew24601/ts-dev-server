# Change Log

All notable changes to the "ts-dev-server" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## 0.1.0

- Modernised extension tooling: `@types/vscode`, `@vscode/test-electron`, ESLint (replaces TSLint), TypeScript 5, `vsce`.
- Requires VS Code 1.85+; activates on startup finished instead of `*`.
- Declared the toggle command in `contributes.commands` and added status bar icons.
- Show a warning when no folder is open; dispose the output channel properly.

- Initial release