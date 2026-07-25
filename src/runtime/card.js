(function () {
  'use strict';

  const runtimeKey = '__ankiPrettifyRuntime';
  const previousRuntime = window[runtimeKey];
  if (previousRuntime && typeof previousRuntime.cleanup === 'function') {
    previousRuntime.cleanup();
  }

  const runtime = {
    cleanupCallbacks: [],
    fullscreenImage: null,
    observer: null,
    observerQueued: false,
    originalBodyOverflow: document.body.style.overflow,
  };
  window[runtimeKey] = runtime;

  function listen(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    runtime.cleanupCallbacks.push(() => target.removeEventListener(type, listener, options));
  }

  function closeFullscreen() {
    document.querySelectorAll('[data-is-fullscreen-clone="true"]').forEach((clone) => clone.remove());
    runtime.fullscreenImage = null;

    const backdrop = document.getElementById('image-zoom-backdrop');
    if (backdrop) {
      backdrop.classList.remove('active');
      backdrop.style.display = 'none';
    }
    document.body.style.overflow = runtime.originalBodyOverflow;
  }

  runtime.cleanup = function cleanup() {
    if (runtime.observer) runtime.observer.disconnect();
    closeFullscreen();
    runtime.cleanupCallbacks.splice(0).forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('Prettify cleanup error:', error);
      }
    });
  };

  function hash(value) {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  }

  function isBackSide() {
    return Boolean(document.querySelector('.prettify-divider--answer'));
  }

  function shouldAnimateNewCard() {
    if (isBackSide()) return false;

    const deck = document.querySelector('.prettify-deck')?.textContent || '';
    const front = document.querySelector('.prettify-field--front')?.textContent || '';
    const signature = hash(`${deck}\u0000${front}`);
    const storageKey = 'anki-prettify-last-card';
    const previous = sessionStorage.getItem(storageKey);
    sessionStorage.setItem(storageKey, signature);
    return previous !== signature;
  }

  function initializeBreadcrumbs(animate) {
    const deck = document.querySelector('.prettify-deck');
    if (!deck || deck.dataset.processed === 'true') return;

    const parts = (deck.textContent || '')
      .split('::')
      .map((part) => part.trim())
      .filter(Boolean);
    const fragment = document.createDocumentFragment();

    parts.forEach((part, index) => {
      const crumb = document.createElement('span');
      crumb.className = `prettify-subdeck ${index % 2 ? 'prettify-subdeck--secondary' : 'prettify-subdeck--primary'}`;
      crumb.textContent = part;
      if (animate) crumb.style.animationDelay = `${index * 100}ms`;
      fragment.appendChild(crumb);

      if (index < parts.length - 1) {
        const separator = document.createElement('span');
        separator.className = 'deck-separator';
        separator.textContent = '›';
        fragment.appendChild(separator);
      }
    });

    deck.replaceChildren(fragment);
    deck.dataset.processed = 'true';
  }

  function initializeTags(animate) {
    const container = document.querySelector('.prettify-tags');
    if (!container || container.dataset.processed === 'true') return;

    const tags = (container.textContent || '').split(/\s+/).filter(Boolean);
    const fragment = document.createDocumentFragment();

    tags.forEach((tag, index) => {
      const parts = tag.replace(/<[^>]*>/g, '').split('::').filter(Boolean);
      const leaf = parts.pop() || tag;
      const pill = document.createElement('span');
      pill.className = 'prettify-tag';
      pill.append(document.createTextNode(leaf));
      if (animate) pill.style.animationDelay = `${index * 50}ms`;

      if (parts.length) {
        const tooltip = document.createElement('span');
        tooltip.className = 'tag-tooltip';
        parts.forEach((part, partIndex) => {
          if (partIndex) {
            const arrow = document.createElement('span');
            arrow.className = 'tag-arrow';
            arrow.textContent = '→';
            tooltip.append(' ', arrow, ' ');
          }
          tooltip.append(document.createTextNode(part));
        });
        pill.appendChild(tooltip);
      }

      fragment.appendChild(pill);
    });

    container.replaceChildren(fragment);
    container.dataset.processed = 'true';
  }

  function isEmptyEdgeNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return !node.textContent.trim();
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    if (node.tagName === 'BR') return true;
    if (!['DIV', 'P'].includes(node.tagName)) return false;
    return !node.textContent.trim() && !node.querySelector('img, audio, video, object, iframe');
  }

  function trimEmptyFieldEdges() {
    document.querySelectorAll('.prettify-field').forEach((field) => {
      if (field.dataset.whitespaceProcessed === 'true') return;
      while (field.firstChild && isEmptyEdgeNode(field.firstChild)) field.firstChild.remove();
      while (field.lastChild && isEmptyEdgeNode(field.lastChild)) field.lastChild.remove();
      field.dataset.whitespaceProcessed = 'true';
    });
  }

  function colorChannels(value) {
    const normalized = value.trim().toLowerCase();
    const rgb = normalized.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgb) return rgb.slice(1, 4).map(Number);

    const hex = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!hex) return null;
    const expanded = hex[1].length === 3
      ? hex[1].split('').map((character) => character + character).join('')
      : hex[1];
    return [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16));
  }

  function enhanceTextContrast() {
    if (!document.body.classList.contains('night_mode')) return;

    document.querySelectorAll('.prettify-field [style*="color"]').forEach((element) => {
      if (element.dataset.contrastProcessed === 'true') return;
      const channels = colorChannels(element.style.color);
      if (channels) {
        const [red, green, blue] = channels;
        const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
        if (brightness < 128) {
          element.style.setProperty('color', '#eceff4', 'important');
          element.style.setProperty('text-shadow', '1px 1px 2px rgba(0, 0, 0, 0.8)', 'important');
        }
      }
      element.dataset.contrastProcessed = 'true';
    });
  }

  function contrastIcon(active) {
    if (active) {
      return '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor" stroke="currentColor" stroke-width="2"/></svg>';
    }
    return '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2a10 10 0 0 0 0 20V2z" fill="currentColor"/></svg>';
  }

  function addContrastToggle() {
    const flashcard = document.querySelector('.prettify-flashcard');
    const images = [...document.querySelectorAll('#qa img:not([data-is-fullscreen-clone="true"])')];
    if (!flashcard || !images.length || flashcard.querySelector('.contrast-toggle')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'contrast-toggle';
    button.title = 'Toggle image contrast enhancement';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = contrastIcon(false);
    flashcard.appendChild(button);

    listen(button, 'click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const active = button.classList.toggle('active');
      button.setAttribute('aria-pressed', String(active));
      button.innerHTML = contrastIcon(active);
      images.forEach((image) => image.classList.toggle('prettify-image--contrast', active));
    });
  }

  function resetImage(image) {
    image.dataset.zoomLevel = '0';
  }

  function resetAllImages() {
    document.querySelectorAll('#qa img:not([data-is-fullscreen-clone="true"])').forEach(resetImage);
  }

  function openFullscreen(source) {
    closeFullscreen();
    const clone = source.cloneNode(true);
    clone.removeAttribute('id');
    clone.classList.remove('prettify-image--contrast');
    clone.dataset.isFullscreenClone = 'true';
    clone.dataset.zoomLevel = '3';
    Object.assign(clone.style, {
      background: 'transparent',
      border: 'none',
      borderRadius: '0',
      cursor: 'zoom-out',
      height: '100vh',
      left: '0',
      margin: '0',
      maxHeight: 'none',
      maxWidth: 'none',
      objectFit: 'contain',
      objectPosition: 'center',
      padding: '0',
      position: 'fixed',
      top: '0',
      transition: 'none',
      width: '100vw',
      zIndex: '10001',
    });

    const backdrop = document.getElementById('image-zoom-backdrop');
    if (backdrop) {
      backdrop.style.display = 'block';
      backdrop.classList.add('active');
    }
    document.body.style.overflow = 'hidden';
    document.body.appendChild(clone);
    runtime.fullscreenImage = clone;
    listen(clone, 'click', closeFullscreen);
  }

  function manageImages() {
    const images = [...document.querySelectorAll('#qa img:not([data-is-fullscreen-clone="true"])')];
    images.forEach((image) => {
      if (image.dataset.prettifyZoomInitialized === 'true') return;
      image.dataset.prettifyZoomInitialized = 'true';
      image.dataset.zoomLevel = image.dataset.zoomLevel || '0';

      listen(image, 'click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const current = Number.parseInt(image.dataset.zoomLevel || '0', 10);
        const next = (current + 1) % 4;
        resetAllImages();

        if (next === 3) openFullscreen(image);
        else image.dataset.zoomLevel = String(next);
      });
    });
  }

  function removeEmptyClozeElements() {
    document.querySelectorAll('.cloze').forEach((cloze) => {
      const hasText = Boolean(cloze.textContent && cloze.textContent.trim());
      const hasMedia = Boolean(cloze.querySelector('img, audio, video, object'));
      if (!hasText && !hasMedia) cloze.remove();
    });
  }

  function animateBackContent() {
    if (!isBackSide()) return;
    const divider = document.querySelector('.prettify-divider--answer');
    const back = document.querySelector('.prettify-field--back');
    if (divider && divider.dataset.animated !== 'true') {
      divider.dataset.animated = 'true';
      divider.style.animation = 'divider-reveal 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards';
    }
    if (back && back.dataset.animated !== 'true') {
      back.dataset.animated = 'true';
      back.style.animation = 'field-slide-in 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.1s forwards';
    }
  }

  const animate = shouldAnimateNewCard();

  function init() {
    try {
      if (!document.getElementById('qa')) return;
      initializeBreadcrumbs(animate);
      initializeTags(animate);
      trimEmptyFieldEdges();
      enhanceTextContrast();
      manageImages();
      addContrastToggle();
      removeEmptyClozeElements();
      animateBackContent();
    } catch (error) {
      console.error('Prettify initialization error:', error);
    }
  }

  const backdrop = document.getElementById('image-zoom-backdrop');
  if (backdrop) listen(backdrop, 'click', closeFullscreen);
  listen(document, 'keydown', (event) => {
    if (event.key === 'Escape') closeFullscreen();
  });

  const cardRoot = document.getElementById('qa');
  if (cardRoot) {
    runtime.observer = new MutationObserver(() => {
      if (runtime.observerQueued) return;
      runtime.observerQueued = true;
      queueMicrotask(() => {
        runtime.observerQueued = false;
        init();
      });
    });
    runtime.observer.observe(cardRoot, { childList: true, subtree: true });
  }

  init();
  if (document.readyState === 'loading') listen(window, 'load', init, { once: true });
})();
