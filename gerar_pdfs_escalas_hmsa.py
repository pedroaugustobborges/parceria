#!/usr/bin/env python3
"""
gerar_pdfs_escalas_hmsa.py
===========================
Gera um PDF por mês por contrato vinculado ao HMSA.
Replica fielmente o exportToPDF() do frontend (jsPDF + autotable).

  pdf_escalas_hmsa/
    <nome_contrato>/
      YYYY-MM_<nome_contrato>.pdf

Uso:
  pip install fpdf2 requests
  python gerar_pdfs_escalas_hmsa.py

  # No servidor (Kong interno):
  USE_INTERNAL=1 python gerar_pdfs_escalas_hmsa.py
"""

import os, sys, re, json, calendar, requests
from pathlib import Path
from datetime import datetime, date, timedelta
from collections import defaultdict

try:
    from fpdf import FPDF
except ImportError:
    print("ERRO: fpdf2 nao instalado. Execute: pip install fpdf2")
    sys.exit(1)

# ── Config ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).parent
DOTENV_PATH  = SCRIPT_DIR / ".env"
DOTENV_SRV   = Path("/opt/parceria/.env")
NM_UNIDADE   = "HMSA"
OUTPUT_DIR   = SCRIPT_DIR / "pdf_escalas_hmsa"
USE_INTERNAL = os.getenv("USE_INTERNAL", "0") == "1"
INTERNAL_URL = "http://localhost:8000"

# ── Layout ─────────────────────────────────────────────────────────────────────
MARGIN  = 15      # mm lateral
HDR_H   = 35      # altura cabeçalho azul
TBL_Y   = 41      # y onde a tabela de dados começa (abaixo do header azul)
FONT_SZ = 8       # fonte dados
HDR_SZ  = 8       # fonte header de coluna
LINE_H  = 5.0     # altura de linha de texto
PAD_H   = 2.0     # padding horizontal interno
PAD_V   = 2.0     # padding vertical interno

# ── Cores ──────────────────────────────────────────────────────────────────────
C_PRIMARY  = (14,  165, 233)
C_GOLD     = (251, 191,  36)
C_AMBER_BG = (255, 243, 205)
C_AMBER_TX = (217, 119,   6)
C_ALT      = (245, 247, 250)
C_WHITE    = (255, 255, 255)
C_BLACK    = (0,     0,   0)
C_GRAY     = (100, 100, 100)
C_GREEN_DK = ( 22, 163,  74)
C_GREEN_LT = (220, 252, 231)
C_BORDER   = (210, 210, 210)

# ── Colunas ────────────────────────────────────────────────────────────────────
# Contrato/Parceiro/Unidade omitidos: cada PDF é de um único contrato,
# essas informações já estão no cabeçalho da página.
# Espaço livre redistribuído para Item e Médicos → menos wrapping, mais legível.

# Sem Docs no PEP — 6 colunas → 267mm
COLS_NO_PEP = [
    ("Data",     28, "C"),
    ("Horario",  30, "C"),
    ("Item",     68, "L"),
    ("Medicos",  74, "L"),
    ("Status",   43, "C"),
    ("Pago?",    24, "C"),
]  # 28+30+68+74+43+24 = 267

# Com Docs no PEP — 7 colunas → 267mm
COLS_WITH_PEP = [
    ("Data",      26, "C"),
    ("Horario",   28, "C"),
    ("Item",      62, "L"),
    ("Medicos",   68, "L"),
    ("Docs PEP",  20, "C"),
    ("Status",    40, "C"),
    ("Pago?",     23, "C"),
]  # 26+28+62+68+20+40+23 = 267


# ── Env / credentials ──────────────────────────────────────────────────────────

def load_env_file(path: Path) -> dict:
    env = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def get_config() -> tuple[str, str]:
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY")
    url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    if not key or not url:
        for dotenv in (DOTENV_PATH, DOTENV_SRV):
            env = load_env_file(dotenv)
            if env:
                key = key or env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
                url = url or env.get("VITE_SUPABASE_URL") or env.get("SUPABASE_URL")
                if key and url:
                    print(f"  Credenciais: {dotenv}")
                    break
    if not key or not url:
        print(f"ERRO: credenciais nao encontradas em {DOTENV_PATH}")
        sys.exit(1)
    base = INTERNAL_URL if USE_INTERNAL else url.rstrip("/")
    return base, key


# ── REST client ────────────────────────────────────────────────────────────────

class SupabaseClient:
    def __init__(self, base: str, key: str):
        self.base = f"{base}/rest/v1"
        self.h = {
            "apikey":        key,
            "Authorization": f"Bearer {key}",
            "Content-Type":  "application/json",
        }

    def select(self, table: str, params: dict | None = None) -> list:
        all_rows, page_size, offset = [], 1000, 0
        while True:
            p = {**(params or {}), "limit": str(page_size), "offset": str(offset)}
            r = requests.get(f"{self.base}/{table}", headers=self.h, params=p, timeout=30)
            r.raise_for_status()
            batch = r.json()
            all_rows.extend(batch)
            if len(batch) < page_size:
                break
            offset += page_size
        return all_rows


# ── Billing (replica calculateEscalaBillingQuantity) ───────────────────────────

UNIT_BASED = {
    "atendimento ambulatorial","atendimento domiciliar","auxilio","auxílio",
    "cirurgia","consulta","diaria","diária","intervencao","intervenção",
    "parecer medico","parecer médico","periodo","período","plantao","plantão",
    "procedimento","sobreaviso","unidade","visita",
}
MONTHLY_BASED = {"carga horaria mensal","carga horária mensal","do mensal estimado"}
WEEKLY_BASED  = {"carga horaria semanal","carga horária semanal"}


def days_in_month(date_str: str) -> int:
    y, m, _ = date_str.split("-")
    return calendar.monthrange(int(y), int(m))[1]


def calc_escala_hours(entrada: str, saida: str) -> float:
    eh, em = map(int, entrada[:5].split(":"))
    sh, sm = map(int, saida[:5].split(":"))
    ent = eh * 60 + em
    sai = sh * 60 + sm
    dur = (sai - ent) if sai >= ent else (1440 - ent + sai)
    return dur / 60


def calc_total_hours(escala: dict) -> float:
    if escala.get("base_calculo") == "producao" and escala.get("quantidade_producao") is not None:
        return float(escala["quantidade_producao"])
    if (escala.get("status") == "Aprovado com Glosa"
            and escala.get("horario_pagamento_inicio")
            and escala.get("horario_pagamento_fim")):
        try:
            ini = datetime.fromisoformat(escala["horario_pagamento_inicio"].replace("Z", "+00:00"))
            fim = datetime.fromisoformat(escala["horario_pagamento_fim"].replace("Z", "+00:00"))
            hours = (fim - ini).total_seconds() / 3600
        except Exception:
            hours = calc_escala_hours(escala["horario_entrada"], escala["horario_saida"])
    else:
        hours = calc_escala_hours(escala["horario_entrada"], escala["horario_saida"])
    return hours * len(escala.get("medicos") or [])


def calc_billing_qty(escala: dict, unidade_medida: str | None) -> float:
    um = (unidade_medida or "").lower().strip()
    if um in MONTHLY_BASED:
        return 1 / days_in_month(escala["data_inicio"])
    if um in WEEKLY_BASED:
        return 1 / 7
    if um in UNIT_BASED:
        return 1.0
    return calc_total_hours(escala)


# ── Docs no PEP helpers ────────────────────────────────────────────────────────

PEP_COLS = "nome,data,prescricao,diagnostico,encaminhamento,parecer,anotacao,avaliacao,documento_eletronico,evolucao,alta_medica"


def _pep_sum(row: dict) -> int:
    return sum(row.get(c) or 0 for c in (
        "prescricao","diagnostico","encaminhamento","parecer",
        "anotacao","avaliacao","documento_eletronico","evolucao","alta_medica",
    ))


def is_overnight(entrada: str, saida: str) -> bool:
    return saida[:5] < entrada[:5]


def build_pep_map(client: SupabaseClient, escalas: list) -> dict[tuple, int]:
    """
    Retorna {(nome, data_str): pep_total} para todas as escalas do mês.
    Usa lista de tuplas nos params para passar 'data' duas vezes (range PostgREST).
    """
    if not escalas:
        return {}

    dates: set[str] = set()
    for esc in escalas:
        d = date.fromisoformat(esc["data_inicio"])
        dates.add(str(d))
        if is_overnight(esc["horario_entrada"], esc["horario_saida"]):
            dates.add(str(d + timedelta(days=1)))

    sorted_dates = sorted(dates)

    # Lista de tuplas: único jeito de repetir a mesma chave ('data') em requests
    params = [
        ("select", PEP_COLS),
        ("data",   f"gte.{sorted_dates[0]}"),
        ("data",   f"lte.{sorted_dates[-1]}"),
        ("limit",  "10000"),
    ]
    r = requests.get(
        f"{client.base}/produtividade",
        headers=client.h,
        params=params,
        timeout=60,
    )
    r.raise_for_status()
    rows = r.json()

    pep_map: dict[tuple, int] = defaultdict(int)
    for row in rows:
        if row.get("data") in dates:
            pep_map[(row["nome"], row["data"])] += _pep_sum(row)
    return dict(pep_map)


def calc_docs_pep(escala: dict, pep_map: dict) -> int:
    medicos_raw = escala.get("medicos") or []
    if isinstance(medicos_raw, str):
        try:
            medicos_raw = json.loads(medicos_raw)
        except Exception:
            medicos_raw = []
    d = escala["data_inicio"]
    overnight = is_overnight(escala["horario_entrada"], escala["horario_saida"])
    d_next = str(date.fromisoformat(d) + timedelta(days=1)) if overnight else None
    total = 0
    for m in medicos_raw:
        nome = m.get("nome", "")
        total += pep_map.get((nome, d), 0)
        if d_next:
            total += pep_map.get((nome, d_next), 0)
    return total


# ── Formatação ─────────────────────────────────────────────────────────────────

_SUBS = str.maketrans({
    '\u2013': '-', '\u2014': '-',
    '\u2018': "'", '\u2019': "'",
    '\u201C': '"', '\u201D': '"',
    '\u2026': '...', '\u2022': '-',
    '\u00A0': ' ', '\u00B7': '.',
})


def _safe(text: str | None) -> str:
    if not text:
        return ""
    return text.translate(_SUBS).encode("latin-1", errors="replace").decode("latin-1")


def _est_lines(txt: str, w_mm: float, font_size: int = FONT_SZ) -> int:
    if not txt:
        return 1
    # Factor 0.55 (vs 0.45) = overestimate lines → rows taller than needed
    # rather than too short (which causes mid-row page breaks).
    avg_char_w = font_size * 0.55 * 0.352778
    chars_per_line = max(1, int(w_mm / avg_char_w))
    n = 0
    for part in txt.split("\n"):
        n += max(1, (len(part) + chars_per_line - 1) // chars_per_line)
    return n


def fmt_currency(v: float) -> str:
    return f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def fmt_date(date_str: str) -> str:
    y, m, d = date_str[:10].split("-")
    return f"{d}/{m}/{y}"


def fmt_horario(escala: dict) -> str:
    base = f"{escala['horario_entrada'][:5]} - {escala['horario_saida'][:5]}"
    if (escala.get("status") == "Aprovado com Glosa"
            and escala.get("horario_pagamento_inicio")
            and escala.get("horario_pagamento_fim")):
        try:
            ini = datetime.fromisoformat(escala["horario_pagamento_inicio"].replace("Z", "+00:00"))
            fim = datetime.fromisoformat(escala["horario_pagamento_fim"].replace("Z", "+00:00"))
            base += f"\nPgto: {ini.strftime('%H:%M')} - {fim.strftime('%H:%M')}"
        except Exception:
            pass
    return base


def mes_label(ym: str) -> str:
    MESES = ["Janeiro","Fevereiro","Marco","Abril","Maio","Junho",
             "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
    y, m = ym.split("-")
    return f"{MESES[int(m)-1]}/{y}"


def sanitize(name: str) -> str:
    return re.sub(r'[<>:"/\\|?*]', "_", name).strip()


def medicos_names(escala: dict) -> str:
    raw = escala.get("medicos") or []
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            return raw
    return "\n".join(m.get("nome", "") for m in raw)


# ── Memorial / totais ──────────────────────────────────────────────────────────

def build_memorial(escalas: list, itens_map: dict, ci_map: dict, contrato_id: str) -> list:
    acc: dict[str, dict] = {}
    for esc in escalas:
        iid  = esc.get("item_contrato_id")
        ci   = ci_map.get((contrato_id, iid))
        nome = itens_map.get(iid, {}).get("nome", f"Item {iid}")
        val  = ci.get("valor_unitario", 0) if ci else 0
        um   = ci.get("unidade_medida") if ci else None
        qty  = calc_billing_qty(esc, um)
        if nome not in acc:
            acc[nome] = {"nome": nome, "valor_unitario": val, "total_qty": 0.0, "total_valor": 0.0}
        acc[nome]["total_qty"]   += qty
        acc[nome]["total_valor"] += val * qty
    return list(acc.values())


def calc_approved_value(escalas: list, ci_map: dict, contrato_id: str) -> float:
    total = 0.0
    for esc in escalas:
        if esc.get("status") not in ("Aprovado", "Aprovado com Glosa"):
            continue
        iid = esc.get("item_contrato_id")
        ci  = ci_map.get((contrato_id, iid))
        if ci and ci.get("valor_unitario"):
            total += ci["valor_unitario"] * calc_billing_qty(esc, ci.get("unidade_medida"))
    return total


# ── PDF class ──────────────────────────────────────────────────────────────────

class EscalasPDF(FPDF):
    """PDF A4 landscape replicando o exportToPDF() do frontend."""

    def __init__(self, meta: dict, cols: list):
        super().__init__(orientation="L", unit="mm", format="A4")
        self.meta = meta
        self.cols = cols
        self.set_margins(MARGIN, TBL_Y, MARGIN)
        self.set_auto_page_break(auto=True, margin=20)
        self._valor_total  = 0.0
        self._qt_aprovadas = 0
        self._qt_pagas     = 0

    # ── fpdf2 hooks ────────────────────────────────────────────────────────────

    def header(self):
        pw = self.w

        # Fundo azul
        self.set_fill_color(*C_PRIMARY)
        self.rect(0, 0, pw, HDR_H, "F")

        # "Parcer" (branco) + "IA" (dourado) — coordenadas iguais ao frontend
        self.set_text_color(*C_WHITE)
        self.set_font("Helvetica", "B", 24)
        self.text(15, 15, "Parcer")
        self.set_text_color(*C_GOLD)
        self.text(43, 15, "IA")

        # Subtítulo e título
        self.set_text_color(*C_WHITE)
        self.set_font("Helvetica", "", 10)
        self.text(15, 22, "Gestao Inteligente de Acessos e Parcerias")
        self.set_font("Helvetica", "B", 16)
        self.text(15, 32, "Relatorio de Escalas Medicas")

        # Metadados — lado direito
        now = datetime.now().strftime("%d/%m/%Y as %H:%M")
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*C_WHITE)
        # Cada linha usa set_xy + cell(align="R") para alinhar à direita
        for y_pos, txt in [
            (11, f"Gerado em: {now}"),
            (17, f"Total de escalas: {self.meta['total_escalas']}"),
            (23, _safe(self.meta["contract_name"])),
            (29, f"{_safe(self.meta['empresa'])}  |  {_safe(self.meta['unidade_nome'])}"),
        ]:
            self.set_xy(0, y_pos)
            self.cell(pw - MARGIN, 5, txt, align="R")
        self.set_font("Helvetica", "I", 7)
        self.set_xy(0, 34)
        self.cell(pw - MARGIN, 4, "Powered by Daher.lab - Agir", align="R")

        # CRÍTICO: reposicionar cursor ABAIXO do cabeçalho azul
        # Sem isso, páginas automáticas desenham a tabela SOBRE o header
        self.set_xy(MARGIN, TBL_Y)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*C_GRAY)
        self.cell(0, 5, f"Pagina {self.page_no()}", align="C")

    # ── Primitiva de célula ────────────────────────────────────────────────────

    def _cell(self, x: float, y: float, w: float, h: float,
              txt: str, align: str,
              fill_rgb: tuple, txt_rgb: tuple,
              bold: bool = False, font_size: int = FONT_SZ):
        """
        Célula de tabela correta:
          1. rect preenchido (fundo)    → sem border
          2. multi_cell texto           → sem border, sem fill
          3. rect de borda              → apenas borda
        Cursor termina em (x+w, y) para encadear colunas.
        """
        # 1. Fundo
        self.set_fill_color(*fill_rgb)
        self.rect(x, y, w, h, "F")

        # 2. Texto
        self.set_text_color(*txt_rgb)
        self.set_font("Helvetica", "B" if bold else "", font_size)
        self.set_xy(x + PAD_H, y + PAD_V)
        self.multi_cell(
            w - 2 * PAD_H, LINE_H, txt,
            align=align, border=0, fill=False,
            max_line_height=LINE_H,
        )

        # 3. Borda
        self.set_draw_color(*C_BORDER)
        self.set_line_width(0.2)
        self.rect(x, y, w, h, "D")

        # Reposicionar para próxima coluna
        self.set_xy(x + w, y)

    # ── Cabeçalho da tabela ────────────────────────────────────────────────────

    def draw_table_header(self):
        y = self.get_y()
        x = MARGIN
        h = LINE_H + 2 * PAD_V
        for label, w, _ in self.cols:
            self._cell(x, y, w, h, label, "C",
                       fill_rgb=C_PRIMARY, txt_rgb=C_WHITE,
                       bold=True, font_size=HDR_SZ)
            x += w
        self.set_xy(MARGIN, y + h)

    # ── Linha de dados ─────────────────────────────────────────────────────────

    def draw_table_row(self, cell_values: list[tuple[str, float, str]],
                       is_glosa: bool, row_idx: int):
        """
        cell_values: lista de (texto, largura_mm, alinhamento)
        """
        fill = C_AMBER_BG if is_glosa else (C_ALT if row_idx % 2 == 1 else C_WHITE)
        txt  = C_AMBER_TX if is_glosa else C_BLACK

        # Estima altura da linha
        n = max(_est_lines(t, w - 2 * PAD_H) for t, w, _ in cell_values)
        row_h = max(n, 1) * LINE_H + 2 * PAD_V

        # Quebra de página
        if self.get_y() + row_h > self.page_break_trigger:
            self.add_page()
            self.draw_table_header()

        y0 = self.get_y()
        x  = MARGIN

        # Desabilita auto-page-break durante o desenho da linha para evitar que
        # multi_cell quebre a página no meio de uma linha, corrompendo o layout.
        self.set_auto_page_break(False)
        for cell_txt, w, align in cell_values:
            self._cell(x, y0, w, row_h, cell_txt, align, fill, txt)
            x += w
        self.set_auto_page_break(True, margin=20)

        self.set_xy(MARGIN, y0 + row_h)

    # ── Memorial Executivo de Cálculo ──────────────────────────────────────────

    def draw_memorial(self, rows: list):
        needed = (len(rows) + 3) * (LINE_H + 2 * PAD_V) + 22
        if self.get_y() + needed > self.page_break_trigger:
            self.add_page()

        self.ln(6)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(*C_PRIMARY)
        self.cell(0, 6, "Memorial Executivo de Calculo",
                  new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*C_GRAY)
        self.cell(0, 4, "Resumo consolidado por item de contrato com base nas escalas do mes.",
                  new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

        w_tot, w_qty, w_val = 40, 30, 42
        w_item = 267 - w_tot - w_qty - w_val   # 155

        hdr_cols = [("Item de Contrato", w_item, "L"),
                    ("Valor Unitario (R$)", w_val, "C"),
                    ("Quantidade", w_qty, "C"),
                    ("Total (R$)", w_tot, "R")]

        y = self.get_y()
        x = MARGIN
        h = LINE_H + 2 * PAD_V
        for label, w, align in hdr_cols:
            self._cell(x, y, w, h, label, align,
                       fill_rgb=C_PRIMARY, txt_rgb=C_WHITE,
                       bold=True, font_size=HDR_SZ)
            x += w
        self.set_xy(MARGIN, y + h)

        grand = 0.0
        for i, row in enumerate(rows):
            fill = C_ALT if i % 2 == 1 else C_WHITE
            y = self.get_y()
            x = MARGIN
            rh = LINE_H + 2 * PAD_V
            self._cell(x, y, w_item, rh, _safe(row["nome"]),  "L", fill, C_BLACK); x += w_item
            self._cell(x, y, w_val,  rh, f"R$ {fmt_currency(row['valor_unitario'])}", "C", fill, C_BLACK); x += w_val
            self._cell(x, y, w_qty,  rh, f"{row['total_qty']:.2f}", "C", fill, C_BLACK); x += w_qty
            self._cell(x, y, w_tot,  rh, f"R$ {fmt_currency(row['total_valor'])}", "R", fill, C_BLACK)
            self.set_xy(MARGIN, y + rh)
            grand += row["total_valor"]

        # Total geral
        y = self.get_y()
        x = MARGIN
        rh = LINE_H + 2 * PAD_V
        self._cell(x, y, w_item, rh, "TOTAL GERAL", "L", C_GREEN_LT, C_GREEN_DK, bold=True); x += w_item
        self._cell(x, y, w_val,  rh, "", "C", C_GREEN_LT, C_GREEN_DK); x += w_val
        self._cell(x, y, w_qty,  rh, "", "C", C_GREEN_LT, C_GREEN_DK); x += w_qty
        self._cell(x, y, w_tot,  rh, f"R$ {fmt_currency(grand)}", "R", C_GREEN_LT, C_GREEN_DK, bold=True)
        self.set_xy(MARGIN, y + rh)

    # ── Caixa verde de resumo (última página) ──────────────────────────────────

    def draw_summary_box(self):
        if self._qt_aprovadas == 0:
            return
        pw, ph = self.w, self.h
        bw, bh = 150, 22
        bx = pw - MARGIN - bw
        by = ph - 15 - bh

        self.set_fill_color(46, 204, 113)
        self.rect(bx, by, bw, bh, "F")   # rounded_rect varia por versão do fpdf2

        self.set_text_color(*C_WHITE)
        self.set_font("Helvetica", "B", 7)
        self.set_xy(bx, by + 3)
        self.cell(bw, 5, "VALOR TOTAL DAS ESCALAS APROVADAS (incl. Aprovado com Glosa)", align="C")
        self.set_font("Helvetica", "", 7)
        self.set_xy(bx, by + 9)
        self.cell(bw, 5, f"Qtd: {self._qt_aprovadas}  |  Pagas: {self._qt_pagas}", align="C")
        self.set_font("Helvetica", "B", 9)
        self.set_xy(bx, by + 15)
        self.cell(bw, 5, f"Valor Total: R$ {fmt_currency(self._valor_total)}", align="C")

        self.set_font("Helvetica", "I", 6)
        self.set_text_color(*C_GRAY)
        self.set_xy(MARGIN, by + 10)
        self.cell(0, 4, "* Calculo: Horas trabalhadas x Valor unitario x No de medicos")


# ── Fetch dados ────────────────────────────────────────────────────────────────

def fetch_hmsa_unit(client: SupabaseClient) -> dict:
    uhs = client.select("unidades_hospitalares", {
        "codigo": f"eq.{NM_UNIDADE}",
        "select": "id,codigo,nome,possui_gestao_acesso",
    })
    if not uhs:
        print(f"ERRO: Unidade '{NM_UNIDADE}' nao encontrada.")
        sys.exit(1)
    return uhs[0]


def fetch_contratos(client: SupabaseClient, uh_id: str) -> list:
    return client.select("contratos", {
        "unidade_hospitalar_id": f"eq.{uh_id}",
        "ativo":  "eq.true",
        "select": "id,nome,empresa",
    })


def fetch_itens_map(client: SupabaseClient) -> dict:
    itens = client.select("itens_contrato", {"select": "id,nome"})
    return {i["id"]: i for i in itens}


def fetch_ci_map(client: SupabaseClient) -> dict:
    ci = client.select("contrato_itens",
                       {"select": "contrato_id,item_id,valor_unitario,unidade_medida"})
    return {(r["contrato_id"], r["item_id"]): r for r in ci}


def fetch_escalas(client: SupabaseClient, contrato_id: str) -> list:
    return client.select("escalas_medicas", {
        "contrato_id": f"eq.{contrato_id}",
        "ativo":       "eq.true",
        "select":      "id,data_inicio,horario_entrada,horario_saida,item_contrato_id,"
                       "medicos,status,status_pagamento,horario_pagamento_inicio,"
                       "horario_pagamento_fim,base_calculo,quantidade_producao,contrato_id",
        "order":       "data_inicio.asc",
    })


# ── Geração do PDF ─────────────────────────────────────────────────────────────

def make_cell_values(escala: dict, itens_map: dict, cols: list,
                     pep_map: dict | None) -> list[tuple[str, float, str]]:
    """Monta a lista de (texto, largura, alinhamento) para cada coluna."""
    values = {
        "Data":     fmt_date(escala["data_inicio"]),
        "Horario":  _safe(fmt_horario(escala)),
        "Item":     _safe(itens_map.get(escala.get("item_contrato_id"), {}).get("nome", "")),
        "Medicos":  _safe(medicos_names(escala)),
        "Status":   _safe(escala.get("status", "")),
        "Pago?":    _safe(escala.get("status_pagamento", "")),
    }
    if pep_map is not None:
        values["Docs PEP"] = str(calc_docs_pep(escala, pep_map))

    return [(values[label], w, align) for label, w, align in cols]


def generate_pdf(escalas_mes: list, contrato: dict, unidade_nome: str,
                 ym: str, itens_map: dict, ci_map: dict,
                 cols: list, pep_map: dict | None,
                 output_path: Path):
    meta = {
        "contract_name": contrato["nome"],
        "empresa":       contrato["empresa"],
        "unidade_nome":  unidade_nome,
        "mes":           mes_label(ym),
        "total_escalas": len(escalas_mes),
    }

    pdf = EscalasPDF(meta, cols)
    pdf.add_page()

    # Tabela principal
    pdf.draw_table_header()
    for idx, esc in enumerate(escalas_mes):
        is_glosa = esc.get("status") == "Aprovado com Glosa"
        cells = make_cell_values(esc, itens_map, cols, pep_map)
        pdf.draw_table_row(cells, is_glosa, idx)

    # Memorial
    memorial_rows = build_memorial(escalas_mes, itens_map, ci_map, contrato["id"])
    if memorial_rows:
        pdf.draw_memorial(memorial_rows)

    # Caixa verde
    pdf._valor_total  = calc_approved_value(escalas_mes, ci_map, contrato["id"])
    pdf._qt_aprovadas = sum(1 for e in escalas_mes
                            if e.get("status") in ("Aprovado", "Aprovado com Glosa"))
    pdf._qt_pagas     = sum(1 for e in escalas_mes if e.get("status_pagamento") == "Sim")
    pdf.draw_summary_box()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(output_path))
    print(f"    -> {output_path.name}  ({len(escalas_mes)} escalas)")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("=" * 65)
    print("ParcerIA — Geracao de PDFs de Escalas HMSA por Mes/Contrato")
    print("=" * 65)
    print(f"  Saida: {OUTPUT_DIR.resolve()}\n")

    base_url, key = get_config()
    client = SupabaseClient(base_url, key)
    print(f"Conectando a: {base_url}\n")

    uh = fetch_hmsa_unit(client)
    print(f"Unidade: {uh['nome']} (id={uh['id']})")
    show_docs_pep = not uh.get("possui_gestao_acesso", True)
    cols = COLS_WITH_PEP if show_docs_pep else COLS_NO_PEP
    print(f"  Docs no PEP: {'SIM' if show_docs_pep else 'NAO'}")

    contratos = fetch_contratos(client, uh["id"])
    print(f"  {len(contratos)} contrato(s) ativos")
    for c in contratos:
        print(f"    - {c['nome']} ({c['empresa']})")

    itens_map = fetch_itens_map(client)
    ci_map    = fetch_ci_map(client)

    total_pdfs = 0
    for contrato in contratos:
        cid   = contrato["id"]
        cnome = contrato["nome"]
        print(f"\n{'─'*60}")
        print(f"Contrato: {cnome}")

        escalas = fetch_escalas(client, cid)
        if not escalas:
            print("  Nenhuma escala ativa. Pulando.")
            continue
        print(f"  {len(escalas)} escala(s)")

        # Agrupa por mês
        por_mes: dict[str, list] = defaultdict(list)
        for esc in escalas:
            por_mes[esc["data_inicio"][:7]].append(esc)
        print(f"  {len(por_mes)} mes(es): {', '.join(sorted(por_mes))}")

        folder = OUTPUT_DIR / sanitize(cnome)
        folder.mkdir(parents=True, exist_ok=True)

        for ym in sorted(por_mes):
            escalas_mes = por_mes[ym]

            # Pré-carrega PEP apenas se necessário
            pep_map = build_pep_map(client, escalas_mes) if show_docs_pep else None

            output_path = folder / f"{ym}_{sanitize(cnome)}.pdf"
            generate_pdf(
                escalas_mes  = escalas_mes,
                contrato     = contrato,
                unidade_nome = uh["nome"],
                ym           = ym,
                itens_map    = itens_map,
                ci_map       = ci_map,
                cols         = cols,
                pep_map      = pep_map,
                output_path  = output_path,
            )
            total_pdfs += 1

    print(f"\n{'='*65}")
    print(f"Concluido — {total_pdfs} PDF(s) em '{OUTPUT_DIR.resolve()}'")
    print("=" * 65)


if __name__ == "__main__":
    main()
