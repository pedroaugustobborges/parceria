"""
mv-produtividade-rds-teste.py
==============================
Versão de teste: apenas lê dados do RDS e gera CSVs. Não toca no Supabase.

Fluxo:
  1. Busca usuários tipo='terceiro' com codigomv no Supabase (somente leitura)
  2. Consulta pw_documento_clinico_completo no RDS para ONTEM,
     nos 4 bancos, filtrando pelos cd_prestador e CD_TIPO_DOCUMENTO do CSV
  3. Salva dois CSVs em Downloads/:
       mv_produtividade_detalhe_YYYY-MM-DD.csv  — bruto: uma linha por tipo
       mv_produtividade_resumo_YYYY-MM-DD.csv   — pivot: uma linha por prestador
"""

import os
import csv
import logging
from datetime import date, timedelta

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from supabase import create_client, Client

# ============================================================
# CONFIGURAÇÕES
# ============================================================

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY")

RDS_CONFIG = dict(
    host="db-rds-postgres.cx4bovrfmkbp.sa-east-1.rds.amazonaws.com",
    database="db_rds_01",
    user="gest_contratos",
    password="asdgRTFG98",
    port="5432",
)

NM_BANCOS = [
    "producao_ses_go",
    "producao_ses_ms",
    "producao_ses_am",
    "producao_munc_es",
]

# CD_TIPO_DOCUMENTO extraídos de "mv - produtividade.csv"
TIPOS_DOCUMENTO = {
    3:  "Prescrição de Tratamento",
    4:  "Diagnóstico",
    11: "Encaminhamento",
    17: "Prescrição Médica",
    21: "Parecer Médico",
    25: "Diagnóstico de Enfermagem",
    27: "Anotação",
    30: "Avaliação",
    31: "Documento Eletrônico",
    36: "Evolução",
    50: "Prescrição Assistencial",
    51: "Alta Médica",
    53: "Prescrição de Internado",
    63: "Avaliação Farmacêutica",
}

# Mapeamento para colunas da tabela produtividade (referência futura)
MAPA_PRODUTIVIDADE = {
    "prescricao":        [3, 17, 50, 53],
    "evolucao":          [36],
    "encaminhamento":    [11],
    "parecer_realizado": [21],
    # sem coluna ainda: 4, 25, 27, 30, 31, 51, 63
}

DOWNLOADS = os.path.expanduser("~/Downloads")
ONTEM     = date.today() - timedelta(days=1)
DATA_ISO  = ONTEM.isoformat()
DATA_BR   = ONTEM.strftime("%d/%m/%Y")

TABELA_DOC = "assistencial.pw_documento_clinico_completo"

# ============================================================
# UTILITÁRIOS
# ============================================================

def separador(titulo=""):
    logger.info("=" * 60)
    if titulo:
        logger.info(f"  {titulo}")
        logger.info("=" * 60)


def salvar_csv(nome_arquivo: str, linhas: list):
    if not linhas:
        logger.warning(f"  Sem dados — {nome_arquivo} não gerado")
        return
    caminho = os.path.join(DOWNLOADS, nome_arquivo)
    with open(caminho, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(linhas[0].keys()))
        writer.writeheader()
        writer.writerows(linhas)
    logger.info(f"  -> {caminho}  ({len(linhas)} linhas)")


# ============================================================
# PASSO 1 — Buscar prestadores no Supabase (somente leitura)
# ============================================================

def buscar_prestadores() -> list:
    separador("PASSO 1 — Prestadores no Supabase")

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "VITE_SUPABASE_URL ou VITE_SUPABASE_SERVICE_ROLE_KEY não encontrados no .env"
        )

    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    resp = (
        sb.table("usuarios")
        .select("id, nome, codigomv, especialidade")
        .eq("tipo", "terceiro")
        .not_.is_("codigomv", "null")
        .execute()
    )

    prestadores = resp.data or []
    logger.info(f"  {len(prestadores)} usuários terceiros com codigomv")
    for p in prestadores:
        logger.info(f"    {p['nome']:<35} codigomv={p['codigomv']}")
    return prestadores


# ============================================================
# PASSO 2 — Detectar colunas da tabela no RDS
# ============================================================

_CAND_PRESTADOR = ["cd_prestador"]
_CAND_DATA      = ["dt_documento", "dh_documento", "dt_lancamento",
                   "dh_lancamento", "dt_realizacao", "dh_realizacao"]
_CAND_UNIDADE   = ["nm_unidade", "nm_hospital"]
_CAND_BANCO     = ["nm_banco"]
_CAND_TIPO      = ["cd_tipo_documento"]


def detectar_colunas(cur) -> dict:
    cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'assistencial'
          AND table_name   = 'pw_documento_clinico_completo'
        ORDER BY ordinal_position
    """)
    colunas = [r["column_name"].lower() for r in cur.fetchall()]

    if not colunas:
        # Diagnóstico: listar o que o usuário SÍ consegue ver no schema assistencial
        logger.error("=" * 60)
        logger.error("  ERRO: sem acesso a assistencial.pw_documento_clinico_completo")
        logger.error("  Listando tabelas visíveis no schema assistencial...")
        logger.error("=" * 60)
        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'assistencial'
            ORDER BY table_name
        """)
        visiveis = [r["table_name"] for r in cur.fetchall()]
        if visiveis:
            for t in visiveis:
                logger.error(f"    assistencial.{t}")
        else:
            logger.error("    Nenhuma tabela visível no schema assistencial.")

        logger.error("=" * 60)
        logger.error("  AÇÃO NECESSÁRIA — pedir à TI que execute no RDS:")
        logger.error("  GRANT SELECT ON assistencial.pw_documento_clinico_completo TO gest_contratos;")
        logger.error("=" * 60)
        raise RuntimeError(
            "Sem acesso a assistencial.pw_documento_clinico_completo. "
            "Solicitar GRANT SELECT à TI (detalhes no log acima)."
        )

    logger.info(f"  {len(colunas)} colunas encontradas")

    def pick(candidatos, obrigatorio=True):
        for c in candidatos:
            if c in colunas:
                return c
        if obrigatorio:
            raise RuntimeError(f"Coluna obrigatória não encontrada — candidatos: {candidatos}")
        return None

    mapa = {
        "prestador": pick(_CAND_PRESTADOR),
        "tipo":      pick(_CAND_TIPO),
        "data":      pick(_CAND_DATA),
        "unidade":   pick(_CAND_UNIDADE, obrigatorio=False),
        "banco":     pick(_CAND_BANCO,   obrigatorio=False),
    }

    logger.info(f"  prestador → {mapa['prestador']}")
    logger.info(f"  tipo      → {mapa['tipo']}")
    logger.info(f"  data      → {mapa['data']}")
    logger.info(f"  unidade   → {mapa['unidade']}")
    logger.info(f"  banco     → {mapa['banco']}")
    return mapa


# ============================================================
# PASSO 3 — Consultar RDS
# ============================================================

def consultar_rds(prestadores: list) -> list:
    separador("PASSO 2 — Consultar RDS")

    cd_prestadores = [int(p["codigomv"]) for p in prestadores]
    cd_tipos       = list(TIPOS_DOCUMENTO.keys())

    logger.info(f"  Data      : {DATA_BR}")
    logger.info(f"  Prestadores ({len(cd_prestadores)}): {cd_prestadores}")
    logger.info(f"  Tipos doc ({len(cd_tipos)}): {cd_tipos}")
    logger.info(f"  Bancos    : {NM_BANCOS}")

    conn = psycopg2.connect(**RDS_CONFIG)
    conn.set_session(readonly=True, autocommit=True)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    logger.info("  Detectando colunas...")
    mapa = detectar_colunas(cur)

    col_p = mapa["prestador"]
    col_t = mapa["tipo"]
    col_d = mapa["data"]
    col_u = mapa["unidade"]
    col_b = mapa["banco"]

    sel_unidade = col_u if col_u else "'N/D'"
    sel_banco   = col_b if col_b else "'N/D'"

    filtro_banco = (
        f"AND {col_b} IN ({', '.join(['%s'] * len(NM_BANCOS))})"
        if col_b else ""
    )

    sql = f"""
        SELECT
            {col_p}       AS cd_prestador,
            {col_t}       AS cd_tipo_documento,
            {sel_unidade} AS nm_unidade,
            {sel_banco}   AS nm_banco,
            COUNT(*)      AS total
        FROM {TABELA_DOC}
        WHERE {col_p} IN ({', '.join(['%s'] * len(cd_prestadores))})
          AND {col_t}  IN ({', '.join(['%s'] * len(cd_tipos))})
          AND {col_d}  >= %s
          AND {col_d}  <= %s
          {filtro_banco}
        GROUP BY {col_p}, {col_t}, {sel_unidade}, {sel_banco}
        ORDER BY {col_p}, {col_t}
    """

    params = (
        cd_prestadores
        + cd_tipos
        + [f"{DATA_ISO} 00:00:00", f"{DATA_ISO} 23:59:59"]
        + (NM_BANCOS if col_b else [])
    )

    logger.info("  Executando query...")
    cur.execute(sql, params)
    rows = [dict(r) for r in cur.fetchall()]
    logger.info(f"  {len(rows)} linhas retornadas")

    cur.close()
    conn.close()
    return rows


# ============================================================
# PASSO 4 — Gerar CSVs
# ============================================================

def gerar_csvs(rows: list, prestadores: list):
    separador("PASSO 3 — Gerar CSVs")

    idx_prest = {int(p["codigomv"]): p for p in prestadores}

    # ---- CSV detalhe: uma linha por prestador + tipo + banco ----
    detalhe = []
    for row in rows:
        cd_prest = int(row["cd_prestador"])
        cd_tipo  = int(row["cd_tipo_documento"])
        info     = idx_prest.get(cd_prest, {})
        detalhe.append({
            "data":              DATA_ISO,
            "cd_prestador":      cd_prest,
            "nome":              info.get("nome", ""),
            "especialidade":     info.get("especialidade", ""),
            "nm_banco":          row.get("nm_banco", "N/D"),
            "nm_unidade":        row.get("nm_unidade", "N/D"),
            "cd_tipo_documento": cd_tipo,
            "ds_tipo_documento": TIPOS_DOCUMENTO.get(cd_tipo, "?"),
            "total":             int(row["total"]),
        })

    # ---- CSV resumo: pivot por prestador ----
    # Colunas: uma por CD_TIPO_DOCUMENTO + campos mapeados para produtividade
    resumo: dict[int, dict] = {}

    for row in rows:
        cd_prest = int(row["cd_prestador"])
        cd_tipo  = int(row["cd_tipo_documento"])
        total    = int(row["total"])

        if cd_prest not in resumo:
            info = idx_prest.get(cd_prest, {})
            resumo[cd_prest] = {
                "data":          DATA_ISO,
                "cd_prestador":  cd_prest,
                "nome":          info.get("nome", ""),
                "especialidade": info.get("especialidade", ""),
                # colunas brutas por CD_TIPO_DOCUMENTO
                **{f"cd_{cd}_{TIPOS_DOCUMENTO[cd].split()[0].lower()}": 0
                   for cd in TIPOS_DOCUMENTO},
                # colunas mapeadas para produtividade
                "prescricao":        0,
                "evolucao":          0,
                "encaminhamento":    0,
                "parecer_realizado": 0,
            }

        reg = resumo[cd_prest]

        # coluna bruta
        col_bruta = f"cd_{cd_tipo}_{TIPOS_DOCUMENTO.get(cd_tipo, str(cd_tipo)).split()[0].lower()}"
        if col_bruta in reg:
            reg[col_bruta] += total

        # colunas mapeadas
        for campo, cd_lista in MAPA_PRODUTIVIDADE.items():
            if cd_tipo in cd_lista:
                reg[campo] += total

    resumo_linhas = list(resumo.values())

    nome_det = f"mv_produtividade_detalhe_{DATA_ISO}.csv"
    nome_res = f"mv_produtividade_resumo_{DATA_ISO}.csv"

    salvar_csv(nome_det, detalhe)
    salvar_csv(nome_res, resumo_linhas)

    return nome_det, nome_res


# ============================================================
# EXPLORAÇÃO — assistencial.atendime_completo
# (roda sempre, independente do acesso a pw_documento_clinico_completo)
# ============================================================

TABELA_ATEND = "assistencial.atendime_completo"


def explorar_atendime_completo(cd_prestadores: list):
    """
    Explora a tabela atendime_completo e salva dois CSVs:
      atendime_colunas.csv          — lista de colunas e tipos
      atendime_amostra.csv          — primeiras 200 linhas sem filtro
      atendime_prestadores.csv      — linhas filtradas pelos cd_prestadores
                                      para ONTEM (se coluna de data existir)
    """
    separador("EXPLORAÇÃO — assistencial.atendime_completo")

    conn = psycopg2.connect(**RDS_CONFIG)
    conn.set_session(readonly=True, autocommit=True)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ── 1. Verificar acesso ──────────────────────────────────
    logger.info("  [1] Verificando acesso à tabela...")
    try:
        cur.execute(f"SELECT * FROM {TABELA_ATEND} LIMIT 1")
        amostra_teste = cur.fetchall()
        logger.info(f"  OK — acesso concedido")
    except Exception as e:
        logger.error(f"  SEM ACESSO: {e}")
        cur.close()
        conn.close()
        return

    # ── 2. Listar colunas ────────────────────────────────────
    logger.info("  [2] Listando colunas...")
    cur.execute("""
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = 'assistencial'
          AND table_name   = 'atendime_completo'
        ORDER BY ordinal_position
    """)
    colunas_info = [dict(r) for r in cur.fetchall()]
    colunas = [r["column_name"].lower() for r in colunas_info]

    logger.info(f"  {len(colunas)} colunas encontradas:")
    for c in colunas_info:
        logger.info(f"    {c['column_name']:<45} {c['data_type']}")

    salvar_csv(f"atendime_colunas.csv", colunas_info)

    # ── 3. Amostra sem filtro (200 linhas) ───────────────────
    logger.info("  [3] Extraindo amostra (200 linhas sem filtro)...")
    cur.execute(f"SELECT * FROM {TABELA_ATEND} LIMIT 200")
    amostra = [dict(r) for r in cur.fetchall()]
    salvar_csv("atendime_amostra.csv", amostra)

    # ── 4. Auto-detectar colunas-chave ───────────────────────
    logger.info("  [4] Auto-detectando colunas-chave...")

    def find_col(candidatos):
        for c in candidatos:
            if c in colunas:
                return c
        # busca parcial
        for c in candidatos:
            for col in colunas:
                if c in col:
                    return col
        return None

    col_prest  = find_col(["cd_prestador", "prestador", "cd_medico", "medico"])
    col_data   = find_col(["dt_atendimento", "dh_atendimento", "dt_documento",
                           "dh_documento", "dt_lancamento", "dh_lancamento",
                           "dt_realizacao", "dh_realizacao", "data"])
    col_tipo   = find_col(["cd_tipo_documento", "tp_documento", "cd_tipo",
                           "nm_tipo", "tipo_doc", "tipo"])
    col_unid   = find_col(["nm_unidade", "unidade", "hospital", "nm_hosp"])
    col_banco  = find_col(["nm_banco", "banco"])

    logger.info(f"  prestador  → {col_prest  or 'NÃO ENCONTRADO'}")
    logger.info(f"  data       → {col_data   or 'NÃO ENCONTRADO'}")
    logger.info(f"  tipo doc   → {col_tipo   or 'NÃO ENCONTRADO'}")
    logger.info(f"  unidade    → {col_unid   or 'NÃO ENCONTRADO'}")
    logger.info(f"  banco      → {col_banco  or 'NÃO ENCONTRADO'}")

    # ── 5. Valores distintos de colunas-chave ────────────────
    logger.info("  [5] Valores distintos das colunas-chave...")

    for label, col in [("tipo doc", col_tipo), ("unidade", col_unid), ("banco", col_banco)]:
        if not col:
            logger.info(f"  {label}: coluna não encontrada, pulando")
            continue
        try:
            cur.execute(f"""
                SELECT {col} AS valor, COUNT(*) AS total
                FROM {TABELA_ATEND}
                GROUP BY {col}
                ORDER BY total DESC
                LIMIT 50
            """)
            rows = cur.fetchall()
            logger.info(f"\n  Valores de '{col}' ({label}):")
            for r in rows:
                logger.info(f"    {str(r['valor']):<50}  {r['total']:>10,}")
        except Exception as e:
            logger.warning(f"  Erro ao contar '{col}': {e}")

    # ── 6. Range de datas ────────────────────────────────────
    if col_data:
        logger.info(f"\n  [6] Range de datas ({col_data}):")
        try:
            cur.execute(f"""
                SELECT MIN({col_data}) AS mais_antigo,
                       MAX({col_data}) AS mais_recente,
                       COUNT(*)        AS total
                FROM {TABELA_ATEND}
            """)
            r = dict(cur.fetchone())
            logger.info(f"    Mais antigo : {r['mais_antigo']}")
            logger.info(f"    Mais recente: {r['mais_recente']}")
            logger.info(f"    Total       : {r['total']:,} registros")
        except Exception as e:
            logger.warning(f"  Erro ao checar datas: {e}")

    # ── 7. Filtrar por prestadores + ONTEM ───────────────────
    if col_prest and cd_prestadores:
        separador("  [7] Filtrar por prestadores + ONTEM")
        logger.info(f"  Filtrando {len(cd_prestadores)} prestadores em {DATA_BR}...")

        filtro_data_sql = ""
        params_data: list = []
        if col_data:
            filtro_data_sql = f"AND {col_data} >= %s AND {col_data} <= %s"
            params_data = [f"{DATA_ISO} 00:00:00", f"{DATA_ISO} 23:59:59"]

        filtro_banco_sql = ""
        params_banco: list = []
        if col_banco:
            placeholders = ", ".join(["%s"] * len(NM_BANCOS))
            filtro_banco_sql = f"AND {col_banco} IN ({placeholders})"
            params_banco = NM_BANCOS

        placeholders_p = ", ".join(["%s"] * len(cd_prestadores))

        try:
            cur.execute(f"""
                SELECT *
                FROM {TABELA_ATEND}
                WHERE {col_prest} IN ({placeholders_p})
                  {filtro_data_sql}
                  {filtro_banco_sql}
                LIMIT 5000
            """, cd_prestadores + params_data + params_banco)

            filtrado = [dict(r) for r in cur.fetchall()]
            logger.info(f"  {len(filtrado)} linhas retornadas")
            salvar_csv(f"atendime_prestadores_{DATA_ISO}.csv", filtrado)

            # Contagem por tipo (se col_tipo existir)
            if col_tipo and filtrado:
                from collections import Counter
                contagem = Counter(str(r.get(col_tipo, "?")) for r in filtrado)
                logger.info(f"\n  Contagem por {col_tipo}:")
                for tipo, qtd in contagem.most_common():
                    logger.info(f"    {tipo:<50}  {qtd:>6,}")

        except Exception as e:
            logger.warning(f"  Erro ao filtrar prestadores: {e}")

    else:
        if not col_prest:
            logger.warning("  [7] Coluna de prestador não encontrada — filtro ignorado")

    cur.close()
    conn.close()


# ============================================================
# MAIN
# ============================================================

def main():
    separador("mv-produtividade-rds-teste.py  [SOMENTE LEITURA]")
    logger.info(f"  Data de referência : {DATA_BR} (ONTEM)")
    logger.info(f"  *** Nenhum dado será inserido no Supabase ***")

    prestadores = buscar_prestadores()
    if not prestadores:
        logger.warning("Nenhum prestador encontrado. Encerrando.")
        return

    cd_prestadores = [int(p["codigomv"]) for p in prestadores]

    # Explorar atendime_completo (sempre roda)
    explorar_atendime_completo(cd_prestadores)

    # Tentar consulta principal (pw_documento_clinico_completo)
    separador("CONSULTA PRINCIPAL — pw_documento_clinico_completo")
    try:
        rows = consultar_rds(prestadores)
        if not rows:
            logger.warning("Nenhum documento encontrado para ONTEM.")
            salvar_csv(f"mv_produtividade_VAZIO_{DATA_ISO}.csv", [])
        else:
            nome_det, nome_res = gerar_csvs(rows, prestadores)
            logger.info(f"  {nome_det}")
            logger.info(f"  {nome_res}")
    except RuntimeError as e:
        logger.warning(f"  Consulta principal indisponível: {e}")
        logger.warning("  Aguardando GRANT da TI — apenas exploração salva.")

    separador("CONCLUÍDO")
    logger.info(f"  CSVs salvos em: {DOWNLOADS}/")


if __name__ == "__main__":
    main()
