#!/usr/bin/env python3
"""
Build the HappyPix diagram set from its single source of truth.

Source of truth:  docs/diagrams/src/*.mmd
Generated:        docs/DIAGRAMS.md          (GitHub-renderable, one fenced block per diagram)
                  docs/diagrams/index.html  (standalone styled viewer)

Source file format
------------------
    %%@ <id> :: <title>
    %%@ note: <one or more markdown note lines>
    <mermaid definition ...>

    %%@ <next-id> :: <next title>
    ...

Why a builder and not hand-written files: the same definition must appear in a
markdown document that renders on GitHub and in a self-contained HTML viewer.
Duplicating 29 diagrams by hand guarantees drift.

Usage:  python3 docs/scripts/build_diagrams.py
"""

from __future__ import annotations

import html
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "docs" / "diagrams" / "src"
MD_OUT = ROOT / "docs" / "DIAGRAMS.md"
HTML_OUT = ROOT / "docs" / "diagrams" / "index.html"

FAMILIES = {
    "01-ecosystem.mmd": ("1 · Ecosystem", "Whole-system component and trust maps."),
    "02-er.mmd": ("2 · Database (ER)", "The 23 Mongoose collections and their foreign keys."),
    "03-dfd.mmd": ("3 · Data flow (DFD 0/1/2)", "Context, level 1, and one level 2 diagram per business process."),
    "04-hld-lld.mmd": ("4 · HLD / LLD", "Layered architecture, deployment, request pipeline, sequences, state machine."),
    "05-future.mmd": ("5 · Future architecture", "The target state at full load and the measurable triggers to get there."),
}

HEADER_RE = re.compile(r"^%%@\s+(?!note:)(\S+)\s+::\s+(.*)$")
NOTE_RE = re.compile(r"^%%@\s+note:\s?(.*)$")


@dataclass
class Diagram:
    ident: str
    title: str
    notes: list[str] = field(default_factory=list)
    body: list[str] = field(default_factory=list)
    family: str = ""
    family_title: str = ""
    source_file: str = ""
    kind: str = ""

    @property
    def definition(self) -> str:
        return "\n".join(self.body).strip("\n")

    @property
    def anchor(self) -> str:
        return self.ident.replace(".", "-")


def parse_family(path: Path) -> list[Diagram]:
    diagrams: list[Diagram] = []
    current: Diagram | None = None
    family_title = FAMILIES.get(path.name, (path.stem, ""))[0]

    for line in path.read_text(encoding="utf-8").splitlines():
        header = HEADER_RE.match(line)
        if header:
            current = Diagram(
                ident=header.group(1),
                title=header.group(2).strip(),
                family=path.name,
                family_title=family_title,
                source_file=f"docs/diagrams/src/{path.name}",
            )
            diagrams.append(current)
            continue
        note = NOTE_RE.match(line)
        if note:
            if current is not None:
                current.notes.append(note.group(1))
            continue
        if current is not None:
            current.body.append(line)

    for diagram in diagrams:
        head = diagram.definition.split("\n", 1)[0].strip()
        diagram.kind = head.split()[0] if head else "flowchart"
    return diagrams


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def build_markdown(diagrams: list[Diagram]) -> str:
    by_family: dict[str, list[Diagram]] = {}
    for diagram in diagrams:
        by_family.setdefault(diagram.family, []).append(diagram)

    lines: list[str] = []
    add = lines.append

    add("# HappyPix — System Diagrams")
    add("")
    add("> **What this is:** the complete diagram set for HappyPix — 29 diagrams covering the ecosystem,")
    add("> the database, data flow at three levels, high- and low-level design, and the future architecture.")
    add("> **Generated file:** do not edit by hand. The source of truth is `docs/diagrams/src/*.mmd`;")
    add("> regenerate with `python3 docs/scripts/build_diagrams.py`.")
    add(">")
    add("> **Rendering:** every definition is Mermaid. GitHub renders them natively. For a styled, searchable")
    add("> viewer open [`docs/diagrams/index.html`](diagrams/index.html) in a browser.")
    add("")
    add("---")
    add("")

    # Index
    add("## Index")
    add("")
    add("| # | Diagram | Notation | What it answers |")
    add("|---|---|---|---|")
    for index, diagram in enumerate(diagrams, start=1):
        summary = (diagram.notes[0] if diagram.notes else "").replace("|", "\\|")
        if len(summary) > 130:
            summary = summary[:130].rsplit(" ", 1)[0] + "…"
        add(
            f"| {index} | [{diagram.title}](#{diagram.anchor}) "
            f"| `{diagram.kind}` | {summary} |"
        )
    add("")
    add("---")
    add("")

    # How to read
    add("## How to read these diagrams")
    add("")
    add("**Flowchart notation used for DFDs** — the same convention at every level:")
    add("")
    add("| Shape | Meaning | Example |")
    add("|---|---|---|")
    add("| Rectangle | External entity (outside the system boundary) | `Guest`, `Razorpay` |")
    add("| Circle / rounded | Process (transforms data) | `2.3 Create payment and order` |")
    add("| Cylinder | Data store | `D4 payments` |")
    add("| Labelled arrow | Data flow, named as the data itself | `complete quote` |")
    add("")
    add("**ER notation:** `||--o{` is one-to-many, `||--o|` is one-to-zero-or-one, `}o--o{` is many-to-many.")
    add("Cardinality describes what the code enforces; MongoDB adds no constraint of its own.")
    add("")
    add("**Sequence diagrams** are ordered by real call order in the code, not by intent. Where the booth")
    add("retries or polls, the loop box states the interval used by the shipped apps.")
    add("")
    add("---")
    add("")

    for family_file in sorted(by_family):
        family_title, blurb = FAMILIES.get(family_file, (family_file, ""))
        members = by_family[family_file]
        add(f"## {family_title}")
        add("")
        if blurb:
            add(f"*{blurb}*")
            add("")
        add(f"<sub>Source: `docs/diagrams/src/{family_file}` · {len(members)} diagrams</sub>")
        add("")
        for diagram in members:
            add(f'<a id="{diagram.anchor}"></a>')
            add("")
            add(f"### {diagram.ident.upper()} — {diagram.title}")
            add("")
            for note in diagram.notes:
                add(f"> {note}")
                add(">")
            if diagram.notes:
                lines.pop()  # drop the trailing bare '>'
            add("")
            add("```mermaid")
            add(diagram.definition)
            add("```")
            add("")
        add("---")
        add("")

    add("## Keeping these current")
    add("")
    add("| When this changes | Update this file | Why |")
    add("|---|---|---|")
    add("| A new router, service or external provider | `01-ecosystem.mmd`, `04-hld-lld.mmd` | The component and dependency maps must list it |")
    add("| A Mongoose model or a new reference | `02-er.mmd` | ER diagrams are the data contract |")
    add("| A new endpoint with new inputs/outputs | `03-dfd.mmd` | The owning process must show the new flow |")
    add("| Pricing, plans, gateway behaviour | `03-dfd.mmd` (processes 2.0 and 6.0) | Money flows are the most-read diagrams |")
    add("| An infrastructure migration | `04-hld-lld.mmd`, `05-future.mmd` | Deployment truth must match reality |")
    add("| A hosting, cost or scale-threshold decision | `04-hld-lld.mmd`, `05-future.mmd` | Keep them in step with [`HOSTING_AND_SCALING.md`](HOSTING_AND_SCALING.md) |")
    add("")
    add("Companion references that read alongside these diagrams:")
    add("")
    add("* [`HOSTING_AND_SCALING.md`](HOSTING_AND_SCALING.md) — where each component actually runs today, its unit")
    add("  cost, the numeric triggers that force a move, and the stages from 10K to 10M users. The deployment parts")
    add("  of `04-hld-lld` and all of `05-future` are the visual form of that document; if they disagree, the doc wins")
    add("  and the diagram is wrong.")
    add("* [`BACKEND_REFERENCE.html`](BACKEND_REFERENCE.html) — the full endpoint, middleware, service and model")
    add("  reference, including the request-lifecycle and dependency diagrams that are too detailed to belong here.")
    add("* [`ARCHITECTURE.md`](ARCHITECTURE.md) — the prose version of `d4-1` and `d4-2`.")
    add("")
    add("Validate after editing (catches Mermaid syntax errors before a reviewer does):")
    add("")
    add("```bash")
    add("npm install --no-save mermaid@11 jsdom      # one-off, not committed")
    add("node docs/scripts/validate_diagrams.mjs     # prints OK/FAIL per diagram")
    add("python3 docs/scripts/build_diagrams.py      # regenerate this file + the viewer")
    add("```")
    add("")
    return "\n".join(lines)


HTML_TEMPLATE = """<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HappyPix — System Diagrams</title>
<style>
  :root {
    --ink: #12101a; --surface: #1a1724; --surface-2: #221e2e; --line: #332d42;
    --text: #ece9f2; --muted: #a29bb4; --gold: #d9b44a; --gold-dim: #8a7330;
    --ok: #6cc48f; --shadow: 0 12px 40px rgba(0,0,0,.45);
  }
  html[data-theme="light"] {
    --ink: #f7f5f0; --surface: #ffffff; --surface-2: #f1eee7; --line: #ded8ca;
    --text: #1b1822; --muted: #6a6474; --gold: #9a7b18; --gold-dim: #cbb463;
    --ok: #2f7d52; --shadow: 0 10px 30px rgba(28,22,12,.10);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--ink); color: var(--text);
    font: 15px/1.6 ui-sans-serif, -apple-system, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  code, pre { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }

  .shell { display: grid; grid-template-columns: 310px minmax(0, 1fr); min-height: 100vh; }
  @media (max-width: 900px) { .shell { grid-template-columns: 1fr; } }

  aside {
    position: sticky; top: 0; align-self: start; height: 100vh; overflow-y: auto;
    background: var(--surface); border-right: 1px solid var(--line); padding: 22px 18px 40px;
  }
  @media (max-width: 900px) { aside { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--line); } }
  .brand { display: flex; align-items: baseline; gap: 9px; margin-bottom: 4px; }
  .brand b { font-size: 17px; letter-spacing: .2px; }
  .brand span { font-size: 11px; text-transform: uppercase; letter-spacing: .16em; color: var(--gold); }
  aside p.sub { color: var(--muted); font-size: 12.5px; margin: 0 0 18px; }
  .search {
    width: 100%; padding: 9px 11px; border-radius: 9px; border: 1px solid var(--line);
    background: var(--surface-2); color: var(--text); font-size: 13px; margin-bottom: 16px;
  }
  .search:focus { outline: 2px solid var(--gold-dim); outline-offset: 1px; }
  nav h4 {
    font-size: 10.5px; text-transform: uppercase; letter-spacing: .14em; color: var(--gold);
    margin: 20px 0 8px; font-weight: 700;
  }
  nav a {
    display: block; padding: 7px 10px; border-radius: 8px; color: var(--text);
    text-decoration: none; font-size: 13px; border-left: 2px solid transparent;
  }
  nav a:hover { background: var(--surface-2); border-left-color: var(--gold-dim); }
  nav a .id { color: var(--muted); font-size: 11px; font-family: ui-monospace, monospace; margin-right: 6px; }
  nav a.hide { display: none; }
  .tools { display: flex; gap: 8px; margin-top: 22px; flex-wrap: wrap; }
  .tools button {
    flex: 1 1 auto; padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 12px;
    border: 1px solid var(--line); background: var(--surface-2); color: var(--text);
  }
  .tools button:hover { border-color: var(--gold-dim); }

  main { padding: 34px clamp(18px, 4vw, 56px) 90px; max-width: 1500px; }
  header.hero { border-bottom: 1px solid var(--line); padding-bottom: 22px; margin-bottom: 30px; }
  header.hero h1 { font-size: clamp(24px, 3vw, 34px); margin: 0 0 8px; letter-spacing: -.02em; }
  header.hero p { color: var(--muted); margin: 0; max-width: 78ch; font-size: 14px; }
  .meta { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
  .pill {
    font-size: 11.5px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line);
    color: var(--muted); background: var(--surface);
  }
  .pill b { color: var(--text); font-weight: 600; }

  section.family { margin: 42px 0 0; }
  section.family > h2 {
    font-size: 12px; text-transform: uppercase; letter-spacing: .16em; color: var(--gold);
    margin: 0 0 4px; font-weight: 700;
  }
  section.family > .blurb { color: var(--muted); font-size: 13px; margin: 0 0 20px; }

  article.card {
    background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
    padding: 20px 22px 22px; margin-bottom: 26px; box-shadow: var(--shadow); scroll-margin-top: 20px;
  }
  article.card > h3 { margin: 0 0 2px; font-size: 17.5px; letter-spacing: -.01em; }
  article.card > h3 .id { color: var(--gold); font-family: ui-monospace, monospace; font-size: 13px; margin-right: 8px; }
  .notes { color: var(--muted); font-size: 13.5px; margin: 8px 0 14px; max-width: 100ch; }
  .notes p { margin: 0 0 6px; }
  .canvas {
    background: var(--ink); border: 1px solid var(--line); border-radius: 11px;
    padding: 16px; overflow: auto; min-height: 120px;
  }
  html[data-theme="light"] .canvas { background: #fbfaf6; }
  .canvas .mermaid { display: flex; justify-content: center; }
  .canvas svg { max-width: 100%; height: auto; }
  .cardbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 12px; }
  .cardbar .src { color: var(--muted); font-size: 11.5px; margin-left: auto; font-family: ui-monospace, monospace; }
  .cardbar button {
    font-size: 11.5px; padding: 5px 9px; border-radius: 7px; cursor: pointer;
    border: 1px solid var(--line); background: var(--surface-2); color: var(--muted);
  }
  .cardbar button:hover { color: var(--text); border-color: var(--gold-dim); }
  pre.raw { display: none; white-space: pre; overflow-x: auto; font-size: 12px; color: var(--muted);
    background: var(--surface-2); padding: 12px; border-radius: 9px; margin: 12px 0 0; }
  pre.raw.show { display: block; }
  .banner {
    border: 1px solid var(--gold-dim); background: rgba(217,180,74,.09); color: var(--text);
    padding: 12px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 22px;
  }
  .banner code { background: rgba(0,0,0,.25); padding: 1px 5px; border-radius: 4px; }
  footer { color: var(--muted); font-size: 12px; border-top: 1px solid var(--line); margin-top: 50px; padding-top: 18px; }
  @media print {
    aside, .cardbar, .search { display: none !important; }
    .shell { grid-template-columns: 1fr; }
    article.card { break-inside: avoid; box-shadow: none; }
    body { background: #fff; color: #000; }
  }
</style>
</head>
<body>
<div class="shell">
  <aside>
    <div class="brand"><b>HappyPix</b><span>diagrams</span></div>
    <p class="sub">29 diagrams generated from <code>docs/diagrams/src</code>.</p>
    <input class="search" id="search" type="search" placeholder="Filter diagrams…  ( / )" autocomplete="off">
    <nav id="nav">__NAV__</nav>
    <div class="tools">
      <button id="theme" type="button">Toggle theme</button>
      <button id="expand" type="button">Wide mode</button>
    </div>
  </aside>

  <main>
    <header class="hero">
      <h1>HappyPix system diagrams</h1>
      <p>Ecosystem, database, data flow at three levels, high- and low-level design, and the target
      architecture. Every diagram is Mermaid source kept next to the code it describes.</p>
      <div class="meta">
        <span class="pill"><b>29</b> diagrams</span>
        <span class="pill"><b>23</b> collections</span>
        <span class="pill"><b>DFD</b> level 0, 1, 2</span>
        <span class="pill">source: <b>docs/diagrams/src/*.mmd</b></span>
      </div>
    </header>

    <div class="banner" id="fallback" hidden>
      Diagrams could not be rendered because the Mermaid library could not be loaded
      (offline or blocked network). Press <code>Show source</code> on any card to read the
      definition, or open <code>docs/DIAGRAMS.md</code> on GitHub where rendering is built in.
    </div>

    __BODY__

    <footer>
      Generated by <code>docs/scripts/build_diagrams.py</code> · notation guide and per-diagram notes live in
      <code>docs/DIAGRAMS.md</code> · last build __STAMP__.
    </footer>
  </main>
</div>

<script type="module">
  const CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

  // ── theme ──────────────────────────────────────────────────────────
  const root = document.documentElement;
  const savedTheme = localStorage.getItem('hp-diagram-theme');
  if (savedTheme) root.dataset.theme = savedTheme;
  document.getElementById('theme').addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('hp-diagram-theme', root.dataset.theme);
    location.reload();
  });

  // ── wide mode ──────────────────────────────────────────────────────
  document.getElementById('expand').addEventListener('click', () => {
    const main = document.querySelector('main');
    const wide = main.style.maxWidth === 'none';
    main.style.maxWidth = wide ? '1500px' : 'none';
    document.querySelectorAll('.canvas svg').forEach((svg) => { svg.style.maxWidth = wide ? '100%' : 'none'; });
  });

  // ── filter ─────────────────────────────────────────────────────────
  const search = document.getElementById('search');
  const links = [...document.querySelectorAll('#nav a')];
  const cards = [...document.querySelectorAll('article.card')];
  const families = [...document.querySelectorAll('section.family')];
  function filter(term) {
    const q = term.trim().toLowerCase();
    links.forEach((a) => a.classList.toggle('hide', q && !a.textContent.toLowerCase().includes(q)));
    cards.forEach((c) => c.toggleAttribute('hidden', !!q && !c.textContent.toLowerCase().includes(q)));
    families.forEach((f) => f.toggleAttribute('hidden', !f.querySelector('article.card:not([hidden])')));
  }
  search.addEventListener('input', (e) => filter(e.target.value));
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== search) { e.preventDefault(); search.focus(); }
    if (e.key === 'Escape') { search.value = ''; filter(''); search.blur(); }
  });

  // ── show source ────────────────────────────────────────────────────
  document.querySelectorAll('[data-raw]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pre = document.getElementById(btn.dataset.raw);
      pre.classList.toggle('show');
      btn.textContent = pre.classList.contains('show') ? 'Hide source' : 'Show source';
    });
  });

  // ── render ─────────────────────────────────────────────────────────
  try {
    const { default: mermaid } = await import(CDN);
    const dark = root.dataset.theme !== 'light';
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      fontFamily: 'ui-sans-serif, -apple-system, Segoe UI, Inter, Roboto, sans-serif',
      themeVariables: dark
        ? { background: '#12101a', primaryColor: '#221e2e', primaryTextColor: '#ece9f2',
            primaryBorderColor: '#4a4159', lineColor: '#8a8199', secondaryColor: '#1a1724',
            tertiaryColor: '#1a1724', mainBkg: '#221e2e', nodeBorder: '#4a4159',
            clusterBkg: '#1a1724', clusterBorder: '#332d42', titleColor: '#d9b44a',
            edgeLabelBackground: '#12101a', textColor: '#ece9f2' }
        : { background: '#fbfaf6', primaryColor: '#ffffff', primaryTextColor: '#1b1822',
            primaryBorderColor: '#ded8ca', lineColor: '#6a6474', secondaryColor: '#f1eee7',
            tertiaryColor: '#f1eee7', mainBkg: '#ffffff', nodeBorder: '#ded8ca',
            clusterBkg: '#f1eee7', clusterBorder: '#ded8ca', titleColor: '#9a7b18',
            edgeLabelBackground: '#fbfaf6', textColor: '#1b1822' },
      flowchart: { htmlLabels: true, curve: 'basis', padding: 12, nodeSpacing: 42, rankSpacing: 52 },
      er: { minEntityWidth: 110, minEntityHeight: 40, entityPadding: 14, useMaxWidth: true },
      sequence: { useMaxWidth: true, wrap: true, width: 190 },
    });
    await mermaid.run({ querySelector: 'div.mermaid' });
    document.getElementById('fallback').hidden = true;
  } catch (err) {
    console.error('Mermaid failed to load:', err);
    document.getElementById('fallback').hidden = false;
    document.querySelectorAll('div.mermaid').forEach((d) => {
      d.classList.remove('mermaid');
      d.innerHTML = '<pre style="white-space:pre;overflow:auto;font-size:12px;color:#a29bb4">'
        + d.textContent.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])) + '</pre>';
    });
  }
</script>
</body>
</html>
"""


def build_html(diagrams: list[Diagram], stamp: str) -> str:
    by_family: dict[str, list[Diagram]] = {}
    for diagram in diagrams:
        by_family.setdefault(diagram.family, []).append(diagram)

    nav: list[str] = []
    body: list[str] = []

    for family_file in sorted(by_family):
        family_title, blurb = FAMILIES.get(family_file, (family_file, ""))
        members = by_family[family_file]
        nav.append(f"<h4>{html.escape(family_title)}</h4>")
        for diagram in members:
            nav.append(
                f'<a href="#{diagram.anchor}"><span class="id">{html.escape(diagram.ident)}</span>'
                f"{html.escape(diagram.title)}</a>"
            )

        body.append('<section class="family">')
        body.append(f"<h2>{html.escape(family_title)}</h2>")
        if blurb:
            body.append(f'<p class="blurb">{html.escape(blurb)}</p>')
        for diagram in members:
            notes = "".join(f"<p>{html.escape(n)}</p>" for n in diagram.notes)
            body.append(
                f'<article class="card" id="{diagram.anchor}">'
                f'<h3><span class="id">{html.escape(diagram.ident.upper())}</span>{html.escape(diagram.title)}</h3>'
                f'{f"<div class=notes>{notes}</div>" if notes else ""}'
                f'<div class="canvas"><div class="mermaid">{html.escape(diagram.definition)}</div></div>'
                f'<div class="cardbar">'
                f'<span class="pill">{html.escape(diagram.kind)}</span>'
                f'<button type="button" data-raw="{diagram.anchor}-raw">Show source</button>'
                f'<span class="src">{html.escape(diagram.source_file)}</span>'
                f"</div>"
                f'<pre class="raw" id="{diagram.anchor}-raw">{html.escape(diagram.definition)}</pre>'
                f"</article>"
            )
        body.append("</section>")

    return (
        HTML_TEMPLATE.replace("__NAV__", "\n".join(nav))
        .replace("__BODY__", "\n".join(body))
        .replace("__STAMP__", stamp)
    )


def main() -> int:
    if not SRC.is_dir():
        print(f"error: {SRC} does not exist", file=sys.stderr)
        return 2
    source_files = sorted(SRC.glob("*.mmd"))
    if not source_files:
        print(f"error: no .mmd sources in {SRC}", file=sys.stderr)
        return 2

    diagrams: list[Diagram] = []
    for path in source_files:
        diagrams.extend(parse_family(path))

    ids = [d.ident for d in diagrams]
    duplicates = {i for i in ids if ids.count(i) > 1}
    if duplicates:
        print(f"error: duplicate diagram ids: {sorted(duplicates)}", file=sys.stderr)
        return 2

    MD_OUT.write_text(build_markdown(diagrams), encoding="utf-8")
    stamp = "2026-10-25"
    HTML_OUT.parent.mkdir(parents=True, exist_ok=True)
    HTML_OUT.write_text(build_html(diagrams, stamp), encoding="utf-8")

    kinds: dict[str, int] = {}
    for diagram in diagrams:
        kinds[diagram.kind] = kinds.get(diagram.kind, 0) + 1

    print(f"wrote {MD_OUT.relative_to(ROOT)}  ({len(diagrams)} diagrams)")
    print(f"wrote {HTML_OUT.relative_to(ROOT)}  ({len(diagrams)} diagrams)")
    print("by notation: " + json.dumps(kinds))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
