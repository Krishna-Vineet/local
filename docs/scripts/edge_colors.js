/*!
 * HappyPix diagram connector palette — colours the connecting lines of every
 * Mermaid diagram in docs/diagrams/index.html and docs/BACKEND_REFERENCE.html.
 *
 * Why a shared file: both HTML pages are generated (docs/scripts/build_diagrams.py
 * and docs/scripts/build_backend_doc.py) and both embed this file verbatim at
 * build time. Keeping the logic here means the two viewers cannot drift apart,
 * and neither page needs a network request to colour a line.
 *
 * How a colour is chosen, in order:
 *   1. the connector's own label           ("HTTPS", "Mongo query", "UPI webhook")
 *   2. the source/target node names        (an arrow into "MongoDB" is data)
 *   3. a six-colour cycle, in DOM order    (so unlabelled diagrams still read)
 *
 * Everything is additive: it only sets inline stroke styles and injects one
 * small <style> element per diagram. It never touches geometry, labels or the
 * Mermaid source, so a failure here costs colour, never a diagram.
 *
 * API on window.HappypixEdgeColors:
 *   mount()                 — apply theme vars, build the legend, install CSS
 *   applyTheme(dark)        — refresh the --ek-* custom properties
 *   legendHTML()            — the chips markup
 *   paint(svg, {dark})      — colour one rendered diagram
 *   paintAll(root, {dark})  — colour every svg under root
 *   CATEGORIES, PALETTES    — for anything that wants to reuse the vocabulary
 */
(function (global) {
  'use strict';

  /* ── palette ─────────────────────────────────────────────────────────────
   * Two variants, because a stroke that reads on #fbfaf6 disappears on
   * #12101a. Both keep the same category → hue mapping so muscle memory works
   * across themes.
   */
  var PALETTES = {
    dark: {
      request: '#6aa9fc',
      auth:    '#fb7185',
      data:    '#34d399',
      media:   '#fbbf24',
      money:   '#c084fc',
      print:   '#fb923c',
      async:   '#22d3ee',
      other:   '#8a8199',
      cycle:   ['#6aa9fc', '#34d399', '#c084fc', '#fb923c', '#22d3ee', '#f472b6']
    },
    light: {
      request: '#2563eb',
      auth:    '#be123c',
      data:    '#0f7a4f',
      media:   '#b45309',
      money:   '#7e22ce',
      print:   '#ea580c',
      async:   '#0e7490',
      other:   '#6a6474',
      cycle:   ['#2563eb', '#0f7a4f', '#7e22ce', '#ea580c', '#0e7490', '#be185d']
    }
  };

  var CATEGORIES = [
    { key: 'request', label: 'HTTP / API call' },
    { key: 'auth',    label: 'Auth, token, permission' },
    { key: 'data',    label: 'MongoDB / data' },
    { key: 'media',   label: 'S3 / photo media' },
    { key: 'money',   label: 'Payment, price, plan' },
    { key: 'print',   label: 'Printing' },
    { key: 'async',   label: 'Async, webhook, TTL' },
    { key: 'other',   label: 'Unclassified' }
  ];

  /* ── classification rules ────────────────────────────────────────────────
   * First match wins, so the most specific vocabulary sits at the top. Bare
   * English words that appear as node names ("Event", "Order") are avoided on
   * purpose — they would repaint half a diagram on a technicality.
   */
  var RULES = [
    ['print', /\b(print|prints|printer|printing|spool|spooler|cups|ipp|dnp|paper|ribbon|dye-?sub|airprint|print bridge|paper jam)\b/i],
    ['money', /\b(payment|payments|pay|paid|upi|razorpay|cashfree|gateway|order|amount|price|prices|pricing|coupon|coupons|discount|settle|settles|settled|settlement|payout|payouts|refund|refunds|wallet|revenue|invoice|plan|plans|credit|credits|subscription|subscriptions|quote|checkout)\b/i],
    ['auth', /\b(auth|authenticate|authentication|authorize|token|tokens|jwt|login|logout|signin|sign-in|sign in|session|sessions|password|credential|credentials|permission|permissions|role|roles|rbac|owner|revoke|revoked|api-key|api key|device token|otp|2fa|guard|guards)\b/i],
    ['data', /\b(mongo|mongodb|atlas|mongoose|db|database|collection|collections|query|queries|index|indexes|aggregate|aggregation|upsert|find|insert|update|delete|document|documents|schema|schemas|ttl index|cache|redis|write|writes|read|reads)\b/i],
    ['media', /\b(s3|bucket|presign|presigned|upload|uploads|uploading|photo|photos|image|images|jpeg|png|webp|composite|composites|cdn|media|frame|frames|render|renders|thumbnail|thumbnails|video|gif|file|files|object storage)\b/i],
    ['async', /\b(webhook|webhooks|queue|queued|job|jobs|cron|schedule|scheduled|retry|retries|ttl|expire|expires|expiry|expired|notify|notification|notifications|email|sms|whatsapp|push|async|background|heartbeat|poll|polls|polling|websocket|sse|event bus|dlq)\b/i],
    ['request', /\b(http|https|rest|api|json|get|post|put|patch|delete|request|requests|response|call|call|endpoint|graphql|fetch|socket|grpc)\b/i]
  ];

  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* ── tiny helpers ──────────────────────────────────────────────────────── */

  function isDark() {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  }

  function collection(node, selector) {
    return Array.prototype.slice.call((node || document).querySelectorAll(selector));
  }

  function byId(root, id) {
    if (!id) return null;
    try {
      return root.querySelector('[id="' + String(id).replace(/["\\]/g, '\\$&') + '"]');
    } catch (err) {
      return null;
    }
  }

  function hasClass(el, name) {
    return el.classList ? el.classList.contains(name) : (' ' + (el.getAttribute('class') || '') + ' ').indexOf(' ' + name + ' ') >= 0;
  }

  function clean(text) {
    return String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  }

  function classify(text) {
    if (!text) return null;
    // "api/booth/payments" and "PHOTO_SHARE" should still match their words.
    var probe = clean(text).replace(/[_/|·•>→←\\[\]]+/g, ' ');
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i][1].test(probe)) return RULES[i][0];
    }
    return null;
  }

  /* ── DOM reading ───────────────────────────────────────────────────────── */

  // mermaid node ids look like "<renderId>-flowchart-<nodeId>-<n>"
  var NODE_MARKERS = ['-flowchart-', '-classId-', '-state-', '-entity-', '-class-'];

  function collectNodes(svg) {
    var map = {};
    collection(svg, 'g.node, g.entityBox, g[class*="node"]').forEach(function (node) {
      var id = node.getAttribute('id') || '';
      for (var i = 0; i < NODE_MARKERS.length; i++) {
        var at = id.lastIndexOf(NODE_MARKERS[i]);
        if (at < 0) continue;
        var name = id.slice(at + NODE_MARKERS[i].length).replace(/-\d+$/, '');
        if (!name) break;
        var text = clean(node.textContent);
        if (text) map[name] = text;
        break;
      }
    });
    return map;
  }

  // The label of an edge is a sibling group carrying the same data-id.
  function labelText(svg, edgeId) {
    if (!edgeId) return '';
    var node = null;
    try {
      node = svg.querySelector('[data-id="' + String(edgeId).replace(/["\\]/g, '\\$&') + '"]');
    } catch (err) {
      node = null;
    }
    return node ? clean(node.textContent) : '';
  }

  // "L_PHOTO_S3_0"  → "PHOTO S3" plus the node labels behind those ids;
  // "id_entity-EVENT-1_entity-PAYMENT-2_0" → "EVENT PAYMENT".
  function edgeHint(dataId, nodes) {
    if (!dataId) return '';
    var parts = [];

    var entities = dataId.match(/entity-[A-Za-z0-9_]+-\d+/g);
    if (entities) {
      entities.forEach(function (token) {
        parts.push(token.replace(/^entity-/, '').replace(/-\d+$/, ''));
      });
    }

    var flow = /^L_(.+)_\d+$/.exec(dataId);
    if (flow) {
      var body = flow[1];
      for (var i = 1; i < body.length - 1; i++) {
        if (body.charAt(i) !== '_') continue;
        var from = body.slice(0, i);
        var to = body.slice(i + 1);
        if (Object.prototype.hasOwnProperty.call(nodes, from) &&
            Object.prototype.hasOwnProperty.call(nodes, to)) {
          parts.push(from, nodes[from], to, nodes[to]);
          break;
        }
      }
    }
    return parts.join(' ');
  }

  /* ── painting ──────────────────────────────────────────────────────────── */

  // Appended at the END of the <svg>, after mermaid's own <style>, so that on a
  // specificity tie our rule is the one the browser applies.
  function styleSheet(svg) {
    var sheet = svg.querySelector('style[data-edge-colors]');
    if (sheet) return sheet;
    sheet = document.createElementNS(SVG_NS, 'style');
    sheet.setAttribute('data-edge-colors', '1');
    svg.appendChild(sheet);
    return sheet;
  }

  // Arrowheads are shared markers in the <defs>, so each colour needs its own
  // clone. #id-scoped rules in mermaid's own stylesheet sometimes use
  // !important, so the injected rules do too, with one more attribute of
  // specificity.
  function recolourMarker(el, attr, colour, svg, sheet, cache) {
    var value = el.getAttribute(attr);
    if (!value) return;
    var match = /url\(\s*#([^)\s"']+)\s*\)/.exec(value);
    if (!match) return;

    var source = byId(svg, match[1]);
    if (!source) return;

    var key = match[1] + '::' + colour;
    var clone = cache[key];

    if (!clone) {
      clone = source.cloneNode(true);
      var cloneId = match[1] + '-ek' + colour.replace(/[^0-9a-f]/gi, '');
      clone.setAttribute('id', cloneId);
      (source.parentNode || svg).appendChild(clone);

      var sId = svg.getAttribute('id');
      var scope = sId ? '#' + sId + ' ' : '';
      // Three selectors so this wins whether or not the clone is a <marker>
      // and whether or not the original rule used !important.
      var head = scope + 'marker[id="' + cloneId + '"]';
      var selector = [
        head,
        head + ' *',
        scope + '[id="' + cloneId + '"] *'
      ].join(',');

      sheet.appendChild(document.createTextNode(
        selector + '{stroke:' + colour + ' !important;}'
      ));

      var filled = 0;
      collection(clone, '*').forEach(function (child) {
        // Keep an authored fill — the white "zero" circles in ER notation are
        // deliberate, not a colour we should flatten.
        if (clean(child.getAttribute('fill'))) return;
        var tag = (child.tagName || '').toLowerCase();
        var path = clean(child.getAttribute('d'));
        if (tag === 'polygon' || tag === 'circle' || /[zZ]$/.test(path)) {
          child.setAttribute('data-ek-fill', '1');
          filled += 1;
        }
      });

      if (filled) {
        sheet.appendChild(document.createTextNode(
          scope + 'marker[id="' + cloneId + '"] [data-ek-fill]{fill:' + colour + ' !important;}'
        ));
      }
      cache[key] = clone;
    }

    el.setAttribute(attr, 'url(#' + clone.getAttribute('id') + ')');
  }

  function paintEdge(el, colour, svg, sheet, cache) {
    if (!colour) return;
    el.style.stroke = colour;
    // Keep the authored dash pattern and width; only the hue is ours.
    ['marker-start', 'marker-end'].forEach(function (attr) {
      recolourMarker(el, attr, colour, svg, sheet, cache);
    });
  }

  function paint(svg, options) {
    if (!svg || !svg.querySelectorAll) return 0;

    var dark = options && typeof options.dark === 'boolean' ? options.dark : isDark();
    var palette = dark ? PALETTES.dark : PALETTES.light;
    var sheet = styleSheet(svg);
    var cache = {};
    var nodes = collectNodes(svg);
    var used = 0;
    var cycled = 0;

    function choose(label, hint) {
      var category = classify(label) || classify(hint);
      var colour = category ? palette[category] : null;
      if (!colour) {
        colour = palette.cycle[cycled % palette.cycle.length];
        cycled += 1;
      }
      used += 1;
      return colour;
    }

    // 1 — every graph-family connector (flowchart, ER, class, state, requirement)
    var edges = collection(svg, 'g.edgePaths > path');
    if (!edges.length) edges = collection(svg, 'path.flowchart-link, path.relationshipLine');

    edges.forEach(function (el) {
      var id = el.getAttribute('data-id') || '';
      paintEdge(el, choose(labelText(svg, id), edgeHint(id, nodes)), svg, sheet, cache);
    });

    // 2 — sequence-diagram messages: mermaid emits one label per line, in order
    var lines = collection(svg, 'line.messageLine0, line.messageLine1, path.messageLine0, path.messageLine1');
    var texts = collection(svg, 'text.messageText');
    lines.forEach(function (el, index) {
      var label = texts[index] ? clean(texts[index].textContent) : '';
      paintEdge(el, choose(label, ''), svg, sheet, cache);
    });

    return used;
  }

  function paintAll(root, options) {
    var scope = root && root.querySelectorAll ? root : document;
    var dark = options && typeof options.dark === 'boolean' ? options.dark : isDark();
    var total = 0;
    collection(scope, 'svg').forEach(function (svg) {
      total += paint(svg, { dark: dark });
    });
    return total;
  }

  /* ── legend + theme ────────────────────────────────────────────────────── */

  function applyTheme(dark) {
    var palette = dark ? PALETTES.dark : PALETTES.light;
    var style = document.documentElement.style;
    CATEGORIES.forEach(function (category) {
      style.setProperty('--ek-' + category.key, palette[category.key] || palette.other);
    });
  }

  function legendHTML() {
    var chips = CATEGORIES.map(function (category) {
      return '<span class="ek-item"><i class="ek-chip" style="background:var(--ek-' +
        category.key + ')"></i>' + category.label + '</span>';
    }).join('');
    return '<span class="ek-title">Connector colours</span>' + chips +
      '<span class="ek-note">Connectors are coloured by what they carry; unlabelled ones cycle through the same palette.</span>';
  }

  var CSS = [
    '.edge-key{display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;margin:14px 0 18px;' +
      'padding:10px 14px;border:1px solid var(--line,#ded8ca);border-radius:12px;' +
      'background:var(--surface,#ffffff);color:var(--text,#1b1822);font-size:12.5px;line-height:1.5}',
    '.edge-key .ek-title{font-weight:700;letter-spacing:.02em;text-transform:uppercase;font-size:11px;' +
      'opacity:.75;margin-right:2px}',
    '.edge-key .ek-item{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;opacity:.95}',
    '.edge-key .ek-chip{display:inline-block;width:22px;height:3px;border-radius:2px;flex:0 0 auto}',
    '.edge-key .ek-note{flex-basis:100%;color:var(--muted,#6a6474);font-size:11.5px;margin-top:2px}',
    '@media (max-width:640px){.edge-key{gap:5px 12px;font-size:12px}}'
  ].join('\n');

  function mount() {
    if (!document.getElementById('edge-colors-style')) {
      var style = document.createElement('style');
      style.id = 'edge-colors-style';
      style.appendChild(document.createTextNode(CSS));
      document.head.appendChild(style);
    }
    applyTheme(isDark());
    collection(document, '[data-edge-key]').forEach(function (slot) {
      slot.className = slot.className || 'edge-key';
      slot.innerHTML = legendHTML();
    });
  }

  global.HappypixEdgeColors = {
    CATEGORIES: CATEGORIES,
    PALETTES: PALETTES,
    mount: mount,
    applyTheme: applyTheme,
    legendHTML: legendHTML,
    paint: paint,
    paintAll: paintAll
  };
})(typeof window !== 'undefined' ? window : this);
