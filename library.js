(() => {
  'use strict';

  const WORKING_KEY = 'techno-sequencer-phase1-v1';
  const LIBRARY_KEY = 'techno-sequencer-pattern-library-v1';
  const NOTICE_KEY = 'techno-sequencer-load-notice';
  const TRACK_IDS = ['kick', 'clap', 'closedHat', 'openHat', 'perc', 'bass', 'lead', 'fx'];

  const el = {
    saveButton: document.querySelector('#saveBtn'),
    savedPatterns: document.querySelector('#savedPatterns'),
    savedEmpty: document.querySelector('#savedEmpty'),
    savedCount: document.querySelector('#savedCount'),
    saveDialog: document.querySelector('#saveDialog'),
    saveForm: document.querySelector('#saveForm'),
    saveName: document.querySelector('#saveName'),
    cancelSave: document.querySelector('#cancelSaveBtn'),
    status: document.querySelector('#status'),
  };

  let library = readLibrary();

  function defaultSnapshot() {
    const pattern = Object.fromEntries(TRACK_IDS.map(id => [id, Array(32).fill(false)]));
    const bassNotes = Array(32).fill('C1');
    [0, 4, 8, 12].forEach(i => { pattern.kick[i] = true; });
    [4, 12].forEach(i => { pattern.clap[i] = true; });
    [2, 6, 10, 14].forEach(i => { pattern.closedHat[i] = true; });
    [6, 14].forEach(i => { pattern.openHat[i] = true; });
    [3, 11].forEach(i => { pattern.perc[i] = true; });
    [0, 3, 6, 8, 11, 14].forEach((step, index) => {
      pattern.bass[step] = true;
      bassNotes[step] = ['C1', 'C1', 'D#1', 'C1', 'G1', 'D#1'][index];
    });
    [0, 6, 10].forEach(i => { pattern.lead[i] = true; });
    pattern.fx[0] = true;
    return {
      bpm: 140,
      resolution: 16,
      stepCount: 16,
      pattern,
      bassNotes,
      muted: Object.fromEntries(TRACK_IDS.map(id => [id, false])),
    };
  }

  function currentSnapshot() {
    try {
      const saved = JSON.parse(localStorage.getItem(WORKING_KEY));
      return saved && typeof saved === 'object' ? saved : defaultSnapshot();
    } catch {
      return defaultSnapshot();
    }
  }

  function readLibrary() {
    try {
      const saved = JSON.parse(localStorage.getItem(LIBRARY_KEY));
      if (!Array.isArray(saved)) return [];
      return saved.filter(item => item && item.id && typeof item.name === 'string' && item.state);
    } catch {
      return [];
    }
  }

  function persistLibrary() {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  }

  function setStatus(message) {
    if (el.status) el.status.textContent = message;
  }

  function renderLibrary() {
    el.savedPatterns.replaceChildren();
    el.savedCount.textContent = `${library.length} saved`;
    el.savedEmpty.hidden = library.length > 0;

    [...library].reverse().forEach(item => {
      const card = document.createElement('article');
      card.className = 'saved-pattern';

      const info = document.createElement('div');
      info.className = 'saved-pattern-info';
      const name = document.createElement('p');
      name.className = 'saved-pattern-name';
      name.textContent = item.name;
      const meta = document.createElement('p');
      meta.className = 'saved-pattern-meta';
      const bpm = Number(item.state?.bpm) || 140;
      const resolution = Number(item.state?.resolution) === 8 ? 8 : 16;
      const steps = Number(item.state?.stepCount) === 32 ? 32 : 16;
      const date = new Date(Number(item.savedAt) || Date.now());
      meta.textContent = `${bpm} BPM · 1/${resolution} · ${steps} steps · ${date.toLocaleString()}`;
      info.append(name, meta);

      const actions = document.createElement('div');
      actions.className = 'saved-pattern-actions';

      const load = document.createElement('button');
      load.type = 'button';
      load.textContent = 'Load';
      load.addEventListener('click', () => {
        localStorage.setItem(WORKING_KEY, JSON.stringify(item.state));
        sessionStorage.setItem(NOTICE_KEY, `Loaded: ${item.name}`);
        window.location.reload();
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'danger';
      remove.textContent = 'Delete';
      remove.addEventListener('click', () => {
        if (!window.confirm(`Delete “${item.name}”?`)) return;
        library = library.filter(pattern => pattern.id !== item.id);
        persistLibrary();
        renderLibrary();
        setStatus(`Deleted: ${item.name}`);
      });

      actions.append(load, remove);
      card.append(info, actions);
      el.savedPatterns.appendChild(card);
    });
  }

  function savePattern(name) {
    const trimmed = name.trim().slice(0, 40);
    if (!trimmed) return false;
    library.push({
      id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: trimmed,
      savedAt: Date.now(),
      state: currentSnapshot(),
    });
    persistLibrary();
    renderLibrary();
    setStatus(`Saved: ${trimmed}`);
    return true;
  }

  function openSaveDialog() {
    el.saveName.value = `Pattern ${library.length + 1}`;
    if (typeof el.saveDialog.showModal === 'function') {
      el.saveDialog.showModal();
      window.setTimeout(() => {
        el.saveName.focus();
        el.saveName.select();
      }, 0);
      return;
    }
    const name = window.prompt('Pattern name', el.saveName.value);
    if (name) savePattern(name);
  }

  // app.js already attached the old single-save handler. Cloning removes that
  // listener and turns the same UI button into the named-pattern save action.
  const replacementSaveButton = el.saveButton.cloneNode(true);
  el.saveButton.replaceWith(replacementSaveButton);
  replacementSaveButton.addEventListener('click', openSaveDialog);

  el.cancelSave.addEventListener('click', () => el.saveDialog.close());
  el.saveForm.addEventListener('submit', event => {
    event.preventDefault();
    if (savePattern(el.saveName.value)) el.saveDialog.close();
    else el.saveName.focus();
  });

  renderLibrary();

  const notice = sessionStorage.getItem(NOTICE_KEY);
  if (notice) {
    sessionStorage.removeItem(NOTICE_KEY);
    setStatus(notice);
  }
})();
