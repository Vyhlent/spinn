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
  const ICON_GRIP = 'M5 8h14M5 12h14M5 16h14';

  /* ================= storage ================= */

  const STORE_KEY = 'spinn.data.v1';
  const PREFS_KEY = 'spinn.prefs.v1';
  const numOrNull = n => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null);

  // Data shape:
  // { unit: 'lb'|'kg',
  //   routines: { upper: [name], lower: [name] },   exercises shown on every day of that type
  //   days: { 'YYYY-MM-DD': { bw: number|null, type?: 'upper'|'lower', ex: [{ id, name, sets: [{ w, r }] }] } } }
  //   muscles: { [normalised exercise name]: { p: [muscle id], s: [muscle id] } }   your edits; else auto-guessed
  //   target: { lo, hi }   weekly sets per muscle
  const TYPES = ['upper', 'lower'];
  const TYPE_LABEL = { upper: 'Upper', lower: 'Lower' };
  const M = window.SPINN_MUSCLES;
  const emptyDb = (unit = 'lb') => ({ unit, routines: { upper: [], lower: [] }, days: {}, muscles: {}, target: { lo: 10, hi: 20 } });

  function sanitize(src) {
    if (!src || typeof src !== 'object' || !src.days || typeof src.days !== 'object') return null;
    const out = emptyDb(src.unit === 'kg' ? 'kg' : 'lb');
    if (src.muscles && typeof src.muscles === 'object') {
      for (const [k, v] of Object.entries(src.muscles)) {
        if (!v || typeof v !== 'object') continue;
        const p = [...new Set((Array.isArray(v.p) ? v.p : []).filter(id => M.IDS.includes(id)))];
        const s = [...new Set((Array.isArray(v.s) ? v.s : []).filter(id => M.IDS.includes(id) && !p.includes(id)))];
        out.muscles[norm(k)] = { p, s };
      }
    }
    if (src.target && Number.isInteger(src.target.lo) && Number.isInteger(src.target.hi)
        && src.target.lo >= 2 && src.target.hi >= src.target.lo) {
      out.target = { lo: src.target.lo, hi: src.target.hi };
    }
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

  const prefs = { ex: null, metric: 'vol', period: '1M', body: 'day', bars: 'sets' };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS_KEY)) || {}); } catch { /* defaults */ }
  if (!['day', 'week'].includes(prefs.body)) prefs.body = 'day';
  if (!['sets', 'vol'].includes(prefs.bars)) prefs.bars = 'sets';
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

  // An exercise's muscles: what you picked, else the built-in guess, else null (untagged).
  function musclesOf(name) {
    const key = norm(name);
    return db.muscles[key] || M.guess(key);
  }
  const isTagged = m => !!m && (m.p.length + m.s.length) > 0;

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
    typeSeg: $('#typeSeg'),
    mSummary: $('#mSummary'), untaggedCard: $('#untaggedCard'), untaggedChips: $('#untaggedChips'),
    bodySeg: $('#bodySeg'), bodyFigs: $('#bodyFigs'), bodyReadout: $('#bodyReadout'), bodyLegend: $('#bodyLegend'),
    barSeg: $('#barSeg'), dayBars: $('#dayBars'), weekSub: $('#weekSub'), weekList: $('#weekList'),
    picker: $('#musclePicker'), pickerTitle: $('#pickerTitle'), pickerSummary: $('#pickerSummary'),
    pickerGroups: $('#pickerGroups'), pickerReset: $('#pickerReset'),
    targetLo: $('#targetLo'), targetHi: $('#targetHi'),
    bwInput: $('#bwInput'), daySummary: $('#daySummary'), daySummaryRow: $('#daySummaryRow'), exList: $('#exerciseList'),
    reorderBtn: $('#reorderBtn'), reorderSheet: $('#reorderSheet'), reorderTitle: $('#reorderTitle'),
    reorderNote: $('#reorderNote'), reorderList: $('#reorderList'),
    calPrev: $('#calPrev'), calNext: $('#calNext'), calTitle: $('#calTitle'), calGrid: $('#calGrid'), calCount: $('#calCount'),
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

  // Workout and Muscles share one date, so both date bars always show the same day.
  function renderDateBars() {
    const t = todayKey();
    const rel = relDay(curDate);
    const main = rel || fmtDate(curDate, { weekday: 'long' });
    const sub = fmtDate(curDate, {
      weekday: rel ? 'long' : undefined,
      month: 'long',
      day: 'numeric',
      year: thisYear(curDate) ? undefined : 'numeric',
    });
    $$('.js-date-main').forEach(n => { n.textContent = main; });
    $$('.js-date-sub').forEach(n => { n.textContent = sub; });
    $$('.js-date').forEach(n => { n.value = curDate; });
    $$('.js-past').forEach(n => { n.hidden = curDate === t; });
    $$('.js-past-text').forEach(n => { n.textContent = curDate < t ? 'Viewing a past day' : 'Viewing a future day'; });
  }

  function renderLog() {
    renderDateBars();
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
      muscleLine(ex.name),
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

  // "Chest + Triceps, Front delts" under the exercise name; tap to edit.
  const muscleNames = ids => ids.map(id => M.NAME[id]).join(', ');
  function muscleLine(name) {
    const m = musclesOf(name);
    if (!isTagged(m)) {
      return h('button', { type: 'button', class: 'ex-muscles untagged', dataset: { name }, 'aria-label': `Add muscles for ${name}` },
        icon(ICON_PLUS, 14), 'Add muscles');
    }
    return h('button', { type: 'button', class: 'ex-muscles', dataset: { name },
      'aria-label': `Muscles for ${name}: ${muscleNames(m.p) || 'none'} primary${m.s.length ? `; ${muscleNames(m.s)} secondary` : ''}. Tap to change.` },
    h('span', { class: 'mp', text: muscleNames(m.p) }),
    m.s.length ? h('span', { class: 'ms', text: `${m.p.length ? ' + ' : ''}${muscleNames(m.s)}` }) : null);
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
    el.daySummaryRow.hidden = !exs.length;
    el.daySummary.textContent = `${done} of ${plural(exs.length, 'exercise')} done · ${plural(sets, 'set')} · ${fmt(vol)} ${db.unit} volume`;
    el.reorderBtn.hidden = db.routines[typeOf(curDate)].length < 2;
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
    card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // Unknown exercise: ask which muscles it works. Known ones were filled in automatically.
    if (!isTagged(musclesOf(name))) openPicker(name);
    else $('.w', card).focus({ preventScroll: true });
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
    } else if (btn.classList.contains('ex-muscles')) {
      openPicker(btn.dataset.name);
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

  /* ----- reorder sheet: drag the handles (or use arrow keys); order is saved on the routine ----- */

  let reorderType = 'upper';

  el.reorderBtn.addEventListener('click', () => {
    reorderType = typeOf(curDate);
    const label = TYPE_LABEL[reorderType];
    el.reorderTitle.textContent = `Reorder ${label}`;
    el.reorderNote.textContent = `Drag the handles to change the order. It's saved and used on every ${label} day.`;
    renderReorder();
    el.reorderSheet.showModal();
  });
  el.reorderSheet.addEventListener('click', e => { if (e.target === el.reorderSheet) el.reorderSheet.close(); });
  el.reorderSheet.addEventListener('close', () => renderLog());

  function renderReorder(focusIndex) {
    const list = db.routines[reorderType];
    el.reorderList.replaceChildren(...list.map((name, i) =>
      h('li', { class: 'reorder-row' },
        h('span', { class: 'reorder-name', text: name }),
        h('button', { type: 'button', class: 'drag-handle', 'aria-label': `Move ${name}, ${i + 1} of ${list.length}. Use the up and down arrow keys.` },
          icon(ICON_GRIP, 22)))));
    if (focusIndex != null) $$('.drag-handle', el.reorderList)[focusIndex].focus();
  }

  function moveInRoutine(from, to) {
    const list = db.routines[reorderType];
    to = Math.max(0, Math.min(list.length - 1, to));
    if (to === from) return from;
    list.splice(to, 0, list.splice(from, 1)[0]);
    save();
    return to;
  }

  el.reorderList.addEventListener('keydown', e => {
    const handle = e.target.closest('.drag-handle');
    if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const from = $$('.drag-handle', el.reorderList).indexOf(handle);
    renderReorder(moveInRoutine(from, from + (e.key === 'ArrowUp' ? -1 : 1)));
  });

  el.reorderList.addEventListener('pointerdown', e => {
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;
    e.preventDefault();
    const rows = $$('.reorder-row', el.reorderList);
    const row = handle.closest('.reorder-row');
    const from = rows.indexOf(row);
    const rowH = row.offsetHeight; // rows are a fixed height
    const startY = e.clientY;
    let to = from;
    handle.setPointerCapture(e.pointerId);
    row.classList.add('dragging');

    const onMove = ev => {
      const dy = Math.max(-from * rowH, Math.min((rows.length - 1 - from) * rowH, ev.clientY - startY));
      row.style.transform = `translateY(${dy}px)`;
      to = from + Math.round(dy / rowH);
      rows.forEach((r, i) => {
        if (r === row) return;
        const shift = from < to && i > from && i <= to ? -rowH : from > to && i < from && i >= to ? rowH : 0;
        r.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    };
    const onEnd = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
      moveInRoutine(from, to);
      renderReorder();
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
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
    renderActive();
    window.scrollTo(0, 0);
  }
  $$('.js-prev').forEach(b => b.addEventListener('click', () => goToDate(addDays(curDate, -1))));
  $$('.js-next').forEach(b => b.addEventListener('click', () => goToDate(addDays(curDate, 1))));
  $$('.js-today').forEach(b => b.addEventListener('click', () => goToDate(todayKey())));
  $$('.js-date').forEach(input => {
    input.addEventListener('change', () => goToDate(input.value));
    input.addEventListener('click', () => {
      // Desktop browsers only open the calendar from its icon; iOS opens it on tap by itself.
      if (matchMedia('(pointer: fine)').matches && input.showPicker) {
        try { input.showPicker(); } catch { /* already open */ }
      }
    });
  });

  /* ================= MUSCLES tab ================= */

  const fmtSets = v => {
    const whole = Math.floor(v), half = v - whole >= 0.5;
    return whole ? `${whole}${half ? '½' : ''}` : half ? '½' : '0';
  };
  const setsText = v => `${fmtSets(v)} ${v === 1 ? 'set' : 'sets'}`;

  // Sets and volume per muscle over a date range (inclusive). Primary muscles get the
  // full set count, secondary muscles get half.
  function muscleTotals(fromKey, toKey) {
    const per = Object.fromEntries(M.IDS.map(id => [id, { sets: 0, vol: 0, ex: new Map() }]));
    const untagged = new Set();
    for (const k of sortedKeys()) {
      if (k < fromKey || k > toKey) continue;
      for (const ex of db.days[k].ex) {
        const valid = ex.sets.filter(isValidSet);
        if (!valid.length) continue;
        const m = musclesOf(ex.name);
        if (!isTagged(m)) { untagged.add(ex.name); continue; }
        const vol = valid.reduce((a, x) => a + x.w * x.r, 0);
        const credit = (ids, share) => ids.forEach(id => {
          const t = per[id];
          t.sets += valid.length * share;
          t.vol += vol * share;
          t.ex.set(ex.name, (t.ex.get(ex.name) || 0) + valid.length * share);
        });
        credit(m.p, 1);
        credit(m.s, 0.5);
      }
    }
    return { per, untagged: [...untagged] };
  }

  // Body map shading: 0 = not worked, 1-4 = one blue ramp, light to dark.
  function binOf(v, mode) {
    if (v <= 0) return 0;
    if (mode === 'day') { const r = Math.round(v); return r <= 2 ? 1 : r <= 4 ? 2 : r <= 6 ? 3 : 4; }
    const { lo, hi } = db.target;
    const half = Math.ceil(lo / 2);
    return v < half ? 1 : v < lo ? 2 : v <= hi ? 3 : 4;
  }
  function binLabels(mode) {
    if (mode === 'day') return ['1–2 sets', '3–4', '5–6', '7+'];
    const { lo, hi } = db.target;
    const half = Math.ceil(lo / 2);
    return [`< ${half}`, `${half}–${fmtSets(lo - 0.5)}`, `${lo}–${hi}`, `> ${hi}`];
  }

  let bodyData = null; // { per, mode } currently drawn
  let bodySel = null;  // muscle id tapped on the map

  function renderBody(per, mode) {
    bodyData = { per, mode };
    el.bodyFigs.replaceChildren(...['front', 'back'].map(view => {
      const svg = s('svg', { viewBox: '0 0 120 250', class: 'body-svg', role: 'img',
        'aria-label': `${view === 'front' ? 'Front' : 'Back'} of the body, shaded by sets per muscle` });
      s('ellipse', { ...M.HEAD, class: 'bm-part' }, svg);
      for (const mirrored of [false, true]) {
        const g = s('g', mirrored ? { transform: 'translate(120 0) scale(-1 1)' } : {}, svg);
        for (const [id, d] of M.HALF[view]) {
          const p = s('path', { d, class: id ? `bm-muscle b${binOf(per[id].sets, mode)}` : 'bm-part' }, g);
          if (id) p.dataset.m = id;
        }
      }
      return h('figure', { class: 'body-fig' }, svg, h('figcaption', { text: view === 'front' ? 'Front' : 'Back' }));
    }));
    el.bodyLegend.replaceChildren(
      h('span', { class: 'lg' }, h('i', { class: 'sw b0' }), 'None'),
      ...binLabels(mode).map((label, i) => h('span', { class: 'lg' }, h('i', { class: `sw b${i + 1}` }), label)));
    renderBodyReadout();
  }

  function renderBodyReadout() {
    const { per, mode } = bodyData;
    const span = mode === 'week' ? 'in the last 7 days' : 'on this day';
    $$('.bm-muscle', el.bodyFigs).forEach(p => p.classList.toggle('sel', p.dataset.m === bodySel));
    if (!bodySel) { el.bodyReadout.textContent = `Tap a muscle to see its sets ${span}.`; return; }
    const t = per[bodySel];
    el.bodyReadout.replaceChildren(h('b', { text: M.NAME[bodySel] }), `: ${setsText(t.sets)} ${span}`,
      t.ex.size ? ` (${[...t.ex].map(([n, c]) => `${n} ${fmtSets(c)}`).join(', ')})` : '');
  }

  el.bodyFigs.addEventListener('click', e => {
    const p = e.target.closest('[data-m]');
    bodySel = p ? p.dataset.m : null;
    renderBodyReadout();
  });

  function renderDayBars(per) {
    const byVol = prefs.bars === 'vol';
    const rows = M.IDS.map(id => ({ id, ...per[id] })).filter(r => r.sets > 0)
      .sort((a, b) => (byVol ? b.vol - a.vol : b.sets - a.sets) || b.sets - a.sets);
    if (!rows.length) {
      el.dayBars.replaceChildren(h('p', { class: 'empty-hint small', text: 'No muscles worked on this day yet.' }));
      return;
    }
    const max = Math.max(...rows.map(r => (byVol ? r.vol : r.sets))) || 1;
    el.dayBars.replaceChildren(...rows.map(r => {
      const v = byVol ? r.vol : r.sets;
      const volText = `${fmt(r.vol)} ${db.unit}`;
      return h('div', { class: 'mbar' },
        h('div', { class: 'mbar-top' },
          h('span', { class: 'mbar-name', text: M.NAME[r.id] }),
          h('span', { class: 'mbar-vals' },
            h('b', { text: byVol ? volText : setsText(r.sets) }),
            ` · ${byVol ? setsText(r.sets) : volText}`)),
        h('div', { class: 'mbar-track' }, h('div', { class: 'mbar-fill', style: `width:${Math.max(1.5, (v / max) * 100)}%` })),
        h('div', { class: 'mbar-ex', text: [...r.ex].map(([n, c]) => `${n} ${fmtSets(c)}`).join(' · ') }));
    }));
  }

  function renderWeek(per, fromKey) {
    const { lo, hi } = db.target;
    el.weekSub.textContent = `${fmtDate(fromKey, SHORT)} – ${fmtDate(curDate, SHORT)} · target ${lo}–${hi} sets per muscle`;
    const scaleMax = Math.max(hi * 1.25, ...M.IDS.map(id => per[id].sets));
    const counts = { under: 0, in: 0, over: 0 };
    const STATUS = { under: ['↓', 'Under target'], in: ['✓', 'In target range'], over: ['↑', 'Over target'] };
    const rows = [];
    for (const g of M.GROUPS) {
      rows.push(h('h3', { class: 'wk-group', text: g.label }));
      for (const id of g.muscles) {
        const v = per[id].sets;
        const status = v < lo ? 'under' : v <= hi ? 'in' : 'over';
        counts[status]++;
        rows.push(h('div', { class: `wk-row ${status}` },
          h('span', { class: 'wk-name', text: M.NAME[id] }),
          h('span', { class: 'wk-track', 'aria-hidden': 'true' },
            h('span', { class: 'wk-band', style: `left:${(lo / scaleMax) * 100}%;width:${((hi - lo) / scaleMax) * 100}%` }),
            h('span', { class: 'wk-fill', style: `width:${Math.min(100, (v / scaleMax) * 100)}%` })),
          h('span', { class: 'wk-val', text: fmtSets(v) }),
          h('span', { class: 'wk-status', text: STATUS[status][0], title: STATUS[status][1], 'aria-label': STATUS[status][1] })));
      }
    }
    el.weekList.replaceChildren(
      h('p', { class: 'wk-summary' },
        h('b', { text: `${counts.in} of ${M.IDS.length}` }), ` muscles in range · ${counts.under} under · ${counts.over} over`),
      ...rows);
  }

  function renderMuscles() {
    renderDateBars();
    const weekFrom = addDays(curDate, -6);
    const day = muscleTotals(curDate, curDate);
    const week = muscleTotals(weekFrom, curDate);

    const d = dayOf(curDate);
    const sets = d ? d.ex.reduce((a, ex) => a + ex.sets.filter(isValidSet).length, 0) : 0;
    const worked = M.IDS.filter(id => day.per[id].sets > 0).length;
    el.mSummary.textContent = sets
      ? `${TYPE_LABEL[typeOf(curDate)]} day · ${plural(sets, 'set')} · ${plural(worked, 'muscle')} worked`
      : 'Nothing logged on this day yet.';

    const untagged = [...new Set([...day.untagged, ...week.untagged])];
    el.untaggedCard.hidden = !untagged.length;
    el.untaggedChips.replaceChildren(...untagged.map(n => h('button', { type: 'button', class: 'chip plain', text: n, dataset: { name: n } })));

    setSeg(el.bodySeg, prefs.body);
    setSeg(el.barSeg, prefs.bars);
    renderBody(prefs.body === 'week' ? week.per : day.per, prefs.body);
    renderDayBars(day.per);
    renderWeek(week.per, weekFrom);
  }

  el.untaggedChips.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip) openPicker(chip.dataset.name);
  });
  el.bodySeg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) { prefs.body = b.dataset.v; savePrefs(); renderMuscles(); }
  });
  el.barSeg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) { prefs.bars = b.dataset.v; savePrefs(); renderMuscles(); }
  });

  /* ----- muscle picker: tap = primary, tap again = secondary, again = off ----- */

  let pickerName = '';
  const byListOrder = (a, b) => M.IDS.indexOf(a) - M.IDS.indexOf(b);

  function openPicker(name) {
    pickerName = name;
    el.pickerTitle.textContent = name;
    renderPicker();
    el.picker.showModal();
  }

  function renderPicker(focusId) {
    const m = musclesOf(pickerName) || { p: [], s: [] };
    el.pickerSummary.textContent = isTagged(m)
      ? `Primary: ${muscleNames(m.p) || 'none'}${m.s.length ? ` · Secondary: ${muscleNames(m.s)}` : ''}`
      : 'No muscles picked yet.';
    el.pickerGroups.replaceChildren(...M.GROUPS.map(g => h('div', { class: 'pick-group' },
      h('h3', { text: g.label }),
      h('div', { class: 'chips' }, g.muscles.map(id => {
        const state = m.p.includes(id) ? 'p' : m.s.includes(id) ? 's' : '';
        const stateText = state === 'p' ? 'primary' : state === 's' ? 'secondary' : 'not used';
        return h('button', { type: 'button', class: `mchip ${state}`, dataset: { id }, 'aria-label': `${M.NAME[id]}, ${stateText}` },
          M.NAME[id], state === 's' ? h('span', { class: 'half', text: '½' }) : null);
      })))));
    // "Reset" only makes sense when you've overridden a built-in suggestion.
    el.pickerReset.parentElement.hidden = !(M.guess(norm(pickerName)) && db.muscles[norm(pickerName)]);
    if (focusId) $(`.mchip[data-id="${focusId}"]`, el.pickerGroups).focus();
  }

  el.pickerGroups.addEventListener('click', e => {
    const chip = e.target.closest('.mchip');
    if (!chip) return;
    const id = chip.dataset.id;
    const cur = musclesOf(pickerName) || { p: [], s: [] };
    const next = { p: cur.p.filter(x => x !== id), s: cur.s.filter(x => x !== id) };
    if (cur.p.includes(id)) next.s.push(id);       // primary -> secondary
    else if (!cur.s.includes(id)) next.p.push(id); // off -> primary; secondary -> off
    next.p.sort(byListOrder);
    next.s.sort(byListOrder);
    db.muscles[norm(pickerName)] = next;
    save();
    renderPicker(document.activeElement === chip ? id : null);
  });
  el.pickerReset.addEventListener('click', () => {
    delete db.muscles[norm(pickerName)];
    save();
    renderPicker();
  });
  el.picker.addEventListener('click', e => { if (e.target === el.picker) el.picker.close(); });
  el.picker.addEventListener('close', () => renderActive());

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

  // The month shown in the calendar; the day list below follows it. Starts on the current month.
  let calMonth = null;
  const monthPrefix = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-`;
  const workoutKind = d => (d && hasSets(d) ? d.type || 'other' : null);

  function renderCalendar() {
    const now = new Date();
    if (!calMonth) calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const isThisMonth = y === now.getFullYear() && m === now.getMonth();
    el.calTitle.textContent = calMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    el.calTitle.disabled = isThisMonth;

    const t = todayKey();
    const cells = [];
    const sunday = new Date(2024, 0, 7); // any Sunday, for weekday initials
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday); d.setDate(d.getDate() + i);
      cells.push(h('span', { class: 'cal-wd', text: d.toLocaleDateString(undefined, { weekday: 'narrow' }), 'aria-hidden': 'true' }));
    }
    for (let i = new Date(y, m, 1).getDay(); i > 0; i--) cells.push(h('span', { class: 'cal-cell empty' }));

    const counts = { upper: 0, lower: 0, other: 0 };
    const daysIn = new Date(y, m + 1, 0).getDate();
    for (let n = 1; n <= daysIn; n++) {
      const k = keyOf(new Date(y, m, n));
      const kind = workoutKind(db.days[k]);
      if (kind) counts[kind]++;
      const label = fmtDate(k, { weekday: 'long', month: 'long', day: 'numeric' })
        + (kind ? `, ${kind === 'other' ? 'workout' : `${TYPE_LABEL[kind]} workout`}` : '');
      cells.push(h('button', { type: 'button', class: `cal-cell${k === t ? ' today' : ''}`, dataset: { date: k }, 'aria-label': label },
        h('span', { class: 'cal-num', text: n }),
        h('span', { class: `cal-dot ${kind || ''}` })));
    }
    el.calGrid.replaceChildren(...cells);
    const total = counts.upper + counts.lower + counts.other;
    el.calCount.textContent = plural(total, 'workout');
  }

  el.calGrid.addEventListener('click', e => {
    const cell = e.target.closest('.cal-cell[data-date]');
    if (cell) openDay(cell.dataset.date);
  });
  const shiftMonth = n => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + n, 1); renderHistory(); };
  el.calPrev.addEventListener('click', () => shiftMonth(-1));
  el.calNext.addEventListener('click', () => shiftMonth(1));
  el.calTitle.addEventListener('click', () => { calMonth = null; renderHistory(); });

  function renderHistory() {
    renderCalendar();
    const prefix = monthPrefix(calMonth);
    const keys = sortedKeys().reverse().filter(k => k.startsWith(prefix) && hasData(db.days[k]));
    if (!keys.length) {
      const monthName = calMonth.toLocaleDateString(undefined, { month: 'long' });
      el.history.replaceChildren(h('div', { class: 'empty-state' },
        h('strong', { text: `Nothing logged in ${monthName}` }),
        'Tap a day in the calendar to log or edit it.'));
      return;
    }
    const t = todayKey();
    const out = [];
    for (const k of keys) {
      const day = db.days[k];
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
          typeTag ? h('span', { class: `tag ${day.type}`, text: typeTag }) : null,
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
    el.targetLo.value = db.target.lo;
    el.targetHi.value = db.target.hi;
    el.settings.showModal();
  });

  function saveTarget() {
    const lo = parseInt(el.targetLo.value, 10), hi = parseInt(el.targetHi.value, 10);
    if (lo >= 2 && hi >= lo && hi <= 99) {
      db.target = { lo, hi };
      save();
    } else {
      toast('Use a range like 10–20 (lowest 2, highest 99).');
    }
    el.targetLo.value = db.target.lo;
    el.targetHi.value = db.target.hi;
  }
  el.targetLo.addEventListener('change', saveTarget);
  el.targetHi.addEventListener('change', saveTarget);
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
    if (!confirm('Delete ALL workouts, body weight entries, your Upper/Lower routines and muscle tags from this device? This can’t be undone.')) return;
    db = emptyDb(db.unit);
    save();
    el.settings.close();
    renderActive();
    toast('All data deleted');
  });

  /* ================= tabs ================= */

  let activeTab = 'log';
  const scrollMem = {};
  const RENDER = { log: renderLog, muscles: renderMuscles, progress: renderProgress, history: renderHistory };
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
