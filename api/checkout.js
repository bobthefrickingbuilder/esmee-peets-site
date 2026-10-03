// POST /api/checkout  { ids: [...], delivery: 'ship'|'pickup', country: 'CA', pickupCity, email, notes }
// Creates a Stripe Checkout Session and returns { url }. Needs the STRIPE_SECRET_KEY environment variable.
const { SITE, CATALOG, SHIPPING, COUNTRIES, send, shippingCost, stripe, readJson } = require('./_lib');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  if (!process.env.STRIPE_SECRET_KEY) return send(res, 503, { error: 'not_configured' });

  let b;
  try { b = await readJson(req); } catch (e) { return send(res, 400, { error: 'bad_request' }); }

  const ids = Array.isArray(b.ids) ? b.ids.filter((x, i, a) => typeof x === 'string' && a.indexOf(x) === i) : [];
  if (!ids.length || ids.length > 10) return send(res, 400, { error: 'bad_request' });
  const delivery = b.delivery === 'pickup' ? 'pickup' : 'ship';
  const country = String(b.country || '').toUpperCase();
  const email = String(b.email || '').trim();
  const notes = String(b.notes || '').slice(0, 450);
  if (!COUNTRIES[country] || !EMAIL_RE.test(email)) return send(res, 400, { error: 'bad_request' });
  let pickupCity = '';
  if (delivery === 'pickup') {
    pickupCity = String(b.pickupCity || '');
    if (country !== 'CA' || SHIPPING.pickupCities.indexOf(pickupCity) < 0) return send(res, 400, { error: 'bad_request' });
  }

  const works = [];
  for (const id of ids) {
    const w = CATALOG[id];
    if (!w || w.status !== 'available' || !(w.priceCAD > 0) || !SHIPPING.rates[w.shipTier]) return send(res, 409, { error: 'unavailable', id });
    works.push(Object.assign({ id }, w));
  }

  try {
    // Every work is one of a kind: refuse if a paid order already exists for it (covers a sale made since the last site update).
    for (const w of works) {
      const q = "status:'succeeded' AND metadata['work_" + w.id.replace(/-/g, '_') + "']:'1'";
      const found = await stripe('GET', 'payment_intents/search', { query: q, limit: 1 });
      if (found.data && found.data.length) return send(res, 409, { error: 'unavailable', id: w.id });
    }

    const meta = { works: ids.join(','), delivery };
    if (notes) meta.notes = notes;
    if (pickupCity) meta.pickup_city = pickupCity;
    const piMeta = Object.assign({}, meta);
    works.forEach((w) => { piMeta['work_' + w.id.replace(/-/g, '_')] = '1'; });

    const params = {
      mode: 'payment',
      customer_email: email,
      success_url: SITE + '/thank-you/?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: SITE + '/cart/',
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      locale: 'auto',
      submit_type: 'pay',
      line_items: works.map((w) => ({
        quantity: 1,
        price_data: {
          currency: 'cad',
          unit_amount: Math.round(w.priceCAD * 100),
          product_data: { name: w.title, description: w.description || undefined, images: [w.image] },
        },
      })),
      metadata: meta,
      payment_intent_data: {
        description: 'Esmée Peets: ' + works.map((w) => w.title).join(', '),
        metadata: piMeta,
      },
      custom_text: { submit: { message: 'An original, one-of-a-kind work. Esmée will email you about delivery.' } },
    };

    if (delivery === 'pickup') {
      params.shipping_options = [{ shipping_rate_data: { type: 'fixed_amount', display_name: 'Local pickup in ' + pickupCity + ' (free)',
        fixed_amount: { amount: 0, currency: 'cad' } } }];
    } else {
      const ship = shippingCost(works, country);
      params.shipping_address_collection = { allowed_countries: [country] };
      params.phone_number_collection = { enabled: true };
      params.shipping_options = [{ shipping_rate_data: { type: 'fixed_amount', display_name: 'Tracked and insured shipping to ' + COUNTRIES[country].name,
        fixed_amount: { amount: ship * 100, currency: 'cad' } } }];
    }

    const session = await stripe('POST', 'checkout/sessions', params);
    return send(res, 200, { url: session.url });
  } catch (e) {
    console.error('checkout failed:', e.message);
    return send(res, 502, { error: 'payment_unavailable' });
  }
};
