// GET /api/session?id=cs_...  Returns a short summary of a PAID Checkout Session for the thank-you page.
const { send, stripe } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  if (!process.env.STRIPE_SECRET_KEY) return send(res, 503, { error: 'not_configured' });
  const id = String((req.query && req.query.id) || '');
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(id)) return send(res, 400, { error: 'bad_request' });
  try {
    const s = await stripe('GET', 'checkout/sessions/' + id, { expand: ['line_items'] });
    if (s.payment_status !== 'paid') return send(res, 200, { paid: false });
    const meta = s.metadata || {};
    return send(res, 200, {
      paid: true,
      ref: id.slice(-8).toUpperCase(),
      titles: ((s.line_items && s.line_items.data) || []).map((li) => li.description),
      total: s.amount_total / 100,
      shipping: s.shipping_cost ? s.shipping_cost.amount_total / 100 : 0,
      delivery: meta.delivery === 'pickup' ? 'Local pickup in ' + (meta.pickup_city || '') : 'Shipping',
      email: s.customer_details && s.customer_details.email,
    });
  } catch (e) {
    return send(res, 502, { error: 'lookup_failed' });
  }
};
