"""Compile Design's dc template (Esmee Peets Site.dc.html) into static per-page HTML.

The template markup, inline styles and data are taken verbatim from the .dc.html source;
only {{ }} bindings / sc-if / sc-for are resolved here. Runtime-toggled blocks are emitted
as <template data-if="key"> + live copy, driven by assets/site.js.

Usage (from the repo root):  python tools/build.py design-source .
Regenerates index.html, work/, about/, contact/ and assets/site.css. assets/site.js is hand-ported, not generated.
Intentional deviations from Design live here: the green curtain (CURTAIN) and the client-approved statement text (STATEMENT_RE).
"""
import ast, html, json, os, re, sys
from html.parser import HTMLParser

SRC = sys.argv[1]      # proto dir
OUT = sys.argv[2]      # output site dir
src = open(os.path.join(SRC, 'Esmee Peets Site.dc.html'), encoding='utf-8').read()

# ---------------- data (parsed from the dc script, not retyped) ----------------
script = re.search(r'<script type="text/x-dc"[^>]*>(.*?)</script>', src, re.S).group(1)

def js_lit(name):
    m = re.search(r'const ' + name + r' = (\[.*?\])(?:;|\.map)', script, re.S)
    body = m.group(1)
    body = re.sub(r'([{,]\s*)([A-Za-z_]\w*)\s*:', r"\1'\2':", body)
    return ast.literal_eval(body)

WORKS = js_lit('WORKS')
for w in WORKS:
    w['src'] = '/assets/img/' + w['id'] + '.jpg'
    w['meta'] = ' · '.join(x for x in [w.get('medium'), w.get('dims'), w.get('year')] if x)
    w['noteLine'] = ('With ' + w['collab']) if w.get('collab') else (w.get('note') or '')
    w['dimsLine'] = w.get('dims') or 'Dimensions to confirm'
    w['yearLine'] = w.get('year') or ''
BY = {w['id']: w for w in WORKS}
CATS = js_lit('CATS')
EXPERIENCE = js_lit('EXPERIENCE')
CREDS = js_lit('CREDS')
REASONS = js_lit('REASONS')
# Store: prices + availability are edited in design-source/store-data.json (Design's handoff data file):
#   "priceCAD": number or null ("Price on request"), "status": "available" | "reserved" | "sold".
STORE_DATA = {d['id']: d for d in json.load(open(os.path.join(SRC, 'store-data.json'), encoding='utf-8'))}
STATUS_LABEL = {'available': None, 'reserved': 'Reserved', 'sold': 'Sold'}
for d in STORE_DATA.values():
    assert d['id'] in {w['id'] for w in WORKS}, 'unknown artwork id in store-data.json: ' + d['id']
    assert d['status'] in STATUS_LABEL, 'bad status for %s: %r' % (d['id'], d['status'])
    assert d['priceCAD'] is None or isinstance(d['priceCAD'], (int, float)), 'bad priceCAD for ' + d['id']
PRICES = {k: d['priceCAD'] for k, d in STORE_DATA.items()}
STATUS = {k: d['status'] for k, d in STORE_DATA.items()}
STORE_CATS_ALL = ast.literal_eval(re.search(r'const cats = (\[\[.*?\]\])\.filter', script).group(1))
FOR_SALE = [w for w in WORKS if w['id'] in PRICES]
def price_label(n): return 'Price on request' if n is None else '$' + format(n, ',') + ' CAD'
def store_count(k): return len(FOR_SALE) if k == 'all' else sum(1 for w in FOR_SALE if w['cat'] == k)
STORE_CATS = [(k, l) for k, l in STORE_CATS_ALL if store_count(k)]

# ---------------- template tree ----------------
tpl = re.search(r'</helmet>(.*)</x-dc>', src, re.S).group(1)
# Sold / reserved state for store cards (not in Design's prototype; spec'd in the store handoff README).
_ADD_BTN = re.search(r'(<sc-if value="\{\{ w\.notInCart \}\}".*?</sc-if>)', tpl, re.S)
tpl = tpl.replace(_ADD_BTN.group(1), _ADD_BTN.group(1) + """
              <sc-if value="{{ w.unavailable }}">
                <button disabled="{{ true }}" style="margin-top:var(--space-md); align-self:flex-start; display:inline-flex; gap:.6rem; padding:.7rem 1.2rem; border-radius:var(--radius-pill); border:1px solid var(--line); background:transparent; color:var(--ink-faint); font-size:var(--fs-btn); letter-spacing:var(--tr-btn); text-transform:uppercase">{{ w.statusLabel }}</button>
              </sc-if>""", 1)
_ART = '<article data-reveal="1" style="display:flex; flex-direction:column">'
assert tpl.count(_ART) == 1
tpl = tpl.replace(_ART, '<article data-reveal="1" data-status="{{ w.status }}" style="display:flex; flex-direction:column">')
helmet_css = re.search(r'<helmet>.*?<style>(.*?)</style>', src, re.S).group(1)
VOID = {'br', 'img', 'input', 'meta', 'link', 'hr', 'source'}

class Node:
    def __init__(self, tag, attrs):
        self.tag, self.attrs, self.kids = tag, attrs, []

class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node('#root', []); self.stack = [self.root]
    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs); self.stack[-1].kids.append(n)
        if tag not in VOID: self.stack.append(n)
    def handle_startendtag(self, tag, attrs):
        self.stack[-1].kids.append(Node(tag, attrs))
    def handle_endtag(self, tag):
        if tag in VOID: return
        while self.stack[-1].tag != tag: self.stack.pop()
        self.stack.pop()
    def handle_data(self, d): self.stack[-1].kids.append(d)
    def handle_comment(self, d): pass

p = P(); p.feed(tpl); ROOT = p.root

# ---------------- binding values ----------------
class Nav:
    def __init__(self, page, f=None): self.page, self.f = page, f
    def href(self):
        base = {'home': '/', 'work': '/work/', 'store': '/store/', 'about': '/about/', 'contact': '/contact/'}[self.page]
        return base + ('#' + self.f if self.f else '')
class Act:
    def __init__(self, name, value=None): self.name, self.value = name, value
class Dyn:
    def __init__(self, key): self.key = key
class Bind:
    def __init__(self, path): self.path = path
class Raw:
    def __init__(self, s): self.s = s

HOVER = {}   # (kind, decls) -> class
def hover_class(kind, decls):
    k = (kind, decls)
    if k not in HOVER: HOVER[k] = 'scp' + format(len(HOVER), 'x')
    return HOVER[k]

def lookup(ctx, expr):
    expr = expr.strip()
    if expr.startswith('{{'): expr = expr[2:-2].strip()
    if expr == 'true': return True
    parts = expr.split('.')
    for scope in reversed(ctx):
        if parts[0] in scope:
            v = scope[parts[0]]
            for q in parts[1:]:
                v = v.path + '.' + q if isinstance(v, Bind) else v[q]
            return Bind(v) if isinstance(v, str) and isinstance(scope[parts[0]], Bind) else v
    raise KeyError(expr)

EXPR = re.compile(r'\{\{(.*?)\}\}')
esc_t = lambda s: html.escape(s, quote=False)
esc_a = lambda s: html.escape(s, quote=True)

def render_attrs(node, ctx):
    out, classes = [], []
    for k, v in node.attrs:
        if k.startswith('hint-'): continue
        m = EXPR.fullmatch(v.strip()) if v else None
        val = lookup(ctx, m.group(1)) if m else v
        if k == 'ref':
            out.append(('data-ref', val.name)); continue
        if k in ('onclick', 'onsubmit'):
            if isinstance(val, Nav):
                out = [(a, b) for a, b in out if a != 'href']
                out.append(('href', val.href())); out.append(('data-go', val.page))
                if val.f: out.append(('data-filter', val.f))
            elif isinstance(val, Act):
                out.append(('data-action', val.name))
                if val.value is not None: out.append(('data-value', val.value))
            continue
        if k == 'href' and any(a == 'href' for a, _ in out): continue
        if k in ('style-hover', 'style-focus'):
            classes.append(hover_class('hover' if k == 'style-hover' else 'focus', v)); continue
        if val is True: out.append((k, None)); continue
        if isinstance(val, Bind): out.append(('data-bind-' + k, val.path)); continue
        out.append((k, val))
    if classes: out.insert(0, ('class', ' '.join(classes)))
    # Nav anchors: href replaced even if it came before onClick
    return ''.join(' ' + a if b is None else ' %s="%s"' % (a, esc_a(str(b))) for a, b in out)

def render(nodes, ctx):
    s = ''
    for n in nodes:
        if isinstance(n, str):
            def sub(m):
                v = lookup(ctx, m.group(1))
                if isinstance(v, Raw): return v.s
                if isinstance(v, Bind): return '<span class="sc-interp" data-bind="%s"></span>' % v.path
                return '<span class="sc-interp">%s</span>' % esc_t(str(v))
            parts = EXPR.split(n)
            for i, part in enumerate(parts):
                s += esc_t(part) if i % 2 == 0 else sub(re.match(r'(.*)', part))
            continue
        if n.tag == 'sc-if':
            cond = lookup(ctx, dict(n.attrs)['value'])
            if isinstance(cond, Dyn): s += dyn_block(cond.key, n.kids, ctx)
            elif cond: s += render(n.kids, ctx)
            continue
        if n.tag == 'sc-for':
            a = dict(n.attrs)
            for item in lookup(ctx, a['list']):
                if isinstance(item, dict) and '__if' in item:
                    s += dyn_block(item['__if'], n.kids, ctx + [{a['as']: item}])
                else:
                    s += render(n.kids, ctx + [{a['as']: item}])
            continue
        s += '<%s%s>' % (n.tag, render_attrs(n, ctx))
        if n.tag not in VOID: s += render(n.kids, ctx) + '</%s>' % n.tag
    return s

def dyn_block(key, kids, ctx):
    body = render(kids, ctx).strip()
    live = ctx[0]['__initial'](key)
    out = '<template data-if="%s">%s</template>' % (esc_a(key), body)
    if live:
        out += re.sub(r'^<([a-z0-9-]+)', lambda m: '<%s data-if-live="%s"' % (m.group(1), esc_a(key)), body, count=1)
    return out

# ---------------- React-built pieces, copied from the rendered export DOM ----------------
MESH = ('<div style="position: absolute; inset: 0px; overflow: hidden; pointer-events: none;">'
 '<div style="position: absolute; inset: -15%; background: var(--grad-sig-1),var(--grad-sig-2),var(--grad-sig-3),var(--grad-sig-4); filter: blur(30px); animation: ep-mesh-drift var(--dur-mesh) ease-in-out infinite alternate;"></div>'
 '<div style="position: absolute; inset: -15%; background: var(--grad-sig-1),var(--grad-sig-2),var(--grad-sig-3),var(--grad-sig-4); opacity: 0.5; transform: rotate(180deg); filter: blur(40px); animation: ep-mesh-drift calc(var(--dur-mesh) * 1.4) ease-in-out infinite alternate-reverse;"></div>'
 '<div style="position: absolute; inset: 0px; background: linear-gradient(to bottom, rgba(20,15,28,.1), rgba(20,15,28,.2) 60%, var(--bg));"></div></div>')
MARQUEE = ('<div style="display: flex; width: max-content; white-space: nowrap; font-family: var(--serif); font-style: italic; font-size: var(--fs-marquee); color: var(--ink-dim); animation: ep-marquee calc(var(--dur-marquee) * 1.4) linear infinite;">'
 + ''.join('<span style="display: inline-flex; align-items: center; gap: 2.4rem; padding-right: 2.4rem;">%s<span style="width: 6px; height: 6px; border-radius: 50%%; background: var(--gold); display: inline-block;"></span></span>' % esc_t(c) for c in CREDS + CREDS)
 + '</div>')
# Curtain: Design's structure/timing; panels recoloured to one continuous dark→light→dark green sweep (client ask).
# Panels overlap by 1px: quarter-width edges land on fractional pixels and anti-aliasing leaves hairline seams.
CURTAIN = ('<div data-curtain style="position: fixed; inset: 0px; z-index: var(--z-curtain); pointer-events: none; display: flex;">'
 + ''.join('<span style="flex: 1 1 0%%; %sbackground: linear-gradient(to right, #0e2618, #6fcf8f, #0e2618) %s 0 / 400%% 100%%; transform: scaleY(0); transform-origin: center bottom; transition: none;"></span>'
           % ('margin-right: -1px; ' if i < 3 else '', pos)
           for i, pos in enumerate(('0%', '33.333%', '66.667%', '100%')))
 + '</div>')

# ---------------- per-page context ----------------
def pad(n): return '%02d' % n
def count(k): return len(WORKS) if k == 'all' else sum(1 for w in WORKS if w['cat'] == k)
def with_open(w): return dict(w, open=Act('open', w['id']))

class Ref:
    def __init__(self, name): self.name = name

def context(page):
    initial = {'notsent': True, 'sent': False, 'lb': False}
    for k, _ in CATS: initial['cat:' + k] = (k == 'all'); initial['cat-off:' + k] = (k != 'all')
    for r in REASONS: initial['reason:' + r] = (r == 'Drawing lessons'); initial['reason-off:' + r] = (r != 'Drawing lessons')
    for w in WORKS: initial['work:' + w['id']] = True
    for k, _ in STORE_CATS: initial['scat:' + k] = (k == 'all'); initial['scat-off:' + k] = (k != 'all')
    for w in FOR_SALE: initial['sitem:' + w['id']] = True; initial['cart:' + w['id']] = False; initial['cart-off:' + w['id']] = STATUS[w['id']] == 'available'
    initial['cartbar'] = False
    return {
        '__initial': lambda k: initial[k],
        'rootRef': Ref('root'), 'stripRef': Ref('strip'), 'collageRef': Ref('collage'), 'videoRef': Ref('video'),
        'isHome': page == 'home', 'isWork': page == 'work', 'isAbout': page == 'about', 'isContact': page == 'contact', 'isStore': page == 'store', 'notContact': page != 'contact',
        'goHome': Nav('home'), 'goWork': Nav('work'), 'goAbout': Nav('about'), 'goContact': Nav('contact'),
        'navLinks': [{'label': l, 'href': '#' + k, 'go': Nav(k), 'current': page == k, 'other': page != k} for k, l in [('work', 'Work'), ('store', 'Store'), ('about', 'About'), ('contact', 'Contact')]],
        'cFlux': with_open(BY['flux']), 'cEtreinte': with_open(BY['etreinte']), 'cJecoute': with_open(BY['jecoute']),
        'stripWorks': [with_open(BY[i]) for i in ['flux', 'regard-brouille', 'brumeuse', 'resonance', 'still-life', 'pigeon', 'gloutonne', 'inspiration']],
        'stripPrev': Act('stripPrev'), 'stripNext': Act('stripNext'),
        'tiles': [{'label': l, 'count': pad(count(k)), 'src': BY[i]['src'], 'go': Nav('work', k)} for k, l, i in [('painting', 'Painting', 'etreinte'), ('drawing', 'Drawing', 'pigeon'), ('collab', 'Collaborations', 'smokin-cocotte')]],
        'cats': [{'label': l, 'count': count(k), 'active': Dyn('cat:' + k), 'inactive': Dyn('cat-off:' + k), 'select': Act('filter', k)} for k, l in CATS],
        'filtered': [dict(with_open(w), __if='work:' + w['id']) for w in WORKS],
        'experience': EXPERIENCE,
        'storeCats': [{'label': l, 'count': store_count(k), 'active': Dyn('scat:' + k), 'inactive': Dyn('scat-off:' + k), 'select': Act('storeFilter', k)} for k, l in STORE_CATS],
        'storeItems': [dict(with_open(w), status=STATUS[w['id']],
                            priceLabel=STATUS_LABEL[STATUS[w['id']]] or price_label(PRICES[w['id']]),
                            inCart=Dyn('cart:' + w['id']) if STATUS[w['id']] == 'available' else False,
                            notInCart=Dyn('cart-off:' + w['id']) if STATUS[w['id']] == 'available' else False,
                            unavailable=STATUS[w['id']] != 'available', statusLabel=STATUS_LABEL[STATUS[w['id']]] or '',
                            toggle=Act('toggle', w['id']), __if='sitem:' + w['id']) for w in FOR_SALE],
        'cartOpen': Dyn('cartbar'), 'cartSummary': Bind('cartSummary'), 'cartTitles': Bind('cartTitles'), 'cartMailto': Bind('cartMailto'),
        'clearCart': Act('clearCart'),
        'aboutPair': [with_open(BY[i]) for i in ['regard-brouille', 'pigeon']],
        'reasons': [{'label': r, 'active': Dyn('reason:' + r), 'inactive': Dyn('reason-off:' + r), 'select': Act('reason', r)} for r in REASONS],
        'notSent': Dyn('notsent'), 'sent': Dyn('sent'),
        'submit': Act('submit'), 'resetForm': Act('resetForm'),
        'lbOpen': Dyn('lb'), 'lb': Bind('lb'), 'lbCounter': Bind('lbCounter'),
        'closeLb': Act('closeLb'), 'stop': Act('stop'), 'lbPrev': Act('lbPrev'), 'lbNext': Act('lbNext'),
        'showGrain': True,
        'meshEl': Raw(MESH), 'marqueeEl': Raw(MARQUEE), 'curtainEl': Raw(CURTAIN), 'cursorEl': Raw(''),
    }

# The grain layer: Design's runtime truncates its data-URI at the first ';' (inline-style parse),
# so the export renders no grain. Reproduce that exact effective output.
def fix_grain(s):
    s, n = re.subn(r'; background-image:url\(&quot;data:image/svg\+xml;utf8,.*?&quot;\)"', '"', s, flags=re.S)
    assert n == 1, n
    return s

# Client-approved statement text (replaces Design's original line; see STATEMENT_RE above).
STATEMENT_RE = re.compile(r'(font-size:var\(--fs-statement\)[^>]*>).*?(</p>)', re.S)

# Home-only footer CTA: client wants a neutral sign-off on the homepage specifically,
# not the services-list version Design uses on about/work/store. No language mention,
# no "workshops", "collaborations" -> "commissions", no em dash.
HOME_FOOTER_RE = re.compile(
    r'Drawing lessons, workshops and collaborations, '
    r'<em style="color:var\(--rose-dust\)">in English or French\.</em>'
)
HOME_FOOTER_TEXT = ('Drawing lessons, commissions or questions? '
                     '<em style="color:var(--rose-dust)">Get in contact with me.</em>')

# Real portrait photo, cropped/centered by the client (replaces Design's placeholder box).
PORTRAIT_RE = re.compile(
    r'<div data-reveal="1" style="position:relative; aspect-ratio:var\(--ratio-portrait\); '
    r'background:var\(--ph-portrait\); max-width:460px">\s*'
    r'<span[^>]*>Placeholder: portrait of Esmée</span>\s*</div>'
)
PORTRAIT_IMG = (
    '<div data-reveal="1" style="position:relative; max-width:460px">'
    '<img src="/assets/img/esmee-portrait.jpg" alt="Portrait of Esmée Peets" '
    'style="width:100%; height:auto; display:block; border-radius:6px"></div>'
)

META = {
    'home': ('Esmée Peets · Artist', ''),
    'work': ('Work · Esmée Peets', 'work/'),
    'about': ('About · Esmée Peets', 'about/'),
    'contact': ('Contact · Esmée Peets', 'contact/'),
    'store': ('Store · Esmée Peets', 'store/'),
}
DESC = ('Esmée Peets is a visual artist in Ottawa/Montréal working in painting, graphite drawing, '
        'and collaborative wearable sculpture. Studying Art History and Studio Arts at Concordia University.')

def page_html(page):
    body = render(ROOT.kids, [context(page)]).strip()
    body = fix_grain(body)
    body = body.replace('uploads/esmee-peets-complete-package/artwork/asthenie-process.mp4', '/assets/asthenie-process.mp4')
    body = body.replace('src="uploads/esmee-peets-complete-package/artwork/', 'src="/assets/img/')
    assert 'uploads/' not in body
    if page == 'home':
        body, n = STATEMENT_RE.subn(r'\1Paintings built in bold colour, drawings built in fine graphite detail.\2', body); assert n == 1
    if page == 'about':
        body, n = PORTRAIT_RE.subn(PORTRAIT_IMG, body); assert n == 1
    if page == 'home':
        body, n = HOME_FOOTER_RE.subn(HOME_FOOTER_TEXT, body); assert n == 1
    title, _ = META[page]
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{esc_a(DESC)}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32">
<link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/Fraunces-normal-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/Inter-normal-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
<script>try{{if(sessionStorage.getItem('ep-curtain'))document.documentElement.classList.add('ep-arrive')}}catch(e){{}}</script>
<script defer src="/assets/site.js" data-page="{page}"></script>
<script defer src="/_vercel/insights/script.js"></script>
</head>
<body>
<div id="dc-root"><div class="sc-host">{body}</div></div>
<script id="ep-data" type="application/json">{DATA}</script>
</body>
</html>
'''

# ---------------- stylesheet ----------------
def css():
    t = lambda f: open(os.path.join(SRC, 'tokens', f), encoding='utf-8').read().strip()
    fonts = t('fonts.css').replace("url('../fonts/", "url('/assets/fonts/")
    hovers = '\n'.join('.%s:%s{%s}' % (c, kind, ';'.join(d.strip() + ' !important' for d in decls.split(';') if d.strip()))
                       for (kind, decls), c in HOVER.items())
    return '\n'.join([
        '/* Generated by build.py from Claude Design\'s export — tokens copied verbatim from tokens/*.css */',
        fonts, t('colors.css'), t('typography.css'), t('spacing.css'), t('motion.css'),
        '/* page styles (dc <helmet>) */' + helmet_css.rstrip(),
        '/* dc runtime rules */',
        'html,body{height:100%;margin:0}#dc-root,#dc-root>.sc-host{height:100%}',
        '@media print{@page{margin:.5cm}figure,table{break-inside:avoid}#dc-root,#dc-root>.sc-host{height:auto}'
        '*,::before,::after{print-color-adjust:exact;backdrop-filter:none!important;animation-delay:-99s!important;animation-duration:.001s!important;animation-iteration-count:1!important;animation-fill-mode:both!important;animation-play-state:running!important;transition-duration:0s!important}}',
        hovers,
        '/* store: sold / reserved cards (handoff spec) — muted status label; sold artwork at 60% */',
        'article[data-status="sold"] img{opacity:.6}',
        'article[data-status="sold"]>div:nth-child(2)>div:last-child,article[data-status="reserved"]>div:nth-child(2)>div:last-child{color:var(--ink-faint)!important}',
        '/* narrow phones: 4 nav links + wordmark on one row; nav wraps below rather than overflowing */',
        '@media (max-width:520px){header{flex-wrap:wrap!important;row-gap:.5rem!important;column-gap:.75rem!important}'
        'header>a{white-space:nowrap;font-size:1.1rem!important}header>nav{gap:.7rem!important;font-size:.7rem!important;letter-spacing:.04em!important}}',
        '/* arriving from an internal link: curtain starts closed (no flash before site.js runs) */',
        'html.ep-arrive [data-curtain]>span{transform:scaleY(1)!important}',
        '',
    ])

DATA = json.dumps({'works': [{k: w[k] for k in ('id', 'title', 'cat', 'src', 'medium', 'meta', 'dimsLine', 'yearLine', 'noteLine')} for w in WORKS],
                   'prices': {w['id']: PRICES[w['id']] for w in FOR_SALE}, 'status': {w['id']: STATUS[w['id']] for w in FOR_SALE}, 'storeCats': [k for k, _ in STORE_CATS],
                   'cats': [k for k, _ in CATS], 'reasons': REASONS}, ensure_ascii=False, separators=(',', ':'))
pages = {pg: page_html(pg) for pg in META}
for pg, h in pages.items():
    d = os.path.join(OUT, META[pg][1]); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, 'index.html'), 'w', encoding='utf-8', newline='\n').write(h)
open(os.path.join(OUT, 'assets', 'site.css'), 'w', encoding='utf-8', newline='\n').write(css())
_unused = ({'works': [{k: w[k] for k in ('id', 'title', 'cat', 'src', 'medium', 'dimsLine', 'yearLine', 'noteLine')} for w in WORKS],
           'cats': [k for k, _ in CATS], 'reasons': REASONS},
          )
print('hover classes:', {c: k for k, c in HOVER.items()})
