<div align="center">

# Anki Prettify — Nord × Catppuccin

**An opinionated, Nord-focused fork of [Prettify](https://github.com/pranavdeshai/anki-prettify) with richer card interactions, safer Anki webview behavior, reproducible packages, and a live browser editor.**

[Live preview and editor](https://h0tp-ftw.github.io/anki-prettify/) · [Download all note types](https://github.com/h0tp-ftw/anki-prettify/raw/main/prettify.apkg) · [View releases](https://github.com/h0tp-ftw/anki-prettify/releases)

[![CI](https://github.com/h0tp-ftw/anki-prettify/actions/workflows/ci.yml/badge.svg)](https://github.com/h0tp-ftw/anki-prettify/actions/workflows/ci.yml)
[![Preview site](https://github.com/h0tp-ftw/anki-prettify/actions/workflows/preview-pages.yml/badge.svg)](https://github.com/h0tp-ftw/anki-prettify/actions/workflows/preview-pages.yml)

</div>

## See the fork in motion

![Cursor-guided Anki Prettify preview and editor walkthrough](res/gifs/preview-editor-cursor-v2-crisp.gif)

This walkthrough is captured from this fork's real preview and editor—not inherited theme artwork. It shows live field editing, light and night modes, desktop and mobile layouts, front/back rendering, numbered progressive image zoom, fullscreen cleanup, and Cloze rendering. Try it yourself in the **[hosted preview and editor](https://h0tp-ftw.github.io/anki-prettify/)**.

## What this fork is

This repository is not the unchanged upstream multi-theme collection. It is a maintained, deliberately narrower variant built around the existing **Nord** package name and note-type IDs.

The visual treatment combines Nord neutrals with Catppuccin-inspired Latte and Mocha accents, Rubik typography, cleaner spacing, stronger light/night-mode contrast, and a more interactive card runtime. Dracula and Minimal were removed so the repository can focus on one cohesive theme rather than several lightly maintained variants.

Three note types are included:

- **Basic**
- **Basic + Reverse**
- **Cloze**

## What changed in this variant

### Refined presentation

- Responsive desktop, mobile, and AnkiWeb-friendly layouts
- Separate light and night-mode palettes
- Nord surfaces with Catppuccin-inspired accent colors
- Rubik-first font stack with Arial and system fallbacks
- Improved tables, code blocks, links, lists, cloze text, and authored inline formatting
- High-contrast and reduced-motion accommodations

### Better card context

- Nested deck names become animated breadcrumbs
- Tags become compact pills
- Parent tag paths appear as tooltips instead of taking over the card
- Front/back content receives restrained reveal animations without replaying every time the same review webview is reused

### Image controls

- Hover enlargement for quick inspection
- Progressive click zoom at 65%, 80%, and full screen
- Full-screen backdrop with click-to-close and `Escape` support
- Per-card contrast toggle for transparent or low-contrast images
- Independent state for multiple images
- Preservation of note-authored inline image styles

### Safer runtime behavior

Anki can reuse the same document across several reviews. The shared runtime explicitly cleans up observers, keyboard listeners, image clones, backdrop state, and other handlers before initializing the next card. This avoids duplicate controls and stale state after repeated reviews.

Whitespace cleanup is intentionally conservative: only empty nodes at field edges are removed, so deliberate line breaks, code formatting, tables, and media remain intact.

## Try it before installing

Open the **[hosted preview and editor](https://h0tp-ftw.github.io/anki-prettify/)** to:

- Switch between Basic, Basic + Reverse, and Cloze
- Preview front and back cards
- Test desktop/mobile and light/night-mode rendering
- Edit Deck, Front, Back, Text, Back Extra, and Tags live
- Experiment with the current HTML template and theme CSS
- Copy rendered or declarative template source
- Run the interaction smoke test and inspect runtime diagnostics

Browser edits stay in the current tab. They do not modify this repository or save back to GitHub.

## Downloads

| Package | Includes | Download |
| --- | --- | --- |
| Complete package | Basic, Basic + Reverse, and Cloze | [Download `prettify.apkg`](https://github.com/h0tp-ftw/anki-prettify/raw/main/prettify.apkg) |
| Nord bundle | All three Nord note types | [Download `prettify-nord.apkg`](https://github.com/h0tp-ftw/anki-prettify/raw/main/themes/nord/prettify-nord.apkg) |
| Basic | One front/back card template | [Download Basic](https://github.com/h0tp-ftw/anki-prettify/raw/main/themes/nord/notetypes/prettify-nord-basic.apkg) |
| Basic + Reverse | Forward and reverse cards | [Download Basic + Reverse](https://github.com/h0tp-ftw/anki-prettify/raw/main/themes/nord/notetypes/prettify-nord-basic_reverse.apkg) |
| Cloze | Cloze card with Back Extra | [Download Cloze](https://github.com/h0tp-ftw/anki-prettify/raw/main/themes/nord/notetypes/prettify-nord-cloze.apkg) |

The complete package and Nord bundle currently contain the same three note types because this fork intentionally ships one theme.

## Install in Anki

1. Download the complete package, the Nord bundle, or an individual note type above.
2. In Anki, choose **Import File**. On AnkiDroid, use **⋮ → Import**.
3. Select the downloaded `.apkg` file.
4. Use the imported `Prettify` note types directly, or clone them before making permanent changes.

> Importing a newer package can overwrite matching note-type templates and styling. Clone customized note types before updating so your edits are not lost.

### Rubik font

The hosted preview self-hosts Rubik and does not depend on Google Fonts. Inside Anki, the stylesheet first looks for a locally installed Rubik family and then for these files in Anki's media collection:

- `_Rubik-Regular.woff2`
- `_Rubik-Bold.woff2`
- `_Rubik-Italic.woff2`
- `_Rubik-BoldItalic.woff2`

The `.apkg` files do not currently bundle these font assets. Without a local Rubik installation or matching Anki media files, cards fall back to Arial or the platform UI font. See the [Anki manual's custom-font instructions](https://docs.ankiweb.net/templates/styling.html#installing-fonts) when an exact Rubik match is important.

## Optional add-on compatibility

The templates retain support for:

- [Clickable Tags](https://ankiweb.net/shared/info/1739176371)
- [Edit Field During Review — Cloze](https://ankiweb.net/shared/info/385888438)

Both add-ons are optional. The cards render and behave normally without them.

## Customize the cards

The easiest place to experiment is the [live editor](https://h0tp-ftw.github.io/anki-prettify/). For permanent Anki changes, clone the imported note type and edit it through **Cards**.

The main theme preferences are near the top of [`src/styles/scss/nord.scss`](src/styles/scss/nord.scss):

```scss
--card-max-width: 40em;
--card-text-align: left;
--font-size-regular: 18px;
--font-size-small: 16px;
--img-width: 50%;
--img-brightness: 1;
--img-filter: none;
```

Source templates are declarative and contain a shared-runtime marker. For ready-to-paste, self-contained files, use the generated output rather than copying directly from `src/templates`.

## Manual build and installation

### First-time setup

```powershell
npm ci
py -m venv .venv
.\.venv\Scripts\python -m pip install -r tools\requirements.txt
npx playwright install chromium
```

### Build packages

```powershell
npm run package -- --clean --version 1.0
```

Generated files are written to `dist/` without rewriting tracked source files. Output includes:

- A master `prettify.apkg`
- Theme and note-type `.apkg` packages
- Ready-to-paste front/back HTML
- Compiled theme CSS
- `prettify-templates-vVERSION.zip`
- A build manifest

To install manually:

1. Choose a matching pair under `dist/templates/default/`.
2. Paste the files into Anki's **Front Template** and **Back Template** editors.
3. Paste `dist/styles/css/nord.css` into **Styling**.
4. Add Rubik font files separately when required.

## Development

Start the local preview:

```powershell
npm run preview
```

Open `http://127.0.0.1:4173/tools/preview/`. Changes under `src/templates`, `src/runtime`, `src/styles`, and `tools/preview` reload automatically.

Run validation:

```powershell
npm run check
npm run test:browser
npm run test:e2e
```

Regenerate the README-native cursor walkthrough after meaningful preview changes:

```powershell
npm run preview:capture:cursor:v2:crisp
```

This command launches the local preview in Playwright and uses `ffmpeg` to write `res/gifs/preview-editor-cursor-v2-crisp.gif`. Its 1024×576 layout is composed for GitHub's README width, avoiding the browser downscaling that softened the larger HD export. The other capture commands remain available as alternate assets.

- `npm run check` validates templates, renderer behavior, runtime syntax, and SCSS/CSS synchronization.
- `npm run test:browser` exercises a smoke matrix in an installed Chrome, Chromium, or Edge browser.
- `npm run test:e2e` runs the full Playwright interaction suite.

Every push to `main` validates and exports the preview to GitHub Pages. Version tags such as `v1.0.1` build verified packages and attach them to a GitHub release.

See [`tools/README.md`](tools/README.md) for build-system details.

## Compatibility

The templates target modern Anki 2.1+ rendering environments and responsive mobile/web layouts. Automated browser coverage runs in Chromium and exercises every included note type and card side, dark/mobile classes, repeated same-webview renders, image interactions, live editing, font loading, and source resets.

Anki clients differ in webview behavior and supported CSS. Test customized templates on the clients you use before replacing an established note type.

## Upstream, attribution, and licenses

This project is a fork of [Prettify by Deshai Pranav](https://github.com/pranavdeshai/anki-prettify). The original concept, templates, and earlier theme work remain credited in source headers and the repository license. This fork's Nord/Catppuccin styling, runtime changes, packaging, preview editor, and test infrastructure are maintained by [@h0tp-ftw](https://github.com/h0tp-ftw).

- Project code: [MIT License](LICENSE)
- Rubik: [SIL Open Font License 1.1](https://openfontlicense.org/)
- Nord palette: [Nord](https://www.nordtheme.com/)
- Catppuccin palette inspiration: [Catppuccin](https://catppuccin.com/)
