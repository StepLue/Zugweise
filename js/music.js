// Musiktheorie für Tenorposaune in B (ohne Quartventil), Bassschlüssel
// Note: { letter: 0..6 (C D E F G A H), acc: -2..2, oct: wissenschaftliche Oktave (C4 = c') }

export const NAT_PC = [0, 2, 4, 5, 7, 9, 11];
const BASE = ['C', 'D', 'E', 'F', 'G', 'A', 'H'];

export function mk(letter, acc, oct) { return { letter, acc, oct }; }
export function midiOf(n) { return (n.oct + 1) * 12 + NAT_PC[n.letter] + n.acc; }
export function diaOf(n) { return n.oct * 7 + n.letter; }
export function idOf(n) { return `${n.letter}${n.acc >= 0 ? '+' : ''}${n.acc}@${n.oct}`; }
export function fromId(id) {
  const m = id.match(/^(\d)([+-]\d)@(-?\d)$/);
  return mk(+m[1], +m[2], +m[3]);
}
export function sameNote(a, b) { return a.letter === b.letter && a.acc === b.acc && a.oct === b.oct; }
export function samePcName(a, b) { return a.letter === b.letter && a.acc === b.acc; }

// Deutscher Tonname ohne Oktave, groß geschrieben: C, Cis, Des, Es, B, H, Heses …
export function pcName(n) {
  const { letter, acc } = n;
  if (acc === 0) return BASE[letter];
  if (acc > 0) return BASE[letter] + 'is'.repeat(acc);
  if (letter === 6) return acc === -1 ? 'B' : 'Heses';
  if (letter === 2 || letter === 5) return BASE[letter] + 's' + 'es'.repeat(-acc - 1);
  return BASE[letter] + 'es'.repeat(-acc);
}

// Name mit Oktavlage (Helmholtz): ₁B, F, f, f′, f″
export function noteName(n) {
  const p = pcName(n);
  if (n.oct <= 1) return (n.oct === 1 ? '₁' : '₂') + p;
  if (n.oct === 2) return p;
  const low = p.toLowerCase();
  if (n.oct === 3) return low;
  return low + (n.oct === 4 ? '′' : n.oct === 5 ? '″' : '‴');
}

export function octaveLabel(n) {
  return ['Subkontra', 'Kontra', 'Große', 'Kleine', 'Eingestrichene', 'Zweigestrichene', 'Dreigestrichene'][n.oct] + ' Oktave';
}

// Standard-Schreibweise je Tonhöhe
const DEFAULT_SPELL = [[0, 0], [0, 1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];
export function spellDefault(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const [letter, acc] = DEFAULT_SPELL[pc];
  const oct = Math.floor((midi - NAT_PC[letter] - acc) / 12) - 1;
  return mk(letter, acc, oct);
}

// Alle sinnvollen Schreibweisen (einfache Vorzeichen) einer Tonhöhe
export function spellingsOf(midi) {
  const out = [];
  for (let letter = 0; letter < 7; letter++) {
    for (let acc = -1; acc <= 1; acc++) {
      const base = NAT_PC[letter] + acc;
      if (((midi - base) % 12 + 12) % 12 !== 0) continue;
      const oct = (midi - base) / 12 - 1;
      out.push(mk(letter, acc, oct));
    }
  }
  return out;
}

// ---------- Zugpositionen ----------
// Hauptpositionen (übliche Grifftabelle); Alternativen werden aus der Naturtonreihe ergänzt
const PRIMARY = {
  40: 7, 41: 6, 42: 5, 43: 4, 44: 3, 45: 2, 46: 1, 47: 7, 48: 6, 49: 5, 50: 4, 51: 3,
  52: 2, 53: 1, 54: 5, 55: 4, 56: 3, 57: 2, 58: 1, 59: 4, 60: 3, 61: 2, 62: 1, 63: 3,
  64: 2, 65: 1, 66: 3, 67: 2, 68: 3, 69: 2, 70: 1, 71: 2, 72: 1, 73: 2, 74: 1, 75: 3,
  76: 2, 77: 1,
};
const PARTIALS_POS1 = [34, 46, 53, 58, 62, 65, 68, 70, 72, 74];
export const POSITIONS = {};
for (const m in PRIMARY) {
  const alts = [];
  for (let k = 1; k <= 7; k++) { // Teiltöne 2..8 (höhere Alternativen sind unüblich)
    const p = PARTIALS_POS1[k] - +m + 1;
    if (k === 6 && p === 1) continue; // 7. Teilton ist zu tief, in Zug 1 nicht ausgleichbar
    if (p >= 1 && p <= 7 && p !== PRIMARY[m] && !alts.includes(p)) alts.push(p);
  }
  POSITIONS[m] = [PRIMARY[m], ...alts.sort((a, b) => a - b)];
}
export function positionsOf(n) { return POSITIONS[midiOf(n)] || null; }

export const POS_COLORS = {
  1: '#2E9E5B', 2: '#169AA0', 3: '#3A78D6', 4: '#7A5AD4',
  5: '#C2458F', 6: '#E0782A', 7: '#D33F3F',
};

// Naturtonreihe: Teiltöne 1..10 in Position 1
export function naturalSeries(pos) {
  return PARTIALS_POS1.map((m, i) => ({
    partial: i + 1,
    midi: m - (pos - 1),
    note: spellDefault(m - (pos - 1)),
    flat7: i + 1 === 7,
    pedal: i === 0,
  }));
}

// ---------- Lernstufen ----------
export const LEVELS = [
  { id: 1, lo: 46, hi: 58, label: 'B – b' },
  { id: 2, lo: 41, hi: 62, label: 'F – d′' },
  { id: 3, lo: 40, hi: 65, label: 'E – f′' },
  { id: 4, lo: 40, hi: 70, label: 'E – b′' },
  { id: 5, lo: 40, hi: 77, label: 'E – f″' },
];
export function levelById(id) { return LEVELS.find(l => l.id === id) || LEVELS[0]; }

// Stammtöne im Bereich
export function naturalsInRange(lo, hi) {
  const out = [];
  for (let oct = 1; oct <= 6; oct++) for (let l = 0; l < 7; l++) {
    const n = mk(l, 0, oct); const m = midiOf(n);
    if (m >= lo && m <= hi) out.push(n);
  }
  return out.sort((a, b) => midiOf(a) - midiOf(b));
}

// Gemischte Vorzeichen: alle Schreibweisen im Bereich, mit Gewicht
const RARE = (n) => (n.acc === 1 && (n.letter === 2 || n.letter === 6)) || (n.acc === -1 && (n.letter === 0 || n.letter === 3));
export function mixedPool(lo, hi) {
  const out = [];
  for (let m = lo; m <= hi; m++) for (const n of spellingsOf(m)) out.push({ note: n, w: RARE(n) ? 0.25 : 1 });
  return out;
}
export function isRareSpelling(n) { return RARE(n); }

// ---------- Tonleitern ----------
export const MAJOR_KEYS = [
  [0, 0], [4, 0], [1, 0], [5, 0], [2, 0], [6, 0], [3, 1],
  [3, 0], [6, -1], [2, -1], [5, -1], [1, -1], [4, -1],
];
export const MINOR_KEYS = [
  [5, 0], [2, 0], [6, 0], [3, 1], [0, 1], [4, 1],
  [1, 0], [4, 0], [0, 0], [3, 0], [6, -1], [2, -1],
];
const IV = {
  dur: [0, 2, 4, 5, 7, 9, 11, 12],
  natuerlich: [0, 2, 3, 5, 7, 8, 10, 12],
  harmonisch: [0, 2, 3, 5, 7, 8, 11, 12],
  melodisch: [0, 2, 3, 5, 7, 9, 11, 12],
};
export const MOLL_FORMS = [
  ['natuerlich', 'natürlich'], ['harmonisch', 'harmonisch'], ['melodisch', 'melodisch'],
];

export function keyName(tonic, mode) {
  const n = pcName(mk(tonic[0], tonic[1], 3));
  return mode === 'dur' ? `${n}-Dur` : `${n.toLowerCase()}-Moll`;
}

function buildScale(tonic, ivs, startOct) {
  const [L, A] = tonic;
  const tonicPc = NAT_PC[L] + A;
  const out = [];
  for (let i = 0; i < ivs.length; i++) {
    const letter = (L + i) % 7;
    const oct = startOct + Math.floor((L + i) / 7);
    const target = tonicPc + ivs[i];
    let acc = target - (NAT_PC[letter] + 12 * Math.floor((L + i) / 7));
    out.push(mk(letter, acc, oct));
  }
  return out;
}

// Liefert Tonleiter (aufwärts, bei melodisch Moll auf + ab)
export function scaleNotes(tonic, mode, form, startOct) {
  if (mode === 'dur') return buildScale(tonic, IV.dur, startOct);
  if (form === 'melodisch') {
    const up = buildScale(tonic, IV.melodisch, startOct);
    const down = buildScale(tonic, IV.natuerlich, startOct).slice(0, 7).reverse();
    return [...up, { bar: true }, ...down];
  }
  return buildScale(tonic, IV[form], startOct);
}

// Tonvorrat (Buchstabe -> Vorzeichen) der Leiter, für "ganzer Tonumfang"
function scaleSpellings(tonic, mode, form) {
  const sets = [];
  if (mode === 'dur') sets.push(buildScale(tonic, IV.dur, 3));
  else if (form === 'melodisch') { sets.push(buildScale(tonic, IV.melodisch, 3)); sets.push(buildScale(tonic, IV.natuerlich, 3)); }
  else sets.push(buildScale(tonic, IV[form], 3));
  const list = [];
  for (const s of sets) for (const n of s.slice(0, 7)) if (!list.some(x => x.letter === n.letter && x.acc === n.acc)) list.push({ letter: n.letter, acc: n.acc });
  return list;
}

export function scaleToneRange(tonic, mode, form, lo, hi) {
  const sp = scaleSpellings(tonic, mode, form);
  const out = [];
  for (let oct = 1; oct <= 6; oct++) for (const s of sp) {
    const n = mk(s.letter, s.acc, oct); const m = midiOf(n);
    if (m >= lo && m <= hi) out.push(n);
  }
  return out.sort((a, b) => midiOf(a) - midiOf(b) || a.letter - b.letter);
}

// Oktavlagen, in denen Grundton bis Grundton in den Bereich passt
export function scaleOctaves(tonic, mode, form, lo, hi) {
  const res = [];
  for (let o = 1; o <= 5; o++) {
    const notes = scaleNotes(tonic, mode, form, o).filter(n => !n.bar);
    if (notes.every(n => midiOf(n) >= lo && midiOf(n) <= hi)) res.push(o);
  }
  return res;
}

// Vorzeichnung
const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6];
const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];
export function keySignature(tonic, mode) {
  const ref = buildScale(tonic, mode === 'dur' ? IV.dur : IV.natuerlich, 3).slice(0, 7);
  const sharps = ref.filter(n => n.acc > 0).length;
  const flats = ref.filter(n => n.acc < 0).length;
  if (sharps) return { type: 1, count: sharps, letters: SHARP_ORDER.slice(0, sharps) };
  if (flats) return { type: -1, count: flats, letters: FLAT_ORDER.slice(0, flats) };
  return { type: 0, count: 0, letters: [] };
}
export function keyAccFor(sig, letter) { return sig && sig.letters.includes(letter) ? sig.type : 0; }

// Antwortmöglichkeiten für gemischte Vorzeichen
export function mixedChoices(n, rnd = Math.random) {
  const set = [];
  const add = (x) => { if (!set.some(s => samePcName(s, x))) set.push({ letter: x.letter, acc: x.acc }); };
  add(n);
  for (const a of [-1, 0, 1]) add({ letter: n.letter, acc: a });
  for (const s of spellingsOf(midiOf(n))) if (!isRareSpelling(s) || isRareSpelling(n)) add(s);
  const pool = [];
  for (let l = 0; l < 7; l++) for (const a of [-1, 0, 1]) pool.push({ letter: l, acc: a });
  while (set.length < 6) {
    const p = pool[Math.floor(rnd() * pool.length)];
    if (!isRareSpelling(mk(p.letter, p.acc, 3))) add(p);
  }
  return set.slice(0, 6).sort((a, b) => a.letter - b.letter || a.acc - b.acc);
}

// Tonleiter über den ganzen Tonumfang, beginnend beim tiefsten Grundton im Bereich
function degreeNote(tonic, ivs7, k, startOct) {
  const [L, A] = tonic;
  const letter = (L + k) % 7;
  const wrap = Math.floor((L + k) / 7);
  const target = NAT_PC[L] + A + ivs7[k % 7] + 12 * Math.floor(k / 7);
  return mk(letter, target - (NAT_PC[letter] + 12 * wrap), startOct + wrap);
}
function scaleTones(tonic, ivs7, lo, hi) {
  const out = [];
  for (let k = 0; k < 80; k++) { const n = degreeNote(tonic, ivs7, k, 0); const m = midiOf(n); if (m > hi) break; if (m >= lo) out.push(n); }
  return out;
}
// Ganzer Tonumfang: einmal aufwärts vom tiefsten Leiterton ab E bis f′ (gut erreichbar, auch für Nicht-Profis)
export const FULL_LO = 40, FULL_HI = 65;
export function scaleFull(tonic, mode, form, lo = FULL_LO, hi = FULL_HI) {
  const up = mode === 'dur' ? IV.dur : form === 'melodisch' ? IV.melodisch : IV[form];
  return scaleTones(tonic, up, lo, hi);
}
