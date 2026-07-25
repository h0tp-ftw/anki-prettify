import { expect, test } from '@playwright/test';

async function openHarness(page, query = '') {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`/tools/preview/${query}`);
  await expect(page.locator('#runtime-status')).toHaveText('No runtime errors');
  await expect(page.frameLocator('#card-frame').locator('.prettify-flashcard')).toBeVisible();
  return errors;
}

test('renders every note type and card side without unresolved tokens', async ({ page }) => {
  const errors = await openHarness(page, '?fixture=rich&appearance=dark');
  const combinations = [
    ['basic', 'front', '1'],
    ['basic', 'back', '1'],
    ['basic_reverse', 'front', '1'],
    ['basic_reverse', 'back', '1'],
    ['basic_reverse', 'front', '2'],
    ['basic_reverse', 'back', '2'],
    ['cloze', 'front', '1'],
    ['cloze', 'back', '1'],
  ];

  for (const [noteType, side, card] of combinations) {
    await page.locator('#note-type').selectOption(noteType);
    await page.locator('#side').selectOption(side);
    if (noteType === 'basic_reverse') await page.locator('#card-number').selectOption(card);

    await expect(page.locator('#token-status')).toHaveText('All resolved');
    await expect(page.locator('#runtime-status')).toHaveText('No runtime errors');
    await expect(page.frameLocator('#card-frame').locator('.prettify-subdeck').first()).toBeVisible();
  }

  expect(errors).toEqual([]);
});

test('image zoom advances, enters fullscreen, and closes with Escape', async ({ page }) => {
  const errors = await openHarness(page, '?fixture=images&note=basic&side=front&appearance=dark');
  const frame = page.frameLocator('#card-frame');
  const image = frame.locator('#qa img').first();

  await image.click();
  await expect(image).toHaveAttribute('data-zoom-level', '1');
  await image.click();
  await expect(image).toHaveAttribute('data-zoom-level', '2');
  await image.click();
  await expect(frame.locator('[data-is-fullscreen-clone="true"]')).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(frame.locator('[data-is-fullscreen-clone="true"]')).toHaveCount(0);
  await expect(page.locator('#runtime-status')).toHaveText('No runtime errors');
  expect(errors).toEqual([]);
});

test('back-side zoom follows the same progression', async ({ page }) => {
  const errors = await openHarness(page, '?fixture=images&note=cloze&side=back&appearance=light');
  const frame = page.frameLocator('#card-frame');
  const image = frame.locator('#qa img').first();

  await image.click();
  await expect(image).toHaveAttribute('data-zoom-level', '1');
  await image.click();
  await expect(image).toHaveAttribute('data-zoom-level', '2');
  await image.click();
  await expect(frame.locator('[data-is-fullscreen-clone="true"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('next card reuses the iframe document without multiplying visible UI', async ({ page }) => {
  const errors = await openHarness(page, '?fixture=images&note=basic&side=front');
  const frame = page.frameLocator('#card-frame');

  for (let index = 0; index < 3; index += 1) {
    await page.locator('#next-card').click();
    await expect(frame.locator('.contrast-toggle')).toHaveCount(1);
    await expect(frame.locator('#image-zoom-backdrop')).toHaveCount(1);
    await expect(page.locator('#runtime-status')).toHaveText('No runtime errors');
  }

  await page.locator('#smoke-test').click();
  await expect(page.locator('#runtime-status')).toHaveText('Interaction smoke test passed');
  expect(errors).toEqual([]);
});

test('mobile and dark-mode classes are applied inside the card webview', async ({ page }) => {
  await openHarness(page, '?viewport=mobile&appearance=dark');
  const frameBody = page.frameLocator('#card-frame').locator('body');
  await expect(frameBody).toHaveClass(/card/);
  await expect(frameBody).toHaveClass(/night_mode/);
  await expect(frameBody).toHaveClass(/mobile/);
  await expect(page.locator('#viewport-frame')).toHaveClass(/viewport-frame--mobile/);
});

test('live editors update fields, template, and CSS and can reset them', async ({ page }) => {
  const errors = await openHarness(page, '?fixture=rich&note=basic&side=front');
  const frame = page.frameLocator('#card-frame');

  await page.locator('#field-front').fill('<p id="live-field">Edited <strong>live</strong></p>');
  await expect(frame.locator('#live-field')).toHaveText('Edited live');

  await page.locator('#field-tags').fill('custom\nnested::tag');
  await expect(frame.locator('.prettify-tag')).toHaveCount(2);

  const css = await page.locator('#css-editor').inputValue();
  await page.locator('#css-editor').fill(`${css}\n#qa { outline: 7px solid rgb(1, 2, 3); }`);
  await expect(frame.locator('#qa')).toHaveCSS('outline-width', '7px');

  const template = await page.locator('#template-editor').inputValue();
  await page.locator('#template-editor').fill(
    template.replace('prettify-field--front', 'prettify-field--front live-template-marker'),
  );
  await expect(frame.locator('.live-template-marker')).toHaveCount(1);

  await page.locator('#reset-template').click();
  await expect(frame.locator('.live-template-marker')).toHaveCount(0);

  await page.locator('#reset-css').click();
  await expect(frame.locator('#qa')).toHaveCSS('outline-style', 'none');

  await page.locator('#reset-fields').click();
  await expect(page.locator('#field-front')).toHaveValue(/three core findings/);
  await expect(frame.locator('#live-field')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('cloze mode exposes and live-renders cloze-specific fields', async ({ page }) => {
  const errors = await openHarness(page, '?fixture=minimal&note=basic&side=front');
  const frame = page.frameLocator('#card-frame');

  await page.locator('#note-type').selectOption('cloze');
  await expect(page.locator('#field-front-row')).toBeHidden();
  await expect(page.locator('#field-text-row')).toBeVisible();
  await expect(page.locator('#field-back-extra-row')).toBeVisible();

  await page.locator('#field-text').fill('A {{c1::live cloze::hint}} example.');
  await expect(frame.locator('.cloze')).toHaveText('[hint]');

  await page.locator('#side').selectOption('back');
  await expect(frame.locator('.cloze')).toHaveText('live cloze');
  expect(errors).toEqual([]);
});

test('card preview stays top-aligned beside tall controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openHarness(page, '?fixture=rich&note=basic&side=front');

  const stageBox = await page.locator('.stage').boundingBox();
  const previewBox = await page.locator('#viewport-frame').boundingBox();

  expect(stageBox).not.toBeNull();
  expect(previewBox).not.toBeNull();
  expect(previewBox.y - stageBox.y).toBeGreaterThanOrEqual(20);
  expect(previewBox.y - stageBox.y).toBeLessThanOrEqual(30);
});
