(() => {
  'use strict';

  const TRACKS = [
    { id: 'kick', name: 'Kick', level: 0.95 },
    { id: 'clap', name: 'Clap', level: 0.58 },
    { id: 'closedHat', name: 'Closed Hat', level: 0.42 },
    { id: 'openHat', name: 'Open Hat', level: 0.36 },
    { id: 'perc', name: 'Perc', level: 0.46 },
    { id: 'bass', name: 'Bass', level: 0.62 },
    { id: 'lead', name: 'Lead', level: 0.35 },
    { id: 'fx', name: 'FX', level: 0.32 },
  ];

  const BASS_NOTES = ['C1','D1','D#1','F1','G1','G#1','A#1','C2','D2','D#2','F2','G2'];
  const STORAGE_KEY = 'techno-sequencer-phase1-v1';

  const el = {
    sequencer: document.querySelector('#sequencer'),
    play: document.querySelector('#playBtn'),
    stop: document.querySelector('#stopBtn'),
    bpm: document.querySelector('#bpm'),
    bpmValue: document.querySelector('#bpmValue'),
    resolution: document.querySelector('#resolution'),
    stepCount: document.querySelector('#stepCount'),
    save: document.querySelector('#saveBtn'),
    clear: document.querySelector('#clearBtn'),
    status: document.querySelector('#status'),
    loopInfo: document.querySelector('#loopInfo'),
    noteDialog: document.querySelector('#noteDialog'),
    noteDialogTitle: document.querySelector('#noteDialogTitle'),
    noteOptions: document.querySelector('#noteOptions'),
  };

  let state = createDefaultState();
  let audio = null;
  let schedulerTimer = null;
  let currentStep = 0;
  let nextStepTime = 0;
  let isPlaying = false;
  let noteTarget = null;
  const visualTimers = new Set();

  function createDefaultState() {
    const pattern = {};
    const bassNotes = Array(32).fill('C1');
    TRACKS.forEach(track => { pattern[track.id] = Array(32).fill(false); });

    [0,4,8,12].forEach(i => pattern.kick[i] = true);
    [4,12].forEach(i => pattern.clap[i] = true);
    [2,6,10,14].forEach(i => pattern.closedHat[i] = true);
    [6,14].forEach(i => pattern.openHat[i] = true);
    [3,11].forEach(i => pattern.perc[i] = true);
    [0,3,6,8,11,14].forEach((i, idx) => {
      pattern.bass[i] = true;
      bassNotes[i] = ['C1','C1','D#1','C1','G1','D#1'][idx];
    });
    [0,6,10].forEach(i => pattern.lead[i] = true);
    pattern.fx[0] = true;

    return {
      bpm: 140,
      resolution: 16,
      stepCount: 16,
      pattern,
      bassNotes,
      muted: Object.fromEntries(TRACKS.map(t => [t.id, false])),
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved) return;
      const next = createDefaultState();
      next.bpm = clamp(Number(saved.bpm) || 140, 80, 180);
      next.resolution = Number(saved.resolution) === 8 ? 8 : 16;
      next.stepCount = Number(saved.stepCount) === 32 ? 32 : 16;
      TRACKS.forEach(track => {
        if (Array.isArray(saved.pattern?.[track.id])) {
          next.pattern[track.id] = Array.from({ length: 32 }, (_, i) => Boolean(saved.pattern[track.id][i]));
        }
        next.muted[track.id] = Boolean(saved.muted?.[track.id]);
      });
      if (Array.isArray(saved.bassNotes)) {
        next.bassNotes = Array.from({ length: 32 }, (_, i) => BASS_NOTES.includes(saved.bassNotes[i]) ? saved.bassNotes[i] : 'C1');
      }
      state = next;
    } catch (err) {
      console.warn('Could not load saved pattern', err);
    }
  }

  function saveState(showStatus = true) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (showStatus) setStatus('Saved on this device');
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function render() {
    el.bpm.value = String(state.bpm);
    el.bpmValue.value = String(state.bpm);
    el.bpmValue.textContent = String(state.bpm);
    el.resolution.value = String(state.resolution);
    el.stepCount.value = String(state.stepCount);

    const frag = document.createDocumentFragment();
    TRACKS.forEach(track => frag.appendChild(renderTrack(track)));
    el.sequencer.replaceChildren(frag);
    updateLoopInfo();
  }

  function renderTrack(track) {
    const card = document.createElement('section');
    card.className = 'track-card';
    card.dataset.track = track.id;

    const head = document.createElement('div');
    head.className = 'track-head';

    const name = document.createElement('h3');
    name.className = 'track-name';
    name.textContent = track.name;

    const actions = document.createElement('div');
    actions.className = 'track-actions';

    const mute = document.createElement('button');
    mute.type = 'button';
    mute.textContent = 'Mute';
    mute.title = `Mute ${track.name}`;
    mute.classList.toggle('muted', state.muted[track.id]);
    mute.addEventListener('click', () => {
      state.muted[track.id] = !state.muted[track.id];
      mute.classList.toggle('muted', state.muted[track.id]);
      mute.textContent = state.muted[track.id] ? 'Muted' : 'Mute';
      saveState(false);
    });
    if (state.muted[track.id]) mute.textContent = 'Muted';

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Clear';
    clear.title = `Clear ${track.name}`;
    clear.addEventListener('click', () => {
      state.pattern[track.id].fill(false);
      saveState(false);
      render();
      setStatus(`${track.name} cleared`);
    });
    actions.append(mute, clear);
    head.append(name, actions);

    const grid = document.createElement('div');
    grid.className = 'step-grid';

    for (let i = 0; i < state.stepCount; i++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `step-cell${state.pattern[track.id][i] ? ' active' : ''}${isBeatBoundary(i) ? ' beat' : ''}`;
      cell.dataset.track = track.id;
      cell.dataset.step = String(i);
      cell.setAttribute('aria-label', `${track.name} step ${i + 1}`);

      const index = document.createElement('span');
      index.className = 'step-label';
      index.textContent = String(i + 1);
      cell.appendChild(index);

      if (track.id === 'bass' && state.pattern.bass[i]) {
        const label = document.createElement('span');
        label.className = 'note-label';
        label.textContent = state.bassNotes[i];
        cell.appendChild(label);
      }
      bindStepInteraction(cell, track.id, i);
      grid.appendChild(cell);
    }

    card.append(head, grid);
    return card;
  }

  function bindStepInteraction(cell, trackId, step) {
    let holdTimer = null;
    let held = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    const MOVE_THRESHOLD = 10;

    const cancelHold = () => {
      if (holdTimer) window.clearTimeout(holdTimer);
      holdTimer = null;
    };

    cell.addEventListener('pointerdown', event => {
      startX = event.clientX;
      startY = event.clientY;
      moved = false;
      held = false;

      if (trackId === 'bass' && state.pattern.bass[step]) {
        holdTimer = window.setTimeout(() => {
          if (moved) return;
          held = true;
          openNoteDialog(step);
          if (navigator.vibrate) navigator.vibrate(15);
        }, 460);
      }
    });

    cell.addEventListener('pointermove', event => {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.hypot(dx, dy) >= MOVE_THRESHOLD) {
        moved = true;
        cancelHold();
      }
    });

    cell.addEventListener('pointercancel', () => {
      moved = true;
      cancelHold();
    });

    cell.addEventListener('pointerup', event => {
      cancelHold();
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.hypot(dx, dy) >= MOVE_THRESHOLD) moved = true;
      if (held || moved) return;

      state.pattern[trackId][step] = !state.pattern[trackId][step];
      saveState(false);
      render();
    });
  }

  function isBeatBoundary(step) {
    return state.resolution === 16 ? step % 4 === 0 : step % 2 === 0;
  }

  function updateLoopInfo() {
    const beats = state.stepCount * (state.resolution === 16 ? 0.25 : 0.5);
    const bars = beats / 4;
    el.loopInfo.textContent = `${bars % 1 === 0 ? bars : bars.toFixed(1)} bar${bars === 1 ? '' : 's'} · 1/${state.resolution}`;
  }

  function openNoteDialog(step) {
    noteTarget = step;
    el.noteDialogTitle.textContent = `Step ${step + 1}`;
    el.noteOptions.replaceChildren(...BASS_NOTES.map(note => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = note;
      btn.classList.toggle('selected', state.bassNotes[step] === note);
      btn.addEventListener('click', () => {
        state.bassNotes[step] = note;
        saveState(false);
        el.noteDialog.close();
        render();
        setStatus(`Bass step ${step + 1}: ${note}`);
      });
      return btn;
    }));
    if (typeof el.noteDialog.showModal === 'function') el.noteDialog.showModal();
  }

  function ensureAudio() {
    if (audio) return audio;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) throw new Error('Web Audio API is not supported in this browser.');
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = 0.82;
    master.connect(ctx.destination);
    audio = { ctx, master, noiseBuffer: createNoiseBuffer(ctx) };
    return audio;
  }

  function createNoiseBuffer(ctx) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  async function play() {
    const a = ensureAudio();
    if (a.ctx.state === 'suspended') await a.ctx.resume();
    if (isPlaying) return;
    isPlaying = true;
    currentStep = 0;
    nextStepTime = a.ctx.currentTime + 0.06;
    el.play.classList.add('active');
    setStatus('Playing');
    scheduler();
  }

  function stop() {
    isPlaying = false;
    if (schedulerTimer) clearTimeout(schedulerTimer);
    schedulerTimer = null;
    visualTimers.forEach(id => clearTimeout(id));
    visualTimers.clear();
    document.querySelectorAll('.step-cell.playing').forEach(node => node.classList.remove('playing'));
    el.play.classList.remove('active');
    currentStep = 0;
    setStatus('Stopped');
  }

  function scheduler() {
    if (!isPlaying || !audio) return;
    const scheduleAhead = 0.12;
    while (nextStepTime < audio.ctx.currentTime + scheduleAhead) {
      scheduleStep(currentStep, nextStepTime);
      nextStepTime += stepDurationSeconds();
      currentStep = (currentStep + 1) % state.stepCount;
    }
    schedulerTimer = window.setTimeout(scheduler, 25);
  }

  function stepDurationSeconds() {
    const quarter = 60 / state.bpm;
    return quarter * (state.resolution === 16 ? 0.25 : 0.5);
  }

  function scheduleStep(step, time) {
    TRACKS.forEach(track => {
      if (!state.muted[track.id] && state.pattern[track.id][step]) trigger(track.id, time, step, track.level);
    });
    const delay = Math.max(0, (time - audio.ctx.currentTime) * 1000);
    const timer = window.setTimeout(() => {
      visualTimers.delete(timer);
      document.querySelectorAll('.step-cell.playing').forEach(node => node.classList.remove('playing'));
      document.querySelectorAll(`.step-cell[data-step="${step}"]`).forEach(node => node.classList.add('playing'));
    }, delay);
    visualTimers.add(timer);
  }

  function trigger(trackId, time, step, volume) {
    switch (trackId) {
      case 'kick': return synthKick(time, volume);
      case 'clap': return synthClap(time, volume);
      case 'closedHat': return synthHat(time, volume, 0.045, 7600);
      case 'openHat': return synthHat(time, volume, 0.34, 6100);
      case 'perc': return synthPerc(time, volume);
      case 'bass': return synthBass(time, volume, state.bassNotes[step]);
      case 'lead': return synthLead(time, volume, step);
      case 'fx': return synthFx(time, volume);
    }
  }

  function synthKick(time, volume) {
    const { ctx, master } = audio;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(47, time + 0.08);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.36);
    click.type = 'triangle';
    click.frequency.setValueAtTime(900, time);
    click.frequency.exponentialRampToValueAtTime(90, time + 0.018);
    clickGain.gain.setValueAtTime(volume * 0.2, time);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.022);
    osc.connect(gain).connect(master);
    click.connect(clickGain).connect(master);
    osc.start(time); click.start(time);
    osc.stop(time + 0.4); click.stop(time + 0.03);
  }

  function synthClap(time, volume) {
    const { ctx, master, noiseBuffer } = audio;
    [0, 0.014, 0.028].forEach((offset, index) => {
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      src.buffer = noiseBuffer;
      filter.type = 'bandpass';
      filter.frequency.value = 1700 + index * 180;
      filter.Q.value = 0.65;
      const t = time + offset;
      gain.gain.setValueAtTime(volume * (0.9 - index * 0.15), t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      src.connect(filter).connect(gain).connect(master);
      src.start(t); src.stop(t + 0.08);
    });
  }

  function synthHat(time, volume, decay, cutoff) {
    const { ctx, master, noiseBuffer } = audio;
    const src = ctx.createBufferSource();
    const hp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = noiseBuffer;
    hp.type = 'highpass';
    hp.frequency.value = cutoff;
    gain.gain.setValueAtTime(Math.max(0.0001, volume), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    src.connect(hp).connect(gain).connect(master);
    src.start(time); src.stop(time + decay + 0.02);
  }

  function synthPerc(time, volume) {
    const { ctx, master } = audio;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(310, time);
    osc.frequency.exponentialRampToValueAtTime(170, time + 0.09);
    gain.gain.setValueAtTime(volume * 0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
    osc.connect(gain).connect(master);
    osc.start(time); osc.stop(time + 0.16);
  }

  function synthBass(time, volume, note) {
    const { ctx, master } = audio;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = noteToFrequency(note);
    filter.type = 'lowpass';
    filter.Q.value = 7;
    filter.frequency.setValueAtTime(620, time);
    filter.frequency.exponentialRampToValueAtTime(125, time + 0.17);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.55), time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.min(0.25, stepDurationSeconds() * 0.9));
    osc.connect(filter).connect(gain).connect(master);
    osc.start(time); osc.stop(time + 0.3);
  }

  function synthLead(time, volume, step) {
    const { ctx, master } = audio;
    const scale = [261.63, 311.13, 392.0, 466.16, 523.25];
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = scale[Math.floor(step / 2) % scale.length];
    filter.type = 'lowpass';
    filter.frequency.value = 1650;
    filter.Q.value = 4;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.28), time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    osc.connect(filter).connect(gain).connect(master);
    osc.start(time); osc.stop(time + 0.14);
  }

  function synthFx(time, volume) {
    const { ctx, master, noiseBuffer } = audio;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = noiseBuffer;
    filter.type = 'bandpass';
    filter.Q.value = 2.5;
    filter.frequency.setValueAtTime(350, time);
    filter.frequency.exponentialRampToValueAtTime(5200, time + 0.65);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.3), time + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.7);
    src.connect(filter).connect(gain).connect(master);
    src.start(time); src.stop(time + 0.72);
  }

  function noteToFrequency(note) {
    const match = /^([A-G])(#?)(\d)$/.exec(note);
    if (!match) return 65.41;
    const [, letter, sharp, octaveText] = match;
    const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const midi = (Number(octaveText) + 1) * 12 + semitones[letter] + (sharp ? 1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function setStatus(text) {
    el.status.textContent = text;
  }

  el.play.addEventListener('click', () => play().catch(err => setStatus(err.message)));
  el.stop.addEventListener('click', stop);
  el.bpm.addEventListener('input', () => {
    state.bpm = Number(el.bpm.value);
    el.bpmValue.textContent = String(state.bpm);
    saveState(false);
  });
  el.resolution.addEventListener('change', () => {
    state.resolution = Number(el.resolution.value);
    saveState(false);
    render();
  });
  el.stepCount.addEventListener('change', () => {
    state.stepCount = Number(el.stepCount.value);
    currentStep %= state.stepCount;
    saveState(false);
    render();
  });
  el.save.addEventListener('click', () => saveState(true));
  el.clear.addEventListener('click', () => {
    TRACKS.forEach(track => state.pattern[track.id].fill(false));
    saveState(false);
    render();
    setStatus('Pattern cleared');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isPlaying) stop();
  });

  loadState();
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
  }
})();
