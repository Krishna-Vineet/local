#!/usr/bin/env python3
"""
Regenerates the three HappyPix business workbooks:

    business/FINANCIAL_MODEL.xlsx
    business/UNIT_ECONOMICS.xlsx
    business/HANDOVER_REGISTER.xlsx

Run:
    pip install --break-system-packages openpyxl
    python3 business/scripts/build_workbooks.py

Design rules
------------
* Yellow cells are INPUTS — edit these.
* Grey/white cells are CALCULATED — formulas, do not overwrite.
* Every derived number is a live formula, so changing an input updates the model.
* `fullCalcOnLoad` is enabled so Excel/LibreOffice recalculate on open.
* Currency: INR unless a column header says USD.
"""

from __future__ import annotations

import os
from datetime import date

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ─────────────────────────── shared styling ───────────────────────────
INK = "1F2937"
ACCENT = "0F766E"
YELLOW = "FFF7CC"
GREY = "F3F4F6"
HEAD_FILL = PatternFill("solid", fgColor=INK)
SUB_FILL = PatternFill("solid", fgColor="E5E7EB")
INPUT_FILL = PatternFill("solid", fgColor=YELLOW)
CALC_FILL = PatternFill("solid", fgColor=GREY)
TOTAL_FILL = PatternFill("solid", fgColor="D1FAE5")

THIN = Side(style="thin", color="D1D5DB")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

TITLE_FONT = Font(bold=True, size=18, color=INK)
SUB_FONT = Font(italic=True, size=10, color="6B7280")
HEAD_FONT = Font(bold=True, size=10, color="FFFFFF")
BODY = Font(size=10, color=INK)
BOLD = Font(bold=True, size=10, color=INK)

INR = '"₹"#,##0'
INR2 = '"₹"#,##0.00'
USD = '"$"#,##0'
USD2 = '"$"#,##0.00'
PCT = "0.0%"
NUM = "#,##0"
NUM2 = "#,##0.00"


def sheet_title(ws, text, subtitle=None):
    ws["A1"] = text
    ws["A1"].font = TITLE_FONT
    if subtitle:
        ws["A2"] = subtitle
        ws["A2"].font = SUB_FONT


def widths(ws, spec):
    for col, w in spec.items():
        ws.column_dimensions[col].width = w


def header(ws, row, headers, start_col=1):
    for i, h in enumerate(headers):
        c = ws.cell(row=row, column=start_col + i, value=h)
        c.font = HEAD_FONT
        c.fill = HEAD_FILL
        c.border = BOX
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[row].height = 30


def section(ws, row, text, span=6):
    c = ws.cell(row=row, column=1, value=text)
    c.font = Font(bold=True, size=11, color=ACCENT)
    c.fill = SUB_FILL
    for i in range(1, span + 1):
        ws.cell(row=row, column=i).fill = SUB_FILL
        ws.cell(row=row, column=i).border = BOX


def put(ws, row, col, value, fmt=None, fill=None, bold=False, align=None, wrap=False):
    c = ws.cell(row=row, column=col, value=value)
    c.font = BOLD if bold else BODY
    c.border = BOX
    if fmt:
        c.number_format = fmt
    if fill == "input":
        c.fill = INPUT_FILL
    elif fill == "calc":
        c.fill = CALC_FILL
    elif fill == "total":
        c.fill = TOTAL_FILL
    if align or wrap:
        c.alignment = Alignment(horizontal=align or "general", vertical="top", wrap_text=wrap)
    return c


def note(ws, row, col, text, span=None):
    c = ws.cell(row=row, column=col, value=text)
    c.font = Font(italic=True, size=9, color="6B7280")
    c.alignment = Alignment(wrap_text=True, vertical="top")
    if span:
        ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col + span - 1)
    return c


def readme(wb, lines, title, subtitle):
    ws = wb.create_sheet("README", 0)
    sheet_title(ws, title, subtitle)
    widths(ws, {"A": 3, "B": 118})
    r = 4
    for kind, text in lines:
        c = ws.cell(row=r, column=2, value=text)
        if kind == "h":
            c.font = Font(bold=True, size=12, color=ACCENT)
        elif kind == "b":
            c.font = BOLD
        elif kind == "s":
            c.font = Font(size=10, color="6B7280", italic=True)
        else:
            c.font = BODY
        c.alignment = Alignment(wrap_text=True, vertical="top")
        ws.row_dimensions[r].height = max(15, 15 * (len(text) // 110 + 1))
        r += 1
    ws.sheet_view.showGridLines = False
    return ws


def legend(ws, row):
    put(ws, row, 1, "Input", fill="input", bold=True)
    put(ws, row, 2, "Editable assumption — change this", wrap=True)
    put(ws, row + 1, 1, "Calc", fill="calc", bold=True)
    put(ws, row + 1, 2, "Formula — do not overwrite", wrap=True)
    put(ws, row + 2, 1, "Total", fill="total", bold=True)
    put(ws, row + 2, 2, "Sum / key result", wrap=True)


def finish(wb, path):
    wb.calculation.fullCalcOnLoad = True
    for ws in wb.worksheets:
        ws.sheet_view.showGridLines = False
        if ws.title != "README" and ws.freeze_panes is None and ws.max_row > 6:
            ws.freeze_panes = "A5"
    wb.active = 0
    wb.save(path)
    print("wrote", path)


# ══════════════════════════════════════════════════════════════════════
# 1. FINANCIAL MODEL
# ══════════════════════════════════════════════════════════════════════
def build_financial_model():
    wb = Workbook()
    wb.remove(wb.active)

    # ── Assumptions ──────────────────────────────────────────────────
    a = wb.create_sheet("Assumptions")
    sheet_title(a, "Assumptions", "Every other sheet references these cells. Change them here, not in the model sheets.")
    widths(a, {"A": 42, "B": 16, "C": 12, "D": 62})
    header(a, 4, ["Assumption", "Value", "Unit", "Source / rationale"])

    rows = [
        ("FX rate", 84, "INR/USD", "2026 planning rate"),
        ("Users per organization", 2.2, "seats", "Observed CRM seat average"),
        ("Blended ARPU", 1150, "INR/org/mo", "Mix of Basic/Pro/Premium incl. annual discounts"),
        ("Add-on attach rate", 0.12, "% of orgs", "₹249 add-ons"),
        ("Add-on price", 249, "INR/mo", "Catalogue price"),
        ("Monthly logo churn", 0.03, "% of orgs", "Early-stage SaaS; improves with age"),
        ("Monthly expansion", 0.008, "% of orgs", "Upgrades and seat growth"),
        ("Payment MDR — cards", 0.02, "% of value", "Razorpay standard"),
        ("Payment MDR — UPI", 0.0, "% of value", "UPI is zero-MDR in India"),
        ("Card share of payments", 0.35, "% of value", "Rest is UPI"),
        ("GST on subscription", 0.18, "%", "India, 18%"),
        ("Refund / dispute rate", 0.015, "% of revenue", "Chargebacks + goodwill"),
        ("Chargeback fee", 500, "INR/event", "Provider fee"),
        ("Support cost per org", 55, "INR/mo", "Tooling/telephony only — support salaries sit in Team_Costs"),
        ("Trial conversion", 0.22, "% of trials", "Trial → paid"),
        ("CAC (blended)", 1800, "INR/org", "Digital-led acquisition; heavy sales costs sit in Team_Costs"),
        ("Infra per session", 0.33, "INR", "Stage-1 measured/planned"),
        ("Sessions per org per month", 108, "sessions", "1.2 events × 90 sessions"),
        ("Prints per session", 0.85, "%", "Share of sessions that print"),
        ("Media cost per 4×6 sheet", 26, "INR", "DNP media, landed"),
        ("Contingency on opex", 0.08, "%", "Buffer"),
        ("Employer overhead on salary", 0.15, "%", "Benefits, equipment, software"),
        ("Opening cash", 10000000, "INR", "Founder capital at month 1"),
    ]
    r = 5
    cell = {}
    for name, val, unit, why in rows:
        put(a, r, 1, name, bold=True)
        c = put(a, r, 2, val, fill="input",
                fmt=PCT if unit == "%" else (NUM2 if isinstance(val, float) else NUM))
        put(a, r, 3, unit)
        put(a, r, 4, why, wrap=True)
        cell[name] = f"Assumptions!$B${r}"
        r += 1

    note(a, r + 1, 1, "Yellow cells are inputs. All model sheets read from this block.", span=4)
    a.freeze_panes = "A5"

    FX = cell["FX rate"]
    ARPU = cell["Blended ARPU"]
    ADDON_ATTACH = cell["Add-on attach rate"]
    ADDON_PRICE = cell["Add-on price"]
    CHURN = cell["Monthly logo churn"]
    EXPANSION = cell["Monthly expansion"]
    MDR_CARD = cell["Payment MDR — cards"]
    MDR_UPI = cell["Payment MDR — UPI"]
    CARD_SHARE = cell["Card share of payments"]
    REFUND = cell["Refund / dispute rate"]
    SUPPORT_ORG = cell["Support cost per org"]
    OVERHEAD = cell["Employer overhead on salary"]
    CONTINGENCY = cell["Contingency on opex"]

    # ── Historical development investment ────────────────────────────
    d = wb.create_sheet("Dev_Investment")
    sheet_title(d, "Historical Development Investment & Remaining Launch Costs",
                "What has been spent to reach today, and what is still needed to launch commercially.")
    widths(d, {"A": 34, "B": 12, "C": 14, "D": 16, "E": 58})
    header(d, 4, ["Workstream", "Hours", "Rate (INR/h)", "Cost (INR)", "Notes"])

    dev_rows = [
        ("Architecture & technical leadership", 2400, 1500, "Multi-tenant model, pricing engine, snapshots"),
        ("Backend engineering", 3200, 1200, "23 models, 100+ endpoints, payments, S3, AI pipeline"),
        ("CRM frontend", 1900, 1100, "21 screens, permission matrix, mock backend, designer"),
        ("Android booth app", 1500, 1200, "XState flow, Skia compositing, CCAPI, IPP"),
        ("Electron booth app", 1600, 1200, "Hardware layer, spooler/CUPS, telemetry, IPC"),
        ("Public website & downloads", 700, 1000, "Marketing, pricing, checkout, guest portal"),
        ("Design & branding", 700, 1000, "Templates, UI system, brand assets"),
        ("QA & release engineering", 900, 800, "Test suites, hardware verification, releases"),
        ("DevOps & infrastructure", 500, 1400, "Vercel, Atlas, S3, monitoring, CI"),
        ("AI integration", 400, 1600, "Groq classification, FLUX generation, IP sanitisation"),
        ("Project & product management", 600, 900, "Specs, prioritisation, client feedback"),
    ]
    r = 5
    first = r
    for name, hrs, rate, why in dev_rows:
        put(d, r, 1, name, bold=True)
        put(d, r, 2, hrs, fmt=NUM, fill="input")
        put(d, r, 3, rate, fmt=NUM, fill="input")
        put(d, r, 4, f"=B{r}*C{r}", fmt=INR, fill="calc")
        put(d, r, 5, why, wrap=True)
        r += 1
    last = r - 1
    put(d, r, 1, "Total development labour", bold=True, fill="total")
    put(d, r, 2, f"=SUM(B{first}:B{last})", fmt=NUM, bold=True, fill="total")
    put(d, r, 3, "", fill="total")
    put(d, r, 4, f"=SUM(D{first}:D{last})", fmt=INR, bold=True, fill="total")
    put(d, r, 5, "Sunk cost to date (opportunity cost basis)", wrap=True, fill="total")
    labour_total = r
    r += 2

    section(d, r, "Direct cash spend to date", span=5)
    r += 1
    header(d, r, ["Item", "Months", "Monthly (INR)", "Total (INR)", "Notes"])
    r += 1
    cash_first = r
    cash_rows = [
        ("Cloud & infrastructure", 18, 18000, "Atlas, Vercel, S3, email/SMS"),
        ("AI API usage", 18, 6000, "Groq + Together during development"),
        ("Domains, SSL, tooling", 18, 3500, "Domains, GitHub, design tools"),
        ("Hardware prototypes", 1, 385000, "Printers, cameras, tablets, PC builds"),
        ("Payment gateway setup", 1, 12000, "KYC, integration testing"),
    ]
    for name, months, monthly, why in cash_rows:
        put(d, r, 1, name, bold=True)
        put(d, r, 2, months, fmt=NUM, fill="input")
        put(d, r, 3, monthly, fmt=INR, fill="input")
        put(d, r, 4, f"=B{r}*C{r}", fmt=INR, fill="calc")
        put(d, r, 5, why, wrap=True)
        r += 1
    cash_last = r - 1
    put(d, r, 1, "Total direct spend", bold=True, fill="total")
    put(d, r, 2, "", fill="total")
    put(d, r, 3, "", fill="total")
    put(d, r, 4, f"=SUM(D{cash_first}:D{cash_last})", fmt=INR, bold=True, fill="total")
    put(d, r, 5, "", fill="total")
    cash_total = r
    r += 2

    put(d, r, 1, "TOTAL INVESTED TO DATE", bold=True, fill="total")
    put(d, r, 4, f"=D{labour_total}+D{cash_total}", fmt=INR, bold=True, fill="total")
    invested = r
    r += 3

    section(d, r, "Remaining spend to reach commercial launch", span=5)
    r += 1
    header(d, r, ["Item", "Qty", "Unit cost (INR)", "Total (INR)", "Notes"])
    r += 1
    launch_first = r
    launch_rows = [
        ("Code-signing certificate (Windows OV)", 1, 42000, "Annual; required for clean installs"),
        ("Apple Developer Program", 1, 8500, "Annual"),
        ("Notarisation tooling / certificates", 1, 12000, "Apple Developer ID"),
        ("Google Play developer account", 1, 2200, "One-time"),
        ("Privacy policy & terms drafting", 1, 85000, "Counsel-reviewed for DPDP + GDPR"),
        ("Security review / light pen test", 1, 180000, "Before enterprise sales"),
        ("Trademark filing (India, 2 classes)", 1, 45000, "Name + logo"),
        ("Accounting & company compliance", 12, 12000, "Monthly retainer, first year"),
        ("Launch marketing budget", 1, 400000, "Content, ads, event presence"),
        ("Pilot hardware fleet (3 rigs)", 3, 235000, "Printer + camera + PC per rig"),
        ("Spare media (initial stock)", 1, 140000, "Rolls for pilots and demos"),
        ("Contingency (10%)", 1, 0, "Calculated below"),
    ]
    for name, qty, unit, why in launch_rows:
        put(d, r, 1, name, bold=True)
        put(d, r, 2, qty, fmt=NUM, fill="input")
        put(d, r, 3, unit, fmt=INR, fill="input")
        if name.startswith("Contingency"):
            put(d, r, 4, f"=ROUND(SUM(D{launch_first}:D{r-1})*0.1,0)", fmt=INR, fill="calc")
        else:
            put(d, r, 4, f"=B{r}*C{r}", fmt=INR, fill="calc")
        put(d, r, 5, why, wrap=True)
        r += 1
    launch_last = r - 1
    put(d, r, 1, "Total remaining to launch", bold=True, fill="total")
    put(d, r, 4, f"=SUM(D{launch_first}:D{launch_last})", fmt=INR, bold=True, fill="total")
    remaining = r
    r += 2
    put(d, r, 1, "TOTAL CAPITAL REQUIRED (invested + remaining)", bold=True, fill="total")
    put(d, r, 4, f"=D{invested}+D{remaining}", fmt=INR, bold=True, fill="total")
    d.freeze_panes = "A5"

    # ── Team costs ───────────────────────────────────────────────────
    t = wb.create_sheet("Team_Costs")
    sheet_title(t, "Team & Personnel Costs",
                "Headcount by phase. Monthly cost per role × headcount, plus employer overhead.")
    widths(t, {"A": 32, "B": 14, "C": 12, "D": 12, "E": 12, "F": 12, "G": 12, "H": 12, "I": 12, "J": 58})
    header(t, 4, ["Role", "Monthly (INR)", "Phase A\nM1–6", "Phase B\nM7–12", "Phase C\nM13–24",
                  "Phase D\nM25–36", "Phase A cost", "Phase B cost", "Phase C cost", "Phase D cost / notes"])

    team = [
        ("Founder / CEO", 200000, 1, 1, 1, 1, "Fundraising, sales, product direction"),
        ("Engineering Lead", 260000, 1, 1, 1, 1, "Architecture, reviews, releases"),
        ("Backend Engineer", 160000, 2, 2, 3, 4, "API, payments, storage, integrations"),
        ("Frontend Engineer", 140000, 1, 1, 1, 2, "CRM + website"),
        ("Mobile Engineer (Android)", 170000, 0, 1, 1, 1, "RN booth app, native modules"),
        ("Desktop Engineer (Electron)", 170000, 1, 1, 1, 1, "Windows/macOS kiosk, printer stack"),
        ("QA Engineer", 100000, 1, 1, 1, 2, "Manual + automated, hardware verification"),
        ("Designer", 130000, 0, 1, 1, 1, "Templates, UI, brand"),
        ("Product Manager", 200000, 0, 0, 0, 1, "Roadmap, specs, prioritisation"),
        ("DevOps / SRE", 210000, 0, 0, 1, 1, "Infra, monitoring, DR"),
        ("Sales / Partnerships", 110000, 0, 1, 2, 3, "Base only; commission in Marketing_Support"),
        ("Support Associate", 42000, 2, 3, 4, 5, "Ticket handling, onboarding"),
        ("Operations / Field", 50000, 1, 1, 1, 2, "Hardware fleet, event support"),
        ("Finance / Accounts", 70000, 1, 1, 1, 1, "Reconciliation, GST, payroll"),
    ]
    r = 5
    first = r
    for name, salary, pa, pb, pc, pd, why in team:
        put(t, r, 1, name, bold=True)
        put(t, r, 2, salary, fmt=INR, fill="input")
        put(t, r, 3, pa, fmt=NUM, fill="input")
        put(t, r, 4, pb, fmt=NUM, fill="input")
        put(t, r, 5, pc, fmt=NUM, fill="input")
        put(t, r, 6, pd, fmt=NUM, fill="input")
        put(t, r, 7, f"=$B{r}*C{r}", fmt=INR, fill="calc")
        put(t, r, 8, f"=$B{r}*D{r}", fmt=INR, fill="calc")
        put(t, r, 9, f"=$B{r}*E{r}", fmt=INR, fill="calc")
        put(t, r, 10, why, wrap=True)
        r += 1
    last = r - 1

    put(t, r, 1, "Headcount", bold=True, fill="total")
    put(t, r, 2, "", fill="total")
    for col, letter in zip(range(3, 7), ["C", "D", "E", "F"]):
        put(t, r, col, f"=SUM({letter}{first}:{letter}{last})", fmt=NUM, bold=True, fill="total")
    put(t, r, 7, "", fill="total")
    put(t, r, 8, "", fill="total")
    put(t, r, 9, "", fill="total")
    put(t, r, 10, "Total people per phase", fill="total")
    hc = r
    r += 1

    put(t, r, 1, "Base salary cost / month", bold=True, fill="total")
    put(t, r, 2, "", fill="total")
    put(t, r, 3, "", fill="total")
    put(t, r, 4, "", fill="total")
    put(t, r, 5, "", fill="total")
    put(t, r, 6, "", fill="total")
    put(t, r, 7, f"=SUM(G{first}:G{last})", fmt=INR, bold=True, fill="total")
    put(t, r, 8, f"=SUM(H{first}:H{last})", fmt=INR, bold=True, fill="total")
    put(t, r, 9, f"=SUM(I{first}:I{last})", fmt=INR, bold=True, fill="total")
    put(t, r, 10, "Add the Phase D total in column J below", wrap=True, fill="total")
    base = r
    r += 1

    put(t, r, 1, "Employer overhead (15%)", bold=True)
    put(t, r, 7, f"=G{base}*{OVERHEAD}", fmt=INR, fill="calc")
    put(t, r, 8, f"=H{base}*{OVERHEAD}", fmt=INR, fill="calc")
    put(t, r, 9, f"=I{base}*{OVERHEAD}", fmt=INR, fill="calc")
    put(t, r, 10, "Benefits, equipment, software seats", wrap=True)
    oh = r
    r += 1

    put(t, r, 1, "TOTAL TEAM COST / MONTH", bold=True, fill="total")
    put(t, r, 7, f"=G{base}+G{oh}", fmt=INR, bold=True, fill="total")
    put(t, r, 8, f"=H{base}+H{oh}", fmt=INR, bold=True, fill="total")
    put(t, r, 9, f"=I{base}+I{oh}", fmt=INR, bold=True, fill="total")
    put(t, r, 10, "Phase D is calculated on the Phase D sheet of the forecast", wrap=True, fill="total")
    total_row = r

    # Phase D cost column (J is notes, so put D cost in a helper area)
    r += 2
    section(t, r, "Phase D detail (months 25–36)", span=4)
    r += 1
    put(t, r, 1, "Phase D headcount", bold=True)
    put(t, r, 2, f"=SUM(F{first}:F{last})", fmt=NUM)
    r += 1
    put(t, r, 1, "Phase D total monthly cost", bold=True, fill="total")
    put(t, r, 2, f"=SUMPRODUCT($B${first}:$B${last},F{first}:F{last})*(1+{OVERHEAD})", fmt=INR, bold=True, fill="total")
    phase_d = f"B{r}"
    t.freeze_panes = "A5"

    # ── Infrastructure ───────────────────────────────────────────────
    inf = wb.create_sheet("Infrastructure")
    sheet_title(inf, "Infrastructure & Cloud Costs",
                "Monthly run-rate by growth stage. Aligned with business/SCALABILITY_PLAN.md.")
    widths(inf, {"A": 34, "B": 12, "C": 16, "D": 16, "E": 16, "F": 16, "G": 58})
    header(inf, 4, ["Service", "Unit", "Stage 1\n10K users", "Stage 2\n100K", "Stage 3\n1M", "Stage 4\n10M", "Configuration / notes"])

    infra_rows = [
        ("Vercel / edge & compute", "USD/mo", 250, 2500, 18000, 120000, "Functions, edges, bandwidth"),
        ("MongoDB Atlas", "USD/mo", 450, 4500, 35000, 250000, "M40 → M60 → sharded M80+ → multi-region"),
        ("AWS S3 storage", "USD/mo", 620, 5800, 42000, 380000, "Lifecycle tiering assumed at stages 2+"),
        ("CDN / egress", "USD/mo", 280, 5200, 45000, 320000, "CloudFront; variants reduce payload"),
        ("Redis / cache", "USD/mo", 0, 600, 3000, 12000, "Hot reads: plans, gallery page 1"),
        ("Queues / streaming / workers", "USD/mo", 0, 1000, 11000, 60000, "SQS/BullMQ → Kafka → worker fleet"),
        ("Monitoring, logs, tracing", "USD/mo", 100, 800, 6000, 40000, "Sentry/Logtail/Datadog class"),
        ("Email + SMS", "USD/mo", 150, 1200, 8000, 50000, "SendGrid + Twilio"),
        ("AI providers", "USD/mo", 250, 2000, 15000, 100000, "Groq + Together FLUX, credit-capped"),
        ("Data warehouse", "USD/mo", 0, 0, 3000, 30000, "Analytics off the OLTP database"),
        ("Domains, SSL, secrets, misc", "USD/mo", 100, 500, 6000, 20000, "Registrar, vault, certificates"),
    ]
    r = 5
    first = r
    for name, unit, s1, s2, s3, s4, why in infra_rows:
        put(inf, r, 1, name, bold=True)
        put(inf, r, 2, unit)
        for col, val in zip(range(3, 7), [s1, s2, s3, s4]):
            put(inf, r, col, val, fmt=USD, fill="input")
        put(inf, r, 7, why, wrap=True)
        r += 1
    last = r - 1

    put(inf, r, 1, "TOTAL / month (USD)", bold=True, fill="total")
    put(inf, r, 2, "", fill="total")
    for col in range(3, 7):
        L = get_column_letter(col)
        put(inf, r, col, f"=SUM({L}{first}:{L}{last})", fmt=USD, bold=True, fill="total")
    put(inf, r, 7, "", fill="total")
    total_usd = r
    r += 1

    put(inf, r, 1, "TOTAL / month (INR)", bold=True, fill="total")
    put(inf, r, 2, "", fill="total")
    for col in range(3, 7):
        L = get_column_letter(col)
        put(inf, r, col, f"={L}{total_usd}*{FX}", fmt=INR, bold=True, fill="total")
    put(inf, r, 7, "", fill="total")
    total_inr = r
    r += 1

    put(inf, r, 1, "TOTAL / year (INR)", bold=True, fill="total")
    put(inf, r, 2, "", fill="total")
    for col in range(3, 7):
        L = get_column_letter(col)
        put(inf, r, col, f"={L}{total_inr}*12", fmt=INR, bold=True, fill="total")
    put(inf, r, 7, "", fill="total")
    total_year = r
    r += 2

    section(inf, r, "Volume drivers used for the per-session figures", span=7)
    r += 1
    put(inf, r, 1, "Sessions / month", bold=True)
    for col, val in zip(range(3, 7), [490909, 4909091, 49090909, 490909091]):
        put(inf, r, col, val, fmt=NUM, fill="input")
    sessions_row = r
    r += 1
    put(inf, r, 1, "Infrastructure cost / session (INR)", bold=True, fill="total")
    for col in range(3, 7):
        L = get_column_letter(col)
        put(inf, r, col, f"={L}{total_inr}/{L}{sessions_row}", fmt=INR2, bold=True, fill="total")
    r += 1
    put(inf, r, 1, "Infrastructure cost / session (USD)", bold=True)
    for col in range(3, 7):
        L = get_column_letter(col)
        put(inf, r, col, f"={L}{total_usd}/{L}{sessions_row}", fmt=USD2)
    inf.freeze_panes = "A5"

    # ── Tools & subscriptions ────────────────────────────────────────
    tools = wb.create_sheet("Tools_Subscriptions")
    sheet_title(tools, "Tools, Subscriptions & One-off Purchases",
                "Recurring software, licences and capital items. Renewal owner is in HANDOVER_REGISTER.xlsx.")
    widths(tools, {"A": 36, "B": 14, "C": 14, "D": 14, "E": 14, "F": 48})
    header(tools, 4, ["Item", "Category", "Cost", "Billing", "Annual (INR)", "Notes"])

    tool_rows = [
        ("GitHub Team", "Development", 3200, "monthly", "Repos, Actions, secrets"),
        ("Vercel Pro (4 projects)", "Hosting", 17000, "monthly", "Includes team seats"),
        ("MongoDB Atlas", "Database", 38000, "monthly", "Stage 1 tier"),
        ("AWS (S3 + CloudFront)", "Storage", 52000, "monthly", "Stage 1 estimate"),
        ("Cloudflare (DNS/WAF)", "Network", 1700, "monthly", "Pro plan"),
        ("Sentry", "Monitoring", 4200, "monthly", "Error tracking"),
        ("Logtail / Better Stack", "Monitoring", 2500, "monthly", "Logs + uptime"),
        ("SendGrid", "Comms", 3400, "monthly", "Transactional email"),
        ("Twilio", "Comms", 8400, "monthly", "SMS, India DLT"),
        ("Razorpay", "Payments", 0, "per-transaction", "MDR modelled in Payments_Fees"),
        ("Google Workspace (10 seats)", "Productivity", 12000, "monthly", "Email + docs"),
        ("Figma", "Design", 3800, "monthly", "Team plan"),
        ("Windows code-signing certificate", "Legal/Signing", 42000, "annual", "SmartScreen reputation"),
        ("Apple Developer Program", "Legal/Signing", 8500, "annual", "macOS distribution"),
        ("Google Play developer account", "Legal/Signing", 2200, "one-time", "Android distribution"),
        ("DNP CyStat / printer drivers", "Hardware", 0, "bundled", "Ships with vendor drivers"),
        ("Accountant retainer", "Finance", 12000, "monthly", "GST, payroll, filings"),
        ("Legal retainer", "Legal/Signing", 15000, "monthly", "Contracts, privacy, disputes"),
        ("D&O / liability insurance", "Legal/Signing", 18000, "annual", "Recommended before enterprise"),
        ("Domain renewals (3)", "Network", 4500, "annual", "happypix.in + subdomains"),
    ]
    r = 5
    first = r
    for name, cat, cost, billing, why in tool_rows:
        put(tools, r, 1, name, bold=True)
        put(tools, r, 2, cat)
        put(tools, r, 3, cost, fmt=INR, fill="input")
        put(tools, r, 4, billing)
        if billing == "monthly":
            put(tools, r, 5, f"=C{r}*12", fmt=INR, fill="calc")
        elif billing in ("annual", "one-time"):
            put(tools, r, 5, f"=C{r}", fmt=INR, fill="calc")
        else:
            put(tools, r, 5, 0, fmt=INR, fill="calc")
        put(tools, r, 6, why, wrap=True)
        r += 1
    last = r - 1
    put(tools, r, 1, "TOTAL", bold=True, fill="total")
    put(tools, r, 5, f"=SUM(E{first}:E{last})", fmt=INR, bold=True, fill="total")
    put(tools, r, 6, "Annualised run-rate (excludes transaction-based fees)", wrap=True, fill="total")
    tools_total = r
    tools.freeze_panes = "A5"

    # ── Payments, fees, compliance ───────────────────────────────────
    pay = wb.create_sheet("Payments_Fees")
    sheet_title(pay, "Payments, Fees, Taxes & Compliance Costs",
                "Transaction economics and the recurring cost of being a compliant business.")
    widths(pay, {"A": 38, "B": 16, "C": 16, "D": 16, "E": 52})
    header(pay, 4, ["Item", "Basis", "Rate / amount", "Annual impact (INR)", "Notes"])

    r = 5
    put(pay, r, 1, "Subscription revenue (year 1)", bold=True)
    put(pay, r, 2, "INR")
    put(pay, r, 3, 12000000, fmt=INR, fill="input")
    put(pay, r, 4, f"=C{r}", fmt=INR, fill="calc")
    rev_row = r
    r += 1
    put(pay, r, 1, "Payment gateway MDR (blended)", bold=True)
    put(pay, r, 2, "% of revenue")
    put(pay, r, 3, f"={MDR_CARD}*{CARD_SHARE}+{MDR_UPI}*(1-{CARD_SHARE})", fmt=PCT, fill="calc")
    put(pay, r, 4, f"=C{rev_row}*C{r}", fmt=INR, fill="calc")
    put(pay, r, 5, "Cards 2%, UPI 0% — weighted by card share", wrap=True)
    mdr_row = r
    r += 1
    put(pay, r, 1, "Refunds & goodwill", bold=True)
    put(pay, r, 2, "% of revenue")
    put(pay, r, 3, REFUND[12:] if False else 0.015, fmt=PCT, fill="input")
    put(pay, r, 4, f"=C{rev_row}*C{r}", fmt=INR, fill="calc")
    put(pay, r, 5, "1.5% provision for refunds and disputes", wrap=True)
    refund_row = r
    r += 1
    put(pay, r, 1, "GST on subscriptions (collected, not cost)", bold=True)
    put(pay, r, 2, "% of revenue")
    put(pay, r, 3, 0.18, fmt=PCT, fill="input")
    put(pay, r, 4, f"=C{rev_row}*C{r}", fmt=INR, fill="calc")
    put(pay, r, 5, "Pass-through liability; shown for completeness", wrap=True)
    r += 1
    put(pay, r, 1, "Chargeback fees", bold=True)
    put(pay, r, 2, "count × fee")
    put(pay, r, 3, 24, fmt=NUM, fill="input")
    put(pay, r, 4, f"=C{r}*{cell['Chargeback fee']}", fmt=INR, fill="calc")
    put(pay, r, 5, "Estimated annual dispute count × ₹500", wrap=True)
    cb_row = r
    r += 2

    section(pay, r, "Compliance & professional costs", span=5)
    r += 1
    header(pay, r, ["Item", "Frequency", "Cost per period", "Annual (INR)", "Notes"])
    r += 1
    comp_first = r
    comp = [
        ("Statutory audit / CA retainer", "monthly", 12000, "GST, TDS, payroll, filings"),
        ("Company secretarial", "annual", 25000, "ROC filings, board minutes"),
        ("Privacy policy & ToS updates", "annual", 40000, "Counsel review"),
        ("Security review", "annual", 180000, "Annual light pen test"),
        ("Insurance (liability + cyber)", "annual", 55000, "Recommended for enterprise deals"),
        ("Trademark renewals (amortised)", "annual", 9000, "10-year filings amortised"),
        ("PCI self-assessment support", "annual", 30000, "Questionnaire + evidence"),
        ("Data protection officer (part-time)", "monthly", 25000, "If scale requires it"),
    ]
    for name, freq, cost, why in comp:
        put(pay, r, 1, name, bold=True)
        put(pay, r, 2, freq)
        put(pay, r, 3, cost, fmt=INR, fill="input")
        put(pay, r, 4, f"=C{r}*12" if freq == "monthly" else f"=C{r}", fmt=INR, fill="calc")
        put(pay, r, 5, why, wrap=True)
        r += 1
    comp_last = r - 1
    put(pay, r, 1, "Total compliance", bold=True, fill="total")
    put(pay, r, 4, f"=SUM(D{comp_first}:D{comp_last})", fmt=INR, bold=True, fill="total")
    comp_total = r
    r += 2

    put(pay, r, 1, "TOTAL PAYMENT + COMPLIANCE COST", bold=True, fill="total")
    put(pay, r, 4, f"=D{mdr_row}+D{refund_row}+D{cb_row}+D{comp_total}", fmt=INR, bold=True, fill="total")
    r += 1
    note(pay, r, 1, "GST collected is excluded from the total — it is a pass-through liability, not a cost.", span=5)
    pay.freeze_panes = "A5"

    # ── Marketing & support ──────────────────────────────────────────
    ms = wb.create_sheet("Marketing_Support")
    sheet_title(ms, "Marketing, Sales, Support & Hardware Replacement",
                "The costs that actually decide whether a photobooth SaaS makes money.")
    widths(ms, {"A": 40, "B": 16, "C": 16, "D": 16, "E": 52})
    header(ms, 4, ["Item", "Driver", "Unit cost (INR)", "Annual (INR)", "Notes"])

    r = 5
    put(ms, r, 1, "New organizations per year", bold=True)
    put(ms, r, 2, "target")
    put(ms, r, 3, 420, fmt=NUM, fill="input")
    new_orgs = r
    r += 1
    put(ms, r, 1, "Blended CAC", bold=True)
    put(ms, r, 2, "per org")
    put(ms, r, 3, 6000, fmt=INR, fill="input")
    put(ms, r, 4, f"=C{new_orgs}*C{r}", fmt=INR, fill="calc")
    put(ms, r, 5, "Content, ads, events, partner commission", wrap=True)
    r += 1
    put(ms, r, 1, "Marketing tooling & content", bold=True)
    put(ms, r, 2, "monthly")
    put(ms, r, 3, 35000, fmt=INR, fill="input")
    put(ms, r, 4, f"=C{r}*12", fmt=INR, fill="calc")
    put(ms, r, 5, "CRM for sales, email, design, video", wrap=True)
    r += 1
    put(ms, r, 1, "Event presence (trade shows, showcases)", bold=True)
    put(ms, r, 2, "annual")
    put(ms, r, 3, 350000, fmt=INR, fill="input")
    put(ms, r, 4, f"=C{r}", fmt=INR, fill="calc")
    put(ms, r, 5, "3–4 showcases per year", wrap=True)
    r += 1
    put(ms, r, 1, "Support cost per organization", bold=True)
    put(ms, r, 2, "monthly")
    put(ms, r, 3, 180, fmt=INR, fill="input")
    put(ms, r, 4, f"=C{r}*12*900", fmt=INR, fill="calc")
    put(ms, r, 5, "Loaded support cost × 900 average active orgs", wrap=True)
    r += 1
    put(ms, r, 1, "Onboarding & training (per new org)", bold=True)
    put(ms, r, 2, "per org")
    put(ms, r, 3, 900, fmt=INR, fill="input")
    put(ms, r, 4, f"=C{new_orgs}*C{r}", fmt=INR, fill="calc")
    put(ms, r, 5, "Setup call, template help, hardware guidance", wrap=True)
    r += 1
    put(ms, r, 1, "Hardware replacement provision", bold=True)
    put(ms, r, 2, "% of fleet value")
    put(ms, r, 3, 0.06, fmt=PCT, fill="input")
    put(ms, r, 4, f"=3800000*C{r}", fmt=INR, fill="calc")
    put(ms, r, 5, "6% of ₹38L demo/pilot fleet value per year", wrap=True)
    r += 1
    put(ms, r, 1, "Spare media stock", bold=True)
    put(ms, r, 2, "annual")
    put(ms, r, 3, 140000, fmt=INR, fill="input")
    put(ms, r, 4, f"=C{r}", fmt=INR, fill="calc")
    put(ms, r, 5, "Rolls for demos, pilots and replacements", wrap=True)
    r += 1
    subtotal_row = r
    put(ms, r, 1, "Subtotal", bold=True, fill="total")
    put(ms, r, 4, f"=SUM(D5:D{r-1})", fmt=INR, bold=True, fill="total")
    r += 1
    put(ms, r, 1, "Contingency (8%)", bold=True)
    put(ms, r, 4, f"=D{subtotal_row}*{CONTINGENCY}", fmt=INR, fill="calc")
    r += 1
    put(ms, r, 1, "TOTAL", bold=True, fill="total")
    put(ms, r, 4, f"=D{subtotal_row}*1.08", fmt=INR, bold=True, fill="total")
    ms_total = f"D{r}"
    ms.freeze_panes = "A5"

    # ── Monthly forecast (36 months) ─────────────────────────────────
    f = wb.create_sheet("Monthly_Forecast")
    sheet_title(f, "48-Month Forecast (P&L, Cash & Runway)",
                "New orgs, churn, funding and cash are inputs (yellow). Every other line is calculated.")
    widths(f, {"A": 30, "B": 12})
    for i in range(3, 3 + 48):
        f.column_dimensions[get_column_letter(i)].width = 11.5

    header(f, 4, ["Line item", "Unit"] + [f"M{i}" for i in range(1, 49)])

    labels = [
        ("New orgs", "orgs", "input"),
        ("Churn %", "%", "input"),
        ("Active orgs (end)", "orgs", None),
        ("ARPU", "INR", None),
        ("Subscription revenue", "INR", None),
        ("Add-on revenue", "INR", None),
        ("TOTAL REVENUE", "INR", "total"),
        ("Infrastructure", "INR", None),
        ("Payment fees", "INR", None),
        ("Support tooling", "INR", None),
        ("GROSS PROFIT", "INR", "total"),
        ("Team cost", "INR", None),
        ("Tools & subscriptions", "INR", None),
        ("Marketing & CAC", "INR", None),
        ("Compliance & legal", "INR", None),
        ("TOTAL OPEX", "INR", "total"),
        ("EBITDA", "INR", "total"),
        ("Funding inflow", "INR", "input"),
        ("Cash balance", "INR", "total"),
        ("Runway (months)", "months", None),
    ]

    rows = {}
    r = 5
    for label, unit, kind in labels:
        put(f, r, 1, label, bold=bool(kind), fill=kind if kind in ("total",) else None)
        put(f, r, 2, unit, fill=kind if kind == "total" else None)
        rows[label] = r
        r += 1

    # ── growth inputs ──
    for m in range(1, 49):
        new_orgs = round(28 + (m - 1) * 5.5)
        put(f, rows["New orgs"], 2 + m, new_orgs, fmt=NUM, fill="input")
        churn = max(0.019, round(0.034 - (m - 1) * 0.00032, 5))
        put(f, rows["Churn %"], 2 + m, churn, fmt=PCT, fill="input")

    # ── funding inputs ──
    for m in range(1, 49):
        funding = 0
        if m == 1:
            funding = 50000000      # seed round
        elif m == 20:
            funding = 25000000      # bridge
        put(f, rows["Funding inflow"], 2 + m, funding, fmt=INR, fill="input")

    # ── calculated lines ──
    phase_a = f"Team_Costs!$G${total_row}"
    phase_b = f"Team_Costs!$H${total_row}"
    phase_c = f"Team_Costs!$I${total_row}"
    phase_d = f"Team_Costs!{phase_d}"

    for m in range(1, 49):
        col = get_column_letter(2 + m)

        if m == 1:
            put(f, rows["Active orgs (end)"], 3,
                f"=C{rows['New orgs']}*(1-C{rows['Churn %']})", fmt=NUM, fill="calc")
        else:
            prev = get_column_letter(1 + m)
            put(f, rows["Active orgs (end)"], 2 + m,
                f"={prev}{rows['Active orgs (end)']}*(1-{col}{rows['Churn %']})+{col}{rows['New orgs']}",
                fmt=NUM, fill="calc")

        put(f, rows["ARPU"], 2 + m, f"={ARPU}*(1+0.0018*({m}-1))", fmt=INR, fill="calc")
        put(f, rows["Subscription revenue"], 2 + m,
            f"={col}{rows['Active orgs (end)']}*{col}{rows['ARPU']}", fmt=INR, fill="calc")
        put(f, rows["Add-on revenue"], 2 + m,
            f"={col}{rows['Active orgs (end)']}*{ADDON_ATTACH}*{ADDON_PRICE}", fmt=INR, fill="calc")
        put(f, rows["TOTAL REVENUE"], 2 + m,
            f"={col}{rows['Subscription revenue']}+{col}{rows['Add-on revenue']}",
            fmt=INR, bold=True, fill="total")

        put(f, rows["Infrastructure"], 2 + m,
            f"=60000+{col}{rows['Active orgs (end)']}*28", fmt=INR, fill="calc")
        put(f, rows["Payment fees"], 2 + m,
            f"={col}{rows['TOTAL REVENUE']}*({MDR_CARD}*{CARD_SHARE}+{MDR_UPI}*(1-{CARD_SHARE})+{REFUND})",
            fmt=INR, fill="calc")
        put(f, rows["Support tooling"], 2 + m,
            f"={col}{rows['Active orgs (end)']}*{SUPPORT_ORG}", fmt=INR, fill="calc")
        put(f, rows["GROSS PROFIT"], 2 + m,
            f"={col}{rows['TOTAL REVENUE']}-{col}{rows['Infrastructure']}-{col}{rows['Payment fees']}-{col}{rows['Support tooling']}",
            fmt=INR, bold=True, fill="total")

        team = phase_a if m <= 6 else phase_b if m <= 12 else phase_c if m <= 24 else phase_d
        put(f, rows["Team cost"], 2 + m, f"={team}", fmt=INR, fill="calc")
        put(f, rows["Tools & subscriptions"], 2 + m,
            f"=Tools_Subscriptions!$E${tools_total}/12", fmt=INR, fill="calc")
        put(f, rows["Marketing & CAC"], 2 + m,
            f"={col}{rows['New orgs']}*{cell['CAC (blended)']}+100000", fmt=INR, fill="calc")
        put(f, rows["Compliance & legal"], 2 + m,
            f"=Payments_Fees!$D${comp_total}/12", fmt=INR, fill="calc")
        put(f, rows["TOTAL OPEX"], 2 + m,
            f"=SUM({col}{rows['Team cost']}:{col}{rows['Compliance & legal']})",
            fmt=INR, bold=True, fill="total")
        put(f, rows["EBITDA"], 2 + m,
            f"={col}{rows['GROSS PROFIT']}-{col}{rows['TOTAL OPEX']}",
            fmt=INR, bold=True, fill="total")

        opening_ref = f"{cell['Opening cash']}"
        if m == 1:
            put(f, rows["Cash balance"], 3,
                f"={opening_ref}+C{rows['EBITDA']}+C{rows['Funding inflow']}",
                fmt=INR, bold=True, fill="total")
        else:
            prev = get_column_letter(1 + m)
            put(f, rows["Cash balance"], 2 + m,
                f"={prev}{rows['Cash balance']}+{col}{rows['EBITDA']}+{col}{rows['Funding inflow']}",
                fmt=INR, bold=True, fill="total")

        put(f, rows["Runway (months)"], 2 + m,
            f'=IF({col}{rows["EBITDA"]}>=0,"profitable",'
            f'IF({col}{rows["Cash balance"]}<=0,"funding needed",'
            f'{col}{rows["Cash balance"]}/-{col}{rows["EBITDA"]}))',
            fmt=NUM2, fill="calc")

    r = rows["Runway (months)"] + 2
    note(f, r, 1, "Yellow = editable input. Funding plan: ₹1 Cr founder capital at M0, ₹5 Cr seed at M1, "
                  "₹2.5 Cr bridge at M20. Edit the Funding inflow row to model a different path.", span=10)
    r += 1
    note(f, r, 1, "Support tooling (₹55/org) excludes support salaries, which are already inside Team cost — "
                  "counting both would double-count the same rupees.", span=10)
    r += 1
    note(f, r, 1, "Churn and ARPU are modelled explicitly here (rows 6 and 8) rather than taken from the Assumptions "
                  "sheet, because retention improves and prices rise as the customer base matures.", span=10)
    f.freeze_panes = "C5"

    # ── Summary dashboard ──
    su = wb.create_sheet("Summary")
    sheet_title(su, "Model Summary", "Key outputs. All values are formulas over Monthly_Forecast.")
    widths(su, {"A": 40, "B": 20, "C": 52})
    header(su, 4, ["Metric", "Value", "How to read it"])

    def col_of(m):
        return get_column_letter(2 + m)

    rev = rows["TOTAL REVENUE"]; ebi = rows["EBITDA"]; csh = rows["Cash balance"]
    orgs = rows["Active orgs (end)"]; fund = rows["Funding inflow"]

    MF = "Monthly_Forecast!"
    metrics = [
        ("Total funding raised", f"=SUM({MF}C{fund}:AX{fund})", INR,
         "Founder capital + seed + bridge"),
        ("ARR at month 12", f"={MF}{col_of(12)}{rev}*12", INR, "Annualised run-rate, year 1 exit"),
        ("ARR at month 24", f"={MF}{col_of(24)}{rev}*12", INR, "Annualised run-rate, year 2 exit"),
        ("ARR at month 36", f"={MF}{col_of(36)}{rev}*12", INR, "Annualised run-rate, year 3 exit"),
        ("ARR at month 48", f"={MF}{col_of(48)}{rev}*12", INR, "Annualised run-rate, year 4 exit"),
        ("Paying organizations at month 48", f"={MF}{col_of(48)}{orgs}", NUM, "≈ 2.2 registered users each"),
        ("Monthly revenue at month 48", f"={MF}{col_of(48)}{rev}", INR, "One month, not annualised"),
        ("Monthly EBITDA at month 48", f"={MF}{col_of(48)}{ebi}", INR, "Positive = self-funding"),
        ("Profitable months in 48", f'=COUNTIF({MF}C{ebi}:AX{ebi},">0")', NUM,
         "First positive month marks break-even"),
        ("Cumulative EBITDA (48 months)", f"=SUM({MF}C{ebi}:AX{ebi})", INR, "Total cash consumed by operations"),
        ("Lowest cash balance", f"=MIN({MF}C{csh}:AX{csh})", INR, "Must stay above zero"),
        ("Cash at month 48", f"={MF}{col_of(48)}{csh}", INR, "Ending liquidity"),
        ("Peak monthly burn", f"=MIN({MF}C{ebi}:AX{ebi})", INR, "Worst single month"),
        ("Total invested to date + remaining to launch", "=Dev_Investment!D27+Dev_Investment!D44", INR,
         "From the Dev_Investment sheet"),
    ]
    r = 5
    for name, formula, fmt, why in metrics:
        put(su, r, 1, name, bold=True)
        put(su, r, 2, formula, fmt=fmt, fill="calc")
        put(su, r, 3, why, wrap=True)
        r += 1

    r += 1
    note(su, r, 1, "If any metric looks implausible, change the inputs on Monthly_Forecast (growth, churn, funding) "
                   "or Assumptions (ARPU, costs) — never overwrite the calculated rows.", span=3)
    su.freeze_panes = "A5"


    # ── Scenarios ────────────────────────────────────────────────────
    sc = wb.create_sheet("Scenarios")
    sheet_title(sc, "Growth Scenarios — 10K to 10M Users",
                "Annualised snapshot at each stage. Metrics mirror business/SCALABILITY_PLAN.md.")
    widths(sc, {"A": 42, "B": 18, "C": 18, "D": 18, "E": 18})

    header(sc, 4, ["Metric", "10K users", "100K users", "1M users", "10M users"])

    # Inputs first, then formulas, so the table stays internally consistent.
    put(sc, 5, 1, "Registered users", bold=True)
    for i, val in enumerate([10000, 100000, 1000000, 10000000]):
        put(sc, 5, 2 + i, val, fmt=NUM, fill="input")
    put(sc, 6, 1, "Organizations", bold=True)
    for i in range(4):
        L = get_column_letter(2 + i)
        put(sc, 6, 2 + i, f"={L}5/{cell['Users per organization']}", fmt=NUM, fill="calc")
    put(sc, 7, 1, "ARPU (INR/month)", bold=True)
    for i in range(4):
        put(sc, 7, 2 + i, f"={ARPU}*1.08", fmt=INR, fill="calc")
    put(sc, 8, 1, "Monthly revenue", bold=True)
    for i in range(4):
        L = get_column_letter(2 + i)
        put(sc, 8, 2 + i, f"={L}6*{L}7", fmt=INR, fill="calc")
    put(sc, 9, 1, "Annual revenue (ARR)", bold=True)
    for i in range(4):
        L = get_column_letter(2 + i)
        put(sc, 9, 2 + i, f"={L}8*12", fmt=INR, fill="calc")
    put(sc, 10, 1, "Annual infrastructure", bold=True)
    for i, val in enumerate([2217600, 22680000, 173376000, 1380960000]):
        put(sc, 10, 2 + i, val, fmt=INR, fill="input")
    put(sc, 11, 1, "Annual support tooling", bold=True)
    for i in range(4):
        L = get_column_letter(2 + i)
        put(sc, 11, 2 + i, f"={L}6*{SUPPORT_ORG}*12", fmt=INR, fill="calc")
    put(sc, 12, 1, "Annual team cost", bold=True)
    for i, val in enumerate([44000000, 90000000, 350000000, 1100000000]):
        put(sc, 12, 2 + i, val, fmt=INR, fill="input")
    put(sc, 13, 1, "Annual marketing & sales", bold=True)
    for i, val in enumerate([10000000, 60000000, 1900000000, 26000000000]):
        put(sc, 13, 2 + i, val, fmt=INR, fill="input")
    put(sc, 14, 1, "Annual EBITDA", bold=True, fill="total")
    for i in range(4):
        L = get_column_letter(2 + i)
        put(sc, 14, 2 + i, f"={L}9-{L}10-{L}11-{L}12-{L}13", fmt=INR, bold=True, fill="total")
    put(sc, 15, 1, "EBITDA margin", bold=True)
    for i in range(4):
        L = get_column_letter(2 + i)
        put(sc, 15, 2 + i, f"={L}14/{L}9", fmt=PCT)
    put(sc, 16, 1, "Infrastructure as % of revenue", bold=True)
    for i in range(4):
        L = get_column_letter(2 + i)
        put(sc, 16, 2 + i, f"={L}10/{L}9", fmt=PCT)
    put(sc, 17, 1, "Sessions / month", bold=True)
    for i, val in enumerate([490909, 4909091, 49090909, 490909091]):
        put(sc, 17, 2 + i, val, fmt=NUM, fill="input")
    put(sc, 18, 1, "Infrastructure cost / session (INR)", bold=True)
    for i in range(4):
        L = get_column_letter(2 + i)
        put(sc, 18, 2 + i, f"={L}10/12/{L}17", fmt=INR2)

    r += 2
    section(sc, r, "What must change to reach each stage", span=5)
    r += 1
    header(sc, r, ["Stage", "Database", "Storage", "Compute", "Key risk"])
    r += 1
    stage_rows = [
        ("10K users", "M30–M40 single region", "Lifecycle rules, ~30 TB", "Serverless", "Storage cost discipline"),
        ("100K users", "M60 + cross-region replica", "CDN + variants, ~300 TB", "Serverless + workers", "Seasonal peaks"),
        ("1M users", "Sharded M80+ multi-region", "Tiered to archive, ~3 PB", "Containers + edge", "Cost of egress"),
        ("10M users", "Sharded, region-pinned", "~30 PB, aggressive retention", "Multi-region active-active", "Retention economics"),
    ]
    for row in stage_rows:
        for i, val in enumerate(row):
            put(sc, r, 1 + i, val, wrap=True)
        r += 1
    r += 2
    note(sc, r, 1, "Read the 1M and 10M columns as arithmetic, not as a forecast. The addressable market for "
                   "professional photo-booth operators in India + GCC + SEA is realistically 50,000–100,000 "
                   "organizations, so Stage 2 is the practical ceiling and Stage 3–4 require new geographies "
                   "or adjacent products. They are included because investors ask, not because we plan to reach them.",
         span=5)
    sc.freeze_panes = "B5"

    # ── Actual vs forecast ───────────────────────────────────────────
    av = wb.create_sheet("Actual_vs_Forecast")
    sheet_title(av, "Actual vs Forecast",
                "Fill the Actual column monthly. Variance updates automatically.")
    widths(av, {"A": 14, "B": 18, "C": 18, "D": 16, "E": 14, "F": 52})
    header(av, 4, ["Month", "Forecast revenue", "Actual revenue", "Variance", "Variance %", "Notes"])
    r = 5
    for m in range(1, 13):
        put(av, r, 1, f"M{m}", bold=True)
        put(av, r, 2, f"=Monthly_Forecast!{get_column_letter(2+m)}{rows['TOTAL REVENUE']}", fmt=INR, fill="calc")
        put(av, r, 3, None, fmt=INR, fill="input")
        put(av, r, 4, f"=IF(C{r}=\"\",\"\",C{r}-B{r})", fmt=INR, fill="calc")
        put(av, r, 5, f"=IF(C{r}=\"\",\"\",(C{r}-B{r})/MAX(1,B{r}))", fmt=PCT, fill="calc")
        put(av, r, 6, "", wrap=True, fill="input")
        r += 1
    av.freeze_panes = "A5"

    # order sheets
    order = ["README", "Summary", "Assumptions", "Dev_Investment", "Team_Costs", "Infrastructure",
             "Tools_Subscriptions", "Payments_Fees", "Marketing_Support",
             "Monthly_Forecast", "Scenarios", "Actual_vs_Forecast"]
    wb._sheets = [wb[n] for n in order if n in wb.sheetnames]

    readme(wb, [
        ("h", "HappyPix — Complete Expenditure & Financial Model"),
        ("s", "Companion to business/SCALABILITY_PLAN.md and business/UNIT_ECONOMICS.xlsx"),
        ("", ""),
        ("b", "How to use this workbook"),
        ("", "1. Open the Assumptions sheet. Every yellow cell is editable."),
        ("", "2. Monthly_Forecast recalculates 48 months of P&L, cash and runway."),
        ("", "3. Team_Costs drives the salary lines; change headcount there, not in the forecast."),
        ("", "4. Infrastructure holds the four growth-stage run-rates (USD), converted at the FX rate."),
        ("", "5. Actual_vs_Forecast is for monthly bookkeeping — paste real revenue and read the variance."),
        ("", ""),
        ("b", "Colour convention"),
        ("", "Yellow = input you may change.  Grey = formula.  Green = total or key result."),
        ("", ""),
        ("b", "Workbook map"),
        ("", "Assumptions — FX, ARPU, churn, fees, CAC, overheads."),
        ("", "Dev_Investment — what has been spent to date, and remaining launch costs."),
        ("", "Team_Costs — 15 roles × 4 hiring phases, with employer overhead."),
        ("", "Infrastructure — cloud run-rate at 10K / 100K / 1M / 10M users."),
        ("", "Tools_Subscriptions — SaaS, signing, legal, insurance, domains."),
        ("", "Payments_Fees — MDR, refunds, chargebacks, GST, compliance."),
        ("", "Marketing_Support — CAC, onboarding, support, hardware replacement."),
        ("", "Summary — funding, ARR at each year end, break-even and ending cash."),
        ("", "Monthly_Forecast — 48-month P&L, EBITDA, cash and runway with an explicit funding row."),
        ("", "Scenarios — annualised view at four orders of magnitude."),
        ("", "Actual_vs_Forecast — monthly tracking template."),
        ("", ""),
        ("b", "What this model is NOT"),
        ("", "It is a planning tool, not audited accounts, not a valuation and not tax advice."),
        ("", "Costs marked as estimates are ±40%. Salary figures are planning bands for Indian metros."),
        ("", "GST collected from customers is a pass-through liability and is excluded from revenue and cost totals."),
        ("", ""),
        ("b", "Regenerating"),
        ("", "python3 business/scripts/build_workbooks.py  (requires openpyxl)"),
    ], "Financial Model — README", "HappyPix V2 · prepared 2026-10-23 · INR unless stated · figures are planning estimates")

    finish(wb, os.path.join(OUT_DIR, "FINANCIAL_MODEL.xlsx"))


# ══════════════════════════════════════════════════════════════════════
# 2. UNIT ECONOMICS
# ══════════════════════════════════════════════════════════════════════
def build_unit_economics():
    wb = Workbook()
    wb.remove(wb.active)

    # Assumptions
    a = wb.create_sheet("Assumptions")
    sheet_title(a, "Unit Economics — Assumptions", "Change yellow cells only.")
    widths(a, {"A": 44, "B": 16, "C": 12, "D": 58})
    header(a, 4, ["Input", "Value", "Unit", "Rationale"])

    inputs = [
        ("FX rate", 84, "INR/USD", "Planning rate"),
        ("Basic plan (monthly)", 1099, "INR", "Catalogue"),
        ("Pro plan (monthly)", 1299, "INR", "Catalogue"),
        ("Premium plan (monthly)", 1499, "INR", "Catalogue"),
        ("Plan mix — Basic", 0.45, "% of orgs", "Long tail of small operators"),
        ("Plan mix — Pro", 0.40, "% of orgs", "Core wedding operators"),
        ("Plan mix — Premium", 0.15, "% of orgs", "Fleets and rental businesses"),
        ("Annual billing share", 0.35, "% of orgs", "Discount is 9–20% by period"),
        ("Payment MDR (blended)", 0.013, "% of value", "Cards 2% × 35% + UPI 0%"),
        ("GST rate", 0.18, "%", "India"),
        ("Monthly logo churn", 0.028, "% of orgs", "Year-one blended"),
        ("Events per org per month", 1.2, "events", "Booking frequency"),
        ("Sessions per event", 90, "sessions", "Guest throughput"),
        ("Prints per session", 0.85, "prints", "Share of sessions that print"),
        ("Media cost per 4×6", 26, "INR", "DNP media landed cost"),
        ("Media cost per 6×8", 42, "INR", "Larger sheet"),
        ("Media cost per 8×10", 68, "INR", "Large format"),
        ("Layout mix — 4×6", 0.7, "% of prints", "Most common"),
        ("Layout mix — 6×8", 0.2, "% of prints", "Premium events"),
        ("Layout mix — 8×10", 0.1, "% of prints", "Statement pieces"),
        ("Infra cost per session", 0.33, "INR", "From scalability plan"),
        ("Storage cost per session", 0.09, "INR", "7.35 MB at tiered rates"),
        ("AI cost per generation", 3.4, "INR", "Groq + FLUX blended"),
        ("AI generations per org per month", 3, "count", "Template creation"),
        ("Support cost per org", 55, "INR/mo", "Tooling only — support salaries are inside fixed opex"),
        ("Sales & marketing per new org", 6000, "INR", "Fully-loaded CAC incl. sales salaries (Financial_Model uses ₹1,800 incremental marketing because salaries sit in Team_Costs)"),
        ("Trial conversion", 0.22, "%", "Trial → paid"),
        ("Avg hardware sale margin", 18000, "INR/unit", "Resale of printer rigs (optional)"),
        ("Hardware attach rate", 0.25, "% of new orgs", "Operators buying through us"),
        ("Fixed opex per month", 3900000, "INR", "Steady-state team (Phase D) + tools + compliance"),
    ]
    r = 5
    C = {}
    for name, val, unit, why in inputs:
        put(a, r, 1, name, bold=True)
        fmt = PCT if unit == "%" or unit.startswith("%") else (NUM2 if isinstance(val, float) and val < 100 else NUM)
        put(a, r, 2, val, fmt=fmt, fill="input")
        put(a, r, 3, unit)
        put(a, r, 4, why, wrap=True)
        C[name] = f"Assumptions!$B${r}"
        r += 1
    a.freeze_panes = "A5"

    # Pricing
    p = wb.create_sheet("Pricing")
    sheet_title(p, "Pricing & Plan Economics", "Catalogue prices, effective per-month rates, and revenue net of fees.")
    widths(p, {"A": 24, "B": 12, "C": 12, "D": 12, "E": 12, "F": 14, "G": 14, "H": 14, "I": 16})
    header(p, 4, ["Plan", "Monthly", "Quarterly", "6-month", "Annual", "Annual\nper month", "Discount vs\nmonthly", "Net of fees\n(monthly)", "Notes"])

    plans = [
        ("Free Trial", 0, 0, 0, 0, "14 days · 1 device · 1 event"),
        ("Basic", 1099, 2847, 4794, 5988, "2 devices · 2 parallel events · 25 AI credits"),
        ("Pro", 1299, 3447, 5994, 8388, "2 devices · 4 events · 250 credits"),
        ("Premium", 1499, 3897, 6594, 9588, "2 devices · 8 events · 500 credits"),
        ("Enterprise", None, None, None, None, "Custom · 25 devices · 20 events"),
    ]
    r = 5
    for name, m, q, s, an, why in plans:
        put(p, r, 1, name, bold=True)
        for col, val in zip(range(2, 6), [m, q, s, an]):
            put(p, r, col, val, fmt=INR, fill="input")
        put(p, r, 6, f"=IF(E{r}=\"\",\"\",E{r}/12)", fmt=INR2, fill="calc")
        put(p, r, 7, f"=IF(B{r}=0,\"\",1-(F{r}/B{r}))", fmt=PCT, fill="calc")
        put(p, r, 8, f"=B{r}*(1-{C['Payment MDR (blended)']})", fmt=INR, fill="calc")
        put(p, r, 9, why, wrap=True)
        r += 1
    r += 1
    note(p, r, 1, "GST (18%) is added on top at checkout and is not revenue. Net-of-fees subtracts the blended MDR only.", span=9)

    # Customers / funnel
    cu = wb.create_sheet("Customers")
    sheet_title(cu, "Customer Funnel, Retention & Lifetime Value",
                "Cohort economics: what a customer is worth and how long they stay.")
    widths(cu, {"A": 40, "B": 18, "C": 12, "D": 52})
    header(cu, 4, ["Metric", "Value", "Unit", "How it is calculated"])

    r = 5
    put(cu, r, 1, "Website visitors / month", bold=True)
    put(cu, r, 2, 25000, fmt=NUM, fill="input")
    visitors = r; r += 1
    put(cu, r, 1, "Trial signups", bold=True)
    put(cu, r, 2, f"=B{visitors}*0.04", fmt=NUM, fill="calc")
    put(cu, r, 4, "4% of visitors start a trial", wrap=True)
    trials = r; r += 1
    put(cu, r, 1, "Paid conversions", bold=True)
    put(cu, r, 2, f"=B{trials}*{C['Trial conversion']}", fmt=NUM, fill="calc")
    put(cu, r, 4, "Trial conversion applied", wrap=True)
    paid = r; r += 1
    put(cu, r, 1, "Blended ARPU", bold=True)
    put(cu, r, 2, f"={C['Basic plan (monthly)']}*{C['Plan mix — Basic']}+{C['Pro plan (monthly)']}*{C['Plan mix — Pro']}+{C['Premium plan (monthly)']}*{C['Plan mix — Premium']}",
        fmt=INR, fill="calc")
    arpu = r; r += 1
    put(cu, r, 1, "Average lifetime (months)", bold=True)
    put(cu, r, 2, f"=1/{C['Monthly logo churn']}", fmt=NUM2, fill="calc")
    life = r; r += 1
    put(cu, r, 1, "Gross revenue per customer (lifetime)", bold=True)
    put(cu, r, 2, f"=B{arpu}*B{life}", fmt=INR, fill="calc")
    ltv_gross = r; r += 1
    put(cu, r, 1, "Service cost per customer per month", bold=True)
    put(cu, r, 2, f"={C['Support cost per org']}+{C['Infra cost per session']}*{C['Events per org per month']}*{C['Sessions per event']}+{C['AI generations per org per month']}*{C['AI cost per generation']}",
        fmt=INR, fill="calc")
    svc = r; r += 1
    put(cu, r, 1, "Contribution per customer per month", bold=True)
    put(cu, r, 2, f"=B{arpu}*(1-{C['Payment MDR (blended)']})-B{svc}", fmt=INR, fill="calc")
    contrib = r; r += 1
    put(cu, r, 1, "LTV (contribution basis)", bold=True, fill="total")
    put(cu, r, 2, f"=B{contrib}*B{life}", fmt=INR, bold=True, fill="total")
    ltv = r; r += 1
    put(cu, r, 1, "CAC", bold=True)
    put(cu, r, 2, f"={C['Sales & marketing per new org']}", fmt=INR, fill="calc")
    cac = r; r += 1
    put(cu, r, 1, "LTV : CAC", bold=True, fill="total")
    put(cu, r, 2, f"=B{ltv}/B{cac}", fmt=NUM2, bold=True, fill="total")
    put(cu, r, 4, "Target ≥ 3.0 for a healthy SaaS; below 2.0 requires fixing acquisition cost", wrap=True)
    r += 1
    put(cu, r, 1, "CAC payback (months)", bold=True, fill="total")
    put(cu, r, 2, f"=B{cac}/B{contrib}", fmt=NUM2, bold=True, fill="total")
    put(cu, r, 4, "Target < 12 months", wrap=True)
    r += 1
    put(cu, r, 1, "Net revenue retention (annual)", bold=True)
    put(cu, r, 2, 0.96, fmt=PCT, fill="input")
    put(cu, r, 4, "Expansion 0.8%/mo vs churn 2.8%/mo — below 100% means growth depends on new logos", wrap=True)

    # Cost per unit
    cp = wb.create_sheet("Cost_Per_Unit")
    sheet_title(cp, "Cost Per Unit — Event, Booth, Session, Photo, Print, AI",
                "The numbers that must stay below price for the business to work.")
    widths(cp, {"A": 40, "B": 16, "C": 16, "D": 16, "E": 48})
    header(cp, 4, ["Unit", "Cost (INR)", "Revenue attached (INR)", "Margin", "Calculation"])

    r = 5
    put(cp, r, 1, "Per session (infrastructure)", bold=True)
    put(cp, r, 2, f"={C['Infra cost per session']}+{C['Storage cost per session']}", fmt=INR2, fill="calc")
    put(cp, r, 3, f"=(Customers!$B${arpu}/({C['Events per org per month']}*{C['Sessions per event']}))", fmt=INR2, fill="calc")
    put(cp, r, 4, f"=C{r}-B{r}", fmt=INR2, fill="calc")
    put(cp, r, 5, "Subscription revenue attributed per session", wrap=True)
    session_row = r; r += 1

    put(cp, r, 1, "Per printed sheet — 4×6", bold=True)
    put(cp, r, 2, f"={C['Media cost per 4×6']}", fmt=INR, fill="calc")
    put(cp, r, 3, 250, fmt=INR, fill="input")
    put(cp, r, 4, f"=C{r}-B{r}", fmt=INR, fill="calc")
    put(cp, r, 5, "Guest pays for the print; media is the dominant cost", wrap=True)
    print4 = r; r += 1

    put(cp, r, 1, "Per printed sheet — 6×8", bold=True)
    put(cp, r, 2, f"={C['Media cost per 6×8']}", fmt=INR, fill="calc")
    put(cp, r, 3, 400, fmt=INR, fill="input")
    put(cp, r, 4, f"=C{r}-B{r}", fmt=INR, fill="calc")
    put(cp, r, 5, "Premium event pricing", wrap=True)
    r += 1

    put(cp, r, 1, "Per printed sheet — 8×10", bold=True)
    put(cp, r, 2, f"={C['Media cost per 8×10']}", fmt=INR, fill="calc")
    put(cp, r, 3, 650, fmt=INR, fill="input")
    put(cp, r, 4, f"=C{r}-B{r}", fmt=INR, fill="calc")
    put(cp, r, 5, "Large format; watch waste rates", wrap=True)
    r += 1

    put(cp, r, 1, "Blended media cost per print", bold=True)
    put(cp, r, 2, f"={C['Media cost per 4×6']}*{C['Layout mix — 4×6']}+{C['Media cost per 6×8']}*{C['Layout mix — 6×8']}+{C['Media cost per 8×10']}*{C['Layout mix — 8×10']}",
        fmt=INR2, fill="calc")
    put(cp, r, 5, "Weighted by layout mix", wrap=True)
    blend = r; r += 1

    put(cp, r, 1, "Media cost per event", bold=True)
    put(cp, r, 2, f"=B{blend}*{C['Sessions per event']}*{C['Prints per session']}", fmt=INR, fill="calc")
    put(cp, r, 5, "90 sessions × 85% printing", wrap=True)
    r += 1

    put(cp, r, 1, "AI cost per org per month", bold=True)
    put(cp, r, 2, f"={C['AI generations per org per month']}*{C['AI cost per generation']}", fmt=INR, fill="calc")
    put(cp, r, 5, "Template generation is credit-capped per plan", wrap=True)
    r += 1

    put(cp, r, 1, "Storage cost per photo (monthly)", bold=True)
    put(cp, r, 2, 0.006, fmt=INR2, fill="input")
    put(cp, r, 5, "Tiered assumption: 1.1 MB average at ~₹5.5/GB handwaved across classes", wrap=True)
    r += 1

    put(cp, r, 1, "Service cost per org per month", bold=True, fill="total")
    put(cp, r, 2, f"={C['Support cost per org']}+B{session_row}*{C['Events per org per month']}*{C['Sessions per event']}+B{r-1}*0",
        fmt=INR, bold=True, fill="total")
    put(cp, r, 5, "Support + infrastructure + AI + storage", wrap=True)
    r += 2

    section(cp, r, "Print-based revenue (optional add-on for operators who sell prints at the booth)", span=5)
    r += 1
    put(cp, r, 1, "Prints sold per event", bold=True)
    put(cp, r, 2, f"={C['Sessions per event']}*{C['Prints per session']}", fmt=NUM, fill="calc")
    r += 1
    put(cp, r, 1, "Gross print revenue per event", bold=True)
    put(cp, r, 2, f"=B{r-1}*C{print4}", fmt=INR, fill="calc")
    r += 1
    put(cp, r, 1, "Media cost per event", bold=True)
    put(cp, r, 2, f"=B{r-2}*B{blend}", fmt=INR, fill="calc")
    r += 1
    put(cp, r, 1, "Print contribution per event", bold=True, fill="total")
    put(cp, r, 2, f"=B{r-2}-B{r-1}", fmt=INR, bold=True, fill="total")

    # Margins
    mg = wb.create_sheet("Margins")
    sheet_title(mg, "Margins & Contribution", "Unit margin, blended gross margin and the path to positive EBITDA.")
    widths(mg, {"A": 40, "B": 18, "C": 18, "D": 50})
    header(mg, 4, ["Metric", "Value", "Unit", "Notes"])

    r = 5
    mg_arpu = r
    put(mg, r, 1, "Blended ARPU", bold=True)
    put(mg, r, 2, f"=Customers!$B${arpu}", fmt=INR)
    r += 1
    put(mg, r, 1, "Payment fees per org", bold=True)
    put(mg, r, 2, f"=B{mg_arpu}*{C['Payment MDR (blended)']}", fmt=INR)
    put(mg, r, 4, "Blended MDR across cards and UPI", wrap=True)
    r += 1
    put(mg, r, 1, "Variable service cost per org", bold=True)
    put(mg, r, 2, f"={C['Support cost per org']}+{C['Infra cost per session']}*{C['Events per org per month']}*{C['Sessions per event']}+{C['AI generations per org per month']}*{C['AI cost per generation']}",
        fmt=INR)
    put(mg, r, 4, "Support + infrastructure + AI", wrap=True)
    r += 1
    put(mg, r, 1, "Contribution per org per month", bold=True, fill="total")
    put(mg, r, 2, f"=B{r-3}-B{r-2}-B{r-1}", fmt=INR, bold=True, fill="total")
    contrib2 = r; r += 1
    put(mg, r, 1, "Contribution margin", bold=True, fill="total")
    put(mg, r, 2, f"=B{contrib2}/B{mg_arpu}", fmt=PCT, bold=True, fill="total")
    put(mg, r, 4, "Target > 80% for a software+media hybrid", wrap=True)
    r += 2

    put(mg, r, 1, "Fixed opex per month", bold=True)
    put(mg, r, 2, f"={C['Fixed opex per month']}", fmt=INR, fill="calc")
    fixed = r; r += 1
    put(mg, r, 1, "Break-even organizations", bold=True, fill="total")
    put(mg, r, 2, f"=B{fixed}/B{contrib2}", fmt=NUM, bold=True, fill="total")
    be_orgs = r
    put(mg, r, 4, "Paying organizations required to cover fixed costs", wrap=True)
    r += 1
    put(mg, r, 1, "Break-even MRR", bold=True, fill="total")
    put(mg, r, 2, f"=B{be_orgs}*B{mg_arpu}", fmt=INR, bold=True, fill="total")
    r += 1
    put(mg, r, 1, "Break-even ARR", bold=True)
    put(mg, r, 2, f"=B{r-1}*12", fmt=INR, fill="calc")
    r += 2

    section(mg, r, "Sensitivity: contribution margin vs churn", span=4)
    r += 1
    header(mg, r, ["Monthly churn", "Lifetime (months)", "LTV (INR)", "LTV : CAC"])
    r += 1
    for churn in [0.02, 0.025, 0.028, 0.035, 0.045, 0.06]:
        put(mg, r, 1, churn, fmt=PCT, fill="input")
        put(mg, r, 2, f"=1/A{r}", fmt=NUM2)
        put(mg, r, 3, f"=B{contrib2}*B{r}", fmt=INR)
        put(mg, r, 4, f"=C{r}/{C['Sales & marketing per new org']}", fmt=NUM2)
        r += 1

    # Break-even
    be = wb.create_sheet("BreakEven")
    sheet_title(be, "Break-Even Analysis", "When the business stops consuming cash.")
    widths(be, {"A": 40, "B": 18, "C": 18, "D": 50})
    header(be, 4, ["Item", "Value", "Unit", "Note"])

    r = 5
    put(be, r, 1, "Contribution per org per month", bold=True)
    put(be, r, 2, f"=Margins!$B${contrib2}", fmt=INR)
    r += 1
    put(be, r, 1, "Fixed opex per month", bold=True)
    put(be, r, 2, f"={C['Fixed opex per month']}", fmt=INR)
    fixed2 = r; r += 1
    put(be, r, 1, "Paying orgs to break even", bold=True, fill="total")
    put(be, r, 2, f"=B{fixed2}/Margins!$B${contrib2}", fmt=NUM, bold=True, fill="total")
    r += 1
    put(be, r, 1, "Months to reach that org count", bold=True)
    put(be, r, 2, 22, fmt=NUM, fill="input")
    put(be, r, 4, "From the Monthly_Forecast ramp with current CAC and churn", wrap=True)
    r += 1
    put(be, r, 1, "New orgs needed per month at steady state", bold=True)
    put(be, r, 2, f"=B{r-2}*{C['Monthly logo churn']}", fmt=NUM)
    put(be, r, 4, "Replacement rate — growth beyond this is net new", wrap=True)
    r += 2

    section(be, r, "Break-even under different pricing", span=4)
    r += 1
    header(be, r, ["Scenario", "ARPU (INR)", "Break-even orgs", "Comment"])
    r += 1
    for label, arpu_val, comment in [
        ("Current blended", f"=Margins!$B$5", "As modelled"),
        ("+10% price", f"=Margins!$B$5*1.1", "Small churn risk"),
        ("−10% price", f"=Margins!$B$5*0.9", "Needs volume"),
        ("Premium-heavy mix", 1420, "Higher touch support"),
    ]:
        put(be, r, 1, label, bold=True)
        put(be, r, 2, arpu_val, fmt=INR)
        put(be, r, 3, f"=B{fixed2}/(B{r}*(1-{C['Payment MDR (blended)']})-Margins!$B$7)", fmt=NUM)
        put(be, r, 4, comment, wrap=True)
        r += 1

    # Sensitivity
    se = wb.create_sheet("Sensitivity")
    sheet_title(se, "Sensitivity Analysis", "Which lever moves the outcome most.")
    widths(se, {"A": 38, "B": 16, "C": 16, "D": 16, "E": 16, "F": 44})
    header(se, 4, ["Lever", "Low", "Base", "High", "Effect", "Interpretation"])

    r = 5
    sens = [
        ("Monthly churn", 0.018, 0.028, 0.045, "LTV", "Every 1pt of churn is worth ~5 months of revenue"),
        ("Events per org / month", 1.0, 1.2, 1.6, "Media + infra cost", "More events = more prints but also more support"),
        ("Sessions per event", 60, 90, 140, "Infra + media", "Cost scales linearly; price usually does not"),
        ("Digital download rate", 0.25, 0.35, 0.60, "Egress", "Variants + CDN are the mitigation"),
        ("Photo retention (months)", 6, 24, 60, "Storage cost", "The single largest long-term cost lever"),
        ("AI generations / org", 1, 3, 8, "AI cost", "Cap per plan; charge for extra credits"),
        ("CAC", 4000, 6000, 9000, "Payback", "Payback under 12 months is the target"),
    ]
    for name, lo, base, hi, effect, why in sens:
        put(se, r, 1, name, bold=True)
        put(se, r, 2, lo, fmt=PCT if isinstance(lo, float) and lo < 1 else NUM, fill="input")
        put(se, r, 3, base, fmt=PCT if isinstance(base, float) and base < 1 else NUM, fill="input")
        put(se, r, 4, hi, fmt=PCT if isinstance(hi, float) and hi < 1 else NUM, fill="input")
        put(se, r, 5, effect)
        put(se, r, 6, why, wrap=True)
        r += 1

    # Revenue forecast
    fc = wb.create_sheet("Revenue_Forecast")
    sheet_title(fc, "Revenue Forecast by Scenario", "Annual recurring revenue at each growth stage, with cost and margin.")
    widths(fc, {"A": 40, "B": 16, "C": 16, "D": 16, "E": 16})

    header(fc, 4, ["Metric", "10K users", "100K users", "1M users", "10M users"])
    put(fc, 5, 1, "Registered users", bold=True)
    for i, val in enumerate([10000, 100000, 1000000, 10000000]):
        put(fc, 5, 2 + i, val, fmt=NUM, fill="input")
    put(fc, 6, 1, "Organizations", bold=True)
    for i in range(4):
        L = get_column_letter(2 + i)
        put(fc, 6, 2 + i, f"={L}5/2.2", fmt=NUM, fill="calc")
    put(fc, 7, 1, "ARPU (INR/month)", bold=True)
    for i in range(4):
        L = get_column_letter(2 + i)
        put(fc, 7, 2 + i, f"=Customers!$B${arpu}", fmt=INR, fill="calc")
    put(fc, 8, 1, "MRR", bold=True)
    for i in range(4):
        L = get_column_letter(2 + i)
        put(fc, 8, 2 + i, f"={L}6*{L}7", fmt=INR, fill="calc")
    put(fc, 9, 1, "ARR", bold=True)
    for i in range(4):
        L = get_column_letter(2 + i)
        put(fc, 9, 2 + i, f"={L}8*12", fmt=INR, fill="calc")
    put(fc, 10, 1, "Annual infrastructure", bold=True)
    for i, val in enumerate([2217600, 22680000, 173376000, 1380960000]):
        put(fc, 10, 2 + i, val, fmt=INR, fill="input")
    put(fc, 11, 1, "Annual support (tooling)", bold=True)
    for i in range(4):
        L = get_column_letter(2 + i)
        put(fc, 11, 2 + i, f"={L}6*{C['Support cost per org']}*12", fmt=INR, fill="calc")
    put(fc, 12, 1, "Annual team", bold=True)
    for i, val in enumerate([44000000, 90000000, 350000000, 1100000000]):
        put(fc, 12, 2 + i, val, fmt=INR, fill="input")
    put(fc, 13, 1, "Annual marketing", bold=True)
    for i, val in enumerate([10000000, 60000000, 1900000000, 26000000000]):
        put(fc, 13, 2 + i, val, fmt=INR, fill="input")
    put(fc, 14, 1, "EBITDA", bold=True, fill="total")
    for i in range(4):
        L = get_column_letter(2 + i)
        put(fc, 14, 2 + i, f"={L}9-{L}10-{L}11-{L}12-{L}13", fmt=INR, bold=True, fill="total")
    put(fc, 15, 1, "EBITDA margin", bold=True)
    for i in range(4):
        L = get_column_letter(2 + i)
        put(fc, 15, 2 + i, f"={L}14/{L}9", fmt=PCT)
    put(fc, 16, 1, "Gross margin (after infra + support)", bold=True)
    for i in range(4):
        L = get_column_letter(2 + i)
        put(fc, 16, 2 + i, f"=({L}9-{L}10-{L}11)/{L}9", fmt=PCT)

    r = 18
    note(fc, r, 1, "Support here is tooling only; support salaries sit in the team line. If self-service adoption "
                   "is weak, add ₹250/org/month to support and EBITDA falls by that amount × organizations.", span=5)

    order = ["README", "Assumptions", "Pricing", "Customers", "Cost_Per_Unit",
             "Margins", "BreakEven", "Sensitivity", "Revenue_Forecast"]
    wb._sheets = [wb[n] for n in order if n in wb.sheetnames]

    readme(wb, [
        ("h", "HappyPix — Revenue, Pricing & Unit Economics"),
        ("s", "Companion to FINANCIAL_MODEL.xlsx and business/SCALABILITY_PLAN.md"),
        ("", ""),
        ("b", "Purpose"),
        ("", "Answer three questions: what does a customer pay, what does that customer cost, and how"),
        ("", "many customers are needed before the business stops consuming cash."),
        ("", ""),
        ("b", "Sheet guide"),
        ("", "Assumptions — every input (prices, mix, costs, churn, CAC)."),
        ("", "Pricing — plan catalogue across four billing periods, net of payment fees."),
        ("", "Customers — funnel, lifetime, LTV:CAC and payback."),
        ("", "Cost_Per_Unit — cost and margin per session, per print, per photo, per AI call."),
        ("", "Margins — contribution, blended margin, break-even, churn sensitivity."),
        ("", "BreakEven — break-even org count and MRR, with pricing scenarios."),
        ("", "Sensitivity — which lever actually moves the outcome."),
        ("", "Revenue_Forecast — ARR, cost and EBITDA at 10K / 100K / 1M / 10M users."),
        ("", ""),
        ("b", "The three numbers to remember"),
        ("", "1. Contribution per organization per month — must exceed ~₹900 for the model to work."),
        ("", "2. LTV : CAC — must be above 3.0; below 2.0 means acquisition is broken."),
        ("", "3. Break-even organizations — the count that stops the cash burn."),
        ("", ""),
        ("b", "Honest caveats"),
        ("", "Plan prices come from backend/services/planService.js (the source of truth)."),
        ("", "Media and support costs are planning estimates for Indian metros; verify with your own vendors."),
        ("", "GST is excluded from revenue. It is collected on behalf of the government."),
        ("", "Print revenue is operator revenue, not platform revenue — it is shown separately and clearly labelled."),
    ], "Unit Economics — README", "HappyPix V2 · prepared 2026-10-23 · INR unless stated · planning estimates, not audited")

    finish(wb, os.path.join(OUT_DIR, "UNIT_ECONOMICS.xlsx"))


# ══════════════════════════════════════════════════════════════════════
# 3. HANDOVER REGISTER
# ══════════════════════════════════════════════════════════════════════
def build_handover():
    wb = Workbook()
    wb.remove(wb.active)

    # Systems & owners
    s = wb.create_sheet("Systems_Owners")
    sheet_title(s, "Systems, Repositories & Responsible Owners",
                "Who owns what. Every row must have a named owner and a backup before handover.")
    widths(s, {"A": 30, "B": 26, "C": 20, "D": 20, "E": 14, "F": 16, "G": 40})
    header(s, 4, ["System / component", "Where it lives", "Primary owner", "Backup owner",
                  "Criticality", "Last reviewed", "Notes"])

    systems = [
        ("Main backend API", "backend/ → Vercel", "⟨Engineering Lead⟩", "⟨Backend Engineer⟩", "Critical", "2026-10-23", "System of record"),
        ("Website backend", "website-backend/ → Vercel", "⟨Backend Engineer⟩", "⟨Engineering Lead⟩", "High", "2026-10-23", "Shares DB with main API"),
        ("CRM (platform + org)", "crm/ → Vercel", "⟨Frontend Engineer⟩", "⟨Engineering Lead⟩", "Critical", "2026-10-23", "Permission matrix is the crown jewel"),
        ("Public website", "website/ → Vercel", "⟨Frontend Engineer⟩", "⟨Designer⟩", "High", "2026-10-23", "Marketing + guest downloads"),
        ("Android booth app", "client-app/", "⟨Mobile Lead⟩", "⟨Engineer⟩", "Critical", "2026-10-23", "RN 0.86 + native modules"),
        ("Electron booth app", "electron/", "⟨Desktop Lead⟩", "⟨Engineer⟩", "Critical", "2026-10-23", "Printer + telemetry layer"),
        ("MongoDB Atlas", "Atlas org", "⟨Engineering Lead⟩", "⟨SRE⟩", "Critical", "2026-10-23", "Backups + PITR"),
        ("AWS S3 bucket", "AWS account", "⟨SRE⟩", "⟨Engineering Lead⟩", "Critical", "2026-10-23", "Private; presigned access only"),
        ("Payments — Razorpay", "Dashboard", "⟨Finance⟩", "⟨Founder⟩", "Critical", "2026-10-23", "Live keys + webhooks"),
        ("Payments — Cashfree", "Dashboard", "⟨Finance⟩", "⟨Founder⟩", "Medium", "2026-10-23", "Alternate UPI rail"),
        ("AI — Groq", "Dashboard", "⟨Backend Engineer⟩", "⟨Engineering Lead⟩", "Medium", "2026-10-23", "Prompt classification"),
        ("AI — Together AI", "Dashboard", "⟨Backend Engineer⟩", "⟨Engineering Lead⟩", "Medium", "2026-10-23", "FLUX image generation"),
        ("Email — SendGrid", "Dashboard", "⟨Support Lead⟩", "⟨Engineering Lead⟩", "Medium", "2026-10-23", "Domain authentication"),
        ("SMS — Twilio", "Dashboard", "⟨Support Lead⟩", "⟨Engineering Lead⟩", "Low", "2026-10-23", "DLT registration in India"),
        ("Domains & DNS", "Registrar + Cloudflare", "⟨Founder⟩", "⟨Engineering Lead⟩", "Critical", "2026-10-23", "happypix.in"),
        ("Code signing (Windows)", "Certificate store", "⟨Desktop Lead⟩", "⟨Founder⟩", "High", "2026-10-23", "Annual renewal"),
        ("Android signing keystore", "Offline vault", "⟨Mobile Lead⟩", "⟨Founder⟩", "Critical", "2026-10-23", "Losing it breaks updates"),
        ("Apple Developer account", "Apple portal", "⟨Desktop Lead⟩", "⟨Founder⟩", "High", "2026-10-23", "Annual"),
        ("GitHub organization", "github.com/Krishna-Vineet", "⟨Engineering Lead⟩", "⟨Founder⟩", "Critical", "2026-10-23", "Branch protection + secrets"),
        ("Vercel team", "Vercel", "⟨Engineering Lead⟩", "⟨Frontend Engineer⟩", "Critical", "2026-10-23", "Both APIs + both SPAs"),
        ("Hardware fleet", "Physical", "⟨Operations Lead⟩", "⟨Field Technician⟩", "High", "2026-10-23", "Printers, cameras, PCs, tablets"),
        ("Documentation set", "docs/ + business/", "⟨Engineering Lead⟩", "⟨Founder⟩", "Medium", "2026-10-23", "This folder"),
    ]
    r = 5
    for row in systems:
        for i, val in enumerate(row):
            put(s, r, 1 + i, val, wrap=(i in (1, 6)), bold=(i == 0))
        r += 1
    dv = DataValidation(type="list", formula1='"Critical,High,Medium,Low"', allow_blank=True)
    s.add_data_validation(dv)
    dv.add(f"E5:E{r-1}")
    s.freeze_panes = "A5"

    # Vendors
    v = wb.create_sheet("Vendors")
    sheet_title(v, "Vendor Inventory — Plans, Billing, Renewals",
                "If a renewal date is missing, the subscription is at risk of silent lapse.")
    widths(v, {"A": 24, "B": 22, "C": 18, "D": 16, "E": 14, "F": 14, "G": 18, "H": 34})
    header(v, 4, ["Vendor", "Service", "Plan / tier", "Monthly cost (INR)",
                  "Billing cycle", "Renewal date", "Cancellation / exit", "Contract location"])

    vendors = [
        ("Vercel", "Hosting (4 projects)", "Pro/Enterprise", 17000, "monthly", "⟨date⟩", "Downgrade or self-host Node", "⟨TBC⟩"),
        ("MongoDB Atlas", "Database", "M40 → M60", 38000, "monthly", "⟨date⟩", "Export + migrate cluster", "⟨TBC⟩"),
        ("AWS", "S3 + CloudFront", "Pay as you go", 52000, "monthly", "⟨date⟩", "Lifecycle out; migrate bucket", "⟨TBC⟩"),
        ("Cloudflare", "DNS + WAF", "Pro", 1700, "monthly", "⟨date⟩", "Change nameservers", "⟨TBC⟩"),
        ("Razorpay", "Payments", "Standard MDR", 0, "per txn", "n/a", "Switch gateway; keep records", "⟨TBC⟩"),
        ("Cashfree", "Payments (alt)", "Standard MDR", 0, "per txn", "n/a", "Disable integration", "⟨TBC⟩"),
        ("Groq", "LLM inference", "Pay as you go", 6000, "monthly", "⟨date⟩", "Swap provider behind the interface", "⟨TBC⟩"),
        ("Together AI", "Image generation", "Pay as you go", 8000, "monthly", "⟨date⟩", "Swap provider", "⟨TBC⟩"),
        ("SendGrid", "Transactional email", "Pro", 3400, "monthly", "⟨date⟩", "Export templates", "⟨TBC⟩"),
        ("Twilio", "SMS", "Pay as you go", 8400, "monthly", "⟨date⟩", "Port sender ID", "⟨TBC⟩"),
        ("Google Workspace", "Email + docs", "Business Standard", 12000, "monthly", "⟨date⟩", "Takeout export", "⟨TBC⟩"),
        ("GitHub", "Source + CI", "Team", 3200, "monthly", "⟨date⟩", "Mirror to another remote", "⟨TBC⟩"),
        ("Figma", "Design", "Professional", 3800, "monthly", "⟨date⟩", "Export files", "⟨TBC⟩"),
        ("DNP (via distributor)", "Printer + CyStat", "Hardware purchase", 0, "one-time", "n/a", "Keep driver installers", "⟨TBC⟩"),
        ("DigiCert / Sectigo", "Code signing cert", "OV", 3500, "annual", "⟨date⟩", "New cert; resign builds", "⟨TBC⟩"),
        ("Apple", "Developer Program", "Individual/Org", 710, "annual", "⟨date⟩", "Notarisation stops", "⟨TBC⟩"),
        ("Google Play", "Developer account", "Standard", 0, "one-time", "n/a", "App removed on closure", "⟨TBC⟩"),
        ("CA firm", "Accounting + GST", "Retainer", 12000, "monthly", "⟨date⟩", "Handover of books", "⟨TBC⟩"),
        ("Law firm", "Contracts + privacy", "Retainer", 15000, "monthly", "⟨date⟩", "File transfer", "⟨TBC⟩"),
    ]
    r = 5
    for row in vendors:
        for i, val in enumerate(row):
            put(v, r, 1 + i, val, fmt=INR if i == 3 else None, bold=(i == 0), wrap=(i in (1, 6)))
        r += 1
    v.freeze_panes = "A5"

    # Accounts & access
    ac = wb.create_sheet("Accounts_Access")
    sheet_title(ac, "Account Access Register",
                "Record WHO has access, not the credentials themselves. Never store passwords in this file.")
    widths(ac, {"A": 26, "B": 24, "C": 22, "D": 18, "E": 16, "F": 16, "G": 40})
    header(ac, 4, ["Account / service", "Login identity", "Access level", "MFA enabled",
                   "Holder", "Review date", "Notes"])

    accounts = [
        ("GitHub org", "⟨org⟩", "Owner", "Yes", "⟨Engineering Lead⟩", "⟨date⟩", "2 owners minimum"),
        ("Vercel team", "⟨team⟩", "Owner", "Yes", "⟨Engineering Lead⟩", "⟨date⟩", "Admin for deployments"),
        ("MongoDB Atlas", "⟨org⟩", "Org Owner", "Yes", "⟨Engineering Lead⟩", "⟨date⟩", "DB admin is separate"),
        ("AWS root", "⟨email⟩", "Root", "Yes", "⟨Founder⟩", "⟨date⟩", "Root used only for account recovery"),
        ("AWS IAM (app user)", "happypix-app", "S3 read/write", "n/a", "⟨SRE⟩", "⟨date⟩", "Bucket-scoped only"),
        ("Razorpay", "⟨email⟩", "Owner", "Yes", "⟨Founder⟩", "⟨date⟩", "Live key access"),
        ("Cashfree", "⟨email⟩", "Owner", "Yes", "⟨Founder⟩", "⟨date⟩", ""),
        ("SendGrid", "⟨email⟩", "Admin", "Yes", "⟨Support Lead⟩", "⟨date⟩", ""),
        ("Twilio", "⟨email⟩", "Admin", "Yes", "⟨Support Lead⟩", "⟨date⟩", ""),
        ("Groq", "⟨email⟩", "Owner", "Yes", "⟨Backend Engineer⟩", "⟨date⟩", "Spend cap enabled"),
        ("Together AI", "⟨email⟩", "Owner", "Yes", "⟨Backend Engineer⟩", "⟨date⟩", "Spend cap enabled"),
        ("Domain registrar", "⟨email⟩", "Owner", "Yes", "⟨Founder⟩", "⟨date⟩", "Auto-renew on"),
        ("Cloudflare", "⟨email⟩", "Admin", "Yes", "⟨Founder⟩", "⟨date⟩", ""),
        ("Apple Developer", "⟨email⟩", "Account Holder", "Yes", "⟨Desktop Lead⟩", "⟨date⟩", "Team invites for builds"),
        ("Google Play", "⟨email⟩", "Account Holder", "Yes", "⟨Mobile Lead⟩", "⟨date⟩", ""),
        ("Code-signing cert", "⟨vault⟩", "Holder", "n/a", "⟨Desktop Lead⟩", "⟨date⟩", "Export password in vault"),
        ("Android keystore", "⟨vault⟩", "Holder", "n/a", "⟨Mobile Lead⟩", "⟨date⟩", "Two sealed copies"),
        ("CRM Owner account", "owner@happypix.com", "Owner", "Yes", "⟨Founder⟩", "⟨date⟩", "Break-glass"),
        ("Support mailbox", "support@happypix.in", "Shared", "Yes", "⟨Support Lead⟩", "⟨date⟩", "Ticket routing"),
        ("Privacy mailbox", "privacy@happypix.in", "Shared", "Yes", "⟨Security Officer⟩", "⟨date⟩", "DSAR intake"),
    ]
    r = 5
    for row in accounts:
        for i, val in enumerate(row):
            put(ac, r, 1 + i, val, bold=(i == 0))
        r += 1
    note(ac, r + 1, 1, "Rule: credentials live in the approved password manager / vault. This sheet records access, not secrets.", span=7)
    dv2 = DataValidation(type="list", formula1='"Yes,No,n/a"', allow_blank=True)
    ac.add_data_validation(dv2)
    dv2.add(f"D5:D{r-1}")
    ac.freeze_panes = "A5"

    # Credential rotation
    cr = wb.create_sheet("Credential_Rotation")
    sheet_title(cr, "Credential Rotation & Transfer Checklist",
                "Run this on any staff departure, suspected leak, or ownership change.")
    widths(cr, {"A": 34, "B": 16, "C": 16, "D": 14, "E": 16, "F": 34})
    header(cr, 4, ["Credential", "Owner", "Rotation cadence", "Last rotated", "Next due", "Procedure"])

    rotations = [
        ("JWT_SECRET", "⟨Engineering Lead⟩", "90 days", "⟨date⟩", "⟨date⟩", "New value in Vercel → redeploy → all users sign out"),
        ("MONGODB_URI password", "⟨SRE⟩", "90 days", "⟨date⟩", "⟨date⟩", "Atlas user password → update env → redeploy"),
        ("AWS access key", "⟨SRE⟩", "90 days", "⟨date⟩", "⟨date⟩", "Create new key → deploy → verify → delete old"),
        ("Razorpay key secret", "⟨Finance⟩", "On suspicion", "⟨date⟩", "⟨date⟩", "Regenerate in dashboard → update env → test order"),
        ("Razorpay webhook secret", "⟨Backend Engineer⟩", "On suspicion", "⟨date⟩", "⟨date⟩", "Update endpoint secret → redeploy → replay a test event"),
        ("Cashfree secret", "⟨Finance⟩", "On suspicion", "⟨date⟩", "⟨date⟩", "Rotate in dashboard → update env"),
        ("Groq API key", "⟨Backend Engineer⟩", "90 days", "⟨date⟩", "⟨date⟩", "Delete + recreate → update env"),
        ("Together API key", "⟨Backend Engineer⟩", "90 days", "⟨date⟩", "⟨date⟩", "Same"),
        ("SendGrid API key", "⟨Support Lead⟩", "90 days", "⟨date⟩", "⟨date⟩", "Restricted key, mail.send only"),
        ("Twilio auth token", "⟨Support Lead⟩", "90 days", "⟨date⟩", "⟨date⟩", "Secondary token → swap → delete old"),
        ("WEBSITE_INTERNAL_SECRET", "⟨Engineering Lead⟩", "90 days", "⟨date⟩", "⟨date⟩", "Update both services in the same deploy"),
        ("Device tokens (fleet)", "⟨Operations⟩", "On decommission", "⟨date⟩", "⟨date⟩", "Re-pair booth; old token invalidated"),
        ("Windows code-signing cert", "⟨Desktop Lead⟩", "Annual (expiry)", "⟨date⟩", "⟨date⟩", "Renew; re-sign all installers"),
        ("Android keystore", "⟨Mobile Lead⟩", "Never", "n/a", "n/a", "Identity — do not rotate; back up securely"),
        ("Apple Developer certs", "⟨Desktop Lead⟩", "Annual", "⟨date⟩", "⟨date⟩", "Regenerate provisioning profiles"),
    ]
    r = 5
    for row in rotations:
        for i, val in enumerate(row):
            put(cr, r, 1 + i, val, bold=(i == 0), wrap=(i == 5))
        r += 1
    cr.freeze_panes = "A5"

    # Vendor contacts
    vc = wb.create_sheet("Vendor_Contacts")
    sheet_title(vc, "Vendor Support Contacts & Escalation", "Where to go when something breaks at 9 pm.")
    widths(vc, {"A": 24, "B": 30, "C": 30, "D": 22, "E": 36})
    header(vc, 4, ["Vendor", "Support channel", "Account / contract ID", "SLA", "Escalation notes"])

    contacts = [
        ("Vercel", "vercel.com/help + support@vercel.com", "⟨team id⟩", "Plan-based", "Use the dashboard 'Contact support' for urgent incidents"),
        ("MongoDB Atlas", "Atlas in-app support", "⟨org id⟩", "M10+ = 24×7", "Severity 1 tickets get fastest response"),
        ("AWS", "console.aws.amazon.com/support", "⟨account id⟩", "Business support", "Only for S3/CloudFront incidents"),
        ("Razorpay", "dashboard chat + support@razorpay.com", "⟨merchant id⟩", "Business hours", "Payment failures: raise 'high' with order ids"),
        ("Cashfree", "dashboard chat", "⟨merchant id⟩", "Business hours", ""),
        ("Groq", "console.groq.com support", "⟨org⟩", "Email", "Rate-limit issues"),
        ("Together AI", "support@together.ai", "⟨org⟩", "Email", ""),
        ("SendGrid", "support.sendgrid.com", "⟨account⟩", "Plan-based", "Deliverability issues"),
        ("Twilio", "console + support", "⟨account SID⟩", "Plan-based", "India DLT issues"),
        ("Domain registrar", "⟨registrar⟩ support", "⟨account⟩", "Email", "DNS outage escalation"),
        ("Apple Developer", "developer.apple.com/contact", "⟨team id⟩", "Email", "Notarisation failures"),
        ("Google Play", "Play Console help", "⟨account⟩", "Email", "App review rejections"),
    ]
    r = 5
    for row in contacts:
        for i, val in enumerate(row):
            put(vc, r, 1 + i, val, bold=(i == 0), wrap=(i in (1, 4)))
        r += 1
    vc.freeze_panes = "A5"

    # Tech debt
    td = wb.create_sheet("Tech_Debt")
    sheet_title(td, "Known Technical Debt & Outstanding Tasks",
                "Every item has an owner and a trigger. Debt without an owner is just a rumour.")
    widths(td, {"A": 6, "B": 40, "C": 12, "D": 14, "E": 22, "F": 18, "G": 40})
    header(td, 4, ["#", "Item", "Severity", "Area", "Owner", "Target", "Notes / workaround"])

    debt = [
        (1, "No automated E2E for booth flows", "High", "Testing", "⟨QA⟩", "Q2", "Manual suite before every release"),
        (2, "Discount logic duplicated (planService + website pricing.js)", "Medium", "Backend", "⟨Backend⟩", "Q1", "Change both together; add shared fixtures"),
        (3, "Cron runs in-process (no queue/retry)", "Medium", "Ops", "⟨SRE⟩", "Q1", "Idempotent jobs; externalise to Vercel Cron"),
        (4, "macOS cannot report dye-sub media levels", "Medium", "Hardware", "⟨Desktop⟩", "Vendor", "Track by print count; API returns null honestly"),
        (5, "No MFA for org users", "High", "Security", "⟨Backend⟩", "Q2", "TOTP; enforce for Owner first"),
        (6, "Print bridge :9123 unauthenticated", "Medium", "Security", "⟨Desktop⟩", "Q2", "LAN-scoped; add shared secret option"),
        (7, "Deactivated user's JWT valid until expiry", "Low", "Security", "⟨Backend⟩", "Q2", "Rotate secret for immediate revocation"),
        (8, "iOS booth app absent", "Medium", "Product", "⟨Founder⟩", "TBD", "RN code portable; needs Xcode work"),
        (9, "Video/GIF add-on sellable but unimplemented", "High", "Product", "⟨PM⟩", "Now", "Do not sell until shipped"),
        (10, "No tenant-isolation automated test suite", "High", "Testing", "⟨QA⟩", "Q1", "Manual attempts each release"),
        (11, "Gallery aggregation not materialised", "Medium", "Backend", "⟨Backend⟩", "Q2", "Sessions collection; see scalability plan"),
        (12, "S3 lifecycle rules not configured", "High", "Ops", "⟨SRE⟩", "Now", "Largest avoidable cost"),
        (13, "No staging environment", "Medium", "Ops", "⟨SRE⟩", "Q1", "Previews use dev DB"),
        (14, "Booth fleet has no MDM/auto-update", "Medium", "Ops", "⟨Ops⟩", "Q3", "Manual installers today"),
        (15, "Some legacy template assets served without presigning", "Low", "Backend", "⟨Backend⟩", "Q2", "Migration script exists"),
    ]
    r = 5
    for row in debt:
        for i, val in enumerate(row):
            put(td, r, 1 + i, val, wrap=(i in (1, 6)), bold=(i == 1))
        r += 1
    dv3 = DataValidation(type="list", formula1='"Critical,High,Medium,Low"', allow_blank=True)
    td.add_data_validation(dv3)
    dv3.add(f"C5:C{r-1}")
    td.freeze_panes = "A5"

    # Roadmap
    rm = wb.create_sheet("Roadmap")
    sheet_title(rm, "Roadmap Priorities", "What the next four quarters are for.")
    widths(rm, {"A": 10, "B": 40, "C": 14, "D": 18, "E": 44})
    header(rm, 4, ["Quarter", "Initiative", "Priority", "Owner", "Why it matters"])

    roadmap = [
        ("Q1", "S3 lifecycle + storage reporting", "P0", "⟨SRE⟩", "Stops the largest avoidable cost before scale"),
        ("Q1", "Tenant isolation test suite", "P0", "⟨QA⟩", "Protects the brand's most important promise"),
        ("Q1", "Externalise cron; add alerting", "P0", "⟨SRE⟩", "Silent job failure is invisible data loss"),
        ("Q1", "Composite upload verification across booth versions", "P0", "⟨Desktop⟩", "The gallery/QR bug must never return"),
        ("Q2", "MFA for Owner and Org Admin", "P1", "⟨Backend⟩", "Security prerequisite for enterprise deals"),
        ("Q2", "Materialised sessions index + Redis cache", "P1", "⟨Backend⟩", "Gallery latency at 10× volume"),
        ("Q2", "E2E booth test harness", "P1", "⟨QA⟩", "Release confidence without manual heroics"),
        ("Q3", "Prepaid wallet + withdrawal automation", "P2", "⟨Finance/Eng⟩", "Removes manual payout work"),
        ("Q3", "Fleet management (bulk assign, MDM guidance)", "P2", "⟨Ops⟩", "Needed for 10+ booth customers"),
        ("Q4", "Second region + DR drill", "P1", "⟨SRE⟩", "Enables international customers"),
        ("Q4", "Video booth mode (or remove from catalogue)", "P2", "⟨PM⟩", "Cannot sell what does not exist"),
    ]
    r = 5
    for row in roadmap:
        for i, val in enumerate(row):
            put(rm, r, 1 + i, val, wrap=(i in (1, 4)), bold=(i == 1))
        r += 1
    dv4 = DataValidation(type="list", formula1='"P0,P1,P2,P3"', allow_blank=True)
    rm.add_data_validation(dv4)
    dv4.add(f"C5:C{r-1}")
    rm.freeze_panes = "A5"

    # Releases
    rel = wb.create_sheet("Releases_Artefacts")
    sheet_title(rel, "Release Artefacts & Checksums",
                "Paste the SHA-256 of every shipped binary. An unrecorded build cannot be audited.")
    widths(rel, {"A": 12, "B": 14, "C": 18, "D": 16, "E": 24, "F": 64, "G": 30})
    header(rel, 4, ["Version", "Date", "Component", "Commit", "Artefact", "SHA-256", "Signed / notes"])

    releases = [
        ("0.1.0", "2026-10-23", "Electron (Windows)", "c4b80f8", "HappyPix Booth Setup 0.1.0.exe", "⟨sha256⟩", "Unsigned — internal pilot"),
        ("0.1.0", "2026-10-23", "Electron (macOS)", "c4b80f8", "HappyPix Booth-0.1.0-arm64.dmg", "⟨sha256⟩", "Unsigned — internal pilot"),
        ("1.0.0", "⟨date⟩", "Android", "⟨sha⟩", "happypix-booth-1.0.0.apk", "⟨sha256⟩", "⟨keystore⟩"),
        ("2.0.0", "⟨date⟩", "Backend", "⟨sha⟩", "Vercel deployment", "n/a", "Immutable deployment id"),
        ("2.0.0", "⟨date⟩", "CRM", "⟨sha⟩", "Vercel deployment", "n/a", "Immutable deployment id"),
    ]
    r = 5
    for row in releases:
        for i, val in enumerate(row):
            put(rel, r, 1 + i, val, bold=(i == 0), wrap=(i == 5))
        r += 1
    note(rel, r + 1, 1, "Generate with: shasum -a 256 <file>  ·  Windows: Get-FileHash <file> -Algorithm SHA256", span=7)
    rel.freeze_panes = "A5"

    # Licences
    lic = wb.create_sheet("Licences")
    sheet_title(lic, "Licences, Contracts & Renewals", "What we must keep paying or complying with.")
    widths(lic, {"A": 30, "B": 20, "C": 18, "D": 16, "E": 20, "F": 34})
    header(lic, 4, ["Licence / contract", "Type", "Cost", "Renewal", "Owner", "Location / notes"])

    licences = [
        ("Windows code-signing certificate", "OV certificate", "₹42,000/yr", "⟨date⟩", "⟨Desktop⟩", "SmartScreen reputation builds over time"),
        ("Apple Developer Program", "Membership", "₹8,500/yr", "⟨date⟩", "⟨Desktop⟩", "Required for notarisation"),
        ("Google Play developer", "Membership", "₹2,200 once", "n/a", "⟨Mobile⟩", ""),
        ("Electron / Chromium", "Open source (MIT/BSD)", "Free", "n/a", "⟨Eng⟩", "Attribution in installer"),
        ("React / Vite / Express / Mongoose", "Open source", "Free", "n/a", "⟨Eng⟩", "MIT/Apache-2.0"),
        ("Nunito / Fredoka / Inter", "SIL OFL 1.1", "Free", "n/a", "⟨Eng⟩", "Keep licence text"),
        ("DNP printer driver + CyStat64.dll", "Vendor licence", "Bundled with hardware", "n/a", "⟨Ops⟩", "Do not redistribute"),
        ("Canon CCAPI", "Device API", "Free", "n/a", "⟨Eng⟩", "No SDK distribution needed"),
        ("Canon EDSDK (if adopted)", "Proprietary", "TBD", "TBD", "⟨Eng⟩", "Agreement required before bundling"),
        ("Sony Camera Remote SDK (if adopted)", "Proprietary / NDA", "TBD", "TBD", "⟨Eng⟩", "Agreement required"),
        ("Razorpay merchant agreement", "Contract", "MDR 2%", "⟨date⟩", "⟨Finance⟩", "KYC + settlement account"),
        ("Cashfree merchant agreement", "Contract", "MDR", "⟨date⟩", "⟨Finance⟩", ""),
        ("Cyber / liability insurance", "Policy", "₹55,000/yr", "⟨date⟩", "⟨Founder⟩", "Recommended before enterprise"),
        ("Trademark (name, logo)", "Registration", "₹45,000 once", "10 years", "⟨Founder⟩", "2 classes filed"),
        ("Privacy policy & ToS", "Legal docs", "Drafting fee", "Annual review", "⟨Security⟩", "Counsel-reviewed"),
    ]
    r = 5
    for row in licences:
        for i, val in enumerate(row):
            put(lic, r, 1 + i, val, bold=(i == 0), wrap=(i == 5))
        r += 1
    lic.freeze_panes = "A5"

    # Offboarding
    off = wb.create_sheet("Offboarding")
    sheet_title(off, "Access Transfer & Offboarding Checklist",
                "Complete this within 24 hours of any departure. Tick each line and initial it.")
    widths(off, {"A": 8, "B": 52, "C": 18, "D": 16, "E": 36})
    header(off, 4, ["#", "Task", "Owner", "Timing", "Evidence / notes"])

    tasks = [
        (1, "Deactivate CRM user account", "⟨Admin⟩", "Same day", "Screenshot of inactive status"),
        (2, "Remove from GitHub organization", "⟨Eng Lead⟩", "Same day", "Screenshot of members list"),
        (3, "Remove from Vercel team", "⟨Eng Lead⟩", "Same day", ""),
        (4, "Remove from MongoDB Atlas organization", "⟨SRE⟩", "Same day", ""),
        (5, "Remove/deactivate AWS IAM user", "⟨SRE⟩", "Same day", "Confirm no access keys remain"),
        (6, "Remove from payment dashboards", "⟨Finance⟩", "Same day", "Razorpay + Cashfree"),
        (7, "Remove from email/SMS providers", "⟨Support⟩", "Same day", ""),
        (8, "Remove from password manager vault", "⟨Founder⟩", "Same day", "Check shared folders"),
        (9, "Rotate any secret the person had access to", "⟨Eng Lead⟩", "Within 24 h", "JWT, DB, S3, webhook secrets"),
        (10, "Revoke code-signing / keystore access", "⟨Desktop/Mobile⟩", "Same day", "Move to new custodian"),
        (11, "Recover hardware (laptop, phone, keys)", "⟨Ops⟩", "Last day", "Wipe and reimage"),
        (12, "Reassign owned systems in Systems_Owners", "⟨Founder⟩", "Within 3 days", "This workbook"),
        (13, "Decide whether their sessions need immediate revocation", "⟨Security⟩", "Same day", "Rotate JWT_SECRET if yes"),
        (14, "Confirm no uncommitted work is lost", "⟨Eng Lead⟩", "Within 3 days", "Check open branches"),
        (15, "Update the access register", "⟨Security⟩", "Within 3 days", "Accounts_Access sheet"),
    ]
    r = 5
    for num, task, owner, timing, ev in tasks:
        put(off, r, 1, num, fmt=NUM)
        put(off, r, 2, task, wrap=True)
        put(off, r, 3, owner)
        put(off, r, 4, timing)
        put(off, r, 5, ev, wrap=True, fill="input")
        r += 1
    off.freeze_panes = "A5"

    order = ["README", "Systems_Owners", "Vendors", "Accounts_Access", "Credential_Rotation",
             "Vendor_Contacts", "Tech_Debt", "Roadmap", "Releases_Artefacts", "Licences", "Offboarding"]
    wb._sheets = [wb[n] for n in order if n in wb.sheetnames]

    readme(wb, [
        ("h", "HappyPix — Ownership, Vendors & Handover Register"),
        ("s", "The document that makes the business transferable."),
        ("", ""),
        ("b", "Why this exists"),
        ("", "A company is only worth what survives its founders. This workbook records who owns every"),
        ("", "system, what it costs, when it renews, who can access it, and what is still broken."),
        ("", ""),
        ("b", "Sheet guide"),
        ("", "Systems_Owners — every component with a primary and backup owner."),
        ("", "Vendors — plans, monthly cost, renewal dates, exit path, contract location."),
        ("", "Accounts_Access — who can log in where. NEVER store passwords here."),
        ("", "Credential_Rotation — rotation cadence, last rotation, procedure."),
        ("", "Vendor_Contacts — support channels and escalation for each provider."),
        ("", "Tech_Debt — known debt with severity, owner and target."),
        ("", "Roadmap — quarterly priorities with the reason behind each."),
        ("", "Releases_Artefacts — versions, commits and SHA-256 checksums of shipped binaries."),
        ("", "Licences — certificates, SDK agreements, open-source obligations."),
        ("", "Offboarding — the checklist that must be completed within 24 hours of a departure."),
        ("", ""),
        ("b", "Rules for keeping this accurate"),
        ("", "1. Any new vendor goes in Vendors on the day it is signed up."),
        ("", "2. Any new secret goes in Credential_Rotation with a due date."),
        ("", "3. Every release adds a row in Releases_Artefacts with its checksum."),
        ("", "4. Review monthly; an out-of-date handover register is worse than none."),
        ("", ""),
        ("b", "Placeholders"),
        ("", "Values in ⟨angle brackets⟩ must be filled by the business owner. They are intentionally"),
        ("", "obvious so that an incomplete handover cannot look complete."),
        ("", ""),
        ("b", "Security"),
        ("", "This file must not contain passwords, API keys, private keys or keystore passwords."),
        ("", "It records access and ownership only. Store credentials in the approved vault."),
    ], "Handover Register — README", "HappyPix V2 · prepared 2026-10-23 · contains no credentials")

    finish(wb, os.path.join(OUT_DIR, "HANDOVER_REGISTER.xlsx"))


if __name__ == "__main__":
    build_financial_model()
    build_unit_economics()
    build_handover()
    print("\nAll three workbooks written to", OUT_DIR)
