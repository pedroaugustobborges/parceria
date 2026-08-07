"""
mv-produtividade-rds.py
=======================
Substitui o web scraper do relatório MV pelo acesso direto ao banco RDS.

Fluxo ao rodar (diariamente às 13h BRT via cron):

  FASE 1 — Inserção do dia anterior (D-1):
    1. Busca entradas de usuario_codigomv no Supabase
    2. Consulta pw_documento_clinico_completo no RDS para D-1
    3. Pivota contagens por CD_TIPO_DOCUMENTO → 9 colunas de produtividade
    4. Upsert no Supabase (chave: codigo_mv + data + nm_unidade)
       - INSERT: seta created_at e updated_at via default do banco
       - UPDATE: sempre sobrescreve e atualiza updated_at

  FASE 2 — Revisão retroativa (D-2 a D-8):
    A tabela pw_documento_clinico_completo pode sofrer alterações por até
    7 dias após a data original. Por isso, a cada execução o script também
    reprocessa os 7 dias anteriores a D-1 e corrige o Supabase apenas
    quando os valores de produtividade mudaram (updated_at é atualizado
    somente em caso de alteração real, preservando o histórico de created_at).

  FASE 3 — CSV de auditoria em ~/Downloads/
"""

import os
import csv
import logging
from datetime import date, timedelta, datetime, timezone

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

PROD_COLS = list(MAPA_PRODUTIVIDADE.keys())   # lista das 9 colunas de produtividade

# Quantos dias retroativos verificar após D-1 (D-2 até D-(JANELA+1))
JANELA_RETROATIVA_DIAS = 7

DOWNLOADS = os.path.expanduser("~/Downloads")

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


def now_utc_iso() -> str:
    """Retorna o instante atual em UTC no formato ISO 8601."""
    return datetime.now(timezone.utc).isoformat()


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

def buscar_prestadores(sb: Client) -> list:
    """
    Retorna lista de entradas de usuario_codigomv, cada uma com:
      { "usuario_id": ..., "codigomv": "1819", "nm_unidade": "HUGOL",
        "usuarios": { "id": ..., "nome": ..., "especialidade": [...] } }
    """
    separador("PASSO 1 — Buscar prestadores no Supabase")

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


def consultar_rds(prestadores: list, data_iso: str) -> tuple:
    """
    Consulta o RDS para a data indicada (YYYY-MM-DD).
    Retorna (rows, pares_validos) onde:
      - rows        : lista de dicts do RDS
      - pares_validos: set de (int(codigomv), nm_unidade) autorizados
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

    logger.info(f"  Data      : {data_iso}")
    logger.info(f"  Prestadores válidos: {len(cd_prestadores)} (únicos)")
    logger.info(f"  Unidades  : {nm_unidades}")
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
# PASSO 3 — Pivotar: um registro por (cd_prestador, nm_unidade)
# ============================================================

def pivotar(rows: list, prestadores: list, pares_validos: set, data_iso: str) -> tuple:
    """
    Pivota as linhas do RDS em registros de produtividade.
    Retorna (registros_prod, detalhe).
    """
    # idx: (int(codigomv), nm_unidade) → {nome, especialidade, codigomv_orig}
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

    # pivot[(cd_prestador, nm_unidade)] = {cd_tipo: total}
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

    # CSV detalhe
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

    # Registros de produtividade: um por (cd_prestador, nm_unidade)
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

    logger.info(f"  {len(detalhe)} linhas no detalhe")
    logger.info(f"  {len(registros_prod)} registros para produtividade")
    return registros_prod, detalhe


# ============================================================
# PASSO 4a — Upsert D-1 (sempre grava, atualiza updated_at)
# ============================================================

def upsert_supabase(sb: Client, registros: list):
    """
    Fase 1: insere ou atualiza os registros de D-1.
    Em UPDATE, sempre seta updated_at = agora (dados frescos do RDS).
    """
    separador("PASSO 4a — Upsert D-1 no Supabase")

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
                payload["updated_at"] = now_utc_iso()
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
# PASSO 4b — Revisão retroativa D-2 a D-8
# ============================================================

def revisar_retroativo(sb: Client, registros_novos: list):
    """
    Fase 2: para dias anteriores (D-2 a D-8), compara as 9 colunas de
    produtividade com o que já existe no Supabase.

    - Se o registro não existir → INSERT (dado que chegou com atraso)
    - Se existir e os valores mudaram → UPDATE + atualiza updated_at
    - Se existir e os valores são iguais → sem alteração (updated_at preservado)
    """
    if not registros_novos:
        logger.info("  Sem registros do RDS para esta data.")
        return

    alterados = inseridos = iguais = erros = 0

    for reg in registros_novos:
        try:
            existing_resp = (
                sb.table("produtividade")
                .select("id, " + ", ".join(PROD_COLS))
                .eq("codigo_mv",  reg["codigo_mv"])
                .eq("data",       reg["data"])
                .eq("nm_unidade", reg["nm_unidade"])
                .execute()
            )

            if not existing_resp.data:
                # Registro inexistente — insere (dado retroativo)
                sb.table("produtividade").insert(reg).execute()
                logger.info(
                    f"  [INS-RETRO] {reg['nome']} / {reg['nm_unidade']} — {reg['data']}"
                )
                inseridos += 1
                continue

            existente = existing_resp.data[0]

            # Compara as 9 colunas
            mudou = any(
                int(existente.get(col) or 0) != int(reg.get(col) or 0)
                for col in PROD_COLS
            )

            if mudou:
                payload = {col: reg[col] for col in PROD_COLS}
                payload["updated_at"] = now_utc_iso()
                sb.table("produtividade").update(payload).eq(
                    "id", existente["id"]
                ).execute()
                diffs = [
                    f"{col}: {existente.get(col) or 0}→{reg.get(col) or 0}"
                    for col in PROD_COLS
                    if int(existente.get(col) or 0) != int(reg.get(col) or 0)
                ]
                logger.info(
                    f"  [UPD-RETRO] {reg['nome']} / {reg['nm_unidade']} — {reg['data']}  "
                    f"({', '.join(diffs)})"
                )
                alterados += 1
            else:
                logger.info(
                    f"  [=] {reg['nome']} / {reg['nm_unidade']} — {reg['data']}  sem alteração"
                )
                iguais += 1

        except Exception as e:
            logger.error(
                f"  [ERR] {reg.get('nome', '?')} / {reg.get('nm_unidade', '?')}: {e}"
            )
            erros += 1

    logger.info(
        f"\n  Resultado retroativo: {inseridos} inseridos, "
        f"{alterados} atualizados, {iguais} sem alteração, {erros} erros"
    )


# ============================================================
# MAIN
# ============================================================

def main():
    hoje  = date.today()
    ontem = hoje - timedelta(days=1)

    separador("mv-produtividade-rds.py")
    logger.info(f"  Execução  : {hoje.strftime('%d/%m/%Y')} às {datetime.now().strftime('%H:%M:%S')}")
    logger.info(f"  D-1       : {ontem.isoformat()}")
    logger.info(f"  Retroativo: D-2 a D-{1 + JANELA_RETROATIVA_DIAS}  "
                f"({(hoje - timedelta(days=2)).isoformat()} → "
                f"{(hoje - timedelta(days=1 + JANELA_RETROATIVA_DIAS)).isoformat()})")
    logger.info(f"  Bancos RDS: {NM_BANCOS}")

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "VITE_SUPABASE_URL ou VITE_SUPABASE_SERVICE_ROLE_KEY não encontrados no .env"
        )

    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    prestadores = buscar_prestadores(sb)
    if not prestadores:
        logger.warning("Nenhuma entrada em usuario_codigomv. Encerrando.")
        return

    # ── FASE 1: D-1 (dados frescos, sempre upsert) ───────────────────────────

    separador(f"FASE 1 — Inserção D-1: {ontem.isoformat()}")

    data_iso_ontem = ontem.isoformat()
    rows, pares_validos = consultar_rds(prestadores, data_iso_ontem)

    if rows:
        registros_prod, detalhe = pivotar(rows, prestadores, pares_validos, data_iso_ontem)
        salvar_csv(f"mv_produtividade_detalhe_{data_iso_ontem}.csv", detalhe)
        salvar_csv(f"mv_produtividade_resumo_{data_iso_ontem}.csv",  registros_prod)
        upsert_supabase(sb, registros_prod)
    else:
        logger.warning(f"  Nenhum documento encontrado para D-1 ({data_iso_ontem}).")

    # ── FASE 2: D-2 a D-8 (revisão retroativa, só atualiza se mudou) ─────────

    separador(f"FASE 2 — Revisão retroativa (D-2 a D-{1 + JANELA_RETROATIVA_DIAS})")

    for dias_atras in range(2, 2 + JANELA_RETROATIVA_DIAS):
        dia     = hoje - timedelta(days=dias_atras)
        data_iso = dia.isoformat()

        separador(f"  Revisando D-{dias_atras}: {data_iso}")

        rows_retro, _ = consultar_rds(prestadores, data_iso)

        if not rows_retro:
            logger.info(f"  Sem dados no RDS para {data_iso}.")
            continue

        registros_retro, _ = pivotar(rows_retro, prestadores, pares_validos, data_iso)
        revisar_retroativo(sb, registros_retro)

    separador("CONCLUÍDO")
    logger.info(f"  CSVs em: {DOWNLOADS}/")


if __name__ == "__main__":
    main()
