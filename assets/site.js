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
  var URLS = { home: '/', work: '/work/', about: '/about/', contact: '/contact/' };

  var state = { filter: 'all', lb: null, sent: false, reason: 'Drawing lessons' };
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

  function list() { return PAGE === 'work' && state.filter !== 'all' ? WORKS.filter(function (w) { return w.cat === state.filter; }) : WORKS; }
  function pad(n) { return String(n).padStart(2, '0'); }

  function render() {
    DATA.cats.forEach(function (k) { setIf('cat:' + k, state.filter === k); setIf('cat-off:' + k, state.filter !== k); });
    var shown = {}; list().forEach(function (w) { shown[w.id] = 1; });
    if (PAGE === 'work') WORKS.forEach(function (w) { setIf('work:' + w.id, !!shown[w.id]); });
    setIf('notsent', !state.sent); setIf('sent', state.sent);
    DATA.reasons.forEach(function (r) { setIf('reason:' + r, state.reason === r); setIf('reason-off:' + r, state.reason !== r); });
    setIf('lb', state.lb != null);
    if (state.lb != null) {
      var w = BY[state.lb], l = list(), i = l.findIndex(function (x) { return x.id === state.lb; });
      var vals = { 'lb.src': w.src, 'lb.title': w.title, 'lb.medium': w.medium, 'lb.dimsLine': w.dimsLine,
        'lb.yearLine': w.yearLine, 'lb.noteLine': w.noteLine, lbCounter: i >= 0 ? pad(i + 1) + ' / ' + pad(l.length) : '' };
      $$('[data-bind]').forEach(function (el) { el.textContent = vals[el.getAttribute('data-bind')]; });
      $$('[data-bind-src]').forEach(function (el) { el.src = vals[el.getAttribute('data-bind-src')]; });
      $$('[data-bind-alt]').forEach(function (el) { el.alt = vals[el.getAttribute('data-bind-alt')]; });
    }
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
    if (p === PAGE) { if (f) { setState({ filter: f }); syncHash(); } window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    busy = true; setState({ lb: null }); setCurtain('in');
    setTimeout(function () {
      try { sessionStorage.setItem('ep-curtain', '1'); } catch (e) {}
      location.href = URLS[p] + (f ? '#' + f : '');
    }, 760);
  }
  function syncHash() {
    if (PAGE !== 'work' || !history.replaceState) return;
    history.replaceState(null, '', state.filter === 'all' ? location.pathname : '#' + state.filter);
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
    if (PAGE === 'work' && DATA.cats.indexOf(h) > 0) { state.filter = h; render(); }

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
      if (act === 'reason') setState({ reason: val });
      if (act === 'resetForm') setState({ sent: false });
      if (act === 'closeLb') setState({ lb: null });
      if (act === 'lbPrev') step(-1);
      if (act === 'lbNext') step(1);
    });
    // Contact form: no backend (matches Design's prototype) — shows the "sent" state only.
    document.addEventListener('submit', function (e) {
      if (!e.target.matches('[data-action="submit"]')) return;
      e.preventDefault(); setState({ sent: true });
    });

    playVideo(); setTimeout(setupReveal, 30);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
