// Speicherung im Browser (localStorage)
const KEY = 'zugweise.v1';

const DEFAULT = {
  settings: { sound: true, volume: 0.7, theme: 'auto', roundLen: 20, level: 1, unlocked: 1, passes: 0, showNames: true, keepAwake: true },
  scale: { mode: 'dur', key: 0, form: 'natuerlich', oct: 'auto', accMode: 'sig' },
  stats: { notes: {}, days: {}, rounds: 0, best: {} },
};

function merge(a, b) {
  const out = Array.isArray(a) ? [...a] : { ...a };
  for (const k in b) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') out[k] = merge(a[k], b[k]);
    else out[k] = b[k];
  }
  return out;
}

export const store = (() => {
  let data;
  try { data = merge(DEFAULT, JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch { data = JSON.parse(JSON.stringify(DEFAULT)); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* voll */ } };
  return {
    get data() { return data; },
    save,
    reset() { data.stats = JSON.parse(JSON.stringify(DEFAULT.stats)); save(); },
    resetAll() { data = JSON.parse(JSON.stringify(DEFAULT)); save(); },
  };
})();

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function record(area, noteId, ok) {
  const s = store.data.stats;
  s.notes[area] ??= {};
  const e = (s.notes[area][noteId] ??= { n: 0, ok: 0 });
  e.n++; if (ok) e.ok++;
  const day = (s.days[today()] ??= { n: 0, ok: 0 });
  day.n++; if (ok) day.ok++;
  store.save();
}

export function noteStat(area, noteId) {
  return store.data.stats.notes[area]?.[noteId] || { n: 0, ok: 0 };
}

export function streak() {
  const days = store.data.stats.days;
  let n = 0; const d = new Date();
  const key = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (!days[key(d)]) d.setDate(d.getDate() - 1);
  while (days[key(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
