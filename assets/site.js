/* Esmée Peets — site behaviour.
   Port of the Component logic in Claude Design's export (Esmee Peets Site.dc.html):
   same timings, easings, thresholds and state rules. Pages are real URLs, so the
   page-transition curtain closes, navigates, then opens on the next page. */
(function () {
  'use strict';
  var PAGE = document.currentScript.getAttribute('data-page');
  var DATA = JSON.parse(document.getElementById('ep-data').textContent);
  var WORKS = DATA.works, BY = {};
  WORKS.forEach(function (w) { BY[w.id] = w; });
  var URLS = { home: '/', work: '/work/', store: '/store/', about: '/about/', contact: '/contact/', cart: '/cart/', checkout: '/checkout/',
    shipping: '/shipping-returns/', privacy: '/privacy/', terms: '/terms/' };
  var PRICES = DATA.prices, FOR_SALE = WORKS.filter(function (w) { return w.id in PRICES; });

  var state = { filter: 'all', storeFilter: 'all', storeView: 'forsale', cart: loadCart(), lb: null, sent: false, reason: 'Commission' };

  // Store selection persists across pages/visits (the prototype was one page, so it never lost it).
  function loadCart() { try { var c = JSON.parse(localStorage.getItem('ep-cart') || '[]');
    // Drop anything no longer purchasable (sold / reserved since it was selected).
    return Array.isArray(c) ? c.filter(function (id, i) { return DATA.status[id] === 'available' && c.indexOf(id) === i; }) : []; } catch (e) { return []; } }
  function saveCart() { try { localStorage.setItem('ep-cart', JSON.stringify(state.cart)); } catch (e) {} }
  var busy = false, fine = false, mx = -100, my = -100, rx = -100, ry = -100;
  var dot, ring, label;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var root, strip, collage, video, curtain;

  /* ---------- conditional blocks (<template data-if> + live copy) ---------- */
  function setIf(key, on) {
    $$('template[data-if]').forEach(function (t) {
      if (t.getAttribute('data-if') !== key) return;
      var live = [], n = t.nextElementSibling;
      while (n && n.getAttribute('data-if-live') === key) { live.push(n); n = n.nextElementSibling; }
      if (on && !live.length) {
        var frag = t.content.cloneNode(true);
        var first = frag.firstElementChild;
        if (first) first.setAttribute('data-if-live', key);
        t.parentNode.insertBefore(frag, t.nextSibling);
      } else if (!on && live.length) {
        live.forEach(function (el) { el.remove(); });
      }
    });
  }

  function storeList() {
    var byView = FOR_SALE.filter(function (w) { return (DATA.status[w.id] === 'sold') === (state.storeView === 'sold'); });
    return state.storeView === 'sold' || state.storeFilter === 'all' ? byView : byView.filter(function (w) { return w.cat === state.storeFilter; });
  }
  // Lightbox list: Work uses its filter (as in Design); Store steps through its own filtered list (per the Store handoff spec).
  function list() {
    if (PAGE === 'store') return storeList();
    return PAGE === 'work' && state.filter !== 'all' ? WORKS.filter(function (w) { return w.cat === state.filter; }) : WORKS;
  }
  // "Cart (n)" link in the header, shown on every page while the visitor has works selected.
  function syncNavCart() {
    var nav = $('header nav'); if (!nav) return;
    var n = loadCart().length, a = $('a[data-ep-cart]', nav);
    if (!n) { if (a) a.remove(); return; }
    if (!a) {
      a = document.createElement('a'); a.href = '/cart/'; a.setAttribute('data-go', 'cart'); a.setAttribute('data-ep-cart', '1');
      a.style.cssText = 'color:var(--gold); padding-bottom:4px; border-bottom:1px solid ' + (PAGE === 'cart' ? 'var(--gold)' : 'transparent'); nav.appendChild(a);
    }
    a.textContent = 'Cart (' + n + ')';
  }
  function fmt(n) { return n == null ? 'Price on request' : '$' + n.toLocaleString('en-CA') + ' CAD'; }
  function pad(n) { return String(n).padStart(2, '0'); }

  function render() {
    DATA.cats.forEach(function (k) { setIf('cat:' + k, state.filter === k); setIf('cat-off:' + k, state.filter !== k); });
    var shown = {}; list().forEach(function (w) { shown[w.id] = 1; });
    if (PAGE === 'work') WORKS.forEach(function (w) { setIf('work:' + w.id, !!shown[w.id]); });
    setIf('notsent', !state.sent); setIf('sent', state.sent);
    syncNavCart();
    DATA.reasons.forEach(function (r) { setIf('reason:' + r, state.reason === r); setIf('reason-off:' + r, state.reason !== r); });
    var vals = {};
    if (PAGE === 'store') {
      DATA.storeCats.forEach(function (k) { setIf('scat:' + k, state.storeFilter === k); setIf('scat-off:' + k, state.storeFilter !== k); });
      DATA.storeViews.forEach(function (k) { setIf('sview:' + k, state.storeView === k); setIf('sview-off:' + k, state.storeView !== k); });
      var inList = {}; storeList().forEach(function (w) { inList[w.id] = 1; });
      FOR_SALE.forEach(function (w) { var c = state.cart.indexOf(w.id) >= 0;
        setIf('sitem:' + w.id, !!inList[w.id]); setIf('cart:' + w.id, c); setIf('cart-off:' + w.id, !c); });
      var cart = state.cart.map(function (id) { return BY[id]; });
      var total = cart.reduce(function (t, w) { return t + (PRICES[w.id] || 0); }, 0), anyTbc = cart.some(function (w) { return PRICES[w.id] == null; });
      var titles = cart.map(function (w) { return w.title; }).join(', ');
      var body = 'Hello Esmée,\n\nI would like to purchase:\n' + cart.map(function (w) { return '- ' + w.title + ' (' + w.meta + '): ' + fmt(PRICES[w.id]); }).join('\n') + '\n\nName:\nShipping city / pickup:\n';
      setIf('cartbar', cart.length > 0);
      vals.cartSummary = cart.length + ' ' + (cart.length === 1 ? 'work' : 'works') + ' selected' + (total ? ' · $' + total.toLocaleString('en-CA') + ' CAD' + (anyTbc ? ' + price on request' : '') : '');
      vals.cartTitles = titles;
      vals.cartMailto = 'mailto:esmeepeets@gmail.com?subject=' + encodeURIComponent('Purchase request: ' + titles) + '&body=' + encodeURIComponent(body);
    }
    setIf('lb', state.lb != null);
    if (state.lb != null) {
      var w = BY[state.lb], l = list(), i = l.findIndex(function (x) { return x.id === state.lb; });
      vals['lb.src'] = w.src; vals['lb.title'] = w.title; vals['lb.medium'] = w.medium; vals['lb.dimsLine'] = w.dimsLine;
      vals['lb.yearLine'] = w.yearLine; vals['lb.noteLine'] = w.noteLine; vals.lbCounter = i >= 0 ? pad(i + 1) + ' / ' + pad(l.length) : '';
    }
    $$('[data-bind]').forEach(function (el) { var k = el.getAttribute('data-bind'); if (k in vals) el.textContent = vals[k]; });
    $$('[data-bind-src]').forEach(function (el) { var k = el.getAttribute('data-bind-src'); if (k in vals) el.src = vals[k]; });
    $$('[data-bind-alt]').forEach(function (el) { var k = el.getAttribute('data-bind-alt'); if (k in vals) el.alt = vals[k]; });
    $$('[data-bind-href]').forEach(function (el) { var k = el.getAttribute('data-bind-href'); if (k in vals) el.setAttribute('href', vals[k]); });
  }
  function setState(patch) {
    var prevFilter = state.filter;
    for (var k in patch) state[k] = patch[k];
    render();
    if (prevFilter !== state.filter) setTimeout(setupReveal, 40);
  }

  /* ---------- scroll reveal (verbatim logic) ---------- */
  var revealTries = 0, onScroll = null;
  function show(el) { el.style.opacity = '1'; el.style.transform = 'none'; el.removeAttribute('data-pending'); }
  function setupReveal() {
    if (!root.querySelector('[data-reveal]')) { if ((revealTries = revealTries + 1) < 40) setTimeout(setupReveal, 100); return; }
    revealTries = 0;
    var vh = window.innerHeight || 800;
    $$('[data-reveal]:not([data-revealed])', root).forEach(function (el) {
      el.setAttribute('data-revealed', '1');
      if (document.visibilityState !== 'visible' || el.getBoundingClientRect().top < vh * .96) return;
      var d = el.dataset.delay || 0;
      el.style.transition = 'opacity .9s cubic-bezier(.22,1,.36,1) ' + d + 's, transform .9s cubic-bezier(.22,1,.36,1) ' + d + 's';
      el.style.opacity = '0'; el.style.transform = 'translateY(28px)'; el.setAttribute('data-pending', '1');
    });
    if (!onScroll) {
      onScroll = function () { var h = window.innerHeight || 800;
        $$('[data-pending]').forEach(function (el) { if (el.getBoundingClientRect().top < h * .92) show(el); }); };
      window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll);
      document.addEventListener('visibilitychange', function () { if (document.visibilityState !== 'visible') $$('[data-pending]').forEach(show); });
      window.addEventListener('beforeprint', function () { $$('[data-pending]').forEach(show); });
    }
    onScroll();
  }

  /* ---------- page-transition curtain ---------- */
  function setCurtain(c) {
    curtain.style.pointerEvents = c === 'idle' ? 'none' : 'auto';
    $$('span', curtain).forEach(function (s, i) {
      s.style.transform = c === 'in' ? 'scaleY(1)' : 'scaleY(0)';
      s.style.transformOrigin = c === 'out' ? 'center top' : 'center bottom';
      s.style.transition = c === 'idle' ? 'none' : 'transform ' + (c === 'in' ? '.55s' : '.6s') + ' cubic-bezier(.76,0,.24,1) ' + (i * .07) + 's';
    });
  }
  function arrive() {
    var html = document.documentElement;
    if (!html.classList.contains('ep-arrive')) return;
    try { sessionStorage.removeItem('ep-curtain'); } catch (e) {}
    busy = true;
    $$('span', curtain).forEach(function (s) { s.style.transition = 'none'; s.style.transform = 'scaleY(1)'; });
    curtain.style.pointerEvents = 'auto';
    html.classList.remove('ep-arrive');
    void curtain.offsetWidth;
    setCurtain('out');
    setTimeout(function () { setCurtain('idle'); busy = false; }, 860);
  }
  function go(p, f) {
    if (busy) return;
    if (p === PAGE) { if (f) { setState(PAGE === 'store' ? { storeFilter: f } : { filter: f }); syncHash(); } window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    busy = true; setState({ lb: null }); setCurtain('in');
    setTimeout(function () {
      try { sessionStorage.setItem('ep-curtain', '1'); } catch (e) {}
      location.href = URLS[p] + (f ? '#' + f : '');
    }, 760);
  }
  function syncHash() {
    if ((PAGE !== 'work' && PAGE !== 'store') || !history.replaceState) return;
    var f = PAGE === 'store' ? (state.storeView === 'sold' ? 'sold' : state.storeFilter) : state.filter;
    history.replaceState(null, '', f === 'all' ? location.pathname : '#' + f);
  }
  // Back/forward cache: never restore a page with the curtain closed.
  window.addEventListener('pageshow', function (e) { if (e.persisted) { busy = false; setCurtain('idle'); } });

  /* ---------- lightbox ---------- */
  function step(d) { var l = list(), i = l.findIndex(function (w) { return w.id === state.lb; }); if (i < 0) i = 0;
    setState({ lb: l[(i + d + l.length) % l.length].id }); }

  /* ---------- custom cursor (created on mount; see Design's cursorEl) ---------- */
  function buildCursor() {
    dot = document.createElement('div');
    dot.setAttribute('style', 'position: fixed; left: -3px; top: -3px; transform: translate(-100px, -100px); width: 6px; height: 6px; border-radius: 50%; background: var(--cursor-dot); z-index: var(--z-cursor); pointer-events: none;');
    ring = document.createElement('div');
    ring.setAttribute('style', 'position: fixed; left: 0px; top: 0px; transform: translate(-100px, -100px); width: 30px; height: 30px; border-radius: 50%; border: 1px solid rgba(246, 239, 228, 0.5); z-index: var(--z-cursor); pointer-events: none; display: flex; align-items: center; justify-content: center; mix-blend-mode: difference; transition: width 0.35s cubic-bezier(0.22, 1, 0.36, 1), height 0.35s cubic-bezier(0.22, 1, 0.36, 1), background 0.35s;');
    label = document.createElement('span');
    label.setAttribute('style', 'font-size: var(--fs-cursor); letter-spacing: var(--tr-cursor); text-transform: uppercase; color: rgb(20, 15, 28); opacity: 0; transition: opacity 0.25s; font-weight: 600;');
    ring.appendChild(label);
    root.appendChild(dot); root.appendChild(ring);
  }

  function playVideo() {
    setTimeout(function () { var v = video; if (v) { v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', '');
      try { var r = v.play && v.play(); r && r.catch && r.catch(function () {}); } catch (e) {} } }, 60);
  }

  function init() {
    root = $('[data-ref="root"]'); strip = $('[data-ref="strip"]'); collage = $('[data-ref="collage"]'); video = $('[data-ref="video"]');
    curtain = $('[data-curtain]');
    arrive();

    var h = (location.hash || '').slice(1);
    if (PAGE === 'work' && DATA.cats.indexOf(h) > 0) state.filter = h;
    if (PAGE === 'store' && h === 'sold') state.storeView = 'sold';
    else if (PAGE === 'store' && DATA.storeCats.indexOf(h) > 0) state.storeFilter = h;
    render();

    fine = window.matchMedia && window.matchMedia('(pointer:fine)').matches;
    document.body.classList.toggle('ep-cursor', !!fine);
    if (fine) buildCursor();

    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (dot) dot.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
      var t = e.target.closest && e.target.closest('[data-cursor],a,button,input,textarea');
      var lab = t && t.dataset ? (t.dataset.cursor || '') : '';
      if (ring) { var s = lab ? 78 : t ? 46 : 30; ring.style.width = ring.style.height = s + 'px';
        ring.style.background = lab ? 'var(--ink)' : 'transparent'; ring.style.borderColor = lab ? 'var(--ink)' : 'rgba(246,239,228,.5)'; }
      if (label) { label.textContent = lab; label.style.opacity = lab ? 1 : 0; }
      if (collage) { var dx = (mx / window.innerWidth - .5), dy = (my / window.innerHeight - .5);
        $$('[data-depth]', collage).forEach(function (el) { var d = +el.dataset.depth; el.style.transform = 'translate(' + (-dx * d * 22) + 'px,' + (-dy * d * 22) + 'px)'; }); }
    });
    (function loop() { rx += (mx - rx) * .16; ry += (my - ry) * .16;
      if (ring) ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px) translate(-50%,-50%)';
      requestAnimationFrame(loop); })();

    window.addEventListener('keydown', function (e) { if (state.lb == null) return;
      if (e.key === 'Escape') setState({ lb: null }); if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); });

    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      var nav = e.target.closest('a[data-go]');
      if (nav) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;   // let new-tab clicks through
        e.preventDefault(); go(nav.getAttribute('data-go'), nav.getAttribute('data-filter')); return;
      }
      var a = e.target.closest('[data-action]');
      if (!a) return;
      var act = a.getAttribute('data-action'), val = a.getAttribute('data-value');
      if (act === 'stop') return;
      if (act === 'open') setState({ lb: val });
      if (act === 'stripPrev' && strip) strip.scrollBy({ left: -strip.clientWidth * .6, behavior: 'smooth' });
      if (act === 'stripNext' && strip) strip.scrollBy({ left: strip.clientWidth * .6, behavior: 'smooth' });
      if (act === 'filter') { setState({ filter: val }); syncHash(); }
      if (act === 'storeFilter') { setState({ storeFilter: val }); syncHash(); }
      if (act === 'storeView') { setState({ storeView: val, storeFilter: 'all' }); syncHash(); }
      if (act === 'toggle') { var c = state.cart.indexOf(val) >= 0 ? state.cart.filter(function (x) { return x !== val; }) : state.cart.concat([val]);
        setState({ cart: c }); saveCart(); }
      if (act === 'clearCart') { setState({ cart: [] }); saveCart(); }
      if (act === 'reason') setState({ reason: val });
      if (act === 'resetForm') setState({ sent: false });
      if (act === 'closeLb') setState({ lb: null });
      if (act === 'lbPrev') step(-1);
      if (act === 'lbNext') step(1);
    });
    // Contact form: no backend (matches Design's prototype), shows the "sent" state only.
    document.addEventListener('submit', function (e) {
      if (!e.target.matches('[data-action="submit"]')) return;
      e.preventDefault(); setState({ sent: true });
    });

    window.addEventListener('ep-cart-change', syncNavCart); window.addEventListener('storage', syncNavCart);
    playVideo(); setTimeout(setupReveal, 30);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
