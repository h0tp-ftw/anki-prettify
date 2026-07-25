# Prettify

Collection of customizable Anki flashcard templates with modern and clean themes.

![Prettify Cover](res/images/prettify-cover.png)

# Contents

- [About](#about)
- [Features](#features)
- [Themes](#themes)
- [Instructions](#instructions)
- [Add-on support](#add-on-support)
- [Compatibility](#compatibility)
- [Requirements](#requirements)
- [Development](#development)
- [Plans for future](#plans-for-future)
- [Support development](#support-development)

## About

Designed all the way from scratch, the goal is to make flashcards much more interesting to look at and reduce distractions, all while preserving the robust functionality Anki offers or even improving upon it.

## Features

### Responsive design

Supported on desktop, mobile and web!

![Responsive design](res/images/prettify-responsive.png)

### Image expansion to card width on hover

![Image expansion 1](res/gifs/images-1.gif)

### Image expansion to screen width on click

![Image expansion 2](res/gifs/images-2.gif)

### Tags for quick context

![Tags](res/gifs/tags.gif)

### Breadcrumbs to current deck

![Breadcrumbs](res/images/breadcrumbs.png)

### More useful features

- Dark and light themes
- Customizable color palettes
- Preferences for tweaking styles
- Fast rendering using CSS with minimal JavaScript

## Themes

| Theme                                    | Download                               | Font                                             |
| ---------------------------------------- | -------------------------------------- | ------------------------------------------------ |
| ![Nord cover](res/images/nord-cover.png) | [Nord](themes/nord/prettify-nord.apkg) | [Rubik](https://fonts.google.com/specimen/Rubik) |

## Instructions

### Installation

#### Direct download (Recommended)

- Click on link in the above table to download the deck with the specific theme.

- Download [`prettify.apkg`](https://github.com/h0tp-ftw/anki-prettify/raw/main/prettify.apkg) to install every included note type in one master deck.

- To download decks for specific note type, choose the note type folder from the `notetypes` directory under the theme directory. (`themes/THEME/notetypes/NOTETYPE`)

> **Note**: Download links to accompanying fonts to themes are provided above. Refer to [Anki Manual - Installing Fonts](https://docs.ankiweb.net/templates/styling.html#installing-fonts) for instructions.

#### Manual method

The source templates in [`src/templates`](src/templates/default/) intentionally contain a shared-runtime marker. Use the ready-to-paste files produced by the build instead:

```powershell
py tools\build.py --clean
```

Then:

1. Create a new note type (See [Adding a note type](https://docs.ankiweb.net/editing.html#adding-a-note-type)).
2. Click `Cards` in browser mode.
3. Copy the matching files from `dist/templates/default/` into the _Front_ and _Back_ editors.
4. Copy `dist/styles/css/nord.css` into _Styling_.
5. Alternatively, use `dist/prettify-templates-vVERSION.zip`, which contains the same self-contained HTML and CSS.

### Usage

1. Download the deck package
2. Open Anki and click on `Import File` (`⋮` -> `Import` in AnkiDroid)
3. Select the downloaded file
4. The new note type(s), `THEME-NOTETYPE` should be created automatically
5. Use the note type(s) or [clone](https://docs.ankiweb.net/editing.html#adding-a-note-type) to adapt to your needs

### Update

To update to the latest version of Prettify (themes/note types), just download the required decks again from the [repository](https://github.com/h0tp-ftw/anki-prettify).

> **Warning**: The already existing templates and styles will be _overwritten_ once you import the deck with updated content. To avoid any loss of edits, it is highly recommended that you use clones of the downloaded note types. (Refer to [Anki manual - Adding a note type](https://docs.ankiweb.net/editing.html#adding-a-note-type) for instructions on cloning a note type).

## Add-on support

The following add-ons are currently supported

- [Clickable Tags](https://ankiweb.net/shared/info/1739176371)
- [Edit Field During Review (Cloze)](https://ankiweb.net/shared/info/385888438)

> **Note**: Add-ons are optional and not necessary. The templates work as expected _with or without_ the add-ons.

## Compatibility

Tested on

- **Desktop**: Anki 2.1.49+ (Mac)
- **Mobile**: AnkiDroid 2.15+
- **Browsers** (AnkiWeb): Chrome (97.0.4692.71+), Safari (15.0+)

> **Note**: Although tested on relatively newer versions of Anki, all the themes should work as expected with all versions of Anki 2.1+.

## Requirements

- Anki 2.1 or higher (should work with Anki 2.0)

## Development

**Hosted preview:** https://h0tp-ftw.github.io/anki-prettify/

The repository includes a browser harness that renders the checked-in Anki templates and compiled CSS directly. It supports Basic, Basic + Reverse, and Cloze cards; front and back sides; light and night mode; desktop and mobile dimensions; rich fixtures; live field/template/CSS editing; same-webview card changes; source-copy actions; runtime diagnostics; and an interaction smoke test.

### First-time setup

```powershell
npm install
py -m venv .venv
.\.venv\Scripts\python -m pip install -r tools\requirements.txt
npx playwright install chromium
```

### Helpful VS Code actions

Open **Terminal → Run Task** to start the preview, run fast checks, exercise the browser smoke matrix, launch Playwright, export manual templates, or build versioned release artifacts. The repository also recommends the Playwright and Python extensions.

### Preview cards

```powershell
npm run preview
```

Open `http://127.0.0.1:4173/tools/preview/`. Changes under `src/templates`, `src/runtime`, `src/styles`, and `tools/preview` reload automatically. The **Live content** controls update note fields immediately, while the advanced **Source editor** lets you experiment with the selected template and theme CSS. Browser edits remain in the current tab and can be restored with the reset buttons; they do not write to the repository. The **Next card in same webview** action is useful for finding event-listener and state leaks that only appear after several Anki reviews.

### Validate changes

```powershell
npm run check
npm run test:browser
npm run test:e2e
```

`npm run check` validates the shared runtime, template markers, renderer behavior, and SCSS/CSS synchronization. `npm run test:browser` uses an installed Chrome, Chromium, or Edge for a quick real-browser interaction check. The Playwright suite exercises the full card matrix, live field/template/CSS editing and resets, image zoom, Escape cleanup, mobile/night-mode classes, and repeated card renders in one webview.

### Build packages

```powershell
npm run package -- --clean --version 1.0
```

The npm wrapper prefers `.venv` automatically and falls back to an available Python installation.

Generated output is written to `dist/`: theme packages, note-type packages, the master `prettify.apkg`, a manifest, self-contained manual templates, compiled CSS, and `prettify-templates-vVERSION.zip`. Packaging verifies the note/card counts inside every `.apkg` and does not rewrite source templates, SCSS, CSS, IDs, or tracked release files.

### Releases and hosted preview

Pushing a tag such as `v1.0.1` validates the source, builds the packages, and attaches them to a GitHub release. Every push to `main` exports the same harness to GitHub Pages at `https://h0tp-ftw.github.io/anki-prettify/`; enable **GitHub Actions** as the Pages source once in the repository settings.

## Plans for future

- [x] ~~New theme~~
- [ ] Documentation
- [ ] "Type in the answer" note type
- [ ] Out of the box support for popular note types (E.g. AnKing note types)
- [ ] More themes!

## Support development

If you like my work, you can support the development by

- Starring the project on GitHub
- Following me on GitHub
- [Buying me a coffee](https://www.buymeacoffee.com/pranavdeshai)
- Donating on [Ko-fi](https://ko-fi.com/pranavdeshai)
