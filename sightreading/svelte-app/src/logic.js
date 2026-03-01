import { writable, get } from 'svelte/store';

// =========================================================
// 1. GLOBAL STATE (Svelte Stores)
// =========================================================
// Using stores makes our UI automatically react whenever a value changes.
export const appSettings = writable({
  clef: 'grand',
  grandMode: 'two-hand',
  accidentals: false,
  trebleMin: 'd3',
  trebleMax: 'g6',
  bassMin: 'c2', 
  bassMax: 'b4',
  key: 'C',
  octave: 0,
  mode: 'chords',
  chordStyle: 'random',
  chordAlternate: false, 
  teachingKeys: 7, 
  teachingScale: 20,
  input: 'keyboard',
  micSensitivity: 0.85, 
  micCooldown: 400
});

export const stats = writable({ startTime: Date.now(), correct: 0, mistakes: 0 });
export const logs = writable([]);
export const activeNotes = writable([]);
export const inputBuffer = writable('');
export const isAppPaused = writable(false);
export const hasOpenedSettings = writable(false);

// Internal state not needing UI reactivity
let currentIndex = 0;
let globalNoteId = 0;
let isShifting = false;
let currentNoteStartTime = Date.now();

export function registerPauseDuration(duration) {
  currentNoteStartTime += duration;
}

// =========================================================
// 2. CONSTANTS & MUSIC DATA
// =========================================================
export const COLOR_PENDING = '#333';
export const COLOR_CORRECT = '#3b82f6';
export const COLOR_ERROR = '#ef4444';

export const keySigs = {
  'C': [],
  'G':  [{p:'f', a:'#'}],
  'D':  [{p:'f', a:'#'}, {p:'c', a:'#'}],
  'A':  [{p:'f', a:'#'}, {p:'c', a:'#'}, {p:'g', a:'#'}],
  'E':  [{p:'f', a:'#'}, {p:'c', a:'#'}, {p:'g', a:'#'}, {p:'d', a:'#'}],
  'B':  [{p:'f', a:'#'}, {p:'c', a:'#'}, {p:'g', a:'#'}, {p:'d', a:'#'}, {p:'a', a:'#'}],
  'F':  [{p:'b', a:'b'}],
  'Bb': [{p:'b', a:'b'}, {p:'e', a:'b'}],
  'Eb': [{p:'b', a:'b'}, {p:'e', a:'b'}, {p:'a', a:'b'}],
  'Ab': [{p:'b', a:'b'}, {p:'e', a:'b'}, {p:'a', a:'b'}, {p:'d', a:'b'}],
  'Db': [{p:'b', a:'b'}, {p:'e', a:'b'}, {p:'a', a:'b'}, {p:'d', a:'b'}, {p:'g', a:'b'}],
  'Gb': [{p:'b', a:'b'}, {p:'e', a:'b'}, {p:'a', a:'b'}, {p:'d', a:'b'}, {p:'g', a:'b'}, {p:'c', a:'b'}]
};

export const keySigOctaves = {
  'treble': {
    '#': { f:5, c:5, g:5, d:5, a:4, e:5, b:4 },
    'b': { b:4, e:5, a:4, d:5, g:4, c:5, f:4 }
  },
  'bass': {
    '#': { f:3, c:3, g:3, d:3, a:2, e:3, b:2 },
    'b': { b:2, e:3, a:2, d:3, g:2, c:3, f:2 }
  }
};

const treblePool = [];
const bassPool = [];

// =========================================================
// 3. LOGGING & HELPERS
// =========================================================
export function addLog(msg) {
  const time = new Date().toLocaleTimeString([], {hour12:false});
  logs.update(l => {
    const newLogs = [`[${time}] ${msg}`, ...l];
    if (newLogs.length > 100) newLogs.pop();
    return newLogs;
  });
}

export function noteStringToIdx(str) {
  if (!str) return 0;
  const p = str[0];
  const o = parseInt(str[1], 10);
  const pitchVals = { 'c': 0, 'd': 1, 'e': 2, 'f': 3, 'g': 4, 'a': 5, 'b': 6 };
  return pitchVals[p] + (o - 4) * 7;
}

export function calculateY(pitch, oct, noteClef, settings) {
  let idx = noteStringToIdx(pitch + oct);
  if (settings.clef === 'grand') {
    if (noteClef === 'treble') return 260 - idx * 10;
    if (noteClef === 'bass') return settings.grandMode === 'two-hand' ? 320 - idx * 10 : 260 - idx * 10;
  }
  if (settings.clef === 'treble') return 260 - idx * 10;
  return 140 - idx * 10;
}

export function getVisualAccidental(pitch, trueAcc, settings) {
  const activeKeySigs = keySigs[settings.key] || [];
  const keyAcc = activeKeySigs.find(k => k.p === pitch);
  const defaultAcc = keyAcc ? keyAcc.a : '';
  if (trueAcc === defaultAcc) return '';
  if (trueAcc === '') return 'n';
  return trueAcc;
}

export function parseInput(str) {
  if (!str) return null;
  const pitch = str[0];
  const octMatch = str.match(/\d+/);
  if (!octMatch) return null;
  const oct = parseInt(octMatch[0], 10);
  let acc = '';
  if (str.includes('#')) acc = '#';
  else if (str.includes('b')) acc = 'b';
  return { pitch, acc, oct };
}

function hzToMidi(hz) {
  if (hz < 46.875 || hz > 2093.75) return -1;
  return Math.round(69 + 12 * Math.log2(hz / 440.0));
}

function midiToNoteString(midi) {
  const pitches = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
  const oct = Math.floor(midi / 12) - 1;
  const pitch = pitches[midi % 12];
  return pitch + oct; 
}

// =========================================================
// 4. NOTE GENERATION LOGIC
// =========================================================
export function buildPools() {
  const settings = get(appSettings);
  treblePool.length = 0; bassPool.length = 0;
  const pitches = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
  const semitones = { 'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11 };
  const accidentals = ['', '#', 'b'];
  const forbidden = ['cb', 'fb', 'b#', 'e#'];

  const t1 = noteStringToIdx(settings.trebleMin);
  const t2 = noteStringToIdx(settings.trebleMax);
  const b1 = noteStringToIdx(settings.bassMin);
  const b2 = noteStringToIdx(settings.bassMax);

  const addNotes = (pool, minIdx, maxIdx, baseOct, clefType) => {
    for (let visualOct = 1; visualOct <= 7; visualOct++) {
      for (let p of pitches) {
        let idx = noteStringToIdx(p + visualOct);
        if (idx >= minIdx && idx <= maxIdx) {
          for (let acc of accidentals) {
            if (forbidden.includes(p + acc)) continue;
            const actualOct = visualOct + settings.octave;
            const midi = (actualOct + 1) * 12 + semitones[p] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0);
            pool.push({
              pitch: p, trueAcc: acc, actualOct: actualOct, visualOct: visualOct,
              displayStr: p + acc + actualOct, midi: midi, noteClef: clefType
            });
          }
        }
      }
    }
  };

  addNotes(treblePool, Math.min(t1, t2), Math.max(t1, t2), 4, 'treble'); 
  addNotes(bassPool, Math.min(b1, b2), Math.max(b1, b2), 4, 'bass');     
}

function getBestNoteForMidi(midi, pool, currentKey, preferredClef = null) {
  let candidates = pool.filter(n => n.midi === midi);
  if (candidates.length === 0) return null;
  if (preferredClef) {
    const clefCands = candidates.filter(n => n.noteClef === preferredClef);
    if (clefCands.length > 0) candidates = clefCands;
    else return null; // FIX: Ensures notes don't bleed across clefs if they drop out of bounds
  }
  if (candidates.length === 1) return candidates[0];
  
  const keyAccs = keySigs[currentKey] || [];
  for (let cand of candidates) {
    const keyAcc = keyAccs.find(k => k.p === cand.pitch);
    if (keyAcc && keyAcc.a === cand.trueAcc) return cand; 
    if (!keyAcc && cand.trueAcc === '') return cand; 
  }
  
  const hasFlats = keyAccs.some(k => k.a === 'b');
  const alignedCand = candidates.find(c => c.trueAcc === (hasFlats ? 'b' : '#'));
  return alignedCand || candidates[0];
}

export const NoteGenerator = {
  chordQueue: [], teachingPool: [], likelihoods: [], timesQueue: [], recentMisses: [], lastGeneratedNote: null,
  
  init: function(settings) {
    this.chordQueue = []; this.timesQueue = []; this.recentMisses = []; this.lastGeneratedNote = null;
    let activePool = settings.clef === 'bass' ? bassPool : (settings.clef === 'grand' ? [...bassPool, ...treblePool] : treblePool);
    if (!settings.accidentals) activePool = activePool.filter(n => getVisualAccidental(n.pitch, n.trueAcc, settings) === '');

    this.teachingPool = activePool.slice().sort((a, b) => {
      if (a.noteClef !== b.noteClef) return a.noteClef === 'bass' ? -1 : 1;
      return a.midi - b.midi;
    });

    if (settings.mode === 'teaching') {
      let k = Math.min(settings.teachingKeys, this.teachingPool.length);
      this.likelihoods = new Array(this.teachingPool.length).fill(0.0);
      let anchorIndices = [];

      if (settings.clef === 'grand') {
        let bassIndices = this.teachingPool.map((n, i) => n.noteClef === 'bass' ? i : -1).filter(i => i !== -1);
        let trebleIndices = this.teachingPool.map((n, i) => n.noteClef === 'treble' ? i : -1).filter(i => i !== -1);
        let k1 = Math.floor(k / 2); let k2 = Math.floor(k / 2);
        if (k % 2 !== 0) { Math.random() > 0.5 ? k1++ : k2++; }
        const pickRandom = (arr, count) => arr.slice().sort(() => 0.5 - Math.random()).slice(0, count);
        anchorIndices = [...pickRandom(bassIndices, Math.min(k1, bassIndices.length)), ...pickRandom(trebleIndices, Math.min(k2, trebleIndices.length))];
      } else {
        anchorIndices = this.teachingPool.map((_, i) => i).sort(() => 0.5 - Math.random()).slice(0, k);
      }
      anchorIndices.forEach(idx => this.likelihoods[idx] = 1.0);
      addLog(`NoteGenerator re-initialized in Teaching Mode with ${anchorIndices.length} anchors.`);
    } else {
      addLog(`NoteGenerator re-initialized (Mode: ${settings.mode}).`);
    }
  },

  generate: function(count, settings) {
    let results = [];
    for (let i = 0; i < count; i++) {
      if (settings.mode === 'uniform') results.push(this._uniform());
      else if (settings.mode === 'chords') results.push(this._chords(settings));
      else if (settings.mode === 'teaching') results.push(this._teaching(settings));
    }
    return results;
  },

  feedback: function(noteData, timeToPlay, mistakes, settings) {
    if (settings.mode !== 'teaching') return;
    let idx = this.teachingPool.findIndex(n => n.midi === noteData.midi && n.noteClef === noteData.noteClef && n.trueAcc === noteData.trueAcc);
    if (idx === -1) return;

    if (mistakes > 0 && !this.recentMisses.some(n => n.midi === noteData.midi)) {
      this.recentMisses.push(noteData);
    }

    const s = settings.teachingScale;
    if (this.timesQueue.length === s) {
      let mean = this.timesQueue.reduce((a,b) => a+b, 0) / s;
      let variance = this.timesQueue.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / s;
      let std = Math.max(50, Math.sqrt(variance));
      if (timeToPlay > mean + 2 * std) this.likelihoods[idx] += 1.0;
      else { this.timesQueue.push(timeToPlay); this.timesQueue.shift(); }
    } else {
      this.timesQueue.push(timeToPlay);
    }
  },

  _uniform: function() {
    if (this.teachingPool.length <= 1) return this.teachingPool[0] || treblePool[0];
    let chosenNote; let attempts = 0;
    do {
      chosenNote = this.teachingPool[Math.floor(Math.random() * this.teachingPool.length)];
      attempts++;
    } while (this.lastGeneratedNote && chosenNote.midi === this.lastGeneratedNote.midi && attempts < 10);
    this.lastGeneratedNote = chosenNote; return chosenNote;
  },

  _teaching: function(settings) {
    if (this.teachingPool.length <= 1) return this.teachingPool[0] || treblePool[0];
    let chosenNote = null; let chosenIdx = -1;

    if (this.recentMisses.length > 0 && Math.random() < (1/3)) {
      const missIdx = this.recentMisses.findIndex(n => !this.lastGeneratedNote || n.midi !== this.lastGeneratedNote.midi);
      if (missIdx !== -1) {
        chosenNote = this.recentMisses.splice(missIdx, 1)[0];
        chosenIdx = this.teachingPool.findIndex(n => n.midi === chosenNote.midi && n.noteClef === chosenNote.noteClef && n.trueAcc === chosenNote.trueAcc);
      }
    }

    if (!chosenNote) {
      let tempLikelihoods = [...this.likelihoods];
      if (this.lastGeneratedNote) {
        const lastIdx = this.teachingPool.findIndex(n => n.midi === this.lastGeneratedNote.midi);
        if (lastIdx !== -1) tempLikelihoods[lastIdx] = 0;
      }
      let sum = tempLikelihoods.reduce((a, b) => a + b, 0);
      if (sum <= 0) {
        const availableIndices = tempLikelihoods.map((_, i) => i).filter(i => !this.lastGeneratedNote || this.teachingPool[i].midi !== this.lastGeneratedNote.midi);
        chosenIdx = availableIndices.length > 0 ? availableIndices[Math.floor(Math.random() * availableIndices.length)] : Math.floor(Math.random() * this.teachingPool.length);
        this.likelihoods[chosenIdx] = 1.0; sum = 1.0;
      } else {
        let r = Math.random() * sum; let runningSum = 0;
        for (let i = 0; i < tempLikelihoods.length; i++) {
          runningSum += tempLikelihoods[i];
          if (r <= runningSum && tempLikelihoods[i] > 0) { chosenIdx = i; break; }
        }
      }
      if (chosenIdx === -1) chosenIdx = this.teachingPool.length - 1;
      chosenNote = this.teachingPool[chosenIdx];
    }

    if (chosenIdx !== -1) {
      const p = Math.PI / (2 * Math.pow(settings.teachingScale + 1 / 3, 2));
      this.likelihoods[chosenIdx] = Math.max(0, this.likelihoods[chosenIdx] - p);
      const kernelWeights = { 1: 1, 2: 4, 3: 6, 4: 8, 5: 8, 6: 1, 7: 10, 8: 5, 9: 6, 10: 3, 11: 2 };
      const centerMidi = this.teachingPool[chosenIdx].midi;
      const centerClef = this.teachingPool[chosenIdx].noteClef;

      for (let i = 0; i < this.teachingPool.length; i++) {
        if (i === chosenIdx || this.teachingPool[i].noteClef !== centerClef) continue;
        const diff = Math.abs(this.teachingPool[i].midi - centerMidi);
        if (diff >= 1 && diff <= 11) this.likelihoods[i] += p * (kernelWeights[diff] / 108);
      }
    }
    this.lastGeneratedNote = chosenNote; return chosenNote;
  },

  _chords: function(settings) {
    if (this.chordQueue.length > 0) return this.chordQueue.shift();
    const fullPool = settings.clef === 'bass' ? bassPool : (settings.clef === 'grand' ? [...bassPool, ...treblePool] : treblePool);
    const intervalSets = [[0, 4, 7, 11], [0, 3, 7, 10], [0, 4, 7, 9], [0, 3, 7, 9]];

    const buildChord = (rootPool, targetPitchClass = null, avoidPitchClass = null) => {
      let attempts = 0; let finalChord = [];
      const maxMidi = Math.max(...rootPool.map(p => p.midi));

      while (attempts < 50) {
        let rootNote;
        if (targetPitchClass !== null) {
          const cands = rootPool.filter(n => n.midi % 12 === targetPitchClass);
          if (cands.length === 0) { attempts++; continue; }
          rootNote = cands[Math.floor(Math.random() * cands.length)];
        } else {
          rootNote = rootPool[Math.floor(Math.random() * rootPool.length)];
          if (avoidPitchClass !== null && rootNote.midi % 12 === avoidPitchClass) { attempts++; continue; }
        }

        const intervals = intervalSets[Math.floor(Math.random() * intervalSets.length)];
        let chordMidis = intervals.map(i => rootNote.midi + i);

        const inv = Math.floor(Math.random() * 4);
        for (let i = 0; i < inv; i++) {
          let minMidi = Math.min(...chordMidis);
          chordMidis[chordMidis.indexOf(minMidi)] += 12;
        }
        chordMidis.sort((a, b) => a - b);
        if (Math.max(...chordMidis) > maxMidi) { attempts++; continue; }
        if (Math.random() > 0.5) chordMidis.reverse();

        let candidateNotes = chordMidis.map(m => getBestNoteForMidi(m, fullPool, settings.key, rootNote.noteClef));
        if (candidateNotes.some(n => !n)) { attempts++; continue; }
        if (!settings.accidentals && candidateNotes.some(n => getVisualAccidental(n.pitch, n.trueAcc, settings) !== '')) { attempts++; continue; }

        finalChord = candidateNotes; break;
      }
      return finalChord.length > 0 ? finalChord : [rootPool[0]];
    };

    if (settings.clef === 'grand' && settings.grandMode === 'two-hand' && settings.chordAlternate) {
      let bassChord, trebleChord;
      let valid = false;
      let generateAttempts = 0;

      // Generate independent chords and check for overlap to avoid biasing either hand's range
      while (!valid && generateAttempts < 100) {
        bassChord = buildChord(bassPool);
        
        const targetClass = (bassChord[0].midi % 12 + [5, 7, 4, 9][Math.floor(Math.random() * 4)]) % 12;
        trebleChord = buildChord(treblePool, targetClass);
        if (trebleChord.length === 1) trebleChord = buildChord(treblePool, null, bassChord[0].midi % 12);

        let maxBassMidi = Math.max(...bassChord.map(n => n.midi));
        let minTrebleMidi = Math.min(...trebleChord.map(n => n.midi));
        
        if (minTrebleMidi >= maxBassMidi) {
          valid = true;
        }
        generateAttempts++;
      }

      if (settings.chordStyle === 'random') { bassChord.sort(() => 0.5-Math.random()); trebleChord.sort(() => 0.5-Math.random()); }
      let interleaved = []; let startLeft = Math.random() > 0.5;
      for (let i = 0; i < 4; i++) {
        if (startLeft) interleaved.push(bassChord[i % bassChord.length], trebleChord[i % trebleChord.length]);
        else interleaved.push(trebleChord[i % trebleChord.length], bassChord[i % bassChord.length]);
      }
      this.chordQueue = interleaved;
    } else {
      let finalChord = buildChord(this.teachingPool.length > 0 ? this.teachingPool : fullPool);
      if (settings.chordStyle === 'random') finalChord.sort(() => 0.5 - Math.random());
      this.chordQueue = finalChord;
    }
    return this.chordQueue.shift();
  }
};

// =========================================================
// 5. INPUT HANDLING & GAME FLOW
// =========================================================
export function initNotes(visibleCount) {
  const settings = get(appSettings);
  activeNotes.set([]);
  currentIndex = 0; globalNoteId = 0;
  NoteGenerator.init(settings);
  
  let newNotes = [];
  NoteGenerator.generate(visibleCount, settings).forEach(data => {
    newNotes.push({ data, id: 'note-' + globalNoteId++, state: 'pending', errorInput: null, mistakeCount: 0 });
  });
  activeNotes.set(newNotes);
  currentNoteStartTime = Date.now();
}

export function shiftNotes() {
  const settings = get(appSettings);
  activeNotes.update(notes => {
    let kept = notes.slice(4);
    NoteGenerator.generate(4, settings).forEach(data => {
      kept.push({ data, id: 'note-' + globalNoteId++, state: 'pending', errorInput: null, mistakeCount: 0 });
    });
    return kept;
  });
  currentIndex = 0;
  currentNoteStartTime = Date.now();
}

function triggerSuccess() {
  const settings = get(appSettings);
  let timeToPlay = Date.now() - currentNoteStartTime;
  
  activeNotes.update(notes => {
    const current = notes[currentIndex];
    NoteGenerator.feedback(current.data, timeToPlay, current.mistakeCount || 0, settings);
    current.state = 'correct';
    current.errorInput = null;
    return notes;
  });
  
  stats.update(s => ({ ...s, correct: s.correct + 1 }));
  currentIndex++;
  currentNoteStartTime = Date.now();

  if (currentIndex === 4) {
    isShifting = true;
    setTimeout(() => { shiftNotes(); isShifting = false; }, 350);
  }
}

function triggerError(errStr) {
  activeNotes.update(notes => {
    const current = notes[currentIndex];
    current.state = 'error';
    current.errorInput = errStr;
    current.mistakeCount = (current.mistakeCount || 0) + 1;
    return notes;
  });
  stats.update(s => ({ ...s, mistakes: s.mistakes + 1 }));
}

export function handleStringInput(str) {
  const current = get(activeNotes)[currentIndex];
  if (str === current.data.displayStr) {
    triggerSuccess();
    inputBuffer.set('');
  } else {
    triggerError(str);
    inputBuffer.set('');
  }
}

export function handleKeyboardInput(key) {
  if (get(isAppPaused) || isShifting) return;
  let buf = get(inputBuffer);
  
  if (key >= '0' && key <= '9') {
    if (buf.length > 0) {
      inputBuffer.set(buf + key);
      handleStringInput(get(inputBuffer));
    }
  } else if (key >= 'a' && key <= 'g') {
    if (buf.length === 1 && key === 'b') inputBuffer.set(buf + key);
    else inputBuffer.set(key);
  } else if (key === '#' || key === 's') {
    if (buf.length === 1) inputBuffer.set(buf + '#');
  }
}

export function handleMicInput(detectedMidi) {
  const current = get(activeNotes)[currentIndex];
  const displayStr = midiToNoteString(detectedMidi);
  
  inputBuffer.set(displayStr.toUpperCase());
  setTimeout(() => { if (get(inputBuffer) === displayStr.toUpperCase()) inputBuffer.set(''); }, 600);

  if (current.data.midi === detectedMidi) triggerSuccess();
  else triggerError(displayStr);
}

// =========================================================
// 6. AUDIO ENGINE (ONNX & Microphone)
// =========================================================
export const AudioEngine = {
  context: null, stream: null, workletNode: null, pitchHistory: [], lastPlayedMidiTimes: {}, session: null, isInferencing: false,
  
  init: async function() {
    if (this.context) return;
    try {
      addLog("Initializing Pitch Detection Model...");
      
      // Fix: Poll for window.ort to be loaded if triggered immediately via hash params
      let retries = 0;
      while (typeof window.ort === 'undefined' && retries < 50) {
        await new Promise(r => setTimeout(r, 100)); // wait up to 5 seconds
        retries++;
      }

      if (typeof window.ort === 'undefined') throw new Error("ONNX Runtime not loaded.");
      
      window.ort.env.wasm.wasmPaths = './';
      window.ort.env.wasm.numThreads = 1;
      this.session = await window.ort.InferenceSession.create('model.onnx', { executionProviders: ['wasm'], intraOpNumThreads: 1, interOpNumThreads: 1 });
      addLog(`SwiftF0 model loaded successfully.`);

      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false } });
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      
      // Injecting the worklet code directly as a Blob to keep everything DRY and single-file
      const workletCode = `
        class PitchProcessor extends AudioWorkletProcessor {
          constructor(options) {
            super();
            this.inRate = options.processorOptions.inRate;
            this.outRate = 16000;
            this.ratio = this.inRate / this.outRate;
            this.a = 6; this.beta = 14.769656459379492; this.rolloff = 0.99;
            this.support = this.a * this.ratio; 
            this.i0Beta = this.besselI0(this.beta);
            this.inBuffer = new Float32Array(8192); this.inLen = 0; this.readPos = this.support; 
            this.outBufferSize = 2048; this.outBuffer = new Float32Array(this.outBufferSize); this.outLen = 0;
          }
          besselI0(x) { let sum=1.0, term=1.0, x2_4=(x*x)/4.0; for(let k=1; k<25; k++){ term*=x2_4/(k*k); sum+=term; if(term<1e-8*sum) break; } return sum; }
          sinc(x) { if(x===0) return 1.0; const piX = Math.PI*x; return Math.sin(piX)/piX; }
          sincKaiser(x) { if(Math.abs(x)>=this.a) return 0.0; return this.sinc(x*this.rolloff) * (this.besselI0(this.beta*Math.sqrt(1.0-Math.pow(x/this.a, 2)))/this.i0Beta); }
          process(inputs) {
            const input = inputs[0]; if(!input || input.length===0) return true;
            const channelData = input[0];
            if(this.inLen+channelData.length>this.inBuffer.length){ this.inLen=0; this.readPos=this.support; }
            this.inBuffer.set(channelData, this.inLen); this.inLen+=channelData.length;
            while(this.readPos+this.support < this.inLen) {
              let sum=0, weightSum=0;
              const start=Math.floor(this.readPos-this.support)+1, end=Math.floor(this.readPos+this.support);
              for(let i=start; i<=end; i++){ const weight=this.sincKaiser((i-this.readPos)/this.ratio); sum+=this.inBuffer[i]*weight; weightSum+=weight; }
              this.outBuffer[this.outLen++] = weightSum===0 ? 0 : sum/weightSum;
              this.readPos+=this.ratio;
              if(this.outLen>=this.outBufferSize){ this.port.postMessage(new Float32Array(this.outBuffer)); this.outLen=0; }
            }
            const keepStart = Math.floor(this.readPos-this.support);
            if(keepStart>0){ const keepCount = this.inLen-keepStart; this.inBuffer.copyWithin(0, keepStart, this.inLen); this.inLen=keepCount; this.readPos-=keepStart; }
            return true;
          }
        }
        registerProcessor('pitch-processor', PitchProcessor);
      `;
      
      const workletUrl = URL.createObjectURL(new Blob([workletCode], { type: 'application/javascript' }));
      await this.context.audioWorklet.addModule(workletUrl);
      
      const sourceNode = this.context.createMediaStreamSource(this.stream);
      this.workletNode = new AudioWorkletNode(this.context, 'pitch-processor', { processorOptions: { inRate: this.context.sampleRate }})

      this.pitchHistory = []; this.lastPlayedMidiTimes = {};

      this.workletNode.port.onmessage = async (event) => {
        if (get(isAppPaused) || isShifting || this.isInferencing || !this.session) return;
        this.isInferencing = true;
        
        try {
          const tensor = new window.ort.Tensor('float32', event.data, [1, event.data.length]);
          const results = await this.session.run({ [this.session.inputNames[0]]: tensor });
          const pitchOut = results[this.session.outputNames[0]].data;
          const confOut = results[this.session.outputNames[1]].data;
          const pitch = pitchOut[pitchOut.length - 1];
          const confidence = confOut[confOut.length - 1];
          
          const settings = get(appSettings);
          if (pitch > 0 && confidence >= settings.micSensitivity) {
            const midi = hzToMidi(pitch);
            if (midi !== -1) {
              this.pitchHistory.push(midi);
              if (this.pitchHistory.length > 1) this.pitchHistory.shift();

              if (this.pitchHistory[0] === midi) {
                const now = Date.now();
                if (now - (this.lastPlayedMidiTimes[midi] || 0) > settings.micCooldown) {
                  this.lastPlayedMidiTimes[midi] = now;
                  handleMicInput(midi);
                }
              }
            } else this.pitchHistory.push(-1);
          } else {
            this.pitchHistory.push(-1);
            if (this.pitchHistory.length > 1) this.pitchHistory.shift();
          }
        } catch(e) { console.error(e); } finally { this.isInferencing = false; }
      };

      sourceNode.connect(this.workletNode);
      addLog("Microphone & AudioWorklet Initialized.");
    } catch (e) {
      console.error(e);
      addLog(`Setup Failed: ${e.message}`);
      alert('Could not access microphone or load model. Falling back to keyboard.');
      appSettings.update(s => ({ ...s, input: 'keyboard' }));
    }
  },

  stop: function() {
    if (this.workletNode) { this.workletNode.disconnect(); this.workletNode = null; }
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.context) { this.context.close(); this.context = null; }
    addLog("Microphone Stopped.");
  }
};
