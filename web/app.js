const KEY = 'mindmap.v0';
const DEFAULT_NAME = 'New concept';
const FONT = '16px system-ui, sans-serif';
const NS = 'http://www.w3.org/2000/svg';
const svg = document.getElementById('canvas');
const $ = id => document.getElementById(id);
const ctx = document.createElement('canvas').getContext('2d');

let model = load();
let selected = null;
let connecting = false;
let editing = null;
let lastTap = { t: 0, x: 0, y: 0 };

function load() {
  try {
    const m = JSON.parse(localStorage.getItem(KEY));
    if (m && m.version === 0 && Array.isArray(m.entities) && Array.isArray(m.relations)) return m;
  } catch (e) {}
  return { version: 0, entities: [], relations: [] };
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
  svg.replaceChildren();
  for (const r of model.relations) {
    const a = entity(r.from), b = entity(r.to);
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const ra = radius(a), rb = radius(b);
    if (d <= ra + rb) continue;
    const g = el('g', { class: 'edge' + (selected === r.id ? ' sel' : ''), 'data-id': r.id }, svg);
    const p = [a.x + dx / d * ra, a.y + dy / d * ra, b.x - dx / d * rb, b.y - dy / d * rb];
    for (const cls of ['hit', '']) {
      el('line', { class: cls, x1: p[0], y1: p[1], x2: p[2], y2: p[3] }, g);
    }
  }
  for (const e of model.entities) {
    const g = el('g', { class: 'node' + (selected === e.id ? ' sel' : ''), 'data-id': e.id }, svg);
    el('circle', { cx: e.x, cy: e.y, r: radius(e) }, g);
    el('text', { x: e.x, y: e.y }, g).textContent = e.name;
  }
  const entSel = entity(selected);
  $('connect').disabled = !entSel;
  $('connect').setAttribute('aria-pressed', String(connecting));
  $('delete').disabled = !selected;
}

function changed() { save(); render(); }

function point(ev) {
  const r = svg.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

function addRelation(from, to) {
  if (from === to) return;
  if (model.relations.some(r => (r.from === from && r.to === to) || (r.from === to && r.to === from))) return;
  model.relations.push({ id: uid(), from, to });
}

function removeSelected() {
  if (!selected) return;
  model.entities = model.entities.filter(e => e.id !== selected);
  model.relations = model.relations.filter(r => r.id !== selected && r.from !== selected && r.to !== selected);
  selected = null;
  connecting = false;
  changed();
}

function startEdit(e, isNew) {
  finishEdit(true);
  const input = document.createElement('input');
  input.id = 'edit';
  input.value = e.name;
  input.setAttribute('aria-label', 'Concept name');
  const box = svg.getBoundingClientRect();
  input.style.left = box.left + e.x + 'px';
  input.style.top = box.top + e.y + 'px';
  document.body.appendChild(input);
  editing = { e, input, isNew, done: false };
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
  if (!cancel && name) e.name = name;
  input.remove();
  changed();
}

svg.addEventListener('pointerdown', ev => {
  if (ev.button > 0) return;
  finishEdit(false);
  const target = ev.target.closest('[data-id]');
  const id = target ? target.dataset.id : null;
  const e = id && entity(id);
  const start = point(ev);

  if (e && (connecting || ev.shiftKey) && selected && selected !== id && entity(selected)) {
    addRelation(selected, id);
    connecting = false;
    selected = id;
    changed();
    return;
  }

  selected = id;
  connecting = false;
  render();

  const drag = e ? { e, dx: e.x - start.x, dy: e.y - start.y, moved: false } : null;
  const move = m => {
    if (!drag) return;
    const p = point(m);
    if (!drag.moved && Math.hypot(p.x - start.x, p.y - start.y) < 4) return;
    drag.moved = true;
    drag.e.x = p.x + drag.dx;
    drag.e.y = p.y + drag.dy;
    render();
  };
  const up = u => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    if (drag && drag.moved) { save(); lastTap.t = 0; return; }
    const p = point(u), now = Date.now();
    const isDouble = now - lastTap.t < 400 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 20;
    lastTap = { t: isDouble ? 0 : now, x: p.x, y: p.y };
    if (!isDouble) return;
    if (e) return startEdit(e, false);
    if (!id) {
      const n = { id: uid(), name: DEFAULT_NAME, x: p.x, y: p.y, properties: {} };
      model.entities.push(n);
      selected = n.id;
      changed();
      startEdit(n, true);
    }
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
});

window.addEventListener('keydown', ev => {
  if (ev.target.closest('input, button')) {
    if (ev.target.tagName === 'INPUT') return;
    if (ev.key !== 'Delete' && ev.key !== 'Backspace') return;
  }
  if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); removeSelected(); }
  else if (ev.key === 'Escape') { connecting = false; render(); }
});

$('connect').addEventListener('click', () => { connecting = !connecting && !!entity(selected); render(); });
$('delete').addEventListener('click', removeSelected);
$('clear').addEventListener('click', () => {
  if (!confirm('Remove all concepts and relations?')) return;
  model = { version: 0, entities: [], relations: [] };
  selected = null;
  connecting = false;
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

render();
