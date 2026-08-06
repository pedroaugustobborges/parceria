"""
executar-migration.py
=====================
Executa um arquivo .sql diretamente no PostgreSQL do Supabase self-hosted.

Uso:
    python executar-migration.py migrations/029_reestruturar_produtividade.sql

Credenciais: defina as variáveis abaixo ou exporte no ambiente antes de rodar.
As credenciais do PostgreSQL do Supabase self-hosted ficam no .env do servidor
em /opt/parceria/.env (variáveis POSTGRES_* ou DB_*).
"""

import os
import sys
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# ============================================================
# CREDENCIAIS DO POSTGRESQL (Supabase self-hosted)
# Ajuste conforme o .env do servidor (/opt/parceria/.env)
# ============================================================
DB_HOST     = os.getenv("DB_HOST",     "parceria.daherlab.org.br")
DB_PORT     = os.getenv("DB_PORT",     "5432")
DB_NAME     = os.getenv("DB_NAME",     "postgres")
DB_USER     = os.getenv("DB_USER",     "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")   # preencha ou exporte DB_PASSWORD=...

# ============================================================

def main():
    if len(sys.argv) < 2:
        print("Uso: python executar-migration.py <arquivo.sql>")
        sys.exit(1)

    arquivo_sql = sys.argv[1]

    if not os.path.exists(arquivo_sql):
        print(f"Arquivo não encontrado: {arquivo_sql}")
        sys.exit(1)

    with open(arquivo_sql, encoding="utf-8") as f:
        sql = f.read()

    print(f"Arquivo  : {arquivo_sql}")
    print(f"Host     : {DB_HOST}:{DB_PORT}")
    print(f"Database : {DB_NAME}")
    print(f"Usuário  : {DB_USER}")
    print()

    if not DB_PASSWORD:
        print("ERRO: DB_PASSWORD não definido.")
        print("  Exporte antes de rodar:")
        print("    set DB_PASSWORD=sua_senha   (Windows)")
        print("    export DB_PASSWORD=sua_senha (Linux/Mac)")
        sys.exit(1)

    confirm = input("Confirmar execução? (s/N): ").strip().lower()
    if confirm != "s":
        print("Cancelado.")
        sys.exit(0)

    print("\nConectando...")
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            connect_timeout=10,
        )
        conn.autocommit = False
        cur = conn.cursor()
        print("Conectado. Executando SQL...\n")

        cur.execute(sql)

        # Mostrar resultado da última query (SELECT de verificação)
        if cur.description:
            colunas = [d[0] for d in cur.description]
            print(f"  {'  '.join(colunas)}")
            print(f"  {'-' * 80}")
            for row in cur.fetchall():
                print(f"  {'  '.join(str(v) for v in row)}")

        conn.commit()
        print("\nMigration aplicada com sucesso.")

    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
        print(f"\nERRO — rollback executado:\n  {e}")
        sys.exit(1)

    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()


if __name__ == "__main__":
    main()
