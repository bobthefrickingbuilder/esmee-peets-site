/* Esmée Peets: cart, checkout and thank-you pages.
   The cart is the same list the Store page keeps in localStorage ('ep-cart'). There is no payment on the site:
   checkout sends a purchase REQUEST; Esmée confirms availability and shipping, then sends a secure online invoice.

   To make the request form deliver straight to Esmée's inbox, set an endpoint (for example a Formspree form URL)
   below, or define window.EP_SHOP = { endpoint: '...' } before this script. With no endpoint, the form falls back
   to opening the visitor's email app with the request filled in. */
(function () {
  'use strict';
  var CONFIG = { endpoint: '', email: 'esmeepeets@gmail.com' };
  if (window.EP_SHOP) for (var k in window.EP_SHOP) CONFIG[k] = window.EP_SHOP[k];

  var KIND = document.currentScript.getAttribute('data-shop');
  var DATA = JSON.parse(document.getElementById('ep-data').textContent);
  var BY = {}; DATA.works.forEach(function (w) { BY[w.id] = w; });
  var PRICES = DATA.prices;
  var $ = function (s, r) { return (r || document).querySelector(s); };

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return '$' + n.toLocaleString('en-CA') + ' CAD'; }
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
  function totals(ids) {
    var total = 0, tbc = false;
    ids.forEach(function (id) { if (PRICES[id] == null) tbc = true; else total += PRICES[id]; });
    return { total: total, tbc: tbc, label: total ? money(total) + (tbc ? ' + price on request' : '') : 'Price on request' };
  }

  /* ---------------- cart ---------------- */
  function cartEmpty(dropped) {
    return '<div style="display:flex;flex-direction:column;gap:var(--space-md);align-items:flex-start">' +
      '<div style="font-family:var(--serif);font-size:var(--fs-h2);line-height:1.1">Nothing here <em>yet.</em></div>' +
      '<p style="margin:0;color:var(--ink-dim);max-width:46ch">' +
      (dropped ? 'The work you selected has since been sold or reserved, so it was taken out of your cart. ' : '') +
      'Browse the store and choose a work to add it to your cart.</p>' +
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
    var t = totals(c.ids);
    sum.hidden = false;
    sum.innerHTML = '<div class="ep-cap" style="color:var(--gold)">Summary</div>' +
      '<div style="margin-top:var(--space-sm)">' +
      '<div class="ep-sum"><span>' + c.ids.length + (c.ids.length === 1 ? ' work' : ' works') + '</span><b>' + esc(t.label) + '</b></div>' +
      '<div class="ep-sum"><span>Shipping</span><b>Quoted by Esmée</b></div>' +
      '<div class="ep-sum"><span>Taxes</span><b>Shown on the invoice</b></div>' +
      '<div class="ep-sum ep-sum-total"><span>Due today</span><b>$0.00</b></div></div>' +
      '<a class="ep-btn ep-btn-block" href="/checkout/" data-go="checkout" data-cursor="Checkout" style="margin-top:var(--space-lg)">Request to purchase <span>→</span></a>' +
      '<p class="ep-note">Nothing is charged now. Esmée confirms the work and the shipping, then sends a secure online invoice.</p>' +
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
  function newRef() { return 'EP-' + Date.now().toString(36).toUpperCase().slice(-6); }
  function orderText(d, ids, t, ref) {
    var lines = ['Purchase request ' + ref, '', 'Works:'];
    ids.forEach(function (id) { lines.push('- ' + BY[id].title + ' (' + BY[id].meta + '): ' + priceLabel(id)); });
    lines.push('Total: ' + t.label, '', 'Name: ' + d.name, 'Email: ' + d.email);
    if (d.phone) lines.push('Phone: ' + d.phone);
    if (d.delivery === 'pickup') lines.push('Delivery: local pickup in ' + d.pickupCity);
    else {
      lines.push('Delivery: ship to');
      lines.push([d.address1, d.address2].filter(Boolean).join(', '));
      lines.push([d.city, d.region, d.postal].filter(Boolean).join(', '));
      lines.push(d.country);
    }
    if (d.notes) lines.push('', 'Notes: ' + d.notes);
    return lines.join('\n');
  }
  function initCheckout() {
    var c = readCart(), main = $('#ep-checkout-main'), sum = $('#ep-checkout-summary'), grid = $('[data-ep="checkout-grid"]');
    var form = $('#ep-form');
    if (!c.ids.length) {
      grid.classList.add('ep-grid-one');
      main.innerHTML = cartEmpty(c.dropped); sum.hidden = true; return;
    }
    var t = totals(c.ids);
    sum.hidden = false;
    sum.innerHTML = '<div class="ep-cap" style="color:var(--gold)">Your works</div>' +
      '<div style="margin-top:var(--space-sm)">' + itemsHtml(c.ids) + '</div>' +
      '<div class="ep-sum ep-sum-total"><span>Total</span><b>' + esc(t.label) + '</b></div>' +
      '<div class="ep-sum"><span>Shipping</span><b>Quoted by Esmée</b></div>' +
      '<div class="ep-sum"><span>Due today</span><b>$0.00</b></div>' +
      '<div class="ep-cap" style="color:var(--gold);margin-top:var(--space-xl)">What happens next</div>' +
      '<ol class="ep-steps">' +
      '<li><span><b>Esmée confirms</b>She checks the work is available and replies with shipping.</span></li>' +
      '<li><span><b>You get an invoice</b>A secure online invoice arrives by email.</span></li>' +
      '<li><span><b>Your work ships</b>Tracked and insured, or ready for pickup.</span></li></ol>' +
      '<a class="ep-link ep-link-dim" href="/cart/" data-go="cart" style="display:inline-block;margin-top:var(--space-lg)">Edit cart</a>';
    form.hidden = false;

    var ship = $('#ep-ship'), pick = $('#ep-pickup');
    function syncDelivery() {
      var pickup = form.elements.delivery.value === 'pickup';
      ship.hidden = pickup; pick.hidden = !pickup;
      ['address1', 'city', 'postal', 'country'].forEach(function (n) { form.elements[n].required = !pickup; });
    }
    form.addEventListener('change', function (e) { if (e.target.name === 'delivery') syncDelivery(); });
    syncDelivery();

    var err = $('#ep-form-error'), status = $('#ep-form-status'), btn = $('#ep-submit');
    function showErr(msg) { err.textContent = msg; err.hidden = false; status.hidden = true; }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      if (form.elements.website.value) return; // spam trap
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var cart = readCart().ids;
      if (!cart.length) { showErr('Your cart is empty, or the work you chose is no longer available.'); return; }
      var d = {}; Array.prototype.forEach.call(form.elements, function (el) { if (el.name && el.type !== 'checkbox' && el.type !== 'radio') d[el.name] = (el.value || '').trim(); });
      d.delivery = form.elements.delivery.value;
      var ref = newRef(), tt = totals(cart), text = orderText(d, cart, tt, ref);
      var subject = 'Purchase request ' + ref + ': ' + cart.map(function (id) { return BY[id].title; }).join(', ');

      if (CONFIG.endpoint) {
        btn.disabled = true; status.textContent = 'Sending your request...'; status.hidden = false;
        var payload = { _subject: subject, reference: ref, name: d.name, email: d.email, phone: d.phone, delivery: d.delivery, details: text,
          works: cart.map(function (id) { return { id: id, title: BY[id].title, price: PRICES[id] }; }), total: tt.label };
        fetch(CONFIG.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload) })
          .then(function (r) { if (!r.ok) throw new Error('bad status'); })
          .then(function () {
            try { sessionStorage.setItem('ep-last-order', JSON.stringify({ ref: ref, titles: cart.map(function (id) { return BY[id].title; }), total: tt.label, delivery: d.delivery === 'pickup' ? 'Local pickup in ' + d.pickupCity : 'Shipping to ' + [d.city, d.country].filter(Boolean).join(', '), email: d.email })); } catch (x) {}
            writeCart([]); location.href = '/thank-you/';
          })
          .catch(function () { btn.disabled = false; showErr('Sorry, that did not go through. Please try again, or email ' + CONFIG.email + ' directly.'); });
      } else {
        status.innerHTML = 'Your email app should open with your request filled in. Press send there to finish. If nothing opens, email <a href="mailto:' + CONFIG.email + '" style="border-bottom:1px solid var(--gold)">' + CONFIG.email + '</a> with the works you want and your delivery details.';
        status.hidden = false;
        location.href = 'mailto:' + CONFIG.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
      }
    });
  }

  /* ---------------- thank you ---------------- */
  function initThanks() {
    var o = null; try { o = JSON.parse(sessionStorage.getItem('ep-last-order') || 'null'); } catch (e) {}
    var box = $('#ep-order');
    if (!o) { box.parentNode.removeChild(box); var g = $('.ep-grid'); if (g) g.classList.add('ep-grid-one'); return; }
    box.hidden = false;
    box.innerHTML = '<div class="ep-cap" style="color:var(--gold)">Your request</div>' +
      '<div style="font-family:var(--serif);font-size:var(--fs-h2);line-height:1.1;margin-top:var(--space-sm)">' + esc(o.ref) + '</div>' +
      '<div style="margin-top:var(--space-md)">' + o.titles.map(function (n) { return '<div class="ep-sum"><span>' + esc(n) + '</span></div>'; }).join('') + '</div>' +
      '<div class="ep-sum ep-sum-total"><span>Total</span><b>' + esc(o.total) + '</b></div>' +
      '<div class="ep-sum"><span>Delivery</span><b>' + esc(o.delivery) + '</b></div>' +
      '<p class="ep-note">Keep this reference if you write to Esmée about your request.</p>';
  }

  function init() {
    if (KIND === 'cart') initCart();
    else if (KIND === 'checkout') initCheckout();
    else if (KIND === 'thanks') initThanks();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
