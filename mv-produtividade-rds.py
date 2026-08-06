"""
mv-produtividade-rds.py
=======================
Substitui o web scraper do relatório MV pelo acesso direto ao banco RDS.

Fluxo:
  1. Busca usuários tipo='terceiro' com codigomv no Supabase
  2. Consulta pw_documento_clinico_completo no RDS para ONTEM,
     nos 4 bancos, filtrando pelos cd_prestador
  3. Pivota contagens por CD_TIPO_DOCUMENTO → 9 colunas de produtividade
     Uma linha por (cd_prestador, nm_unidade)
  4. Upsert no Supabase (chave: codigo_mv + data + nm_unidade)
  5. Salva CSV de auditoria em Downloads/
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
    "producao_ses_go",   # Goiás    → HUGOL, HECAD, CRER
    "producao_ses_ms",   # Mato Grosso do Sul
    "producao_ses_am",   # Amazonas
    "producao_munc_es",  # Municipal Espírito Santo
]

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

# 9 colunas finais da tabela produtividade
MAPA_PRODUTIVIDADE = {
    "prescricao":           [3, 17, 50, 53],
    "diagnostico":          [4, 25],
    "encaminhamento":       [11],
    "parecer":              [21],
    "anotacao":             [27],
    "avaliacao":            [30, 63],
    "documento_eletronico": [31],
    "evolucao":             [36],
    "alta_medica":          [51],
}

DOWNLOADS = os.path.expanduser("~/Downloads")
ONTEM    = date.today() - timedelta(days=1)
DATA_ISO = ONTEM.isoformat()
DATA_BR  = ONTEM.strftime("%d/%m/%Y")

TABELA_DOC = "assistencial.pw_documento_clinico_completo"

_CAND_PRESTADOR = ["cd_prestador"]
_CAND_DATA      = ["dt_documento", "dh_documento", "dt_lancamento",
                   "dh_lancamento", "dt_realizacao", "dh_realizacao"]
_CAND_UNIDADE   = ["nm_unidade", "nm_hospital"]
_CAND_BANCO     = ["nm_banco"]
_CAND_TIPO      = ["cd_tipo_documento"]

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


def formatar_especialidade(esp) -> str:
    """Converte ['Cirurgia Geral'] ou ['A', 'B'] para 'Cirurgia Geral' / 'A, B'."""
    if isinstance(esp, list):
        return ", ".join(str(e) for e in esp)
    if isinstance(esp, str):
        esp = esp.strip()
        if esp.startswith("[") and esp.endswith("]"):
            inner = esp[1:-1]
            partes = [p.strip().strip("'\"") for p in inner.split(",")]
            return ", ".join(p for p in partes if p)
    return esp or ""


# ============================================================
# PASSO 1 — Buscar prestadores no Supabase
# ============================================================

def buscar_prestadores() -> list:
    separador("PASSO 1 — Buscar prestadores no Supabase")

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
    return prestadores


# ============================================================
# PASSO 2 — Detectar colunas + Consultar RDS
# ============================================================

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
        raise RuntimeError(
            f"Sem acesso a {TABELA_DOC}. Solicitar GRANT SELECT à TI."
        )

    def pick(candidatos, obrigatorio=True):
        for c in candidatos:
            if c in colunas:
                return c
        if obrigatorio:
            raise RuntimeError(f"Coluna obrigatória não encontrada: {candidatos}")
        return None

    mapa = {
        "prestador": pick(_CAND_PRESTADOR),
        "tipo":      pick(_CAND_TIPO),
        "data":      pick(_CAND_DATA),
        "unidade":   pick(_CAND_UNIDADE, obrigatorio=False),
        "banco":     pick(_CAND_BANCO,   obrigatorio=False),
    }

    logger.info(f"  prestador={mapa['prestador']}  tipo={mapa['tipo']}  "
                f"data={mapa['data']}  unidade={mapa['unidade']}  banco={mapa['banco']}")
    return mapa


def consultar_rds(prestadores: list) -> list:
    separador("PASSO 2 — Consultar RDS")

    cd_prestadores = []
    ignorados = []
    for p in prestadores:
        try:
            cd_prestadores.append(int(p["codigomv"]))
        except (ValueError, TypeError):
            ignorados.append(f"{p.get('nome', '?')} → codigomv='{p.get('codigomv')}'")

    if ignorados:
        logger.warning(f"  {len(ignorados)} prestadores ignorados (codigomv não numérico):")
        for i in ignorados:
            logger.warning(f"    {i}")

    cd_tipos = list(TIPOS_DOCUMENTO.keys())

    logger.info(f"  Data      : {DATA_BR}")
    logger.info(f"  Prestadores válidos: {len(cd_prestadores)} / {len(prestadores)}")
    logger.info(f"  Bancos    : {NM_BANCOS}")

    conn = psycopg2.connect(**RDS_CONFIG)
    conn.set_session(readonly=True, autocommit=True)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

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
        ORDER BY {col_p}, nm_unidade, {col_t}
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
# PASSO 3 — Pivotar: um registro por (cd_prestador, nm_unidade)
# ============================================================

def pivotar(rows: list, prestadores: list) -> tuple:
    separador("PASSO 3 — Pivotar resultados")

    # idx_prest: int(codigomv) → prestador dict
    # codigomv_orig: int(codigomv) → string original do codigomv (para gravar em codigo_mv)
    idx_prest    = {}
    codigomv_orig = {}
    for p in prestadores:
        try:
            key = int(p["codigomv"])
            idx_prest[key]     = p
            # Guarda o valor original exato (sem conversão int→str)
            # para que codigo_mv gravado no Supabase seja idêntico a usuarios.codigomv
            codigomv_orig[key] = p["codigomv"].strip()
        except (ValueError, TypeError):
            pass

    # pivot[(cd_prestador, nm_unidade)] = {cd_tipo: total}
    pivot: dict[tuple, dict] = {}

    for row in rows:
        cd_prest = int(row["cd_prestador"])
        nm_unid  = row.get("nm_unidade") or "N/D"
        cd_tipo  = int(row["cd_tipo_documento"])
        total    = int(row["total"])

        chave = (cd_prest, nm_unid)
        pivot.setdefault(chave, {})
        pivot[chave][cd_tipo] = pivot[chave].get(cd_tipo, 0) + total

    # CSV detalhe: uma linha por prestador + tipo + unidade
    detalhe = []
    for (cd_prest, nm_unid), tipos in sorted(pivot.items()):
        info = idx_prest.get(cd_prest, {})
        for cd_tipo, total in sorted(tipos.items()):
            detalhe.append({
                "data":              DATA_ISO,
                "cd_prestador":      cd_prest,
                "codigo_mv":         codigomv_orig.get(cd_prest, str(cd_prest)),
                "nome":              info.get("nome", ""),
                "especialidade":     formatar_especialidade(info.get("especialidade", "")),
                "nm_unidade":        nm_unid,
                "cd_tipo_documento": cd_tipo,
                "ds_tipo_documento": TIPOS_DOCUMENTO.get(cd_tipo, "?"),
                "total":             total,
            })

    # Registros para produtividade: um por (cd_prestador, nm_unidade)
    registros: dict[tuple, dict] = {}

    for (cd_prest, nm_unid), tipos in pivot.items():
        info = idx_prest.get(cd_prest, {})
        chave = (cd_prest, nm_unid)

        if chave not in registros:
            # Usa o codigomv ORIGINAL (idêntico ao que está em usuarios.codigomv)
            codigo_mv_val = codigomv_orig.get(cd_prest, str(cd_prest))
            registros[chave] = {
                "codigo_mv":    codigo_mv_val,
                "nome":         info.get("nome", ""),
                "especialidade": formatar_especialidade(info.get("especialidade", "")),
                "data":         DATA_ISO,
                "nm_unidade":   nm_unid,
                **{campo: 0 for campo in MAPA_PRODUTIVIDADE},
            }

        reg = registros[chave]
        for cd_tipo, total in tipos.items():
            for campo, cd_lista in MAPA_PRODUTIVIDADE.items():
                if cd_tipo in cd_lista:
                    reg[campo] += total

    registros_prod = list(registros.values())

    logger.info(f"  {len(detalhe)} linhas no detalhe")
    logger.info(f"  {len(registros_prod)} registros para produtividade")
    return registros_prod, detalhe


# ============================================================
# PASSO 4 — Upsert no Supabase
# ============================================================

def upsert_supabase(registros: list):
    separador("PASSO 4 — Upsert no Supabase")

    if not registros:
        logger.warning("  Nenhum registro para inserir.")
        return

    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    sucesso = erros = 0

    for reg in registros:
        try:
            existing = (
                sb.table("produtividade")
                .select("id")
                .eq("codigo_mv",  reg["codigo_mv"])
                .eq("data",       reg["data"])
                .eq("nm_unidade", reg["nm_unidade"])
                .execute()
            )

            payload = {k: v for k, v in reg.items()
                       if k not in ("codigo_mv", "data", "nm_unidade")}

            if existing.data:
                sb.table("produtividade").update(payload).eq(
                    "id", existing.data[0]["id"]
                ).execute()
                logger.info(f"  [UPD] {reg['nome']} / {reg['nm_unidade']} — {reg['data']}")
            else:
                payload["codigo_mv"]  = reg["codigo_mv"]
                payload["data"]       = reg["data"]
                payload["nm_unidade"] = reg["nm_unidade"]
                sb.table("produtividade").insert(payload).execute()
                logger.info(f"  [INS] {reg['nome']} / {reg['nm_unidade']} — {reg['data']}")

            sucesso += 1

        except Exception as e:
            logger.error(f"  [ERR] {reg.get('nome', '?')} / {reg.get('nm_unidade', '?')}: {e}")
            erros += 1

    logger.info(f"\n  Resultado: {sucesso} ok, {erros} erros")


# ============================================================
# MAIN
# ============================================================

def main():
    separador("mv-produtividade-rds.py")
    logger.info(f"  Data : {DATA_BR} (ONTEM)")
    logger.info(f"  Bancos RDS : {NM_BANCOS}")

    prestadores = buscar_prestadores()
    if not prestadores:
        logger.warning("Nenhum prestador terceiro com codigomv. Encerrando.")
        return

    rows = consultar_rds(prestadores)
    if not rows:
        logger.warning("Nenhum documento encontrado para ONTEM. Encerrando.")
        return

    registros_prod, detalhe = pivotar(rows, prestadores)

    salvar_csv(f"mv_produtividade_detalhe_{DATA_ISO}.csv", detalhe)
    salvar_csv(f"mv_produtividade_resumo_{DATA_ISO}.csv",  registros_prod)

    upsert_supabase(registros_prod)

    separador("CONCLUÍDO")
    logger.info(f"  CSVs em: {DOWNLOADS}/")


if __name__ == "__main__":
    main()
