import { FIXTURES } from './fixtures.mjs';
import {
  NOTE_TYPES,
  injectRuntime,
  prepareTemplate,
  previewBodyClasses,
  renderAnkiTemplate,
  runtimeUrl,
  stylesheetUrl,
  templateUrl,
  unresolvedTokens,
} from './renderer.mjs';

const elements = {
  appearance: document.querySelector('#appearance'),
  cardFrame: document.querySelector('#card-frame'),
  cardNumber: document.querySelector('#card-number'),
  cardNumberRow: document.querySelector('#card-number-row'),
  copySource: document.querySelector('#copy-source'),
  copyTemplate: document.querySelector('#copy-template'),
  cssEditor: document.querySelector('#css-editor'),
  fieldBack: document.querySelector('#field-back'),
  fieldBackExtra: document.querySelector('#field-back-extra'),
  fieldBackExtraRow: document.querySelector('#field-back-extra-row'),
  fieldBackRow: document.querySelector('#field-back-row'),
  fieldDeck: document.querySelector('#field-deck'),
  fieldFront: document.querySelector('#field-front'),
  fieldFrontRow: document.querySelector('#field-front-row'),
  fieldTags: document.querySelector('#field-tags'),
  fieldText: document.querySelector('#field-text'),
  fieldTextRow: document.querySelector('#field-text-row'),
  fixture: document.querySelector('#fixture'),
  fontStatus: document.querySelector('#font-status'),
  nextCard: document.querySelector('#next-card'),
  noteType: document.querySelector('#note-type'),
  reloadSource: document.querySelector('#reload-source'),
  renderCount: document.querySelector('#render-count'),
  resetCss: document.querySelector('#reset-css'),
  resetFields: document.querySelector('#reset-fields'),
  resetTemplate: document.querySelector('#reset-template'),
  runtimeLog: document.querySelector('#runtime-log'),
  runtimeStatus: document.querySelector('#runtime-status'),
  side: document.querySelector('#side'),
  smokeTest: document.querySelector('#smoke-test'),
  templateName: document.querySelector('#template-name'),
  templateEditor: document.querySelector('#template-editor'),
  tokenStatus: document.querySelector('#token-status'),
  viewCss: document.querySelector('#view-css'),
  viewRuntime: document.querySelector('#view-runtime'),
  viewTemplate: document.querySelector('#view-template'),
  viewport: document.querySelector('#viewport'),
  viewportFrame: document.querySelector('#viewport-frame'),
};

const query = new URLSearchParams(location.search);
const state = {
  appearance: query.get('appearance') || 'dark',
  cardNumber: Number(query.get('card') || 1),
  fixture: query.get('fixture') || 'rich',
  noteType: query.get('note') || 'basic',
  renderCount: 0,
  sequence: 1,
  side: query.get('side') || 'front',
  viewport: query.get('viewport') || 'desktop',
};

const PREVIEW_FONT_STYLESHEET = 'https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&display=swap';

let rawTemplate = '';
let defaultTemplate = '';
let rawRuntime = '';
let renderedTemplate = '';
let compiledCss = '';
let defaultCss = '';
let runtimeErrors = [];
let renderTimer;

function fixtureFields(name = state.fixture) {
  const source = (FIXTURES[name] || FIXTURES.rich).fields;
  return {
    ...source,
    Tags: Array.isArray(source.Tags) ? source.Tags.join('\n') : String(source.Tags ?? ''),
  };
}

let editableFields = fixtureFields();

for (const [value, config] of Object.entries(NOTE_TYPES)) {
  elements.noteType.add(new Option(config.label, value));
}
for (const [value, fixture] of Object.entries(FIXTURES)) {
  elements.fixture.add(new Option(fixture.label, value));
}

function normalizeState() {
  if (!NOTE_TYPES[state.noteType]) state.noteType = 'basic';
  if (!FIXTURES[state.fixture]) state.fixture = 'rich';
  if (!['front', 'back'].includes(state.side)) state.side = 'front';
  if (!['light', 'dark'].includes(state.appearance)) state.appearance = 'dark';
  if (!['desktop', 'mobile'].includes(state.viewport)) state.viewport = 'desktop';
  if (state.noteType !== 'basic_reverse') state.cardNumber = 1;
  if (![1, 2].includes(state.cardNumber)) state.cardNumber = 1;
}

function syncControls() {
  normalizeState();
  elements.noteType.value = state.noteType;
  elements.side.value = state.side;
  elements.cardNumber.value = String(state.cardNumber);
  elements.fixture.value = state.fixture;
  elements.appearance.value = state.appearance;
  elements.viewport.value = state.viewport;
  elements.cardNumberRow.hidden = state.noteType !== 'basic_reverse';
  const isCloze = state.noteType === 'cloze';
  elements.fieldFrontRow.hidden = isCloze;
  elements.fieldBackRow.hidden = isCloze;
  elements.fieldTextRow.hidden = !isCloze;
  elements.fieldBackExtraRow.hidden = !isCloze;
  elements.viewportFrame.className = `viewport-frame viewport-frame--${state.viewport}`;
}

function syncFieldEditors() {
  elements.fieldDeck.value = editableFields.Deck ?? '';
  elements.fieldFront.value = editableFields.Front ?? '';
  elements.fieldBack.value = editableFields.Back ?? '';
  elements.fieldText.value = editableFields.Text ?? '';
  elements.fieldBackExtra.value = editableFields['Back Extra'] ?? '';
  elements.fieldTags.value = editableFields.Tags ?? '';
}

function syncSourceEditors() {
  elements.templateEditor.value = rawTemplate;
  elements.cssEditor.value = compiledCss;
}

function updateQuery() {
  const next = new URLSearchParams({
    appearance: state.appearance,
    card: String(state.cardNumber),
    fixture: state.fixture,
    note: state.noteType,
    side: state.side,
    viewport: state.viewport,
  });
  history.replaceState(null, '', `${location.pathname}?${next}`);
}

function setStatus(element, message, type = '') {
  element.textContent = message;
  element.className = type ? `status-${type}` : '';
}

function addRuntimeMessage(message, type = 'error') {
  const item = document.createElement('li');
  item.textContent = message;
  item.className = `status-${type}`;
  elements.runtimeLog.prepend(item);
  while (elements.runtimeLog.children.length > 12) elements.runtimeLog.lastElementChild.remove();
}

function currentFields() {
  const tags = String(editableFields.Tags ?? '')
    .split(/[\n,]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    ...editableFields,
    Tags: tags,
    Deck: `${editableFields.Deck || 'Inbox'}::Preview ${state.sequence}`,
  };
}

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url.pathname}`);
  return response.text();
}

async function loadSources({ resetTemplate = true, resetCss = true } = {}) {
  const template = templateUrl(state.noteType, state.side);
  const runtime = runtimeUrl();
  const stylesheet = stylesheetUrl('nord');

  const [templateSource, runtimeSource, cssSource] = await Promise.all([
    resetTemplate ? fetchText(template) : Promise.resolve(rawTemplate),
    fetchText(runtime),
    resetCss ? fetchText(stylesheet) : Promise.resolve(compiledCss),
  ]);

  if (resetTemplate) {
    rawTemplate = templateSource;
    defaultTemplate = templateSource;
  }
  rawRuntime = runtimeSource;
  if (resetCss) {
    compiledCss = cssSource;
    defaultCss = cssSource;
  }

  elements.viewTemplate.href = template.href;
  elements.viewRuntime.href = runtime.href;
  elements.viewCss.href = stylesheet.href;
  elements.templateName.textContent = template.pathname.split('/').slice(-3).join('/');
  syncSourceEditors();
}

function bridgeScript() {
  return `
    window.addEventListener('error', function (event) {
      parent.postMessage({
        source: 'anki-prettify-preview',
        type: 'runtime-error',
        message: event.message,
        stack: event.error && event.error.stack ? event.error.stack : ''
      }, '*');
    });
    window.addEventListener('unhandledrejection', function (event) {
      parent.postMessage({
        source: 'anki-prettify-preview',
        type: 'runtime-error',
        message: String(event.reason && event.reason.message ? event.reason.message : event.reason),
        stack: event.reason && event.reason.stack ? event.reason.stack : ''
      }, '*');
    });
    const originalConsoleError = console.error.bind(console);
    console.error = function (...args) {
      parent.postMessage({
        source: 'anki-prettify-preview',
        type: 'console-error',
        message: args.map(String).join(' ')
      }, '*');
      originalConsoleError(...args);
    };
  `;
}

async function initializeFrame() {
  elements.cardFrame.srcdoc = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="${PREVIEW_FONT_STYLESHEET}">
    <style id="anki-theme"></style>
    <script>${bridgeScript().replaceAll('</script>', '<\\/script>')}<\/script>
  </head>
  <body class="card"></body>
</html>`;

  await new Promise((resolve) => elements.cardFrame.addEventListener('load', resolve, { once: true }));
}

function executeTemplateInFrame(html) {
  const frameDocument = elements.cardFrame.contentDocument;
  if (!frameDocument) throw new Error('Preview iframe is not available.');

  frameDocument.querySelector('#anki-theme').textContent = compiledCss;
  frameDocument.documentElement.className = state.viewport === 'mobile' ? 'mobile' : '';
  frameDocument.body.className = previewBodyClasses({
    darkMode: state.appearance === 'dark',
    mobile: state.viewport === 'mobile',
  });
  frameDocument.body.replaceChildren();

  const parsed = frameDocument.createElement('template');
  parsed.innerHTML = html;
  const scripts = [...parsed.content.querySelectorAll('script')];
  for (const script of scripts) script.remove();
  frameDocument.body.append(parsed.content.cloneNode(true));

  for (const sourceScript of scripts) {
    const script = frameDocument.createElement('script');
    for (const attribute of sourceScript.attributes) script.setAttribute(attribute.name, attribute.value);
    script.textContent = sourceScript.textContent;
    frameDocument.body.append(script);
  }
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => render(), 120);
}

async function render({ reloadTemplate = false, reloadCss = false } = {}) {
  clearTimeout(renderTimer);
  renderTimer = undefined;

  try {
    syncControls();
    updateQuery();
    const resetTemplate = reloadTemplate || !rawTemplate;
    const resetCss = reloadCss || !compiledCss;
    if (resetTemplate || resetCss || !rawRuntime) {
      await loadSources({ resetTemplate, resetCss });
    }

    const prepared = prepareTemplate(rawTemplate, state);
    const selfContained = injectRuntime(prepared, rawRuntime);
    renderedTemplate = renderAnkiTemplate(selfContained, currentFields(), {
      ordinal: 1,
      side: state.side,
    });
    const unresolved = unresolvedTokens(renderedTemplate);

    runtimeErrors = [];
    elements.runtimeLog.replaceChildren();
    executeTemplateInFrame(renderedTemplate);
    const frameDocument = elements.cardFrame.contentDocument;
    if (frameDocument?.fonts) {
      await Promise.race([
        frameDocument.fonts.ready,
        wait(2500),
      ]);
      const rubikLoaded = frameDocument.fonts.check('16px "Rubik"');
      setStatus(
        elements.fontStatus,
        rubikLoaded ? 'Rubik loaded' : 'Rubik unavailable — using fallback',
        rubikLoaded ? 'ok' : 'warn',
      );
    } else {
      setStatus(elements.fontStatus, 'Font API unavailable', 'warn');
    }
    state.renderCount += 1;
    elements.renderCount.textContent = String(state.renderCount);
    setStatus(
      elements.tokenStatus,
      unresolved.length ? unresolved.join(', ') : 'All resolved',
      unresolved.length ? 'warn' : 'ok',
    );
    setStatus(elements.runtimeStatus, 'No runtime errors', 'ok');
  } catch (error) {
    setStatus(elements.runtimeStatus, error.message, 'error');
    addRuntimeMessage(error.stack || error.message);
  }
}

async function copyText(text, button, successLabel) {
  const original = button.textContent;
  await navigator.clipboard.writeText(text);
  button.textContent = successLabel;
  setTimeout(() => { button.textContent = original; }, 1200);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runSmokeTest() {
  const frameWindow = elements.cardFrame.contentWindow;
  const frameDocument = elements.cardFrame.contentDocument;
  if (!frameWindow || !frameDocument) return;

  const failures = [];
  const deck = frameDocument.querySelector('.prettify-deck');
  const tags = [...frameDocument.querySelectorAll('.prettify-tag')];
  const expectedTags = currentFields().Tags.length;

  if (!deck || !frameDocument.querySelector('.prettify-subdeck')) failures.push('Breadcrumbs did not initialize.');
  if (tags.length !== expectedTags) failures.push(`Expected ${expectedTags} tags, rendered ${tags.length}.`);

  const image = frameDocument.querySelector('#qa img');
  if (image) {
    image.click();
    await wait(20);
    if (image.dataset.zoomLevel !== '1') failures.push(`First image click reached zoom level ${image.dataset.zoomLevel || 'none'}, expected 1.`);

    image.click();
    await wait(20);
    if (image.dataset.zoomLevel !== '2') failures.push(`Second image click reached zoom level ${image.dataset.zoomLevel || 'none'}, expected 2.`);

    image.click();
    await wait(20);
    if (frameDocument.querySelectorAll('[data-is-fullscreen-clone="true"]').length !== 1) {
      failures.push('Third image click did not create exactly one fullscreen clone.');
    }

    frameDocument.dispatchEvent(new frameWindow.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(20);
    if (frameDocument.querySelector('[data-is-fullscreen-clone="true"]')) failures.push('Escape did not close fullscreen image.');
  }

  if (runtimeErrors.length) failures.push(`${runtimeErrors.length} runtime error(s) were captured.`);

  if (failures.length) {
    setStatus(elements.runtimeStatus, `Smoke test failed (${failures.length})`, 'error');
    for (const failure of failures) addRuntimeMessage(failure);
  } else {
    setStatus(elements.runtimeStatus, 'Interaction smoke test passed', 'ok');
    addRuntimeMessage('Breadcrumbs, tags, zoom progression, and Escape cleanup passed.', 'ok');
  }
}

for (const [element, key, transform = (value) => value] of [
  [elements.noteType, 'noteType'],
  [elements.side, 'side'],
  [elements.cardNumber, 'cardNumber', Number],
  [elements.fixture, 'fixture'],
  [elements.appearance, 'appearance'],
  [elements.viewport, 'viewport'],
]) {
  element.addEventListener('change', async () => {
    state[key] = transform(element.value);
    if (key === 'fixture') {
      editableFields = fixtureFields();
      syncFieldEditors();
    }
    if (key === 'noteType' || key === 'side') {
      await render({ reloadTemplate: true });
    } else {
      await render();
    }
  });
}

for (const [element, key] of [
  [elements.fieldDeck, 'Deck'],
  [elements.fieldFront, 'Front'],
  [elements.fieldBack, 'Back'],
  [elements.fieldText, 'Text'],
  [elements.fieldBackExtra, 'Back Extra'],
  [elements.fieldTags, 'Tags'],
]) {
  element.addEventListener('input', () => {
    editableFields[key] = element.value;
    scheduleRender();
  });
}

elements.templateEditor.addEventListener('input', () => {
  rawTemplate = elements.templateEditor.value;
  scheduleRender();
});

elements.cssEditor.addEventListener('input', () => {
  compiledCss = elements.cssEditor.value;
  scheduleRender();
});

elements.resetFields.addEventListener('click', () => {
  editableFields = fixtureFields();
  syncFieldEditors();
  render();
});

elements.resetTemplate.addEventListener('click', () => {
  rawTemplate = defaultTemplate;
  elements.templateEditor.value = rawTemplate;
  render();
});

elements.resetCss.addEventListener('click', () => {
  compiledCss = defaultCss;
  elements.cssEditor.value = compiledCss;
  render();
});

elements.reloadSource.addEventListener('click', () => render({ reloadTemplate: true, reloadCss: true }));
elements.nextCard.addEventListener('click', () => {
  state.sequence += 1;
  render();
});
elements.smokeTest.addEventListener('click', runSmokeTest);
elements.copyTemplate.addEventListener('click', () => copyText(renderedTemplate, elements.copyTemplate, 'Copied rendered template'));
elements.copySource.addEventListener('click', () => copyText(rawTemplate, elements.copySource, 'Copied raw template'));

window.addEventListener('message', (event) => {
  if (event.data?.source !== 'anki-prettify-preview') return;
  runtimeErrors.push(event.data);
  const detail = event.data.stack ? `${event.data.message}\n${event.data.stack}` : event.data.message;
  setStatus(elements.runtimeStatus, `${runtimeErrors.length} runtime error(s)`, 'error');
  addRuntimeMessage(detail);
});

if (query.get('smoke') !== '1' && ['127.0.0.1', 'localhost'].includes(location.hostname)) {
  const events = new EventSource('/__preview_events');
  events.addEventListener('change', async (event) => {
    const change = JSON.parse(event.data);
    if (change.path.startsWith('tools/preview/')) {
      location.reload();
      return;
    }
    await render({ reloadTemplate: true, reloadCss: true });
  });
}

normalizeState();
editableFields = fixtureFields();
syncControls();
syncFieldEditors();
await initializeFrame();
await render({ reloadTemplate: true, reloadCss: true });
if (query.get('smoke') === '1') await runSmokeTest();
