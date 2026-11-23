// SVG-Notensatz im Bassschlüssel
import { diaOf, keyAccFor, positionsOf, POS_COLORS, noteName } from './music.js';

const NS = 'http://www.w3.org/2000/svg';
const SP = 10;           // Linienabstand
const HALF = SP / 2;
const MID = 22;          // d (D3) = Mittellinie

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

export function clefPath(g, x, yF) {
  // Bassschlüssel: Punkt + Bogen + zwei Punkte, F-Linie bei yF
  el('path', {
    d: `M ${x + 2} ${yF} C ${x + 1} ${yF - 9} ${x + 9} ${yF - 12.5} ${x + 14} ${yF - 12.5} C ${x + 22} ${yF - 12.5} ${x + 26} ${yF - 6} ${x + 26} ${yF + 1} C ${x + 26} ${yF + 14} ${x + 12} ${yF + 24} ${x - 1} ${yF + 30}`,
    fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linecap': 'round',
  }, g);
  el('circle', { cx: x + 4.5, cy: yF + 0.5, r: 4.2, fill: 'currentColor' }, g);
  el('circle', { cx: x + 32, cy: yF - 5, r: 2, fill: 'currentColor' }, g);
  el('circle', { cx: x + 32, cy: yF + 5, r: 2, fill: 'currentColor' }, g);
}

export function drawAccidental(g, acc, x, y, natural = false) {
  const s = { stroke: 'currentColor', 'stroke-linecap': 'butt', fill: 'none' };
  if (natural || acc === 0) {
    el('line', { x1: x - 3, y1: y - 11, x2: x - 3, y2: y + 5, ...s, 'stroke-width': 1.3 }, g);
    el('line', { x1: x + 3, y1: y - 5, x2: x + 3, y2: y + 11, ...s, 'stroke-width': 1.3 }, g);
    el('line', { x1: x - 3, y1: y - 1.5, x2: x + 3, y2: y - 3.5, ...s, 'stroke-width': 3 }, g);
    el('line', { x1: x - 3, y1: y + 3.5, x2: x + 3, y2: y + 1.5, ...s, 'stroke-width': 3 }, g);
    return;
  }
  if (acc === 1) {
    el('line', { x1: x - 2.2, y1: y - 10, x2: x - 2.2, y2: y + 11, ...s, 'stroke-width': 1.3 }, g);
    el('line', { x1: x + 2.2, y1: y - 11, x2: x + 2.2, y2: y + 10, ...s, 'stroke-width': 1.3 }, g);
    el('line', { x1: x - 5.5, y1: y - 2, x2: x + 5.5, y2: y - 4.5, ...s, 'stroke-width': 2.8 }, g);
    el('line', { x1: x - 5.5, y1: y + 4.5, x2: x + 5.5, y2: y + 2, ...s, 'stroke-width': 2.8 }, g);
    return;
  }
  if (acc === 2) {
    el('path', { d: `M ${x - 4} ${y - 4} L ${x + 4} ${y + 4} M ${x + 4} ${y - 4} L ${x - 4} ${y + 4}`, ...s, 'stroke-width': 2 }, g);
    return;
  }
  const flat = (fx) => {
    el('line', { x1: fx - 3, y1: y - 15, x2: fx - 3, y2: y + 4.5, ...s, 'stroke-width': 1.4 }, g);
    el('path', { d: `M ${fx - 3} ${y + 4.5} C ${fx + 7} ${y - 0.5} ${fx + 6} ${y - 8} ${fx - 3} ${y - 2}`, ...s, 'stroke-width': 1.9 }, g);
  };
  if (acc === -1) flat(x);
  else { flat(x - 4); flat(x + 4); }
}

export function drawKeySig(g, sig, x, yOf) {
  if (!sig || !sig.count) return 0;
  const SH = { 3: 24, 0: 21, 4: 25, 1: 22, 5: 19, 2: 23, 6: 20 };
  const FL = { 6: 20, 2: 23, 5: 19, 1: 22, 4: 18, 0: 21, 3: 17 };
  sig.letters.forEach((l, i) => {
    const d = sig.type > 0 ? SH[l] : FL[l];
    drawAccidental(g, sig.type, x + 6 + i * 10, yOf(d));
  });
  return sig.count * 10 + 6;
}

function noteHead(g, x, y, color) {
  el('ellipse', { cx: x, cy: y, rx: 6.4, ry: 4.6, fill: color || 'currentColor', transform: `rotate(-20 ${x} ${y})` }, g);
}

/**
 * items: Array von { note, color?, label?, sub?, pos?:bool } oder { bar:true }
 * opts: { sig, accMode:'sig'|'each', spacing, onTap(i), selected, names:bool, zug:bool, minWidth, padTop, padBottom, fixedRange:[lo,hi] }
 */
export function renderStaff(items, opts = {}) {
  const spacing = opts.spacing || 48;
  const sig = opts.accMode === 'sig' ? opts.sig : null;
  const showNames = !!opts.names, showZug = !!opts.zug;
  const dias = items.filter(i => i.note).map(i => diaOf(i.note));
  const stemUp = (d) => !opts.noStem && d < MID;
  let maxD = Math.max(27, ...dias.map(d => d + (stemUp(d) ? 7 : 1)), ...(opts.fixedRange ? [opts.fixedRange[1]] : []));
  let minD = Math.min(17, ...dias.map(d => d - (!opts.noStem && !stemUp(d) ? 7 : 1)), ...(opts.fixedRange ? [opts.fixedRange[0]] : []));
  const top = 8;
  const yOf = (d) => top + (maxD - d) * HALF;
  const staffBottom = yOf(minD);
  const labelY = staffBottom + 2;
  const labelH = (showNames ? 22 : 0) + (showZug ? 30 : 0) + (items.some(i => i.sub) ? 20 : 0);
  const height = labelY + labelH + 6;
  const clefW = 44;
  const g0 = document.createElementNS(NS, 'svg');
  const startX = clefW + (sig ? sig.count * 10 + 10 : 0) + 22;
  let width = startX + items.length * spacing + 10;
  if (opts.minWidth) width = Math.max(width, opts.minWidth);
  g0.setAttribute('viewBox', `0 0 ${width} ${height}`);
  g0.setAttribute('class', 'staff');
  g0.style.width = opts.fit ? '100%' : `${width * (opts.scale || 1)}px`;
  if (!opts.fit) g0.style.height = `${height * (opts.scale || 1)}px`;
  g0.setAttribute('role', 'img');

  const lines = el('g', { class: 'staff-lines' }, g0);
  for (let d = 18; d <= 26; d += 2) el('line', { x1: 4, y1: yOf(d), x2: width - 4, y2: yOf(d) }, lines);
  el('line', { x1: width - 4, y1: yOf(18), x2: width - 4, y2: yOf(26), class: 'barline' }, lines);
  const ink = el('g', { class: 'ink' }, g0);
  clefPath(ink, 10, yOf(24));
  if (sig) drawKeySig(ink, sig, clefW, yOf);

  items.forEach((it, i) => {
    const x = startX + i * spacing + spacing / 2 - 10;
    if (it.bar) { el('line', { x1: x, y1: yOf(18), x2: x, y2: yOf(26), class: 'barline' }, lines); return; }
    const n = it.note, d = diaOf(n), y = yOf(d);
    const grp = el('g', { class: 'note' + (opts.selected === i ? ' sel' : '') + (it.cls ? ' ' + it.cls : ''), 'data-i': i }, ink);
    if (opts.onTap) {
      el('rect', { x: x - spacing / 2 + 2, y: 0, width: spacing - 4, height, class: 'hit', rx: 8 }, grp);
      grp.addEventListener('click', () => opts.onTap(i));
    }
    // Hilfslinien
    for (let k = 16; k >= d; k -= 2) el('line', { x1: x - 11, y1: yOf(k), x2: x + 11, y2: yOf(k), class: 'ledger' }, grp);
    for (let k = 28; k <= d; k += 2) el('line', { x1: x - 11, y1: yOf(k), x2: x + 11, y2: yOf(k), class: 'ledger' }, grp);
    // Vorzeichen
    const kAcc = sig ? keyAccFor(sig, n.letter) : 0;
    if (n.acc !== kAcc) drawAccidental(grp, n.acc, x - 17 - (Math.abs(n.acc) === 2 && n.acc < 0 ? 4 : 0), y, n.acc === 0);
    else if (it.forceNatural && n.acc === 0) drawAccidental(grp, 0, x - 17, y, true);
    noteHead(grp, x, y, it.color);
    if (!opts.noStem) {
      if (d >= MID) el('line', { x1: x - 5.9, y1: y + 1.5, x2: x - 5.9, y2: y + 34, class: 'stem', stroke: it.color || 'currentColor' }, grp);
      else el('line', { x1: x + 5.9, y1: y - 1.5, x2: x + 5.9, y2: y - 34, class: 'stem', stroke: it.color || 'currentColor' }, grp);
    }
    let ly = labelY;
    if (showNames) {
      const t = el('text', { x, y: ly + 14, class: 'lbl-name', 'text-anchor': 'middle' }, grp);
      t.textContent = it.label ?? noteName(n);
      ly += 22;
    }
    if (showZug) {
      const ps = positionsOf(n);
      if (ps) {
        el('circle', { cx: x, cy: ly + 12, r: 11, fill: POS_COLORS[ps[0]] }, grp);
        const t = el('text', { x, y: ly + 16.5, class: 'lbl-pos', 'text-anchor': 'middle' }, grp);
        t.textContent = ps[0];
        if (ps.length > 1) {
          const a = el('text', { x: x + 14, y: ly + 9, class: 'lbl-alt' }, grp);
          a.textContent = ps.slice(1).join('/');
        }
      }
    }
    if (it.sub) {
      const t = el('text', { x, y: ly + 14, class: 'lbl-sub', 'text-anchor': 'middle' }, grp);
      t.textContent = it.sub;
    }
  });
  return g0;
}

// ---------- Posaunengrafik ----------
export function renderTrombone(pos) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 400 120');
  svg.setAttribute('class', 'trombone');
  svg.setAttribute('role', 'img');
  const brass = 'var(--brass)', brassD = 'var(--brass-d)';
  // Positionsskala
  const scale = el('g', { class: 'tb-scale' }, svg);
  for (let p = 1; p <= 7; p++) {
    const x = 271 + (p - 1) * 16;
    el('circle', { cx: x, cy: 14, r: 7, fill: POS_COLORS[p], class: 'tb-dot' + (p === pos ? ' on' : ''), 'data-p': p }, scale);
    const t = el('text', { x, y: 18, 'text-anchor': 'middle', class: 'tb-num' }, scale); t.textContent = p;
  }
  // Schallstück (Becher zeigt wie der Zug nach vorn)
  el('path', { d: 'M 60 84 C 46 84 46 62 60 62 L 30 62 C 14 62 14 40 30 40 L 186 40', fill: 'none', stroke: brassD, 'stroke-width': 5, 'stroke-linejoin': 'round' }, svg);
  el('path', { d: 'M 186 36 C 206 36 216 22 236 10 L 236 70 C 216 58 206 44 186 44 Z', fill: brass, stroke: brass, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
  el('line', { x1: 120, y1: 40, x2: 120, y2: 84, stroke: brassD, 'stroke-width': 3 }, svg);
  // Innenzug (fest)
  el('line', { x1: 60, y1: 84, x2: 236, y2: 84, stroke: brassD, 'stroke-width': 4 }, svg);
  el('line', { x1: 44, y1: 104, x2: 236, y2: 104, stroke: brassD, 'stroke-width': 4 }, svg);
  el('line', { x1: 98, y1: 84, x2: 98, y2: 104, stroke: brassD, 'stroke-width': 4 }, svg);
  // Mundstück
  el('path', { d: 'M 46 101 L 34 101 L 26 96 L 26 112 L 34 107 L 46 107 Z', fill: brassD }, svg);
  // Außenzug (beweglich)
  const slide = el('g', { class: 'tb-slide' }, svg);
  el('line', { x1: 130, y1: 84, x2: 262, y2: 84, stroke: brass, 'stroke-width': 7, 'stroke-linecap': 'round' }, slide);
  el('line', { x1: 130, y1: 104, x2: 262, y2: 104, stroke: brass, 'stroke-width': 7, 'stroke-linecap': 'round' }, slide);
  el('path', { d: 'M 262 84 C 280 84 280 104 262 104', fill: 'none', stroke: brass, 'stroke-width': 7 }, slide);
  el('line', { x1: 170, y1: 84, x2: 170, y2: 104, stroke: brass, 'stroke-width': 4 }, slide);
  svg.setPos = (p) => {
    slide.style.transform = `translateX(${(p - 1) * 16}px)`;
    scale.querySelectorAll('.tb-dot').forEach(d => d.classList.toggle('on', +d.dataset.p === p));
  };
  slide.style.transform = 'translateX(0px)';
  requestAnimationFrame(() => requestAnimationFrame(() => svg.setPos(pos || 1)));
  return svg;
}
