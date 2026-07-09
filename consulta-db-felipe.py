import psycopg2

conn = psycopg2.connect(
    host="db-rds-postgres.cx4bovrfmkbp.sa-east-1.rds.amazonaws.com",
    database="db_rds_01",
    user="gest_contratos",
    password="asdgRTFG98",
    port="5432"
)
cursor = conn.cursor()

query = """
COPY (
    select * from assistencial.aviso_cirurgia_completo av
    left join assistencial.cirurgia_aviso_completo cir on cir.cd_aviso_cirurgia = av.cd_aviso_cirurgia
    left join assistencial.prestador_aviso_completo pres on pres.cd_cirurgia_aviso = cir.cd_cirurgia_aviso
    where pres.cd_prestador = 3729
      and av.nm_unidade like upper('hugol')
      and av.nm_banco = 'producao_ses_go'
      and av.dh_realizacao >= to_timestamp('01/01/2026','dd/MM/yyyy')
      and av.dh_realizacao <= to_timestamp('09/07/2026','dd/MM/yyyy')
      and av.dh_cancelamento is null
) TO STDOUT WITH CSV HEADER
"""

caminho_arquivo = r"C:\Users\16144-pedro\Downloads\resultado.csv"

with open(caminho_arquivo, "w", encoding="utf-8") as file:
    cursor.copy_expert(query, file)

cursor.close()
conn.close()