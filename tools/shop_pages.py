"""Shop support pages for esmeepeets.com: 404, cart, checkout, thank-you, and draft policy pages.

These are generated from the compiled Contact page (same header, footer, curtain, grain and tokens), so they
stay in step with the rest of the site. build.py calls build(contact_html) and writes the results.
"""
import html as _html
import json
import re

SITE = 'https://esmeepeets.com'
EMAIL = 'esmeepeets@gmail.com'


def esc_a(s):
    return _html.escape(s, quote=True)


SHOP_CSS = '''
/* shop pages: cart, checkout, thank-you, 404, policies */
.ep-wrap{position:relative;max-width:var(--max-w);margin:0 auto}
.ep-narrow{max-width:760px}
.ep-eyebrow{font-size:var(--fs-eyebrow);letter-spacing:var(--tr-eyebrow);text-transform:uppercase;color:var(--gold)}
.ep-h1{margin:var(--space-sm) 0 0;font-family:var(--serif);font-weight:var(--fw-light);font-size:var(--fs-h1);line-height:.98}
.ep-h1 em{color:var(--rose-dust)}
.ep-h1-xl{font-size:var(--fs-contact)}
.ep-lead{margin:var(--space-lg) 0 0;max-width:54ch;color:var(--ink-dim);font-size:var(--fs-lead);text-wrap:pretty}
.ep-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:clamp(1.5rem,4vw,3.5rem);margin-top:var(--space-3xl);align-items:start}
.ep-grid-one{grid-template-columns:minmax(0,1fr)}
@media(max-width:880px){.ep-grid{grid-template-columns:minmax(0,1fr)}}
.ep-card{background:var(--surface-glass);border:1px solid var(--line);border-radius:var(--radius-md);padding:clamp(1.2rem,3.5vw,2.2rem);backdrop-filter:blur(14px)}
.ep-sticky{position:sticky;top:6.5rem}
@media(max-width:880px){.ep-sticky{position:static}}
.ep-label{display:flex;flex-direction:column;gap:.4rem}
.ep-label>span,.ep-cap{font-size:var(--fs-eyebrow);letter-spacing:var(--tr-eyebrow);text-transform:uppercase;color:var(--ink-faint)}
.ep-input{width:100%;background:transparent;border:0;border-bottom:1px solid var(--line);padding:.6rem 0;font-size:1.1rem;outline:none;border-radius:0;color:var(--ink)}
.ep-input:focus{border-bottom-color:var(--gold)}
select.ep-input{appearance:none;-webkit-appearance:none;cursor:pointer;background-image:linear-gradient(45deg,transparent 50%,var(--ink-faint) 50%),linear-gradient(135deg,var(--ink-faint) 50%,transparent 50%);background-position:calc(100% - 14px) 55%,calc(100% - 9px) 55%;background-size:5px 5px,5px 5px;background-repeat:no-repeat;padding-right:1.6rem}
select.ep-input option{background:var(--bg);color:var(--ink)}
textarea.ep-input{resize:vertical;min-height:5.5rem}
.ep-two{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-xl)}
@media(max-width:560px){.ep-two{grid-template-columns:minmax(0,1fr)}}
.ep-form{display:flex;flex-direction:column;gap:var(--space-xl)}
[hidden].ep-fieldset,[hidden].ep-card,[hidden].ep-form,.ep-card[hidden]{display:none!important}
.ep-fieldset{border:0;margin:0;padding:0;min-width:0;display:flex;flex-direction:column;gap:var(--space-xl)}
.ep-btn{display:inline-flex;align-items:center;justify-content:center;gap:.7rem;padding:1rem 1.6rem;border-radius:var(--radius-pill);border:1px solid var(--ink);background:var(--ink);color:var(--bg);font-size:var(--fs-btn);letter-spacing:var(--tr-btn);text-transform:uppercase;cursor:pointer;white-space:nowrap;transition:background var(--dur-hover) var(--ease),border-color var(--dur-hover) var(--ease)}
.ep-btn:hover{background:var(--gold);border-color:var(--gold);color:var(--bg)}
.ep-btn[disabled]{opacity:.55;pointer-events:none}
.ep-btn-ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.ep-btn-ghost:hover{background:transparent;border-color:var(--ink-faint);color:var(--ink)}
.ep-btn-block{width:100%}
.ep-actions{display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-md)}
.ep-link{background:transparent;border:0;padding:0 0 3px;border-bottom:1px solid var(--gold);font-size:var(--fs-small);cursor:pointer;color:var(--ink)}
.ep-link-dim{border-bottom-color:var(--line);color:var(--ink-dim);font-size:var(--fs-meta)}
.ep-link-dim:hover{color:var(--ink);border-bottom-color:var(--ink-faint)}
.ep-row{display:grid;grid-template-columns:84px minmax(0,1fr) auto;gap:var(--space-md);align-items:center;padding:var(--space-md) 0;border-top:1px solid var(--line)}
.ep-row:first-child{border-top:0;padding-top:0}
.ep-row:last-child{padding-bottom:0}
.ep-thumb{width:84px;height:104px;object-fit:cover;border-radius:var(--radius-sm);background:var(--surface);display:block}
.ep-row-title{font-family:var(--serif);font-size:1.35rem;line-height:1.15}
.ep-row-meta{margin-top:.25rem;font-size:var(--fs-meta);color:var(--ink-dim)}
.ep-row-end{display:flex;flex-direction:column;align-items:flex-end;gap:.6rem;text-align:right;font-size:var(--fs-small)}
@media(max-width:520px){.ep-row{grid-template-columns:64px minmax(0,1fr)}.ep-thumb{width:64px;height:80px}.ep-row-end{grid-column:2;flex-direction:row;justify-content:space-between;align-items:baseline;text-align:left}}
.ep-mini{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:.8rem;align-items:center;padding:.7rem 0;border-top:1px solid var(--line);font-size:var(--fs-small)}
.ep-mini:first-child{border-top:0}
.ep-mini img{width:44px;height:54px;object-fit:cover;border-radius:4px;display:block}
.ep-mini b{font-family:var(--serif);font-weight:var(--fw-regular);font-size:1.05rem}
.ep-sum{display:flex;justify-content:space-between;gap:var(--space-md);padding:.55rem 0;font-size:var(--fs-small);color:var(--ink-dim)}
.ep-sum b{font-weight:var(--fw-regular);color:var(--ink);text-align:right}
.ep-sum-total{border-top:1px solid var(--line);margin-top:.4rem;padding-top:1rem;color:var(--ink);font-size:1rem}
.ep-note{margin:var(--space-md) 0 0;font-size:var(--fs-meta);color:var(--ink-faint);line-height:1.55;text-wrap:pretty}
.ep-choice{display:flex;flex-wrap:wrap;gap:var(--space-2xs)}
.ep-choice label{cursor:pointer}
.ep-choice input{position:absolute;opacity:0;pointer-events:none}
.ep-choice span{display:inline-block;padding:.55rem 1rem;border-radius:var(--radius-pill);border:1px solid var(--line);color:var(--ink-dim);font-size:var(--fs-pill);transition:color var(--dur-hover) var(--ease),border-color var(--dur-hover) var(--ease)}
.ep-choice label:hover span{color:var(--ink);border-color:var(--ink-faint)}
.ep-choice input:checked+span{background:var(--rose);border-color:var(--rose);color:var(--bg)}
.ep-choice input:focus-visible+span{outline:2px solid var(--gold);outline-offset:2px}
.ep-check{display:flex;gap:.8rem;align-items:flex-start;font-size:var(--fs-small);color:var(--ink-dim);line-height:1.5;cursor:pointer}
.ep-check input{margin-top:.2rem;accent-color:var(--gold);width:1rem;height:1rem;flex:none}
.ep-steps{margin:var(--space-md) 0 0;padding:0;list-style:none;counter-reset:s;display:flex;flex-direction:column;gap:var(--space-md)}
.ep-steps li{counter-increment:s;display:grid;grid-template-columns:2rem 1fr;gap:.6rem;font-size:var(--fs-small);color:var(--ink-dim);line-height:1.5}
.ep-steps li::before{content:counter(s);font-family:var(--serif);font-size:1.4rem;color:var(--gold);line-height:1}
.ep-steps b{display:block;color:var(--ink);font-weight:var(--fw-regular)}
.ep-status{margin:0;padding:.9rem 1.1rem;border:1px solid var(--line);border-radius:var(--radius-sm);font-size:var(--fs-small);line-height:1.5;color:var(--ink-dim);background:rgba(246,239,228,.04)}
.ep-status[hidden]{display:none}
.ep-status.is-error{border-color:var(--rose);color:var(--ink)}
.ep-hp{position:absolute!important;left:-9999px;width:1px;height:1px;overflow:hidden}
.ep-badge{display:inline-block;margin-top:.5rem;padding:.2rem .6rem;border:1px solid var(--line);border-radius:var(--radius-pill);font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint)}
.ep-prose h2{margin:var(--space-3xl) 0 0;font-family:var(--serif);font-weight:var(--fw-light);font-size:var(--fs-h2);line-height:1.1}
.ep-prose p,.ep-prose li{color:var(--ink-dim);line-height:1.7;text-wrap:pretty}
.ep-prose p{margin:var(--space-md) 0 0}
.ep-prose ul{margin:var(--space-md) 0 0;padding-left:1.2rem}
.ep-prose li{margin-top:.5rem}
.ep-prose a{color:var(--ink);border-bottom:1px solid var(--gold)}
.ep-draft{margin-top:var(--space-xl);padding:.9rem 1.1rem;border:1px dashed var(--gold);border-radius:var(--radius-sm);font-size:var(--fs-small);color:var(--ink-dim);line-height:1.5}
.ep-table-wrap{margin-top:var(--space-lg);overflow-x:auto}
.ep-table{width:100%;border-collapse:collapse;font-size:var(--fs-small);min-width:420px}
.ep-table th,.ep-table td{padding:.8rem .9rem;border-bottom:1px solid var(--line);text-align:right;font-weight:var(--fw-regular);color:var(--ink)}
.ep-table th:first-child{text-align:left}
.ep-table thead th{font-size:var(--fs-eyebrow);letter-spacing:var(--tr-eyebrow);text-transform:uppercase;color:var(--ink-faint)}
.ep-table small{display:block;margin-top:.2rem;font-size:var(--fs-meta);color:var(--ink-faint)}
.ep-foot-links{display:flex;flex-wrap:wrap;gap:.4rem 1.4rem}
.ep-foot-links a{color:var(--ink-faint)}
.ep-foot-links a:hover{color:var(--gold)}
'''

NAV_ACTIVE_RE = re.compile(r'<a href="/contact/" data-go="contact" style="color:var\(--ink\); padding-bottom:4px; border-bottom:1px solid var\(--gold\)">')
NAV_INACTIVE = ('<a class="scp0" href="/contact/" data-go="contact" style="color:var(--ink-dim); padding-bottom:4px; '
                'border-bottom:1px solid transparent; transition:color var(--dur-hover) var(--ease)">')
MAIN_RE = re.compile(r'<main data-screen-label="Contact".*?</main>', re.S)


def head(title, desc, path, noindex=True, canonical=True):
    url = SITE + '/' + path
    robots = '<meta name="robots" content="noindex, follow">\n' if noindex else ''
    canon = f'<link rel="canonical" href="{url}">\n' if canonical else ''
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc_a(title)}</title>
<meta name="description" content="{esc_a(desc)}">
{robots}{canon}<meta property="og:type" content="website">
<meta property="og:site_name" content="Esmée Peets">
<meta property="og:title" content="{esc_a(title)}">
<meta property="og:description" content="{esc_a(desc)}">
'''


def main(label, inner, mesh):
    return (f'<main data-screen-label="{label}" style="position:relative; overflow:hidden; '
            f'padding:var(--contact-head-top) var(--gutter) var(--section-y); min-height:70vh">\n{mesh}\n'
            f'<div class="ep-wrap">\n{inner}\n</div>\n</main>')


def btn(href, go, text, ghost=False, cursor=''):
    cls = 'ep-btn ep-btn-ghost' if ghost else 'ep-btn'
    cur = f' data-cursor="{cursor}"' if cursor else ''
    return f'<a class="{cls}" href="{href}" data-go="{go}"{cur}>{text}</a>'


# ---------------------------------------------------------------- page bodies
def page_404():
    return '''<div data-reveal="1">
<div class="ep-eyebrow">Erreur 404</div>
<h1 class="ep-h1 ep-h1-xl">Page <em>introuvable.</em></h1>
<p class="ep-lead">This page has moved, or it never existed. The gallery and the store are both a click away.</p>
<div class="ep-actions" style="margin-top:var(--space-2xl)">
''' + btn('/', 'home', 'Back home') + btn('/work/', 'work', 'See the work', True) + btn('/store/', 'store', 'Visit the store', True) + '''
</div>
</div>'''


def page_cart():
    return '''<div data-reveal="1">
<div class="ep-eyebrow">Your cart</div>
<h1 class="ep-h1">Your <em>cart.</em></h1>
<p class="ep-lead">Every work is one of a kind, so there are no quantities. Shipping is worked out at checkout from where the work is going.</p>
</div>
<div class="ep-grid" data-ep="cart-grid">
<div class="ep-card" id="ep-cart-list" aria-live="polite">
<noscript><p style="margin:0;color:var(--ink-dim)">The cart needs JavaScript. To buy a work, email <a href="mailto:esmeepeets@gmail.com" style="border-bottom:1px solid var(--gold)">esmeepeets@gmail.com</a> with the title of the piece.</p></noscript>
</div>
<aside class="ep-card ep-sticky" id="ep-cart-summary" hidden></aside>
</div>'''


def page_checkout():
    return '''<div data-reveal="1">
<div class="ep-eyebrow">Checkout</div>
<h1 class="ep-h1">Secure <em>checkout.</em></h1>
<p class="ep-lead">Choose how the work reaches you. You pay on Stripe's secure page, so Esmée never sees your card details.</p>
</div>
<div class="ep-grid" data-ep="checkout-grid">
<div class="ep-card" id="ep-checkout-main">
<noscript><p style="margin:0;color:var(--ink-dim)">Checkout needs JavaScript. Please email <a href="mailto:esmeepeets@gmail.com" style="border-bottom:1px solid var(--gold)">esmeepeets@gmail.com</a> to buy a work.</p></noscript>
<form class="ep-form" id="ep-form" novalidate hidden>
<fieldset class="ep-fieldset">
<div class="ep-cap" style="color:var(--gold)">1. Your email</div>
<label class="ep-label"><span>Email for your receipt and delivery updates</span><input class="ep-input" name="email" type="email" autocomplete="email" required></label>
</fieldset>
<fieldset class="ep-fieldset">
<div class="ep-cap" style="color:var(--gold)">2. Delivery</div>
<label class="ep-label"><span>Country</span><select class="ep-input" name="country" id="ep-country" autocomplete="country"></select></label>
<div class="ep-choice" role="radiogroup" aria-label="Delivery method" id="ep-method">
<label><input type="radio" name="delivery" value="ship" checked><span>Ship to me</span></label>
<label id="ep-pickup-opt"><input type="radio" name="delivery" value="pickup"><span>Local pickup</span></label>
</div>
<div class="ep-fieldset" id="ep-pickup" hidden>
<label class="ep-label"><span>Pickup city</span><select class="ep-input" name="pickupCity" id="ep-pickup-city"></select></label>
<p class="ep-note" style="margin:0">Pickup is free. Esmée will email you to arrange a time and place.</p>
</div>
<p class="ep-note" style="margin:0" id="ep-ship-note">You will enter your street address on the next page.</p>
</fieldset>
<fieldset class="ep-fieldset">
<div class="ep-cap" style="color:var(--gold)">3. Anything else</div>
<label class="ep-label"><span>Notes for Esmée (optional)</span><textarea class="ep-input" name="notes" rows="3" maxlength="400"></textarea></label>
</fieldset>
<label class="ep-check"><input type="checkbox" name="consent" required><span>I have read the <a href="/shipping-returns/" data-go="shipping" style="border-bottom:1px solid var(--gold)">shipping &amp; returns</a> and <a href="/terms/" data-go="terms" style="border-bottom:1px solid var(--gold)">terms of sale</a>.</span></label>
<p class="ep-status is-error" id="ep-form-error" role="alert" hidden></p>
<p class="ep-status" id="ep-form-status" role="status" hidden></p>
<div class="ep-actions">
<button class="ep-btn" type="submit" id="ep-submit" data-cursor="Pay">Continue to secure payment <span>→</span></button>
<a class="ep-link ep-link-dim" href="/cart/" data-go="cart">Back to cart</a>
</div>
<p class="ep-note" style="margin:0">Payments are processed by Stripe. Card, Apple Pay and Google Pay are accepted.</p>
</form>
</div>
<aside class="ep-card ep-sticky" id="ep-checkout-summary" hidden></aside>
</div>'''


def page_thanks():
    return '''<div data-reveal="1">
<div class="ep-eyebrow" id="ep-thanks-eyebrow">Thank you</div>
<h1 class="ep-h1 ep-h1-xl">Merci, <em>à bientôt.</em></h1>
<p class="ep-lead" id="ep-thanks-lead">Thank you for visiting. If you have just made a purchase, a receipt is on its way to your inbox.</p>
</div>
<div class="ep-grid" style="margin-top:var(--space-2xl)">
<div class="ep-card" id="ep-order" hidden></div>
<div class="ep-card">
<div class="ep-cap" style="color:var(--gold)">What happens next</div>
<ol class="ep-steps">
<li><span><b>Your receipt</b>Stripe emails a receipt to the address you gave.</span></li>
<li><span><b>Esmée gets in touch</b>She will email you to confirm delivery, or to arrange a pickup time.</span></li>
<li><span><b>The work is packed and sent</b>Tracked and insured, with a tracking number sent to you.</span></li>
</ol>
<p class="ep-note">Questions about your order? Write to <a href="mailto:esmeepeets@gmail.com" style="border-bottom:1px solid var(--gold)">esmeepeets@gmail.com</a>.</p>
</div>
</div>
<div class="ep-actions" style="margin-top:var(--space-2xl)">
''' + btn('/work/', 'work', 'Keep looking at the work', True) + btn('/', 'home', 'Back home', True) + '''
</div>'''


DRAFT = ('<div class="ep-draft"><b style="color:var(--ink);font-weight:var(--fw-regular)">Draft for Esmée to review.</b> '
         'This page was written as a plain-language starting point, not legal advice. Confirm the details (especially the '
         'numbers of days and the return terms) before relying on it.</div>')


def prose(eyebrow, h1, lead, body):
    return f'''<div data-reveal="1" class="ep-narrow">
<div class="ep-eyebrow">{eyebrow}</div>
<h1 class="ep-h1">{h1}</h1>
<p class="ep-lead">{lead}</p>
{DRAFT}
<div class="ep-prose">
{body}
</div>
</div>'''


def rates_table(sh):
    zones = ['CA', 'US', 'INTL']
    head = ''.join(f'<th>{esc_a(sh["zoneNames"][z])}</th>' for z in zones)
    rows = ''
    for tier, desc in sh['tiers'].items():
        cells = ''.join(f'<td>${sh["rates"][tier][z]}</td>' for z in zones)
        rows += f'<tr><th scope="row">{tier.capitalize()}<small>{esc_a(desc)}</small></th>{cells}</tr>'
    return f'<div class="ep-table-wrap"><table class="ep-table"><thead><tr><th></th>{head}</tr></thead><tbody>{rows}</tbody></table></div>'


def page_shipping(sh):
    return prose('Shipping &amp; returns', 'Shipping &amp; <em>returns.</em>',
                 'Every work is one of a kind and travels carefully. Here is how delivery and returns work.', f'''
<h2>How shipping works</h2>
<p>Originals are packed flat or crated, protected against moisture and impact, and sent tracked and insured. Shipping is a flat rate based on the size of the work and where it is going. You see the exact amount at checkout before you pay.</p>
{rates_table(sh)}
<p>Rates are in Canadian dollars. If you buy more than one work, the dearest one pays its full rate and each additional work pays half.</p>
<h2>Local pickup</h2>
<p>Pickup is free in Ottawa and Montréal. Choose it at checkout and Esmée will email you to arrange a time and place.</p>
<h2>Delivery times</h2>
<p>Esmée will email you with an estimate once your order is packed. Times depend on the destination and on the carrier.</p>
<h2>International orders</h2>
<p>Duties, import taxes and customs fees are set by the destination country and are the buyer's responsibility. If your country is not on the list at checkout, email <a href="mailto:esmeepeets@gmail.com">esmeepeets@gmail.com</a> and Esmée will arrange it with you.</p>
<h2>If something arrives damaged</h2>
<p>Please write to <a href="mailto:esmeepeets@gmail.com">esmeepeets@gmail.com</a> within 48 hours of delivery with photos of the work and the packaging, and keep the packaging. Esmée will sort out the carrier claim and the next steps with you.</p>
<h2>Returns</h2>
<p>Because each work is an original and unique, sales are final. The exception is a work that arrives damaged, or that is not as described: contact Esmée within 7 days of delivery and she will make it right.</p>
''')


def page_privacy():
    return prose('Privacy', 'Your <em>privacy.</em>',
                 'What this site collects, why, and how to ask for it to be removed.', '''
<h2>What is collected</h2>
<p>When you buy a work or send a message, the site collects the details you type: your email and your notes. Stripe collects your name, delivery address, phone number and payment details on its own page and passes the delivery details to Esmée so she can ship your order. The works in your cart are saved in your own browser so they are still there when you come back. No account is created.</p>
<h2>How it is used</h2>
<p>Only to answer you, process your order and arrange delivery. It is not sold or shared for advertising.</p>
<h2>Payments</h2>
<p>Payments are handled by Stripe on its own secure page. Esmée never sees or stores your card number. Stripe's use of your data is covered by its own privacy policy.</p>
<h2>Analytics</h2>
<p>The site uses privacy-friendly visitor statistics that count page views without tracking you across other sites.</p>
<h2>Keeping and deleting your information</h2>
<p>Order details are kept for as long as needed for the sale, delivery, and accounting records. To see what is held about you, correct it, or ask for it to be deleted, write to <a href="mailto:esmeepeets@gmail.com">esmeepeets@gmail.com</a>. Personal information is handled in line with Canadian privacy law, including Québec's Law 25.</p>
''')


def page_terms():
    return prose('Terms of sale', 'Terms of <em>sale.</em>',
                 'The short, plain version of how buying an original work from Esmée works.', '''
<h2>Original works</h2>
<p>Each work listed in the store is a one-of-a-kind original. Colours on a screen can differ slightly from the work in person.</p>
<h2>Availability</h2>
<p>Each work is sold once. A purchase is complete when your payment goes through. If two people try to buy the same work at the same moment, the first completed payment gets it, and Esmée will refund the other in full.</p>
<h2>Prices and payment</h2>
<p>Prices are in Canadian dollars and are paid by card, Apple Pay or Google Pay on Stripe's secure payment page. Shipping is calculated at checkout, and you see the full amount before you pay. No GST/HST is added to the price.</p>
<h2>Copyright</h2>
<p>Buying a work gives you the physical piece. Copyright stays with Esmée, so images of the work may not be reproduced, sold or published without her written permission.</p>
<h2>Shipping and returns</h2>
<p>See <a href="/shipping-returns/" data-go="shipping">shipping &amp; returns</a>.</p>
<h2>Questions</h2>
<p>Write to <a href="mailto:esmeepeets@gmail.com">esmeepeets@gmail.com</a>, in English or French.</p>
''')


PAGES = {
    # key: (path, <title>, description, noindex, page-id, label, body-fn, extra script)
    '404': ('404.html', 'Page not found · Esmée Peets', 'This page could not be found.', True, '404', '404', page_404, ''),
    'cart': ('cart/index.html', 'Cart · Esmée Peets', 'Your selected works.', True, 'cart', 'Cart', page_cart, 'cart'),
    'checkout': ('checkout/index.html', 'Checkout · Esmée Peets', 'Send a purchase request to Esmée Peets.', True, 'checkout', 'Checkout', page_checkout, 'checkout'),
    'thank-you': ('thank-you/index.html', 'Thank you · Esmée Peets', 'Your request has been received.', True, 'thank-you', 'Thank you', page_thanks, 'thanks'),
    'shipping-returns': ('shipping-returns/index.html', 'Shipping & returns · Esmée Peets', 'How shipping and returns work for original artworks.', True, 'shipping', 'Shipping and returns', page_shipping, ''),
    'privacy': ('privacy/index.html', 'Privacy · Esmée Peets', 'How this site handles your information.', True, 'privacy', 'Privacy', page_privacy, ''),
    'terms': ('terms/index.html', 'Terms of sale · Esmée Peets', 'Terms for buying original works.', True, 'terms', 'Terms of sale', page_terms, ''),
}


def build(contact_html, shipping):
    """Return {output path: html} for every shop page, derived from the compiled Contact page."""
    mesh = next(l for l in contact_html.split('\n') if l.lstrip().startswith('<div style="position:absolute; inset:0; opacity:.55; pointer-events:none">'))
    tail_at = contact_html.index('<link rel="icon" href="/favicon.ico"')
    tail = contact_html[tail_at:]
    assert MAIN_RE.search(tail) and NAV_ACTIVE_RE.search(tail)
    out = {}
    for key, (path, title, desc, noindex, pid, label, fn, js) in PAGES.items():
        inner = fn(shipping) if key == 'shipping-returns' else fn()
        if key == 'checkout':   # checkout reads the same rates the server uses (design-source/shipping.json)
            inner += '\n<script id="ep-ship" type="application/json">' + json.dumps(shipping, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + '</script>'
        t, n = MAIN_RE.subn(lambda m: main(label, inner, mesh), tail); assert n == 1
        t, n = NAV_ACTIVE_RE.subn(NAV_INACTIVE, t); assert n == 1
        t, n = re.subn(r'data-page="contact"', f'data-page="{pid}"', t); assert n == 1
        shop_tag = f'<script defer src="/assets/shop.js" data-shop="{js}"></script>\n' if js else ''
        t = t.replace('<script defer src="/assets/site.js"', shop_tag + '<script defer src="/assets/site.js"', 1) if shop_tag else t
        h = head(title, desc, path[:-len('index.html')] if path.endswith('index.html') else path, noindex, canonical=(key != '404'))
        out[path] = h + t
    return out
