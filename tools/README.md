# Tools

## Card preview

Run `npm run preview`, then open `http://127.0.0.1:4173/tools/preview/`.

The harness loads the declarative templates, shared `src/runtime/card.js`, and compiled CSS directly from `src/`. It injects the runtime exactly as packaging does, renders Anki field and conditional syntax, and executes the self-contained result inside a persistent iframe. Use **Next card in same webview** to reproduce the document reuse that can expose leaked listeners or stale state in Anki.

Fixtures cover rich formatting, empty optional fields, code/tables, nested tags, long deck names, and multiple images. The harness can switch note type, side, reverse-card direction, light/night mode, and desktop/mobile dimensions. It also exposes source-copy links, runtime errors, unresolved tokens, and an interaction smoke test.

## Checks

- `npm run templates:check`: validate the source markers and shared runtime syntax.
- `npm test`: fast renderer and template invariants using Node's built-in test runner.
- `npm run css:check`: compile SCSS in memory and verify checked-in CSS is current.
- `npm run check`: run all fast checks.
- `npm run test:browser`: run a zero-dependency smoke test in an installed Chrome, Chromium, or Edge.
- `npm run test:e2e`: run the full Playwright interaction suite against the preview server.
- `npm run templates:export`: export ready-to-paste self-contained HTML to `dist/templates` without building decks.

## Package build

Install Python dependencies with `python -m pip install -r tools/requirements.txt`, then run:

```text
npm run package -- --clean --version 1.0
```

The Node wrapper prefers `.venv` automatically and otherwise tries the platform's normal Python launchers.

The builder compiles Sass, injects the shared runtime, reads stable IDs from `tools/ids.json`, verifies the SQLite note/card counts in every generated package, and writes all artifacts under `dist/`. Output includes `.apkg` packages, `manifest.json`, ready-to-paste templates/CSS, and `prettify-templates-vVERSION.zip`. It never updates source version comments, IDs, or tracked `.apkg` files.

Useful flags:

- `--theme nord`: build only one configured theme; repeat the flag for several themes.
- `--output PATH`: choose another generated output directory.
- `--use-checked-in-css`: package existing CSS when Sass is unavailable.
- omit `--version`: use the version in the Basic front-template comment.

New themes or note types require explicit stable IDs in `tools/ids.json`; the builder fails rather than inventing IDs during a release.
