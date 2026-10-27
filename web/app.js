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
let sel = new Set();
let selectMode = false;
let connecting = false;
let editing = null;
let descId = null, descTimer = 0;
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
    const g = el('g', { class: 'edge' + (sel.has(r.id) ? ' sel' : ''), 'data-id': r.id }, world);
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
      el('rect', { class: 'pill', x: -w / 2, y: -11, width: w, height: 22, rx: 11 }, l);
      el('text', { class: 'label', x: 0, y: 0 }, l).textContent = r.name;
    }
  }
  for (const e of model.entities) {
    const g = el('g', { class: 'node' + (sel.has(e.id) ? ' sel' : ''), 'data-id': e.id }, world);
    el('circle', { cx: e.x, cy: e.y, r: radius(e) }, g);
    el('text', { x: e.x, y: e.y }, g).textContent = e.name;
    const r = radius(e) * Math.SQRT1_2;
    const b = el('g', { class: 'info' + (e.description ? ' has' : ''), 'data-x': e.x + r, 'data-y': e.y - r, tabindex: 0, role: 'button', 'aria-label': 'Show description of ' + e.name }, g);
    el('circle', { r: 10 }, b);
    el('text', {}, b).textContent = 'i';
  }
  const one = sel.size === 1 ? entity([...sel][0]) : null;
  $('connect').disabled = !one;
  $('connect').setAttribute('aria-pressed', String(connecting));
  $('delete').disabled = !sel.size;
  const d = descId && entity(descId);
  if (descId && !d) closeDesc();
  else if (d) $('desc-title').textContent = d.name;
  $('select').setAttribute('aria-pressed', String(selectMode));
  applyView();
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
  for (const b of world.querySelectorAll('.info')) b.setAttribute('transform', `translate(${b.dataset.x} ${b.dataset.y}) scale(${1 / v.k})`);
  placeEditor();
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

function removeSelected() {
  if (!sel.size) return;
  model.entities = model.entities.filter(e => !sel.has(e.id));
  model.relations = model.relations.filter(r => !sel.has(r.id) && !sel.has(r.from) && !sel.has(r.to));
  sel = new Set();
  connecting = false;
  changed();
}

function startEdit(e, isNew) {
  finishEdit(true);
  const input = document.createElement('input');
  input.id = 'edit';
  input.value = e.name || '';
  input.setAttribute('aria-label', e.from ? 'Relation name' : 'Concept name');
  document.body.appendChild(input);
  editing = { e, input, isNew, done: false };
  placeEditor();
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') finishEdit(false);
    else if (ev.key === 'Escape') finishEdit(true);
    ev.stopPropagation();
  });
  input.addEventListener('blur', () => finishEdit(false));
  input.focus();
  input.select();
}

function finishEdit(cancel) {
  if (!editing || editing.done) return;
  const { e, input } = editing;
  editing.done = true;
  editing = null;
  const name = input.value.trim();
  if (!cancel && (name || e.from)) e.name = name;
  input.remove();
  changed();
}

function flushDesc() {
  clearTimeout(descTimer);
  const e = descId && entity(descId);
  if (e && e.description !== $('desc-text').value) { e.description = $('desc-text').value; save(); }
}

function openDesc(id) {
  finishEdit(false);
  flushDesc();
  const e = entity(id);
  if (!e) return;
  descId = id;
  $('desc-title').textContent = e.name;
  $('desc-text').value = e.description || '';
  $('desc').hidden = false;
  $('desc-text').focus();
}

function closeDesc() {
  if (!descId) return;
  flushDesc();
  descId = null;
  $('desc').hidden = true;
  render();
}

$('desc-text').addEventListener('input', () => {
  clearTimeout(descTimer);
  descTimer = setTimeout(() => { flushDesc(); render(); }, 300);
});
$('desc-close').addEventListener('click', closeDesc);
document.addEventListener('pointerdown', ev => {
  if (descId && !ev.target.closest('#desc, .info')) closeDesc();
}, true);
svg.addEventListener('click', ev => {
  const b = ev.target.closest('.info');
  if (b) openDesc(b.closest('[data-id]').dataset.id);
});
svg.addEventListener('keydown', ev => {
  const b = ev.target.closest && ev.target.closest('.info');
  if (b && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); ev.stopPropagation(); openDesc(b.closest('[data-id]').dataset.id); }
});

svg.addEventListener('pointerdown', ev => {
  if (ev.button > 0 || ev.target.closest('.info')) return;
  finishEdit(false);
  const target = ev.target.closest('[data-id]');
  const id = target ? target.dataset.id : null;
  const e = id && entity(id);
  const start = point(ev);

  const one = sel.size === 1 ? [...sel][0] : null;
  if (e && connecting && one && one !== id && entity(one)) {
    addRelation(one, id);
    connecting = false;
    sel = new Set([id]);
    changed();
    return;
  }

  const marquee = !id && (ev.shiftKey || selectMode);
  if (id && ev.shiftKey) {
    sel.has(id) ? sel.delete(id) : sel.add(id);
    connecting = false;
    render();
    return;
  }
  if (!sel.has(id)) sel = new Set(id ? [id] : []);
  connecting = false;
  render();

  const sStart = screenPoint(ev), v0 = { ...model.view };
  const group = e ? model.entities.filter(n => sel.has(n.id)).map(n => ({ n, dx: n.x - start.x, dy: n.y - start.y })) : [];
  const drag = e ? { moved: false } : null;
  const pan = !id ? { moved: false } : null;
  const rect = marquee ? el('rect', { class: 'marquee' }, svg) : null;
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
    if (rect) {
      rect.remove();
      const s = screenPoint(u), v = model.view;
      const x1 = (Math.min(s.x, sStart.x) - v.x) / v.k, x2 = (Math.max(s.x, sStart.x) - v.x) / v.k;
      const y1 = (Math.min(s.y, sStart.y) - v.y) / v.k, y2 = (Math.max(s.y, sStart.y) - v.y) / v.k;
      sel = new Set(model.entities.filter(n => n.x >= x1 && n.x <= x2 && n.y >= y1 && n.y <= y2).map(n => n.id));
      for (const r of model.relations) if (sel.has(r.from) && sel.has(r.to)) sel.add(r.id);
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
      sel = new Set([n.id]);
      changed();
      startEdit(n, true);
    }
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
});

window.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && descId) return closeDesc();
  if (ev.target.closest('input, button, textarea')) {
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return;
    if (ev.key !== 'Delete' && ev.key !== 'Backspace') return;
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'a') {
    ev.preventDefault();
    sel = new Set([...model.entities, ...model.relations].map(x => x.id));
    return render();
  }
  if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); removeSelected(); }
  else if (ev.key === 'Escape') { connecting = false; render(); }
});

$('connect').addEventListener('click', () => { connecting = !connecting && sel.size === 1 && !!entity([...sel][0]); render(); });
$('delete').addEventListener('click', removeSelected);
$('clear').addEventListener('click', () => {
  if (!confirm('Remove all concepts and relations?')) return;
  model = { version: 0, entities: [], relations: [], view: model.view };
  sel = new Set();
  connecting = false;
  changed();
});
$('select').addEventListener('click', () => { selectMode = !selectMode; render(); });
$('export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mindgram.json';
  a.click();
  URL.revokeObjectURL(url);
});

svg.addEventListener('wheel', ev => {
  ev.preventDefault();
  const s = screenPoint(ev);
  if (ev.ctrlKey || ev.metaKey) zoomAt(s.x, s.y, model.view.k * Math.exp(-ev.deltaY * 0.01));
  else {
    model.view.x -= ev.deltaX;
    model.view.y -= ev.deltaY;
    applyView();
    save();
  }
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
