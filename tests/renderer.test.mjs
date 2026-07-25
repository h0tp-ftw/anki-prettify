import assert from 'node:assert/strict';
import test from 'node:test';

import {
  prepareTemplate,
  previewBodyClasses,
  renderAnkiTemplate,
  unresolvedTokens,
} from '../tools/preview/renderer.mjs';

test('renders conditional tags and field substitutions', () => {
  const template = '<div>{{Deck}}</div>{{#Tags}}<p>{{clickable:Tags}}</p>{{/Tags}}<main>{{edit:Front}}</main>';
  const rendered = renderAnkiTemplate(
    template,
    { Deck: 'One::Two', Front: '<b>Question</b>', Tags: ['a::b', 'c'] },
    { side: 'front' },
  );

  assert.equal(rendered, '<div>One::Two</div><p>a::b c</p><main><b>Question</b></main>');
  assert.deepEqual(unresolvedTokens(rendered), []);
});

test('removes false conditional sections', () => {
  const template = '{{#Tags}}tags{{/Tags}}{{#Back Extra}}extra{{/Back Extra}}';
  const rendered = renderAnkiTemplate(
    template,
    { Tags: [], 'Back Extra': '' },
    { side: 'back' },
  );

  assert.equal(rendered, '');
});

test('renders the selected cloze differently on front and back', () => {
  const template = '{{edit:cloze:Text}}';
  const fields = { Text: 'Use {{c1::spaced repetition::method}} and {{c2::active recall}}.' };

  assert.equal(
    renderAnkiTemplate(template, fields, { side: 'front', ordinal: 1 }),
    'Use <span class="cloze">[method]</span> and active recall.',
  );
  assert.equal(
    renderAnkiTemplate(template, fields, { side: 'back', ordinal: 1 }),
    'Use <span class="cloze">spaced repetition</span> and active recall.',
  );
});

test('prepares reverse card 2 using the same transformation as packaging', () => {
  const template = '{{edit:Front}} / {{Back}}';
  assert.equal(
    prepareTemplate(template, { noteType: 'basic_reverse', cardNumber: 2 }),
    '{{edit:Back}} / {{Front}}',
  );
});

test('builds Anki-like body classes', () => {
  assert.equal(previewBodyClasses({ darkMode: false, mobile: false }), 'card');
  assert.equal(previewBodyClasses({ darkMode: true, mobile: true }), 'card night_mode mobile');
});
