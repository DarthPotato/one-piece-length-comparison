import { SHOWS, PACKS, ONE_PIECE_DEFAULTS, findShow, SAGAS, sagaFor } from './data.js';
import { searchShows, showDetails, lookupByImdb, ONE_PIECE_TVMAZE_ID } from './tvmaze.js';

// Posters are hotlinked from TVMaze at runtime — never committed to the repo.
const POSTER_ORIGIN = /^https:\/\/static\.tvmaze\.com\//;
let opPoster = localStorage.getItem('op-poster') || '';
if (opPoster && !POSTER_ORIGIN.test(opPoster)) opPoster = '';

/* ── State ─────────────────────────────────────────────────────────── */

const STORE_KEY = 'op-compare-v1';

// Stack colors: the categorical order minus red, which One Piece owns.
const STACK_SLOTS = 7;

const state = {
  selected: [], // { uid, id?, tvmazeId?, name, years, eps, min, approx, color }
  colorCounter: 0,
  // custom = the user pinned their own numbers; skip the TVMaze auto-sync.
  op: { eps: ONE_PIECE_DEFAULTS.eps, min: ONE_PIECE_DEFAULTS.min, movies: false, custom: false },
};

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      selected: state.selected,
      colorCounter: state.colorCounter,
      op: state.op,
    }));
  } catch { /* storage may be unavailable; the app still works */ }
}

function restore() {
  const fromHash = readHash();
  if (fromHash) return applySnapshot(fromHash);
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved.selected)) state.selected = saved.selected;
    if (Number.isInteger(saved.colorCounter)) state.colorCounter = saved.colorCounter;
    if (saved.op) state.op = { ...state.op, ...saved.op };
  } catch { /* corrupt storage — start fresh */ }
}

/* ── Share links (#v1=…) ───────────────────────────────────────────── */

function snapshot() {
  return {
    d: state.selected.filter((s) => s.id).map((s) => s.id),
    x: state.selected.filter((s) => !s.id).map((s) => [s.name, s.eps, s.min, s.approx ? 1 : 0, s.years || '']),
    o: [state.op.eps, state.op.min, state.op.movies ? 1 : 0],
  };
}

function readHash() {
  if (!location.hash.startsWith('#v1=')) return null;
  try {
    return JSON.parse(decodeURIComponent(location.hash.slice(4)));
  } catch {
    return null;
  }
}

function applySnapshot(snap) {
  state.selected = [];
  state.colorCounter = 0;
  for (const id of snap.d || []) {
    const s = findShow(id);
    if (s) pushShow({ id: s.id, name: s.name, years: s.years, eps: s.eps, min: s.min });
  }
  for (const [name, eps, min, approx, years] of snap.x || []) {
    if (typeof name === 'string' && eps > 0 && min > 0) {
      pushShow({ name, eps: Math.floor(eps), min: Math.floor(min), approx: !!approx, years: years || '' });
    }
  }
  if (Array.isArray(snap.o)) {
    const [eps, min, movies] = snap.o;
    if (eps > 0) state.op.eps = Math.floor(eps);
    if (min > 0) state.op.min = Math.floor(min);
    state.op.movies = !!movies;
    // A shared link pins its One Piece numbers so both people see the same chart.
    state.op.custom = true;
  }
}

/* ── Math & formatting ─────────────────────────────────────────────── */

const hoursOf = (s) => (s.eps * s.min) / 60;
const opHours = () =>
  (state.op.eps * state.op.min + (state.op.movies ? ONE_PIECE_DEFAULTS.moviesMinutes : 0)) / 60;
const stackHours = () => state.selected.reduce((t, s) => t + hoursOf(s), 0);

function fmtHours(h) {
  if (h >= 100) return Math.round(h).toLocaleString('en-US');
  if (h >= 10) return String(Math.round(h));
  return (Math.round(h * 10) / 10).toString();
}
function fmtTimes(x) {
  return x >= 10 ? String(Math.round(x)) : (Math.round(x * 10) / 10).toString();
}
function fmtPct(x) {
  return x >= 10 ? String(Math.round(x)) : (Math.round(x * 10) / 10).toString();
}

/* ── DOM helpers ───────────────────────────────────────────────────── */

const $ = (sel) => document.querySelector(sel);

// Names can come from TMDB — always insert them as text, never as markup.
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Pick black or white for text sitting on a colored fill — whichever
// contrasts more (WCAG relative luminance).
function inkFor(hex) {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (1.05) / (lum + 0.05) >= (lum + 0.05) / 0.05 ? '#ffffff' : '#0b0b0b';
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ── Selection ─────────────────────────────────────────────────────── */

function pushShow(show) {
  // Entries restored from a share link may carry no id at all — key on name.
  const uid = show.id || show.imdb
    || (show.tvmazeId ? `tv${show.tvmazeId}` : `x-${show.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
  if (state.selected.some((s) => s.uid === uid)) return false;
  state.selected.push({
    uid,
    ...show,
    color: state.colorCounter % STACK_SLOTS,
  });
  state.colorCounter += 1;
  return true;
}

function addShow(show) {
  if (!pushShow(show)) {
    toast(`${show.name} is already on the pile.`);
    return;
  }
  persist();
  renderAll();
  fillPosters();
}

/* ── Posters ───────────────────────────────────────────────────────────
   Fetched lazily, one at a time (TVMaze rate limits per visitor IP).
   img === undefined → not tried yet; null → tried, none available. */

const posterFailed = new Set(); // session-only, so transient errors retry next visit
let posterQueueRunning = false;

async function fillPosters() {
  if (posterQueueRunning) return;
  posterQueueRunning = true;
  try {
    for (;;) {
      const entry = state.selected.find((s) => s.img === undefined && !posterFailed.has(s.uid));
      if (!entry) break;
      try {
        let img = null;
        const imdb = entry.id || entry.imdb;
        if (imdb && imdb.startsWith('tt')) {
          ({ img } = await lookupByImdb(imdb));
        } else if (entry.tvmazeId) {
          ({ img } = await showDetails(entry.tvmazeId));
        }
        entry.img = img && POSTER_ORIGIN.test(img) ? img : null;
        persist();
        renderAll();
      } catch {
        posterFailed.add(entry.uid);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  } finally {
    posterQueueRunning = false;
  }
}

function removeShow(uid) {
  state.selected = state.selected.filter((s) => s.uid !== uid);
  persist();
  renderAll();
}

/* ── Stat tiles & header ───────────────────────────────────────────── */

function renderTiles() {
  const op = opHours();
  const stack = stackHours();
  const n = state.selected.length;

  $('#op-hours-inline').textContent = `≈${fmtHours(op)} hours`;
  $('#tile-op').textContent = `${fmtHours(op)} h`;
  $('#tile-op-sub').textContent =
    `${state.op.eps.toLocaleString('en-US')} eps × ${state.op.min} min` +
    (state.op.movies ? ` + ${ONE_PIECE_DEFAULTS.movieCount} films` : '');

  $('#tile-stack').textContent = `${fmtHours(stack)} h`;
  $('#tile-stack-sub').textContent = n === 1 ? '1 show' : `${n} shows`;

  const pct = op > 0 ? (stack / op) * 100 : 0;
  $('#tile-cover').textContent = `${fmtPct(pct)}%`;
  $('#tile-cover-sub').textContent =
    stack >= op && stack > 0
      ? 'One Piece: out-watched 🎉'
      : stack > 0
        ? `${fmtHours(op - stack)} h still unclaimed`
        : 'of One Piece covered';
}

function renderFunLine() {
  const op = opHours();
  const stack = stackHours();
  const line = $('#fun-line');
  if (stack === 0) {
    line.textContent = 'The right side is looking empty. Pick literally anything below.';
  } else if (stack < op) {
    const fits = op / stack;
    line.textContent =
      `One Piece is still ${fmtHours(op - stack)} hours longer than everything you picked, combined.` +
      (fits >= 2 ? ` You could watch this entire stack ${fmtTimes(fits)}× and still not be caught up.` : ' Getting close…');
  } else {
    line.textContent =
      `🎉 Your stack is ${fmtTimes(stack / op)}× One Piece — and unlike One Piece, most of it actually ended.`;
  }
  renderFactLine(op, stack);
}

// One deadpan stat at a time. Randomized (no immediate repeats), re-rolled
// whenever the stack actually changes — not on theme flips or resizes.
let lastFactSig = null;
let lastFactIdx = -1;
let lastFact = '';

function renderFactLine(op, stack) {
  const sig = `${state.selected.map((s) => s.uid).join('|')}~${state.op.eps}~${state.op.movies}`;
  if (sig !== lastFactSig) {
    const facts = buildFacts(op, stack);
    let idx = Math.floor(Math.random() * facts.length);
    if (facts.length > 1 && idx === lastFactIdx) idx = (idx + 1) % facts.length;
    lastFactSig = sig;
    lastFactIdx = idx;
    lastFact = facts[idx];
  }
  $('#fact-line').textContent = lastFact;
}

function buildFacts(op, stack) {
  const n = state.selected.length;
  return [
    `Watched nonstop, One Piece is ${fmtTimes(op / 24)} days without sleep. Chopper medically advises against this.`,
    `At two hours a night, One Piece takes ${fmtTimes(op / 2 / 30.4)} months. There will be new episodes by then. There are always new episodes.`,
    `One episode per day means finishing in ${fmtTimes(state.op.eps / 365)} years — assuming it ends, which is a bold assumption.`,
    `Skipping every opening and recap would save you roughly ${fmtHours((state.op.eps * 3) / 60)} hours. You'd still have ${fmtHours(op - (state.op.eps * 3) / 60)} to go.`,
    'The manga is still going after 28 years. The anime is chasing the manga. You would be chasing the anime. Nobody catches anyone.',
    'Episode one aired before Wikipedia existed. You could have read all of Wikipedia by now. All of it.',
    'One Piece has been airing across five US presidencies and at least three of your major life phases.',
    `Watching 8 hours a day, it's a full-time job for ${fmtTimes(op / 40)} weeks. The pay is worse, but there's a talking reindeer.`,
    `Roughly 480 hours gets you conversational Japanese. Same budget — and then you'd stop needing subtitles for everything else on this page.`,
    `Luffy yells attack names for an estimated 2% of the runtime. That's ${fmtHours(op * 0.02)} hours of yelling. (Estimate. Vibes-based.)`,
    n > 0 && `Your average pick runs ${fmtHours(stack / n)} h. One Piece is ${fmtTimes(op / (stack / n))} of those, stacked end to end.`,
    n > 0 && stack < op &&
      `Finish your entire stack and you'd still have ${fmtHours(op - stack)} hours left over — a language, an instrument, or one (1) personality overhaul.`,
    n > 0 && stack >= op &&
      `You've assembled ${fmtTimes(stack / op)} One Pieces worth of television that (mostly) respects your time.`,
  ].filter(Boolean);
}

/* ── Towers ────────────────────────────────────────────────────────── */

function niceStep(maxH) {
  for (const step of [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000]) {
    if (maxH / step <= 6) return step;
  }
  return 5000;
}

function renderGrid(maxH, towerPx) {
  const grid = $('#grid');
  grid.replaceChildren();
  const step = niceStep(maxH);
  for (let h = step; h <= maxH; h += step) {
    const y = (h / maxH) * towerPx;
    const line = el('div', { class: 'gridline' });
    line.style.bottom = `${y}px`;
    line.append(el('span', { class: 'gridlabel', text: `${h.toLocaleString('en-US')} h` }));
    grid.append(line);
  }
}

// Shared px-per-hour scale so hover handlers can convert a pointer Y back
// into hours (and hours into One Piece episodes).
const scaleCache = { maxH: 1, towerPx: 1 };

function segTooltipData(s) {
  const h = hoursOf(s);
  const op = opHours();
  return {
    name: s.name,
    color: `var(--cat-${s.color})`,
    value: `${fmtHours(h)} hours`,
    lines: [
      `${s.eps.toLocaleString('en-US')} eps × ${s.approx ? '≈' : ''}${s.min} min`,
      `${fmtPct((h / op) * 100)}% of One Piece`,
      `fits ${fmtTimes(op / h)}× inside One Piece`,
    ],
  };
}

// Hovering the One Piece tower reads out where on the voyage you are.
function opTooltipData(clientY) {
  const op = opHours();
  if (clientY !== undefined) {
    const rect = $('#op-block').getBoundingClientRect();
    const hours = Math.max(0, (rect.bottom - clientY) / (scaleCache.towerPx / scaleCache.maxH));
    const ep = Math.min(state.op.eps, Math.max(1, Math.round((hours * 60) / state.op.min)));
    return {
      name: 'One Piece',
      color: 'var(--op)',
      value: `≈ episode ${ep.toLocaleString('en-US')}`,
      lines: [
        `${sagaFor(ep).name} saga`,
        `${fmtHours(hours)} h into the voyage (${fmtPct((hours / op) * 100)}%)`,
        `whole thing: ${fmtHours(op)} h`,
      ],
    };
  }
  return {
    name: 'One Piece',
    color: 'var(--op)',
    value: `${fmtHours(op)} hours`,
    lines: [
      `${state.op.eps.toLocaleString('en-US')} eps × ${state.op.min} min` +
        (state.op.movies ? ` + ${ONE_PIECE_DEFAULTS.movieCount} films` : ''),
      `${fmtTimes(op / 24)} days without sleeping`,
      `${fmtTimes(op / 2 / 30.4)} months at 2 h every night`,
    ],
  };
}

function showTooltip(data, x, y) {
  const tip = $('#tooltip');
  tip.replaceChildren(
    el('div', { class: 'tip-value', text: data.value }),
    el('div', { class: 'tip-name' },
      el('span', { class: 'tip-key' }),
      data.name),
    ...data.lines.map((l) => el('div', { class: 'tip-line', text: l })),
  );
  tip.querySelector('.tip-key').style.background = data.color;
  tip.hidden = false;
  const rect = tip.getBoundingClientRect();
  const px = Math.min(Math.max(8, x + 14), window.innerWidth - rect.width - 8);
  const py = Math.min(Math.max(8, y - rect.height - 10), window.innerHeight - rect.height - 8);
  tip.style.transform = `translate(${px}px, ${py}px)`;
}

function hideTooltip() {
  $('#tooltip').hidden = true;
  document.querySelectorAll('.seg.hot').forEach((s) => s.classList.remove('hot'));
}

function towerHeightPx() {
  return $('#op-tower').clientHeight;
}

function renderTowers() {
  const op = opHours();
  const stack = stackHours();
  const maxH = Math.max(op, stack, 1) * 1.02; // small headroom above the taller side
  // reserve space at the top of the plot so the summit flag never overlaps
  // the tower headers
  const avail = Math.max(towerHeightPx() - 54, 120);
  const px = (h) => (h / maxH) * avail;
  scaleCache.maxH = maxH;
  scaleCache.towerPx = avail;

  renderGrid(maxH, avail);

  $('#op-head-hours').textContent = `${fmtHours(op)} h`;
  $('#stack-head-hours').textContent = `${fmtHours(stack)} h`;

  // One Piece block, saga ticks, summit flag, "your stack reaches here" marker
  const opBlock = $('#op-block');
  const opPx = px(op);
  opBlock.style.height = `${opPx}px`;
  opBlock.setAttribute('aria-label',
    `One Piece: ${state.op.eps.toLocaleString('en-US')} episodes, about ${fmtHours(op)} hours`);
  opBlock.classList.toggle('has-img', !!opPoster);
  opBlock.style.backgroundImage = opPoster
    ? `linear-gradient(color-mix(in srgb, var(--op) 22%, transparent), color-mix(in srgb, var(--op) 22%, transparent)), url("${opPoster}")`
    : '';
  $('#op-flag').style.bottom = `${opPx}px`;
  renderSagaTicks(px, opPx, stack > 0 && stack < op ? px(stack) : -Infinity);

  const reach = $('#reach-line');
  if (stack > 0 && stack < op) {
    const epEquiv = Math.min(state.op.eps, Math.max(1, Math.round((stack * 60) / state.op.min)));
    reach.querySelector('span').textContent =
      `your stack ≈ ep ${epEquiv.toLocaleString('en-US')} · ${sagaFor(epEquiv).name}`;
    reach.hidden = false;
    reach.style.bottom = `${px(stack)}px`;
  } else {
    reach.hidden = true;
  }

  // Stack segments, keyed by uid so heights animate on add/remove/rescale.
  const towerEl = $('#stack-tower');
  $('#stack-empty').hidden = state.selected.length > 0;
  const existing = new Map(
    [...towerEl.querySelectorAll('.seg')]
      .filter((n) => !n.dataset.removing)
      .map((n) => [n.dataset.uid, n]),
  );
  const wanted = new Set(state.selected.map((s) => s.uid));

  for (const [uid, node] of existing) {
    if (!wanted.has(uid)) {
      node.dataset.removing = '1';
      node.style.height = '0px';
      setTimeout(() => node.remove(), 500);
    }
  }

  // First pick sits at the bottom → last pick is first in DOM (column, justify-end).
  // The 2px surface gaps between segments are taken out of the segment heights,
  // so the pile's visual top lands exactly at px(stack) on the shared scale.
  const gapTotal = Math.max(0, state.selected.length - 1) * 2;
  const ordered = [...state.selected].reverse();
  for (const s of ordered) {
    let node = existing.get(s.uid);
    const isNew = !node;
    if (isNew) {
      node = el('div', { class: 'seg', tabindex: '0', role: 'img', 'data-uid': s.uid });
      node.style.height = '0px';
      node.append(el('span', { class: 'seg-label', 'aria-hidden': 'true' }));
    }
    const h = hoursOf(s);
    const target = Math.max(px(h) - (stack > 0 ? gapTotal * (h / stack) : 0), 3); // 3px visual floor
    node.style.setProperty('--seg-c', `var(--cat-${s.color})`);
    node.classList.toggle('has-img', !!s.img);
    node.style.backgroundImage = s.img
      ? `linear-gradient(color-mix(in srgb, var(--seg-c) 34%, transparent), color-mix(in srgb, var(--seg-c) 34%, transparent)), url("${s.img}")`
      : '';
    node.dataset.target = target;
    node.setAttribute('aria-label',
      `${s.name}: about ${fmtHours(h)} hours, ${fmtPct((h / opHours()) * 100)}% of One Piece`);
    towerEl.append(node); // append in order — reuses and reorders existing nodes
    if (isNew) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        node.style.height = `${target}px`;
      }));
    } else {
      node.style.height = `${target}px`;
    }
  }

  fitSegmentLabels();
}

// Saga boundary lines etched into the One Piece tower. Labels render only
// where the next boundary leaves enough room — the tooltip names the rest.
function renderSagaTicks(px, blockPx, reachY) {
  const blockEl = $('#op-block');
  blockEl.querySelectorAll('.saga-tick').forEach((n) => n.remove());
  const hourOfEp = (ep) => ((ep - 1) * state.op.min) / 60;
  const ticks = SAGAS.map((s) => ({ ...s, y: px(hourOfEp(s.ep)) }));
  ticks.forEach((s, i) => {
    if (s.ep === 1) return; // the baseline is East Blue's start
    if (s.y > blockPx - 8) return;
    const tick = el('div', { class: 'saga-tick', 'aria-hidden': 'true' });
    tick.style.bottom = `${s.y}px`;
    const ceiling = i + 1 < ticks.length ? Math.min(ticks[i + 1].y, blockPx) : blockPx;
    // label only when there's room, and never where the reach line's own
    // label would sit on top of it
    if (ceiling - s.y >= 24 && Math.abs(s.y - reachY) > 16) {
      tick.append(el('span', { class: 'saga-label', text: s.name }));
    }
    blockEl.append(tick);
  });
}

// In-segment labels are selective: only when the text genuinely fits.
// Everything is always available in the tooltip and the table below.
function fitSegmentLabels() {
  requestAnimationFrame(() => {
    for (const node of document.querySelectorAll('#stack-tower .seg')) {
      const s = state.selected.find((x) => x.uid === node.dataset.uid);
      const label = node.querySelector('.seg-label');
      if (!s || !label) continue;
      const target = parseFloat(node.dataset.target || '0');
      // On a poster the label sits on a surface-colored chip (CSS); on a
      // solid fill pick whichever of black/white contrasts more.
      const fill = cssVar(`--cat-${s.color}`);
      label.style.color = s.img ? '' : (fill ? inkFor(fill) : '');
      if (target < 22) { label.hidden = true; continue; }
      const avail = node.clientWidth - 16;
      label.hidden = false;
      label.textContent = `${s.name} · ${fmtHours(hoursOf(s))} h`;
      if (label.scrollWidth > avail) label.textContent = `${fmtHours(hoursOf(s))} h`;
      if (label.scrollWidth > avail) label.hidden = true;
    }
  });
}

function bindTowerHover() {
  const stackTower = $('#stack-tower');

  stackTower.addEventListener('pointermove', (e) => {
    // The whole tower is the hit area; resolve to the nearest segment so
    // 3px slivers are still hoverable.
    const segs = [...stackTower.querySelectorAll('.seg')].filter((n) => !n.dataset.removing);
    let best = null;
    let bestDist = Infinity;
    for (const node of segs) {
      const r = node.getBoundingClientRect();
      const d = e.clientY < r.top ? r.top - e.clientY : e.clientY > r.bottom ? e.clientY - r.bottom : 0;
      if (d < bestDist) { bestDist = d; best = node; }
    }
    if (!best || bestDist > 14) { hideTooltip(); return; }
    const s = state.selected.find((x) => x.uid === best.dataset.uid);
    if (!s) { hideTooltip(); return; }
    document.querySelectorAll('.seg.hot').forEach((n) => n !== best && n.classList.remove('hot'));
    best.classList.add('hot');
    showTooltip(segTooltipData(s), e.clientX, e.clientY);
  });
  stackTower.addEventListener('pointerleave', hideTooltip);

  // Keyboard focus gets the same readout as hover.
  stackTower.addEventListener('focusin', (e) => {
    const node = e.target.closest('.seg');
    if (!node) return;
    const s = state.selected.find((x) => x.uid === node.dataset.uid);
    if (!s) return;
    const r = node.getBoundingClientRect();
    showTooltip(segTooltipData(s), r.right, r.top + r.height / 2);
  });
  stackTower.addEventListener('focusout', hideTooltip);

  const opBlock = $('#op-block');
  opBlock.addEventListener('pointermove', (e) => showTooltip(opTooltipData(e.clientY), e.clientX, e.clientY));
  opBlock.addEventListener('pointerleave', hideTooltip);
  opBlock.addEventListener('focusin', () => {
    const r = opBlock.getBoundingClientRect();
    showTooltip(opTooltipData(), r.right, r.top + 40);
  });
  opBlock.addEventListener('focusout', hideTooltip);
}

/* ── Table (the always-available, screen-reader-friendly view) ─────── */

function renderTable() {
  const body = $('#picks-body');
  body.replaceChildren();
  const op = opHours();
  $('#table-empty').hidden = state.selected.length > 0;
  $('#picks-table').hidden = state.selected.length === 0;

  for (const s of state.selected) {
    const h = hoursOf(s);
    const swatch = el('span', { class: 'swatch', 'aria-hidden': 'true' });
    swatch.style.background = `var(--cat-${s.color})`;
    const row = el('tr', { draggable: 'true', 'data-uid': s.uid },
      el('td', { class: 'cell-name' },
        swatch,
        el('span', { text: s.name }),
        s.years ? el('span', { class: 'cell-years', text: ` ${s.years}` }) : ''),
      el('td', { class: 'num', text: s.eps.toLocaleString('en-US') }),
      el('td', { class: 'num', text: `${s.approx ? '≈' : ''}${s.min} min` }),
      el('td', { class: 'num', text: `${fmtHours(h)} h` }),
      el('td', { class: 'num', text: `${fmtPct((h / op) * 100)}%` }),
      el('td', { class: 'num', text: `${fmtTimes(op / h)}×` }),
      el('td', { class: 'cell-remove' },
        el('button', {
          class: 'remove-btn',
          'aria-label': `Remove ${s.name}`,
          onclick: () => removeShow(s.uid),
          text: '✕',
        })),
    );
    bindRowDrag(row);
    body.append(row);
  }

  if (state.selected.length > 0) {
    const stack = stackHours();
    body.append(el('tr', { class: 'total-row' },
      el('td', { text: 'Everything combined' }),
      el('td', { class: 'num', text: state.selected.reduce((t, s) => t + s.eps, 0).toLocaleString('en-US') }),
      el('td', { class: 'num', text: '' }),
      el('td', { class: 'num', text: `${fmtHours(stack)} h` }),
      el('td', { class: 'num', text: `${fmtPct((stack / op) * 100)}%` }),
      el('td', { class: 'num', text: stack > 0 ? `${fmtTimes(op / stack)}×` : '' }),
      el('td', {}),
    ));
  }
}

/* ── Drag to restack ───────────────────────────────────────────────── */

let dragUid = null;

function bindRowDrag(row) {
  row.addEventListener('dragstart', (e) => {
    dragUid = row.dataset.uid;
    e.dataTransfer.effectAllowed = 'move';
    row.classList.add('dragging');
  });
  row.addEventListener('dragend', () => {
    dragUid = null;
    row.classList.remove('dragging');
    document.querySelectorAll('#picks-body .drop-target').forEach((r) => r.classList.remove('drop-target'));
  });
  row.addEventListener('dragover', (e) => {
    if (!dragUid || dragUid === row.dataset.uid) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    row.classList.add('drop-target');
  });
  row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
  row.addEventListener('drop', (e) => {
    e.preventDefault();
    const from = state.selected.findIndex((s) => s.uid === dragUid);
    const to = state.selected.findIndex((s) => s.uid === row.dataset.uid);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = state.selected.splice(from, 1);
    state.selected.splice(to, 0, moved);
    persist();
    renderAll();
  });
}

/* ── Search combobox ───────────────────────────────────────────────── */

let activeIndex = -1;
let mazeTimer = null;
let mazeResults = [];
let mazeStatus = ''; // '', 'loading', 'error'

// SHOWS is sorted by vote count, so each group is already popularity-ranked.
function localMatches(q) {
  const norm = q.toLowerCase();
  const starts = [];
  const contains = [];
  for (const s of SHOWS) {
    const name = s.name.toLowerCase();
    if (name.startsWith(norm)) starts.push(s);
    else if (name.includes(norm)) contains.push(s);
  }
  return [...starts, ...contains].slice(0, 6);
}

function renderResults() {
  const list = $('#search-results');
  const q = $('#search').value.trim();
  list.replaceChildren();
  activeIndex = -1;
  if (q.length < 2) { list.hidden = true; return; }

  const rows = [];
  const shownLocal = new Set();
  for (const s of localMatches(q)) {
    shownLocal.add(s.id);
    const added = state.selected.some((x) => x.uid === s.id);
    rows.push({
      key: s.id,
      added,
      main: s.name,
      meta: `${s.years} · ${s.eps.toLocaleString('en-US')} eps × ${s.min} min ≈ ${fmtHours(hoursOf(s))} h`,
      pick: () => addShow({ id: s.id, name: s.name, years: s.years, eps: s.eps, min: s.min, approx: s.approx }),
    });
  }
  for (const r of mazeResults) {
    if (r.imdb && shownLocal.has(r.imdb)) continue; // already listed from the built-in set
    const added = state.selected.some((x) => x.uid === (r.imdb || `tv${r.tvmazeId}`));
    rows.push({
      key: `tv${r.tvmazeId}`,
      added,
      badge: 'TVMaze',
      main: r.name,
      meta: r.year || '',
      pick: async () => {
        try {
          const d = await showDetails(r.tvmazeId);
          // Prefer the built-in entry when TVMaze maps to one — better runtimes.
          const local = d.imdb && findShow(d.imdb);
          const img = d.img && POSTER_ORIGIN.test(d.img) ? d.img : undefined;
          if (local) {
            addShow({ id: local.id, name: local.name, years: local.years, eps: local.eps, min: local.min, approx: local.approx, img });
          } else if (!d.eps) {
            toast('TVMaze has no aired episodes listed for that one.');
          } else {
            addShow({ tvmazeId: d.tvmazeId, imdb: d.imdb, name: d.name, years: d.years, eps: d.eps, min: d.min, approx: d.approx, img: img ?? null });
          }
        } catch {
          toast('TVMaze lookup failed — maybe offline?');
        }
      },
    });
  }

  if (rows.length === 0 && mazeStatus !== 'loading') {
    list.append(el('li', { class: 'result-note', role: 'presentation', text: 'No matches.' }));
  }
  rows.forEach((r, i) => {
    const item = el('li', {
      class: `result${r.added ? ' added' : ''}`,
      role: 'option',
      id: `result-${i}`,
      'aria-selected': 'false',
    },
    el('span', { class: 'result-main' },
      el('span', { text: r.main }),
      r.badge ? el('span', { class: 'badge', text: r.badge }) : ''),
    el('span', { class: 'result-meta', text: r.added ? 'added ✓' : r.meta }));
    if (!r.added) {
      item.addEventListener('pointerdown', (e) => { e.preventDefault(); r.pick(); closeResults(); $('#search').value = ''; });
    }
    list.append(item);
  });
  if (mazeStatus === 'loading') {
    list.append(el('li', { class: 'result-note', role: 'presentation', text: 'Searching TVMaze…' }));
  } else if (mazeStatus === 'error') {
    list.append(el('li', { class: 'result-note', role: 'presentation', text: 'TVMaze search failed — maybe offline?' }));
  }
  list.hidden = false;
  $('#search').setAttribute('aria-expanded', 'true');
}

function closeResults() {
  $('#search-results').hidden = true;
  $('#search').setAttribute('aria-expanded', 'false');
  activeIndex = -1;
}

function moveActive(delta) {
  const options = [...$('#search-results').querySelectorAll('.result:not(.added)')];
  if (options.length === 0) return;
  activeIndex = (activeIndex + delta + options.length) % options.length;
  options.forEach((o, i) => o.classList.toggle('active', i === activeIndex));
  const current = options[activeIndex];
  current.setAttribute('aria-selected', 'true');
  $('#search').setAttribute('aria-activedescendant', current.id);
}

function bindSearch() {
  const input = $('#search');
  input.addEventListener('input', () => {
    const q = input.value.trim();
    mazeResults = [];
    mazeStatus = '';
    renderResults();
    clearTimeout(mazeTimer);
    if (q.length >= 2) {
      mazeStatus = 'loading';
      renderResults();
      mazeTimer = setTimeout(async () => {
        try {
          const results = await searchShows(q);
          if (input.value.trim() !== q) return; // stale response
          mazeResults = results;
          mazeStatus = '';
        } catch {
          mazeStatus = 'error';
        }
        renderResults();
      }, 350);
    }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const options = [...$('#search-results').querySelectorAll('.result:not(.added)')];
      const pick = options[activeIndex >= 0 ? activeIndex : 0];
      if (pick) pick.dispatchEvent(new Event('pointerdown'));
    } else if (e.key === 'Escape') closeResults();
  });
  input.addEventListener('blur', () => setTimeout(closeResults, 150));
}

/* ── Packs, settings, buttons ──────────────────────────────────────── */

let packsExpanded = false;

function renderPacks() {
  const wrap = $('#packs');
  wrap.replaceChildren();
  const visible = packsExpanded ? PACKS : PACKS.slice(0, 5);
  for (const pack of visible) {
    wrap.append(el('button', {
      class: 'chip',
      text: `+ ${pack.label}`,
      onclick: () => {
        let added = 0;
        for (const id of pack.shows) {
          const s = findShow(id);
          if (s && pushShow({ id: s.id, name: s.name, years: s.years, eps: s.eps, min: s.min, approx: s.approx })) added += 1;
        }
        persist();
        renderAll();
        fillPosters();
        toast(added > 0 ? `Added ${added} show${added === 1 ? '' : 's'}.` : 'Those are all on the pile already.');
      },
    }));
  }
  if (packsExpanded) {
    wrap.append(el('button', {
      class: 'chip chip-dice',
      text: '🎲 Surprise me',
      onclick: () => {
        const pool = SHOWS.filter((s) => !state.selected.some((x) => x.uid === s.id));
        if (pool.length === 0) return;
        const s = pool[Math.floor(Math.random() * pool.length)];
        addShow({ id: s.id, name: s.name, years: s.years, eps: s.eps, min: s.min, approx: s.approx });
        toast(`The Grand Line provides: ${s.name}.`);
      },
    }));
  }
  wrap.append(el('button', {
    class: 'chip',
    text: packsExpanded ? '− fewer packs' : `+ ${PACKS.length - 5} more packs…`,
    onclick: () => { packsExpanded = !packsExpanded; renderPacks(); },
  }));
}

function bindSettings() {
  const panel = $('#settings');
  const btn = $('#settings-btn');
  btn.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    btn.setAttribute('aria-expanded', String(!panel.hidden));
  });

  const epsInput = $('#op-eps');
  const minInput = $('#op-min');
  const moviesInput = $('#op-movies');
  epsInput.value = state.op.eps;
  minInput.value = state.op.min;
  moviesInput.checked = state.op.movies;

  epsInput.addEventListener('change', () => {
    const v = parseInt(epsInput.value, 10);
    if (v > 0) { state.op.eps = v; state.op.custom = true; persist(); renderAll(); }
  });
  minInput.addEventListener('change', () => {
    const v = parseInt(minInput.value, 10);
    if (v > 0) { state.op.min = v; state.op.custom = true; persist(); renderAll(); }
  });
  moviesInput.addEventListener('change', () => {
    state.op.movies = moviesInput.checked;
    persist();
    renderAll();
  });

  $('#op-sync').addEventListener('click', async () => {
    try {
      const d = await showDetails(ONE_PIECE_TVMAZE_ID);
      if (d.eps > 0) {
        state.op.eps = d.eps;
        state.op.custom = false; // back on auto-sync
        epsInput.value = d.eps;
        persist();
        renderAll();
        toast(`TVMaze says ${d.eps.toLocaleString('en-US')} episodes aired. Yep. Still going.`);
      }
    } catch {
      toast('Could not reach TVMaze — using the built-in count.');
    }
  });
}

// Keep the episode count current without anyone lifting a finger — unless
// the user pinned their own numbers.
async function syncOnePiece() {
  try {
    const d = await showDetails(ONE_PIECE_TVMAZE_ID);
    let changed = false;
    if (d.imgLarge && POSTER_ORIGIN.test(d.imgLarge) && d.imgLarge !== opPoster) {
      opPoster = d.imgLarge;
      localStorage.setItem('op-poster', opPoster);
      changed = true;
    }
    if (!state.op.custom && d.eps > 0 && d.eps !== state.op.eps) {
      state.op.eps = d.eps;
      const epsInput = $('#op-eps');
      if (epsInput) epsInput.value = d.eps;
      persist();
      changed = true;
    }
    if (changed) renderAll();
  } catch { /* offline — the built-in default stands */ }
}

/* ── Theme switcher ────────────────────────────────────────────────── */

const THEMES = [
  ['auto', 'Auto (system)'],
  ['light', 'Light'],
  ['dark', 'Dark'],
  ['wanted', 'Wanted Poster'],
  ['abyss', 'Abyss'],
];

function bindTheme() {
  const btn = $('#theme-btn');
  const menu = $('#theme-menu');

  const renderMenu = () => {
    const current = document.documentElement.dataset.theme || 'auto';
    menu.replaceChildren(...THEMES.map(([id, label]) =>
      el('li', {
        role: 'option',
        'aria-selected': String(id === current),
        onclick: () => {
          document.documentElement.dataset.theme = id;
          localStorage.setItem('op-theme', id);
          menu.hidden = true;
          btn.setAttribute('aria-expanded', 'false');
          renderAll(); // in-fill label inks depend on the palette
        },
      },
      el('span', { text: label }),
      id === current ? el('span', { class: 'check', text: '✓' }) : '')));
  };

  btn.addEventListener('click', () => {
    if (menu.hidden) renderMenu();
    menu.hidden = !menu.hidden;
    btn.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !e.target.closest('.menu-wrap')) {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

function bindButtons() {
  $('#clear-btn').addEventListener('click', () => {
    if (state.selected.length === 0) return;
    state.selected = [];
    persist();
    renderAll();
    toast('Cleared. A blank slate — unlike your watchlist.');
  });

  $('#share-btn').addEventListener('click', async () => {
    const hash = `#v1=${encodeURIComponent(JSON.stringify(snapshot()))}`;
    history.replaceState(null, '', hash);
    try {
      await navigator.clipboard.writeText(location.href);
      toast('Link copied — send someone your evidence.');
    } catch {
      toast('Link is in the address bar — copy it from there.');
    }
  });
}

/* ── Boot ──────────────────────────────────────────────────────────── */

function renderAll() {
  renderTiles();
  renderTowers();
  renderTable();
  renderFunLine();
}

restore();
renderPacks();
bindSearch();
bindSettings();
bindButtons();
bindTheme();
bindTowerHover();
renderAll();
syncOnePiece();
fillPosters();
// Bangers loads async — remeasure the display text once fonts settle.
if (document.fonts?.ready) document.fonts.ready.then(renderTowers);

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderTowers, 120);
});
// Re-pick in-fill label colors when the color scheme flips.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderAll);
