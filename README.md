# Logos for Zed

This directory contains a Zed extension port of the existing `logos-vscode` project.

## What Was Migrated

- Logos file associations for `.x`, `.xm`, `.xi`, and `.xmi`
- Objective-C based syntax highlighting through `tree-sitter-objc`
- A local `tree-sitter-logos` grammar derived from `tree-sitter-objc`
- Logos directive snippets for the most common `%` directives
- `clangd` integration for baseline Objective-C language intelligence in Logos files
- Logos directive completion and hover via a bundled local language server
- Document formatting powered by the `logos-format` token-rewrite strategy and `clang-format`

## What Changed

Zed extensions do not expose the same JavaScript API surface as VS Code. The original VS Code extension used `HoverProvider` and `CompletionItemProvider` from the `vscode` API. This port recreates those features by attaching a local Logos language server to the Zed extension, while `clangd` continues to provide baseline Objective-C language intelligence.

- language registration
- syntax highlighting
- snippets
- Logos-specific hover
- Logos-specific completion

## Current Limitations

- Directive highlighting is best-effort because Logos syntax is layered on top of Objective-C, while this port currently reuses `tree-sitter-objc`.
- Rich language intelligence would need either a dedicated Logos Tree-sitter grammar or a Rust/WASM extension layer.
- Formatting requires `clang-format` to be installed and available in `PATH`, or configured explicitly in Zed LSP settings.

The extension now ships a local `tree-sitter-logos` grammar and recognizes common Logos structures such as `%hook`, `%group`, `%subclass`, `%ctor`, `%dtor`, `%orig`, `%init`, and `%log` as dedicated syntax nodes. It is still an incremental fork of `tree-sitter-objc`, so the remaining work is broader syntax coverage for less common Logos patterns rather than basic hook-block parsing.
The grammar now includes corpus tests under `tree-sitter-logos/test/corpus`.

The original directive documentation has been preserved in [docs/logos-reference.md](./docs/logos-reference.md).

## Formatting

`logos-zed` formats documents by applying the same directive-rewrite approach used by the `logos-format` project, then sending the transformed text through `clang-format`, and finally restoring the Logos tokens.

By default it runs:

```text
clang-format --assume-filename objc
```

You can override the formatter command or arguments through Zed LSP settings for `Logos Language Server`. The extension forwards `settings` and `initialization_options` to the bundled language server.

Example:

```json
{
  "lsp": {
    "Logos Language Server": {
      "settings": {
        "formatter": {
          "clang_format_path": "clang-format",
          "clang_format_arguments": [
            "--assume-filename",
            "objc",
            "--style={BasedOnStyle: Chromium}"
          ]
        }
      }
    }
  }
}
```

## Grammar Development

Inside `tree-sitter-logos/`:

```text
./node_modules/.bin/tree-sitter generate
./node_modules/.bin/tree-sitter test
```

## Install Locally In Zed

1. Open Zed.
2. Run `zed: extensions`.
3. Click `Install Dev Extension`.
4. Select the `logos-zed` directory.

## Project Layout

```text
logos-zed/
  extension.toml
  Cargo.toml
  docs/logos-reference.md
  languages/logos/brackets.scm
  languages/logos/config.toml
  languages/logos/folds.scm
  languages/logos/highlights.scm
  languages/logos/indents.scm
  languages/logos/outline.scm
  server/logos-data.js
  server/logos-language-server.js
  snippets/logos.json
  src/lib.rs
  tree-sitter-logos/
```
