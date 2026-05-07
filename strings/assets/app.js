const scaleInput = document.querySelector('#scale');
const stringCountOutput = document.querySelector('#string-count');
const stringEditor = document.querySelector('#string-editor');
const tuningPaste = document.querySelector('#tuning-paste');
const tuningHelp = document.querySelector('#tuning-help');
const shiftDownButton = document.querySelector('#shift-down');
const shiftUpButton = document.querySelector('#shift-up');
const shiftResetButton = document.querySelector('#shift-reset');
const shiftAmountOutput = document.querySelector('#shift-amount');
const playAllButton = document.querySelector('#play-all');
const muteButton = document.querySelector('#mute-button');
const addStringButton = document.querySelector('#add-string');
const removeStringButton = document.querySelector('#remove-string');
const totalTension = document.querySelector('#total-tension');
const gaugeStack = document.querySelector('#gauge-stack');
const gaugeSummary = document.querySelector('#gauge-summary');
const skuSummary = document.querySelector('#sku-summary');
const copyListButton = document.querySelector('#copy-list');
const copyStatus = document.querySelector('#copy-status');
const shoppingLinks = document.querySelector('#shopping-links');
const materialNote = document.querySelector('#material-note');
const lineNote = document.querySelector('#line-note');
const customTargetInput = document.querySelector('#custom-target');
const recommendationState = document.querySelector('#recommendation-state');
const tensionRange = document.querySelector('#tension-range');
const recalculateTargetButton = document.querySelector('#recalculate-target');
const resetRecommendationButton = document.querySelector('#reset-recommendation');
const assumptionLabel = document.querySelector('#assumption-label');
const assumptionDetail = document.querySelector('#assumption-detail');

let stringsCatalog = [];
let tuningRows = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
let baseTuningRows = [...tuningRows];
let activePresetId = 'standard';
let tuningShiftSemitones = 0;
let targetTensionLbs = 22;
let targetTensionLabel = 'Average';
let selectedWoundMaterial = 'phosphor_bronze';
let selectedStringLine = 'standard';
let gaugeOverrides = new Map();
let latestResults = [];
let audioContext = null;
let activeOscillators = [];

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const NOTE_PATTERN = /^([A-G][#b]?)(-?\d+)$/;
const NOTATION_HELP = 'Use A-G plus an octave, with optional # or b: E2, F#3, Bb4. Pasted notes fill the rows from ceiling to floor.';
const PLAIN_STRING_CUTOFF_HZ = 220; // A3 and above default to plain steel for acoustic sets.
const AMAZON_ASSOCIATE_TAG = 'arlemo-20';
const TUNING_PRESETS = {
  standard: {
    label: 'Standard',
    notes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  },
  drop_d: {
    label: 'Drop D',
    notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  },
  dadgad: {
    label: 'DADGAD',
    notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'],
  },
  open_g: {
    label: 'Open G',
    notes: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'],
  },
  open_d: {
    label: 'Open D',
    notes: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'],
  },
  high_g_open_g: {
    label: 'Banjified Open G',
    notes: ['G4', 'G2', 'D3', 'G3', 'B3', 'D4'],
  },
  banjified_double_c: {
    label: 'Banjified Double C',
    notes: ['G4', 'G2', 'C3', 'G3', 'C4', 'D4'],
  },
};
const MATERIALS = {
  phosphor_bronze: {
    label: 'Phosphor Bronze',
    type: 'phosphor_bronze',
    note: 'D\'Addario describes this family as warm, bright, and balanced.',
  },
  bronze_80_20: {
    label: '80/20 Bronze',
    type: 'bronze_80_20',
    note: 'D\'Addario describes this family as deep, bright, and projecting.',
  },
  nickel_bronze: {
    label: 'Nickel Bronze',
    type: 'nickel_bronze',
    note: 'D\'Addario describes this family as full-spectrum and revealing.',
  },
  silk_steel: {
    label: 'Silk & Steel',
    type: 'silk_steel',
    note: 'D\'Addario describes this family as soft, easy, warm, and mellow.',
  },
};
const STRING_LINES = {
  standard: {
    label: 'Standard',
    note: 'Uncoated baseline when available. This is the clearest first custom-set target.',
    shoppingLabel: 'standard',
  },
  xt: {
    label: 'XT',
    note: 'Longer-life treated strings. In this prototype, line choice guides buying preference, not tension math.',
    shoppingLabel: 'XT coated',
  },
  xs: {
    label: 'XS',
    note: 'Longest-life coated strings. In this prototype, line choice guides buying preference, not tension math.',
    shoppingLabel: 'XS coated',
  },
};
const MATERIAL_LINE_AVAILABILITY = {
  phosphor_bronze: ['standard', 'xt', 'xs'],
  bronze_80_20: ['standard', 'xt', 'xs'],
  nickel_bronze: ['standard'],
  silk_steel: ['standard'],
};
const TYPE_LABELS = {
  plain_steel: 'plain steel',
  phosphor_bronze: 'phosphor bronze',
  bronze_80_20: '80/20 bronze',
  nickel_bronze: 'nickel bronze',
  silk_steel: 'silk & steel',
};
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

function transposeNote(note, semitones) {
  const parsed = parseNote(note);
  if (!parsed) return null;
  const noteIndex = NOTES.indexOf(parsed.name);
  const nextIndex = parsed.octave * 12 + noteIndex + semitones;
  const nextOctave = Math.floor(nextIndex / 12);
  const nextName = NOTES[((nextIndex % 12) + 12) % 12];
  if (!OCTAVES.includes(nextOctave)) return null;
  return buildNote(nextName, nextOctave);
}

function tensionLbs({ unitWeightLbPerIn, scaleLengthInches, frequencyHz }) {
  return (unitWeightLbPerIn * Math.pow(2 * scaleLengthInches * frequencyHz, 2)) / 386.4;
}

function formatGauge(gauge) {
  return `.${String(Math.round(gauge * 1000)).padStart(3, '0')}`;
}

function formatType(type) {
  return TYPE_LABELS[type] ?? type.replace('_', ' ');
}

function amazonSearchUrl(row) {
  const line = STRING_LINES[selectedStringLine].shoppingLabel;
  const query = `D'Addario ${line} ${row.sku} ${formatGauge(row.gauge)} ${formatType(row.type)} single string`;
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=${encodeURIComponent(AMAZON_ASSOCIATE_TAG)}`;
}

function defaultType(frequencyHz) {
  const material = MATERIALS[selectedWoundMaterial];
  return frequencyHz >= PLAIN_STRING_CUTOFF_HZ ? 'plain_steel' : material.type;
}

function getEntryBySku(sku) {
  return stringsCatalog.find(entry => entry.sku === sku) ?? null;
}

function stringsForType(type) {
  return stringsCatalog
    .filter(entry => entry.type === type)
    .sort((a, b) => a.gauge - b.gauge);
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

function computeString(entry, { note, scaleLengthInches, frequencyHz, recommendedSku }) {
  return {
    ...entry,
    note,
    frequencyHz,
    recommendedSku,
    isOverride: entry.sku !== recommendedSku,
    tension: tensionLbs({
      unitWeightLbPerIn: entry.unitWeightLbPerIn,
      scaleLengthInches,
      frequencyHz,
    }),
  };
}

function recommendString({ note, scaleLengthInches, index }) {
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

  if (!best) throw new Error(`No ${formatType(type)} string found for ${note}`);
  const override = getEntryBySku(gaugeOverrides.get(index));
  if (override?.type === type) {
    return computeString(override, { note, scaleLengthInches, frequencyHz, recommendedSku: best.sku });
  }

  gaugeOverrides.delete(index);
  return { ...best, recommendedSku: best.sku, isOverride: false };
}

function setActiveButton(selector, button) {
  document.querySelectorAll(selector).forEach(el => el.classList.toggle('is-active', el === button));
}

function isLineAvailable(lineId) {
  return MATERIAL_LINE_AVAILABILITY[selectedWoundMaterial]?.includes(lineId);
}

function syncPresetButtons() {
  document.querySelectorAll('[data-preset]').forEach(button => {
    const isActive = tuningShiftSemitones === 0 && button.dataset.preset === activePresetId;
    button.classList.toggle('is-active', isActive);
  });
}

function syncScaleButtons() {
  const value = scaleInput.value.trim();
  document.querySelectorAll('[data-scale-option]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.scaleOption === value);
  });
}

function syncMaterialCopy() {
  const material = MATERIALS[selectedWoundMaterial];
  if (!isLineAvailable(selectedStringLine)) {
    selectedStringLine = 'standard';
  }
  const line = STRING_LINES[selectedStringLine];
  materialNote.textContent = `${material.note} Only wound rows use this material; plain rows stay steel.`;
  lineNote.textContent = line.note;
  document.querySelectorAll('[data-line]').forEach(button => {
    const available = isLineAvailable(button.dataset.line);
    button.disabled = !available;
    button.classList.toggle('is-active', button.dataset.line === selectedStringLine);
  });
  assumptionLabel.textContent = `${material.label}, ${line.label}; plain steel where the row is plain.`;
  assumptionDetail.textContent = 'Material and target tension pick the starting gauges. String life guides buying preference; the current tension math uses acoustic unit weights.';
}

function syncTargetInput() {
  if (document.activeElement === customTargetInput) return;
  customTargetInput.value = Number.isInteger(targetTensionLbs) ? String(targetTensionLbs) : targetTensionLbs.toFixed(1);
}

function formatShiftAmount() {
  if (tuningShiftSemitones === 0) return '0 half steps';
  const absolute = Math.abs(tuningShiftSemitones);
  const unit = absolute === 1 ? 'half step' : 'half steps';
  return `${tuningShiftSemitones > 0 ? '+' : '-'}${absolute} ${unit}`;
}

function syncShiftControls() {
  shiftAmountOutput.textContent = formatShiftAmount();
  shiftResetButton.disabled = tuningShiftSemitones === 0;
}

function setBaseTuning(notes) {
  baseTuningRows = [...notes];
  tuningShiftSemitones = 0;
}

function applyTuningShift(delta) {
  const nextShift = tuningShiftSemitones + delta;
  const shifted = baseTuningRows.map(note => transposeNote(note, nextShift));
  if (shifted.some(note => !note)) {
    setTuningHelp('That move would push a note outside the supported octave range. Current tuning was not changed.', true);
    return;
  }
  tuningShiftSemitones = nextShift;
  tuningRows = shifted;
  gaugeOverrides.clear();
  setTuningHelp();
  updateAll();
}

function formatShoppingList(results) {
  const scaleLengthInches = Number(scaleInput.value);
  const preset = activePresetId ? TUNING_PRESETS[activePresetId]?.label : null;
  const moved = tuningShiftSemitones === 0 ? '' : `, moved ${formatShiftAmount()}`;
  const header = [
    'Strings by Arlemo recommendation',
    `Scale: ${Number.isFinite(scaleLengthInches) ? `${scaleLengthInches}"` : scaleInput.value}`,
    `Tuning: ${tuningRows.join(' ')}${preset ? ` (${preset}${moved})` : ''}`,
    `Material: ${MATERIALS[selectedWoundMaterial].label} for wound rows`,
    `String life: ${STRING_LINES[selectedStringLine].label}`,
    `Target tension: ${targetTensionLabel} (${targetTensionLbs.toFixed(1)} lb/string)`,
    `Total tension: ${results.reduce((sum, row) => sum + row.tension, 0).toFixed(1)} lb`,
  ];
  const rows = results.map((row, index) => (
    `${index + 1}. ${row.note} ${formatGauge(row.gauge)} ${row.sku} ${formatType(row.type)} ${row.tension.toFixed(1)} lb`
  ));
  return [...header, '', ...rows].join('\n');
}

function getTensionStatus(tension) {
  const delta = tension - targetTensionLbs;
  if (delta <= -8) {
    return { label: 'very low', className: 'status-very-low', description: `${Math.abs(delta).toFixed(1)} lb below target` };
  }
  if (delta <= -4) {
    return { label: 'low', className: 'status-low', description: `${Math.abs(delta).toFixed(1)} lb below target` };
  }
  if (delta >= 8) {
    return { label: 'very high', className: 'status-very-high', description: `${delta.toFixed(1)} lb above target` };
  }
  if (delta >= 4) {
    return { label: 'high', className: 'status-high', description: `${delta.toFixed(1)} lb above target` };
  }
  return { label: 'ok', className: 'status-ok', description: `${Math.abs(delta).toFixed(1)} lb from target` };
}

function renderShoppingList(results) {
  gaugeSummary.textContent = results.map(row => formatGauge(row.gauge)).join(' ');
  skuSummary.textContent = results.map(row => row.sku).join('  ');
  copyStatus.textContent = '';
  shoppingLinks.replaceChildren();

  results.forEach((row, index) => {
    const link = document.createElement('a');
    link.href = amazonSearchUrl(row);
    link.target = '_blank';
    link.rel = 'sponsored noopener';
    link.textContent = `${index + 1} ${row.sku}`;
    shoppingLinks.append(link);
  });
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
  latestResults = results;
  gaugeStack.replaceChildren();
  const total = results.reduce((sum, row) => sum + row.tension, 0);
  const min = Math.min(...results.map(row => row.tension));
  const max = Math.max(...results.map(row => row.tension));
  const hasOverrides = results.some(row => row.isOverride);
  totalTension.textContent = `${total.toFixed(1)} lb`;
  recommendationState.textContent = hasOverrides ? 'Your custom set' : 'Recommended starting set';
  tensionRange.textContent = `Target: ${targetTensionLabel} ${targetTensionLbs.toFixed(1)} lb/string. Range: ${min.toFixed(1)}-${max.toFixed(1)} lb.`;
  renderShoppingList(results);

  results.forEach((row, index) => {
    const card = document.createElement('article');
    const status = getTensionStatus(row.tension);
    card.className = `gauge-card ${status.className}`;
    const fillBase = Math.max(30, targetTensionLbs * 1.45);
    const fillWidth = Math.max(8, Math.min(100, (row.tension / fillBase) * 100));
    const gaugeOptions = stringsForType(row.type)
      .map(entry => `<option value="${entry.sku}"${entry.sku === row.sku ? ' selected' : ''}>${formatGauge(entry.gauge)}</option>`)
      .join('');
    const gaugeState = row.isOverride ? `custom, recommended ${formatGauge(getEntryBySku(row.recommendedSku)?.gauge ?? row.gauge)}` : 'recommended';
    card.innerHTML = `
      <div class="gauge-main">
        <span class="string-number">${index + 1}</span>
        <strong>${row.note}</strong>
        <label class="gauge-picker">
          <span>Gauge</span>
          <select class="gauge-select" data-index="${index}" aria-label="String ${index + 1} gauge">
            ${gaugeOptions}
          </select>
        </label>
      </div>
      <div class="meter" aria-hidden="true"><span style="width:${fillWidth}%"></span></div>
      <div class="gauge-meta">
        <span>${row.tension.toFixed(1)} lb</span>
        <span>${formatType(row.type)}</span>
        <span>${status.label}</span>
      </div>
      <div class="gauge-note">
        <span>${gaugeState}</span>
        <span>${status.description}</span>
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
  const results = tuningRows.map((note, index) => recommendString({ note, scaleLengthInches, index }));
  renderAnswer(results);
  return results;
}

function syncPasteField() {
  tuningPaste.value = tuningRows.join(' ');
}

function updateAll() {
  syncScaleButtons();
  syncPresetButtons();
  syncShiftControls();
  syncMaterialCopy();
  syncTargetInput();
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
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

async function unlockAudioContext() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return ctx;
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

async function playNote(note, startOffset = 0, duration = 0.72) {
  const ctx = await unlockAudioContext();
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
  const response = await fetch('data/daddario-acoustic-unit-weights.json');
  const data = await response.json();
  stringsCatalog = Object.entries(data.strings).map(([sku, entry]) => ({ sku, ...entry }));
}

document.querySelectorAll('[data-scale-option]').forEach(button => {
  button.addEventListener('click', () => {
    scaleInput.value = button.dataset.scaleOption;
    updateAll();
  });
});

document.querySelectorAll('[data-preset]').forEach(button => {
  button.addEventListener('click', () => {
    const preset = TUNING_PRESETS[button.dataset.preset];
    if (!preset) return;
    activePresetId = button.dataset.preset;
    tuningRows = [...preset.notes];
    setBaseTuning(tuningRows);
    gaugeOverrides.clear();
    setTuningHelp();
    updateAll();
  });
});

document.querySelectorAll('[data-target]').forEach(button => {
  button.addEventListener('click', () => {
    targetTensionLbs = Number(button.dataset.target);
    targetTensionLabel = button.dataset.targetLabel;
    gaugeOverrides.clear();
    setActiveButton('[data-target]', button);
    updateAll();
  });
});

customTargetInput.addEventListener('input', () => {
  const value = Number(customTargetInput.value);
  if (!Number.isFinite(value) || value <= 0) return;
  targetTensionLbs = value;
  targetTensionLabel = 'Custom';
  gaugeOverrides.clear();
  document.querySelectorAll('[data-target]').forEach(button => button.classList.remove('is-active'));
  updateAll();
});

document.querySelectorAll('[data-material]').forEach(button => {
  button.addEventListener('click', () => {
    selectedWoundMaterial = button.dataset.material;
    if (!isLineAvailable(selectedStringLine)) {
      selectedStringLine = 'standard';
    }
    gaugeOverrides.clear();
    setActiveButton('[data-material]', button);
    updateAll();
  });
});

document.querySelectorAll('[data-line]').forEach(button => {
  button.addEventListener('click', () => {
    if (button.disabled || !isLineAvailable(button.dataset.line)) return;
    selectedStringLine = button.dataset.line;
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
  setBaseTuning(tuningRows);
  activePresetId = null;
  gaugeOverrides.clear();
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
  setBaseTuning(tuningRows);
  activePresetId = null;
  updateAll();
});

stringEditor.addEventListener('click', event => {
  const button = event.target.closest('.play-string');
  if (!button) return;
  stopSound();
  playNote(button.dataset.note).catch(() => {});
});

gaugeStack.addEventListener('change', event => {
  const select = event.target.closest('.gauge-select');
  if (!select) return;
  gaugeOverrides.set(Number(select.dataset.index), select.value);
  updateAll();
});

recalculateTargetButton.addEventListener('click', () => {
  gaugeOverrides.clear();
  updateAll();
});

resetRecommendationButton.addEventListener('click', () => {
  gaugeOverrides.clear();
  updateAll();
});

addStringButton.addEventListener('click', () => {
  if (tuningRows.length >= 12) return;
  tuningRows.push('E4');
  setBaseTuning(tuningRows);
  activePresetId = null;
  updateAll();
});

removeStringButton.addEventListener('click', () => {
  if (tuningRows.length <= 1) return;
  tuningRows.pop();
  setBaseTuning(tuningRows);
  activePresetId = null;
  gaugeOverrides.delete(tuningRows.length);
  updateAll();
});

shiftDownButton.addEventListener('click', () => applyTuningShift(-1));
shiftUpButton.addEventListener('click', () => applyTuningShift(1));

shiftResetButton.addEventListener('click', () => {
  tuningRows = [...baseTuningRows];
  tuningShiftSemitones = 0;
  gaugeOverrides.clear();
  setTuningHelp();
  updateAll();
});

copyListButton.addEventListener('click', async () => {
  if (!latestResults.length) return;
  const text = formatShoppingList(latestResults);
  try {
    await navigator.clipboard.writeText(text);
    copyStatus.textContent = 'Copied';
  } catch {
    copyStatus.textContent = 'Copy unavailable';
  }
});

playAllButton.addEventListener('click', async () => {
  stopSound();
  await unlockAudioContext();
  tuningRows.forEach((note, index) => {
    playNote(note, index * 0.44, 0.62).catch(() => {});
  });
});

muteButton.addEventListener('click', stopSound);

await loadCatalog();
updateAll();
