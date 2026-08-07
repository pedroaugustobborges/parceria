"""
mv-produtividade-rds-backfill.py
=================================
Mesmo fluxo de mv-produtividade-rds.py, mas processa uma lista de datas
específicas em vez de apenas ONTEM.

Edite DATAS abaixo para definir quais dias serão (re)processados.
"""

import os
import csv
import logging
from datetime import date

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

TABELA_DOC = "assistencial.pw_documento_clinico_completo"

_CAND_PRESTADOR = ["cd_prestador"]
_CAND_DATA      = ["dt_documento", "dh_documento", "dt_lancamento",
                   "dh_lancamento", "dt_realizacao", "dh_realizacao"]
_CAND_UNIDADE   = ["nm_unidade", "nm_hospital"]
_CAND_BANCO     = ["nm_banco"]
_CAND_TIPO      = ["cd_tipo_documento"]

# ============================================================
# DATAS A PROCESSAR  ← edite aqui
# ============================================================

DATAS: list[date] = [
    date(2026, 8, 1),
    date(2026, 8, 2),
    date(2026, 8, 3),
    date(2026, 8, 4),
]

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
# PASSO 1 — Buscar prestadores no Supabase  (uma vez só)
# ============================================================

def buscar_prestadores() -> list:
    separador("PASSO 1 — Buscar prestadores no Supabase")

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "VITE_SUPABASE_URL ou VITE_SUPABASE_SERVICE_ROLE_KEY não encontrados no .env"
        )

    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    resp = (
        sb.table("usuario_codigomv")
        .select("usuario_id, codigomv, nm_unidade, usuarios(id, nome, especialidade)")
        .execute()
    )

    prestadores = resp.data or []
    logger.info(f"  {len(prestadores)} entradas em usuario_codigomv")
    for p in prestadores:
        nome = (p.get("usuarios") or {}).get("nome", "?")
        logger.info(f"    {nome:<35} codigomv={p['codigomv']}  unidade={p['nm_unidade']}")
    return prestadores


# ============================================================
# PASSO 2 — Detectar colunas + Consultar RDS para uma data
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
        raise RuntimeError(f"Sem acesso a {TABELA_DOC}. Solicitar GRANT SELECT à TI.")

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


def consultar_rds(prestadores: list, data_iso: str) -> tuple:
    """
    Retorna (rows, pares_validos) para a data especificada.
    """
    cd_prestadores_set = set()
    nm_unidades_set    = set()
    pares_validos      = set()
    ignorados          = []

    for p in prestadores:
        try:
            cd = int(p["codigomv"])
            nm = p["nm_unidade"]
            cd_prestadores_set.add(cd)
            nm_unidades_set.add(nm)
            pares_validos.add((cd, nm))
        except (ValueError, TypeError):
            nome = (p.get("usuarios") or {}).get("nome", "?")
            ignorados.append(f"{nome} → codigomv='{p.get('codigomv')}'")

    if ignorados:
        logger.warning(f"  {len(ignorados)} entradas ignoradas (codigomv não numérico):")
        for i in ignorados:
            logger.warning(f"    {i}")

    cd_prestadores = list(cd_prestadores_set)
    nm_unidades    = list(nm_unidades_set)
    cd_tipos       = list(TIPOS_DOCUMENTO.keys())

    logger.info(f"  Prestadores válidos: {len(cd_prestadores)} (únicos)")
    logger.info(f"  Unidades  : {nm_unidades}")

    conn = psycopg2.connect(**RDS_CONFIG)
    conn.set_session(readonly=True, autocommit=True)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    mapa  = detectar_colunas(cur)
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
    filtro_unidade = (
        f"AND {col_u} IN ({', '.join(['%s'] * len(nm_unidades))})"
        if col_u and nm_unidades else ""
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
          {filtro_unidade}
        GROUP BY {col_p}, {col_t}, {sel_unidade}, {sel_banco}
        ORDER BY {col_p}, nm_unidade, {col_t}
    """

    params = (
        cd_prestadores
        + cd_tipos
        + [f"{data_iso} 00:00:00", f"{data_iso} 23:59:59"]
        + (NM_BANCOS if col_b else [])
        + (nm_unidades if col_u and nm_unidades else [])
    )

    logger.info("  Executando query...")
    cur.execute(sql, params)
    rows = [dict(r) for r in cur.fetchall()]
    logger.info(f"  {len(rows)} linhas retornadas do RDS")

    cur.close()
    conn.close()
    return rows, pares_validos


# ============================================================
# PASSO 3 — Pivotar
# ============================================================

def pivotar(rows: list, prestadores: list, pares_validos: set, data_iso: str) -> tuple:
    idx: dict[tuple, dict] = {}
    for p in prestadores:
        try:
            cd  = int(p["codigomv"])
            nm  = p["nm_unidade"]
            usr = p.get("usuarios") or {}
            idx[(cd, nm)] = {
                "nome":          usr.get("nome", ""),
                "especialidade": usr.get("especialidade", ""),
                "codigomv_orig": p["codigomv"].strip(),
            }
        except (ValueError, TypeError):
            pass

    pivot: dict[tuple, dict] = {}

    for row in rows:
        cd_prest = int(row["cd_prestador"])
        nm_unid  = row.get("nm_unidade") or "N/D"
        cd_tipo  = int(row["cd_tipo_documento"])
        total    = int(row["total"])

        chave = (cd_prest, nm_unid)
        if chave not in pares_validos:
            continue

        pivot.setdefault(chave, {})
        pivot[chave][cd_tipo] = pivot[chave].get(cd_tipo, 0) + total

    detalhe = []
    for (cd_prest, nm_unid), tipos in sorted(pivot.items()):
        info = idx.get((cd_prest, nm_unid), {})
        for cd_tipo, total_val in sorted(tipos.items()):
            detalhe.append({
                "data":              data_iso,
                "cd_prestador":      cd_prest,
                "codigo_mv":         info.get("codigomv_orig", str(cd_prest)),
                "nome":              info.get("nome", ""),
                "especialidade":     formatar_especialidade(info.get("especialidade", "")),
                "nm_unidade":        nm_unid,
                "cd_tipo_documento": cd_tipo,
                "ds_tipo_documento": TIPOS_DOCUMENTO.get(cd_tipo, "?"),
                "total":             total_val,
            })

    registros: dict[tuple, dict] = {}

    for (cd_prest, nm_unid), tipos in pivot.items():
        info  = idx.get((cd_prest, nm_unid), {})
        chave = (cd_prest, nm_unid)

        if chave not in registros:
            registros[chave] = {
                "codigo_mv":     info.get("codigomv_orig", str(cd_prest)),
                "nome":          info.get("nome", ""),
                "especialidade": formatar_especialidade(info.get("especialidade", "")),
                "data":          data_iso,
                "nm_unidade":    nm_unid,
                **{campo: 0 for campo in MAPA_PRODUTIVIDADE},
            }

        reg = registros[chave]
        for cd_tipo, total_val in tipos.items():
            for campo, cd_lista in MAPA_PRODUTIVIDADE.items():
                if cd_tipo in cd_lista:
                    reg[campo] += total_val

    registros_prod = list(registros.values())
    logger.info(f"  {len(detalhe)} linhas no detalhe, {len(registros_prod)} registros para produtividade")
    return registros_prod, detalhe


# ============================================================
# PASSO 4 — Upsert no Supabase
# ============================================================

def upsert_supabase(sb: Client, registros: list):
    if not registros:
        logger.warning("  Nenhum registro para inserir.")
        return

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

    logger.info(f"  Resultado: {sucesso} ok, {erros} erros")


# ============================================================
# MAIN
# ============================================================

def main():
    separador("mv-produtividade-rds-backfill.py")
    logger.info(f"  Datas a processar: {[d.isoformat() for d in DATAS]}")
    logger.info(f"  Bancos RDS : {NM_BANCOS}")

    prestadores = buscar_prestadores()
    if not prestadores:
        logger.warning("Nenhuma entrada em usuario_codigomv. Encerrando.")
        return

    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    todos_detalhe:  list = []
    todos_resumo:   list = []
    total_inseridos = 0

    for dia in DATAS:
        data_iso = dia.isoformat()
        data_br  = dia.strftime("%d/%m/%Y")

        separador(f"Data: {data_br}")

        rows, pares_validos = consultar_rds(prestadores, data_iso)

        if not rows:
            logger.warning(f"  Nenhum documento encontrado para {data_br}. Pulando.")
            continue

        registros_prod, detalhe = pivotar(rows, prestadores, pares_validos, data_iso)

        todos_detalhe.extend(detalhe)
        todos_resumo.extend(registros_prod)

        separador(f"Upsert — {data_br}")
        upsert_supabase(sb, registros_prod)
        total_inseridos += len(registros_prod)

    # CSVs consolidados de todas as datas
    datas_str = f"{DATAS[0].isoformat()}_a_{DATAS[-1].isoformat()}"
    salvar_csv(f"mv_backfill_detalhe_{datas_str}.csv", todos_detalhe)
    salvar_csv(f"mv_backfill_resumo_{datas_str}.csv",  todos_resumo)

    separador("CONCLUÍDO")
    logger.info(f"  {len(DATAS)} datas processadas, {total_inseridos} registros enviados ao Supabase")
    logger.info(f"  CSVs em: {DOWNLOADS}/")


if __name__ == "__main__":
    main()
