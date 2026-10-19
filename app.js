'use strict';

(() => {
  /* ================= helpers ================= */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const pad = n => String(n).padStart(2, '0');
  const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dateOf = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); };
  const todayKey = () => keyOf(new Date());
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const cleanName = s => String(s).trim().replace(/\s+/g, ' ').slice(0, 60);
  const norm = s => cleanName(s).toLowerCase();
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  const fmt = v => nf.format(Math.round(v * 10) / 10);
  function compact(v) {
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return fmt(v);
  }
  function parseNum(s) {
    s = String(s).trim().replace(',', '.');
    if (s === '') return null;
    const n = parseFloat(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  const fmtDate = (k, opts) => dateOf(k).toLocaleDateString(undefined, opts);
  const SHORT = { month: 'short', day: 'numeric' };
  const thisYear = k => dateOf(k).getFullYear() === new Date().getFullYear();
  function relDay(k) {
    const t = todayKey();
    if (k === t) return 'Today';
    if (k === addDays(t, -1)) return 'Yesterday';
    if (k === addDays(t, 1)) return 'Tomorrow';
    return null;
  }

  // Tiny DOM builder. User-entered text always goes in via textContent / value.
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'dataset') Object.assign(e.dataset, v);
        else if (k in e) e[k] = v;
        else e.setAttribute(k, v);
      }
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
    return e;
  }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }
  function icon(d, size) {
    const svg = s('svg', { viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': 'true' });
    s('path', { d }, svg);
    return svg;
  }
  const ICON_TRASH = 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3';
  const ICON_X = 'M7 7l10 10M17 7L7 17';
  const ICON_PLUS = 'M12 5v14M5 12h14';

  /* ================= storage ================= */

  const STORE_KEY = 'spinn.data.v1';
  const PREFS_KEY = 'spinn.prefs.v1';
  const numOrNull = n => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null);

  // Data shape:
  // { unit: 'lb'|'kg',
  //   routines: { upper: [name], lower: [name] },   exercises shown on every day of that type
  //   days: { 'YYYY-MM-DD': { bw: number|null, type?: 'upper'|'lower', ex: [{ id, name, sets: [{ w, r }] }] } } }
  const TYPES = ['upper', 'lower'];
  const TYPE_LABEL = { upper: 'Upper', lower: 'Lower' };
  const emptyDb = (unit = 'lb') => ({ unit, routines: { upper: [], lower: [] }, days: {} });

  function sanitize(src) {
    if (!src || typeof src !== 'object' || !src.days || typeof src.days !== 'object') return null;
    const out = emptyDb(src.unit === 'kg' ? 'kg' : 'lb');
    for (const t of TYPES) {
      const list = src.routines && Array.isArray(src.routines[t]) ? src.routines[t] : [];
      const seen = new Set();
      for (const n of list) {
        if (typeof n !== 'string' || !cleanName(n) || seen.has(norm(n))) continue;
        seen.add(norm(n));
        out.routines[t].push(cleanName(n));
      }
    }
    for (const [k, v] of Object.entries(src.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== 'object') continue;
      const ex = (Array.isArray(v.ex) ? v.ex : [])
        .filter(e => e && typeof e.name === 'string' && cleanName(e.name))
        .map(e => ({
          id: typeof e.id === 'string' ? e.id : uid(),
          name: cleanName(e.name),
          sets: (Array.isArray(e.sets) ? e.sets : []).map(x => ({ w: numOrNull(x && x.w), r: numOrNull(x && x.r) })),
        }));
      const bw = numOrNull(v.bw);
      const type = TYPES.includes(v.type) ? v.type : undefined;
      if (bw != null || ex.length || type) out.days[k] = type ? { bw, type, ex } : { bw, ex };
    }
    return out;
  }

  function loadData() {
    let raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch { /* storage blocked */ }
    if (raw) {
      try {
        const d = sanitize(JSON.parse(raw));
        if (d) return d;
      } catch { /* fall through */ }
      // Never silently overwrite data we couldn't read: park a copy first.
      try { localStorage.setItem(`${STORE_KEY}.unreadable.${Date.now()}`, raw); } catch { /* ignore */ }
    }
    return emptyDb();
  }

  let db = loadData();

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
    catch { toast('Couldn’t save. Device storage may be full.'); }
  }

  const prefs = { ex: null, metric: 'vol', period: '1M' };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS_KEY)) || {}); } catch { /* defaults */ }
  const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ } };

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  /* ================= data queries ================= */

  // Creating a day pins its Upper/Lower type, so the choice is remembered.
  const dayOf = (k, create) => db.days[k] || (create ? (db.days[k] = { bw: null, type: typeOf(k), ex: [] }) : null);
  function prune(k) {
    const d = db.days[k];
    if (d && d.bw == null && !d.ex.length && !d.type) delete db.days[k];
  }
  const sortedKeys = () => Object.keys(db.days).sort();
  const isValidSet = x => x.w != null && x.r != null && x.r > 0;
  const hasSets = d => d.ex.some(e => e.sets.some(isValidSet));
  const hasData = d => d.bw != null || hasSets(d);
  const epley = (w, r) => (r === 1 ? w : w * (1 + r / 30));

  // A day without a saved type alternates from the last workout: Upper after Lower and vice versa.
  function typeOf(k) {
    const d = db.days[k];
    if (d && d.type) return d.type;
    const keys = sortedKeys();
    for (let i = keys.length - 1; i >= 0; i--) {
      const p = db.days[keys[i]];
      if (keys[i] < k && p.type && hasSets(p)) return p.type === 'upper' ? 'lower' : 'upper';
    }
    return 'upper';
  }

  const inRoutine = (type, name) => db.routines[type].some(n => norm(n) === norm(name));

  // Every exercise name in a routine or a logged day, keyed by normalised name.
  function exerciseIndex() {
    const map = new Map();
    for (const t of TYPES) {
      for (const name of db.routines[t]) {
        const key = norm(name);
        if (!map.has(key)) map.set(key, { key, name, last: '', count: 0 });
      }
    }
    for (const k of sortedKeys()) {
      for (const ex of db.days[k].ex) {
        if (!ex.sets.some(isValidSet)) continue;
        const key = norm(ex.name);
        const e = map.get(key) || { key, name: ex.name, last: k, count: 0 };
        e.name = ex.name;
        e.last = k;
        e.count++;
        map.set(key, e);
      }
    }
    return map;
  }

  function setsOn(k, key) {
    const out = [];
    for (const ex of db.days[k].ex) if (norm(ex.name) === key) out.push(...ex.sets.filter(isValidSet));
    return out;
  }

  // One entry per day the exercise was done (sets merged if it was logged twice).
  function sessionsOf(key) {
    const out = [];
    for (const k of sortedKeys()) {
      const sets = setsOn(k, key);
      if (sets.length) out.push({ date: k, sets });
    }
    return out;
  }

  function lastSession(key, before) {
    const keys = sortedKeys();
    for (let i = keys.length - 1; i >= 0; i--) {
      if (keys[i] >= before) continue;
      const sets = setsOn(keys[i], key);
      if (sets.length) return { date: keys[i], sets };
    }
    return null;
  }

  /* ================= elements ================= */

  const el = {
    dateMain: $('#dateMain'), dateSub: $('#dateSub'), datePicker: $('#datePicker'),
    prevDay: $('#prevDay'), nextDay: $('#nextDay'),
    pastBanner: $('#pastBanner'), pastText: $('#pastText'), todayBtn: $('#todayBtn'), typeSeg: $('#typeSeg'),
    bwInput: $('#bwInput'), daySummary: $('#daySummary'), exList: $('#exerciseList'),
    addForm: $('#addExForm'), newEx: $('#newExName'), datalist: $('#exNames'), chips: $('#quickChips'),
    exSelect: $('#exSelect'), metricSeg: $('#metricSeg'), periodSeg: $('#periodSeg'),
    exCard: $('#exCard'), exEntries: $('#exEntries'), ormNote: $('#ormNote'),
    bwCard: $('#bwCard'), bwEntries: $('#bwEntries'),
    history: $('#historyList'),
    settings: $('#settings'), settingsBtn: $('#settingsBtn'), unitSeg: $('#unitSeg'),
    exportBtn: $('#exportBtn'), importBtn: $('#importBtn'), importFile: $('#importFile'), wipeBtn: $('#wipeBtn'),
    toast: $('#toast'),
  };

  let toastTimer;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600);
  }

  const setSeg = (seg, v) => $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));

  /* ================= WORKOUT tab ================= */

  let curDate = todayKey();
  const cardState = new WeakMap(); // card element -> { ex, virtual, routine, prev }

  // What the Workout tab lists for a day: its routine (in order), then anything else
  // logged that day. Routine exercises you haven't touched yet are "virtual": they
  // show the same number of sets as last time and are only saved once you type.
  function itemsFor(k) {
    const day = dayOf(k);
    const rest = day ? day.ex.slice() : [];
    const items = db.routines[typeOf(k)].map(name => {
      const i = rest.findIndex(e => norm(e.name) === norm(name));
      if (i >= 0) return { ex: rest.splice(i, 1)[0], virtual: false, routine: true };
      const prev = lastSession(norm(name), k);
      const sets = Array.from({ length: prev ? prev.sets.length : 1 }, () => ({ w: null, r: null }));
      return { ex: { id: null, name, sets }, virtual: true, routine: true };
    });
    const extras = rest.filter(e => e.sets.some(x => x.w != null || x.r != null));
    return items.concat(extras.map(ex => ({ ex, virtual: false, routine: false })));
  }

  // Turn a virtual exercise into a real entry on this day the first time it's edited.
  function materialize(card) {
    const item = cardState.get(card);
    if (item.virtual) {
      item.ex.id = uid();
      dayOf(curDate, true).ex.push(item.ex);
      item.virtual = false;
    }
    return item.ex;
  }

  function redraw(card) {
    const fresh = exCard(cardState.get(card));
    card.replaceWith(fresh);
    return fresh;
  }

  function renderLog() {
    const t = todayKey();
    const rel = relDay(curDate);
    el.dateMain.textContent = rel || fmtDate(curDate, { weekday: 'long' });
    el.dateSub.textContent = fmtDate(curDate, {
      weekday: rel ? 'long' : undefined,
      month: 'long',
      day: 'numeric',
      year: thisYear(curDate) ? undefined : 'numeric',
    });
    el.datePicker.value = curDate;
    el.pastBanner.hidden = curDate === t;
    el.pastText.textContent = curDate < t ? 'Viewing a past day' : 'Viewing a future day';
    $$('.unit-label').forEach(n => { n.textContent = db.unit; });

    const type = typeOf(curDate);
    const label = TYPE_LABEL[type];
    setSeg(el.typeSeg, type);
    el.newEx.placeholder = `Add an exercise to ${label} days…`;

    const day = dayOf(curDate);
    el.bwInput.value = day && day.bw != null ? day.bw : '';

    const items = itemsFor(curDate);
    el.exList.replaceChildren(...(items.length
      ? items.map(exCard)
      : [h('p', { class: 'empty-hint', text: `Your ${label} routine is empty. Add an exercise below and it will show up on every ${label} day.` })]));

    renderDaySummary();
    renderSuggestions();
  }

  function exCard(item) {
    const { ex } = item;
    const removeLabel = item.routine ? `Remove ${ex.name} from ${TYPE_LABEL[typeOf(curDate)]} days` : `Delete ${ex.name} from this day`;
    const card = h('div', { class: 'card ex-card', dataset: { name: norm(ex.name) } },
      h('div', { class: 'ex-head' },
        h('h3', { class: 'ex-name', text: ex.name }),
        h('button', { type: 'button', class: 'icon-btn del-ex', 'aria-label': removeLabel }, icon(ICON_TRASH, 20))),
      h('div', { class: 'ex-last' },
        h('span', { class: 'ex-last-text' }),
        h('button', { type: 'button', class: 'repeat-btn', text: 'Repeat' })),
      h('div', { class: 'set-hdr' },
        h('span', { text: 'Set' }), h('span', { text: `Weight (${db.unit})` }), h('span', { text: 'Reps' }),
        h('span', { text: 'Volume' }), h('span')),
      h('div', { class: 'sets' }, ex.sets.map((x, i) => setRow(x, i))),
      h('div', { class: 'ex-foot' },
        h('button', { type: 'button', class: 'add-set' }, icon(ICON_PLUS, 18), 'Add set'),
        h('span', { class: 'ex-total' })));
    cardState.set(card, item);
    applyHints(card);
    updateTotal(card, ex);
    return card;
  }

  function setRow(x, i) {
    return h('div', { class: 'set-row', dataset: { i } },
      h('span', { class: 'set-no', text: i + 1 }),
      h('input', { class: 'w', inputmode: 'decimal', value: x.w ?? '', autocomplete: 'off', 'aria-label': `Set ${i + 1} weight` }),
      h('input', { class: 'r', inputmode: 'numeric', pattern: '[0-9]*', value: x.r ?? '', autocomplete: 'off', 'aria-label': `Set ${i + 1} reps` }),
      h('span', { class: 'vol', text: isValidSet(x) ? fmt(x.w * x.r) : '' }),
      h('button', { type: 'button', class: 'del-set', 'aria-label': `Delete set ${i + 1}` }, icon(ICON_X, 16)));
  }

  // "Last time" line + greyed placeholders showing what you did last session.
  function applyHints(card) {
    const item = cardState.get(card);
    const prev = item.prev = lastSession(norm(item.ex.name), curDate);
    const last = $('.ex-last', card);
    last.hidden = !prev;
    if (prev) {
      $('.ex-last-text', last).textContent = `Last · ${fmtDate(prev.date, SHORT)}: ${prev.sets.map(x => `${fmt(x.w)}×${x.r}`).join(', ')}`;
    }
    $$('.set-row', card).forEach((row, i) => {
      const hint = prev && (prev.sets[i] || prev.sets[prev.sets.length - 1]);
      $('.w', row).placeholder = hint ? fmt(hint.w) : db.unit;
      $('.r', row).placeholder = hint ? String(hint.r) : 'reps';
    });
    refreshRepeat(card);
  }

  // "Repeat" copies last session's numbers into any empty sets; hidden when there's nothing to fill.
  const isBlank = x => !x || (x.w == null && x.r == null);
  function refreshRepeat(card) {
    const { ex, prev } = cardState.get(card);
    $('.repeat-btn', card).hidden = !prev || !prev.sets.some((p, i) => isBlank(ex.sets[i]));
  }

  function repeatLast(card) {
    const { prev } = cardState.get(card);
    if (!prev) return;
    const ex = materialize(card);
    prev.sets.forEach((p, i) => {
      if (!ex.sets[i]) ex.sets.push({ w: p.w, r: p.r });
      else if (isBlank(ex.sets[i])) Object.assign(ex.sets[i], { w: p.w, r: p.r });
    });
    save();
    redraw(card);
    renderDaySummary();
  }

  function updateTotal(card, ex) {
    const valid = ex.sets.filter(isValidSet);
    const vol = valid.reduce((a, x) => a + x.w * x.r, 0);
    $('.ex-total', card).textContent = valid.length ? `${plural(valid.length, 'set')} · ${fmt(vol)} ${db.unit}` : '';
  }

  function renderDaySummary() {
    const exs = $$('.ex-card', el.exList).map(c => cardState.get(c).ex);
    let sets = 0, vol = 0, done = 0;
    for (const ex of exs) {
      const valid = ex.sets.filter(isValidSet);
      if (valid.length) done++;
      for (const x of valid) { sets++; vol += x.w * x.r; }
    }
    el.daySummary.hidden = !exs.length;
    el.daySummary.textContent = `${done} of ${plural(exs.length, 'exercise')} done · ${plural(sets, 'set')} · ${fmt(vol)} ${db.unit} volume`;
  }

  function renderSuggestions() {
    const all = [...exerciseIndex().values()];
    const type = typeOf(curDate);
    el.datalist.replaceChildren(...all.slice().sort((a, b) => a.name.localeCompare(b.name)).map(e => h('option', { value: e.name })));
    const recent = all.filter(e => !inRoutine(type, e.name))
      .sort((a, b) => b.last.localeCompare(a.last) || b.count - a.count)
      .slice(0, 8);
    el.chips.replaceChildren(...recent.map(e => h('button', { type: 'button', class: 'chip', text: e.name, dataset: { name: e.name } })));
    el.chips.hidden = !recent.length;
  }

  const cardOf = name => $(`.ex-card[data-name="${CSS.escape(norm(name))}"]`, el.exList);

  function addExercise(raw) {
    let name = cleanName(raw);
    if (!name) return;
    const known = exerciseIndex().get(norm(name));
    if (known) name = known.name; // keep one spelling per exercise so stats line up

    const type = typeOf(curDate);
    if (inRoutine(type, name)) {
      const card = cardOf(name);
      card.scrollIntoView({ block: 'center', behavior: 'smooth' });
      card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
      return;
    }
    db.routines[type].push(name);
    dayOf(curDate, true); // pins this day's Upper/Lower choice
    save();
    renderLog();
    toast(`Added to every ${TYPE_LABEL[type]} day`);
    const card = cardOf(name);
    $('.w', card).focus({ preventScroll: true });
    card.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function removeExercise(card) {
    const item = cardState.get(card);
    const { ex } = item;
    const type = typeOf(curDate);
    const filled = ex.sets.filter(x => !isBlank(x)).length;
    if (item.routine) {
      const msg = `Remove ${ex.name} from your ${TYPE_LABEL[type]} days? Sets you logged on other days are kept.`
        + (filled ? ` The ${plural(filled, 'set')} on this day will be deleted.` : '');
      if (!confirm(msg)) return;
      db.routines[type] = db.routines[type].filter(n => norm(n) !== norm(ex.name));
    } else if (filled && !confirm(`Delete ${ex.name} and its ${plural(filled, 'set')} from this day?`)) {
      return;
    }
    const day = dayOf(curDate);
    if (day && !item.virtual) day.ex.splice(day.ex.indexOf(ex), 1);
    prune(curDate);
    save();
    renderLog();
  }

  el.addForm.addEventListener('submit', e => {
    e.preventDefault();
    addExercise(el.newEx.value);
    el.newEx.value = '';
  });

  el.chips.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip) addExercise(chip.dataset.name);
  });

  el.exList.addEventListener('input', e => {
    const t = e.target;
    const row = t.closest('.set-row');
    if (!row) return;
    const card = row.closest('.ex-card');
    const ex = materialize(card);
    const x = ex.sets[Number(row.dataset.i)];
    if (t.classList.contains('w')) x.w = parseNum(t.value);
    else if (t.classList.contains('r')) { const n = parseNum(t.value); x.r = n == null ? null : Math.round(n); }
    save();
    $('.vol', row).textContent = isValidSet(x) ? fmt(x.w * x.r) : '';
    updateTotal(card, ex);
    refreshRepeat(card);
    renderDaySummary();
  });

  el.exList.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const t = e.target;
    if (t.classList.contains('w')) { e.preventDefault(); $('.r', t.closest('.set-row')).focus(); }
    else if (t.tagName === 'INPUT') { e.preventDefault(); t.blur(); }
  });

  el.exList.addEventListener('click', e => {
    const btn = e.target.closest('button');
    const card = btn && btn.closest('.ex-card');
    if (!card) return;

    if (btn.classList.contains('add-set')) {
      const ex = materialize(card);
      const prev = ex.sets[ex.sets.length - 1];
      ex.sets.push({ w: prev ? prev.w : null, r: prev ? prev.r : null });
      save();
      const fresh = redraw(card);
      if (!prev || prev.w == null) $$('.set-row', fresh).pop().querySelector('.w').focus({ preventScroll: true });
      renderDaySummary();
    } else if (btn.classList.contains('del-set')) {
      const ex = materialize(card);
      ex.sets.splice(Number(btn.closest('.set-row').dataset.i), 1);
      save();
      redraw(card);
      renderDaySummary();
    } else if (btn.classList.contains('repeat-btn')) {
      repeatLast(card);
    } else if (btn.classList.contains('del-ex')) {
      removeExercise(card);
    }
  });

  el.typeSeg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.dataset.v === typeOf(curDate)) return;
    dayOf(curDate, true).type = b.dataset.v;
    save();
    renderLog();
  });

  el.bwInput.addEventListener('input', () => {
    const v = parseNum(el.bwInput.value);
    const day = dayOf(curDate, v != null);
    if (!day) return;
    day.bw = v;
    prune(curDate);
    save();
  });
  el.bwInput.addEventListener('keydown', e => { if (e.key === 'Enter') el.bwInput.blur(); });

  function goToDate(k) {
    if (!k || k === curDate) return;
    curDate = k;
    renderLog();
    window.scrollTo(0, 0);
  }
  el.prevDay.addEventListener('click', () => goToDate(addDays(curDate, -1)));
  el.nextDay.addEventListener('click', () => goToDate(addDays(curDate, 1)));
  el.todayBtn.addEventListener('click', () => goToDate(todayKey()));
  el.datePicker.addEventListener('change', () => goToDate(el.datePicker.value));
  el.datePicker.addEventListener('click', () => {
    // Desktop browsers only open the calendar from its icon; iOS opens it on tap by itself.
    if (matchMedia('(pointer: fine)').matches && el.datePicker.showPicker) {
      try { el.datePicker.showPicker(); } catch { /* already open */ }
    }
  });

  /* ================= PROGRESS tab ================= */

  const PERIODS = {
    '1W': { words: 'week', back: d => d.setDate(d.getDate() - 6) },
    '1M': { words: 'month', back: d => d.setMonth(d.getMonth() - 1) },
    '3M': { words: '3 months', back: d => d.setMonth(d.getMonth() - 3) },
    '1Y': { words: 'year', back: d => d.setFullYear(d.getFullYear() - 1) },
  };

  const totalVol = x => x.sets.reduce((a, y) => a + y.w * y.r, 0);
  const METRICS = {
    vol: {
      name: 'Average volume per set',
      value: x => totalVol(x) / x.sets.length,
      detail: x => `${plural(x.sets.length, 'set')} · ${fmt(totalVol(x))} ${db.unit} total`,
    },
    first: {
      name: 'First set weight',
      value: x => x.sets[0].w,
      detail: x => `First set ${fmt(x.sets[0].w)} ${db.unit} × ${plural(x.sets[0].r, 'rep')}`,
    },
    orm: {
      name: 'Estimated 1 rep max',
      value: x => Math.max(...x.sets.map(y => epley(y.w, y.r))),
      detail: x => {
        const b = x.sets.reduce((best, y) => (epley(y.w, y.r) > epley(best.w, best.r) ? y : best));
        return `From ${fmt(b.w)} ${db.unit} × ${plural(b.r, 'rep')}`;
      },
    },
  };
  if (!METRICS[prefs.metric]) prefs.metric = 'vol';
  if (!PERIODS[prefs.period]) prefs.period = '1M';

  function periodRange() {
    const end = dateOf(todayKey());
    const start = new Date(end);
    PERIODS[prefs.period].back(start);
    return { start, end, sKey: keyOf(start), eKey: keyOf(end) };
  }

  function renderProgress() {
    const idx = exerciseIndex();
    const all = [...idx.values()];
    if (!prefs.ex || !idx.has(prefs.ex)) {
      const recent = all.slice().sort((a, b) => b.last.localeCompare(a.last))[0];
      prefs.ex = recent ? recent.key : null;
    }
    el.exSelect.replaceChildren(...(all.length
      ? all.sort((a, b) => a.name.localeCompare(b.name)).map(e => h('option', { value: e.key, text: e.name }))
      : [h('option', { text: 'No exercises logged yet' })]));
    el.exSelect.disabled = !all.length;
    if (prefs.ex) el.exSelect.value = prefs.ex;
    setSeg(el.metricSeg, prefs.metric);
    setSeg(el.periodSeg, prefs.period);
    el.ormNote.hidden = prefs.metric !== 'orm';

    const { start, end, sKey, eKey } = periodRange();
    const words = PERIODS[prefs.period].words;
    const M = METRICS[prefs.metric];
    const exName = prefs.ex ? idx.get(prefs.ex).name : '';

    const sessions = prefs.ex ? sessionsOf(prefs.ex).filter(x => x.date >= sKey && x.date <= eKey) : [];
    const pts = sessions.map(x => ({ date: x.date, t: +dateOf(x.date), v: M.value(x), detail: M.detail(x) }));
    chartCard(el.exCard, pts, {
      start, end, name: M.name, goodUp: true,
      empty: all.length ? `No ${exName} sessions in the last ${words}.` : 'Log a workout and your progress will show up here.',
      stats: v => [['Sessions', String(v.length)], ['Best', fmt(Math.max(...v))], ['Average', fmt(avg(v))]],
    });
    entryList(el.exEntries, pts, 'No sessions in this period.');

    const bwPts = sortedKeys()
      .filter(k => k >= sKey && k <= eKey && db.days[k].bw != null)
      .map(k => ({ date: k, t: +dateOf(k), v: db.days[k].bw, detail: 'Body weight' }));
    chartCard(el.bwCard, bwPts, {
      start, end, name: 'Body weight', goodUp: null,
      empty: `No body weight logged in the last ${words}. Add it on the Workout tab.`,
      stats: v => [['Lowest', fmt(Math.min(...v))], ['Highest', fmt(Math.max(...v))], ['Average', fmt(avg(v))]],
    });
    entryList(el.bwEntries, bwPts, 'No entries in this period.');
  }

  const avg = v => v.reduce((a, b) => a + b, 0) / v.length;

  function chartCard(card, pts, o) {
    const ro = { label: $('.ro-label', card), val: $('.ro-val', card), unit: $('.ro-unit', card), sub: $('.ro-sub', card) };
    const statsEl = $('.stats', card);

    function showDefault() {
      if (!pts.length) {
        ro.label.textContent = o.name;
        ro.val.textContent = '–';
        ro.unit.textContent = '';
        ro.sub.textContent = '';
        ro.sub.className = 'ro-sub';
        return;
      }
      const first = pts[0], last = pts[pts.length - 1];
      ro.label.textContent = `${o.name} · ${fmtDate(last.date, SHORT)}`;
      ro.val.textContent = fmt(last.v);
      ro.unit.textContent = db.unit;
      if (pts.length < 2) {
        ro.sub.textContent = 'Only one entry in this period';
        ro.sub.className = 'ro-sub';
        return;
      }
      const d = last.v - first.v;
      const pct = first.v ? (d / first.v) * 100 : null;
      const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '=';
      ro.sub.textContent = `${arrow} ${fmt(Math.abs(d))} ${db.unit}${pct != null && d ? ` (${d > 0 ? '+' : '−'}${fmt(Math.abs(pct))}%)` : ''} since ${fmtDate(first.date, SHORT)}`;
      ro.sub.className = 'ro-sub' + (o.goodUp == null || !d ? '' : (d > 0) === o.goodUp ? ' up' : ' down');
    }

    function showPoint(i) {
      const p = pts[i];
      ro.label.textContent = fmtDate(p.date, { weekday: 'short', month: 'short', day: 'numeric', year: thisYear(p.date) ? undefined : 'numeric' });
      ro.val.textContent = fmt(p.v);
      ro.unit.textContent = db.unit;
      ro.sub.textContent = p.detail;
      ro.sub.className = 'ro-sub';
    }

    showDefault();
    drawChart($('.chart', card), pts, {
      start: o.start, end: o.end, label: o.name, empty: o.empty,
      onSelect: i => (i == null ? showDefault() : showPoint(i)),
    });

    statsEl.hidden = !pts.length;
    if (pts.length) {
      statsEl.replaceChildren(...o.stats(pts.map(p => p.v)).map(([label, val]) =>
        h('div', { class: 'stat' }, h('div', { class: 'stat-label', text: label }), h('div', { class: 'stat-val', text: val }))));
    }
  }

  // The table twin of each chart: every value readable without touching the chart.
  function entryList(details, pts, emptyText) {
    const list = $('.entry-list', details);
    if (!pts.length) { list.replaceChildren(h('div', { class: 'entry-none', text: emptyText })); return; }
    list.replaceChildren(...pts.slice().reverse().map(p =>
      h('button', { type: 'button', class: 'entry', dataset: { date: p.date } },
        h('span', { class: 'entry-date', text: fmtDate(p.date, { weekday: 'short', month: 'short', day: 'numeric', year: thisYear(p.date) ? undefined : 'numeric' }) }),
        h('span', { class: 'entry-val', text: `${fmt(p.v)} ${db.unit}` }),
        p.detail !== 'Body weight' ? h('span', { class: 'entry-detail', text: p.detail }) : null)));
  }
  [el.exEntries, el.bwEntries].forEach(d => d.addEventListener('click', e => {
    const row = e.target.closest('.entry');
    if (row) openDay(row.dataset.date);
  }));

  function niceScale(min, max) {
    const floorAtZero = min >= 0;
    if (min === max) { const p = Math.abs(min) * 0.1 || 1; min -= p; max += p; }
    const raw = (max - min) / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / mag;
    const step = (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * mag;
    let lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    if (floorAtZero && lo < 0) lo = 0;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return { lo, hi, ticks };
  }

  function xTicks(start, end) {
    const ticks = [];
    const p = prefs.period;
    if (p === '1W') {
      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        ticks.push({ t: +d, label: d.toLocaleDateString(undefined, { weekday: 'short' }) });
      }
    } else if (p === '1M') {
      for (const d = new Date(end); d >= start; d.setDate(d.getDate() - 7)) {
        ticks.unshift({ t: +d, label: d.toLocaleDateString(undefined, SHORT) });
      }
    } else {
      const stepMonths = p === '1Y' ? 2 : 1;
      for (const d = new Date(start.getFullYear(), start.getMonth() + 1, 1); d <= end; d.setMonth(d.getMonth() + stepMonths)) {
        ticks.push({ t: +d, label: d.toLocaleDateString(undefined, { month: 'short' }) });
      }
    }
    return ticks;
  }

  function drawChart(host, pts, o) {
    host.replaceChildren();
    host.onkeydown = null;
    host.onblur = null;
    host._clear = null;
    host.removeAttribute('tabindex');
    if (!pts.length) {
      host.append(h('div', { class: 'chart-empty', text: o.empty }));
      return;
    }

    const vals = pts.map(p => p.v);
    const { lo, hi, ticks } = niceScale(Math.min(...vals), Math.max(...vals));
    // Compact labels (1.2K) unless that would make two ticks read the same.
    let yLabels = ticks.map(compact);
    if (new Set(yLabels).size < yLabels.length) yLabels = ticks.map(fmt);

    const W = Math.max(260, Math.round(host.clientWidth || 340));
    const H = 190;
    const m = { l: Math.max(30, Math.max(...yLabels.map(l => l.length)) * 6.5 + 12), r: 10, t: 10, b: 26 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const inset = 8; // keeps edge markers off the axis
    const t0 = +o.start, t1 = +o.end;
    const x = t => m.l + inset + (t1 > t0 ? (t - t0) / (t1 - t0) : 0.5) * (pw - inset * 2);
    const y = v => m.t + (hi === lo ? ph / 2 : ((hi - v) / (hi - lo)) * ph);

    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': `${o.label} over time, ${plural(pts.length, 'point')}` });

    ticks.forEach((tv, i) => {
      const yy = Math.round(y(tv)) + 0.5;
      s('line', { class: 'grid', x1: m.l, x2: W - m.r, y1: yy, y2: yy }, svg);
      s('text', { class: 'axis', x: m.l - 8, y: yy + 4, 'text-anchor': 'end' }, svg).textContent = yLabels[i];
    });
    for (const tk of xTicks(o.start, o.end)) {
      s('text', { class: 'axis', x: x(tk.t).toFixed(1), y: H - 6, 'text-anchor': 'middle' }, svg).textContent = tk.label;
    }

    const xy = pts.map(p => [x(p.t), y(p.v)]);
    if (pts.length > 1) {
      const d = xy.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)} ${b.toFixed(1)}`).join('');
      const base = (m.t + ph).toFixed(1);
      s('path', { class: 'area', d: `${d}L${xy[xy.length - 1][0].toFixed(1)} ${base}L${xy[0][0].toFixed(1)} ${base}Z` }, svg);
      s('path', { class: 'line', d }, svg);
    }
    const dense = pts.length > 40;
    xy.forEach(([a, b], i) => {
      if (!dense || i === xy.length - 1) s('circle', { class: 'dot', cx: a.toFixed(1), cy: b.toFixed(1), r: 4 }, svg);
    });

    const cross = s('line', { class: 'crosshair', y1: m.t, y2: m.t + ph, visibility: 'hidden' }, svg);
    const focus = s('circle', { class: 'dot', r: 6, visibility: 'hidden' }, svg);
    host.append(svg);

    let sel = null;
    function select(i) {
      sel = i;
      const vis = i == null ? 'hidden' : 'visible';
      cross.setAttribute('visibility', vis);
      focus.setAttribute('visibility', vis);
      if (i != null) {
        const [a, b] = xy[i];
        cross.setAttribute('x1', a); cross.setAttribute('x2', a);
        focus.setAttribute('cx', a); focus.setAttribute('cy', b);
      }
      o.onSelect(i);
    }
    function nearest(clientX) {
      const r = svg.getBoundingClientRect();
      const px = (clientX - r.left) * (W / r.width);
      let best = 0;
      xy.forEach(([a], i) => { if (Math.abs(a - px) < Math.abs(xy[best][0] - px)) best = i; });
      return best;
    }
    // The crosshair snaps to the nearest session, so you never have to hit a dot exactly.
    svg.addEventListener('pointerdown', e => select(nearest(e.clientX)));
    svg.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) select(nearest(e.clientX)); });
    svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') select(null); });
    host.tabIndex = 0;
    host.onkeydown = e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.key === 'ArrowRight' ? 1 : -1;
        select(sel == null ? xy.length - 1 : Math.max(0, Math.min(xy.length - 1, sel + step)));
      } else if (e.key === 'Escape') select(null);
    };
    host.onblur = () => select(null);
    host._clear = () => { if (sel != null) select(null); };
  }

  // Tapping anywhere outside a chart puts its readout back to the latest value.
  document.addEventListener('pointerdown', e => {
    $$('.chart').forEach(c => { if (!c.contains(e.target) && c._clear) c._clear(); });
  });

  el.exSelect.addEventListener('change', () => { prefs.ex = el.exSelect.value; savePrefs(); renderProgress(); });
  el.metricSeg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) { prefs.metric = b.dataset.v; savePrefs(); renderProgress(); }
  });
  el.periodSeg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) { prefs.period = b.dataset.v; savePrefs(); renderProgress(); }
  });

  /* ================= HISTORY tab ================= */

  function renderHistory() {
    const keys = sortedKeys().reverse().filter(k => hasData(db.days[k]));
    if (!keys.length) {
      el.history.replaceChildren(h('div', { class: 'empty-state' },
        h('strong', { text: 'No workouts yet' }),
        'Days you log on the Workout tab will appear here.'));
      return;
    }
    const t = todayKey();
    const out = [];
    let month = '';
    for (const k of keys) {
      const day = db.days[k];
      const mo = fmtDate(k, { month: 'long', year: 'numeric' });
      if (mo !== month) { month = mo; out.push(h('h2', { class: 'section-title', text: mo })); }

      let sets = 0, vol = 0;
      const lines = [];
      for (const ex of day.ex) {
        const valid = ex.sets.filter(isValidSet);
        if (!valid.length) continue;
        for (const x of valid) { sets++; vol += x.w * x.r; }
        lines.push(h('li', null,
          h('span', { class: 'hx-name', text: ex.name }),
          h('span', { class: 'hx-sets', text: valid.map(x => `${fmt(x.w)}×${x.r}`).join(', ') })));
      }
      const typeTag = day.type && lines.length ? TYPE_LABEL[day.type] : null;

      out.push(h('button', { type: 'button', class: 'card hist-day', dataset: { date: k } },
        h('div', { class: 'hd-top' },
          h('span', { class: 'hd-date', text: fmtDate(k, { weekday: 'short', month: 'short', day: 'numeric' }) }),
          typeTag ? h('span', { class: 'tag', text: typeTag }) : null,
          k === t ? h('span', { class: 'tag muted', text: 'Today' }) : null,
          day.bw != null ? h('span', { class: 'hd-bw', text: `${fmt(day.bw)} ${db.unit}` }) : null),
        lines.length ? h('ul', { class: 'hd-ex' }, lines) : null,
        lines.length ? h('div', { class: 'hd-foot', text: `${plural(lines.length, 'exercise')} · ${plural(sets, 'set')} · ${fmt(vol)} ${db.unit} volume` }) : null));
    }
    el.history.replaceChildren(...out);
  }

  el.history.addEventListener('click', e => {
    const card = e.target.closest('.hist-day');
    if (card) openDay(card.dataset.date);
  });

  /* ================= settings ================= */

  el.settingsBtn.addEventListener('click', () => {
    setSeg(el.unitSeg, db.unit);
    el.settings.showModal();
  });
  el.settings.addEventListener('click', e => { if (e.target === el.settings) el.settings.close(); });

  el.unitSeg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    db.unit = b.dataset.v;
    save();
    setSeg(el.unitSeg, db.unit);
    renderActive();
  });

  el.exportBtn.addEventListener('click', async () => {
    const json = JSON.stringify({ app: 'spinn', exported: new Date().toISOString(), ...db });
    const name = `spinn-backup-${todayKey()}.json`;
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Spinn backup' }); return; }
      catch (err) { if (err.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(file);
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });

  el.importBtn.addEventListener('click', () => el.importFile.click());
  el.importFile.addEventListener('change', async () => {
    const file = el.importFile.files[0];
    el.importFile.value = '';
    if (!file) return;
    let data;
    try { data = sanitize(JSON.parse(await file.text())); } catch { data = null; }
    if (!data) { toast('That file isn’t a Spinn backup.'); return; }
    const n = Object.keys(data.days).length;
    const cur = Object.keys(db.days).length;
    if (cur && !confirm(`Replace your current data (${plural(cur, 'day')}) with this backup (${plural(n, 'day')})?`)) return;
    db = data;
    save();
    el.settings.close();
    renderActive();
    toast(`Imported ${plural(n, 'day')}`);
  });

  el.wipeBtn.addEventListener('click', () => {
    if (!confirm('Delete ALL workouts, body weight entries and your Upper/Lower routines from this device? This can’t be undone.')) return;
    db = emptyDb(db.unit);
    save();
    el.settings.close();
    renderActive();
    toast('All data deleted');
  });

  /* ================= tabs ================= */

  let activeTab = 'log';
  const scrollMem = {};
  const RENDER = { log: renderLog, progress: renderProgress, history: renderHistory };
  const renderActive = () => RENDER[activeTab]();

  function showTab(name, resetScroll) {
    if (name === activeTab && !resetScroll) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    scrollMem[activeTab] = window.scrollY;
    activeTab = name;
    $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    $$('.tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    RENDER[name]();
    window.scrollTo(0, resetScroll ? 0 : scrollMem[name] || 0);
  }

  function openDay(k) {
    curDate = k;
    if (activeTab === 'log') { renderLog(); window.scrollTo(0, 0); }
    else showTab('log', true);
  }

  $$('.tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (activeTab === 'progress') renderProgress(); }, 150);
  });

  // If the app sits open past midnight, roll "today" forward when it comes back.
  let knownToday = todayKey();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') { save(); return; } // belt and braces: every edit already saves

    const t = todayKey();
    if (t === knownToday) return;
    if (curDate === knownToday) curDate = t;
    knownToday = t;
    renderActive();
  });

  renderLog();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    // When a new version installs, reload once so the update shows up on this launch, not the next.
    const hadWorker = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadWorker || reloaded) return;
      reloaded = true;
      save();
      location.reload();
    });
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
