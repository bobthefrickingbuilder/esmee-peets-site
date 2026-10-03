// Shared helpers for the checkout functions. Prices and shipping rates come from api/_data.json, which
// tools/build.py generates from design-source/store-data.json and shipping.json. The browser only ever sends
// work ids, so nobody can change a price from their side.
const DATA = require('./_data.json');

const SITE = process.env.SITE_URL || 'https://esmeepeets.com';
const CATALOG = DATA.catalog;
const SHIPPING = DATA.shipping;
const COUNTRIES = {};
SHIPPING.countries.forEach((c) => { COUNTRIES[c.code] = c; });

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Flat rate per work (by size tier and destination zone). The dearest work pays in full, each extra work pays a share.
function shippingCost(works, countryCode) {
  const zone = COUNTRIES[countryCode].zone;
  const rates = works.map((w) => SHIPPING.rates[w.shipTier][zone]).sort((a, b) => b - a);
  const total = rates.reduce((sum, r, i) => sum + (i === 0 ? r : r * SHIPPING.extraWorkFactor), 0);
  return Math.round(total);
}

// Stripe takes form-encoded bodies with bracket notation for nested values.
function encode(value, prefix, out) {
  out = out || [];
  if (Array.isArray(value)) value.forEach((v, i) => encode(v, prefix + '[' + i + ']', out));
  else if (value !== null && typeof value === 'object') Object.keys(value).forEach((k) => encode(value[k], prefix ? prefix + '[' + k + ']' : k, out));
  else if (value !== undefined) out.push(encodeURIComponent(prefix) + '=' + encodeURIComponent(String(value)));
  return out;
}

async function stripe(method, path, params) {
  const init = {
    method,
    headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
  };
  let url = 'https://api.stripe.com/v1/' + path;
  const body = params ? encode(params, '').join('&') : '';
  if (method === 'GET') { if (body) url += (path.includes('?') ? '&' : '?') + body; } else init.body = body;
  const r = await fetch(url, init);
  const json = await r.json();
  if (!r.ok) {
    const err = new Error((json.error && json.error.message) || 'Stripe error');
    err.status = r.status;
    throw err;
  }
  return json;
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

module.exports = { SITE, CATALOG, SHIPPING, COUNTRIES, send, shippingCost, stripe, readJson };
