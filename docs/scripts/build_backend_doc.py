#!/usr/bin/env python3
"""Generate docs/BACKEND_REFERENCE.html — the complete, self-contained backend reference.

Source of truth: the Python data modules in docs/scripts/data/ (which mirror the
Express code) and docs/openapi.yaml. Run:

    python3 docs/scripts/build_backend_doc.py

The output is ONE file with inline CSS and, when available, an inlined Mermaid
UMD bundle so the diagrams render with no network access. Mermaid is looked up
in the usual temp install location; if it is missing the page degrades to a
readable source view and prints a warning.
"""

from __future__ import annotations

import html
import json
import os
import sys
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(HERE, 'data'))

from api_auth_booth import AUTH, BOOTH                     # noqa: E402
from api_money_media import (PAYMENTS, DOWNLOADS, SHARE, SETTINGS, SUPPORT,  # noqa: E402
                             EVENTS_PUBLIC, DEVICES, COUPONS)
from api_org import ORG                                    # noqa: E402
from api_platform import PLATFORM                          # noqa: E402
from api_server import SERVER_ROUTES                       # noqa: E402
from models_data import MODELS                             # noqa: E402
from middleware_data import (SERVER_CHAIN, AUTH_MIDDLEWARE, PERMISSION_MATRIX,  # noqa: E402
                             LIMITERS)
from utils_services import UTILS, SERVICES                 # noqa: E402
from flows_data import (FLOWS, REQUEST_LIFECYCLE, DEPENDENCY_MAP,  # noqa: E402
                        AUTH_MATRIX, ENV_VARS, ERRORS)

MERMAID_CANDIDATES = [
    '/tmp/mm/node_modules/mermaid/dist/mermaid.min.js',
    os.path.join(ROOT, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js'),
    os.path.join(ROOT, 'docs', 'diagrams', 'vendor', 'mermaid.min.js'),
]

ROUTERS = [
    AUTH, ORG, PLATFORM, BOOTH, PAYMENTS, EVENTS_PUBLIC, DEVICES,
    COUPONS, SETTINGS, SUPPORT, SHARE, DOWNLOADS,
]

# Shared with build_diagrams.py: colours the connecting lines of every diagram.
EDGE_COLORS_JS = os.path.join(HERE, 'edge_colors.js')
EDGE_KEY = '<div class="edge-key" data-edge-key></div>'

METHOD_SLUG = {'GET': 'get', 'POST': 'post', 'PUT': 'put', 'DELETE': 'delete', 'ALL': 'all'}


def e(value) -> str:
    """HTML-escape anything, including None."""
    if value is None:
        return ''
    return html.escape(str(value), quote=True)


def read_edge_colors() -> str:
    """The shared Mermaid connector palette, inlined so the page needs no network."""
    if os.path.exists(EDGE_COLORS_JS):
        with open(EDGE_COLORS_JS, encoding='utf-8') as fh:
            return fh.read()
    print('warning: docs/scripts/edge_colors.js missing — connectors will be uncoloured', file=sys.stderr)
    return ''


def chip(method: str) -> str:
    m = (method or '').upper()
    return f'<span class="m m-{METHOD_SLUG.get(m, "get")}">{e(m)}</span>'


def table(headers, rows, cls=''):
    if not rows:
        return '<p class="empty">None.</p>'
    head = ''.join(f'<th>{e(h)}</th>' for h in headers)
    body = []
    for row in rows:
        cells = ''.join(f'<td>{c if isinstance(c, Safe) else e(c)}</td>' for c in row)
        body.append(f'<tr>{cells}</tr>')
    return (f'<div class="tw"><table class="{cls}"><thead><tr>{head}</tr></thead>'
            f'<tbody>{"".join(body)}</tbody></table></div>')


class Safe(str):
    """Marker for pre-rendered HTML cells."""


# ── endpoint rendering ──────────────────────────────────────────────────────

def endpoint_card(ep, prefix) -> str:
    anchor = f"{prefix}-{ep['method'].lower()}-{ep['path'].replace('/', '-').strip('-').replace(':', '')}"
    search = ' '.join([ep['method'], ep['path'], ep['summary'],
                       ep.get('perm') or '', ep.get('auth') or '']).lower()

    meta = [f'<span class="kv"><b>Auth</b> {e(ep["auth"])}</span>']
    if ep.get('perm'):
        meta.append(f'<span class="kv"><b>Permission</b> <code>{e(ep["perm"])}</code></span>')
    if ep.get('rl'):
        meta.append(f'<span class="kv"><b>Limit</b> {e(ep["rl"])}</span>')

    inner = [f'<div class="meta-row">{"".join(meta)}</div>']
    inner.append(f'<p class="ep-summary">{e(ep["summary"])}</p>')

    if ep['body']:
        inner.append('<h6>Request body</h6>')
        inner.append(table(['Field', 'Type', 'Notes'],
                           [(Safe(f'<code>{e(f)}</code>'), t, d) for f, t, d in ep['body']]))
    if ep['query']:
        inner.append('<h6>Query / path parameters</h6>')
        inner.append(table(['Parameter', 'Type', 'Notes'],
                           [(Safe(f'<code>{e(f)}</code>'), t, d) for f, t, d in ep['query']]))
    if ep['res']:
        inner.append('<h6>Response</h6>')
        inner.append(table(['Field', 'Type', 'Notes'],
                           [(Safe(f'<code>{e(f)}</code>'), t, d) for f, t, d in ep['res']]))
    if ep['errors']:
        inner.append('<h6>Errors</h6>')
        inner.append('<ul class="errs">' + ''.join(
            f'<li><code>{e(code)}</code> — {e(when)}</li>' for code, when in ep['errors']) + '</ul>')
    if ep['uses']:
        inner.append('<h6>Connects to</h6>')
        inner.append('<div class="uses">' + ''.join(f'<span class="tag">{e(u)}</span>' for u in ep['uses']) + '</div>')
    if ep.get('side'):
        inner.append(f'<h6>Side effects</h6><p class="side">{e(ep["side"])}</p>')
    if ep.get('note'):
        inner.append(f'<h6>Note</h6><p class="side">{e(ep["note"])}</p>')

    return f'''
<details class="ep" id="{e(anchor)}" data-search="{e(search)}">
  <summary>{chip(ep['method'])}<code class="path">{e(ep['path'])}</code><span class="sum">{e(ep['summary'])}</span></summary>
  <div class="ep-body">{''.join(inner)}</div>
</details>'''


def router_section(r, index: int) -> str:
    prefix = f"r{index}"
    anchor = prefix
    eps = r['endpoints']
    rows = [(Safe(chip(x['method'])), Safe(f'<code>{e(x["path"])}</code>'),
             x['summary'], x.get('perm') or '—') for x in eps]
    notes = ''.join(f'<p>{e(n)}</p>' for n in r['notes'])
    cards = ''.join(endpoint_card(x, prefix) for x in eps)
    return f'''
<section class="router" id="{anchor}">
  <div class="router-head">
    <div>
      <h3><code>{e(r['base'])}</code> <span class="rname">{e(r['name'])}</span></h3>
      <p class="muted small">{e(r['module'])} · {len(eps)} endpoint{'s' if len(eps) != 1 else ''}</p>
    </div>
  </div>
  <p class="router-summary">{e(r['summary'])}</p>
  <div class="authbar"><b>Auth posture</b><span>{e(r['auth'])}</span></div>
  {table(['Method', 'Path', 'Purpose', 'Permission'], rows, 'in')}
  <div class="cards">{cards}</div>
  {f'<div class="notes">{notes}</div>' if notes else ''}
</section>'''


# ── other sections ──────────────────────────────────────────────────────────

def mw_table(rows):
    return table(['#', 'Layer', 'Where', 'Kind', 'What it does', 'Rejects with'],
                 [(str(m['order']) if m.get('order') else '', Safe(f'<b>{e(m["name"])}</b>'),
                   Safe(f'<code>{e(m["file"])}</code>'), m['kind'], m['behaviour'],
                   Safe(', '.join(f'<code>{e(c)}</code> {e(t)}' for c, t in m['rejects'])) if m['rejects'] else '—')
                  for m in rows], 'mw')


def model_card(m) -> str:
    fields = [(Safe(f'<code>{e(f)}</code>'), t, n) for f, t, n in m['fields']]
    extra = []
    if m['indexes']:
        extra.append('<h6>Indexes</h6><div class="uses">' +
                     ''.join(f'<span class="tag monoi">{e(i)}</span>' for i in m['indexes']) + '</div>')
    if m['ttl']:
        extra.append(f'<h6>TTL</h6><p class="side">{e(m["ttl"])}</p>')
    if m['flags']:
        extra.append('<h6>Why it looks like this</h6><ul class="flags">' +
                     ''.join(f'<li>{e(f)}</li>' for f in m['flags']) + '</ul>')
    return f'''
<details class="model" data-search="{e(' '.join([m['name'], m['file'], m['purpose']] + [f for f, _, _ in m['fields']]).lower())}">
  <summary><code>{e(m['name'])}</code><span class="sum">{e(m['purpose'])}</span></summary>
  <div class="ep-body">
    <p class="muted small"><code>{e(m['file'])}</code> · {len(m['fields'])} declared fields</p>
    {table(['Field', 'Type', 'Notes'], fields)}
    {''.join(extra)}
  </div>
</details>'''


def flow_block(f) -> str:
    steps = ''.join(
        f'<li><span class="who">{e(who)}</span><span class="what">{e(action)}</span>'
        f'<span class="res">{e(result)}</span></li>' for who, action, result in f['steps'])
    return f'''
<article class="card flow" id="{e(f['id'])}" data-search="{e((f['title'] + ' ' + f['summary']).lower())}">
  <h3>{e(f['title'])}</h3>
  <p class="notes">{e(f['summary'])}</p>
  <div class="canvas" data-diagram="{e(f['id'])}"><span class="loading">Rendering diagram…</span></div>
  <ol class="steps">{steps}</ol>
</article>'''


# ── page assembly ───────────────────────────────────────────────────────────

def count_endpoints():
    return sum(len(r['endpoints']) for r in ROUTERS) + len(SERVER_ROUTES)


def build():
    mermaid_js = None
    mermaid_path = None
    for path in MERMAID_CANDIDATES:
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as fh:
                mermaid_js = fh.read()
            mermaid_path = path
            break

    total_eps = count_endpoints()
    total_diagrams = len(FLOWS) + 4

    diagrams = {}
    for f in FLOWS:
        diagrams[f['id']] = f['diagram']
    diagrams['request-lifecycle'] = REQUEST_LIFECYCLE
    diagrams['dependency-map'] = DEPENDENCY_MAP
    diagrams['auth-matrix'] = AUTH_MATRIX

    # nav
    nav_api = ''.join(
        f'<a href="#r{i}" data-nav><span class="idx">r{i}</span>{e(r["name"])}</a>'
        for i, r in enumerate(ROUTERS))
    nav_flows = ''.join(
        f'<a href="#{e(f["id"])}" data-nav>{e(f["title"].split("—")[0].strip())}</a>' for f in FLOWS)

    css = CSS
    body = []

    body.append(f'''
<header class="hero" id="top">
  <div class="eyebrow">HappyPix · backend reference</div>
  <h1>The complete backend, in one file</h1>
  <p class="lede">Every endpoint with its inputs, outputs, purpose and connections. Every middleware layer, every
  utility, every service, the 25 data models, the environment contract, the error catalogue, and the flows that tie
  them together — from a guest walking up to a booth to money arriving in an organisation's account.</p>
  <div class="meta">
    <span class="pill"><b>{total_eps}</b> endpoints</span>
    <span class="pill"><b>{len(ROUTERS) + 1}</b> routers mounted</span>
    <span class="pill"><b>{len(MODELS)}</b> models</span>
    <span class="pill"><b>{len(SERVER_CHAIN) + len(AUTH_MIDDLEWARE)}</b> middleware layers</span>
    <span class="pill"><b>{len(UTILS)}</b> utils · <b>{len(SERVICES)}</b> services</span>
    <span class="pill"><b>{len(FLOWS)}</b> flows · <b>{total_diagrams}</b> diagrams</span>
    <span class="pill">generated {date.today().isoformat()}</span>
  </div>
  <div class="how">
    <p><b>Where this comes from.</b> The reference is generated by <code>docs/scripts/build_backend_doc.py</code>
    from <code>docs/scripts/data/*.py</code>, which transcribe <code>backend/server.js</code>, the 12 route files,
    <code>backend/middleware/*</code>, <code>backend/utils/*</code>, <code>backend/services/*</code> and
    <code>backend/models/*</code>. Regenerate after changing any of them; never edit the HTML by hand.</p>
    <p><b>How to read an endpoint.</b> Each row opens a card with the request shape, the response shape, the error
    codes it can return, and the collections, services, utils or externals it touches. <em>Auth</em> says who may
    call it; <em>Permission</em> is the exact key checked (values match <code>config/permissions.js</code> literally);
    <em>Limit</em> is the per-IP rate limit.</p>
    <p><b>On response fields.</b> Lists name the keys the handler actually returns, including compatibility aliases
    where one exists (for example the revenue endpoint returns both <code>monthSplit</code> and
    <code>monthWise</code>). Where the code and this page ever disagree, the code wins — and
    <code>docs/openapi.yaml</code> is the machine-readable cross-check a client should generate from.</p>
  </div>
</header>''')

    # 1 — system at a glance
    body.append(f'''
<section class="doc" id="glance">
  <h2>1 · System at a glance</h2>
  <p class="lede">One Express application (plus a small second one for the marketing site's landing APIs) serves five
  clients: the CRM, the platform console, the booth app on Windows/macOS, the Android client, and the public pages.
  Everything is multi-tenant: an <code>organizationId</code> travels from the token into almost every query.</p>
  {EDGE_KEY}

  <div class="grid4">
    <div class="stat"><b>{total_eps}</b><span>endpoints across {len(ROUTERS) + 1} mounts</span></div>
    <div class="stat"><b>{len(MODELS)}</b><span>Mongoose models, 3 TTL-bound</span></div>
    <div class="stat"><b>2</b><span>auth systems: JWT for humans, SHA-256 hashed tokens for booths</span></div>
    <div class="stat"><b>{len(PERMISSION_MATRIX['roles'])}</b><span>auth roles, {len(PERMISSION_MATRIX['keys'])} permission keys</span></div>
  </div>

  <h3 class="h3">1.1 The request lifecycle</h3>
  <p class="muted">This is the literal order in <code>server.js</code>. Note that origin rejection happens before body
  parsing, and that the Mongo readiness gate sits in front of every API route so a cold serverless invocation never
  runs a query against a buffered connection.</p>
  <div class="canvas" data-diagram="request-lifecycle"><span class="loading">Rendering diagram…</span></div>

  <h3 class="h3">1.2 Who talks to whom</h3>
  <p class="muted">Routers call services, services own the rules, utils talk to the outside world, models own the
  schema. No router imports another router (the only cross-import is a helper function used by the legacy device
  routes).</p>
  <div class="canvas" data-diagram="dependency-map"><span class="loading">Rendering diagram…</span></div>

  <h3 class="h3">1.3 The mounting table</h3>
  {table(['Order', 'Mount', 'Router file', 'Guarded by'], [
      (str(i + 1), Safe(f'<code>{e(r["base"])}</code>'), Safe(f'<code>{e(r["module"])}</code>'), r['auth'].split('.')[0])
      for i, r in enumerate(ROUTERS)] + [
      ('13', Safe('<code>POST /api/leads</code>'), Safe('<code>server.js</code>'), 'public, 60 / 15 min'),
      ('14', Safe('<code>GET /api/proxy/logo</code>'), Safe('<code>server.js</code>'), 'JWT'),
      ('15', Safe('<code>POST /api/upload/logo</code>'), Safe('<code>server.js</code>'), 'JWT + multer'),
      ('16', Safe('<code>POST /api/upload/profile-photo</code>'), Safe('<code>server.js</code>'), 'JWT + multer'),
      ('17', Safe('<code>POST /api/upload</code>'), Safe('<code>server.js</code>'), 'device OR JWT + multer'),
      ('18', Safe('<code>GET /uploads/*</code>'), Safe('<code>server.js</code>'), 'public static'),
      ('19', Safe('<code>ALL /api/cron/check-expirations</code>'), Safe('<code>server.js</code>'), 'shared secret, fail-closed'),
      ('—', Safe('<code>routes/authRoutes.js</code>, <code>routes/usageAccessRoutes.js</code>'), 'on disk, never mounted', 'not reachable'),
  ])}
</section>''')

    # 2 — middleware
    body.append(f'''
<section class="doc" id="middleware">
  <h2>2 · Middleware and security</h2>
  <p class="lede">Two files hold the interesting parts: <code>server.js</code> builds the global chain, and
  <code>middleware/auth.js</code> + <code>middleware/deviceAuth.js</code> hold the two authentication systems. Everything
  else is a per-route permission key.</p>
  {EDGE_KEY}

  <h3 class="h3">2.1 The global chain, in order</h3>
  {mw_table(SERVER_CHAIN)}

  <h3 class="h3">2.2 Human and booth authentication</h3>
  {mw_table(AUTH_MIDDLEWARE)}

  <h3 class="h3">2.3 Which credential opens which door</h3>
  <div class="canvas" data-diagram="auth-matrix"><span class="loading">Rendering diagram…</span></div>

  <h3 class="h3">2.4 Roles and permission keys</h3>
  <div class="grid2">
    <div class="panel">
      <h4>Five roles</h4>
      {table(['Role', 'Scope'], [(Safe(f'<code>{e(r)}</code>'), d) for r, d in PERMISSION_MATRIX['roles']])}
    </div>
    <div class="panel">
      <h4>Permission keys</h4>
      {table(['Key', 'Grants', 'Held by'],
             [(Safe(f'<code>{e(k)}</code>'), d, h) for k, d, h in PERMISSION_MATRIX['keys']])}
    </div>
  </div>
  <div class="notes">{''.join(f'<p>{e(n)}</p>' for n in PERMISSION_MATRIX['notes'])}</div>

  <h3 class="h3">2.5 Rate limits</h3>
  {table(['Limiter', 'Budget', 'Defined in', 'Protects against'],
         [(Safe(f'<b>{e(n)}</b>'), b, Safe(f'<code>{e(f)}</code>'), w) for n, b, f, w in LIMITERS])}
</section>''')

    # 3 — API
    api_sections = ''.join(router_section(r, i) for i, r in enumerate(ROUTERS))
    server_rows = [(Safe(chip(x['method'])), Safe(f'<code>{e(x["path"])}</code>'), x['summary'], x.get('perm') or '—')
                   for x in SERVER_ROUTES]
    server_cards = ''.join(endpoint_card(x, 'rs') for x in SERVER_ROUTES)
    body.append(f'''
<section class="doc" id="api">
  <h2>3 · API reference</h2>
  <p class="lede">{total_eps} endpoints, grouped by the router that owns them, in the order they are mounted. The
  booths call <code>/api/booth</code>; humans call <code>/api/auth</code>, then <code>/api/org</code> or
  <code>/api/platform</code>; guests only ever see the public download and share pages.</p>
  <div class="toolbar">
    <input id="epSearch" class="search" placeholder="Filter endpoints by path, method, summary or permission…" />
    <button id="expandAll" class="btn">Expand all</button>
    <button id="collapseAll" class="btn">Collapse all</button>
    <span id="epCount" class="muted small"></span>
  </div>
  {api_sections}
</section>''')

    # 3b — server-level endpoints folded into the API section end
    body.append(f'''
<section class="doc" id="server-routes">
  <h2>3.13 · Endpoints declared in <code>server.js</code></h2>
  <p class="lede">These bypass a router file because they are either infrastructure (cron), one-off integrations
  (uploads, logo proxy), or shared with the marketing backend (leads).</p>
  {table(['Method', 'Path', 'Purpose', 'Permission'], server_rows, 'in')}
  <div class="cards">{server_cards}</div>
</section>''')

    # 4 — models
    model_cards = ''.join(model_card(m) for m in MODELS)
    body.append(f'''
<section class="doc" id="models">
  <h2>4 · Data model</h2>
  <p class="lede">{len(MODELS)} Mongoose models. Every tenant-scoped document carries <code>organizationId</code>;
  three documents are TTL-bound (guest downloads, shares, digital tokens) and one — <code>Photo</code> — is explicitly
  not, because a 24-hour TTL there once deleted every gallery photo the day after an event.</p>
  <div class="banner"><b>The tenancy rule.</b> A query that is not scoped by <code>organizationId</code> is a bug.
  <code>getOrgFilter()</code> exists for that reason and fails closed: an internal role gets
  <code>{{organizationId: null}}</code>, never <code>{{}}</code>.</div>
  <div class="toolbar">
    <input id="modelSearch" class="search" placeholder="Filter models by name or field…" />
    <span class="muted small">{len(MODELS)} models</span>
  </div>
  <div class="cards">{model_cards}</div>
</section>''')

    # 5 — utils
    util_cards = ''.join(f'''
<article class="card small-card" data-search="{e((u['name'] + u['purpose']).lower())}">
  <h3><code>{e(u['name'])}</code></h3>
  <p class="muted small"><code>{e(u['file'])}</code></p>
  <p class="notes">{e(u['purpose'])}</p>
  {table(['Export', 'What it does'], [(Safe(f'<code>{e(n)}</code>'), d) for n, d in u['exports']])}
  {f'<ul class="flags">{"".join(f"<li>{e(n)}</li>" for n in u["notes"])}</ul>' if u['notes'] else ''}
</article>''' for u in UTILS)
    body.append(f'''
<section class="doc" id="utils">
  <h2>5 · Utilities</h2>
  <p class="lede">Five modules that hide the messy edges: S3, encryption and hashing, auditing, typed HTTP errors and
  Windows printing. If a route needs the outside world, it goes through one of these.</p>
  <div class="cards">{util_cards}</div>
</section>''')

    # 6 — services
    svc_cards = ''.join(f'''
<article class="card small-card" data-search="{e((s['name'] + s['purpose']).lower())}">
  <h3><code>{e(s['name'])}</code></h3>
  <p class="muted small"><code>{e(s['file'])}</code> · depends on {e(s['depends'])}</p>
  <p class="notes">{e(s['purpose'])}</p>
  {table(['Export', 'What it does'], [(Safe(f'<code>{e(n)}</code>'), d) for n, d in s['exports']])}
  {f'<ul class="flags">{"".join(f"<li>{e(n)}</li>" for n in s["notes"])}</ul>' if s['notes'] else ''}
</article>''' for s in SERVICES)
    body.append(f'''
<section class="doc" id="services">
  <h2>6 · Services</h2>
  <p class="lede">The business rules live here, not in the routers. Each service is imported by the routers that need
  it and by nothing else; none of them imports a router.</p>
  <div class="cards">{svc_cards}</div>
</section>''')

    # 7 — flows
    flow_blocks = ''.join(flow_block(f) for f in FLOWS)
    body.append(f'''
<section class="doc" id="flows">
  <h2>7 · The complete HappyPix flow</h2>
  <p class="lede">Eleven flows, starting with the whole business on one page and then narrowing to each mechanism.
  Read flow 0 first: everything after it is a detail of one of its steps.</p>
  {EDGE_KEY}
  {flow_blocks}
</section>''')

    # 8 — env
    body.append(f'''
<section class="doc" id="env">
  <h2>8 · Environment contract</h2>
  <p class="lede">The API refuses to boot without <code>MONGODB_URI</code>, <code>JWT_SECRET</code>,
  <code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code>. Everything else degrades in a defined way — most
  commonly to local file storage and to "this feature returns a clear error".</p>
  {table(['Variable', 'Status', 'What it does and what happens without it'],
         [(Safe(f'<code>{e(v)}</code>'), s, d) for v, s, d in ENV_VARS])}
  <div class="banner"><b>Two failure modes worth knowing.</b> An unset <code>ENCRYPTION_KEY</code> means the fallback
  key is derived from <code>JWT_SECRET</code>: rotating the JWT secret then makes every stored gateway secret
  undecryptable. An unset <code>CRON_SECRET</code> means the hourly sweep never runs, so plans never expire — that is
  a silent revenue leak, not an error anybody sees.</div>
</section>''')

    # 9 — errors
    body.append(f'''
<section class="doc" id="errors">
  <h2>9 · Error catalogue</h2>
  <p class="lede">Every error response is <code>{{error, code}}</code> plus optional context. Clients should branch on
  <code>code</code>, never on the message. The 5xx handler masks unexpected failures so no stack trace or database
  detail ever reaches a client.</p>
  {table(['HTTP', 'Code', 'Meaning'], [(str(s), Safe(f'<code>{e(c)}</code>'), m) for s, c, m in ERRORS])}
</section>''')

    # 10 — appendix
    body.append(f'''
<section class="doc" id="gaps">
  <h2>10 · Known gaps in the backend</h2>
  <p class="lede">Deliberately listed here rather than hidden: these are the places where the code and the product
  story do not yet match, and every one of them has an owner and a mitigation path in
  <code>HOSTING_AND_SCALING.md</code> §9.</p>
  <div class="tw"><table class="gaps">
  <thead><tr><th>Gap</th><th>Today's behaviour</th><th>What to do about it</th></tr></thead>
  <tbody>
  <tr><td>No refund path</td><td><code>Payment.status</code> has no <code>refunded</code> state; a refund is manual and invisible to reporting.</td><td>Add the state plus a refund webhook before selling to any tenant that expects one.</td></tr>
  <tr><td>Photos are served at original size</td><td>No thumbnails or web-size variants; a gallery grid downloads full-resolution frames.</td><td>Generate a web variant at session completion; this is also the single biggest egress lever.</td></tr>
  <tr><td>Heartbeat audit volume</td><td>One audit row per booth beat — the highest write volume in the system.</td><td>Sample it, or move booth telemetry out of AuditLog.</td></tr>
  <tr><td>S3 lifecycle rules unset</td><td>Frames live forever at Standard price.</td><td>Standard-IA at 30 days, Glacier IR at 180, expire at 730 (see the hosting doc).</td></tr>
  <tr><td>Two divergent Cashfree wrappers</td><td><code>paymentRoutes.js</code> and <code>boothRoutes.js</code> each build their own client.</td><td>Extract one gateway module before adding a third gateway.</td></tr>
  <tr><td><code>usageAccessRoutes.js</code> unmounted</td><td>Dead code that still imports models.</td><td>Delete it, or mount it deliberately.</td></tr>
  <tr><td><code>syncDeviceAssignments</code> writes <code>currentEventId</code></td><td>A non-schema field, silently dropped by strict mode; the real field is <code>assignedEventId</code>.</td><td>Fix the field name; the assignment already works via the schema path.</td></tr>
  <tr><td>Eight org endpoints have no permission key</td><td>The AI and template-layout routes rely on the router-level role gate only.</td><td>Add keys to <code>config/permissions.js</code> before giving ORG_MANAGER a narrower role.</td></tr>
  <tr><td>Video / GIF add-on</td><td>Sellable on the website, unimplemented in the booth and here.</td><td>Do not sell it until the capture pipeline exists.</td></tr>
  </tbody></table></div>
</section>

<footer>
  <p>Generated by <code>docs/scripts/build_backend_doc.py</code> on {date.today().isoformat()}.
  Source data: <code>docs/scripts/data/*.py</code>. Companion documents:
  <code>docs/BACKEND_API_DATABASE.md</code>, <code>docs/openapi.yaml</code>, <code>docs/ARCHITECTURE.md</code>,
  <code>docs/DIAGRAMS.md</code>, <code>docs/HOSTING_AND_SCALING.md</code>.</p>
</footer>''')

    diagram_json = json.dumps(diagrams)
    mermaid_block = ''
    if mermaid_js:
        mermaid_block = f'<script>{mermaid_js}</script>'
    else:
        mermaid_block = ('<script>window.__MERMAID_MISSING__ = true;</script>'
                         '<script type="module" src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs" '
                         'onerror="window.__MERMAID_MISSING__=true"></script>')

    aside = f'''
<aside>
  <div class="brand"><b>HappyPix</b><span>backend</span></div>
  <p class="sub">Every endpoint, middleware, util, service, model and flow — one self-contained page.</p>
  <input id="navSearch" class="search" placeholder="Jump to a section…" />

  <nav>
    <h4>Orientation</h4>
    <a href="#glance" data-nav>1 · System at a glance</a>
    <a href="#middleware" data-nav>2 · Middleware &amp; security</a>

    <h4>API reference <span class="count">{total_eps}</span></h4>
    {nav_api}
    <a href="#server-routes" data-nav><span class="idx">r★</span>In server.js</a>

    <h4>Internals</h4>
    <a href="#models" data-nav>4 · Data model <span class="count">{len(MODELS)}</span></a>
    <a href="#utils" data-nav>5 · Utilities <span class="count">{len(UTILS)}</span></a>
    <a href="#services" data-nav>6 · Services <span class="count">{len(SERVICES)}</span></a>

    <h4>Flows</h4>
    {nav_flows}

    <h4>Reference</h4>
    <a href="#env" data-nav>8 · Environment</a>
    <a href="#errors" data-nav>9 · Errors</a>
    <a href="#gaps" data-nav>10 · Known gaps</a>
  </nav>

  <div class="tools">
    <button id="theme">Theme</button>
    <button id="wide">Wide</button>
    <button onclick="window.print()">Print / PDF</button>
  </div>
  <p class="footnote">Diagrams render locally with an inlined Mermaid build — no network required.</p>
</aside>'''

    edge_js = read_edge_colors()

    doc = f'''<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HappyPix — Complete Backend Reference</title>
<style>{css}</style>
</head>
<body>
<div class="shell">
{aside}
<main>
<noscript><div class="banner"><b>JavaScript is off in this viewer.</b> Every table, endpoint card and flow step
below still reads normally — expand a row by clicking it. Only the Mermaid diagrams need JavaScript; their source is
identical to <code>docs/DIAGRAMS.md</code>, which renders them as plain text.</div></noscript>
{''.join(body)}
</main>
</div>
<script>
const DIAGRAMS = {diagram_json};
</script>
{mermaid_block}
<script>{edge_js}</script>
<script>{JS}</script>
</body>
</html>
'''

    out = os.path.join(ROOT, 'docs', 'BACKEND_REFERENCE.html')
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(doc)

    size_mb = os.path.getsize(out) / (1024 * 1024)
    print(f'wrote {os.path.relpath(out, ROOT)} — {total_eps} endpoints, {len(MODELS)} models, '
          f'{len(FLOWS)} flows, {len(diagrams)} diagrams, {size_mb:.2f} MB')
    print(f'mermaid: {"inlined from " + mermaid_path if mermaid_path else "NOT FOUND — page will need network"}')
    return out


CSS = r"""
  :root {
    --ink: #12101a; --surface: #1a1724; --surface-2: #221e2e; --line: #332d42;
    --text: #ece9f2; --muted: #a29bb4; --gold: #d9b44a; --gold-dim: #8a7330;
    --ok: #6cc48f; --warn: #e0a75a; --bad: #e0736f; --blue: #7aa7e0;
    --shadow: 0 12px 40px rgba(0,0,0,.45); --card: #171420;
  }
  html[data-theme="light"] {
    --ink: #f7f5f0; --surface: #ffffff; --surface-2: #f1eee7; --line: #ded8ca;
    --text: #1b1822; --muted: #6a6474; --gold: #9a7b18; --gold-dim: #cbb463;
    --ok: #2f7d52; --warn: #97631c; --bad: #a83b36; --blue: #2f5e9e;
    --shadow: 0 10px 30px rgba(28,22,12,.10); --card: #ffffff;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--ink); color: var(--text);
    font: 15px/1.62 ui-sans-serif, -apple-system, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  code, pre { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
  code { font-size: .92em; }
  a { color: var(--gold); }
  h1, h2, h3, h4, h5, h6 { letter-spacing: -.01em; }

  .shell { display: grid; grid-template-columns: 306px minmax(0, 1fr); min-height: 100vh; }
  .shell.wide { grid-template-columns: 272px minmax(0, 1fr); }
  @media (max-width: 940px) { .shell, .shell.wide { grid-template-columns: 1fr; } }

  aside {
    position: sticky; top: 0; align-self: start; height: 100vh; overflow-y: auto;
    background: var(--surface); border-right: 1px solid var(--line); padding: 22px 16px 40px;
  }
  @media (max-width: 940px) { aside { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--line); } }
  .brand { display: flex; align-items: baseline; gap: 9px; }
  .brand b { font-size: 17px; }
  .brand span { font-size: 10.5px; text-transform: uppercase; letter-spacing: .18em; color: var(--gold); }
  aside p.sub { color: var(--muted); font-size: 12.5px; margin: 6px 0 16px; }
  .search {
    width: 100%; padding: 9px 11px; border-radius: 9px; border: 1px solid var(--line);
    background: var(--surface-2); color: var(--text); font-size: 13px; margin-bottom: 8px;
  }
  .search:focus { outline: 2px solid var(--gold-dim); outline-offset: 1px; }
  nav h4 {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: .14em; color: var(--gold);
    margin: 18px 0 6px; font-weight: 700; display: flex; justify-content: space-between;
  }
  nav h4 .count { color: var(--muted); letter-spacing: 0; font-size: 10.5px; }
  nav a {
    display: flex; gap: 8px; align-items: baseline; padding: 6px 9px; border-radius: 7px;
    color: var(--text); text-decoration: none; font-size: 12.8px; border-left: 2px solid transparent;
  }
  nav a:hover { background: var(--surface-2); border-left-color: var(--gold-dim); }
  nav a .idx { color: var(--muted); font-family: ui-monospace, monospace; font-size: 10.5px; min-width: 18px; }
  nav a .count { color: var(--muted); font-size: 10.5px; margin-left: auto; }
  nav a.hide { display: none; }
  .tools { display: flex; gap: 8px; margin-top: 20px; flex-wrap: wrap; }
  .tools button {
    flex: 1 1 auto; padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 12px;
    border: 1px solid var(--line); background: var(--surface-2); color: var(--text);
  }
  .tools button:hover { border-color: var(--gold-dim); }
  .footnote { color: var(--muted); font-size: 11px; margin: 16px 2px 0; }

  main { padding: 34px clamp(16px, 3.4vw, 52px) 100px; max-width: 1560px; }
  .shell.wide main { max-width: none; }

  header.hero { border-bottom: 1px solid var(--line); padding-bottom: 26px; margin-bottom: 8px; }
  .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: .18em; color: var(--gold); margin-bottom: 10px; }
  header.hero h1 { font-size: clamp(26px, 3.3vw, 40px); margin: 0 0 10px; line-height: 1.12; }
  .lede { color: var(--muted); max-width: 84ch; font-size: 14.5px; margin: 0 0 14px; }
  .meta { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0 4px; }
  .pill { font-size: 11.5px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); background: var(--surface); }
  .pill b { color: var(--text); font-weight: 600; }
  .how { margin-top: 18px; display: grid; gap: 10px; }
  .how p { margin: 0; color: var(--muted); font-size: 13.5px; max-width: 100ch; }
  .how b { color: var(--text); }

  section.doc { margin-top: 46px; }
  section.doc > h2 {
    font-size: clamp(19px, 2.1vw, 24px); margin: 0 0 6px; padding-bottom: 10px;
    border-bottom: 1px solid var(--line);
  }
  .h3 { font-size: 15px; margin: 30px 0 8px; color: var(--text); }
  .h3 code { color: var(--gold); }
  .muted { color: var(--muted); }
  .small { font-size: 12.5px; }

  .grid4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin: 20px 0 6px; }
  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 14px; margin: 10px 0; align-items: start; }
  .stat { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; }
  .stat b { display: block; font-size: 24px; line-height: 1.1; color: var(--gold); }
  .stat span { color: var(--muted); font-size: 12.5px; }
  .panel { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 6px 14px 14px; }
  .panel h4 { margin: 10px 0 6px; font-size: 13px; color: var(--gold); text-transform: uppercase; letter-spacing: .1em; }

  .tw { overflow-x: auto; margin: 10px 0 4px; border: 1px solid var(--line); border-radius: 10px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { text-align: left; padding: 8px 11px; vertical-align: top; border-bottom: 1px solid var(--line); }
  thead th {
    background: var(--surface-2); font-size: 10.5px; text-transform: uppercase; letter-spacing: .1em;
    color: var(--muted); font-weight: 700; position: sticky; top: 0; z-index: 1;
  }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr:hover td { background: color-mix(in srgb, var(--gold) 5%, transparent); }
  table.in td:nth-child(3) { color: var(--text); }
  .tw table td code { color: var(--gold); }

  .canvas {
    background: var(--ink); border: 1px solid var(--line); border-radius: 11px;
    padding: 16px; overflow: auto; min-height: 130px; margin: 10px 0 4px;
  }
  html[data-theme="light"] .canvas { background: #fbfaf6; }
  .canvas svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
  .loading { color: var(--muted); font-size: 12.5px; }
  .diagram-error { color: var(--bad); font-size: 12.5px; }
  .diagram-error pre { white-space: pre-wrap; color: var(--muted); font-size: 11.5px; margin-top: 8px; }

  section.router { margin: 34px 0 0; padding-top: 6px; }
  .router-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
  .router-head h3 { margin: 0; font-size: 17px; }
  .router-head h3 code { color: var(--gold); background: transparent; }
  .rname { color: var(--text); font-weight: 600; }
  .router-summary { color: var(--muted); font-size: 13.5px; max-width: 108ch; margin: 8px 0 10px; }
  .authbar {
    display: flex; gap: 10px; align-items: baseline; font-size: 12.5px; color: var(--muted);
    background: var(--surface); border: 1px solid var(--line); border-left: 2px solid var(--gold-dim);
    border-radius: 8px; padding: 9px 12px; margin: 0 0 10px;
  }
  .authbar b { color: var(--gold); text-transform: uppercase; font-size: 10px; letter-spacing: .12em; white-space: nowrap; }

  .m {
    display: inline-block; min-width: 52px; text-align: center; font-size: 10.5px; font-weight: 700;
    letter-spacing: .06em; padding: 2px 7px; border-radius: 5px; border: 1px solid;
    font-family: ui-monospace, monospace;
  }
  .m-get { color: var(--blue); border-color: color-mix(in srgb, var(--blue) 45%, transparent); background: color-mix(in srgb, var(--blue) 12%, transparent); }
  .m-post { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, transparent); background: color-mix(in srgb, var(--ok) 12%, transparent); }
  .m-put { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 45%, transparent); background: color-mix(in srgb, var(--warn) 12%, transparent); }
  .m-delete { color: var(--bad); border-color: color-mix(in srgb, var(--bad) 45%, transparent); background: color-mix(in srgb, var(--bad) 12%, transparent); }
  .m-all { color: var(--gold); border-color: color-mix(in srgb, var(--gold) 45%, transparent); background: color-mix(in srgb, var(--gold) 12%, transparent); }

  .cards { display: grid; gap: 8px; margin-top: 12px; }
  details.ep, details.model {
    background: var(--surface); border: 1px solid var(--line); border-radius: 10px; overflow: hidden;
  }
  details.ep[open], details.model[open] { border-color: var(--gold-dim); }
  details.ep > summary, details.model > summary {
    display: flex; gap: 10px; align-items: baseline; padding: 10px 13px; cursor: pointer;
    list-style: none; font-size: 13px;
  }
  details.ep > summary::-webkit-details-marker, details.model > summary::-webkit-details-marker { display: none; }
  details.ep > summary:hover, details.model > summary:hover { background: var(--surface-2); }
  details.ep > summary .path { color: var(--text); font-size: 12.8px; white-space: nowrap; }
  details.ep > summary .sum { color: var(--muted); font-size: 12.6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  details.ep[open] > summary .sum { color: var(--muted); }
  details.model > summary code { color: var(--gold); font-size: 13px; white-space: nowrap; }
  details.model > summary .sum { color: var(--muted); font-size: 12.6px; }
  .ep-body { padding: 4px 14px 16px; border-top: 1px solid var(--line); }
  .ep-body h6 {
    font-size: 10px; text-transform: uppercase; letter-spacing: .13em; color: var(--gold);
    margin: 16px 0 4px; font-weight: 700;
  }
  .meta-row { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12.2px; color: var(--muted); margin-top: 10px; }
  .meta-row .kv b { color: var(--gold); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; margin-right: 5px; }
  .ep-summary { margin: 8px 0 0; font-size: 13.4px; color: var(--text); max-width: 110ch; }
  ul.errs { margin: 4px 0 0; padding-left: 18px; font-size: 12.6px; color: var(--muted); }
  ul.errs code { color: var(--bad); }
  ul.flags { margin: 8px 0 0; padding-left: 18px; font-size: 12.6px; color: var(--muted); }
  ul.flags li { margin-bottom: 4px; }
  .uses { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
  .tag {
    font-size: 11.5px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line);
    color: var(--muted); background: var(--surface-2);
  }
  .tag.monoi { font-family: ui-monospace, monospace; font-size: 11px; }
  .side { font-size: 12.7px; color: var(--muted); margin: 2px 0 0; max-width: 110ch; }
  .notes { color: var(--muted); font-size: 13px; margin-top: 10px; }
  .notes p { margin: 0 0 6px; max-width: 110ch; }
  .empty { color: var(--muted); font-size: 12.5px; }
  .banner {
    border: 1px solid var(--gold-dim); background: color-mix(in srgb, var(--gold) 9%, transparent);
    padding: 12px 14px; border-radius: 10px; font-size: 13px; margin: 16px 0;
  }
  .toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 14px 0 6px; }
  .toolbar .search { max-width: 460px; margin: 0; }
  .btn {
    padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 12px;
    border: 1px solid var(--line); background: var(--surface-2); color: var(--text);
  }
  .btn:hover { border-color: var(--gold-dim); }
  .hide { display: none !important; }

  article.card {
    background: var(--card); border: 1px solid var(--line); border-radius: 14px;
    padding: 18px 20px 20px; margin: 16px 0; box-shadow: var(--shadow); scroll-margin-top: 20px;
  }
  article.card h3 { margin: 0 0 4px; font-size: 16.5px; }
  article.card h3 code { color: var(--gold); }
  article.small-card h3 { font-size: 15.5px; }
  .flow .canvas { margin-top: 12px; }

  ol.steps { list-style: none; counter-reset: s; padding: 0; margin: 14px 0 0; }
  ol.steps li {
    counter-increment: s; position: relative; padding: 10px 0 10px 42px;
    border-top: 1px solid var(--line); font-size: 13.2px;
  }
  ol.steps li::before {
    content: counter(s); position: absolute; left: 0; top: 10px; width: 26px; height: 26px;
    display: grid; place-items: center; border-radius: 50%; font-size: 11.5px; font-weight: 700;
    border: 1px solid var(--gold-dim); color: var(--gold); background: var(--surface-2);
  }
  ol.steps .who {
    display: inline-block; min-width: 118px; color: var(--gold); font-size: 11px;
    text-transform: uppercase; letter-spacing: .1em; font-weight: 700;
  }
  ol.steps .what { color: var(--text); }
  ol.steps .res { display: block; color: var(--muted); font-size: 12.6px; margin-top: 3px; }

  footer { color: var(--muted); font-size: 12px; border-top: 1px solid var(--line); margin-top: 56px; padding-top: 18px; }
  footer p { max-width: 110ch; }

  @media print {
    aside, .toolbar, .tools { display: none !important; }
    .shell { grid-template-columns: 1fr; }
    details { break-inside: avoid; }
    details:not([open]) > .ep-body { display: block; }
    body { background: #fff; color: #000; }
    .canvas { background: #fff; }
    article.card { box-shadow: none; }
  }
"""

JS = r"""
(function () {
  const root = document.documentElement;
  const shell = document.querySelector('.shell');

  // theme
  try {
    const saved = localStorage.getItem('hp-backend-theme');
    if (saved) root.setAttribute('data-theme', saved);
  } catch (_) {}
  const themeBtn = document.getElementById('theme');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('hp-backend-theme', next); } catch (_) {}
    renderAll(true);
  });
  const wideBtn = document.getElementById('wide');
  if (wideBtn) wideBtn.addEventListener('click', () => shell.classList.toggle('wide'));

  // ── connector colours ─────────────────────────────────────────────────────
  const EC = window.HappypixEdgeColors;
  if (EC) EC.mount();

  // ── diagrams ──────────────────────────────────────────────────────────────
  let mermaidLib = null;
  let rendered = false;

  function themeVars() {
    const dark = root.getAttribute('data-theme') !== 'light';
    return {
      darkMode: dark,
      background: dark ? '#12101a' : '#fbfaf6',
      primaryColor: dark ? '#221e2e' : '#f1eee7',
      primaryTextColor: dark ? '#ece9f2' : '#1b1822',
      primaryBorderColor: dark ? '#8a7330' : '#cbb463',
      lineColor: dark ? '#a29bb4' : '#6a6474',
      secondaryColor: dark ? '#1a1724' : '#ffffff',
      tertiaryColor: dark ? '#171420' : '#ffffff',
      fontFamily: 'ui-sans-serif, -apple-system, Segoe UI, Inter, Roboto, sans-serif',
      fontSize: '13px',
      noteBkgColor: dark ? '#2a2436' : '#f6f2e4',
      noteTextColor: dark ? '#ece9f2' : '#1b1822',
      noteBorderColor: dark ? '#8a7330' : '#cbb463',
      actorBkg: dark ? '#221e2e' : '#f1eee7',
      actorBorder: dark ? '#8a7330' : '#cbb463',
      signalColor: dark ? '#a29bb4' : '#3a3446',
      signalTextColor: dark ? '#ece9f2' : '#1b1822',
    };
  }

  async function getMermaid() {
    if (mermaidLib) return mermaidLib;
    if (window.mermaid) { mermaidLib = window.mermaid; return mermaidLib; }
    for (let i = 0; i < 40; i++) {              // CDN fallback, up to ~8 s
      if (window.mermaid) { mermaidLib = window.mermaid; return mermaidLib; }
      await new Promise(r => setTimeout(r, 200));
    }
    return null;
  }

  async function renderAll(force) {
    if (rendered && !force) return;
    const lib = await getMermaid();
    const targets = Array.from(document.querySelectorAll('.canvas[data-diagram]'));
    if (!lib) {
      targets.forEach(t => {
        t.innerHTML = '<p class="diagram-error">Mermaid could not be loaded in this environment. ' +
          'The diagram source is included below.</p><pre>' +
          (DIAGRAMS[t.dataset.diagram] || '') + '</pre>';
      });
      return;
    }
    if (EC) EC.mount();
    lib.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      themeVariables: themeVars(),
      flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
      sequence: { useMaxWidth: true, wrap: true, mirrorActors: false },
      er: { useMaxWidth: true },
    });
    let n = 0;
    for (const t of targets) {
      const key = t.dataset.diagram;
      const src = DIAGRAMS[key];
      if (!src) continue;
      try {
        const { svg } = await lib.render('d' + (++n) + '-' + key.replace(/[^a-z0-9-]/gi, ''), src);
        t.innerHTML = svg;
        // Colour the connecting lines: stroke only, geometry is untouched.
        if (EC) EC.paint(t.querySelector('svg'), { dark: root.getAttribute('data-theme') !== 'light' });
      } catch (err) {
        t.innerHTML = '<p class="diagram-error">Could not render this diagram: ' +
          String(err && err.message || err).replace(/[<>&]/g, '') +
          '</p><pre>' + src + '</pre>';
      }
    }
    rendered = true;
  }

  // ── endpoint filtering ────────────────────────────────────────────────────
  const epSearch = document.getElementById('epSearch');
  if (epSearch) {
    epSearch.addEventListener('input', () => {
      const q = epSearch.value.trim().toLowerCase();
      let shown = 0;
      document.querySelectorAll('details.ep').forEach(el => {
        const hit = !q || (el.dataset.search || '').includes(q);
        el.classList.toggle('hide', !hit);
        if (hit) shown++;
        if (q && hit) el.open = true;
      });
      document.querySelectorAll('section.router').forEach(sec => {
        const any = sec.querySelector('details.ep:not(.hide)');
        sec.classList.toggle('hide', q && !any);
      });
      const c = document.getElementById('epCount');
      if (c) c.textContent = q ? shown + ' matching endpoints' : '';
    });
  }
  const expandAll = document.getElementById('expandAll');
  if (expandAll) expandAll.addEventListener('click', () =>
    document.querySelectorAll('details.ep').forEach(d => d.open = true));
  const collapseAll = document.getElementById('collapseAll');
  if (collapseAll) collapseAll.addEventListener('click', () =>
    document.querySelectorAll('details.ep').forEach(d => d.open = false));

  const modelSearch = document.getElementById('modelSearch');
  if (modelSearch) {
    modelSearch.addEventListener('input', () => {
      const q = modelSearch.value.trim().toLowerCase();
      document.querySelectorAll('details.model').forEach(el => {
        const hit = !q || (el.dataset.search || '').includes(q);
        el.classList.toggle('hide', !hit);
        if (q && hit) el.open = true;
      });
    });
  }

  // ── nav filter ────────────────────────────────────────────────────────────
  const navSearch = document.getElementById('navSearch');
  if (navSearch) {
    navSearch.addEventListener('input', () => {
      const q = navSearch.value.trim().toLowerCase();
      document.querySelectorAll('nav a[data-nav]').forEach(a => {
        a.classList.toggle('hide', !!q && !a.textContent.toLowerCase().includes(q));
      });
    });
  }

  // open a section if the URL hash points at one
  if (location.hash) {
    const t = document.querySelector(location.hash);
    if (t && t.tagName === 'DETAILS') t.open = true;
  }

  renderAll(false);
})();
"""


if __name__ == '__main__':
    build()
