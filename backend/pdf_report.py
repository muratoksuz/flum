"""PDF report generation for Nakit using reportlab."""
import io
from datetime import date, datetime
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
)


def _fmt_amount(v, cur="TRY") -> str:
    try:
        n = float(v or 0)
    except (TypeError, ValueError):
        return "-"
    tag = {"TRY": "₺", "USD": "$", "EUR": "€", "XAU": "gr Au", "XAG": "gr Ag"}.get(cur or "TRY", cur)
    formatted = f"{n:,.2f} {tag}"
    return formatted.replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_date(iso: str) -> str:
    if not iso:
        return "-"
    try:
        return date.fromisoformat(iso).strftime("%d/%m/%Y")
    except Exception:
        try:
            return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime("%d/%m/%Y")
        except Exception:
            return iso


STYLES = getSampleStyleSheet()
BODY = ParagraphStyle("body", parent=STYLES["BodyText"], fontName="Helvetica", fontSize=9, leading=12)
LABEL = ParagraphStyle("label", parent=BODY, textColor=colors.HexColor("#737373"), fontSize=7, spaceAfter=2)
H1 = ParagraphStyle("h1", parent=STYLES["Heading1"], fontName="Helvetica-Bold", fontSize=22, textColor=colors.HexColor("#0A0A0A"), spaceAfter=6)
H2 = ParagraphStyle("h2", parent=STYLES["Heading2"], fontName="Helvetica-Bold", fontSize=13, textColor=colors.HexColor("#0A0A0A"), spaceBefore=10, spaceAfter=6)


def _table(header: list, rows: list, col_widths=None) -> Table:
    data = [header] + rows if rows else [header, ["—"] * len(header)]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#525252")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F5F5F5")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.7, colors.HexColor("#D4D4D4")),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#0A0A0A")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFAFA")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def _stat_row(items: list) -> Table:
    """items: [(label, value), ...]"""
    row = [[
        Paragraph(f"<font color='#737373' size='7'>{lbl.upper()}</font><br/><font name='Helvetica-Bold' size='14' color='#0A0A0A'>{val}</font>", BODY)
        for lbl, val in items
    ]]
    t = Table(row, colWidths=[(180 / len(items)) * mm] * len(items))
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D4D4D4")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D4D4D4")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def build_report_pdf(
    *,
    user: dict,
    summary: dict,
    receivables: list,
    expenses: list,
    banks: list,
    cards: list,
    upcoming: list,
    todos: list,
    rates: dict | None,
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
        title="Nakit Akış Raporu",
    )
    story = []

    # Header
    now = datetime.now().strftime("%d/%m/%Y %H:%M")
    story.append(Paragraph("<font color='#737373' size='7'>FLUM · NAKİT AKIŞ RAPORU</font>", LABEL))
    story.append(Paragraph("Nakit Akış Raporu", H1))
    story.append(Paragraph(
        f"<font color='#525252'>Kullanıcı: <b>{user.get('name', '')}</b> · {user.get('email', '')} · Oluşturuldu: {now}</font>",
        BODY,
    ))
    story.append(Spacer(1, 10))

    # Stats
    story.append(_stat_row([
        ("Net Pozisyon", _fmt_amount(summary.get("net_position", 0))),
        ("Bekleyen Alacak", _fmt_amount(summary.get("total_receivable_pending", 0))),
        ("Bekleyen Gider", _fmt_amount(summary.get("total_expense_pending", 0))),
        ("Banka Bakiyesi", _fmt_amount(summary.get("total_bank_balance", 0))),
    ]))
    story.append(Spacer(1, 4))
    story.append(_stat_row([
        ("Kart Borcu", _fmt_amount(summary.get("total_card_debt", 0))),
        ("Kart Limiti", _fmt_amount(summary.get("total_card_limit", 0))),
        ("Kayıt: Alacak", str(summary.get("counts", {}).get("receivables", 0))),
        ("Kayıt: Gider", str(summary.get("counts", {}).get("expenses", 0))),
    ]))

    # Rates
    if rates and rates.get("rates_to_try"):
        r = rates["rates_to_try"]
        story.append(Paragraph("Kur Anlık Değerleri", H2))
        story.append(_table(
            ["Sembol", "Karşılık (₺)"],
            [
                ["USD", _fmt_amount(r.get("USD"))],
                ["EUR", _fmt_amount(r.get("EUR"))],
                ["Gr Altın (XAU)", _fmt_amount(r.get("XAU"))],
                ["Gr Gümüş (XAG)", _fmt_amount(r.get("XAG"))],
            ],
            col_widths=[90 * mm, 90 * mm],
        ))

    # Upcoming
    story.append(Paragraph("Yaklaşan Ödemeler (30 gün)", H2))
    if upcoming:
        rows = [[
            {"receivable": "Alacak", "expense": "Gider", "credit_card": "Kredi Kartı"}.get(u["type"], u["type"]),
            u["title"], u.get("category") or "-",
            _fmt_date(u["due_date"]),
            _fmt_amount(u["amount"]),
            "Gecikmiş" if u["days_left"] < 0 else ("Bugün" if u["days_left"] == 0 else f"{u['days_left']} gün"),
        ] for u in upcoming]
    else:
        rows = []
    story.append(_table(["Tür", "Başlık", "Kategori", "Vade", "Tutar", "Durum"], rows,
                       col_widths=[22 * mm, 55 * mm, 30 * mm, 22 * mm, 30 * mm, 21 * mm]))

    # Receivables
    story.append(Paragraph(f"Alacaklar ({len(receivables)})", H2))
    rows = [[
        r.get("debtor", ""), r.get("category") or "-",
        _fmt_date(r.get("due_date")),
        _fmt_amount(r.get("amount", 0), r.get("currency", "TRY")),
        "Ödendi" if r.get("status") == "paid" else "Bekliyor",
    ] for r in receivables]
    story.append(_table(["Borçlu", "Kategori", "Vade", "Tutar", "Durum"], rows,
                       col_widths=[60 * mm, 35 * mm, 25 * mm, 40 * mm, 20 * mm]))

    # Expenses
    story.append(Paragraph(f"Giderler ({len(expenses)})", H2))
    rows = [[
        e.get("payee", ""), e.get("category") or "-",
        _fmt_date(e.get("due_date")),
        _fmt_amount(e.get("amount", 0), e.get("currency", "TRY")),
        "Ödendi" if e.get("status") == "paid" else "Bekliyor",
    ] for e in expenses]
    story.append(_table(["Alıcı", "Kategori", "Vade", "Tutar", "Durum"], rows,
                       col_widths=[60 * mm, 35 * mm, 25 * mm, 40 * mm, 20 * mm]))

    story.append(PageBreak())

    # Banks
    story.append(Paragraph(f"Banka Hesapları ({len(banks)})", H2))
    rows = [[
        b.get("bank_name", ""), b.get("account_name", ""),
        b.get("iban") or "-",
        _fmt_amount(b.get("balance", 0), b.get("currency", "TRY")),
    ] for b in banks]
    story.append(_table(["Banka", "Hesap", "IBAN", "Bakiye"], rows,
                       col_widths=[45 * mm, 45 * mm, 55 * mm, 35 * mm]))

    # Cards
    story.append(Paragraph(f"Kredi Kartları ({len(cards)})", H2))
    rows = [[
        c.get("bank_name", ""), c.get("card_name", ""),
        _fmt_amount(c.get("credit_limit", 0)),
        _fmt_amount(c.get("current_debt", 0)),
        f"Ekstre {c.get('statement_day', '?')} / Son {c.get('due_day', '?')}",
    ] for c in cards]
    story.append(_table(["Banka", "Kart", "Limit", "Borç", "Günler"], rows,
                       col_widths=[40 * mm, 40 * mm, 35 * mm, 35 * mm, 30 * mm]))

    # Todos
    story.append(Paragraph(f"Yapılacaklar ({len(todos)})", H2))
    rows = [[
        t.get("title", ""),
        {"low": "Düşük", "medium": "Orta", "high": "Yüksek"}.get(t.get("priority", "medium"), "Orta"),
        _fmt_date(t.get("due_date")),
        "Tamamlandı" if t.get("completed") else "Bekliyor",
    ] for t in todos]
    story.append(_table(["Görev", "Öncelik", "Bitiş", "Durum"], rows,
                       col_widths=[95 * mm, 25 * mm, 30 * mm, 30 * mm]))

    doc.build(story)
    return buf.getvalue()
