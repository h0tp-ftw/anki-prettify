const diagram = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="360" viewBox="0 0 720 360">
  <rect width="720" height="360" rx="24" fill="#f4f6f8"/>
  <circle cx="180" cy="180" r="88" fill="#8fbcbb" opacity=".7"/>
  <rect x="330" y="95" width="260" height="170" rx="18" fill="#d08770" opacity=".75"/>
  <path d="M248 180h78" stroke="#2e3440" stroke-width="12" stroke-linecap="round"/>
  <text x="360" y="185" font-family="Arial, sans-serif" font-size="34" fill="#2e3440">Preview image</text>
  <text x="360" y="225" font-family="Arial, sans-serif" font-size="20" fill="#4c566a">click to exercise zoom</text>
</svg>`);

const image = `<img alt="Preview diagram" src="data:image/svg+xml,${diagram}">`;

export const FIXTURES = {
  rich: {
    label: 'Rich content',
    fields: {
      Deck: 'Medicine::Cardiology::Heart failure',
      Front: `<p>What are the <b>three core findings</b> in this example?</p>${image}`,
      Back: `<ol><li><strong>Readable</strong> formatted text</li><li>A responsive image</li><li>Nested tags and breadcrumbs</li></ol><p><a href="https://apps.ankiweb.net/">Anki link</a></p>`,
      Text: `<p><b>Anki</b> uses {{c1::spaced repetition::learning method}} to improve long-term recall.</p>${image}`,
      'Back Extra': '<p><em>Extra:</em> the scheduler changes the interval after each review.</p>',
      Tags: ['medicine::cardiology', 'exam::high-yield', 'image'],
    },
  },
  formatting: {
    label: 'Formatting stress',
    fields: {
      Deck: 'Languages::Japanese::Grammar::Long breadcrumb name',
      Front: `<div style="color:#111111"><b>Bold</b>, <i>italic</i>, <u>underline</u>, and <span style="color:#000000">dark inline text</span>.</div><br><br><pre><code>const intentionalSpacing = true;\n\nconsole.log(intentionalSpacing);</code></pre>`,
      Back: `<table><thead><tr><th>Form</th><th>Meaning</th></tr></thead><tbody><tr><td>〜ている</td><td>ongoing state</td></tr><tr><td>〜ていた</td><td>past ongoing state</td></tr></tbody></table>`,
      Text: `The form {{c1::〜ている::grammar}} can describe an ongoing action.<br><br><code>彼は本を読んでいる。</code>`,
      'Back Extra': '<p>Keep intentional line breaks and code whitespace intact.</p>',
      Tags: ['language::japanese::grammar', 'formatting', 'very-long-tag-name'],
    },
  },
  minimal: {
    label: 'Minimal / empty optionals',
    fields: {
      Deck: 'Inbox',
      Front: 'A short question with no tags.',
      Back: 'A short answer.',
      Text: '{{c1::Minimal}} cloze card.',
      'Back Extra': '',
      Tags: [],
    },
  },
  images: {
    label: 'Multiple images',
    fields: {
      Deck: 'Visual::Image interactions',
      Front: `<p>Exercise independent image state.</p>${image}${image}`,
      Back: `<p>Click each image, press Escape, and toggle contrast.</p>${image}`,
      Text: `The {{c1::first::ordinal}} image should not leak state to the second.${image}${image}`,
      'Back Extra': `<p>Back extra also contains an image.</p>${image}`,
      Tags: ['visual', 'interaction::zoom'],
    },
  },
};
