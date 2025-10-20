import csv
import uuid
import json
from datetime import datetime

# Ler o arquivo CSV e gerar SQL INSERT statements
def generate_insert_statements(csv_file_path, output_sql_file):
    """
    Gera SQL INSERT statements para inserir usuários do CSV na tabela usuarios
    sem criar usuários de autenticação.
    """

    insert_statements = []

    # Header do arquivo SQL
    sql_header = """-- Script para inserir usuários do arquivo new_users.csv
-- Execute este script no Supabase SQL Editor
-- ATENÇÃO: Este script insere registros na tabela usuarios SEM criar usuários de autenticação

-- Desabilitar temporariamente os triggers e validações se necessário
BEGIN;

"""

    insert_statements.append(sql_header)

    # Ler o CSV
    with open(csv_file_path, 'r', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)

        for row in reader:
            # Gerar um UUID para o usuário
            user_id = str(uuid.uuid4())

            # Extrair dados do CSV
            nome = row['nome'].strip()
            cpf = row['cpf'].strip()
            tipo = row['tipo'].strip()
            contrato_id = row['contrato_id'].strip() if row['contrato_id'].strip() else None
            codigomv = row['codigomv'].strip() if row['codigomv'].strip() else None
            especialidade_raw = row['especialidade'].strip() if row['especialidade'].strip() else None

            # Processar especialidade (converter de JSON string para array PostgreSQL)
            if especialidade_raw:
                try:
                    # Parse JSON array
                    especialidade_list = json.loads(especialidade_raw)
                    # Converter para formato PostgreSQL array
                    especialidade_pg = "ARRAY[" + ", ".join([f"'{esp}'" for esp in especialidade_list]) + "]"
                except json.JSONDecodeError:
                    especialidade_pg = "NULL"
            else:
                especialidade_pg = "NULL"

            # Gerar email fictício baseado no CPF (para cumprir requisito de campo não-nulo)
            email = f"{cpf}@terceiro.agir.com.br"

            # Timestamps
            now = datetime.now().isoformat()

            # Gerar INSERT statement
            if contrato_id:
                insert_sql = f"""INSERT INTO usuarios (id, email, nome, cpf, tipo, contrato_id, codigomv, especialidade, created_at, updated_at)
VALUES (
    '{user_id}',
    '{email}',
    '{nome}',
    '{cpf}',
    '{tipo}',
    '{contrato_id}',
    '{codigomv}',
    {especialidade_pg},
    '{now}',
    '{now}'
);
"""
            else:
                insert_sql = f"""INSERT INTO usuarios (id, email, nome, cpf, tipo, contrato_id, codigomv, especialidade, created_at, updated_at)
VALUES (
    '{user_id}',
    '{email}',
    '{nome}',
    '{cpf}',
    '{tipo}',
    NULL,
    '{codigomv}',
    {especialidade_pg},
    '{now}',
    '{now}'
);
"""

            insert_statements.append(insert_sql)

            # Se houver contrato_id, criar vínculo na tabela usuario_contrato
            if contrato_id:
                vinculo_sql = f"""INSERT INTO usuario_contrato (id, usuario_id, contrato_id, cpf, created_at)
VALUES (
    '{str(uuid.uuid4())}',
    '{user_id}',
    '{contrato_id}',
    '{cpf}',
    '{now}'
);
"""
                insert_statements.append(vinculo_sql)

    # Footer do arquivo SQL
    sql_footer = """
COMMIT;

-- Verificar os usuários inseridos
SELECT id, email, nome, cpf, tipo, codigomv, especialidade
FROM usuarios
WHERE email LIKE '%@terceiro.agir.com.br'
ORDER BY created_at DESC;
"""

    insert_statements.append(sql_footer)

    # Escrever no arquivo SQL
    with open(output_sql_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(insert_statements))

    print(f"[OK] SQL gerado com sucesso!")
    print(f"[OK] Arquivo de saida: {output_sql_file}")
    print(f"[OK] Total de usuarios processados: {len(insert_statements) - 2}")  # -2 para remover header e footer

if __name__ == "__main__":
    csv_file = "new_users.csv"
    output_file = "insert-users-from-csv.sql"

    try:
        generate_insert_statements(csv_file, output_file)
    except FileNotFoundError:
        print(f"[ERRO] Arquivo '{csv_file}' nao encontrado!")
        print(f"       Certifique-se de que o arquivo esta no mesmo diretorio do script.")
    except Exception as e:
        print(f"[ERRO] Erro ao processar arquivo: {str(e)}")
