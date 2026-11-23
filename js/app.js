import * as M from './music.js';
import { renderStaff, renderTrombone } from './notation.js';
import * as A from './audio.js';
import * as P from './pitch.js';
import { store, record, noteStat, streak, today } from './store.js';

const S = () => store.data.settings;
// null/false-Kinder beim Einfügen ignorieren
for (const fn of ['append', 'replaceChildren']) {
  const orig = Element.prototype[fn];
  Element.prototype[fn] = function (...k) { return orig.apply(this, k.filter(x => x != null && x !== false)); };
}
const $app = document.getElementById('app');

// ---------- Hilfsfunktionen ----------
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') for (const sk in v) e.style.setProperty(sk.startsWith('--') ? sk : sk.replace(/[A-Z]/g, c => '-' + c.toLowerCase()), v[sk]);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : document.createTextNode(c));
  return e;
}
const ICON = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  prev: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  wave: '<path d="M3 18c3 0 3-12 6-12s3 12 6 12 3-8 6-8"/>',
  swap: '<path d="M4 8h14l-4-4M20 16H6l4 4"/>',
  shuffle: '<path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
};
function icon(name, size = 22) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICON[name]; return s;
}
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function play(n) { if (S().sound && n) A.playMidi(M.midiOf(n)); }
function toast(msg, ms = 2600) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}
function seg(options, value, onChange, cls = '') {
  const w = h('div', { class: 'seg ' + cls, role: 'tablist' });
  for (const [v, label] of options) {
    w.append(h('button', { class: v === value ? 'on' : '', role: 'tab', 'aria-selected': v === value ? 'true' : 'false', onclick: () => onChange(v) }, label));
  }
  return w;
}
function chip(label, on, onclick, extra = '') { return h('button', { class: 'chip ' + (on ? 'on ' : '') + extra, onclick }, label); }
function posBadge(p, small = false, alt = false) {
  return h('span', { class: 'pos' + (small ? ' sm' : '') + (alt ? ' alt' : ''), style: { background: M.POS_COLORS[p] } }, String(p));
}

function level() { return M.levelById(S().level); }

// ---------- Bereiche ----------
const MODES = {
  noten: { n: 1, short: 'Noten', title: 'Noten lernen', sub: 'Note sehen – Tonnamen finden', zug: false, askName: true, color: 'var(--blue)' },
  notenZug: { n: 2, short: 'Noten + Zug', title: 'Noten + Zug lernen', sub: 'Tonname und Zugposition', zug: true, askName: true, color: 'var(--brass)' },
  spiel: { n: 4, short: 'Spielen', title: 'Spiel die Note', sub: 'Mit der Posaune spielen – Mikrofon hört zu', zug: true, askName: false, color: M.POS_COLORS[5] },
  zug: { n: 3, short: 'Zug', title: 'Nur Zug lernen', sub: 'Note sehen – Zug finden', zug: true, askName: false, color: M.POS_COLORS[4] },
};
// Tonart-Kennung: 'stamm' | 'mix' | 'dur-<i>' | 'moll-<i>'
function tonartLabel(t) {
  if (t === 'stamm') return 'Ohne Vorzeichen';
  if (t === 'mix') return 'Gemischte Vorzeichen';
  const [mode, i] = t.split('-');
  const k = (mode === 'dur' ? M.MAJOR_KEYS : M.MINOR_KEYS)[+i];
  return k ? M.keyName(k, mode) : 'Ohne Vorzeichen';
}

// ---------- Header ----------
function header(title, back = true, extra) {
  const backHref = typeof back === 'string' ? back : '#/';
  const soundBtn = h('button', { class: 'iconbtn', 'aria-label': 'Ton an/aus', onclick: () => { S().sound = !S().sound; store.save(); soundBtn.replaceChildren(icon(S().sound ? 'sound' : 'mute')); if (S().sound) A.unlock(); } }, icon(S().sound ? 'sound' : 'mute'));
  return h('header', { class: 'top' },
    back ? h('button', { class: 'iconbtn', 'aria-label': 'Zurück', onclick: () => go(backHref) }, icon('back')) : h('div', { class: 'logo' }, logo()),
    h('h1', {}, title),
    extra || null,
    soundBtn,
  );
}
function logo() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 32 32'); s.setAttribute('width', 30); s.setAttribute('height', 30);
  s.innerHTML = '<rect width="32" height="32" rx="8" fill="var(--brass)"/><path d="M6 12h14M6 20h20c3 0 3-8 0-8" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="9" cy="12" r="2.4" fill="#fff"/>';
  return s;
}

// ---------- Router ----------
let cleanup = null;
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function route() {
  if (cleanup) { try { cleanup(); } catch { } cleanup = null; }
  const hsh = location.hash || '#/';
  const [, a, b, c] = hsh.split('/');
  window.scrollTo(0, 0);
  $app.replaceChildren();
  if (!a) return viewHome();
  if (a === 'learn' && b === 'spiel' && c) return viewMic(c);
  if (a === 'learn' && MODES[b]) return c ? viewLearn(b, c) : viewTonart(b);
  if (a === 'natur') return viewNatur();
  if (a === 'reverse') return viewReverse();
  if (a === 'tempo') return viewTempo();
  if (a === 'tuner') return viewMic(null);
  if (a === 'stats') return viewStats();
  if (a === 'settings') return viewSettings();
  viewHome();
}
window.addEventListener('hashchange', route);

// ---------- Startseite ----------
function viewHome() {
  const lv = level(), st = S();
  const prog = st.level === st.unlocked && st.unlocked < 5
    ? h('div', { class: 'lvprog' }, h('span', {}, 'Nächste Stufe: '), ...[0, 1, 2].map(i => h('i', { class: i < st.passes ? 'on' : '' })), h('span', { class: 'muted' }, ` ${st.passes}/3 Runden mit ≥ 90 %`))
    : null;
  const tile = (href, num, title, sub, color, ic) => h('a', { class: 'tile', href, style: { '--c': color } },
    h('div', { class: 'tnum' }, num != null ? String(num) : icon(ic, 20)),
    h('div', {}, h('div', { class: 'tt' }, title), h('div', { class: 'ts' }, sub)));
  $app.append(
    header('Zugweise', false),
    h('main', {},
      h('section', { class: 'hero card' },
        h('div', { class: 'hero-l' },
          h('div', { class: 'muted small' }, 'Deine Lernstufe'),
          h('div', { class: 'big' }, `Stufe ${lv.id}`, h('span', { class: 'range' }, lv.label)),
          prog,
        ),
        h('div', { class: 'hero-r' }, h('div', { class: 'streak' }, h('b', {}, String(streak())), h('span', {}, 'Tage am Stück'))),
      ),
      h('h2', { class: 'sect' }, 'Lernen'),
      h('div', { class: 'tiles' },
        ...Object.entries(MODES).sort((a, b) => a[1].n - b[1].n).map(([k, m]) => tile(`#/learn/${k}`, m.n, m.title, m.sub, m.color)),
      ),
      h('h2', { class: 'sect' }, 'Mehr üben'),
      h('div', { class: 'tiles' },
        tile('#/natur', null, 'Naturtonreihe', 'Welche Töne liegen auf einem Zug?', M.POS_COLORS[3], 'wave'),
        tile('#/reverse', null, 'Zug-Abfrage', 'Zug gegeben – passende Noten finden', M.POS_COLORS[4], 'swap'),
        tile('#/tempo', null, 'Tempo-Runde', '20 Noten auf Zeit', M.POS_COLORS[6], 'timer'),
        tile('#/tuner', null, 'Stimmgerät', 'Zeigt, ob dein Ton sauber ist', M.POS_COLORS[5], 'mic'),
      ),
      h('div', { class: 'tiles two' },
        tile('#/stats', null, 'Statistik', 'Trefferquote und Problemnoten', M.POS_COLORS[1], 'chart'),
        tile('#/settings', null, 'Einstellungen', 'Ton, Stufe, Darstellung', 'var(--muted)', 'gear'),
      ),
    ),
  );
}

// ---------- Tonleiter-Auswahl ----------
function scaleState() { return store.data.scale; }
function currentScale() {
  const sc = scaleState(), lv = level();
  const keys = sc.mode === 'dur' ? M.MAJOR_KEYS : M.MINOR_KEYS;
  const tonic = keys[Math.min(sc.key, keys.length - 1)];
  const form = sc.mode === 'dur' ? 'dur' : sc.form;
  const octs = M.scaleOctaves(tonic, sc.mode, form, lv.lo, lv.hi);
  let oct = sc.oct;
  if (oct !== 'all' && !octs.includes(oct)) oct = octs.length ? octs[0] : 'all';
  const sig = M.keySignature(tonic, sc.mode);
  const notes = oct === 'all' ? M.scaleToneRange(tonic, sc.mode, form, lv.lo, lv.hi) : M.scaleNotes(tonic, sc.mode, form, oct);
  const pool = M.scaleToneRange(tonic, sc.mode, form, lv.lo, lv.hi);
  // Antwortauswahl in Leiter-Reihenfolge
  const order = [];
  for (const n of M.scaleNotes(tonic, sc.mode, form, 3)) if (!n.bar && !order.some(o => M.samePcName(o, n))) order.push({ letter: n.letter, acc: n.acc });
  const choices = order.sort((a, b) => ((a.letter - tonic[0] + 7) % 7) - ((b.letter - tonic[0] + 7) % 7) || a.acc - b.acc);
  return { tonic, form, octs, oct, sig, notes, pool, choices, name: M.keyName(tonic, sc.mode) + (sc.mode === 'moll' ? ` (${M.MOLL_FORMS.find(f => f[0] === form)[1]})` : '') };
}

function scalePicker(onChange) {
  const sc = scaleState();
  const cur = currentScale();
  const set = (k, v) => { sc[k] = v; store.save(); onChange(); };
  return h('div', { class: 'card picker' },
    sc.mode === 'moll' ? h('div', { class: 'prow' }, h('span', { class: 'plabel' }, 'Moll-Form'), seg(M.MOLL_FORMS, sc.form, v => set('form', v), 'small')) : null,
    h('div', { class: 'prow' }, h('span', { class: 'plabel' }, 'Lage'),
      h('div', { class: 'chips' },
        ...cur.octs.map(o => chip(`ab ${M.noteName(M.mk(cur.tonic[0], cur.tonic[1], o))}`, cur.oct === o, () => set('oct', o), 'sm')),
        chip('Ganzer Tonumfang', cur.oct === 'all', () => set('oct', 'all'), 'sm'))),
    h('div', { class: 'prow' }, h('span', { class: 'plabel' }, 'Vorzeichen'), seg([['sig', 'Vorzeichnung'], ['each', 'Vor jeder Note']], sc.accMode, v => set('accMode', v), 'small')),
  );
}

// ---------- Tonart-Auswahl ----------
function viewTonart(mode) {
  const m = MODES[mode];
  const last = store.data.lastTonart?.[mode];
  const main = h('main');
  $app.append(header(m.title), main);
  const goT = (t) => go(`#/learn/${mode}/${t}`);
  const keyChip = (k, i, md) => {
    const sig = M.keySignature(k, md);
    const nm = M.pcName(M.mk(k[0], k[1], 3));
    const t = `${md}-${i}`;
    return chip(h('span', {}, md === 'dur' ? nm : nm.toLowerCase(), h('small', {}, sig.count ? `${sig.count}${sig.type > 0 ? '♯' : '♭'}` : '–')), t === last, () => goT(t));
  };
  const big = (t, title, sub) => h('button', { class: 'tile wide' + (t === last ? ' on' : ''), onclick: () => goT(t) },
    h('div', {}, h('div', { class: 'tt' }, title), h('div', { class: 'ts' }, sub)));
  main.append(
    h('p', { class: 'hint' }, 'Welche Tonart möchtest du lernen?'),
    big('stamm', 'Ohne Vorzeichen', `Stammtöne C D E F G A H · Stufe ${level().id} (${level().label})`),
    h('div', { class: 'card' }, h('div', { class: 'ctitle' }, 'Dur'), h('div', { class: 'chips keys' }, ...M.MAJOR_KEYS.map((k, i) => keyChip(k, i, 'dur')))),
    h('div', { class: 'card' }, h('div', { class: 'ctitle' }, 'Moll'), h('div', { class: 'chips keys' }, ...M.MINOR_KEYS.map((k, i) => keyChip(k, i, 'moll')))),
    big('mix', 'Gemischte Vorzeichen', '♯ und ♭ bunt gemischt, auch enharmonisch'),
  );
}

// ---------- Bereich: Anschauen / Abfragen ----------
function applyTonart(tonart) {
  if (tonart === 'stamm' || tonart === 'mix') return;
  const [md, i] = tonart.split('-');
  const sc = scaleState();
  if (sc.mode !== md || sc.key !== +i) { sc.mode = md; sc.key = +i; sc.oct = 'auto'; store.save(); }
}
function tonartPool(tonart) {
  const lv = level();
  if (tonart === 'stamm') return { pool: M.naturalsInRange(lv.lo, lv.hi).map(n => ({ note: n, w: 1 })), sig: null, accMode: 'each' };
  if (tonart === 'mix') return { pool: M.mixedPool(lv.lo, lv.hi), sig: null, accMode: 'each' };
  applyTonart(tonart);
  const c = currentScale();
  return { pool: c.pool.map(n => ({ note: n, w: 1 })), sig: c.sig, accMode: scaleState().accMode };
}
function viewLearn(mode, tonart) {
  const area = { ...MODES[mode] };
  area.kind = tonart === 'stamm' ? 'natural' : tonart === 'mix' ? 'mixed' : 'scale';
  if (area.kind === 'scale') {
    const [md, i] = tonart.split('-');
    const sc = scaleState();
    if (sc.mode !== md || sc.key !== +i) { sc.mode = md; sc.key = +i; sc.oct = 'auto'; }
  }
  (store.data.lastTonart ??= {})[mode] = tonart; store.save();
  const key = mode;
  let tab = sessionStorage.getItem('tab.' + key) || 'look';
  const backTo = `#/learn/${mode}`;
  let mixSet = null;
  const main = h('main');
  $app.append(header(`${area.short} · ${tonart === 'mix' ? 'Gemischt' : tonart === 'stamm' ? 'Stammtöne' : tonartLabel(tonart)}`, backTo), main);

  function render() {
    main.replaceChildren();
    main.append(seg([['look', 'Anschauen'], ['quiz', 'Abfragen']], tab, v => { tab = v; sessionStorage.setItem('tab.' + key, v); render(); }, 'big'));
    if (area.kind === 'scale') main.append(scalePicker(render));
    if (tab === 'look') renderLook(); else renderQuizStart();
  }

  function source() {
    const lv = level();
    if (area.kind === 'natural') {
      const notes = M.naturalsInRange(lv.lo, lv.hi);
      return { items: notes.map(n => ({ note: n })), pool: notes.map(n => ({ note: n, w: 1 })), choices: [0, 1, 2, 3, 4, 5, 6].map(l => ({ letter: l, acc: 0 })), sig: null, accMode: 'each', title: `Stammtöne · Stufe ${lv.id} (${lv.label})` };
    }
    if (area.kind === 'scale') {
      const c = currentScale();
      return { items: c.notes.map(n => n.bar ? { bar: true } : { note: n }), pool: c.pool.map(n => ({ note: n, w: 1 })), choices: c.choices, sig: c.sig, accMode: scaleState().accMode, title: c.name };
    }
    const pool = M.mixedPool(lv.lo, lv.hi);
    if (!mixSet) mixSet = weightedSample(pool, 12).sort((a, b) => M.midiOf(a) - M.midiOf(b));
    return { items: mixSet.map(n => ({ note: n })), pool, choices: null, sig: null, accMode: 'each', title: `Gemischte Vorzeichen · Stufe ${lv.id}` };
  }

  function renderLook() {
    const src = source();
    let sel = -1;
    let showNames = area.askName ? S().showNames : false, showZug = area.zug;
    const staffWrap = h('div', { class: 'staffscroll' });
    const detail = h('div', { class: 'detail' });
    const noteIdx = src.items.map((it, i) => it.note ? i : -1).filter(i => i >= 0);
    const draw = () => {
      const fit = src.items.length <= 10;
      staffWrap.replaceChildren(renderStaff(src.items, { sig: src.sig, accMode: src.accMode, names: showNames, zug: showZug, selected: sel, onTap: select, fit, scale: 1.15 }));
    };
    function select(i) {
      sel = i; draw();
      const n = src.items[i].note;
      detail.replaceChildren(detailCard(n, area.zug, src, () => step(-1), () => step(1)));
      play(n);
      const el = staffWrap.querySelector(`.note[data-i="${i}"]`);
      if (el) { const r = el.getBoundingClientRect(), w = staffWrap.getBoundingClientRect(); if (r.left < w.left || r.right > w.right) staffWrap.scrollBy({ left: r.left - w.left - w.width / 2, behavior: 'smooth' }); }
    }
    function step(d) {
      let k = noteIdx.indexOf(sel); k = k < 0 ? 0 : (k + d + noteIdx.length) % noteIdx.length; select(noteIdx[k]);
    }
    const toggles = h('div', { class: 'toggles' },
      toggle('Namen', showNames, v => { showNames = v; if (area.askName) { S().showNames = v; store.save(); } draw(); }),
      area.zug ? toggle('Zug', showZug, v => { showZug = v; draw(); }) : null,
      h('div', { class: 'grow' }),
      area.kind === 'mixed' ? h('button', { class: 'btn ghost', onclick: () => { mixSet = null; render(); } }, icon('shuffle', 18), 'Neu mischen') : null,
      h('button', { class: 'btn ghost', onclick: () => { A.unlock(); if (S().sound) A.playSequence(src.items.filter(i => i.note).map(i => M.midiOf(i.note))); } }, icon('play', 18), 'Alle anhören'),
    );
    main.append(
      h('div', { class: 'card' }, h('div', { class: 'ctitle' }, src.title), staffWrap, toggles),
      h('p', { class: 'hint' }, 'Tippe eine Note an, um sie groß zu sehen und zu hören.'),
      detail,
    );
    draw();
  }

  function renderQuizStart() {
    const src = source();
    const len = S().roundLen;
    const last = store.data.stats.last?.[key + '/' + tonart];
    main.append(h('div', { class: 'card start' },
      h('div', { class: 'ctitle' }, src.title),
      h('p', {}, !area.askName ? 'Du siehst eine Note und wählst den Zug.' : area.zug ? 'Du siehst eine Note und wählst zuerst den Tonnamen, dann den Zug.' : 'Du siehst eine Note und wählst den Tonnamen.'),
      h('p', { class: 'muted small' }, `${len} Fragen pro Runde. Noten, die du oft falsch hast, kommen häufiger dran.`),
      last ? h('p', { class: 'muted small' }, `Letzte Runde: ${last.ok}/${last.n} richtig (${Math.round(last.ok / last.n * 100)} %)`) : null,
      h('button', { class: 'btn primary wide', onclick: () => { A.unlock(); runQuiz(main, { key, area, src, len, onExit: render, lastKey: key + '/' + tonart }); } }, 'Runde starten'),
    ));
  }

  render();
}

function toggle(label, on, cb) {
  const b = h('button', { class: 'tog' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false' }, h('i'), label);
  b.onclick = () => { on = !on; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); cb(on); };
  return b;
}

function weightedSample(pool, k) {
  const out = []; const used = new Set();
  let guard = 0;
  while (out.length < k && guard++ < 2000) {
    const n = weightedPick(pool);
    const id = M.idOf(n);
    if (used.has(id) || used.has('m' + M.midiOf(n))) continue;
    used.add(id); used.add('m' + M.midiOf(n)); out.push(n);
  }
  return out;
}
function weightedPick(pool) {
  const tot = pool.reduce((s, p) => s + p.w, 0);
  let r = Math.random() * tot;
  for (const p of pool) { r -= p.w; if (r <= 0) return p.note; }
  return pool[pool.length - 1].note;
}

function detailCard(n, zug, src, onPrev, onNext) {
  const ps = M.positionsOf(n);
  const big = renderStaff([{ note: n }], { sig: src?.sig, accMode: src?.accMode || 'each', fit: true, spacing: 70 });
  const card = h('div', { class: 'card detailcard' },
    h('div', { class: 'dgrid' },
      h('div', { class: 'dstaff' }, big),
      h('div', { class: 'dinfo' },
        h('div', { class: 'dname' }, M.noteName(n)),
        h('div', { class: 'muted small' }, M.octaveLabel(n)),
        zug && ps ? h('div', { class: 'dpos' }, posBadge(ps[0]), h('div', {}, h('div', {}, `Zug ${ps[0]}`), ps.length > 1 ? h('div', { class: 'muted small' }, 'auch: ', ...ps.slice(1).map(p => posBadge(p, true, true))) : null)) : null,
      ),
    ),
    zug && ps ? renderTrombone(ps[0]) : null,
    h('div', { class: 'drow' },
      h('button', { class: 'iconbtn big', 'aria-label': 'Vorherige Note', onclick: onPrev }, icon('prev')),
      h('button', { class: 'btn primary', onclick: () => { A.unlock(); A.playMidi(M.midiOf(n)); } }, icon('play', 18), 'Anhören'),
      h('button', { class: 'iconbtn big', 'aria-label': 'Nächste Note', onclick: onNext }, icon('next')),
    ),
  );
  return card;
}

// ---------- Abfrage ----------
function adaptivePool(areaKey, pool) {
  return pool.map(p => {
    const s = noteStat(areaKey, M.idOf(p.note));
    const err = s.n ? 1 - s.ok / s.n : 0.5;
    return { note: p.note, w: p.w * (0.6 + err * 3 + (s.n < 2 ? 0.6 : 0)) };
  });
}

let quizTimer = null;
function runQuiz(main, { key, area, src, len, onExit: exit0, only, lastKey }) {
  const onExit = () => { clearTimeout(quizTimer); exit0(); };
  cleanup = () => clearTimeout(quizTimer);
  let i = 0, ok = 0; const missed = []; let lastId = null;
  const pool = only ? only.map(n => ({ note: n, w: 1 })) : adaptivePool(key, src.pool);
  const q = h('div', { class: 'quiz' });
  main.replaceChildren(q);

  function next() {
    if (i >= len) return finish();
    let n, guard = 0;
    do { n = weightedPick(pool); } while (M.idOf(n) === lastId && pool.length > 1 && guard++ < 20);
    lastId = M.idOf(n);
    ask(n);
  }

  function ask(n) {
    const ps = M.positionsOf(n);
    let chosenName = null, chosenPos = null;
    const choices = src.choices || M.mixedChoices(n);
    const staff = renderStaff([{ note: n }], { sig: src.sig, accMode: src.accMode, fit: true, spacing: 80 });
    const fb = h('div', { class: 'feedback' });
    const nameRow = area.askName ? h('div', { class: 'answers names' + (choices.length > 7 ? ' many' : '') }) : null;
    const posRow = area.zug ? h('div', { class: 'answers zug' + (area.askName ? '' : ' ready') }) : null;
    const tb = area.zug ? h('div', { class: 'tbwrap' }) : null;
    if (nameRow) choices.forEach(c => nameRow.append(h('button', { class: 'ans', onclick: (e) => { chosenName = c; nameRow.querySelectorAll('.ans').forEach(b => b.classList.remove('picked')); e.currentTarget.classList.add('picked'); if (area.zug) posRow.classList.add('ready'); else evaluate(); } }, M.pcName(M.mk(c.letter, c.acc, 3)))));
    if (area.zug) for (let p = 1; p <= 7; p++) posRow.append(h('button', { class: 'ans posbtn', style: { '--pc': M.POS_COLORS[p] }, onclick: (e) => { if (area.askName && !chosenName) { toast('Wähle zuerst den Tonnamen.'); return; } chosenPos = p; e.currentTarget.classList.add('picked'); evaluate(); } }, String(p)));

    q.replaceChildren(
      h('div', { class: 'qtop' },
        h('button', { class: 'btn ghost', onclick: onExit }, 'Beenden'),
        h('div', { class: 'qprog' }, h('i', { style: { width: `${(i / len) * 100}%` } })),
        h('div', { class: 'qcount' }, `${i + 1}/${len}`)),
      h('div', { class: 'card qcard' }, staff, tb),
      nameRow ? h('div', { class: 'qlabel' }, 'Tonname') : null, nameRow,
      area.zug ? h('div', { class: 'qlabel' }, 'Zug') : null, posRow,
      fb,
    );

    function evaluate() {
      const nameOk = !area.askName || M.samePcName(chosenName, n);
      const posOk = !area.zug || (ps && ps.includes(chosenPos));
      const good = nameOk && posOk;
      record(key, M.idOf(n), good);
      q.querySelectorAll('.ans').forEach(b => b.disabled = true);
      q.querySelectorAll('.answers').forEach(r => r.classList.add('done'));
      if (nameRow) [...nameRow.children].forEach((b, k) => { if (M.samePcName(choices[k], n)) b.classList.add('right'); else if (b.classList.contains('picked')) b.classList.add('wrong'); });
      if (posRow) [...posRow.children].forEach((b, k) => { const p = k + 1; if (ps && ps[0] === p) b.classList.add('right'); else if (ps && ps.includes(p)) b.classList.add('rightalt'); if (b.classList.contains('picked') && !(ps && ps.includes(p))) b.classList.add('wrong'); });
      if (tb && ps) { tb.replaceChildren(renderTrombone(1)); setTimeout(() => tb.firstChild?.setPos(ps[0]), 30); }
      play(n);
      i++;
      if (good) {
        ok++;
        const altMsg = area.zug && chosenPos !== ps[0] ? ` – Hauptzug ist ${ps[0]}` : '';
        fb.replaceChildren(h('div', { class: 'fb ok' }, icon('check', 20), `Richtig: ${M.noteName(n)}${area.zug ? `, Zug ${chosenPos}` : ''}${altMsg}`));
        if (area.zug) {
          const WAIT = 5000;
          fb.append(h('div', { class: 'waitbar' }, h('i', { style: { animationDuration: WAIT + 'ms' } })),
            h('button', { class: 'btn primary wide', onclick: () => { clearTimeout(quizTimer); next(); } }, 'Weiter'));
          quizTimer = setTimeout(next, WAIT);
        } else quizTimer = setTimeout(next, 900);
      } else {
        missed.push(n);
        fb.replaceChildren(
          h('div', { class: 'fb bad' }, `Richtig wäre: ${M.noteName(n)}${area.zug && ps ? `, Zug ${ps[0]}${ps.length > 1 ? ` (oder ${ps.slice(1).join('/')})` : ''}` : ''}`),
          h('button', { class: 'btn primary wide', onclick: next }, 'Weiter'));
      }
    }
  }

  function finish() {
    const pct = Math.round(ok / len * 100);
    store.data.stats.rounds++;
    (store.data.stats.last ??= {})[lastKey || key] = { ok, n: len, date: today() };
    let lvMsg = null;
    const st = S();
    if (!only && pct >= 90 && st.level === st.unlocked && st.unlocked < 5) {
      st.passes++;
      if (st.passes >= 3) { st.unlocked++; st.level = st.unlocked; st.passes = 0; lvMsg = `Stufe ${st.level} freigeschaltet: ${M.levelById(st.level).label}`; }
      else lvMsg = `${st.passes}/3 Runden für die nächste Stufe geschafft`;
    }
    store.save();
    const uniq = [];
    for (const n of missed) if (!uniq.some(u => M.sameNote(u, n))) uniq.push(n);
    q.replaceChildren(
      h('div', { class: 'card result' },
        h('div', { class: 'ring', style: { '--p': pct, '--rc': pct >= 90 ? 'var(--ok)' : pct >= 70 ? 'var(--brass)' : 'var(--bad)' } }, h('b', {}, `${pct} %`)),
        h('div', { class: 'rtext' }, h('div', { class: 'big' }, `${ok} von ${len} richtig`), h('div', { class: 'muted' }, pct >= 90 ? 'Sehr gut!' : pct >= 70 ? 'Gut – weiter so.' : 'Dranbleiben, das wird.')),
      ),
      lvMsg ? h('div', { class: 'card lvmsg' }, lvMsg) : null,
      uniq.length ? h('div', { class: 'card' }, h('div', { class: 'ctitle' }, 'Diese Noten waren falsch'),
        h('div', { class: 'staffscroll' }, renderStaff(uniq.map(n => ({ note: n })), { sig: src.sig, accMode: src.accMode, names: true, zug: area.zug, scale: 1.15, onTap: (k) => play(uniq[k]) }))) : null,
      h('div', { class: 'rbtns' },
        uniq.length ? h('button', { class: 'btn', onclick: () => runQuiz(main, { key, area, src, len: Math.max(5, uniq.length * 2), onExit: exit0, only: uniq, lastKey }) }, 'Fehler üben') : null,
        h('button', { class: 'btn primary', onclick: () => runQuiz(main, { key, area, src, len, onExit: exit0, lastKey }) }, 'Neue Runde'),
        h('button', { class: 'btn ghost', onclick: onExit }, 'Fertig'),
      ),
    );
    if (lvMsg && lvMsg.startsWith('Stufe')) toast(lvMsg, 4000);
  }

  next();
}

// ---------- Naturtonreihe ----------
function viewNatur() {
  let pos = +(sessionStorage.getItem('natur.pos') || 1);
  const main = h('main');
  $app.append(header('Naturtonreihe'), main);
  function render() {
    const series = M.naturalSeries(pos);
    const items = series.slice(1).map(s => ({ note: s.note, sub: s.flat7 ? 'zu tief' : `${s.partial}.`, color: s.flat7 ? 'var(--muted)' : null, cls: s.flat7 ? 'dim' : '' }));
    const pedal = series[0];
    const tb = renderTrombone(pos);
    main.replaceChildren(
      h('p', { class: 'hint' }, 'Auf jedem Zug spielst du mehrere Töne – nur durch die Lippenspannung, wie bei der Trompete ohne Ventil. Die Zahl unter der Note ist der Teilton.'),
      h('div', { class: 'zugpick' }, ...[1, 2, 3, 4, 5, 6, 7].map(p => h('button', { class: 'zp' + (p === pos ? ' on' : ''), style: { '--pc': M.POS_COLORS[p] }, onclick: () => { pos = p; sessionStorage.setItem('natur.pos', p); render(); } }, String(p)))),
      h('div', { class: 'card' }, h('div', { class: 'ctitle' }, `Zug ${pos}`), tb,
        h('div', { class: 'staffscroll' }, renderStaff(items, { names: true, fit: true, spacing: 42, onTap: (k) => play(items[k].note) })),
        h('div', { class: 'toggles' },
          h('span', { class: 'muted small' }, `Pedalton (1.): ${M.noteName(pedal.note)} – sehr tief, für später`),
          h('div', { class: 'grow' }),
          h('button', { class: 'btn ghost', onclick: () => { A.unlock(); if (S().sound) A.playSequence(series.slice(1).map(s => s.midi), 0.5); } }, icon('play', 18), 'Alle anhören'))),
      h('p', { class: 'hint' }, 'Der 7. Teilton klingt zu tief und wird meist nicht benutzt. Ab dem 8. Teilton liegen die Töne sehr eng – darum gibt es dort viele Alternativzüge.'),
    );
  }
  render();
}

// ---------- Zug-Abfrage (umgekehrt) ----------
function viewReverse() {
  const main = h('main');
  $app.append(header('Zug-Abfrage'), main);
  const ROUNDS = 10;
  let r = 0, ok = 0;
  function start() {
    main.replaceChildren(h('div', { class: 'card start' },
      h('div', { class: 'ctitle' }, `Zug-Abfrage · Stufe ${level().id}`),
      h('p', {}, 'Du bekommst einen Zug genannt. Tippe alle Noten an, die du auf diesem Zug spielen kannst – auch mit Alternativzug.'),
      h('p', { class: 'muted small' }, `${ROUNDS} Aufgaben.`),
      h('button', { class: 'btn primary wide', onclick: () => { r = 0; ok = 0; task(); } }, 'Starten')));
  }
  function task() {
    if (r >= ROUNDS) return done();
    const lv = level();
    const all = [];
    for (let m = lv.lo; m <= lv.hi; m++) {
      const sp = M.spellingsOf(m).filter(n => !M.isRareSpelling(n));
      all.push(pick(sp));
    }
    let zug, right;
    do { zug = 1 + Math.floor(Math.random() * 7); right = all.filter(n => M.positionsOf(n)?.includes(zug)); } while (!right.length);
    const nRight = Math.min(right.length, 1 + Math.floor(Math.random() * 3));
    const chosenRight = shuffle(right).slice(0, nRight);
    const wrong = shuffle(all.filter(n => !M.positionsOf(n)?.includes(zug))).slice(0, 6 - nRight);
    const cards = shuffle([...chosenRight, ...wrong]);
    const sel = new Set();
    const grid = h('div', { class: 'revgrid' });
    cards.forEach((n, k) => {
      const c = h('button', { class: 'revcard', onclick: () => { if (grid.dataset.done) { play(n); return; } sel.has(k) ? sel.delete(k) : sel.add(k); c.classList.toggle('on'); play(n); } },
        renderStaff([{ note: n }], { fit: true, spacing: 64, noStem: false }));
      grid.append(c);
    });
    const fb = h('div', { class: 'feedback' });
    main.replaceChildren(
      h('div', { class: 'qtop' }, h('button', { class: 'btn ghost', onclick: start }, 'Beenden'), h('div', { class: 'qprog' }, h('i', { style: { width: `${r / ROUNDS * 100}%` } })), h('div', { class: 'qcount' }, `${r + 1}/${ROUNDS}`)),
      h('div', { class: 'card revhead' }, posBadge(zug), h('div', {}, h('div', { class: 'big' }, `Zug ${zug}`), h('div', { class: 'muted small' }, 'Welche Noten liegen auf diesem Zug?'))),
      grid,
      h('button', { class: 'btn primary wide', id: 'chk', onclick: check }, 'Prüfen'),
      fb,
    );
    function check() {
      grid.dataset.done = '1';
      let allOk = true;
      cards.forEach((n, k) => {
        const isR = M.positionsOf(n)?.includes(zug);
        const c = grid.children[k];
        const ps = M.positionsOf(n);
        c.append(h('div', { class: 'revlbl' }, M.noteName(n), ' ', ...ps.map((p, j) => posBadge(p, true, j > 0))));
        if (isR && sel.has(k)) c.classList.add('right');
        else if (isR) { c.classList.add('missed'); allOk = false; }
        else if (sel.has(k)) { c.classList.add('wrong'); allOk = false; }
        record('reverse', M.idOf(n), isR === sel.has(k));
      });
      r++; if (allOk) ok++;
      main.querySelector('#chk').remove();
      fb.replaceChildren(h('div', { class: 'fb ' + (allOk ? 'ok' : 'bad') }, allOk ? 'Alles richtig!' : 'Nicht ganz – die richtigen Noten sind grün markiert.'), h('button', { class: 'btn primary wide', onclick: task }, 'Weiter'));
    }
  }
  function done() {
    store.data.stats.rounds++; store.save();
    main.replaceChildren(h('div', { class: 'card result' },
      h('div', { class: 'ring', style: { '--p': Math.round(ok / ROUNDS * 100), '--rc': 'var(--brass)' } }, h('b', {}, `${ok}/${ROUNDS}`)),
      h('div', { class: 'rtext' }, h('div', { class: 'big' }, `${ok} von ${ROUNDS} Aufgaben komplett richtig`))),
      h('div', { class: 'rbtns' }, h('button', { class: 'btn primary', onclick: () => { r = 0; ok = 0; task(); } }, 'Nochmal'), h('button', { class: 'btn ghost', onclick: () => go('#/') }, 'Fertig')));
  }
  start();
}

// ---------- Tempo-Runde ----------
function viewTempo() {
  const main = h('main');
  $app.append(header('Tempo-Runde'), main);
  let variant = sessionStorage.getItem('tempo.v') || 'stamm';
  let withZug = sessionStorage.getItem('tempo.z') === '1';
  const N = 20, PEN = 3000;
  const bestKey = () => `${variant}${withZug ? '+zug' : ''}@${level().id}`;
  function fmt(ms) { return (ms / 1000).toFixed(1).replace('.', ',') + ' s'; }
  function start() {
    const best = store.data.stats.best[bestKey()];
    main.replaceChildren(h('div', { class: 'card start' },
      h('div', { class: 'ctitle' }, `Tempo-Runde · Stufe ${level().id}`),
      h('div', { class: 'prow' }, seg([['stamm', 'Stammtöne'], ['mix', 'Gemischt']], variant, v => { variant = v; sessionStorage.setItem('tempo.v', v); start(); })),
      h('div', { class: 'prow' }, toggle('Mit Zug', withZug, v => { withZug = v; sessionStorage.setItem('tempo.z', v ? '1' : '0'); start(); })),
      h('p', {}, `${N} Noten so schnell wie möglich. Jeder Fehler kostet 3 Sekunden.`),
      h('p', { class: 'muted' }, best ? `Bestzeit: ${fmt(best)}` : 'Noch keine Bestzeit.'),
      h('button', { class: 'btn primary wide', onclick: () => countdown(3) }, 'Los geht’s')));
  }
  function countdown(k) {
    main.replaceChildren(h('div', { class: 'countdown' }, String(k)));
    if (k > 1) setTimeout(() => countdown(k - 1), 700); else setTimeout(run, 700);
  }
  function run() {
    const lv = level();
    const pool = variant === 'stamm' ? M.naturalsInRange(lv.lo, lv.hi).map(n => ({ note: n, w: 1 })) : M.mixedPool(lv.lo, lv.hi);
    let i = 0, errs = 0, last = null; const t0 = performance.now();
    const clock = h('div', { class: 'clock' }, '0,0 s');
    const iv = setInterval(() => { clock.textContent = fmt(performance.now() - t0 + errs * PEN); }, 100);
    cleanup = () => clearInterval(iv);
    const box = h('div');
    main.replaceChildren(h('div', { class: 'qtop' }, h('button', { class: 'btn ghost', onclick: () => { clearInterval(iv); start(); } }, 'Abbrechen'), clock, h('div', { class: 'qcount', id: 'tc' }, `1/${N}`)), box);
    function q() {
      if (i >= N) return end();
      let n; do { n = weightedPick(pool); } while (last && M.sameNote(n, last) && pool.length > 1); last = n;
      main.querySelector('#tc').textContent = `${i + 1}/${N}`;
      const choices = variant === 'stamm' ? [0, 1, 2, 3, 4, 5, 6].map(l => ({ letter: l, acc: 0 })) : M.mixedChoices(n);
      let chosen = null;
      const ps = M.positionsOf(n);
      const names = h('div', { class: 'answers names' });
      const zr = withZug ? h('div', { class: 'answers zug ready' }) : null;
      const finishQ = (good) => {
        record('tempo', M.idOf(n), good);
        if (!good) { errs++; box.classList.add('shake'); setTimeout(() => box.classList.remove('shake'), 300); }
        else box.classList.add('flashok'), setTimeout(() => box.classList.remove('flashok'), 200);
        i++; q();
      };
      choices.forEach(c => names.append(h('button', { class: 'ans', onclick: (e) => {
        chosen = c;
        if (!withZug) return finishQ(M.samePcName(c, n));
        names.querySelectorAll('.ans').forEach(b => b.classList.remove('picked')); e.currentTarget.classList.add('picked');
      } }, M.pcName(M.mk(c.letter, c.acc, 3)))));
      if (withZug) for (let p = 1; p <= 7; p++) zr.append(h('button', { class: 'ans posbtn', style: { '--pc': M.POS_COLORS[p] }, onclick: () => { if (!chosen) return; finishQ(M.samePcName(chosen, n) && ps.includes(p)); } }, String(p)));
      box.replaceChildren(h('div', { class: 'card qcard' }, renderStaff([{ note: n }], { fit: true, spacing: 80 })), names, zr);
    }
    function end() {
      clearInterval(iv);
      const total = performance.now() - t0 + errs * PEN;
      const best = store.data.stats.best[bestKey()];
      const isBest = !best || total < best;
      if (isBest) store.data.stats.best[bestKey()] = Math.round(total);
      store.data.stats.rounds++; store.save();
      main.replaceChildren(h('div', { class: 'card result' },
        h('div', { class: 'rtext' }, h('div', { class: 'muted' }, 'Deine Zeit'), h('div', { class: 'huge' }, fmt(total)),
          h('div', { class: 'muted' }, `${errs} Fehler${errs ? ` (+${errs * 3} s)` : ''}`),
          isBest ? h('div', { class: 'badge' }, 'Neue Bestzeit!') : h('div', { class: 'muted small' }, `Bestzeit: ${fmt(best)}`))),
        h('div', { class: 'rbtns' }, h('button', { class: 'btn primary', onclick: () => countdown(3) }, 'Nochmal'), h('button', { class: 'btn ghost', onclick: start }, 'Fertig')));
    }
    q();
  }
  start();
}

// ---------- Mikrofon ----------
function viewMic(tonart) {
  const main = h('main');
  if (tonart) (store.data.lastTonart ??= {}).spiel = tonart, store.save();
  const tShort = !tonart ? '' : tonart === 'mix' ? 'Gemischt' : tonart === 'stamm' ? 'Stammtöne' : tonartLabel(tonart);
  $app.append(header(tonart ? `Spielen · ${tShort}` : 'Stimmgerät', tonart ? '#/learn/spiel' : true), main);
  let mode = tonart ? 'play' : 'tuner';
  const src = tonart ? tonartPool(tonart) : null;
  let showZug = false;
  let target = null, holdStart = 0, hits = 0, tries = 0, locked = false;
  const nameEl = h('div', { class: 'mname' }, '–');
  const centEl = h('div', { class: 'mcent' }, '');
  const needle = h('div', { class: 'needle' });
  const gauge = h('div', { class: 'gauge' }, h('div', { class: 'gscale' }, h('span', {}, '−50'), h('span', {}, '0'), h('span', {}, '+50')), h('div', { class: 'gzone' }), needle);
  const targetBox = h('div', { class: 'card qcard' });
  const fb = h('div', { class: 'feedback' });
  const startBtn = h('button', { class: 'btn primary wide' }, icon('mic', 18), 'Mikrofon starten');
  const scoreEl = h('div', { class: 'muted small' });
  cleanup = () => P.stop();

  function newTarget() {
    const pool = src.pool;
    let n, guard = 0; do { n = weightedPick(pool); } while (target && M.midiOf(n) === M.midiOf(target) && pool.length > 1 && guard++ < 30);
    target = n; holdStart = 0; locked = false;
    drawTarget();
    fb.replaceChildren();
  }
  function drawTarget() {
    if (mode !== 'play' || !target) { targetBox.replaceChildren(); return; }
    const ps = M.positionsOf(target);
    targetBox.replaceChildren(renderStaff([{ note: target }], { sig: src.sig, accMode: src.accMode, fit: true, spacing: 80 }),
      h('div', { class: 'toggles' },
        toggle('Zug zeigen', showZug, v => { showZug = v; drawTarget(); }),
        showZug && ps ? h('span', {}, ...ps.map((p, j) => posBadge(p, true, j > 0))) : null,
        h('div', { class: 'grow' }),
        h('button', { class: 'btn ghost', onclick: () => { A.unlock(); A.playMidi(M.midiOf(target)); } }, icon('play', 16), 'Vorspielen'),
        h('button', { class: 'btn ghost', onclick: () => { tries++; record('mic', M.idOf(target), false); upd(); newTarget(); } }, 'Überspringen')));
  }
  function upd() { scoreEl.textContent = mode === 'play' ? `Getroffen: ${hits} von ${tries}` : ''; }

  function onPitch({ freq, clarity }) {
    if (!freq || clarity < 0.8) { nameEl.classList.add('idle'); needle.style.opacity = 0.25; holdStart = 0; return; }
    nameEl.classList.remove('idle'); needle.style.opacity = 1;
    const mf = P.freqToMidi(freq);
    const m = Math.round(mf); const cents = Math.round((mf - m) * 100);
    let shown = M.spellDefault(m);
    if (mode === 'play' && target && M.midiOf(target) === m) shown = target;
    nameEl.textContent = M.noteName(shown);
    centEl.textContent = `${cents > 0 ? '+' : ''}${cents} Cent · ${freq.toFixed(1).replace('.', ',')} Hz`;
    needle.style.left = `${50 + Math.max(-50, Math.min(50, cents))}%`;
    needle.classList.toggle('good', Math.abs(cents) <= 10);
    if (mode === 'play' && target && !locked) {
      if (m === M.midiOf(target) && Math.abs(cents) <= 40) {
        if (!holdStart) holdStart = performance.now();
        if (performance.now() - holdStart > 450) {
          locked = true; hits++; tries++; record('mic', M.idOf(target), true); upd();
          fb.replaceChildren(h('div', { class: 'fb ok' }, icon('check', 20), `Getroffen: ${M.noteName(target)}`));
          setTimeout(newTarget, 1100);
        }
      } else holdStart = 0;
    }
  }

  startBtn.onclick = async () => {
    if (P.isRunning()) { P.stop(); startBtn.replaceChildren(icon('mic', 18), 'Mikrofon starten'); startBtn.classList.add('primary'); return; }
    try {
      await P.start(onPitch);
      startBtn.replaceChildren('Mikrofon stoppen'); startBtn.classList.remove('primary');
    } catch (e) {
      fb.replaceChildren(h('div', { class: 'fb bad' }, 'Kein Zugriff auf das Mikrofon. Bitte im Browser erlauben (die App muss über https laufen).'));
    }
  };

  function render() {
    main.replaceChildren(
      mode === 'play' ? h('p', { class: 'hint' }, 'Spiel die angezeigte Note. Wenn du sie kurz sauber hältst, kommt die nächste.') : h('p', { class: 'hint' }, 'Spiel einen Ton – die Nadel zeigt, ob du zu hoch oder zu tief bist.'),
      mode === 'play' ? targetBox : null,
      h('div', { class: 'card meter' }, nameEl, gauge, centEl, scoreEl),
      startBtn, fb,
      tonart && tonart !== 'stamm' && tonart !== 'mix' ? scalePicker(route) : null,
    );
    if (mode === 'play' && !target) newTarget(); else drawTarget();
    upd();
  }
  nameEl.classList.add('idle');
  render();
}

// ---------- Statistik ----------
function viewStats() {
  const main = h('main');
  $app.append(header('Statistik'), main);
  const st = store.data.stats;
  // Aggregation pro Notenschreibweise über alle Bereiche
  const agg = {};
  for (const a in st.notes) for (const id in st.notes[a]) { const e = st.notes[a][id]; (agg[id] ??= { n: 0, ok: 0 }); agg[id].n += e.n; agg[id].ok += e.ok; }
  const totN = Object.values(agg).reduce((s, e) => s + e.n, 0), totOk = Object.values(agg).reduce((s, e) => s + e.ok, 0);
  const lv = level();
  const color = (e) => !e || !e.n ? 'var(--muted2)' : e.ok / e.n >= 0.9 ? 'var(--ok)' : e.ok / e.n >= 0.7 ? 'var(--brass)' : 'var(--bad)';
  // Notenkarte pro Tonhöhe
  const byMidi = {};
  for (const id in agg) { const m = M.midiOf(M.fromId(id)); (byMidi[m] ??= { n: 0, ok: 0 }); byMidi[m].n += agg[id].n; byMidi[m].ok += agg[id].ok; }
  const map = h('div', { class: 'notemap' });
  for (let m = 40; m <= 77; m++) {
    const e = byMidi[m];
    map.append(h('div', { class: 'nm' + (m < lv.lo || m > lv.hi ? ' out' : ''), style: { '--nc': color(e) }, title: e ? `${e.ok}/${e.n}` : 'noch nicht geübt' },
      h('b', {}, M.noteName(M.spellDefault(m))), h('span', {}, e && e.n ? `${Math.round(e.ok / e.n * 100)} %` : '–')));
  }
  // Problemnoten
  const problems = Object.entries(agg).filter(([, e]) => e.n >= 2 && e.ok / e.n < 0.85).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).slice(0, 10);
  // Verlauf 14 Tage
  const bars = h('div', { class: 'bars' });
  const days = []; const d = new Date(); d.setDate(d.getDate() - 13);
  for (let k = 0; k < 14; k++) { const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; days.push([key, st.days[key], d.getDate()]); d.setDate(d.getDate() + 1); }
  const maxN = Math.max(10, ...days.map(x => x[1]?.n || 0));
  for (const [, e, day] of days) bars.append(h('div', { class: 'bar' }, h('i', { style: { height: `${(e?.n || 0) / maxN * 100}%`, background: e ? color(e) : 'transparent' } }), h('span', {}, String(day))));
  const best = Object.entries(st.best);
  main.append(
    h('div', { class: 'metrics' },
      metric('Antworten', totN), metric('Richtig', totN ? `${Math.round(totOk / totN * 100)} %` : '–'),
      metric('Runden', st.rounds), metric('Tage am Stück', streak())),
    h('div', { class: 'card' }, h('div', { class: 'ctitle' }, 'Letzte 14 Tage'), bars),
    h('div', { class: 'card' }, h('div', { class: 'ctitle' }, 'Trefferquote pro Ton'),
      h('div', { class: 'legend' }, leg('var(--ok)', '≥ 90 %'), leg('var(--brass)', '70–89 %'), leg('var(--bad)', 'unter 70 %'), leg('var(--muted2)', 'noch nicht geübt')), map),
    h('div', { class: 'card' }, h('div', { class: 'ctitle' }, 'Problemnoten'),
      problems.length ? h('div', { class: 'staffscroll' }, renderStaff(problems.map(([id, e]) => ({ note: M.fromId(id), color: color(e), sub: `${Math.round(e.ok / e.n * 100)} %` })), { names: true, scale: 1.15, onTap: (k) => play(M.fromId(problems[k][0])) }))
        : h('p', { class: 'muted' }, 'Noch keine Problemnoten – sehr gut. (Eine Note zählt ab 2 Versuchen unter 85 %.)')),
    best.length ? h('div', { class: 'card' }, h('div', { class: 'ctitle' }, 'Bestzeiten Tempo-Runde'),
      ...best.map(([k, ms]) => { const [v, lvl] = k.split('@'); return h('div', { class: 'brow' }, h('span', {}, `${v.startsWith('mix') ? 'Gemischt' : 'Stammtöne'}${v.includes('+zug') ? ' + Zug' : ''} · Stufe ${lvl}`), h('b', {}, (ms / 1000).toFixed(1).replace('.', ',') + ' s')); })) : null,
  );
  function metric(l, v) { return h('div', { class: 'metric' }, h('span', {}, l), h('b', {}, String(v))); }
  function leg(c, t) { return h('span', {}, h('i', { style: { background: c } }), t); }
}

// ---------- Einstellungen ----------
function viewSettings() {
  const main = h('main');
  $app.append(header('Einstellungen'), main);
  function render() {
    const st = S();
    main.replaceChildren(
      h('div', { class: 'card set' },
        h('div', { class: 'srow' }, h('span', {}, 'Ton'), toggle(st.sound ? 'An' : 'Aus', st.sound, v => { st.sound = v; store.save(); render(); })),
        h('div', { class: 'srow' }, h('span', {}, 'Lautstärke'), h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: st.volume, oninput: (e) => { st.volume = +e.target.value; A.setVolume(st.volume); store.save(); }, onchange: () => { A.unlock(); A.playMidi(53); } })),
        h('div', { class: 'srow' }, h('span', {}, 'Darstellung'), seg([['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']], st.theme, v => { st.theme = v; store.save(); applyTheme(); render(); }, 'small')),
        h('div', { class: 'srow' }, h('span', {}, 'Fragen pro Runde'), seg([[10, '10'], [20, '20'], [30, '30']], st.roundLen, v => { st.roundLen = v; store.save(); render(); }, 'small')),
      ),
      h('div', { class: 'card set' },
        h('div', { class: 'ctitle' }, 'Lernstufe'),
        h('p', { class: 'muted small' }, 'Eine neue Stufe wird frei, wenn du auf der höchsten freien Stufe 3 Runden mit mindestens 90 % schaffst.'),
        h('div', { class: 'levels' }, ...M.LEVELS.map(l => h('button', { class: 'lv' + (l.id === st.level ? ' on' : '') + (l.id > st.unlocked ? ' locked' : ''), onclick: () => { if (l.id > st.unlocked) { toast('Diese Stufe ist noch gesperrt.'); return; } st.level = l.id; store.save(); render(); } }, h('b', {}, `Stufe ${l.id}`), h('span', {}, l.label)))),
        st.unlocked < 5 ? h('button', { class: 'btn ghost', onclick: () => { st.unlocked = 5; store.save(); render(); } }, 'Alle Stufen freischalten') : null,
      ),
      h('div', { class: 'card set' },
        h('div', { class: 'ctitle' }, 'Daten'),
        h('p', { class: 'muted small' }, 'Alle Daten bleiben nur auf diesem Gerät.'),
        h('button', { class: 'btn danger', onclick: () => { if (confirm('Statistik wirklich löschen?')) { store.reset(); toast('Statistik gelöscht'); } } }, 'Statistik zurücksetzen')),
      h('p', { class: 'muted small center' }, 'Zugweise · Version 1.2 · Tenorposaune in B, Bassschlüssel'),
    );
  }
  render();
}

// ---------- Start ----------
function applyTheme() {
  const t = S().theme;
  document.documentElement.dataset.theme = t === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
applyTheme();
A.setVolume(S().volume);
document.addEventListener('pointerdown', () => A.unlock(), { once: true });
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { });
}
