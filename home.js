(() => {
  'use strict';

  const WORKING_KEY = 'techno-sequencer-phase1-v1';
  const LIBRARY_KEY = 'techno-sequencer-pattern-library-v1';
  const EDIT_ID_KEY = 'techno-sequencer-edit-id';
  const EDIT_NAME_KEY = 'techno-sequencer-edit-name';

  const list = document.querySelector('#patternList');
  const count = document.querySelector('#savedCount');
  const empty = document.querySelector('#emptyState');
  const newButtons = [document.querySelector('#newPatternBtn'), document.querySelector('#emptyNewBtn')];

  function readLibrary() {
    try {
      const value = JSON.parse(localStorage.getItem(LIBRARY_KEY));
      return Array.isArray(value) ? value.filter(item => item && item.id && item.state) : [];
    } catch {
      return [];
    }
  }

  function writeLibrary(library) {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  }

  function blankState() {
    const tracks = ['kick', 'clap', 'closedHat', 'openHat', 'perc', 'bass', 'lead', 'fx'];
    return {
      bpm: 140,
      resolution: 16,
      stepCount: 16,
      pattern: Object.fromEntries(tracks.map(id => [id, Array(32).fill(false)])),
      bassNotes: Array(32).fill('C1'),
      muted: Object.fromEntries(tracks.map(id => [id, false])),
    };
  }

  function openNewPattern() {
    localStorage.setItem(WORKING_KEY, JSON.stringify(blankState()));
    sessionStorage.removeItem(EDIT_ID_KEY);
    sessionStorage.removeItem(EDIT_NAME_KEY);
    window.location.href = './editor.html';
  }

  function openPattern(item) {
    localStorage.setItem(WORKING_KEY, JSON.stringify(item.state));
    sessionStorage.setItem(EDIT_ID_KEY, String(item.id));
    sessionStorage.setItem(EDIT_NAME_KEY, String(item.name || 'Pattern'));
    window.location.href = './editor.html';
  }

  function render() {
    const library = readLibrary();
    list.replaceChildren();
    count.textContent = String(library.length);
    empty.hidden = library.length !== 0;

    [...library].reverse().forEach(item => {
      const card = document.createElement('article');
      card.className = 'pattern-card';

      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'pattern-open';
      open.addEventListener('click', () => openPattern(item));

      const title = document.createElement('span');
      title.className = 'pattern-name';
      title.textContent = item.name || 'Untitled Pattern';

      const state = item.state || {};
      const meta = document.createElement('span');
      meta.className = 'pattern-meta';
      meta.textContent = `${Number(state.bpm) || 140} BPM · 1/${Number(state.resolution) === 8 ? 8 : 16} · ${Number(state.stepCount) === 32 ? 32 : 16} steps`;

      open.append(title, meta);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'pattern-delete';
      remove.textContent = 'Delete';
      remove.addEventListener('click', event => {
        event.stopPropagation();
        if (!window.confirm(`Delete “${item.name || 'Untitled Pattern'}”?`)) return;
        writeLibrary(readLibrary().filter(pattern => String(pattern.id) !== String(item.id)));
        render();
      });

      card.append(open, remove);
      list.appendChild(card);
    });
  }

  newButtons.forEach(button => button?.addEventListener('click', openNewPattern));
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
  }
})();
