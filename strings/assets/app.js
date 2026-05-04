const scaleInput = document.querySelector('#scale');
const stringCountOutput = document.querySelector('#string-count');
const stringEditor = document.querySelector('#string-editor');
const tuningPaste = document.querySelector('#tuning-paste');
const tuningHelp = document.querySelector('#tuning-help');
const playAllButton = document.querySelector('#play-all');
const muteButton = document.querySelector('#mute-button');
const addStringButton = document.querySelector('#add-string');
const removeStringButton = document.querySelector('#remove-string');
const totalTension = document.querySelector('#total-tension');
const gaugeStack = document.querySelector('#gauge-stack');

let stringsCatalog = [];
let tuningRows = ['G4', 'G2', 'D3', 'G3', 'B3', 'D4'];
let targetTensionLbs = 18;
let orderMode = 'as-written';
let audioContext = null;
let activeOscillators = [];

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const NOTE_PATTERN = /^([A-G][#b]?)(-?\d+)$/;
const NOTATION_HELP = 'Use A-G plus an octave, with optional # or b: E2, F#3, Bb4.';
const SEMITONES_FROM_A4 = {
  C: -9, 'C#': -8, Db: -8, D: -7, 'D#': -6, Eb: -6,
  E: -5, F: -4, 'F#': -3, Gb: -3, G: -2, 'G#': -1, Ab: -1,
  A: 0, 'A#': 1, Bb: 1, B: 2,
};

function noteToHz(note) {
  const match = NOTE_PATTERN.exec(note.trim());
  if (!match) throw new Error(`Cannot parse "${note}"`);
  const [, letter, octaveText] = match;
  return 440 * Math.pow(2, (SEMITONES_FROM_A4[letter] + 12 * (Number(octaveText) - 4)) / 12);
}

function parseNote(note) {
  const match = NOTE_PATTERN.exec(note.trim());
  if (!match) return null;
  const octave = Number(match[2]);
  if (!OCTAVES.includes(octave)) return null;
  return {
    name: match[1].replace('Db', 'C#').replace('Eb', 'D#').replace('Gb', 'F#').replace('Ab', 'G#').replace('Bb', 'A#'),
    octave,
  };
}

function buildNote(name, octave) {
  return `${name}${octave}`;
}

function tensionLbs({ unitWeightLbPerIn, scaleLengthInches, frequencyHz }) {
  return (unitWeightLbPerIn * Math.pow(2 * scaleLengthInches * frequencyHz, 2)) / 386.4;
}

function formatGauge(gauge) {
  return `.${String(Math.round(gauge * 1000)).padStart(3, '0')}`;
}

function formatType(type) {
  return type.replace('_', ' ');
}

function defaultType(frequencyHz) {
  return frequencyHz >= 195 ? 'plain_steel' : 'nickel_wound';
}

function parseTuningText(value) {
  return value
    .split(/[\s,]+/)
    .map(note => note.trim())
    .filter(Boolean);
}

function validateTuningText(value) {
  const tokens = parseTuningText(value);
  if (!tokens.length) {
    return { ok: false, message: 'Enter at least one note. Example: E2 A2 D3 G3 B3 E4.' };
  }

  const parsed = tokens.map(token => ({ token, parsed: parseNote(token) }));
  const invalid = parsed.filter(item => !item.parsed).map(item => item.token);
  if (invalid.length) {
    const quoted = invalid.map(note => `"${note}"`).join(', ');
    return { ok: false, message: `${quoted} ${invalid.length === 1 ? 'is' : 'are'} not valid. ${NOTATION_HELP}` };
  }

  return { ok: true, notes: parsed.map(item => buildNote(item.parsed.name, item.parsed.octave)) };
}

function setTuningHelp(message = NOTATION_HELP, isError = false) {
  tuningHelp.textContent = message;
  tuningHelp.classList.toggle('is-error', isError);
  tuningPaste.setAttribute('aria-invalid', String(isError));
}

function getDisplayNotes() {
  const notes = tuningRows.slice();
  if (orderMode === 'low-high') {
    return notes.sort((a, b) => noteToHz(a) - noteToHz(b));
  }
  return notes;
}

function recommendString({ note, scaleLengthInches }) {
  const frequencyHz = noteToHz(note);
  const type = defaultType(frequencyHz);
  let best = null;
  let bestDelta = Infinity;

  for (const entry of stringsCatalog) {
    if (entry.type !== type) continue;
    const tension = tensionLbs({
      unitWeightLbPerIn: entry.unitWeightLbPerIn,
      scaleLengthInches,
      frequencyHz,
    });
    const delta = Math.abs(tension - targetTensionLbs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = { ...entry, note, frequencyHz, tension };
    }
  }

  if (!best) throw new Error(`No ${type} string found for ${note}`);
  return best;
}

function setActiveButton(selector, button) {
  document.querySelectorAll(selector).forEach(el => el.classList.toggle('is-active', el === button));
}

function renderEditor() {
  stringCountOutput.textContent = `${tuningRows.length} ${tuningRows.length === 1 ? 'string' : 'strings'}`;
  stringEditor.replaceChildren();

  tuningRows.forEach((note, index) => {
    const parsed = parseNote(note) ?? { name: 'E', octave: 2 };
    const row = document.createElement('div');
    row.className = 'string-control-row';
    row.dataset.index = String(index);
    row.innerHTML = `
      <span class="string-number">${index + 1}</span>
      <label>
        <span>Note</span>
        <select class="note-select" aria-label="String ${index + 1} note">
          ${NOTES.map(name => `<option value="${name}"${name === parsed.name ? ' selected' : ''}>${name}</option>`).join('')}
        </select>
      </label>
      <label>
        <span>Octave</span>
        <select class="octave-select" aria-label="String ${index + 1} octave">
          ${OCTAVES.map(octave => `<option value="${octave}"${octave === parsed.octave ? ' selected' : ''}>${octave}</option>`).join('')}
        </select>
      </label>
      <button type="button" class="play-string" data-note="${note}" aria-label="Play ${note}">Play</button>
    `;
    stringEditor.append(row);
  });
}

function renderAnswer(results) {
  gaugeStack.replaceChildren();
  const total = results.reduce((sum, row) => sum + row.tension, 0);
  totalTension.textContent = `${total.toFixed(1)} lb`;

  results.forEach((row, index) => {
    const card = document.createElement('article');
    card.className = 'gauge-card';
    const fillWidth = Math.max(10, Math.min(100, (row.tension / 24) * 100));
    card.innerHTML = `
      <div class="gauge-main">
        <span class="string-number">${index + 1}</span>
        <strong>${row.note}</strong>
        <span>${formatGauge(row.gauge)}</span>
      </div>
      <div class="meter" aria-hidden="true"><span style="width:${fillWidth}%"></span></div>
      <div class="gauge-meta">
        <span>${row.tension.toFixed(1)} lb</span>
        <span>${formatType(row.type)}</span>
      </div>
    `;
    gaugeStack.append(card);
  });
}

function calculate() {
  const scaleLengthInches = Number(scaleInput.value);
  if (!Number.isFinite(scaleLengthInches) || scaleLengthInches <= 0) {
    throw new Error('Enter a valid scale length.');
  }
  const results = getDisplayNotes().map(note => recommendString({ note, scaleLengthInches }));
  renderAnswer(results);
  return results;
}

function syncPasteField() {
  tuningPaste.value = tuningRows.join(' ');
}

function updateAll() {
  renderEditor();
  syncPasteField();
  try {
    calculate();
  } catch (error) {
    totalTension.textContent = error.message;
    gaugeStack.replaceChildren();
  }
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function stopSound() {
  activeOscillators.forEach(({ oscillator, gain }) => {
    try {
      const ctx = getAudioContext();
      gain.gain.cancelScheduledValues(0);
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
      oscillator.stop(ctx.currentTime + 0.05);
    } catch {
      oscillator.stop();
    }
  });
  activeOscillators = [];
}

function playNote(note, startOffset = 0, duration = 0.72) {
  const ctx = getAudioContext();
  const now = ctx.currentTime + startOffset;
  const frequency = noteToHz(note);
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();

  oscA.type = 'triangle';
  oscB.type = 'sine';
  oscA.frequency.setValueAtTime(frequency, now);
  oscB.frequency.setValueAtTime(frequency * 2.01, now);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2200, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.24, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.055, now + 0.16);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscA.connect(filter);
  oscB.connect(filter);
  filter.connect(gain).connect(ctx.destination);
  oscA.start(now);
  oscB.start(now);
  oscA.stop(now + duration + 0.04);
  oscB.stop(now + duration + 0.04);
  activeOscillators.push({ oscillator: oscA, gain }, { oscillator: oscB, gain });
}

async function loadCatalog() {
  const response = await fetch('data/daddario-singles.json');
  const data = await response.json();
  stringsCatalog = Object.entries(data.strings).map(([sku, entry]) => ({ sku, ...entry }));
}

document.querySelectorAll('[data-scale-option]').forEach(button => {
  button.addEventListener('click', () => {
    scaleInput.value = button.dataset.scaleOption;
    setActiveButton('[data-scale-option]', button);
    updateAll();
  });
});

document.querySelectorAll('[data-target]').forEach(button => {
  button.addEventListener('click', () => {
    targetTensionLbs = Number(button.dataset.target);
    setActiveButton('[data-target]', button);
    updateAll();
  });
});

document.querySelectorAll('[data-order]').forEach(button => {
  button.addEventListener('click', () => {
    orderMode = button.dataset.order;
    setActiveButton('[data-order]', button);
    updateAll();
  });
});

scaleInput.addEventListener('input', updateAll);

tuningPaste.addEventListener('change', () => {
  const validation = validateTuningText(tuningPaste.value);
  if (!validation.ok) {
    setTuningHelp(`${validation.message} Current tuning was not changed.`, true);
    return;
  }
  tuningRows = validation.notes;
  setTuningHelp();
  updateAll();
});

stringEditor.addEventListener('change', event => {
  const row = event.target.closest('.string-control-row');
  if (!row) return;
  const index = Number(row.dataset.index);
  const name = row.querySelector('.note-select').value;
  const octave = row.querySelector('.octave-select').value;
  tuningRows[index] = buildNote(name, octave);
  updateAll();
});

stringEditor.addEventListener('click', event => {
  const button = event.target.closest('.play-string');
  if (!button) return;
  stopSound();
  playNote(button.dataset.note);
});

addStringButton.addEventListener('click', () => {
  if (tuningRows.length >= 12) return;
  tuningRows.push('E4');
  updateAll();
});

removeStringButton.addEventListener('click', () => {
  if (tuningRows.length <= 1) return;
  tuningRows.pop();
  updateAll();
});

playAllButton.addEventListener('click', () => {
  stopSound();
  getDisplayNotes().forEach((note, index) => playNote(note, index * 0.44, 0.62));
});

muteButton.addEventListener('click', stopSound);

await loadCatalog();
updateAll();
