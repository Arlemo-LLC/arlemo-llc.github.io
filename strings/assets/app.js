const tuningInput = document.querySelector('#tuning');
const scaleSelect = document.querySelector('#scale');
const targetSelect = document.querySelector('#target');
const orderSelect = document.querySelector('#order');
const form = document.querySelector('#calculator-form');
const playAllButton = document.querySelector('#play-all');
const muteButton = document.querySelector('#mute-button');
const resultsBody = document.querySelector('#results-body');
const stringVisual = document.querySelector('#string-visual');
const totalTension = document.querySelector('#total-tension');

let stringsCatalog = [];
let audioContext = null;
let activeOscillators = [];

const SEMITONES_FROM_A4 = {
  C: -9, 'C#': -8, Db: -8, D: -7, 'D#': -6, Eb: -6,
  E: -5, F: -4, 'F#': -3, Gb: -3, G: -2, 'G#': -1, Ab: -1,
  A: 0, 'A#': 1, Bb: 1, B: 2,
};

function noteToHz(note) {
  const match = /^([A-G][#b]?)(-?\d+)$/.exec(note.trim());
  if (!match) throw new Error(`Cannot parse "${note}"`);
  const [, letter, octaveText] = match;
  return 440 * Math.pow(2, (SEMITONES_FROM_A4[letter] + 12 * (Number(octaveText) - 4)) / 12);
}

function tensionLbs({ unitWeightLbPerIn, scaleLengthInches, frequencyHz }) {
  return (unitWeightLbPerIn * Math.pow(2 * scaleLengthInches * frequencyHz, 2)) / 386.4;
}

function formatGauge(gauge) {
  return `.${String(Math.round(gauge * 1000)).padStart(3, '0')}`;
}

function parseTuning(value) {
  return value
    .split(/[\s,]+/)
    .map(note => note.trim())
    .filter(Boolean);
}

function defaultType(frequencyHz) {
  return frequencyHz >= 195 ? 'plain_steel' : 'nickel_wound';
}

function recommendString({ note, scaleLengthInches, targetTensionLbs }) {
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

function render(results) {
  resultsBody.replaceChildren();
  stringVisual.replaceChildren();

  const total = results.reduce((sum, row) => sum + row.tension, 0);
  totalTension.textContent = `${total.toFixed(1)} lb total`;

  results.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${row.note}</td>
      <td>${formatGauge(row.gauge)}</td>
      <td>${row.type.replace('_', ' ')}</td>
      <td>${row.tension.toFixed(1)} lb</td>
    `;
    resultsBody.append(tr);

    const visual = document.createElement('div');
    visual.className = 'string-row';
    const fillWidth = Math.max(12, Math.min(100, (row.tension / 22) * 100));
    visual.innerHTML = `
      <button class="note-button" type="button" data-note="${row.note}" aria-label="Play ${row.note}">${row.note}</button>
      <span class="tension-track" aria-hidden="true"><span class="tension-fill" style="width:${fillWidth}%"></span></span>
      <span class="gauge-label">${formatGauge(row.gauge)}</span>
    `;
    stringVisual.append(visual);
  });
}

function calculate() {
  let notes = parseTuning(tuningInput.value);
  if (notes.length === 0) throw new Error('Enter at least one note.');
  if (orderSelect.value === 'low-high') {
    notes = notes.slice().sort((a, b) => noteToHz(a) - noteToHz(b));
  }
  const scaleLengthInches = Number(scaleSelect.value);
  const targetTensionLbs = Number(targetSelect.value);
  const results = notes.map(note => recommendString({ note, scaleLengthInches, targetTensionLbs }));
  render(results);
  return results;
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
      gain.gain.cancelScheduledValues(0);
      gain.gain.setValueAtTime(gain.gain.value, getAudioContext().currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, getAudioContext().currentTime + 0.03);
      oscillator.stop(getAudioContext().currentTime + 0.04);
    } catch {
      oscillator.stop();
    }
  });
  activeOscillators = [];
}

function playNote(note, startOffset = 0, duration = 0.62) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime + startOffset;

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(noteToHz(note), now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
  activeOscillators.push({ oscillator, gain });
}

async function loadCatalog() {
  const response = await fetch('data/daddario-singles.json');
  const data = await response.json();
  stringsCatalog = Object.entries(data.strings).map(([sku, entry]) => ({ sku, ...entry }));
}

form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    calculate();
  } catch (error) {
    totalTension.textContent = error.message;
  }
});

stringVisual.addEventListener('click', event => {
  const button = event.target.closest('[data-note]');
  if (!button) return;
  stopSound();
  playNote(button.dataset.note);
});

playAllButton.addEventListener('click', () => {
  stopSound();
  const notes = parseTuning(tuningInput.value);
  notes.forEach((note, index) => playNote(note, index * 0.48, 0.58));
});

muteButton.addEventListener('click', stopSound);

await loadCatalog();
calculate();
