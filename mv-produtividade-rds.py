"""
mv-produtividade-rds.py
=======================
Substitui o web scraper do relatório MV pelo acesso direto ao banco RDS.

Fluxo:
  1. Busca usuários tipo='terceiro' com codigomv no Supabase
  2. Conecta ao RDS (MV/SES) e consulta pw_documento_clinico_completo
     para ONTEM, em todos os 4 bancos (nm_banco), filtrando pelos cd_prestador
  3. Pivota contagens por CD_TIPO_DOCUMENTO (somente os tipos do CSV)
  4. Mapeia para as colunas da tabela 'produtividade'
  5. Faz upsert no Supabase
  6. Salva CSV com detalhe completo em Downloads/
"""

import os
import csv
import logging
from datetime import date, timedelta, datetime

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

# Supabase (auto-detecta de .env)
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY")

# RDS (banco MV)
RDS_CONFIG = dict(
    host="db-rds-postgres.cx4bovrfmkbp.sa-east-1.rds.amazonaws.com",
    database="db_rds_01",
    user="gest_contratos",
    password="asdgRTFG98",
    port="5432",
)

# Bancos disponíveis no RDS
NM_BANCOS = [
    "producao_ses_go",   # Goiás    → HUGOL, HECAD, CRER
    "producao_ses_ms",   # Mato Grosso do Sul
    "producao_ses_am",   # Amazonas
    "producao_munc_es",  # Municipal Espírito Santo
]

# Tipos de documento a coletar (extraídos de "mv - produtividade.csv")
# {cd: ds_tipo_documento}
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

# Mapeamento CD_TIPO_DOCUMENTO → coluna em produtividade
# Múltiplos CDs somados no mesmo campo seguem a lógica do scraper anterior.
# CDs sem coluna equivalente são registrados no CSV detalhado mas não inseridos.
MAPA_PRODUTIVIDADE = {
    # prescricao: todos os tipos de prescrição
    "prescricao":           [3, 17, 50, 53],
    # evolucao: evolução genérica
    "evolucao":             [36],
    # encaminhamento
    "encaminhamento":       [11],
    # parecer_realizado: Parecer Médico
    "parecer_realizado":    [21],
    # os demais tipos ainda não têm coluna mapeada — serão salvos apenas no CSV
    # diagnostico (4, 25), anotacao (27), avaliacao (30, 63),
    # documento_eletronico (31), alta_medica (51)
}

DOWNLOADS = os.path.expanduser("~/Downloads")
HOJE = date.today()
ONTEM = HOJE - timedelta(days=1)
DATA_ISO = ONTEM.isoformat()           # YYYY-MM-DD
DATA_BR  = ONTEM.strftime("%d/%m/%Y")  # para logs

# ============================================================
# UTILITÁRIOS
# ============================================================

def separador(titulo=""):
    logger.info("=" * 60)
    if titulo:
        logger.info(f"  {titulo}")
        logger.info("=" * 60)


def salvar_csv(nome_arquivo: str, linhas: list[dict]):
    if not linhas:
        logger.warning(f"  Sem dados para salvar em {nome_arquivo}")
        return
    caminho = os.path.join(DOWNLOADS, nome_arquivo)
    colunas = list(linhas[0].keys())
    with open(caminho, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=colunas)
        writer.writeheader()
        writer.writerows(linhas)
    logger.info(f"  -> Salvo: {caminho}  ({len(linhas)} linhas)")


# ============================================================
# PASSO 1 — Buscar prestadores no Supabase
# ============================================================

def buscar_prestadores_supabase() -> list[dict]:
    """
    Retorna lista de {codigomv: str, nome: str} para todos os usuários
    com tipo='terceiro' e codigomv preenchido.
    """
    separador("PASSO 1 — Buscar prestadores no Supabase")

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY "
            "não encontradas. Verifique o .env"
        )

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    resp = (
        supabase.table("usuarios")
        .select("id, nome, codigomv, especialidade")
        .eq("tipo", "terceiro")
        .not_.is_("codigomv", "null")
        .execute()
    )

    prestadores = resp.data or []
    logger.info(f"  Encontrados {len(prestadores)} usuários terceiros com codigomv")
    for p in prestadores:
        logger.info(f"    {p['nome']} → MV {p['codigomv']}")

    return prestadores


# ============================================================
# PASSO 2 — Detectar colunas da tabela no RDS
# ============================================================

TABELA_DOC = "assistencial.pw_documento_clinico_completo"

# Nomes de coluna mais comuns no MV para cada tipo de informação
_CANDIDATOS_PRESTADOR = ["cd_prestador"]
_CANDIDATOS_DATA      = ["dt_documento", "dh_documento", "dt_lancamento",
                         "dh_lancamento", "dt_realizacao", "dh_realizacao"]
_CANDIDATOS_UNIDADE   = ["nm_unidade", "nm_hospital"]
_CANDIDATOS_BANCO     = ["nm_banco"]
_CANDIDATOS_TIPO      = ["cd_tipo_documento"]


def detectar_colunas(cur) -> dict:
    """
    Consulta information_schema para descobrir os nomes exatos das colunas.
    Retorna dict com as chaves: prestador, data, unidade, banco, tipo.
    Lança RuntimeError se coluna essencial não for encontrada.
    """
    cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'assistencial'
          AND table_name   = 'pw_documento_clinico_completo'
        ORDER BY ordinal_position
    """)
    colunas = [r[0].lower() for r in cur.fetchall()]

    if not colunas:
        raise RuntimeError(
            f"Sem acesso à tabela {TABELA_DOC} ou tabela inexistente. "
            "Solicitar GRANT SELECT à TI."
        )

    logger.info(f"  Colunas encontradas ({len(colunas)}): {', '.join(colunas[:20])}...")

    def pick(candidatos, obrigatorio=True):
        for c in candidatos:
            if c in colunas:
                return c
        if obrigatorio:
            raise RuntimeError(
                f"Nenhuma das colunas candidatas encontrada: {candidatos}. "
                "Verificar estrutura da tabela com a TI."
            )
        return None

    mapa = {
        "prestador": pick(_CANDIDATOS_PRESTADOR),
        "tipo":      pick(_CANDIDATOS_TIPO),
        "data":      pick(_CANDIDATOS_DATA),
        "unidade":   pick(_CANDIDATOS_UNIDADE, obrigatorio=False),
        "banco":     pick(_CANDIDATOS_BANCO,   obrigatorio=False),
    }

    logger.info(f"  Coluna prestador : {mapa['prestador']}")
    logger.info(f"  Coluna tipo doc  : {mapa['tipo']}")
    logger.info(f"  Coluna data      : {mapa['data']}")
    logger.info(f"  Coluna unidade   : {mapa['unidade']}")
    logger.info(f"  Coluna banco     : {mapa['banco']}")

    return mapa


# ============================================================
# PASSO 3 — Consultar RDS
# ============================================================

def consultar_rds(prestadores: list[dict]) -> list[dict]:
    """
    Consulta pw_documento_clinico_completo para ONTEM, em todos os nm_bancos,
    para todos os cd_prestador dos prestadores fornecidos.

    Retorna lista de dicts:
      {cd_prestador, nm_banco, nm_unidade, cd_tipo_documento, total}
    """
    separador("PASSO 2 — Consultar RDS")

    if not prestadores:
        logger.warning("Nenhum prestador para consultar.")
        return []

    cd_prestadores = [int(p["codigomv"]) for p in prestadores]
    cd_tipos       = list(TIPOS_DOCUMENTO.keys())
    nm_bancos      = NM_BANCOS

    logger.info(f"  Data de referência : {DATA_BR} (ONTEM)")
    logger.info(f"  Prestadores        : {cd_prestadores}")
    logger.info(f"  Tipos de documento : {cd_tipos}")
    logger.info(f"  Bancos             : {nm_bancos}")

    conn = psycopg2.connect(**RDS_CONFIG)
    conn.set_session(readonly=True, autocommit=True)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Detectar colunas
    separador("PASSO 2a — Detectar colunas")
    mapa_cols = detectar_colunas(cur)
    col_prest   = mapa_cols["prestador"]
    col_tipo    = mapa_cols["tipo"]
    col_data    = mapa_cols["data"]
    col_unidade = mapa_cols["unidade"] or "'N/D' AS nm_unidade"
    col_banco   = mapa_cols["banco"]   or "'N/D' AS nm_banco"

    # Parâmetros SQL
    separador("PASSO 2b — Executar query")

    # Construir filtros dinâmicos
    filtro_banco = ""
    if mapa_cols["banco"]:
        placeholders = ", ".join(["%s"] * len(nm_bancos))
        filtro_banco = f"AND {col_banco} IN ({placeholders})"

    filtro_unidade = ""
    col_unidade_sel = f"{col_unidade}" if mapa_cols["unidade"] else "'N/D'"

    placeholders_prest = ", ".join(["%s"] * len(cd_prestadores))
    placeholders_tipos = ", ".join(["%s"] * len(cd_tipos))

    # Data: filtramos pelo dia inteiro (00:00:00 até 23:59:59)
    DATA_INICIO_TS = f"{DATA_ISO} 00:00:00"
    DATA_FIM_TS    = f"{DATA_ISO} 23:59:59"

    sql = f"""
        SELECT
            {col_prest}   AS cd_prestador,
            {col_tipo}    AS cd_tipo_documento,
            {col_unidade_sel} AS nm_unidade,
            {col_banco if mapa_cols['banco'] else "'N/D'"} AS nm_banco,
            COUNT(*)      AS total
        FROM {TABELA_DOC}
        WHERE {col_prest} IN ({placeholders_prest})
          AND {col_tipo}  IN ({placeholders_tipos})
          AND {col_data}  >= %s
          AND {col_data}  <= %s
          {filtro_banco}
        GROUP BY
            {col_prest},
            {col_tipo},
            {col_unidade_sel if mapa_cols['unidade'] else "'N/D'"},
            {col_banco if mapa_cols['banco'] else "'N/D'"}
        ORDER BY {col_prest}, {col_tipo}
    """

    params = (
        cd_prestadores
        + cd_tipos
        + [DATA_INICIO_TS, DATA_FIM_TS]
        + (nm_bancos if mapa_cols["banco"] else [])
    )

    logger.info(f"  Executando query...")
    cur.execute(sql, params)
    rows = [dict(r) for r in cur.fetchall()]
    logger.info(f"  Retornadas {len(rows)} linhas")

    cur.close()
    conn.close()

    return rows


# ============================================================
# PASSO 4 — Pivotar e mapear para produtividade
# ============================================================

def pivotar(rows: list[dict], prestadores: list[dict]) -> list[dict]:
    """
    Transforma as linhas (uma por cd_prestador+cd_tipo+banco) em registros
    pivot (um por cd_prestador) prontos para inserção em 'produtividade'.

    Também devolve o CSV detalhado completo.
    """
    separador("PASSO 3 — Pivotar resultados")

    # Índice: {(cd_prestador, nm_banco, nm_unidade) → {cd_tipo: total}}
    pivot: dict[tuple, dict[int, int]] = {}

    for row in rows:
        cd_prest = int(row["cd_prestador"])
        nm_banco = row.get("nm_banco", "N/D")
        nm_unid  = row.get("nm_unidade", "N/D")
        cd_tipo  = int(row["cd_tipo_documento"])
        total    = int(row["total"])

        chave = (cd_prest, nm_banco, nm_unid)
        pivot.setdefault(chave, {})
        pivot[chave][cd_tipo] = pivot[chave].get(cd_tipo, 0) + total

    # Indexar prestadores por codigomv para enriquecer com nome/especialidade
    idx_prest = {int(p["codigomv"]): p for p in prestadores}

    # ---- CSV detalhado: uma linha por cd_prestador + cd_tipo ----
    csv_detalhe = []
    for (cd_prest, nm_banco, nm_unid), tipos in sorted(pivot.items()):
        info = idx_prest.get(cd_prest, {})
        for cd_tipo, total in sorted(tipos.items()):
            csv_detalhe.append({
                "data":                DATA_ISO,
                "cd_prestador":        cd_prest,
                "nome":                info.get("nome", ""),
                "especialidade":       info.get("especialidade", ""),
                "nm_banco":            nm_banco,
                "nm_unidade":          nm_unid,
                "cd_tipo_documento":   cd_tipo,
                "ds_tipo_documento":   TIPOS_DOCUMENTO.get(cd_tipo, "?"),
                "total":               total,
            })

    # ---- Registros para produtividade: um por cd_prestador ----
    # Somamos todos os bancos/unidades (mesmo médico pode aparecer em unidades diferentes)
    prod_pivot: dict[int, dict] = {}

    for (cd_prest, nm_banco, nm_unid), tipos in pivot.items():
        if cd_prest not in prod_pivot:
            info = idx_prest.get(cd_prest, {})
            prod_pivot[cd_prest] = {
                "codigo_mv":           str(cd_prest),
                "nome":                info.get("nome", ""),
                "especialidade":       info.get("especialidade", ""),
                "data":                DATA_ISO,
                # inicializar todos os campos mapeados em 0
                **{campo: 0 for campo in MAPA_PRODUTIVIDADE},
                # campos não mapeados ainda (armazenados para log)
                "_nao_mapeados": {},
            }

        reg = prod_pivot[cd_prest]

        for cd_tipo, total in tipos.items():
            mapeado = False
            for campo, cd_lista in MAPA_PRODUTIVIDADE.items():
                if cd_tipo in cd_lista:
                    reg[campo] = reg.get(campo, 0) + total
                    mapeado = True
            if not mapeado:
                nm = TIPOS_DOCUMENTO.get(cd_tipo, str(cd_tipo))
                reg["_nao_mapeados"][nm] = reg["_nao_mapeados"].get(nm, 0) + total

    registros_prod = []
    for cd_prest, reg in sorted(prod_pivot.items()):
        nao_map = reg.pop("_nao_mapeados", {})
        if nao_map:
            logger.info(f"  [{reg['nome']} / MV {cd_prest}] tipos não mapeados: {nao_map}")
        registros_prod.append(reg)

    logger.info(f"  {len(csv_detalhe)} linhas no detalhe")
    logger.info(f"  {len(registros_prod)} registros para produtividade")

    return registros_prod, csv_detalhe


# ============================================================
# PASSO 5 — Upsert no Supabase
# ============================================================

def upsert_supabase(registros: list[dict]):
    separador("PASSO 4 — Upsert no Supabase")

    if not registros:
        logger.warning("  Nenhum registro para inserir.")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    sucesso = 0
    erros   = 0

    for reg in registros:
        try:
            # Verificar se já existe (codigo_mv + data)
            existing = (
                supabase.table("produtividade")
                .select("id")
                .eq("codigo_mv", reg["codigo_mv"])
                .eq("data", reg["data"])
                .execute()
            )

            payload = {k: v for k, v in reg.items() if k != "data" and k != "codigo_mv"}

            if existing.data:
                supabase.table("produtividade").update(payload).eq(
                    "id", existing.data[0]["id"]
                ).execute()
                logger.info(f"  [UPD] {reg['nome']} ({reg['codigo_mv']}) — {reg['data']}")
            else:
                payload["codigo_mv"] = reg["codigo_mv"]
                payload["data"]      = reg["data"]
                supabase.table("produtividade").insert(payload).execute()
                logger.info(f"  [INS] {reg['nome']} ({reg['codigo_mv']}) — {reg['data']}")

            sucesso += 1

        except Exception as e:
            logger.error(f"  [ERR] {reg.get('nome', '?')} ({reg.get('codigo_mv', '?')}): {e}")
            erros += 1

    logger.info(f"\n  Resultado: {sucesso} ok, {erros} erros")


# ============================================================
# MAIN
# ============================================================

def main():
    separador("mv-produtividade-rds.py")
    logger.info(f"  Data de referência : {DATA_BR} (ONTEM)")
    logger.info(f"  Bancos RDS         : {NM_BANCOS}")
    logger.info(f"  Tipos de documento : {sorted(TIPOS_DOCUMENTO.keys())}")

    # 1. Buscar prestadores no Supabase
    prestadores = buscar_prestadores_supabase()

    if not prestadores:
        logger.warning("Nenhum prestador terceiro com codigomv encontrado. Encerrando.")
        return

    # 2. Consultar RDS
    rows = consultar_rds(prestadores)

    if not rows:
        logger.warning("Nenhum documento encontrado para ONTEM. Encerrando.")
        # Salvar CSV vazio para auditoria
        salvar_csv(f"mv_produtividade_{DATA_ISO}_VAZIO.csv", [])
        return

    # 3. Pivotar e mapear
    registros_prod, csv_detalhe = pivotar(rows, prestadores)

    # 4. Salvar CSV detalhado
    nome_csv_det = f"mv_produtividade_detalhe_{DATA_ISO}.csv"
    salvar_csv(nome_csv_det, csv_detalhe)

    # Salvar CSV resumo (o que vai pro Supabase)
    nome_csv_res = f"mv_produtividade_resumo_{DATA_ISO}.csv"
    salvar_csv(nome_csv_res, registros_prod)

    # 5. Upsert no Supabase
    upsert_supabase(registros_prod)

    separador("CONCLUÍDO")
    logger.info(f"  CSVs salvos em: {DOWNLOADS}/")
    logger.info(f"    Detalhe : {nome_csv_det}")
    logger.info(f"    Resumo  : {nome_csv_res}")


if __name__ == "__main__":
    main()
