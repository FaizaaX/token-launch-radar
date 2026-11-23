// Token Launch Radar — dashboard logic (no framework, no network).
//
// Reads window.RADAR (written by main.ts from the sealed snapshot) and
// renders the board, the live-token view, the method page and one detail view
// per protocol. The implied values reprice live when the model sliders move:
//   implied = TVL x baseMultiple x growth x maturity x span
// with growth from the row's own 7-day change and the slider's weight, and
// maturity and span carried on the row. Farm plans are generated here from
// each row's category, chains, TVL and age — the same rules the board file
// was built with — so the page and the board never disagree.

(function () {
  'use strict';
  var D = window.RADAR;
  if (!D || !D.rows) {
    document.getElementById('view').innerHTML = '<p class="empty">No radar data loaded.</p>';
    return;
  }

  var $ = function (id) { return document.getElementById(id); };
  var state = {
    tab: 'board', q: '', cat: '', chain: '', minTvl: 0, sort: 'implied',
    watchOnly: false, base: 0.30, growthW: 0.60, detail: null, filterCat: null
  };

  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function moneyFull(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n > 0 ? '+' : '') + n.toFixed(2) + '%';
    return s;
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function ageOf(r) { return r.age_days === null ? null : r.age_days; }

  // The row's implied value at the slider's settings. Recomputed from the
  // row's raw snapshot fields, in the same order as the model, so the page's
  // numbers match board.json to the dollar.
  function maturityMult(r) {
    var age = r.age_days === null ? 240 : r.age_days;
    return 0.70 + (Math.min(Math.max(age, 0), 1460) / 1460) * 0.30;
  }
  function spanMult(r) {
    return 1 + Math.min(Math.max(r.chains.length - 1, 0), 6) * 0.02;
  }
  function implied(r) {
    var g = clamp(r.change_7d === null ? 0 : r.change_7d, -50, 100);
    var gm = 1 + (g / 100) * state.growthW;
    return Math.max(1, Math.round(r.tvl_usd * state.base * gm * maturityMult(r) * spanMult(r)));
  }
  function growthMult(r) {
    var g = clamp(r.change_7d === null ? 0 : r.change_7d, -50, 100);
    return 1 + (g / 100) * state.growthW;
  }

  // ---- farm plans: the same rules the board file was built with ----
  function capitalFor(r) {
    if (r.tvl_usd >= 5e9) return 250;
    if (r.tvl_usd >= 1e9) return 150;
    if (r.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdFor(r) {
    var a = ageOf(r);
    if (a === null) return 30;
    if (a < 180) return 60;
    if (a < 365) return 45;
    return 30;
  }
  function coreAction(r, capital, chain) {
    var c = (r.category || '').toLowerCase(), n = r.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0)
      return 'Lend $' + capital + ' of USDC on ' + n + ' (' + chain + ') and leave the loan open so the position accrues activity.';
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0 || c.indexOf('liquidity manager') >= 0)
      return 'Add $' + capital + ' of liquidity to ' + n + '\'s deepest pool on ' + chain + ' and keep the LP position open.';
    if (c.indexOf('yield') >= 0 || c.indexOf('farm') >= 0 || c.indexOf('aggregator') >= 0)
      return 'Deposit $' + capital + ' of USDC into ' + n + '\'s highest-yield vault on ' + chain + ' and leave it compounding.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis trad') >= 0)
      return 'Post $' + capital + ' of USDC as margin on ' + n + ' (' + chain + ') and open one small hedged position.';
    if (c.indexOf('bridge') >= 0)
      return 'Bridge $' + capital + ' of USDC into ' + chain + ' through ' + n + ', then use the bridged funds inside its app.';
    if (c.indexOf('restak') >= 0 || c.indexOf('staking pool') >= 0)
      return 'Stake $' + capital + ' of the chain\'s staking asset through ' + n + ' on ' + chain + ' and hold the receipt token.';
    if (c.indexOf('prediction') >= 0)
      return 'Fund $' + capital + ' on ' + n + ' (' + chain + ') and take one position in an active market.';
    if (c.indexOf('allocator') >= 0 || c.indexOf('curator') >= 0 || c.indexOf('risk') >= 0)
      return 'Deposit $' + capital + ' into a ' + n + ' vault on ' + chain + ' and hold the vault shares.';
    if (c.indexOf('stable') >= 0 || c.indexOf('dual-token') >= 0)
      return 'Mint or deposit $' + capital + ' of the stable asset through ' + n + ' on ' + chain + ' and hold it.';
    if (c.indexOf('rwa') >= 0)
      return 'Mint $' + capital + ' of ' + n + '\'s yield-bearing asset on ' + chain + ' and hold it in the farming wallet.';
    if (c.indexOf('insurance') >= 0)
      return 'Buy $' + capital + ' of cover from ' + n + ' on ' + chain + ' and keep the policy active.';
    if (c.indexOf('payment') >= 0 || c.indexOf('card') >= 0)
      return 'Spend $' + capital + ' through ' + n + ' on ' + chain + ' across two separate weeks.';
    if (c.indexOf('chain') >= 0)
      return 'Bridge $' + capital + ' of USDC to ' + n + ' and use it in one of its native apps.';
    if (c.indexOf('governance') >= 0)
      return 'Deposit $' + capital + ' into ' + n + ' on ' + chain + ' and vote in its next governance round.';
    if (c.indexOf('index') >= 0)
      return 'Buy $' + capital + ' of ' + n + '\'s index product on ' + chain + ' and hold it.';
    return 'Deposit $' + capital + ' of USDC into ' + n + ' on ' + chain + ' and keep the position open.';
  }
  function farmSteps(r) {
    var chain = r.chains.length ? r.chains[0] : 'its main chain';
    var cap = capitalFor(r), hold = holdFor(r), gas = cap >= 150 ? 8 : 4;
    return [
      ['Set up a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline on paper.', 'under $3 of gas for the first transaction', '5 minutes'],
      [coreAction(r, cap, chain), '$' + cap + ' of capital and about $' + gas + ' of gas', '15 minutes to set up'],
      ['Do one qualifying action every week — a deposit, a swap, a borrow, a vote or a claim — so the wallet shows repeat use.', 'about $2 of gas a week', '10 minutes a week'],
      ['Hold the position for at least ' + hold + ' days so the activity lands in more than one snapshot of the protocol.', 'the $' + cap + ' stays locked in the position', hold + ' days'],
      ['Before withdrawing, open ' + r.name + '\'s own points or rewards page and claim only from the link that page publishes.', 'no fee to check, and never pay to claim', '10 minutes'],
      ['Log the wallet, the dates and every transaction hash in a farm log, so you can repeat the position or unwind it cleanly.', 'nothing but the log', '5 minutes']
    ];
  }

  // ---- header / stats ----
  var totalImplied = D.rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
  $('meta').innerHTML = 'Snapshot ' + esc(D.as_of) + '<br>Model ' + esc(D.model_version) +
    ' · floor ' + money(D.floor_usd) + '<br>' + D.rows.length + ' rows · ' + D.live.length + ' live';
  $('stats').innerHTML =
    stat(money(D.rows[0] ? implied(D.rows[0]) : 0), 'Top implied value') +
    stat(String(D.watchlist_size), 'Watchlist protocols') +
    stat(String(D.board_size), 'Board rows') +
    stat(String(D.early_size), 'Early finds below the floor') +
    stat(money(totalImplied), 'Total implied value');
  function stat(v, label) { return '<div class="stat"><b>' + esc(v) + '</b><span>' + esc(label) + '</span></div>'; }
  $('footSrc').textContent = 'Source: ' + D.source + '. The snapshot is frozen: every run reads the same bytes.';

  // ---- filters ----
  var cats = [], chains = [];
  D.rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    (r.chains || []).forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort(); chains.sort();
  cats.forEach(function (c) { $('category').add(new Option(c, c)); });
  chains.forEach(function (c) { $('chain').add(new Option(c, c)); });

  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    var rows = D.rows.filter(function (r) {
      if (state.watchOnly && !r.watchlist) return false;
      if (state.filterCat && r.category !== state.filterCat) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (r.tvl_usd < state.minTvl) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort;
    rows.sort(function (a, b) {
      if (key === 'tvl') return b.tvl_usd - a.tvl_usd;
      if (key === 'growth') return (b.change_7d || 0) - (a.change_7d || 0);
      if (key === 'age') return (b.age_days || 0) - (a.age_days || 0);
      return implied(b) - implied(a);
    });
    return rows;
  }

  function rowHtml(r, i, maxImplied) {
    var val = implied(r);
    var chg = r.change_7d === null ? '<span>—</span>' : '<span class="' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + pct(r.change_7d) + '</span>';
    var chains = r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '');
    var w = Math.max(2, Math.round((val / maxImplied) * 120));
    return '<tr data-slug="' + esc(r.slug) + '">' +
      '<td class="num">' + (i + 1) + '</td>' +
      '<td class="name">' + esc(r.name) + (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '') + '<span class="slug">' + esc(r.slug) + '</span></td>' +
      '<td>' + esc(r.category || '—') + '</td>' +
      '<td class="hide-m">' + esc(chains) + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num">' + chg + '</td>' +
      '<td class="num hide-m">' + (r.age_days === null ? '—' : r.age_days + 'd') + '</td>' +
      '<td class="num"><span class="bar" style="width:' + w + 'px"></span><b>' + money(val) + '</b></td>' +
      '</tr>';
  }

  function renderBoard() {
    var rows = visibleRows();
    var maxImplied = rows.length ? implied(rows[0]) : 1;
    var note = state.filterCat ? ' — filtered to ' + state.filterCat : '';
    var html = '<p class="count">' + rows.length + ' of ' + D.rows.length + ' protocols' + esc(note) +
      ' · sorted by ' + (state.sort === 'implied' ? 'implied value' : state.sort) + '</p>';
    if (!rows.length) { $('view').innerHTML = html + '<p class="empty">Nothing matches these filters.</p>'; return; }
    html += '<table><thead><tr><th class="num">#</th><th>Protocol</th><th>Category</th>' +
      '<th class="hide-m">Chains</th><th class="num">TVL</th><th class="num">7d</th>' +
      '<th class="num hide-m">Age</th><th class="num">Implied value</th></tr></thead><tbody>';
    rows.forEach(function (r, i) { html += rowHtml(r, i, maxImplied); });
    html += '</tbody></table>';
    $('view').innerHTML = html;
  }

  function renderLive() {
    var html = '<p class="count">Protocols whose token already trades — the market\u2019s own values, never a model\u2019s. Shown so the board\u2019s pre-token rows are never confused with them.</p>';
    html += '<table><thead><tr><th>Protocol</th><th>Category</th><th class="hide-m">Chains</th><th class="num">TVL</th><th class="num">Market cap</th><th class="num">7d</th></tr></thead><tbody>';
    D.live.forEach(function (r) {
      var chg = r.change_7d === null ? '—' : '<span class="' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + pct(r.change_7d) + '</span>';
      html += '<tr><td class="name">' + esc(r.name) + '<span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td><td class="hide-m">' + esc(r.chains.slice(0, 3).join(', ')) + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + (r.mcap_usd === null ? '—' : money(r.mcap_usd)) + '</td>' +
        '<td class="num">' + chg + '</td></tr>';
    });
    html += '</tbody></table>';
    $('view').innerHTML = html;
  }

  function renderMethod() {
    $('view').innerHTML = '<div class="method">' +
      '<h2>Method — model ' + esc(D.model_version) + '</h2>' +
      '<p>The board ranks protocols that <strong>record no token</strong> in the snapshot: no market cap, no CoinGecko id, no symbol. ' +
      'It never claims a protocol <em>has</em> no token — the record is not proof. Wrapped, staked and bridged products of tokens that already trade are left out, as are versioned pools (a name ending in V2, 2.0 and the like) and exchange products.</p>' +
      '<h3>The value model</h3>' +
      '<p><code>implied = TVL × 0.30 × growth × maturity × span</code></p>' +
      '<ul><li><strong>Base:</strong> TVL × 0.30 — comparable pre-token launches price near 0.3× TVL at launch.</li>' +
      '<li><strong>Growth:</strong> 1 + clamp(7-day TVL change, −50…+100%) ÷ 100 × 0.60.</li>' +
      '<li><strong>Maturity:</strong> 0.70 + min(age in days, 1460) ÷ 1460 × 0.30 — longer-running protocols with no token score higher; unknown age counts as 240 days.</li>' +
      '<li><strong>Span:</strong> 1 + min(chains − 1, 6) × 0.02 — a protocol live on more chains is worth more.</li></ul>' +
      '<p>Every input comes from the snapshot itself. No protocol name is special-cased; the same function scores all ' + D.rows.length + ' rows.</p>' +
      '<h3>The watchlist</h3>' +
      '<p>The house drew a floor at ' + money(D.floor_usd) + ' of TVL: ' + D.watchlist_size + ' protocols at or above it record no token and are not wrapped or staked products. ' +
      'The board covers every one of them, then adds ' + D.early_size + ' early finds below the floor — pre-token protocols the floor leaves out, ranked by the same model. The floor is where the reading starts, not where it stops.</p>' +
      '<h3>Farm plans</h3>' +
      '<p>Each row carries six steps: set up a clean wallet, take the category\u2019s core position, act weekly, hold, claim only from the protocol\u2019s own page, and log everything. ' +
      'Capital is sized from the protocol\u2019s TVL ($50–$250) and the hold from its age (30–60 days). Costs and times are stated on every step.</p>' +
      '<h3>What this is not</h3>' +
      '<p>The implied value is this radar\u2019s own claim, not a prediction that a token is issued, or when, or at what price. A launch may never come, and a protocol below the floor may launch first.</p>' +
      '</div>';
  }

  function renderDetail(slug) {
    var r = null;
    D.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) { $('view').innerHTML = '<p class="empty">No protocol on the board has that slug. <a href="#/">Back to the board</a></p>'; return; }
    var val = implied(r);
    var base = Math.round(r.tvl_usd * state.base);
    var gm = growthMult(r);
    var steps = farmSteps(r);
    var html = '<div class="detail"><a class="back" href="#/">← Back to the board</a>' +
      '<h2>' + esc(r.name) + (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '') + '<span class="slug">' + esc(r.slug) + '</span></h2>' +
      '<p class="fine">' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ') || 'no chains listed') +
      ' · records no token in the snapshot (no market cap, no CoinGecko id, no symbol)' +
      (r.listed_at ? ' · tracked since ' + esc(r.listed_at) : '') + '</p>' +
      '<div class="kv">' +
      '<div><b>' + money(val) + '</b><span>Implied value</span></div>' +
      '<div><b>' + money(r.tvl_usd) + '</b><span>TVL</span></div>' +
      '<div><b>' + (r.change_7d === null ? '—' : pct(r.change_7d)) + '</b><span>TVL, 7 days</span></div>' +
      '<div><b>' + (r.age_days === null ? '—' : r.age_days + ' days') + '</b><span>Age with no token</span></div>' +
      '<div><b>#' + r.rank + ' of ' + D.rows.length + '</b><span>Board rank</span></div>' +
      '<div><b>' + r.chains.length + '</b><span>Chains</span></div>' +
      '</div>' +
      '<h3>The working, shown</h3>' +
      '<div class="math">' + money(r.tvl_usd) + ' TVL × ' + state.base.toFixed(2) + ' = ' + moneyFull(base) + ' base<br>' +
      '× ' + gm.toFixed(4) + ' growth (' + (r.change_7d === null ? 'no 7-day change reported' : pct(r.change_7d) + ' over 7 days') + ')<br>' +
      '× ' + maturityMult(r).toFixed(4) + ' maturity (' + (r.age_days === null ? 'age unknown, counted as 240 days' : r.age_days + ' days tracked') + ')<br>' +
      '× ' + spanMult(r).toFixed(4) + ' span (' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ')<br>' +
      '= <span class="res">' + moneyFull(val) + ' implied value</span></div>' +
      '<h3>How to farm it</h3><ol class="steps">';
    steps.forEach(function (s) {
      html += '<li>' + esc(s[0]) + ' <b>Cost:</b> ' + esc(s[1]) + '. <b>Time:</b> ' + esc(s[2]) + '.</li>';
    });
    html += '</ol></div>';
    $('view').innerHTML = html;
  }

  function render() {
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === state.tab);
    });
    $('controls').style.display = state.tab === 'board' && !state.detail ? '' : 'none';
    if (state.detail) { renderDetail(state.detail); return; }
    if (state.tab === 'live') renderLive();
    else if (state.tab === 'method') renderMethod();
    else renderBoard();
  }

  function route() {
    var h = location.hash || '';
    state.detail = null; state.filterCat = null;
    var m = h.match(/^#\/p\/(.+)$/);
    if (m) { state.detail = decodeURIComponent(m[1]); state.tab = 'board'; render(); return; }
    var f = h.match(/^#\/f\/(.+)$/);
    if (f) {
      state.filterCat = decodeURIComponent(f[1]);
      state.tab = 'board'; $('category').value = state.filterCat; state.cat = state.filterCat;
      render(); return;
    }
    render();
  }

  // ---- wiring ----
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.tab = b.getAttribute('data-tab');
      if (state.tab !== 'board') { location.hash = ''; }
      render();
    });
  });
  $('view').addEventListener('click', function (e) {
    var tr = e.target.closest ? e.target.closest('tr[data-slug]') : null;
    if (tr) location.hash = '#/p/' + encodeURIComponent(tr.getAttribute('data-slug'));
  });
  $('search').addEventListener('input', function () { state.q = this.value; renderBoard(); });
  $('category').addEventListener('change', function () { state.cat = this.value; state.filterCat = null; renderBoard(); });
  $('chain').addEventListener('change', function () { state.chain = this.value; renderBoard(); });
  $('minTvl').addEventListener('change', function () { state.minTvl = Number(this.value); renderBoard(); });
  $('sort').addEventListener('change', function () { state.sort = this.value; renderBoard(); });
  $('watchOnly').addEventListener('change', function () { state.watchOnly = this.checked; renderBoard(); });
  $('reset').addEventListener('click', function () {
    state.q = ''; state.cat = ''; state.chain = ''; state.minTvl = 0; state.sort = 'implied'; state.watchOnly = false; state.filterCat = null;
    $('search').value = ''; $('category').value = ''; $('chain').value = ''; $('minTvl').value = '0';
    $('sort').value = 'implied'; $('watchOnly').checked = false;
    location.hash = ''; render();
  });
  $('baseSlider').addEventListener('input', function () {
    state.base = Number(this.value);
    $('baseVal').textContent = state.base.toFixed(2) + '× TVL';
    render();
  });
  $('growthSlider').addEventListener('input', function () {
    state.growthW = Number(this.value);
    $('growthVal').textContent = state.growthW.toFixed(2);
    render();
  });
  window.addEventListener('hashchange', route);
  route();
})();
