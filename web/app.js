const KEY = 'mindmap.v0';
const DEFAULT_NAME = 'New concept';
const FONT = '16px system-ui, sans-serif';
const LABEL_FONT = '14px system-ui, sans-serif';
const NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('canvas');
const world = document.createElementNS(NS, 'g');
svg.appendChild(world);
const K_MIN = 0.2, K_MAX = 4;
const $ = id => document.getElementById(id);
const ctx = document.createElement('canvas').getContext('2d');

let model = load();
let activated = new Set();
let activateMode = false;
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
      for (const r of m.relations) if (typeof r.name !== 'string') r.name = '';
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

function radius(e) {
  ctx.font = FONT;
  return Math.max(28, ctx.measureText(e.name).width / 2 + 14);
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
  for (const r of model.relations) {
    const a = entity(r.from), b = entity(r.to);
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const ra = radius(a), rb = radius(b);
    if (d <= ra + rb) continue;
    const g = el('g', { class: 'edge' + (activated.has(r.id) ? ' activated' : ''), 'data-id': r.id }, world);
    const p = [a.x + dx / d * ra, a.y + dy / d * ra, b.x - dx / d * rb, b.y - dy / d * rb];
    for (const cls of ['hit', '']) {
      el('line', { class: cls, x1: p[0], y1: p[1], x2: p[2], y2: p[3] }, g);
    }
    if (r.name && !(editing && editing.e === r)) {
      ctx.font = LABEL_FONT;
      const w = ctx.measureText(r.name).width + 12, mx = (p[0] + p[2]) / 2, my = (p[1] + p[3]) / 2;
      let deg = Math.atan2(dy, dx) * 180 / Math.PI;
      if (deg > 90) deg -= 180;
      else if (deg <= -90) deg += 180;
      const l = el('g', { class: 'lbl', transform: `translate(${mx} ${my}) rotate(${deg})` }, g);
      el('rect', { class: 'pill', x: -w / 2, y: -LBL_LIFT - 11, width: w, height: 22, rx: 11 }, l);
      el('text', { class: 'label', x: 0, y: -LBL_LIFT }, l).textContent = r.name;
    }
  }
  for (const e of model.entities) {
    const g = el('g', { class: 'node' + (activated.has(e.id) ? ' activated' : ''), 'data-id': e.id }, world);
    el('circle', { cx: e.x, cy: e.y, r: radius(e) }, g);
    el('text', { x: e.x, y: e.y }, g).textContent = e.name;
    if (relFrom === e.id) g.classList.add('src');
    if (e.description) el('circle', { class: 'hasdesc', cx: e.x, cy: e.y + radius(e) - 7, r: 2.5 }, g);
    if (relFrom || activated.size !== 1 || !activated.has(e.id)) continue;
    const r = radius(e) * Math.SQRT1_2;
    const p = el('g', { class: 'plus', 'data-x': e.x + r, 'data-y': e.y + r, tabindex: 0, role: 'button', 'aria-label': 'Add relation from ' + e.name }, g);
    el('circle', { r: 10 }, p);
    el('path', { class: 'glyph', d: 'M-5 0H5M0 -5V5' }, p);
  }
  if (relFrom && !entity(relFrom)) relFrom = null;
  if (relFrom) el('line', { class: 'relline', 'data-from': relFrom, x1: 0, y1: 0, x2: 0, y2: 0 }, world);
  svg.classList.toggle('relating', !!relFrom);
  const one = activated.size === 1 ? entity([...activated][0]) : null;
  $('connect').disabled = !one && !relFrom;
  $('connect').setAttribute('aria-pressed', String(!!relFrom));
  $('delete').disabled = !activated.size;
  $('activate').setAttribute('aria-pressed', String(activateMode));
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
  for (const [k, n] of [['from', a], ['to', b]]) {
    const btn = $('info-' + k);
    btn.textContent = n ? n.name : '?';
  }
}

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
  applyView();
  save();
}

function zoomCentre(f) {
  const r = svg.getBoundingClientRect();
  zoomAt(r.width / 2, r.height / 2, model.view.k * f);
}

function addRelation(from, to) {
  if (from === to) return;
  if (model.relations.some(r => (r.from === from && r.to === to) || (r.from === to && r.to === from))) return;
  model.relations.push({ id: uid(), from, to, name: '' });
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
    } else cancelRelation();
    return;
  }
  if (ev.button > 0 || ev.target.closest('.plus')) return;
  finishEdit(false);
  const target = ev.target.closest('[data-id]');
  const id = target ? target.dataset.id : null;
  const e = id && entity(id);
  const start = point(ev);

  const marquee = !id && (ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey || activateMode);
  if (id && ev.shiftKey) {
    activated.has(id) ? activated.delete(id) : activated.add(id);
    render();
    return;
  }
  if (!activated.has(id)) activated = new Set(id ? [id] : []);
  render();

  const sStart = screenPoint(ev), v0 = { ...model.view };
  const group = e ? model.entities.filter(n => activated.has(n.id)).map(n => ({ n, dx: n.x - start.x, dy: n.y - start.y })) : [];
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
    for (const g of group) { g.n.x = p.x + g.dx; g.n.y = p.y + g.dy; }
    render();
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
    if ((drag && drag.moved) || (pan && pan.moved)) { save(); lastTap.t = 0; return; }
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

$('connect').addEventListener('click', () => {
  if (relFrom) return cancelRelation();
  if (activated.size === 1) startRelation([...activated][0]);
});
$('delete').addEventListener('click', removeActivated);
$('clear').addEventListener('click', () => {
  if (!confirm('Remove all concepts and relations?')) return;
  model = { version: 0, entities: [], relations: [], view: model.view };
  activated = new Set();
  relFrom = null;
  changed();
});
$('activate').addEventListener('click', () => { activateMode = !activateMode; render(); });
$('export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mindgram.json';
  a.click();
  URL.revokeObjectURL(url);
});

svg.addEventListener('contextmenu', ev => { ev.preventDefault(); cancelRelation(); });
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
  applyView();
  save();
});
window.addEventListener('resize', placeEditor);

render();
