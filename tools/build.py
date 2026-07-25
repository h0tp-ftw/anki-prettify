"""Build Anki packages from source without modifying the source tree."""

from __future__ import annotations

import argparse
import json
import re
from contextlib import closing
from functools import cache
import shutil
import sqlite3
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile

try:
    import genanki
except ModuleNotFoundError as error:
    raise SystemExit(
        "Missing Python build dependencies. Run `python -m pip install -r tools/requirements.txt`."
    ) from error

ROOT = Path(__file__).resolve().parent.parent
VERSION_PATTERN = re.compile(r"Version: (?P<version>\d+(?:\.\d+)+)")
RUNTIME_MARKER = "<!-- PRETTIFY_RUNTIME -->"

FONTS = {
    "minimal": "Inter",
    "nord": "Rubik",
    "dracula": "Source Sans Pro",
}

NOTE_FIELDS = {
    "basic": [
        "What is <b>Anki</b>?",
        "<b>Anki</b>&nbsp;is a <u>free and open-source</u>&nbsp;flashcard&nbsp;program using&nbsp;<i>spaced repetition</i>, a technique from cognitive science for fast and long-lasting memorization.<br><br><img src='https://upload.wikimedia.org/wikipedia/commons/9/9a/Anki_2.1.6_screenshot.png'>",
    ],
    "basic_reverse": [
        "What is <b>Anki</b>?",
        "<b>Anki</b>&nbsp;is a <u>free and open-source</u>&nbsp;flashcard&nbsp;program using&nbsp;<i>spaced repetition</i>, a technique from cognitive science for fast and long-lasting memorization.<br><br><img src='https://upload.wikimedia.org/wikipedia/commons/9/9a/Anki_2.1.6_screenshot.png'>",
    ],
    "cloze": [
        "<b>Anki</b>&nbsp;is a <u>free and open-source</u>&nbsp;{{c1::flashcard}}&nbsp;program using&nbsp;<i>spaced repetition</i>, a technique from cognitive science for fast and long-lasting memorization.<br><br><img src='https://upload.wikimedia.org/wikipedia/commons/9/9a/Anki_2.1.6_screenshot.png'>",
        "Anki screenshot (<a href='https://en.wikipedia.org/wiki/Anki_(software)'>Wikipedia</a>)",
    ],
}

TYPE_NAMES = {
    "basic": "Basic",
    "basic_reverse": "Reverse",
    "cloze": "Cloze",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--version",
        help="Version embedded in generated model names and source comments. Defaults to the current template version.",
    )
    parser.add_argument(
        "--theme",
        dest="themes",
        action="append",
        help="Theme to build. Repeat for multiple themes. Defaults to every theme present in tools/ids.json.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "dist",
        help="Generated output directory (default: dist).",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Remove the output directory before building.",
    )
    parser.add_argument(
        "--use-checked-in-css",
        action="store_true",
        help="Skip Sass compilation and package src/styles/css directly.",
    )
    return parser.parse_args()


def current_version() -> str:
    source = (
        ROOT / "src" / "templates" / "default" / "basic" / "basic-front.html"
    ).read_text(encoding="utf-8")
    match = VERSION_PATTERN.search(source)
    if not match:
        raise RuntimeError("Could not find a Version comment in the basic front template.")
    return match.group("version")


def with_version(source: str, version: str) -> str:
    return VERSION_PATTERN.sub(f"Version: {version}", source)


def sass_command() -> list[str]:
    local_sass = ROOT / "node_modules" / "sass" / "sass.js"
    node = shutil.which("node")
    if local_sass.exists() and node:
        return [node, str(local_sass)]

    installed = shutil.which("sass")
    if installed:
        return [installed]

    raise RuntimeError(
        "Sass is not installed. Run `npm install`, or pass --use-checked-in-css."
    )


def compile_css(theme: str, destination: Path) -> str:
    source = ROOT / "src" / "styles" / "scss" / f"{theme}.scss"
    if not source.exists():
        raise FileNotFoundError(f"Missing SCSS source for theme {theme}: {source}")

    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [*sass_command(), "--no-source-map", "--style=expanded", str(source), str(destination)],
        cwd=ROOT,
        check=True,
    )
    return destination.read_text(encoding="utf-8")


def load_css(theme: str, output: Path, use_checked_in: bool) -> str:
    if use_checked_in:
        source = ROOT / "src" / "styles" / "css" / f"{theme}.css"
        if not source.exists():
            raise FileNotFoundError(f"Missing checked-in CSS for theme {theme}: {source}")
        return source.read_text(encoding="utf-8")

    return compile_css(theme, output / "styles" / "css" / f"{theme}.css")


def load_ids() -> dict[str, dict[str, dict[str, int]]]:
    with (ROOT / "tools" / "ids.json").open(encoding="utf-8") as handle:
        return json.load(handle)


@cache
def card_runtime() -> str:
    path = ROOT / "src" / "runtime" / "card.js"
    if not path.exists():
        raise FileNotFoundError(f"Missing shared card runtime: {path}")
    return path.read_text(encoding="utf-8").strip()


def inject_runtime(template: str) -> str:
    marker_count = template.count(RUNTIME_MARKER)
    if marker_count != 1:
        raise RuntimeError(
            f"Expected exactly one {RUNTIME_MARKER} marker, found {marker_count}."
        )
    script = (
        "<script>\n"
        "/* Generated from src/runtime/card.js */\n"
        f"{card_runtime()}\n"
        "</script>"
    )
    return template.replace(RUNTIME_MARKER, script)


def read_template(note_type: str, side: str, version: str) -> str:
    path = (
        ROOT
        / "src"
        / "templates"
        / "default"
        / note_type
        / f"{note_type}-{side}.html"
    )
    if not path.exists():
        raise FileNotFoundError(f"Missing template: {path}")
    source = with_version(path.read_text(encoding="utf-8"), version)
    return inject_runtime(source)


def card_templates(note_type: str, front: str, back: str) -> list[dict[str, str]]:
    templates = [{"name": "Card 1", "qfmt": front, "afmt": back}]
    if note_type == "basic_reverse":
        templates.append(
            {
                "name": "Card 2",
                "qfmt": front.replace("{{edit:Front}}", "{{edit:Back}}"),
                "afmt": back.replace("{{edit:Front}}", "{{edit:Back}}").replace(
                    "{{Back}}", "{{Front}}"
                ),
            }
        )
    return templates


def model_fields(note_type: str, theme: str) -> list[dict[str, str]]:
    font = FONTS.get(theme, "Arial")
    return [
        {"name": "Text" if note_type == "cloze" else "Front", "font": font},
        {
            "name": "Back Extra" if note_type == "cloze" else "Back",
            "font": font,
        },
    ]


def build_deck(
    theme: str,
    note_type: str,
    identifiers: dict[str, int],
    css: str,
    version: str,
) -> genanki.Deck:
    front = read_template(note_type, "front", version)
    back = read_template(note_type, "back", version)
    model = genanki.Model(
        model_id=identifiers["model_id"],
        name=f"Prettify {TYPE_NAMES.get(note_type, note_type)} v{version} (h0tp's mod)",
        fields=model_fields(note_type, theme),
        templates=card_templates(note_type, front, back),
        css=with_version(css, version),
        model_type=(
            genanki.Model.CLOZE
            if note_type == "cloze"
            else genanki.Model.FRONT_BACK
        ),
    )
    deck = genanki.Deck(
        identifiers["deck_id"],
        f"Prettify::{theme.capitalize()}::{note_type.capitalize().replace('_', ' ')}",
    )
    note = genanki.Note(
        guid=identifiers["note_id"],
        fields=NOTE_FIELDS[note_type],
        model=model,
        tags=["prettify", f"prettify::{theme}", f"prettify::{theme}::{note_type}"],
    )
    deck.add_model(model)
    deck.add_note(note)
    return deck


def verify_package(path: Path, expected_notes: int, expected_cards: int) -> None:
    with ZipFile(path) as archive:
        collection_name = next(
            (name for name in archive.namelist() if name.startswith("collection.anki")),
            None,
        )
        if not collection_name:
            raise RuntimeError(f"Package has no Anki collection database: {path}")

        with TemporaryDirectory(prefix="anki-prettify-") as temporary:
            database_path = Path(archive.extract(collection_name, temporary))
            with closing(sqlite3.connect(database_path)) as database:
                note_count = database.execute("SELECT COUNT(*) FROM notes").fetchone()[0]
                card_count = database.execute("SELECT COUNT(*) FROM cards").fetchone()[0]
                models = json.loads(database.execute("SELECT models FROM col").fetchone()[0])

    if note_count != expected_notes or card_count != expected_cards:
        raise RuntimeError(
            f"Unexpected package contents for {path}: "
            f"{note_count} note(s), {card_count} card(s); expected "
            f"{expected_notes} note(s), {expected_cards} card(s)."
        )

    if len(models) != expected_notes:
        raise RuntimeError(
            f"Unexpected model count for {path}: {len(models)}; expected {expected_notes}."
        )

    for model in models.values():
        if not model.get("css", "").strip():
            raise RuntimeError(f"Model has empty CSS in package: {path}")
        for template in model.get("tmpls", []):
            for key in ("qfmt", "afmt"):
                source = template.get(key, "")
                if RUNTIME_MARKER in source:
                    raise RuntimeError(
                        f"Unresolved runtime marker in {path}: "
                        f"{template.get('name')} {key}"
                    )
                if "__ankiPrettifyRuntime" not in source:
                    raise RuntimeError(
                        f"Shared runtime missing from {path}: "
                        f"{template.get('name')} {key}"
                    )


def export_manual_templates(
    output: Path,
    version: str,
    css_by_theme: dict[str, str],
) -> Path:
    template_root = output / "templates" / "default"
    for note_type in NOTE_FIELDS:
        for side in ("front", "back"):
            destination = template_root / note_type / f"{note_type}-{side}.html"
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(
                read_template(note_type, side, version),
                encoding="utf-8",
            )

    style_root = output / "styles" / "css"
    style_root.mkdir(parents=True, exist_ok=True)
    for theme, css in css_by_theme.items():
        (style_root / f"{theme}.css").write_text(
            with_version(css, version),
            encoding="utf-8",
        )

    instructions = f"""Anki Prettify manual templates v{version}

1. Choose a front/back pair under templates/default/.
2. Paste them into Anki's Cards editor.
3. Paste the desired file from styles/css/ into Styling.
4. Install the theme font separately if desired.

The exported HTML is self-contained: the shared JavaScript runtime has already been inlined.
"""
    (output / "MANUAL-INSTALL.txt").write_text(instructions, encoding="utf-8")

    archive_path = output / f"prettify-templates-v{version}.zip"
    with ZipFile(archive_path, "w", compression=ZIP_DEFLATED) as archive:
        for source_root in (template_root, style_root):
            for file in source_root.rglob("*"):
                if file.is_file():
                    archive.write(file, file.relative_to(output))
        archive.writestr("MANUAL-INSTALL.txt", instructions)

    print(f"Wrote {archive_path.relative_to(ROOT)} with self-contained HTML and CSS.")
    return archive_path


def write_package(
    decks: genanki.Deck | list[genanki.Deck],
    path: Path,
    *,
    expected_notes: int,
    expected_cards: int,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    genanki.Package(decks).write_to_file(path)
    if not path.exists() or path.stat().st_size == 0:
        raise RuntimeError(f"Package was not written correctly: {path}")
    verify_package(path, expected_notes, expected_cards)
    print(
        f"Wrote and verified {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path} "
        f"({expected_notes} note(s), {expected_cards} card(s))"
    )


def main() -> None:
    args = parse_args()
    version = args.version or current_version()
    output = args.output.resolve()

    if args.clean and output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True, exist_ok=True)

    ids = load_ids()
    themes = args.themes or sorted(ids)
    missing_themes = [theme for theme in themes if theme not in ids]
    if missing_themes:
        raise RuntimeError(
            f"Missing stable IDs for theme(s): {', '.join(missing_themes)}. Add them to tools/ids.json explicitly."
        )

    all_decks: list[genanki.Deck] = []
    css_by_theme: dict[str, str] = {}
    manifest: dict[str, Any] = {"version": version, "themes": {}, "packages": []}

    for theme in themes:
        css = load_css(theme, output, args.use_checked_in_css)
        css_by_theme[theme] = css
        theme_decks: list[genanki.Deck] = []
        manifest["themes"][theme] = []

        for note_type, identifiers in ids[theme].items():
            if note_type not in NOTE_FIELDS:
                raise RuntimeError(f"No sample note fields configured for note type: {note_type}")
            deck = build_deck(theme, note_type, identifiers, css, version)
            theme_decks.append(deck)
            all_decks.append(deck)
            manifest["themes"][theme].append(note_type)

            package_path = (
                output
                / "themes"
                / theme
                / "notetypes"
                / f"prettify-{theme}-{note_type}.apkg"
            )
            write_package(
                deck,
                package_path,
                expected_notes=1,
                expected_cards=2 if note_type == "basic_reverse" else 1,
            )
            manifest["packages"].append(str(package_path.relative_to(output)).replace("\\", "/"))

        theme_package = output / "themes" / theme / f"prettify-{theme}.apkg"
        write_package(
            theme_decks,
            theme_package,
            expected_notes=len(theme_decks),
            expected_cards=sum(
                2 if note_type == "basic_reverse" else 1
                for note_type in ids[theme]
            ),
        )
        manifest["packages"].append(str(theme_package.relative_to(output)).replace("\\", "/"))

    manual_archive = export_manual_templates(output, version, css_by_theme)
    manifest["manual_templates"] = manual_archive.name

    master_package = output / "prettify.apkg"
    write_package(
        all_decks,
        master_package,
        expected_notes=len(all_decks),
        expected_cards=sum(
            2 if note_type == "basic_reverse" else 1
            for theme in themes
            for note_type in ids[theme]
        ),
    )
    manifest["packages"].append(master_package.name)

    (output / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Built {len(all_decks)} deck(s) for version {version} without modifying source files.")


if __name__ == "__main__":
    main()
