(() => {
  'use strict';

  const WORKING_KEY = 'techno-sequencer-phase1-v1';
  const LIBRARY_KEY = 'techno-sequencer-pattern-library-v1';
  const EDIT_ID_KEY = 'techno-sequencer-edit-id';
  const EDIT_NAME_KEY = 'techno-sequencer-edit-name';
  const TRACK_IDS = ['kick', 'clap', 'closedHat', 'openHat', 'perc', 'bass', 'lead', 'fx'];

  const title = document.querySelector('#patternTitle');
  const originalSave = document.querySelector('#saveBtn');
  const saveDialog = document.querySelector('#saveDialog');
  const saveForm = document.querySelector('#saveForm');
  const saveName = document.querySelector('#saveName');
  const cancelSave = document.querySelector('#cancelSaveBtn');
  const editId = sessionStorage.getItem(EDIT_ID_KEY);
  const editName = sessionStorage.getItem(EDIT_NAME_KEY);

  title.textContent = editName || 'New Pattern';

  function blankState() {
    return {
      bpm: 140,
      resolution: 16,
      stepCount: 16,
      pattern: Object.fromEntries(TRACK_IDS.map(id => [id, Array(32).fill(false)])),
      bassNotes: Array(32).fill('C1'),
      muted: Object.fromEntries(TRACK_IDS.map(id => [id, false])),
    };
  }

  function snapshot() {
    try {
      return JSON.parse(localStorage.getItem(WORKING_KEY)) || blankState();
    } catch {
      return blankState();
    }
  }

  function library() {
    try {
      const value = JSON.parse(localStorage.getItem(LIBRARY_KEY));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function persist(items) {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(items));
  }

  function clearEditSession() {
    sessionStorage.removeItem(EDIT_ID_KEY);
    sessionStorage.removeItem(EDIT_NAME_KEY);
  }

  function goHome() {
    clearEditSession();
    window.location.href = './';
  }

  function saveExisting() {
    const items = library();
    const index = items.findIndex(item => String(item.id) === String(editId));
    if (index === -1) return false;
    items[index] = {
      ...items[index],
      name: editName || items[index].name || 'Pattern',
      savedAt: Date.now(),
      state: snapshot(),
    };
    persist(items);
    goHome();
    return true;
  }

  function saveNew(name) {
    const trimmed = name.trim().slice(0, 40);
    if (!trimmed) return false;
    const items = library();
    items.push({
      id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: trimmed,
      savedAt: Date.now(),
      state: snapshot(),
    });
    persist(items);
    goHome();
    return true;
  }

  function openNameDialog() {
    saveName.value = `Pattern ${library().length + 1}`;
    if (typeof saveDialog.showModal === 'function') {
      saveDialog.showModal();
      window.setTimeout(() => {
        saveName.focus();
        saveName.select();
      }, 0);
      return;
    }
    const name = window.prompt('Pattern name', saveName.value);
    if (name) saveNew(name);
  }

  // app.js attaches the old single-save listener. Replacing the button removes
  // that listener so Save means "save this pattern and return home".
  const saveButton = originalSave.cloneNode(true);
  originalSave.replaceWith(saveButton);
  saveButton.addEventListener('click', () => {
    if (editId && saveExisting()) return;
    openNameDialog();
  });

  cancelSave.addEventListener('click', () => saveDialog.close());
  saveForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!saveNew(saveName.value)) saveName.focus();
  });
})();
