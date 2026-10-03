/* Esmée Peets: cart, checkout and thank-you pages.
   The cart is the list the Store page keeps in localStorage ('ep-cart'). Checkout sends only the work ids and the
   delivery choice to /api/checkout; the server looks up the real prices and shipping, creates a Stripe Checkout
   session and returns its address. Card details are only ever typed on Stripe's page. */
(function () {
  'use strict';
  var EMAIL = 'esmeepeets@gmail.com';
  var KIND = document.currentScript.getAttribute('data-shop');
  var DATA = JSON.parse(document.getElementById('ep-data').textContent);
  var BY = {}; DATA.works.forEach(function (w) { BY[w.id] = w; });
  var PRICES = DATA.prices;
  var $ = function (s, r) { return (r || document).querySelector(s); };

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return '$' + n.toLocaleString('en-CA', { minimumFractionDigits: n % 1 ? 2 : 0 }) + ' CAD'; }
  function priceLabel(id) { return PRICES[id] == null ? 'Price on request' : money(PRICES[id]); }

  function readCart() {
    var raw = [];
    try { raw = JSON.parse(localStorage.getItem('ep-cart') || '[]'); } catch (e) {}
    if (!Array.isArray(raw)) raw = [];
    var ids = raw.filter(function (id, i) { return DATA.status[id] === 'available' && raw.indexOf(id) === i; });
    return { ids: ids, dropped: raw.length - ids.length };
  }
  function writeCart(ids) {
    try { localStorage.setItem('ep-cart', JSON.stringify(ids)); } catch (e) {}
    window.dispatchEvent(new Event('ep-cart-change'));
  }
  function allPriced(ids) { return ids.every(function (id) { return PRICES[id] != null; }); }
  function subtotal(ids) { return ids.reduce(function (t, id) { return t + (PRICES[id] || 0); }, 0); }
  function mailtoFor(ids) {
    return 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Purchase: ' + ids.map(function (id) { return BY[id].title; }).join(', '));
  }

  /* ---------------- cart ---------------- */
  function cartEmpty(dropped) {
    return '<div style="display:flex;flex-direction:column;gap:var(--space-md);align-items:flex-start">' +
      '<div style="font-family:var(--serif);font-size:var(--fs-h2);line-height:1.1">Nothing here <em>yet.</em></div>' +
      '<p style="margin:0;color:var(--ink-dim);max-width:46ch">' +
      (dropped ? 'The work you selected has since been sold or reserved, so it was taken out of your cart. ' : '') +
      'Browse the store and add a work to your cart.</p>' +
      '<a class="ep-btn" href="/store/" data-go="store">Visit the store <span>→</span></a></div>';
  }
  function renderCart() {
    var list = $('#ep-cart-list'), sum = $('#ep-cart-summary'), grid = $('[data-ep="cart-grid"]');
    var c = readCart();
    if (!c.ids.length) { grid.classList.add('ep-grid-one'); list.innerHTML = cartEmpty(c.dropped); sum.hidden = true; return; }
    grid.classList.remove('ep-grid-one');
    var rows = c.ids.map(function (id) {
      var w = BY[id];
      return '<div class="ep-row">' +
        '<img class="ep-thumb" src="' + esc(w.src) + '" alt="' + esc(w.title) + '">' +
        '<div style="min-width:0"><div class="ep-row-title">' + esc(w.title) + '</div>' +
        '<div class="ep-row-meta">' + esc(w.meta) + '</div><span class="ep-badge">Original, one of a kind</span></div>' +
        '<div class="ep-row-end"><span>' + esc(priceLabel(id)) + '</span>' +
        '<button type="button" class="ep-link ep-link-dim" data-remove="' + esc(id) + '">Remove</button></div></div>';
    }).join('');
    list.innerHTML = (c.dropped ? '<p class="ep-status" style="margin-bottom:var(--space-lg)">A work in your cart has since been sold or reserved, so it was removed.</p>' : '') + rows;
    var priced = allPriced(c.ids);
    sum.hidden = false;
    sum.innerHTML = '<div class="ep-cap" style="color:var(--gold)">Summary</div>' +
      '<div style="margin-top:var(--space-sm)">' +
      '<div class="ep-sum"><span>' + c.ids.length + (c.ids.length === 1 ? ' work' : ' works') + '</span><b>' + (priced ? esc(money(subtotal(c.ids))) : 'Price on request') + '</b></div>' +
      '<div class="ep-sum"><span>Shipping</span><b>Calculated at checkout</b></div></div>' +
      (priced
        ? '<a class="ep-btn ep-btn-block" href="/checkout/" data-go="checkout" data-cursor="Checkout" style="margin-top:var(--space-lg)">Checkout <span>→</span></a>' +
          '<p class="ep-note">Secure payment by Stripe. You see the exact shipping cost before you pay.</p>'
        : '<a class="ep-btn ep-btn-block" href="' + esc(mailtoFor(c.ids)) + '" style="margin-top:var(--space-lg)">Email Esmée to buy <span>→</span></a>' +
          '<p class="ep-note">A work in your cart has no set price yet, so it cannot be bought online. Email Esmée and she will help.</p>') +
      '<div class="ep-actions" style="margin-top:var(--space-md);justify-content:space-between">' +
      '<a class="ep-link ep-link-dim" href="/store/" data-go="store">Continue browsing</a>' +
      '<button type="button" class="ep-link ep-link-dim" data-clear="1">Clear cart</button></div>';
  }
  function initCart() {
    renderCart();
    document.addEventListener('click', function (e) {
      var r = e.target.closest && e.target.closest('[data-remove]');
      if (r) { var id = r.getAttribute('data-remove'); writeCart(readCart().ids.filter(function (x) { return x !== id; })); renderCart(); return; }
      if (e.target.closest && e.target.closest('[data-clear]')) { writeCart([]); renderCart(); }
    });
    window.addEventListener('storage', renderCart);
  }

  /* ---------------- checkout ---------------- */
  function itemsHtml(ids) {
    return ids.map(function (id) {
      var w = BY[id];
      return '<div class="ep-mini"><img src="' + esc(w.src) + '" alt=""><div><b>' + esc(w.title) + '</b><div style="font-size:var(--fs-meta);color:var(--ink-faint)">' + esc(w.meta) + '</div></div><span style="color:var(--ink-dim)">' + esc(priceLabel(id)) + '</span></div>';
    }).join('');
  }
  function initCheckout() {
    var c = readCart(), main = $('#ep-checkout-main'), sum = $('#ep-checkout-summary'), grid = $('[data-ep="checkout-grid"]');
    var form = $('#ep-form');
    if (!c.ids.length) { grid.classList.add('ep-grid-one'); main.innerHTML = cartEmpty(c.dropped); sum.hidden = true; return; }
    if (!allPriced(c.ids)) {
      grid.classList.add('ep-grid-one');
      main.innerHTML = '<p style="margin:0;color:var(--ink-dim)">A work in your cart has no set price yet, so it cannot be bought online. <a href="' + esc(mailtoFor(c.ids)) + '" style="border-bottom:1px solid var(--gold)">Email Esmée</a> and she will help.</p>';
      sum.hidden = true; return;
    }
    var SHIP = JSON.parse($('#ep-ship').textContent);
    var SHIP_TIER = SHIP.workTiers || {};
    var COUNTRY = {}; SHIP.countries.forEach(function (k) { COUNTRY[k.code] = k; });

    // Same rule the server applies: the dearest work pays in full, each extra work pays a share.
    function shipCost(country) {
      var zone = COUNTRY[country].zone;
      var rates = c.ids.map(function (id) { return SHIP.rates[SHIP_TIER[id]][zone]; }).sort(function (a, b) { return b - a; });
      return Math.round(rates.reduce(function (t, r, i) { return t + (i === 0 ? r : r * SHIP.extraWorkFactor); }, 0));
    }

    var sel = form.elements.country;
    sel.innerHTML = SHIP.countries.map(function (k) { return '<option value="' + k.code + '"' + (k.code === 'CA' ? ' selected' : '') + '>' + esc(k.name) + '</option>'; }).join('');
    form.elements.pickupCity.innerHTML = SHIP.pickupCities.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('');
    var pick = $('#ep-pickup'), pickOpt = $('#ep-pickup-opt'), shipNote = $('#ep-ship-note');

    function state() {
      var country = sel.value, pickupOk = country === 'CA';
      pickOpt.hidden = !pickupOk;
      if (!pickupOk && form.elements.delivery.value === 'pickup') form.elements.delivery.value = 'ship';
      var pickup = form.elements.delivery.value === 'pickup';
      pick.hidden = !pickup; shipNote.hidden = pickup;
      return { country: country, pickup: pickup, ship: pickup ? 0 : shipCost(country) };
    }
    function drawSummary() {
      var st = state(), sub = subtotal(c.ids);
      sum.hidden = false;
      sum.innerHTML = '<div class="ep-cap" style="color:var(--gold)">Your works</div>' +
        '<div style="margin-top:var(--space-sm)">' + itemsHtml(c.ids) + '</div>' +
        '<div class="ep-sum" style="margin-top:var(--space-sm)"><span>Subtotal</span><b>' + esc(money(sub)) + '</b></div>' +
        '<div class="ep-sum"><span>Shipping</span><b>' + (st.pickup ? 'Free pickup' : esc(money(st.ship))) + '</b></div>' +
        '<div class="ep-sum ep-sum-total"><span>Total</span><b>' + esc(money(sub + st.ship)) + '</b></div>' +
        '<p class="ep-note">No GST/HST is added.' + (st.pickup ? '' : ' Tracked and insured shipping.') + ' <a href="/shipping-returns/" data-go="shipping" style="border-bottom:1px solid var(--line)">Shipping details</a></p>' +
        '<a class="ep-link ep-link-dim" href="/cart/" data-go="cart" style="display:inline-block;margin-top:var(--space-md)">Edit cart</a>';
    }
    form.hidden = false;
    form.addEventListener('change', drawSummary);
    drawSummary();

    var err = $('#ep-form-error'), status = $('#ep-form-status'), btn = $('#ep-submit');
    function showErr(html) { err.innerHTML = html; err.hidden = false; status.hidden = true; btn.disabled = false; }
    var fallback = ' Please try again, or <a href="' + esc(mailtoFor(c.ids)) + '" style="border-bottom:1px solid var(--gold)">email Esmée</a> to buy.';
    form.addEventListener('submit', function (e) {
      e.preventDefault(); err.hidden = true;
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var st = state();
      btn.disabled = true; status.textContent = 'Taking you to the secure payment page...'; status.hidden = false;
      fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        ids: readCart().ids, delivery: st.pickup ? 'pickup' : 'ship', country: st.country, pickupCity: form.elements.pickupCity.value,
        email: form.elements.email.value.trim(), notes: form.elements.notes.value.trim() }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; }); })
        .then(function (r) {
          if (r.status === 200 && r.body.url) { location.href = r.body.url; return; }
          if (r.status === 409) {
            var gone = BY[r.body.id] ? BY[r.body.id].title : 'A work in your cart';
            writeCart(readCart().ids.filter(function (x) { return x !== r.body.id; }));
            showErr(esc(gone) + ' has just been sold or is no longer available, so it was taken out of your cart. <a href="/cart/" data-go="cart" style="border-bottom:1px solid var(--gold)">Review your cart</a>'); return;
          }
          if (r.status === 503) { showErr('Online payment is not switched on yet. <a href="' + esc(mailtoFor(c.ids)) + '" style="border-bottom:1px solid var(--gold)">Email Esmée</a> to buy this work.'); return; }
          showErr('Sorry, we could not start the payment.' + fallback);
        })
        .catch(function () { showErr('Sorry, we could not reach the payment service.' + fallback); });
    });
    // Coming back from Stripe with the Back button restores a disabled button; make sure the form is usable.
    window.addEventListener('pageshow', function () { btn.disabled = false; status.hidden = true; });
  }

  /* ---------------- thank you ---------------- */
  function initThanks() {
    var box = $('#ep-order'), id = new URLSearchParams(location.search).get('session_id');
    function drop() { box.parentNode.removeChild(box); var g = $('.ep-grid'); if (g) g.classList.add('ep-grid-one'); }
    if (!id) { drop(); return; }
    fetch('/api/session?id=' + encodeURIComponent(id)).then(function (r) { return r.json(); }).then(function (o) {
      if (!o || !o.paid) { drop(); return; }
      writeCart([]);
      $('#ep-thanks-eyebrow').textContent = 'Payment received';
      $('#ep-thanks-lead').textContent = 'Your payment went through. A receipt is on its way' + (o.email ? ' to ' + o.email : '') + ', and Esmée will be in touch about delivery.';
      box.hidden = false;
      box.innerHTML = '<div class="ep-cap" style="color:var(--gold)">Your order</div>' +
        '<div style="font-family:var(--serif);font-size:var(--fs-h2);line-height:1.1;margin-top:var(--space-sm)">' + esc(o.ref) + '</div>' +
        '<div style="margin-top:var(--space-md)">' + o.titles.map(function (n) { return '<div class="ep-sum"><span>' + esc(n) + '</span></div>'; }).join('') + '</div>' +
        '<div class="ep-sum"><span>' + esc(o.delivery) + '</span><b>' + (o.shipping ? esc(money(o.shipping)) : 'Free') + '</b></div>' +
        '<div class="ep-sum ep-sum-total"><span>Total paid</span><b>' + esc(money(o.total)) + '</b></div>' +
        '<p class="ep-note">Keep this reference if you write to Esmée about your order.</p>';
    }).catch(drop);
  }

  function init() {
    if (KIND === 'cart') initCart();
    else if (KIND === 'checkout') initCheckout();
    else if (KIND === 'thanks') initThanks();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
