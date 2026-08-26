#!/usr/bin/env python3
"""
gerar_pdfs_escalas_hmsa.py
===========================
Gera um PDF por mês por contrato vinculado ao HMSA, replicando o layout
do botão "Exportar PDF" do frontend (jsPDF + autotable).

Estrutura de saída (criada na pasta onde o script é executado):
  pdf_escalas_hmsa/
    <nome_contrato>/
      YYYY-MM_<nome_contrato>.pdf
      ...

Layout do PDF por arquivo:
  1. Cabeçalho azul (#0ea5e9) com branding ParcerIA
  2. Metadados do contrato (nome, parceiro, unidade, mês)
  3. Tabela principal de escalas
       Data | Horário | Item Contrato | Médicos | Status | Pago?
       - Linhas amber (#FFF3CD) para "Aprovado com Glosa"
       - Linhas alternadas cinza claro (#f5f7fa)
  4. Memorial Executivo de Cálculo (agrupado por item)
  5. Rodapé: número de página em toda página;
             caixa verde com valor total apenas na última página

Uso:
  # Localmente (precisa de acesso à URL pública do Supabase):
  pip install fpdf2 requests
  python gerar_pdfs_escalas_hmsa.py

  # No servidor (usa Kong interno localhost:8000):
  USE_INTERNAL=1 python gerar_pdfs_escalas_hmsa.py
"""

import os
import sys
import re
import json
import calendar
import requests
from pathlib import Path
from datetime import datetime, timezone
from collections import defaultdict

try:
    from fpdf import FPDF
except ImportError:
    print("ERRO: fpdf2 não instalado. Execute: pip install fpdf2")
    sys.exit(1)

# ============================================================
# Configuração
# ============================================================

DOTENV_PATH   = Path("/opt/parceria/.env")
NM_UNIDADE    = "HMSA"
OUTPUT_DIR    = Path("pdf_escalas_hmsa")
USE_INTERNAL  = os.getenv("USE_INTERNAL", "0") == "1"
INTERNAL_URL  = "http://localhost:8000"


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
        env = load_env_file(DOTENV_PATH)
        key = key or env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")
        url = url or env.get("VITE_SUPABASE_URL")
    if not key or not url:
        print(f"ERRO: credenciais Supabase não encontradas ({DOTENV_PATH})")
        sys.exit(1)
    base = INTERNAL_URL if USE_INTERNAL else url.rstrip("/")
    return base, key


# ============================================================
# Cliente REST
# ============================================================

class SupabaseClient:
    def __init__(self, base: str, key: str):
        self.base = f"{base}/rest/v1"
        self.h = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    def select(self, table: str, params: dict | None = None) -> list:
        # Pagina automaticamente para superar limite de 1000 do PostgREST
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


# ============================================================
# Helpers — cálculo de billing (replica escalasHoursUtils.ts)
# ============================================================

UNIT_BASED = {
    "atendimento ambulatorial", "atendimento domiciliar", "auxílio",
    "cirurgia", "consulta", "diária", "intervenção", "parecer médico",
    "período", "plantão", "procedimento", "sobreaviso", "unidade", "visita",
}
MONTHLY_BASED = {"carga horária mensal", "do mensal estimado"}
WEEKLY_BASED  = {"carga horária semanal"}


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
    """Replica calculateTotalEscalaHours do TypeScript."""
    # 1. Produção
    if escala.get("base_calculo") == "producao" and escala.get("quantidade_producao") is not None:
        return float(escala["quantidade_producao"])
    # 2. Glosa com horários de pagamento
    if (escala.get("status") == "Aprovado com Glosa"
            and escala.get("horario_pagamento_inicio")
            and escala.get("horario_pagamento_fim")):
        fmt = "%Y-%m-%dT%H:%M:%S%z"
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
    """Replica calculateEscalaBillingQuantity do TypeScript."""
    um = (unidade_medida or "").lower().strip()
    if um in MONTHLY_BASED:
        return 1 / days_in_month(escala["data_inicio"])
    if um in WEEKLY_BASED:
        return 1 / 7
    if um in UNIT_BASED:
        return 1.0
    return calc_total_hours(escala)


# ============================================================
# Helpers — formatação
# ============================================================

def fmt_currency(v: float) -> str:
    return f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def fmt_date(date_str: str) -> str:
    """YYYY-MM-DD → DD/MM/YYYY"""
    y, m, d = date_str[:10].split("-")
    return f"{d}/{m}/{y}"


def fmt_horario(escala: dict) -> str:
    entrada = escala["horario_entrada"][:5]
    saida   = escala["horario_saida"][:5]
    base    = f"{entrada} - {saida}"
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
    """2025-11 → Novembro/2025"""
    MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
             "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
    y, m = ym.split("-")
    return f"{MESES[int(m)-1]}/{y}"


def sanitize(name: str) -> str:
    """Remove caracteres inválidos para nomes de arquivo/pasta."""
    return re.sub(r'[<>:"/\\|?*]', "_", name).strip()


def medicos_str(medicos) -> str:
    if isinstance(medicos, str):
        try:
            medicos = json.loads(medicos)
        except Exception:
            return medicos
    return "\n".join(m.get("nome", "") for m in medicos)


# ============================================================
# Memorial Executivo de Cálculo
# ============================================================

def build_memorial(escalas: list, itens_map: dict, contrato_itens_map: dict, contrato_id: str) -> list:
    """
    Replica buildMemorialRows do TypeScript.
    Retorna lista de dicts: nome, valor_unitario, total_qty, total_valor
    """
    acc: dict[str, dict] = {}
    for esc in escalas:
        item_id = esc.get("item_contrato_id")
        ci      = contrato_itens_map.get((contrato_id, item_id))
        nome    = itens_map.get(item_id, {}).get("nome", f"Item {item_id}")
        val_un  = ci.get("valor_unitario", 0) if ci else 0
        um      = ci.get("unidade_medida") if ci else None
        qty     = calc_billing_qty(esc, um)

        if nome not in acc:
            acc[nome] = {"nome": nome, "valor_unitario": val_un, "total_qty": 0.0, "total_valor": 0.0}
        acc[nome]["total_qty"]   += qty
        acc[nome]["total_valor"] += val_un * qty

    return list(acc.values())


def calc_approved_value(escalas: list, contrato_itens_map: dict, contrato_id: str) -> float:
    total = 0.0
    for esc in escalas:
        if esc.get("status") not in ("Aprovado", "Aprovado com Glosa"):
            continue
        item_id = esc.get("item_contrato_id")
        ci      = contrato_itens_map.get((contrato_id, item_id))
        if ci and ci.get("valor_unitario"):
            qty    = calc_billing_qty(esc, ci.get("unidade_medida"))
            total += ci["valor_unitario"] * qty
    return total


def _est_lines(txt: str, w_mm: float, font_size: int = 7) -> int:
    """Estimativa de linhas que um texto ocupa em uma coluna (sem dry_run)."""
    if not txt:
        return 1
    avg_char_w = font_size * 0.5 * 0.352778   # pontos → mm (Helvetica ~0.5 pt/char)
    chars_per_line = max(1, int(w_mm / avg_char_w))
    lines = 0
    for part in txt.split("\n"):
        lines += max(1, (len(part) + chars_per_line - 1) // chars_per_line)
    return lines


# ============================================================
# Geração do PDF (fpdf2)
# ============================================================

# Cores
COR_PRIMARY   = (14,  165, 233)   # #0ea5e9
COR_GOLD      = (251, 191, 36)    # #fbbf24
COR_AMBER_BG  = (255, 243, 205)   # #FFF3CD
COR_AMBER_TX  = (217, 119, 6)     # #d97706
COR_GREEN_DK  = (22,  163, 74)    # #16a34a
COR_GREEN_LT  = (220, 252, 231)   # #dcfce7
COR_ALT_ROW   = (245, 247, 250)   # #f5f7fa
COR_WHITE     = (255, 255, 255)
COR_GRAY_TX   = (100, 100, 100)
COR_BLACK     = (0,   0,   0)
COR_HEADER_TXT= (50,  50,  50)

# Larguras de coluna (mm) — total usável: 267mm (297-15-15)
COL_DATA    = 22
COL_HOR     = 27
COL_ITEM    = 58
COL_MED     = 85
COL_STATUS  = 52
COL_PAGO    = 23
# Soma: 22+27+58+85+52+23 = 267 ✓

MARGIN  = 15
LINE_H  = 5       # altura padrão de linha da tabela
HEADER_H = 35     # altura do cabeçalho azul


class EscalasPDF(FPDF):
    def __init__(self, meta: dict):
        super().__init__(orientation="L", unit="mm", format="A4")
        self.meta = meta          # contract_name, empresa, unidade_nome, mes, total_escalas
        self.set_margins(MARGIN, HEADER_H + 6, MARGIN)
        self.set_auto_page_break(auto=True, margin=20)
        self._total_pages = 1     # atualizado após renderização
        self._valor_total = 0.0
        self._qt_aprovadas = 0
        self._qt_pagas = 0

    # ── Cabeçalho azul (toda página) ────────────────────────────────────────
    def header(self):
        pw = self.w
        # Fundo azul
        self.set_fill_color(*COR_PRIMARY)
        self.rect(0, 0, pw, HEADER_H, "F")

        # "Parcer" branco
        self.set_xy(MARGIN, 6)
        self.set_text_color(*COR_WHITE)
        self.set_font("Helvetica", "B", 22)
        self.cell(30, 10, "Parcer")

        # "IA" dourado
        self.set_text_color(*COR_GOLD)
        self.set_font("Helvetica", "B", 22)
        self.set_xy(MARGIN + 28, 6)
        self.cell(12, 10, "IA")

        # Subtítulo
        self.set_xy(MARGIN, 17)
        self.set_text_color(*COR_WHITE)
        self.set_font("Helvetica", "", 8)
        self.cell(0, 5, "Gestão Inteligente de Acessos e Parcerias")

        # Título do relatório
        self.set_xy(MARGIN, 23)
        self.set_font("Helvetica", "B", 14)
        self.cell(0, 6, "Relatório de Escalas Médicas")

        # Metadados (direita)
        now = datetime.now().strftime("%d/%m/%Y às %H:%M")
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*COR_WHITE)
        self.set_xy(0, 7)
        self.cell(pw - MARGIN, 5, f"Gerado em: {now}", align="R")
        self.set_xy(0, 13)
        self.cell(pw - MARGIN, 5, f"Total: {self.meta['total_escalas']} escalas  |  {self.meta['mes']}", align="R")
        self.set_xy(0, 19)
        self.cell(pw - MARGIN, 5, self.meta['contract_name'], align="R")
        self.set_xy(0, 25)
        self.cell(pw - MARGIN, 5, f"{self.meta['empresa']}  |  {self.meta['unidade_nome']}", align="R")
        self.set_xy(0, 31)
        self.set_font("Helvetica", "I", 7)
        self.cell(pw - MARGIN, 4, "Powered by Daher.lab - Agir", align="R")

    # ── Rodapé (toda página) ─────────────────────────────────────────────────
    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*COR_GRAY_TX)
        self.cell(0, 5, f"Página {self.page_no()}", align="C")

    # ── Cabeçalho da tabela de escalas ───────────────────────────────────────
    def draw_table_header(self):
        self.set_fill_color(*COR_PRIMARY)
        self.set_text_color(*COR_WHITE)
        self.set_font("Helvetica", "B", 8)
        self.set_draw_color(*COR_PRIMARY)

        cols = [
            ("Data",          COL_DATA,   "C"),
            ("Horário",       COL_HOR,    "C"),
            ("Item Contrato", COL_ITEM,   "L"),
            ("Médicos",       COL_MED,    "L"),
            ("Status",        COL_STATUS, "C"),
            ("Pago?",         COL_PAGO,   "C"),
        ]
        x = MARGIN
        y = self.get_y()
        h = LINE_H + 1
        for label, w, align in cols:
            self.set_xy(x, y)
            self.cell(w, h, label, border=1, align=align, fill=True)
            x += w
        self.ln(h)

    # ── Linha da tabela de escalas ───────────────────────────────────────────
    def draw_table_row(self, escala: dict, itens_map: dict, row_idx: int):
        is_glosa  = escala.get("status") == "Aprovado com Glosa"
        is_alt    = (row_idx % 2 == 1)

        if is_glosa:
            fill_rgb = COR_AMBER_BG
            txt_rgb  = COR_AMBER_TX
        elif is_alt:
            fill_rgb = COR_ALT_ROW
            txt_rgb  = COR_BLACK
        else:
            fill_rgb = COR_WHITE
            txt_rgb  = COR_BLACK

        data_str    = fmt_date(escala["data_inicio"])
        horario_str = fmt_horario(escala)
        item_nome   = itens_map.get(escala.get("item_contrato_id"), {}).get("nome", "N/A")
        medicos_raw = escala.get("medicos") or []
        if isinstance(medicos_raw, str):
            try:
                medicos_raw = json.loads(medicos_raw)
            except Exception:
                medicos_raw = []
        medicos_txt = "\n".join(m.get("nome", "") for m in medicos_raw)
        status_str  = escala.get("status", "")
        pago_str    = escala.get("status_pagamento", "Não")

        # Calcula altura necessária para a linha (maior número de linhas entre as colunas)
        self.set_font("Helvetica", "", 7)
        lines_hor  = len(horario_str.split("\n"))
        lines_med  = len(medicos_txt.split("\n")) if medicos_txt else 1
        lines_stat = _est_lines(status_str, COL_STATUS)
        lines_item = _est_lines(item_nome,  COL_ITEM)
        n_lines    = max(1, lines_hor, lines_med, lines_stat, lines_item)
        row_h      = n_lines * LINE_H + 2

        # Quebra de página antes de começar a linha se não couber
        if self.get_y() + row_h > self.page_break_trigger:
            self.add_page()
            self.draw_table_header()

        y0 = self.get_y()
        self.set_fill_color(*fill_rgb)
        self.set_text_color(*txt_rgb)
        self.set_draw_color(200, 200, 200)
        self.set_line_width(0.2)

        def cell_at(x, w, txt, align="L", multiline=False):
            self.set_xy(x, y0)
            if multiline:
                self.multi_cell(w, LINE_H, txt, border=1, align=align, fill=True, max_line_height=LINE_H, new_x="RIGHT", new_y="TOP")
                self.set_xy(x + w, y0)
            else:
                self.cell(w, row_h, txt, border=1, align=align, fill=True)

        x = MARGIN
        cell_at(x, COL_DATA,   data_str,    "C");          x += COL_DATA
        self.set_xy(x, y0)
        self.multi_cell(COL_HOR, LINE_H, horario_str, border=1, align="C", fill=True, max_line_height=LINE_H)
        self.set_xy(x + COL_HOR, y0);                      x += COL_HOR
        self.set_xy(x, y0)
        self.multi_cell(COL_ITEM, LINE_H, item_nome, border=1, align="L", fill=True, max_line_height=LINE_H)
        self.set_xy(x + COL_ITEM, y0);                     x += COL_ITEM
        self.set_xy(x, y0)
        self.multi_cell(COL_MED, LINE_H, medicos_txt, border=1, align="L", fill=True, max_line_height=LINE_H)
        self.set_xy(x + COL_MED, y0);                      x += COL_MED
        self.set_xy(x, y0)
        self.multi_cell(COL_STATUS, LINE_H, status_str, border=1, align="C", fill=True, max_line_height=LINE_H)
        self.set_xy(x + COL_STATUS, y0);                   x += COL_STATUS
        cell_at(x, COL_PAGO,   pago_str,    "C")

        self.set_xy(MARGIN, y0 + row_h)

    # ── Memorial Executivo de Cálculo ────────────────────────────────────────
    def draw_memorial(self, rows: list):
        # Verifica espaço mínimo (6 linhas de conteúdo + título)
        needed = (len(rows) + 3) * (LINE_H + 1) + 20
        if self.get_y() + needed > self.page_break_trigger:
            self.add_page()

        self.ln(6)
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*COR_PRIMARY)
        self.cell(0, 6, "Memorial Executivo de Cálculo", new_x="LMARGIN", new_y="NEXT")

        self.set_font("Helvetica", "", 7)
        self.set_text_color(*COR_GRAY_TX)
        self.cell(0, 4, "Resumo consolidado por item de contrato com base nas escalas do mês.", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

        # Larguras (267mm total)
        w_item, w_val, w_qty, w_tot = 153, 38, 38, 38

        # Cabeçalho
        self.set_fill_color(*COR_PRIMARY)
        self.set_text_color(*COR_WHITE)
        self.set_font("Helvetica", "B", 8)
        y = self.get_y()
        for label, w in [("Item de Contrato", w_item), ("Valor Unitário (R$)", w_val),
                          ("Quantidade", w_qty), ("Total (R$)", w_tot)]:
            self.cell(w, LINE_H + 1, label, border=1, align="C", fill=True)
        self.ln(LINE_H + 1)

        grand_total = 0.0
        for i, row in enumerate(rows):
            fill = COR_ALT_ROW if i % 2 == 1 else COR_WHITE
            self.set_fill_color(*fill)
            self.set_text_color(*COR_BLACK)
            self.set_font("Helvetica", "", 8)
            self.cell(w_item, LINE_H, row["nome"],           border=1, align="L", fill=True)
            self.cell(w_val,  LINE_H, f"R$ {fmt_currency(row['valor_unitario'])}", border=1, align="C", fill=True)
            self.cell(w_qty,  LINE_H, f"{row['total_qty']:.2f}",  border=1, align="C", fill=True)
            self.cell(w_tot,  LINE_H, f"R$ {fmt_currency(row['total_valor'])}", border=1, align="R", fill=True)
            self.ln(LINE_H)
            grand_total += row["total_valor"]

        # Total geral
        self.set_fill_color(*COR_GREEN_LT)
        self.set_text_color(*COR_GREEN_DK)
        self.set_font("Helvetica", "B", 8)
        self.cell(w_item, LINE_H, "TOTAL GERAL", border=1, align="L", fill=True)
        self.cell(w_val,  LINE_H, "",             border=1, fill=True)
        self.cell(w_qty,  LINE_H, "",             border=1, fill=True)
        self.cell(w_tot,  LINE_H, f"R$ {fmt_currency(grand_total)}", border=1, align="R", fill=True)
        self.ln(LINE_H)

    # ── Caixa verde de resumo (última página) ────────────────────────────────
    def draw_summary_box(self):
        if self._qt_aprovadas == 0:
            return
        pw  = self.w
        ph  = self.h
        bw, bh = 150, 22
        bx  = pw - MARGIN - bw
        by  = ph - 12 - bh - 3

        self.set_fill_color(46, 204, 113)
        self.rounded_rect(bx, by, bw, bh, 3, style="F")

        self.set_text_color(*COR_WHITE)
        self.set_font("Helvetica", "B", 7)
        self.set_xy(bx, by + 3)
        self.cell(bw, 5, "VALOR TOTAL DAS ESCALAS APROVADAS (incl. Aprovado com Glosa)", align="C")

        self.set_font("Helvetica", "", 7)
        self.set_xy(bx, by + 9)
        self.cell(bw, 5, f"Qtd: {self._qt_aprovadas}  |  Pagas: {self._qt_pagas}", align="C")

        self.set_font("Helvetica", "B", 9)
        self.set_xy(bx, by + 15)
        self.cell(bw, 5, f"Valor Total: R$ {fmt_currency(self._valor_total)}", align="C")

        # Nota de cálculo (esquerda)
        self.set_font("Helvetica", "I", 6)
        self.set_text_color(*COR_GRAY_TX)
        self.set_xy(MARGIN, by + 8)
        self.cell(0, 4, "* Cálculo: Horas trabalhadas × Valor unitário × Nº de médicos")


# ============================================================
# Fetch de dados
# ============================================================

def fetch_hmsa_contracts(client: SupabaseClient) -> tuple[str, list]:
    uhs = client.select("unidades_hospitalares", {"codigo": f"eq.{NM_UNIDADE}", "select": "id,codigo,nome"})
    if not uhs:
        print(f"ERRO: Unidade '{NM_UNIDADE}' não encontrada.")
        sys.exit(1)
    uh = uhs[0]
    print(f"✔ Unidade: {uh['nome']} (id={uh['id']})")

    contratos = client.select("contratos", {
        "unidade_hospitalar_id": f"eq.{uh['id']}",
        "ativo": "eq.true",
        "select": "id,nome,empresa,unidade_hospitalar_id",
    })
    print(f"  {len(contratos)} contrato(s) ativos para HMSA")
    for c in contratos:
        print(f"    • {c['nome']} — {c['empresa']}")
    return uh["nome"], contratos


def fetch_itens_map(client: SupabaseClient) -> dict:
    """Retorna {item_id: {nome, ...}}"""
    itens = client.select("itens_contrato", {"select": "id,nome"})
    return {i["id"]: i for i in itens}


def fetch_contrato_itens_map(client: SupabaseClient) -> dict:
    """Retorna {(contrato_id, item_id): {valor_unitario, unidade_medida}}"""
    ci = client.select("contrato_itens", {"select": "contrato_id,item_id,valor_unitario,unidade_medida"})
    return {(r["contrato_id"], r["item_id"]): r for r in ci}


def fetch_escalas(client: SupabaseClient, contrato_id: str) -> list:
    return client.select("escalas_medicas", {
        "contrato_id": f"eq.{contrato_id}",
        "ativo":       "eq.true",
        "select":      "id,data_inicio,horario_entrada,horario_saida,item_contrato_id,"
                       "medicos,status,status_pagamento,observacoes,justificativa,"
                       "horario_pagamento_inicio,horario_pagamento_fim,"
                       "base_calculo,quantidade_producao,contrato_id",
        "order":       "data_inicio.asc",
    })


# ============================================================
# Geração do PDF por contrato+mês
# ============================================================

def generate_pdf(
    escalas_mes: list,
    contrato: dict,
    unidade_nome: str,
    ym: str,
    itens_map: dict,
    contrato_itens_map: dict,
    output_path: Path,
):
    meta = {
        "contract_name":  contrato["nome"],
        "empresa":        contrato["empresa"],
        "unidade_nome":   unidade_nome,
        "mes":            mes_label(ym),
        "total_escalas":  len(escalas_mes),
    }

    pdf = EscalasPDF(meta)
    pdf.add_page()

    # ── Tabela principal ──────────────────────────────────────────────────────
    pdf.draw_table_header()

    for idx, esc in enumerate(escalas_mes):
        pdf.draw_table_row(esc, itens_map, idx)

    # ── Memorial ──────────────────────────────────────────────────────────────
    memorial_rows = build_memorial(escalas_mes, itens_map, contrato_itens_map, contrato["id"])
    if memorial_rows:
        pdf.draw_memorial(memorial_rows)

    # ── Calcula métricas para a caixa de resumo ───────────────────────────────
    pdf._valor_total   = calc_approved_value(escalas_mes, contrato_itens_map, contrato["id"])
    pdf._qt_aprovadas  = sum(1 for e in escalas_mes if e.get("status") in ("Aprovado", "Aprovado com Glosa"))
    pdf._qt_pagas      = sum(1 for e in escalas_mes if e.get("status_pagamento") == "Sim")

    # ── Caixa de resumo na última página ─────────────────────────────────────
    pdf.draw_summary_box()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(output_path))
    print(f"    → {output_path}  ({len(escalas_mes)} escalas)")


# ============================================================
# Main
# ============================================================

def main():
    print("=" * 65)
    print("ParcerIA — Geração de PDFs de Escalas HMSA por Mês/Contrato")
    print("=" * 65)
    print(f"  Saída: {OUTPUT_DIR.resolve()}\n")

    base_url, key = get_config()
    client = SupabaseClient(base_url, key)
    print(f"Conectando a: {base_url}\n")

    unidade_nome, contratos = fetch_hmsa_contracts(client)
    if not contratos:
        print("Nenhum contrato ativo encontrado para HMSA. Encerrando.")
        return

    itens_map         = fetch_itens_map(client)
    contrato_itens_map = fetch_contrato_itens_map(client)

    total_pdfs = 0

    for contrato in contratos:
        cid   = contrato["id"]
        cnome = contrato["nome"]
        print(f"\n{'─'*60}")
        print(f"Contrato: {cnome} — {contrato['empresa']}")

        escalas = fetch_escalas(client, cid)
        if not escalas:
            print("  Nenhuma escala ativa encontrada. Pulando.")
            continue

        print(f"  {len(escalas)} escala(s) encontradas.")

        # Agrupar por mês (YYYY-MM)
        por_mes: dict[str, list] = defaultdict(list)
        for esc in escalas:
            ym = esc["data_inicio"][:7]   # "YYYY-MM"
            por_mes[ym].append(esc)

        print(f"  {len(por_mes)} mês(es) com escalas: {', '.join(sorted(por_mes.keys()))}")

        folder = OUTPUT_DIR / sanitize(cnome)
        folder.mkdir(parents=True, exist_ok=True)

        for ym in sorted(por_mes.keys()):
            escalas_mes = por_mes[ym]
            fname       = f"{ym}_{sanitize(cnome)}.pdf"
            output_path = folder / fname

            generate_pdf(
                escalas_mes    = escalas_mes,
                contrato       = contrato,
                unidade_nome   = unidade_nome,
                ym             = ym,
                itens_map      = itens_map,
                contrato_itens_map = contrato_itens_map,
                output_path    = output_path,
            )
            total_pdfs += 1

    print(f"\n{'='*65}")
    print(f"Concluído — {total_pdfs} PDF(s) gerado(s) em '{OUTPUT_DIR.resolve()}'")
    print("=" * 65)


if __name__ == "__main__":
    main()
