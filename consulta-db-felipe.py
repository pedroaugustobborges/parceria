"""
consulta-db-felipe.py
=====================
Exploração do banco RDS (MV/SES-GO) para avaliar dados disponíveis
e possível alimentação da tabela 'produtividade'.

Seções:
  1. Cirurgias (aviso_cirurgia) → resultado_cirurgias.csv
  2. Estrutura de pw_documento_clinico_completo (colunas + amostras)
  3. Documentos clínicos filtrados → resultado_documentos.csv
  4. Agregação por tipo de documento (comparativo com produtividade)

Configurações de filtro (ajustar conforme necessidade):
  FILTRO_CD_PRESTADOR : código da empresa/contrato (3729 = HELPMED)
  FILTRO_NM_UNIDADE   : nome da unidade (ex: 'HUGOL')
  FILTRO_NM_BANCO     : banco de origem ('producao_ses_go')
  DATA_INICIO / DATA_FIM : período de análise
"""

import psycopg2
import csv
import os
from datetime import date

# ============================================================
# CONFIGURAÇÕES
# ============================================================

DB_CONFIG = dict(
    host="db-rds-postgres.cx4bovrfmkbp.sa-east-1.rds.amazonaws.com",
    database="db_rds_01",
    user="gest_contratos",
    password="asdgRTFG98",
    port="5432",
)

FILTRO_CD_PRESTADOR = 3729          # HELPMED
FILTRO_NM_UNIDADE   = "HUGOL"
FILTRO_NM_BANCO     = "producao_ses_go"   # GO = HUGOL / HECAD / CRER
DATA_INICIO         = "01/01/2026"
DATA_FIM            = "15/07/2026"  # hoje

# Bancos conhecidos no RDS (informação da TI)
# producao_ses_go  → Goiás    (nosso — HUGOL, HECAD, CRER)
# producao_ses_ms  → Mato Grosso do Sul
# producao_ses_am  → Amazonas
# producao_munc_es → Municipal Espírito Santo

DOWNLOADS = r"C:\Users\16144-pedro\Downloads"

# ============================================================
# UTILITÁRIOS
# ============================================================

def salvar_csv(caminho, cursor):
    """Salva resultado de cursor aberto em CSV."""
    colunas = [desc[0] for desc in cursor.description]
    with open(caminho, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(colunas)
        writer.writerows(cursor.fetchall())
    print(f"  -> Salvo: {caminho}")


def separador(titulo=""):
    print("\n" + "=" * 70)
    if titulo:
        print(f"  {titulo}")
        print("=" * 70)


# ============================================================
# CONEXÃO
# ============================================================

print("Conectando ao RDS...")
conn = psycopg2.connect(**DB_CONFIG)
conn.set_session(readonly=True, autocommit=True)
cur = conn.cursor()
print("Conectado.\n")


# ============================================================
# SEÇÃO 1 — CIRURGIAS (query original)
# ============================================================

separador("SEÇÃO 1 — Cirurgias (aviso_cirurgia_completo)")

cur.execute(f"""
    SELECT av.*, cir.*, pres.*
    FROM assistencial.aviso_cirurgia_completo av
    LEFT JOIN assistencial.cirurgia_aviso_completo cir
          ON cir.cd_aviso_cirurgia = av.cd_aviso_cirurgia
    LEFT JOIN assistencial.prestador_aviso_completo pres
          ON pres.cd_cirurgia_aviso = cir.cd_cirurgia_aviso
    WHERE pres.cd_prestador = {FILTRO_CD_PRESTADOR}
      AND av.nm_unidade     = upper('{FILTRO_NM_UNIDADE}')
      AND av.nm_banco       = '{FILTRO_NM_BANCO}'
      AND av.dh_realizacao >= to_timestamp('{DATA_INICIO}','dd/MM/yyyy')
      AND av.dh_realizacao <= to_timestamp('{DATA_FIM}','dd/MM/yyyy')
      AND av.dh_cancelamento IS NULL
    ORDER BY av.dh_realizacao DESC
""")
salvar_csv(os.path.join(DOWNLOADS, "resultado_cirurgias.csv"), cur)


# ============================================================
# SEÇÃO 2 — ESTRUTURA de pw_documento_clinico_completo
# ============================================================

separador("SEÇÃO 2 — Estrutura de pw_documento_clinico_completo")

TABELA_DOC = "assistencial.pw_documento_clinico_completo"
colunas = []
col_unidade = col_tipo = col_data_principal = None
TEM_ACESSO_DOC = False

# 2a. Verificar se o usuário tem acesso — testa permissão primeiro
print("\n[2a] Verificando acesso à tabela...")
try:
    cur.execute(f"SELECT * FROM {TABELA_DOC} LIMIT 1")
    TEM_ACESSO_DOC = True
    colunas = [desc[0] for desc in cur.description]
    print(f"  OK — acesso concedido. Colunas encontradas: {len(colunas)}")
except Exception as e:
    conn.rollback()  # limpa o estado de erro da transação
    print(f"  SEM PERMISSÃO: {e}")
    print()
    print("  *** AÇÃO NECESSÁRIA ***")
    print("  Solicitar à equipe de TI que execute no RDS:")
    print(f"  GRANT SELECT ON {TABELA_DOC} TO gest_contratos;")
    print()

# 2b. Verificar se a tabela existe em algum schema acessível
print("[2b] Tabelas 'pw_documento*' visíveis ao usuário gest_contratos:")
cur.execute("""
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_name ILIKE '%documento%'
    ORDER BY table_schema, table_name
""")
rows = cur.fetchall()
if rows:
    for r in rows:
        print(f"  {r[0]}.{r[1]}")
else:
    print("  Nenhuma tabela com 'documento' no nome está visível para este usuário.")

# 2c. Listar todas as tabelas do schema assistencial acessíveis
print("\n[2c] Tabelas do schema 'assistencial' visíveis ao usuário:")
cur.execute("""
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'assistencial'
    ORDER BY table_name
""")
rows = cur.fetchall()
if rows:
    for r in rows:
        print(f"  assistencial.{r[0]}")
else:
    print("  Nenhuma tabela visível no schema assistencial (verifique permissões).")

if not TEM_ACESSO_DOC:
    separador("SEÇÃO 3 — Pulada (sem acesso a pw_documento_clinico_completo)")
    print("  Aguardar liberação de permissão pela TI.")
    separador("SEÇÃO 4 — Pulada (depende da Seção 2)")
    separador("SEÇÃO 5 — Pulada (depende da Seção 2)")

else:
    # 2d. Listar todas as colunas
    print("\n[2d] Colunas da tabela:")
    cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'assistencial'
          AND table_name   = 'pw_documento_clinico_completo'
        ORDER BY ordinal_position
    """)
    for r in cur.fetchall():
        print(f"  {r[0]:<45} {r[1]}")

    # Detectar colunas-chave automaticamente
    colunas_lower = [c.lower() for c in colunas]

    col_unidade = next(
        (c for c in colunas if any(k in c.lower() for k in ["unidade", "hospital", "nm_uni"])), None
    )
    col_banco = next(
        (c for c in colunas if "banco" in c.lower()), None
    )
    # CD_TIPO_DOCUMENTO tem prioridade; fallback para nm_tipo_documento e tp_*
    col_tipo = next(
        (c for c in colunas if c.lower() == "cd_tipo_documento"),
        next(
            (c for c in colunas if c.lower() == "nm_tipo_documento"),
            next(
                (c for c in colunas if "tipo" in c.lower() and "doc" in c.lower()),
                next((c for c in colunas if c.lower().startswith("tp_") or "nm_tipo" in c.lower()), None)
            )
        )
    )
    col_datas = [c for c in colunas if any(k in c.lower() for k in ["dt_", "dh_", "data"])]
    col_data_principal = next(
        (c for c in colunas if c.lower() in ("dt_documento", "dh_documento", "dt_realizacao",
                                              "dh_realizacao", "dt_lancamento", "dh_lancamento")),
        col_datas[0] if col_datas else None
    )

    print(f"\n  Coluna de unidade detectada : {col_unidade}")
    print(f"  Coluna de banco detectada   : {col_banco}")
    print(f"  Coluna de tipo detectada    : {col_tipo}  {'<-- CD_TIPO_DOCUMENTO OK' if col_tipo and col_tipo.lower() == 'cd_tipo_documento' else ''}")
    print(f"  Coluna de data detectada    : {col_data_principal}")
    col_prest = [c for c in colunas if any(k in c.lower() for k in ["presta", "medic", "cd_"])]
    print(f"  Colunas de prestador/médico : {col_prest}")

    # Verificar explicitamente se CD_TIPO_DOCUMENTO existe
    print(f"\n  CD_TIPO_DOCUMENTO presente? : {'SIM ✓' if 'cd_tipo_documento' in colunas_lower else 'NÃO — verificar nome real da coluna'}")
    print(f"  NM_BANCO presente?          : {'SIM ✓' if col_banco else 'NÃO — perguntar TI como filtrar por banco'}")

    # 2e. Amostra
    print("\n[2e] Amostra de 3 linhas:")
    cur.execute(f"SELECT * FROM {TABELA_DOC} LIMIT 3")
    for r in cur.fetchall():
        print(" ", dict(zip(colunas, r)))

    # 2f. Unidades disponíveis
    if col_unidade:
        print(f"\n[2f] Unidades disponíveis ({col_unidade}):")
        cur.execute(f"""
            SELECT {col_unidade}, count(*) AS total
            FROM {TABELA_DOC}
            GROUP BY {col_unidade}
            ORDER BY total DESC LIMIT 30
        """)
        for r in cur.fetchall():
            print(f"  {r[0]}: {r[1]:,}")

    # 2g. Bancos disponíveis na tabela
    if col_banco:
        print(f"\n[2g] Bancos disponíveis ({col_banco}):")
        cur.execute(f"""
            SELECT {col_banco}, count(*) AS total
            FROM {TABELA_DOC}
            GROUP BY {col_banco}
            ORDER BY total DESC
        """)
        for r in cur.fetchall():
            marcador = " <-- NOSSO (GO)" if r[0] == FILTRO_NM_BANCO else ""
            print(f"  {r[0]}: {r[1]:,}{marcador}")

    # 2h. Tipos de documento (CD_TIPO_DOCUMENTO ou similar)
    if col_tipo:
        filtro_banco_pre = f"WHERE {col_banco} = '{FILTRO_NM_BANCO}'" if col_banco else ""
        print(f"\n[2h] Valores de {col_tipo} (filtrado por banco={FILTRO_NM_BANCO if col_banco else 'todos'}):")
        cur.execute(f"""
            SELECT {col_tipo}, count(*) AS total
            FROM {TABELA_DOC}
            {filtro_banco_pre}
            GROUP BY {col_tipo}
            ORDER BY total DESC
        """)
        for r in cur.fetchall():
            print(f"  {str(r[0]):<50} {r[1]:,}")

    # 2i. Range de datas (filtrado por banco GO)
    if col_data_principal:
        filtro_banco_range = f"WHERE {col_banco} = '{FILTRO_NM_BANCO}'" if col_banco else ""
        print(f"\n[2i] Range de datas ({col_data_principal}) — banco {FILTRO_NM_BANCO if col_banco else 'todos'}:")
        cur.execute(f"""
            SELECT min({col_data_principal}), max({col_data_principal}), count(*)
            FROM {TABELA_DOC}
            {filtro_banco_range}
        """)
        r = cur.fetchone()
        print(f"  Mais antigo : {r[0]}")
        print(f"  Mais recente: {r[1]}")
        print(f"  Total       : {r[2]:,} registros")

    # ============================================================
    # SEÇÃO 3 — DOCUMENTOS CLÍNICOS filtrados
    # ============================================================

    separador("SEÇÃO 3 — Documentos clínicos filtrados")

    filtro_banco_sql    = f"AND {col_banco} = '{FILTRO_NM_BANCO}'" if col_banco else ""
    filtro_unidade_sql  = f"AND {col_unidade} ILIKE '%{FILTRO_NM_UNIDADE}%'" if col_unidade else ""
    filtro_data_sql     = (
        f"AND {col_data_principal} >= to_timestamp('{DATA_INICIO}','dd/MM/yyyy')\n"
        f"      AND {col_data_principal} <= to_timestamp('{DATA_FIM}','dd/MM/yyyy')"
        if col_data_principal else ""
    )

    print(f"\nExportando documentos filtrados (banco={FILTRO_NM_BANCO} / {FILTRO_NM_UNIDADE} / {DATA_INICIO} a {DATA_FIM})...")
    try:
        cur.execute(f"""
            SELECT * FROM {TABELA_DOC}
            WHERE 1=1
              {filtro_banco_sql}
              {filtro_unidade_sql}
              {filtro_data_sql}
            ORDER BY {col_data_principal or '1'} DESC
            LIMIT 10000
        """)
        salvar_csv(os.path.join(DOWNLOADS, "resultado_documentos.csv"), cur)
    except Exception as e:
        conn.rollback()
        print(f"  ERRO: {e}")

    # ============================================================
    # SEÇÃO 4 — AGREGAÇÃO POR TIPO
    # ============================================================

    separador("SEÇÃO 4 — Agregação por tipo de documento")

    CAMPOS_PRODUTIVIDADE = [
        "procedimento", "parecer_solicitado", "parecer_realizado",
        "cirurgia_realizada", "prescricao", "evolucao", "urgencia",
        "ambulatorio", "auxiliar", "encaminhamento",
        "folha_objetivo_diario", "evolucao_diurna_cti", "evolucao_noturna_cti",
    ]
    print("\nCampos da tabela 'produtividade' (Supabase / MV Web scraping):")
    for c in CAMPOS_PRODUTIVIDADE:
        print(f"  - {c}")

    if col_tipo:
        print(f"\nAgregação por {col_tipo} (banco={FILTRO_NM_BANCO}, unidade={FILTRO_NM_UNIDADE}):")
        try:
            cur.execute(f"""
                SELECT {col_tipo}, {col_unidade or "'?'"}, count(*) AS total
                FROM {TABELA_DOC}
                WHERE 1=1
                  {filtro_banco_sql}
                  {filtro_unidade_sql}
                  {filtro_data_sql}
                GROUP BY {col_tipo}, {col_unidade or '2'}
                ORDER BY total DESC
            """)
            rows = cur.fetchall()
            print(f"\n  {'CD_TIPO_DOCUMENTO':<50} {'Unidade':<20} {'Total':>10}")
            print(f"  {'-'*50} {'-'*20} {'-'*10}")
            for r in rows:
                print(f"  {str(r[0]):<50} {str(r[1]):<20} {r[2]:>10,}")

            cur.execute(f"""
                SELECT {col_tipo}, {col_unidade or "'?'"}, count(*) AS total
                FROM {TABELA_DOC}
                WHERE 1=1
                  {filtro_banco_sql}
                  {filtro_unidade_sql}
                  {filtro_data_sql}
                GROUP BY {col_tipo}, {col_unidade or '2'}
                ORDER BY total DESC
            """)
            salvar_csv(os.path.join(DOWNLOADS, "resultado_agregacao_tipos.csv"), cur)
        except Exception as e:
            conn.rollback()
            print(f"  ERRO na agregação: {e}")

    # SEÇÃO 5 já foi coberta na 2g (bancos disponíveis detectados automaticamente)
    separador("SEÇÃO 5 — Resumo de bancos vs produtividade")
    print("""
  Bancos confirmados pela TI no RDS:
    producao_ses_go   → Goiás         (HUGOL, HECAD, CRER)  ← NOSSO
    producao_ses_ms   → Mato Grosso do Sul
    producao_ses_am   → Amazonas
    producao_munc_es  → Municipal Espírito Santo

  Filtro aplicado neste script: nm_banco = 'producao_ses_go'
  Confirmar com TI se existe coluna nm_banco na pw_documento_clinico_completo
  ou se o filtro por banco/estado é feito de outra forma nessa tabela.
    """)


# ============================================================
# FINALIZAÇÃO
# ============================================================

separador("CONCLUÍDO")
print("""
Arquivos gerados em Downloads/:
  resultado_cirurgias.csv          <- query original (aviso_cirurgia)
  resultado_documentos.csv         <- pw_documento_clinico_completo filtrado
  resultado_agregacao_tipos.csv    <- contagem por tipo de documento

--- PRÓXIMOS PASSOS ---
Ver comentário ao final do script com apontamentos e perguntas para TI.
""")

cur.close()
conn.close()


# ============================================================
# APONTAMENTOS E PERGUNTAS PARA A EQUIPE DE TI
# (preencher após rodar o script e analisar os CSVs)
# ============================================================
"""
COMPARATIVO: pw_documento_clinico_completo vs tabela 'produtividade'
====================================================================

CAMPOS JÁ COLETADOS na tabela 'produtividade' (via scraping MV Web):
  - procedimento
  - parecer_solicitado / parecer_realizado
  - cirurgia_realizada
  - prescricao
  - evolucao
  - urgencia / ambulatorio / auxiliar
  - encaminhamento
  - folha_objetivo_diario
  - evolucao_diurna_cti / evolucao_noturna_cti

PERGUNTAS PARA A EQUIPE DE TI:
======================================================================

1. IDENTIFICAÇÃO DO PRESTADOR:
   - A tabela pw_documento_clinico_completo possui coluna de cd_prestador
     ou nm_prestador para identificar o médico que gerou o documento?
   - Como filtrar apenas os médicos do contrato HELPMED (cd_prestador = 3729)?

2. TIPO DE DOCUMENTO:
   - Quais são os possíveis valores de nm_tipo_documento (ou equivalente)?
   - Esses tipos mapeiam diretamente para os campos da produtividade?
     Ex: "EVOLUÇÃO" → evolucao, "PRESCRIÇÃO" → prescricao, etc.

3. FILTRO POR UNIDADE E BANCO:
   - Como identificar registros do HUGOL especificamente?
   - Existe coluna nm_banco (como em aviso_cirurgia_completo) para
     garantir que só pegamos dados de 'producao_ses_go'?

4. GRANULARIDADE (crítico para comparação):
   - Cada linha da tabela representa 1 documento individual?
   - Ou é uma contagem agregada por médico/dia?
   - O campo de data é a data de LANÇAMENTO ou de ASSINATURA do documento?

5. JANELA DE 7 DIAS:
   - A TI informou que a tabela é atualizada com os últimos 7 dias.
   - Para alimentar 'produtividade' diariamente isso é suficiente,
     mas como ficam dados históricos (antes da disponibilização da tabela)?
   - Há uma tabela com histórico completo ou apenas esses 7 dias?

6. CONFIABILIDADE vs SCRAPING ATUAL:
   - Os totais por tipo batem com o que o relatório MV Web mostra?
   - Podemos confiar nos dados da tabela para substituir o scraping?

7. VÍNCULO COM ESCALAS:
   - É possível cruzar os documentos com o cd_atendimento/cd_internacao
     para saber se o médico estava de plantão (escala) quando produziu?

HIPÓTESE DE MAPEAMENTO (validar com TI):
  nm_tipo_documento          → campo produtividade
  ─────────────────────────────────────────────────
  EVOLUÇÃO / EVOLUCAO        → evolucao
  PRESCRIÇÃO                 → prescricao
  PARECER (solicitado)       → parecer_solicitado
  PARECER (realizado)        → parecer_realizado
  PROCEDIMENTO               → procedimento
  URGÊNCIA                   → urgencia
  ENCAMINHAMENTO             → encaminhamento
  FOLHA OBJETIVO DIÁRIO      → folha_objetivo_diario
  EVOLUÇÃO DIURNA CTI        → evolucao_diurna_cti
  EVOLUÇÃO NOTURNA CTI       → evolucao_noturna_cti
  CIRURGIA (já temos na tabela aviso_cirurgia_completo)
"""
