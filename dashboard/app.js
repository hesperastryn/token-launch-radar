// Token Launch Radar — the page. It renders window.RADAR, the dataset main.ts writes beside the
// page as ../data.js from the sealed snapshot, into four views: the ranked board, one protocol's
// detail, the already-tokenised protocols, and the records the screen set aside. No fetch and no
// network: every number here was computed by the model in lib/model.ts, and a detail view's farm
// plan is the board's own farm_steps for that protocol, word for word.
//
// The hash is the address bar's whole state, so a view can be linked and screenshotted:
//   #/                  the board          #/protocol/<slug>   one protocol's detail
//   #/live              already trade      #/aside             set aside, with reasons
//   #/?cat=Dexs&watch=1 the board, filtered (cat, chain, q, watch, sort are the board's controls)

'use strict';

const R = window.RADAR;

/** A DOM element with a class and, optionally, text. */
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Dollars the way a reader scans them: $1.24B, $356M, $7.8K, $940. */
function money(n) {
  if (n === null || n === undefined) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n}`;
}

/** A signed per-cent, or an em dash when the snapshot reports none. */
function pct(n) {
  if (n === null || n === undefined) return '—';
  const s = n > 0 ? '+' : '';
  return `${s}${n.toFixed(1)}%`;
}

/** Days as a short age: 486d, or 2y 41d past two years. */
function ageText(days) {
  if (days === null || days === undefined) return '—';
  if (days < 730) return `${days}d`;
  const y = Math.floor(days / 365);
  return `${y}y ${days - y * 365}d`;
}

/** The address bar's state, parsed: a view plus the board's controls. */
function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query] = raw.split('?');
  const params = new URLSearchParams(query || '');
  const state = {
    view: 'board',
    slug: null,
    q: params.get('q') || '',
    cat: params.get('cat') || '',
    chain: params.get('chain') || '',
    watch: params.get('watch') === '1',
    sort: params.get('sort') || 'implied',
  };
  if (path === '/live') state.view = 'live';
  else if (path === '/aside') state.view = 'aside';
  else if (path.startsWith('/protocol/')) {
    state.view = 'detail';
    state.slug = decodeURIComponent(path.slice('/protocol/'.length));
  }
  return state;
}

/** The hash for a board state, so a filtered board can be linked as it stands. */
function boardHash(state) {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.cat) params.set('cat', state.cat);
  if (state.chain) params.set('chain', state.chain);
  if (state.watch) params.set('watch', '1');
  if (state.sort && state.sort !== 'implied') params.set('sort', state.sort);
  const qs = params.toString();
  return `#/${qs ? `?${qs}` : ''}`;
}

/* ---------------- masthead, model strip, tabs, colophon ---------------- */

function renderMasthead() {
  const head = document.getElementById('masthead');
  head.textContent = '';
  const brand = el('div', 'brand');
  brand.append(el('span', 'mark', '◎'), el('h1', null, 'Token Launch Radar'), el('span', 'tag', 'Pre-token protocols ranked by implied value — and what to do about each one'));
  const stamp = el('div', 'stamp', `Snapshot as of ${R.as_of} · ${R.source} · model ${R.model_version}`);
  const stats = el('div', 'stats');
  const c = R.counts;
  const items = [
    [`${c.protocols}`, 'protocols scanned'],
    [`${c.pre_token}`, 'record no token'],
    [`${c.board}`, 'on the board'],
    [`${c.watchlist} / ${c.watchlist}`, 'watchlist covered'],
    [`${c.set_aside}`, 'set aside'],
  ];
  for (const [n, k] of items) {
    const s = el('div', 'stat');
    s.append(el('div', 'n', n), el('div', 'k', k));
    stats.append(s);
  }
  head.append(brand, stamp, stats, modelStrip());
}

function modelStrip() {
  const box = el('section', 'model');
  box.append(el('h2', null, `The model — ${R.model_version}`));
  const formula = el('p', 'formula', 'implied value = TVL × category multiple × growth factor × maturity factor × breadth factor, capped at 3× TVL');
  const cal = R.calibration;
  const text = el('p');
  text.innerHTML =
    `The category multiple is <b>calibrated from this snapshot</b>: across the ${cal.live_count} protocols whose token already trades ` +
    `with a market cap and a TVL on record, the median market cap is <b>${cal.global_median}× TVL</b> (ratios winsorized to 0.005–3×, so one thin ` +
    `market sets no category's price); each category's multiple is its own ` +
    `median shrunk toward that figure by the count behind it, so no name is ever special-cased. Growth answers the seven-day TVL change, ` +
    `clamped to −50%…+100% before it can shout. Maturity rewards a record — years run with no token — and breadth gives a small premium ` +
    `for chains reached. A protocol is said to <b>record</b> no token, never to have none.`;
  const chips = el('div', 'calib');
  for (const row of cal.categories.slice(0, 9)) {
    const chip = el('span');
    chip.append(document.createTextNode(`${row.category} `), el('b', null, `×${row.multiple.toFixed(3)}`), document.createTextNode(` (n=${row.live_count})`));
    chips.append(chip);
  }
  box.append(formula, text, chips);
  return box;
}

function renderTabs(state) {
  const nav = document.getElementById('tabs');
  nav.textContent = '';
  const views = [
    ['board', 'The board', R.counts.board, '#/'],
    ['live', 'Already trade', R.live.length, '#/live'],
    ['aside', 'Set aside', R.counts.set_aside, '#/aside'],
  ];
  for (const [view, label, count, hash] of views) {
    const b = el('button', null, label);
    b.append(el('span', 'count', `${count}`));
    b.setAttribute('aria-selected', state.view === view || (state.view === 'detail' && view === 'board') ? 'true' : 'false');
    b.addEventListener('click', () => {
      location.hash = hash;
    });
    nav.append(b);
  }
}

function renderColophon() {
  const foot = document.getElementById('colophon');
  foot.textContent =
    'Implied value is this radar’s own claim — what a token would be worth if the protocol issued one on the record it has today — ' +
    'never a prediction that one is issued. Farm plans are starting points, not advice; every step is taken in the protocol’s own app. ' +
    `Data: ${R.source}.`;
}

/* ---------------- the board ---------------- */

const SORTS = {
  implied: (a, b) => a.rank - b.rank,
  tvl: (a, b) => b.tvl_usd - a.tvl_usd || a.rank - b.rank,
  growth: (a, b) => (b.change_7d ?? -Infinity) - (a.change_7d ?? -Infinity) || a.rank - b.rank,
  age: (a, b) => (b.age_days ?? -1) - (a.age_days ?? -1) || a.rank - b.rank,
  name: (a, b) => (a.name < b.name ? -1 : 1),
};

function filteredRows(state) {
  const q = state.q.trim().toLowerCase();
  return R.rows
    .filter((r) => !state.cat || (r.category ?? 'Uncategorized') === state.cat)
    .filter((r) => !state.chain || r.chains.includes(state.chain))
    .filter((r) => !state.watch || r.on_watchlist)
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.slug.includes(q))
    .sort(SORTS[state.sort] || SORTS.implied);
}

function controls(state) {
  const bar = el('div', 'controls');
  const cats = [...new Set(R.rows.map((r) => r.category ?? 'Uncategorized'))].sort();
  const chainCounts = new Map();
  for (const r of R.rows) for (const ch of r.chains) chainCounts.set(ch, (chainCounts.get(ch) || 0) + 1);
  const chains = [...chainCounts.entries()].sort((a, b) => b[1] - a[1]).map(([ch]) => ch);

  const mkSelect = (label, value, options, onChange) => {
    const wrap = el('label', null, label);
    const sel = el('select');
    for (const opt of options) {
      const o = el('option', null, opt.label);
      o.value = opt.value;
      if (opt.value === value) o.selected = true;
      sel.append(o);
    }
    sel.addEventListener('change', () => onChange(sel.value));
    wrap.append(sel);
    return wrap;
  };
  const go = (patch) => {
    location.hash = boardHash({ ...state, ...patch });
  };

  const searchWrap = el('label', null, 'Search');
  const search = el('input');
  search.type = 'search';
  search.placeholder = 'Protocol or slug…';
  search.value = state.q;
  search.addEventListener('change', () => go({ q: search.value }));
  searchWrap.append(search);
  bar.append(
    searchWrap,
    mkSelect('Category', state.cat, [{ value: '', label: 'All categories' }, ...cats.map((c) => ({ value: c, label: c }))], (v) => go({ cat: v })),
    mkSelect('Chain', state.chain, [{ value: '', label: 'All chains' }, ...chains.map((c) => ({ value: c, label: c }))], (v) => go({ chain: v })),
    mkSelect('Sort', state.sort, [
      { value: 'implied', label: 'Implied value' },
      { value: 'tvl', label: 'TVL' },
      { value: 'growth', label: '7d change' },
      { value: 'age', label: 'Age' },
      { value: 'name', label: 'Name' },
    ], (v) => go({ sort: v })),
  );
  const check = el('label', 'check');
  const box = el('input');
  box.type = 'checkbox';
  box.checked = state.watch;
  box.addEventListener('change', () => go({ watch: box.checked }));
  check.append(box, document.createTextNode('Watchlist only'));
  bar.append(check);
  return bar;
}

function boardTable(rows) {
  const table = el('table', 'board');
  const head = el('thead');
  const hr = el('tr');
  const cols = [
    ['#', ''],
    ['Protocol', ''],
    ['Category', ''],
    ['Chains', ''],
    ['TVL', 'num'],
    ['7d', 'num'],
    ['Age', 'num'],
    ['Implied value', 'num'],
  ];
  for (const [label, cls] of cols) hr.append(el('th', cls, label));
  head.append(hr);
  table.append(head);
  const body = el('tbody');
  const top = rows.length > 0 ? rows.reduce((m, r) => Math.max(m, r.implied_value_usd), 0) : 0;
  for (const r of rows) {
    const tr = el('tr');
    tr.append(el('td', 'rank', `${r.rank}`));
    const name = el('td', 'pname', r.name);
    if (r.on_watchlist) name.append(el('span', 'wl', '◆ watchlist'));
    tr.append(name);
    tr.append(el('td', 'cat', r.category ?? 'Uncategorized'));
    tr.append(el('td', 'chains', r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? ` +${r.chains.length - 3}` : '')));
    tr.append(el('td', 'num', money(r.tvl_usd)));
    const chg = el('td', 'num', pct(r.change_7d));
    if (r.change_7d !== null) chg.classList.add(r.change_7d > 0.05 ? 'up' : r.change_7d < -0.05 ? 'down' : 'flat');
    tr.append(chg);
    tr.append(el('td', 'num', ageText(r.age_days)));
    const imp = el('td', 'num', money(r.implied_value_usd));
    const bar = el('span', 'bar');
    const fill = el('i');
    fill.style.width = `${Math.max(2, Math.round((r.implied_value_usd / top) * 90))}px`;
    bar.append(fill);
    imp.append(bar);
    tr.append(imp);
    tr.addEventListener('click', () => {
      location.hash = `#/protocol/${encodeURIComponent(r.slug)}`;
    });
    body.append(tr);
  }
  table.append(body);
  return table;
}

function renderBoard(state, main) {
  main.append(controls(state));
  const rows = filteredRows(state);
  const bar = main.querySelector('.controls');
  bar.append(el('span', 'result', `${rows.length} of ${R.rows.length} protocols`));
  if (rows.length === 0) {
    main.append(el('div', 'empty', 'No protocol on the board matches those controls. Loosen a filter — the radar keeps the whole snapshot either way.'));
    return;
  }
  main.append(boardTable(rows));
}

/* ---------------- one protocol's detail ---------------- */

function factorRow(name, value, frac, shown) {
  const row = el('div', 'factor');
  const track = el('div', 'ftrack');
  const fill = el('div', 'ffill');
  fill.style.width = `${Math.round(Math.min(1, Math.max(0, frac)) * 100)}%`;
  track.append(fill);
  row.append(el('span', 'fname', name), track, el('span', 'fval', shown ?? `${value}`));
  return row;
}

function renderDetail(state, main) {
  const row = R.rows.find((r) => r.slug === state.slug);
  const box = el('section', 'detail');
  const back = el('button', 'back', '← Back to the board');
  back.addEventListener('click', () => {
    location.hash = '#/';
  });
  box.append(back);
  if (!row) {
    box.append(el('h2', null, 'Not on the board'), el('p', 'sub', 'That protocol is not one of the ranked rows — it may already trade, or the screen set it aside.'));
    main.append(box);
    return;
  }
  const title = el('h2', null, row.name);
  if (row.on_watchlist) title.append(el('span', 'wl', '◆ on the watchlist'));
  box.append(title);
  box.append(el('p', 'sub', `${row.category ?? 'Uncategorized'} · ${row.chains.join(', ') || 'chain not recorded'} · rank ${row.rank} of ${R.rows.length} · records no token`));

  const cols = el('div', 'cols');
  const left = el('div');
  left.append(el('h3', null, 'The record'));
  const facts = el('dl', 'facts');
  const fact = (k, v) => {
    facts.append(el('dt', null, k), el('dd', null, v));
  };
  fact('TVL', money(row.tvl_usd));
  fact('7d change', pct(row.change_7d));
  fact('Running for', row.age_days === null ? `not recorded — counted as the median ${R.counts.median_age_days}d` : `${ageText(row.age_days)} (${row.age_days} days)`);
  fact('Listed since', row.listed_at ?? 'not recorded');
  fact('Chains', `${row.chains.length} — ${row.chains.join(', ') || 'none recorded'}`);
  fact('Watchlist', row.on_watchlist ? 'yes — above the $50M floor, no token recorded' : 'no — found below the floor by the radar');
  left.append(facts);

  left.append(el('h3', null, 'The model’s working'));
  const m = row.model;
  left.append(
    factorRow('Category multiple', m.category_multiple, m.category_multiple / 1.5, `×${m.category_multiple.toFixed(3)}`),
    factorRow('Growth factor', m.growth_factor, (m.growth_factor - 0.3) / 1.3, `×${m.growth_factor.toFixed(3)}`),
    factorRow('Maturity factor', m.maturity_factor, (m.maturity_factor - 0.55) / 0.65, `×${m.maturity_factor.toFixed(3)}`),
    factorRow('Breadth factor', m.breadth_factor, (m.breadth_factor - 1) / 0.18, `×${m.breadth_factor.toFixed(3)}`),
  );
  const raw = row.tvl_usd * m.category_multiple * m.growth_factor * m.maturity_factor * m.breadth_factor;
  const capped = raw > row.tvl_usd * R.model.value_cap_x_tvl;
  const imp = el('div', 'implied', `${money(row.implied_value_usd)} `);
  imp.append(el('small', null, `implied value${capped ? ' (capped at 3× TVL)' : ''} — ${money(row.tvl_usd)} TVL × the four factors`));
  left.append(imp);

  const right = el('div');
  right.append(el('h3', null, 'The farm plan'));
  const plan = el('ol', 'plan');
  for (const step of row.farm_steps) plan.append(el('li', null, step));
  right.append(plan);

  cols.append(left, right);
  box.append(cols);
  main.append(box);
}

/* ---------------- already trade / set aside ---------------- */

function renderLive(main) {
  const note = el('p', 'note', 'These protocols already have a token: the radar does not rank them and invents no value for them — the market cap shown is the market’s own. They are kept apart from the board so a reader never mistakes a trading token for a launch still to come. The largest 36 by market cap:');
  const grid = el('div', 'cards');
  for (const p of R.live) {
    const card = el('div', 'card');
    const nm = el('div', 'nm', p.name);
    if (p.symbol) nm.append(el('span', 'sym', p.symbol));
    const vals = el('div', 'vals');
    const v1 = el('span', null, money(p.mcap_usd));
    v1.prepend(el('small', null, 'Market cap'));
    const v2 = el('span', null, money(p.tvl_usd));
    v2.prepend(el('small', null, 'TVL'));
    vals.append(v1, v2);
    card.append(nm, el('div', 'meta', `${p.category ?? 'Uncategorized'} · ${p.chains.slice(0, 3).join(', ')}`), vals);
    grid.append(card);
  }
  main.append(note, grid);
}

function renderAside(main) {
  const note = el('p', 'note', 'These records carry no token either — but they are products of tokens that already trade, or venues, or later versions of an existing line. Ranking them as launches would be the radar lying about its biggest rows, so they are set aside, with the reason, largest first:');
  const list = el('div', 'aside-list');
  for (const p of R.aside) {
    const row = el('div', 'aside-row');
    row.append(el('span', 'nm', p.name), el('span', 'tvl', money(p.tvl_usd)), el('span', 'why', p.reason_text));
    list.append(row);
  }
  main.append(note, list);
}

/* ---------------- go ---------------- */

function render() {
  const main = document.getElementById('board');
  if (!R) {
    main.textContent = '';
    main.append(el('div', 'empty', 'The radar’s data did not load: data.js sits beside this page and is written by the radar’s program.'));
    return;
  }
  const state = parseHash();
  renderMasthead();
  renderTabs(state);
  renderColophon();
  main.textContent = '';
  main.setAttribute('aria-busy', 'false');
  if (state.view === 'detail') renderDetail(state, main);
  else if (state.view === 'live') renderLive(main);
  else if (state.view === 'aside') renderAside(main);
  else renderBoard(state, main);
}

window.addEventListener('hashchange', render);
render();
