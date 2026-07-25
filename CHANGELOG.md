# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Browser-based card preview harness with Anki field rendering, rich fixtures, live field/template/CSS editing and reset controls, self-hosted Rubik fonts, persistent-webview simulation, diagnostics, source-copy actions, and interaction checks
- Fast template/renderer tests, Sass synchronization checks, an installed-browser smoke test, and a Playwright browser suite
- CI, GitHub Pages preview deployment, and tag-based release packaging workflows
- A self-contained manual-template ZIP containing all six card templates and compiled theme CSS

### Changed

- All six declarative card templates now share one generated runtime from `src/runtime/card.js`, eliminating copied JavaScript drift
- Package generation now writes only to `dist/`, verifies note/card counts inside each `.apkg`, and no longer rewrites source templates, SCSS, CSS, IDs, or tracked deck files
- Python build dependencies are reduced to the package generator and its transitive requirements

### Fixed

- Restored multi-stage image zoom on back templates
- Removed duplicate fullscreen click handlers on front templates
- Preserved note-authored inline image styles when zoom or contrast state resets
- Fixed new-card breadcrumb animation state and removed stray template output after front-side scripts
- Added explicit cleanup for observers, keyboard listeners, fullscreen clones, and other state when Anki reuses its review webview
- Replaced destructive field-wide whitespace regex rewriting with conservative empty-edge trimming
- Corrected the Nord font stack so Rubik is selected, and added hosted-preview font loading with fallback diagnostics
- Made the browser preview reproduce Anki's outer `#qa` wrapper so theme selectors, sizing, and Rubik typography are actually applied to the rendered card

## [0.1.3] - 2023-01-15

### Fixed

- Fixed deck names wrapping to next line (thanks to @AnubisNekhet)
- Fixed cards without tags not showing proper deck breadcrumbs (thanks to @AnubisNekhet)

## [0.1.2] - 2023-01-05

### Fixed

- Fixed long code lines not wrapping to next line (#10)

## [0.1.1] - 2022-05-24

### Fixed

- Fixed tags not wrapping to next line (#7)

## [0.1.0] - 2022-05-20

### Added

- [THEME] - Nord
- [THEME] - Dracula
- [FEATURE] - Breadcrumbs to current deck
- [FEATURE] - Preference to align text in the card
- More CSS custom properties
- Download links to custom fonts
- SCSS files for themes

### Changed

- Complete rewrite of templates and themes for better customizability and maintainability
- Templates now use [BEM convention](http://getbem.com/) for class names

### Fixed

- Fix card not center-aligning on AnkiDroid
- Fix tables not colouring properly

[unreleased]: https://github.com/h0tp-ftw/anki-prettify/compare/0.1.3...main
[0.1.3]: https://github.com/h0tp-ftw/anki-prettify/compare/0.1.2...0.1.3
[0.1.2]: https://github.com/h0tp-ftw/anki-prettify/compare/0.1.1...0.1.2
[0.1.1]: https://github.com/h0tp-ftw/anki-prettify/compare/0.1.0...0.1.1
[0.1.0]: https://github.com/h0tp-ftw/anki-prettify/releases/tag/0.1.0
