export const NOTE_TYPES = {
  basic: {
    label: "Basic",
    directory: "basic",
    filename: "basic",
    cards: 1,
  },
  basic_reverse: {
    label: "Basic + reverse",
    directory: "basic_reverse",
    filename: "basic_reverse",
    cards: 2,
  },
  cloze: {
    label: "Cloze",
    directory: "cloze",
    filename: "cloze",
    cards: 1,
  },
};

export function templateUrl(noteType, side) {
  const config = NOTE_TYPES[noteType];
  if (!config) throw new Error(`Unknown note type: ${noteType}`);
  if (!['front', 'back'].includes(side)) throw new Error(`Unknown card side: ${side}`);

  return new URL(
    `../../src/templates/default/${config.directory}/${config.filename}-${side}.html`,
    import.meta.url,
  );
}

export function stylesheetUrl(theme = 'nord') {
  return new URL(`../../src/styles/css/${theme}.css`, import.meta.url);
}

export function runtimeUrl() {
  return new URL('../../src/runtime/card.js', import.meta.url);
}

export function injectRuntime(template, runtime) {
  const marker = '<!-- PRETTIFY_RUNTIME -->';
  const markerCount = template.split(marker).length - 1;
  if (markerCount !== 1) throw new Error(`Expected exactly one runtime marker, found ${markerCount}.`);
  return template.replace(
    marker,
    `<script>\n/* Generated from src/runtime/card.js */\n${runtime.trim()}\n</script>`,
  );
}

export function prepareTemplate(template, { noteType, cardNumber = 1 }) {
  if (noteType !== 'basic_reverse' || Number(cardNumber) !== 2) return template;

  return template
    .replaceAll('{{edit:Front}}', '{{edit:Back}}')
    .replaceAll('{{Back}}', '{{Front}}');
}

function renderConditionalSections(template, fields) {
  let rendered = template;
  let previous;

  do {
    previous = rendered;
    rendered = rendered.replace(
      /{{#([^}]+)}}([\s\S]*?){{\/\1}}/g,
      (_match, rawName, contents) => {
        const value = fields[rawName.trim()];
        return value == null || value === '' || (Array.isArray(value) && value.length === 0)
          ? ''
          : contents;
      },
    );
    rendered = rendered.replace(
      /{{\^([^}]+)}}([\s\S]*?){{\/\1}}/g,
      (_match, rawName, contents) => {
        const value = fields[rawName.trim()];
        return value == null || value === '' || (Array.isArray(value) && value.length === 0)
          ? contents
          : '';
      },
    );
  } while (rendered !== previous);

  return rendered;
}

function renderCloze(text, { side, ordinal = 1 }) {
  return String(text ?? '').replace(
    /{{c(\d+)::([\s\S]*?)(?:::(.*?))?}}/g,
    (_match, rawOrdinal, answer, hint) => {
      if (Number(rawOrdinal) !== Number(ordinal)) return answer;
      if (side === 'back') return `<span class="cloze">${answer}</span>`;
      return `<span class="cloze">[${hint || '...'}]</span>`;
    },
  );
}

function tagsAsText(tags) {
  if (Array.isArray(tags)) return tags.join(' ');
  return String(tags ?? '');
}

export function renderAnkiTemplate(template, fields, options) {
  const values = {
    ...fields,
    Tags: tagsAsText(fields.Tags),
  };

  let rendered = renderConditionalSections(template, values);
  const cloze = renderCloze(values.Text, options);

  const replacements = new Map([
    ['{{Deck}}', values.Deck ?? ''],
    ['{{Front}}', values.Front ?? ''],
    ['{{Back}}', values.Back ?? ''],
    ['{{Back Extra}}', values['Back Extra'] ?? ''],
    ['{{Text}}', values.Text ?? ''],
    ['{{Tags}}', values.Tags],
    ['{{clickable:Tags}}', values.Tags],
    ['{{edit:Front}}', values.Front ?? ''],
    ['{{edit:Back}}', values.Back ?? ''],
    ['{{edit:cloze:Text}}', cloze],
    ['{{cloze:Text}}', cloze],
  ]);

  for (const [token, value] of replacements) rendered = rendered.replaceAll(token, String(value));
  return rendered;
}

export function unresolvedTokens(rendered) {
  return [...new Set(rendered.match(/{{[^}]+}}/g) ?? [])];
}

export function previewBodyClasses({ darkMode = false, mobile = false }) {
  return ['card', darkMode ? 'night_mode' : '', mobile ? 'mobile' : '']
    .filter(Boolean)
    .join(' ');
}
