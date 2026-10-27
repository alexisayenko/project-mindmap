const KEY = 'mindmap.v0';
const MAX_LABEL = 16;
const DEFAULT_NAME = 'New concept';
const FONT = '16px system-ui, sans-serif';
const LABEL_FONT = '14px system-ui, sans-serif';
const DIRS = ['none', 'backward', 'forward', 'both'];
const ARROW_L = 12, ARROW_W = 5;
const ZOOM_MODE = 'geometric'; // 'geometric': radius x k, text constant screen size; 'constant': radius and text ~k^0.25 clamped
const SIZE_EXP = 0.25, SIZE_MIN = 0.8, SIZE_MAX = 1.4;
const LOD_NAMES = 0.45, LOD_DESC = 1.8;
const DESC_CHARS = 60, DESC_LINE = 20, DESC_FONT = 11;
const NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('canvas');
const world = document.createElementNS(NS, 'g');
svg.appendChild(world);
const K_MIN = 0.2, K_MAX = 4;
const FOLLOW = { stiffness: 90, damping: 8, stepMs: 8, restDist: 0.02, restSpeed: 0.05 }; // spring feel of locked followers, same as audioplayer genres map v2
const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const springs = new Map();
let springRaf = 0, springLast = 0, springAcc = 0;
const $ = id => document.getElementById(id);
const ctx = document.createElement('canvas').getContext('2d');

let model = load();
let activated = new Set();
let relFrom = null;
let lastScreen = null;
let editing = null;
let lastTap = { t: 0, x: 0, y: 0 };

function load() {
  try {
    const m = JSON.parse(localStorage.getItem(KEY));
    if (m && m.version === 0 && Array.isArray(m.entities) && Array.isArray(m.relations)) {
      const v = m.view;
      m.view = v && [v.x, v.y, v.k].every(Number.isFinite) && v.k >= K_MIN && v.k <= K_MAX ? { x: v.x, y: v.y, k: v.k } : { x: 0, y: 0, k: 1 };
      for (const e of m.entities) if (typeof e.description !== 'string') e.description = '';
      for (const r of m.relations) {
        if (typeof r.name !== 'string') r.name = '';
        if (!DIRS.includes(r.dir)) r.dir = 'none';
        r.locked = r.locked === true;
      }
      return m;
    }
  } catch (e) {}
  return { version: 0, entities: [], relations: [], view: { x: 0, y: 0, k: 1 } };
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(model)); } catch (e) {}
}

const uid = () => Math.random().toString(36).slice(2, 10);
const entity = id => model.entities.find(e => e.id === id);

function shown(name) {
  const c = Array.from(name);
  return c.length > MAX_LABEL ? c.slice(0, MAX_LABEL - 1).join('') + '…' : name;
}

const sizeFactor = () => Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.pow(model.view.k, SIZE_EXP)));
const zf = () => ZOOM_MODE === 'geometric' ? 1 : sizeFactor() / model.view.k;
const tf = () => ZOOM_MODE === 'geometric' ? 1 / model.view.k : sizeFactor() / model.view.k;

function radius(e) {
  ctx.font = FONT;
  return Math.max(28, ctx.measureText(shown(e.name)).width / 2 + 14) * zf();
}

function snippet(text) {
  const t = Array.from(text.replace(/\s+/g, ' ').trim());
  const cut = t.length > DESC_CHARS ? t.slice(0, DESC_CHARS - 1).join('').trimEnd() + '…' : t.join('');
  const lines = [];
  let cur = '';
  for (const w of cut.split(' ')) {
    if (cur && Array.from(cur + ' ' + w).length > DESC_LINE) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

function lockIcon(locked, size) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 16 16');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('aria-hidden', 'true');
  s.appendChild(lockShapes(locked));
  return s;
}
function lockShapes(locked) {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'lockshape');
  el('path', { d: locked ? 'M5 7V5a3 3 0 0 1 6 0v2' : 'M5 7V5a3 3 0 0 1 5.6-1.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g);
  el('rect', { x: 3, y: 7, width: 10, height: 7, rx: 1.5, fill: 'currentColor' }, g);
  return g;
}

function lockedGroup(seeds) {
  const out = new Set(seeds);
  const queue = [...seeds];
  while (queue.length) {
    const id = queue.pop();
    for (const r of model.relations) {
      if (!r.locked) continue;
      const o = r.from === id ? r.to : r.to === id ? r.from : null;
      if (o && !out.has(o) && entity(o)) { out.add(o); queue.push(o); }
    }
  }
  return out;
}

function snapSprings() {
  for (const [id, sp] of springs) { const n = entity(id); if (n) { n.x = sp.tx; n.y = sp.ty; } }
  springs.clear();
  if (springRaf) { cancelAnimationFrame(springRaf); springRaf = 0; }
  springLast = springAcc = 0;
}

function springFrame(now) {
  springRaf = 0;
  const dt = Math.min(100, springLast ? now - springLast : FOLLOW.stepMs);
  springLast = now;
  springAcc += dt;
  const h = FOLLOW.stepMs / 1000;
  while (springAcc >= FOLLOW.stepMs) {
    springAcc -= FOLLOW.stepMs;
    for (const [id, sp] of springs) {
      if (!entity(id)) { springs.delete(id); continue; }
      sp.vx += (FOLLOW.stiffness * (sp.tx - sp.x) - FOLLOW.damping * sp.vx) * h;
      sp.vy += (FOLLOW.stiffness * (sp.ty - sp.y) - FOLLOW.damping * sp.vy) * h;
      sp.x += sp.vx * h; sp.y += sp.vy * h;
    }
  }
  let rested = false;
  for (const [id, sp] of springs) {
    const n = entity(id);
    if (!n) { springs.delete(id); continue; }
    n.x = sp.x; n.y = sp.y;
    if (Math.hypot(sp.tx - sp.x, sp.ty - sp.y) < FOLLOW.restDist && Math.hypot(sp.vx, sp.vy) < FOLLOW.restSpeed) {
      n.x = sp.tx; n.y = sp.ty;
      springs.delete(id);
      rested = true;
    }
  }
  render();
  if (springs.size) springRaf = requestAnimationFrame(springFrame);
  else { springLast = springAcc = 0; if (rested) save(); }
}

function startSprings() {
  if (!springRaf && springs.size) springRaf = requestAnimationFrame(springFrame);
}

function el(name, attrs, parent) {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

function render() {
  world.replaceChildren();
  applyView();
  const Z = tf(), A = 1 / model.view.k, showNames = model.view.k >= LOD_NAMES, showDesc = model.view.k >= LOD_DESC;
  for (const r of model.relations) {
    const a = entity(r.from), b = entity(r.to);
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const ra = radius(a), rb = radius(b);
    if (d <= ra + rb) continue;
    const g = el('g', { class: 'edge' + (activated.has(r.id) ? ' activated' : ''), 'data-id': r.id }, world);
    const p = [a.x + dx / d * ra, a.y + dy / d * ra, b.x - dx / d * rb, b.y - dy / d * rb];
    const dir = r.dir || 'none', ux = dx / d, uy = dy / d;
    const toB = dir === 'forward' || dir === 'both', toA = dir === 'backward' || dir === 'both';
    const q = [p[0] + (toA ? ux * ARROW_L * A * 0.8 : 0), p[1] + (toA ? uy * ARROW_L * A * 0.8 : 0), p[2] - (toB ? ux * ARROW_L * A * 0.8 : 0), p[3] - (toB ? uy * ARROW_L * A * 0.8 : 0)];
    for (const cls of ['hit', '']) {
      el('line', { class: cls, x1: q[0], y1: q[1], x2: q[2], y2: q[3] }, g);
    }
    const head = (x, y, sx, sy) => el('path', { class: 'arrow', d: `M${x} ${y}L${x - (sx * ARROW_L + sy * ARROW_W) * A} ${y - (sy * ARROW_L - sx * ARROW_W) * A}L${x - (sx * ARROW_L - sy * ARROW_W) * A} ${y - (sy * ARROW_L + sx * ARROW_W) * A}Z` }, g);
    if (toB) head(p[2], p[3], ux, uy);
    if (toA) head(p[0], p[1], -ux, -uy);
    if (r.locked) {
      const mx = (p[0] + p[2]) / 2, my = (p[1] + p[3]) / 2;
      const l = el('g', { class: 'locksign', transform: `translate(${mx} ${my}) scale(${Z}) translate(-6 5) scale(0.75)` }, g);
      l.appendChild(lockShapes(true));
    }
    if (showNames && r.name && !(editing && editing.e === r)) {
      ctx.font = LABEL_FONT;
      const w = ctx.measureText(r.name).width + 12, mx = (p[0] + p[2]) / 2, my = (p[1] + p[3]) / 2;
      let deg = Math.atan2(dy, dx) * 180 / Math.PI;
      if (deg > 90) deg -= 180;
      else if (deg <= -90) deg += 180;
      const l = el('g', { class: 'lbl', transform: `translate(${mx} ${my}) rotate(${deg}) scale(${Z})` }, g);
      el('rect', { class: 'pill', x: -w / 2, y: -LBL_LIFT - 11, width: w, height: 22, rx: 11 }, l);
      el('text', { class: 'label', x: 0, y: -LBL_LIFT }, l).textContent = r.name;
    }
  }
  for (const e of model.entities) {
    const g = el('g', { class: 'node' + (activated.has(e.id) ? ' activated' : ''), 'data-id': e.id }, world);
    el('circle', { cx: e.x, cy: e.y, r: radius(e) }, g);
    const t = el('text', { x: e.x, y: e.y, style: `font-size:${16 * Z}px` }, g);
    if (showNames) t.textContent = shown(e.name);
    el('title', {}, g).textContent = e.name;
    if (relFrom === e.id) g.classList.add('src');
    if (e.description && showNames && showDesc) {
      const lines = snippet(e.description), top = e.y + radius(e) + 14 * Z;
      const d = el('text', { class: 'desc', x: e.x, y: top, style: `font-size:${DESC_FONT * Z}px` }, g);
      lines.forEach((ln, i) => { const ts = el('tspan', { x: e.x, dy: i ? DESC_FONT * 1.25 * Z : 0 }, d); ts.textContent = ln; });
    } else if (e.description) el('circle', { class: 'hasdesc', cx: e.x, cy: e.y + radius(e) - 7 * A, r: 2.5 * A }, g);
    if (relFrom || activated.size !== 1 || !activated.has(e.id)) continue;
    const r = radius(e) * Math.SQRT1_2;
    const p = el('g', { class: 'plus', 'data-x': e.x + r, 'data-y': e.y + r, tabindex: 0, role: 'button', 'aria-label': 'Add relation from ' + e.name }, g);
    el('circle', { r: 10 }, p);
    el('path', { class: 'glyph', d: 'M-5 0H5M0 -5V5' }, p);
  }
  if (relFrom && !entity(relFrom)) relFrom = null;
  if (relFrom) el('line', { class: 'relline', 'data-from': relFrom, x1: 0, y1: 0, x2: 0, y2: 0 }, world);
  svg.classList.toggle('relating', !!relFrom);
  $('delete').disabled = !activated.size;
  refreshInfobox();
  applyView();
}

function refreshInfobox() {
  const box = $('infobox'), id = activated.size === 1 && !relFrom ? [...activated][0] : null;
  const e = id && entity(id), rel = id && model.relations.find(x => x.id === id);
  const item = e || rel;
  box.hidden = !item;
  if (!item) { box.dataset.id = ''; return; }
  const fresh = box.dataset.id !== id;
  box.dataset.id = id;
  $('info-type').textContent = e ? 'Concept' : 'Relation';
  if (fresh || document.activeElement !== $('info-name')) $('info-name').textContent = item.name || '';
  $('info-name').setAttribute('aria-label', e ? 'Concept name' : 'Relation name');
  $('info-text').hidden = !e;
  if (e && (fresh || document.activeElement !== $('info-text'))) $('info-text').value = e.description || '';
  const a = rel && entity(rel.from), b = rel && entity(rel.to);
  $('info-ends').hidden = !rel;
  if (rel) {
    $('info-dir').replaceChildren(dirIcon(rel.dir || 'none'));
    const lk = $('info-lock');
    lk.replaceChildren(lockIcon(!!rel.locked, 16));
    lk.title = rel.locked ? 'Unlock' : 'Lock';
    lk.setAttribute('aria-label', lk.title);
    lk.setAttribute('aria-pressed', String(!!rel.locked));
  }
  if (!rel) closeDirMenu();
  for (const [k, n] of [['from', a], ['to', b]]) {
    const btn = $('info-' + k);
    btn.textContent = n ? shown(n.name) : '?';
    if (n && shown(n.name) !== n.name) btn.title = n.name; else btn.removeAttribute('title');
  }
}

function dirIcon(dir) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 32 14');
  s.setAttribute('width', '32');
  s.setAttribute('height', '14');
  s.setAttribute('aria-hidden', 'true');
  const toB = dir === 'forward' || dir === 'both', toA = dir === 'backward' || dir === 'both';
  el('line', { x1: toA ? 9 : 2, y1: 7, x2: toB ? 23 : 30, y2: 7, stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'butt' }, s);
  if (toB) el('path', { d: 'M30 7L20 2L20 12Z', fill: 'currentColor' }, s);
  if (toA) el('path', { d: 'M2 7L12 2L12 12Z', fill: 'currentColor' }, s);
  return s;
}
const DIR_LABEL = { none: 'No direction', backward: 'To the first', forward: 'To the second', both: 'Both ways' };
function closeDirMenu() {
  $('dir-menu').hidden = true;
  $('info-dir').setAttribute('aria-expanded', 'false');
}
function openDirMenu() {
  const rel = model.relations.find(x => x.id === $('infobox').dataset.id);
  if (!rel) return;
  const menu = $('dir-menu');
  menu.replaceChildren();
  for (const v of DIRS) {
    const o = document.createElement('button');
    o.type = 'button';
    o.setAttribute('role', 'option');
    o.dataset.dir = v;
    o.setAttribute('aria-label', DIR_LABEL[v]);
    o.setAttribute('aria-selected', String(v === (rel.dir || 'none')));
    o.appendChild(dirIcon(v));
    menu.appendChild(o);
  }
  menu.hidden = false;
  $('info-dir').setAttribute('aria-expanded', 'true');
}
$('info-dir').addEventListener('click', ev => {
  ev.stopPropagation();
  if ($('dir-menu').hidden) openDirMenu(); else closeDirMenu();
});
$('info-lock').addEventListener('click', () => {
  const rel = model.relations.find(x => x.id === $('infobox').dataset.id);
  if (rel) { rel.locked = !rel.locked; changed(); }
});
$('dir-menu').addEventListener('click', ev => {
  const o = ev.target.closest('[data-dir]');
  if (!o) return;
  const rel = model.relations.find(x => x.id === $('infobox').dataset.id);
  closeDirMenu();
  $('info-dir').focus();
  if (rel) { rel.dir = o.dataset.dir; changed(); }
});
document.addEventListener('pointerdown', ev => {
  if (!$('dir-menu').hidden && !ev.target.closest('#dir-wrap')) closeDirMenu();
}, true);

function changed() { save(); render(); }

function screenPoint(ev) {
  const r = svg.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

function point(ev) {
  const s = screenPoint(ev), v = model.view;
  return { x: (s.x - v.x) / v.k, y: (s.y - v.y) / v.k };
}

function applyView() {
  const v = model.view;
  world.setAttribute('transform', `translate(${v.x} ${v.y}) scale(${v.k})`);
  $('zoom-level').textContent = Math.round(v.k * 100) + '%';
  for (const b of world.querySelectorAll('.plus')) b.setAttribute('transform', `translate(${b.dataset.x} ${b.dataset.y}) scale(${1 / v.k})`);
  updateRelLine();
  placeEditor();
}

function updateRelLine() {
  const l = world.querySelector('.relline'), a = l && entity(l.dataset.from);
  if (!a || !lastScreen) return l && l.setAttribute('visibility', 'hidden');
  const v = model.view;
  l.setAttribute('visibility', 'visible');
  l.setAttribute('x1', a.x);
  l.setAttribute('y1', a.y);
  l.setAttribute('x2', (lastScreen.x - v.x) / v.k);
  l.setAttribute('y2', (lastScreen.y - v.y) / v.k);
}

function startRelation(id, ev) {
  if (!entity(id)) return;
  finishEdit(false);
  relFrom = id;
  if (ev) lastScreen = screenPoint(ev);
  render();
}

function cancelRelation() {
  if (!relFrom) return;
  relFrom = null;
  render();
}

function placeEditor() {
  if (!editing) return;
  const box = svg.getBoundingClientRect(), v = model.view, { e, input } = editing;
  const a = e.from ? entity(e.from) : e, b = e.from ? entity(e.to) : e;
  if (!a || !b) return;
  input.style.left = box.left + v.x + (a.x + b.x) / 2 * v.k + 'px';
  input.style.top = box.top + v.y + (a.y + b.y) / 2 * v.k + 'px';
}

function zoomAt(sx, sy, k2) {
  const v = model.view;
  k2 = Math.min(K_MAX, Math.max(K_MIN, k2));
  const wx = (sx - v.x) / v.k, wy = (sy - v.y) / v.k;
  v.k = k2;
  v.x = sx - wx * k2;
  v.y = sy - wy * k2;
  render();
  save();
}

function zoomCentre(f) {
  const r = svg.getBoundingClientRect();
  zoomAt(r.width / 2, r.height / 2, model.view.k * f);
}

function addRelation(from, to) {
  if (from === to) return;
  if (model.relations.some(r => (r.from === from && r.to === to) || (r.from === to && r.to === from))) return;
  model.relations.push({ id: uid(), from, to, name: '', dir: 'none', locked: false });
}

function removeActivated() {
  if (!activated.size) return;
  model.entities = model.entities.filter(e => !activated.has(e.id));
  model.relations = model.relations.filter(r => !activated.has(r.id) && !activated.has(r.from) && !activated.has(r.to));
  activated = new Set();
  relFrom = null;
  changed();
}

const LBL_LIFT = 15;
const PLAIN = (() => {
  const d = document.createElement('div');
  d.setAttribute('contenteditable', 'plaintext-only');
  return d.contentEditable === 'plaintext-only';
})();
const oneLine = t => t.replace(/[\r\n]+/g, ' ');
function makeTextbox(el, label) {
  el.setAttribute('contenteditable', PLAIN ? 'plaintext-only' : 'true');
  el.setAttribute('role', 'textbox');
  el.setAttribute('aria-label', label);
  el.setAttribute('spellcheck', 'false');
  el.addEventListener('beforeinput', ev => {
    if (ev.inputType === 'insertParagraph' || ev.inputType === 'insertLineBreak') ev.preventDefault();
  });
  el.addEventListener('paste', ev => {
    ev.preventDefault();
    const t = oneLine((ev.clipboardData || window.clipboardData).getData('text'));
    if (!document.execCommand('insertText', false, t)) el.textContent += t;
    el.dispatchEvent(new Event('input'));
  });
  el.addEventListener('input', () => {
    if (el.children.length || /[\r\n]/.test(el.textContent)) {
      el.textContent = oneLine(el.textContent);
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }
  });
}
function selectAllText(el) {
  const r = document.createRange();
  r.selectNodeContents(el);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
}
const textOf = el => oneLine(el.textContent);

function startEdit(e, isNew) {
  finishEdit(true);
  const input = document.createElement('div');
  input.id = 'edit';
  makeTextbox(input, e.from ? 'Relation name' : 'Concept name');
  input.textContent = e.name || '';
  document.body.appendChild(input);
  editing = { e, input, isNew, done: false };
  placeEditor();
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); finishEdit(false); }
    else if (ev.key === 'Escape') finishEdit(true);
    ev.stopPropagation();
  });
  input.addEventListener('blur', () => finishEdit(false));
  input.focus();
  selectAllText(input);
}

function finishEdit(cancel) {
  if (!editing || editing.done) return;
  const { e, input } = editing;
  editing.done = true;
  editing = null;
  const name = textOf(input).trim();
  if (!cancel && (name || e.from)) e.name = name;
  input.remove();
  changed();
}

makeTextbox($('info-name'), 'Concept name');
$('info-name').addEventListener('keydown', ev => { if (ev.key === 'Enter') ev.preventDefault(); });
function infoItem() {
  const id = $('infobox').dataset.id;
  return entity(id) || model.relations.find(x => x.id === id);
}
$('info-name').addEventListener('input', () => {
  const it = infoItem();
  if (!it) return;
  it.name = textOf($('info-name'));
  changed();
});
$('info-name').addEventListener('blur', () => {
  const it = infoItem();
  if (it && !it.from && !it.name.trim()) { it.name = DEFAULT_NAME; $('info-name').textContent = it.name; changed(); }
});
$('info-text').addEventListener('input', () => {
  const it = infoItem();
  if (!it || it.from) return;
  it.description = $('info-text').value;
  changed();
});
svg.addEventListener('click', ev => {
  const p = ev.target.closest('.plus');
  if (p) startRelation(p.closest('[data-id]').dataset.id, ev);
});
svg.addEventListener('keydown', ev => {
  const b = ev.target.closest && ev.target.closest('.plus');
  if (!b || (ev.key !== 'Enter' && ev.key !== ' ')) return;
  ev.preventDefault();
  ev.stopPropagation();
  const id = b.closest('[data-id]').dataset.id;
  startRelation(id);
});

svg.addEventListener('pointerdown', ev => {
  if (relFrom) {
    ev.preventDefault();
    lastScreen = screenPoint(ev);
    const t = ev.target.closest('[data-id]'), tid = t ? t.dataset.id : null;
    if (ev.button === 0 && tid && tid !== relFrom && entity(tid)) {
      addRelation(relFrom, tid);
      relFrom = null;
      activated = new Set([tid]);
      changed();
    } else if (ev.button === 0 && !tid) {
      const pt = point(ev), n = { id: uid(), name: DEFAULT_NAME, description: '', x: pt.x, y: pt.y, properties: {} };
      model.entities.push(n);
      addRelation(relFrom, n.id);
      relFrom = null;
      activated = new Set([n.id]);
      changed();
      startEdit(n, true);
    } else cancelRelation();
    return;
  }
  if (ev.button > 0 || ev.target.closest('.plus')) return;
  finishEdit(false);
  if (springs.size) { snapSprings(); save(); }
  const target = ev.target.closest('[data-id]');
  const id = target ? target.dataset.id : null;
  const e = id && entity(id);
  const start = point(ev);

  const marquee = !id && (ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey);
  if (id && (ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey)) {
    activated.has(id) ? activated.delete(id) : activated.add(id);
    render();
    return;
  }
  if (id && !activated.has(id)) activated = new Set([id]);
  render();

  const sStart = screenPoint(ev), v0 = { ...model.view };
  const seeds = e ? model.entities.filter(n => activated.has(n.id)).map(n => n.id) : [];
  if (e && !seeds.includes(id)) seeds.push(id);
  const moving = lockedGroup(seeds);
  const group = e ? model.entities.filter(n => moving.has(n.id)).map(n => ({ n, dx: n.x - start.x, dy: n.y - start.y, follower: !seeds.includes(n.id) })) : [];
  const drag = e ? { moved: false } : null;
  const pan = !id ? { moved: false } : null;
  const rect = marquee ? el('rect', { class: 'marquee' }, svg) : null;
  const cur = rect ? 'marquee' : e || pan ? 'grabbing' : null;
  if (cur) document.documentElement.classList.add(cur);
  const move = m => {
    const s = screenPoint(m);
    if (rect) {
      pan.moved = true;
      rect.setAttribute('x', Math.min(s.x, sStart.x));
      rect.setAttribute('y', Math.min(s.y, sStart.y));
      rect.setAttribute('width', Math.abs(s.x - sStart.x));
      rect.setAttribute('height', Math.abs(s.y - sStart.y));
      return;
    }
    if (pan) {
      if (!pan.moved && Math.hypot(s.x - sStart.x, s.y - sStart.y) < 4) return;
      pan.moved = true;
      model.view.x = v0.x + s.x - sStart.x;
      model.view.y = v0.y + s.y - sStart.y;
      applyView();
      return;
    }
    if (!drag) return;
    const p = point(m);
    if (!drag.moved && Math.hypot(s.x - sStart.x, s.y - sStart.y) < 4) return;
    drag.moved = true;
    const lively = !reducedMotion();
    for (const g of group) {
      const tx = p.x + g.dx, ty = p.y + g.dy;
      if (lively && g.follower) {
        let sp = springs.get(g.n.id);
        if (!sp) springs.set(g.n.id, sp = { x: g.n.x, y: g.n.y, vx: 0, vy: 0 });
        sp.tx = tx; sp.ty = ty;
      } else { g.n.x = tx; g.n.y = ty; }
    }
    render();
    startSprings();
  };
  const up = u => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if (cur) document.documentElement.classList.remove(cur);
    if (rect) {
      rect.remove();
      const s = screenPoint(u), v = model.view;
      const x1 = (Math.min(s.x, sStart.x) - v.x) / v.k, x2 = (Math.max(s.x, sStart.x) - v.x) / v.k;
      const y1 = (Math.min(s.y, sStart.y) - v.y) / v.k, y2 = (Math.max(s.y, sStart.y) - v.y) / v.k;
      activated = new Set(model.entities.filter(n => n.x >= x1 && n.x <= x2 && n.y >= y1 && n.y <= y2).map(n => n.id));
      for (const r of model.relations) if (activated.has(r.from) && activated.has(r.to)) activated.add(r.id);
      render();
      return;
    }
    if (drag && drag.moved && springs.size) {
      const cur = [...springs].map(([id, sp]) => [entity(id), sp]).filter(([n]) => n);
      const was = cur.map(([n]) => [n.x, n.y]);
      for (const [n, sp] of cur) { n.x = sp.tx; n.y = sp.ty; }
      save();
      cur.forEach(([n], i) => { n.x = was[i][0]; n.y = was[i][1]; });
      lastTap.t = 0;
      return;
    }
    if ((drag && drag.moved) || (pan && pan.moved)) { save(); lastTap.t = 0; return; }
    if (pan && activated.size) { activated = new Set(); render(); }
    const sp = screenPoint(u), p = point(u), now = Date.now();
    const isDouble = now - lastTap.t < 400 && Math.hypot(sp.x - lastTap.x, sp.y - lastTap.y) < 20;
    lastTap = { t: isDouble ? 0 : now, x: sp.x, y: sp.y };
    if (!isDouble) return;
    if (e) return startEdit(e, false);
    const rel = id && model.relations.find(r => r.id === id);
    if (rel) return startEdit(rel, false);
    if (!id) {
      const n = { id: uid(), name: DEFAULT_NAME, description: '', x: p.x, y: p.y, properties: {} };
      model.entities.push(n);
      activated = new Set([n.id]);
      changed();
      startEdit(n, true);
    }
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
});

window.addEventListener('pointermove', ev => {
  if (!relFrom) return;
  lastScreen = screenPoint(ev);
  updateRelLine();
});

window.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && !$('dir-menu').hidden) { closeDirMenu(); $('info-dir').focus(); return; }
  if (ev.key === 'Escape' && relFrom) return cancelRelation();
  if (ev.key === 'Escape') {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (activated.size) { activated = new Set(); render(); }
    return;
  }
  if (ev.target.closest('input, button, textarea, [contenteditable]')) {
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA' || ev.target.isContentEditable) return;
    if (ev.key !== 'Delete' && ev.key !== 'Backspace') return;
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'a') {
    ev.preventDefault();
    activated = new Set([...model.entities, ...model.relations].map(x => x.id));
    return render();
  }
  if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); removeActivated(); }
});

$('delete').addEventListener('click', removeActivated);
$('clear').addEventListener('click', () => {
  if (!confirm('Remove all concepts and relations?')) return;
  model = { version: 0, entities: [], relations: [], view: model.view };
  activated = new Set();
  relFrom = null;
  changed();
});
$('export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mindgram.json';
  a.click();
  URL.revokeObjectURL(url);
});

svg.addEventListener('contextmenu', ev => {
  ev.preventDefault();
  if (relFrom) return cancelRelation();
  if (activated.size) { activated = new Set(); render(); }
});
svg.addEventListener('wheel', ev => {
  ev.preventDefault();
  const s = screenPoint(ev);
  if ((ev.shiftKey || ev.altKey) && !ev.ctrlKey && !ev.metaKey) {
    const dx = ev.deltaX || (ev.shiftKey ? ev.deltaY : 0);
    const dy = ev.deltaX || !ev.shiftKey ? ev.deltaY : 0;
    model.view.x -= dx;
    model.view.y -= dy;
    applyView();
    save();
  } else zoomAt(s.x, s.y, model.view.k * Math.exp(-ev.deltaY * 0.01));
}, { passive: false });
$('zoom-in').addEventListener('click', () => zoomCentre(1.25));
$('zoom-out').addEventListener('click', () => zoomCentre(0.8));
$('zoom-reset').addEventListener('click', () => {
  Object.assign(model.view, { x: 0, y: 0, k: 1 });
  render();
  save();
});
window.addEventListener('resize', placeEditor);

render();
