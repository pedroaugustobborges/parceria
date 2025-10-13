import csv
import os
# testando
# Ler o arquivo CSV
csv_file = 'Acessos.csv'
sql_file = 'importar-acessos.sql'

# Verificar se o arquivo existe
if not os.path.exists(csv_file):
    print(f"Erro: Arquivo {csv_file} não encontrado!")
    exit(1)

# Abrir arquivo SQL para escrita
with open(sql_file, 'w', encoding='utf-8') as f:
    f.write("-- Script de Importação de Acessos\n")
    f.write("-- Gerado automaticamente a partir de Acessos.csv\n\n")



    # Ler CSV
    with open(csv_file, 'r', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)

        count = 0
        batch = []

        for row in reader:
            # Extrair apenas as colunas necessárias
            tipo = row['tipo'].replace("'", "''")
            matricula = row['matricula'].replace("'", "''")
            nome = row['nome'].replace("'", "''")
            cpf = row['cpf'].replace("'", "''")
            data_acesso = row['data_acesso']
            sentido = row['sentido']

            # Converter data do formato DD/MM/YYYY HH:MM:SS para YYYY-MM-DD HH:MM:SS
            try:
                parts = data_acesso.split(' ')
                date_parts = parts[0].split('/')
                time_part = parts[1] if len(parts) > 1 else '00:00:00'

                # DD/MM/YYYY -> YYYY-MM-DD
                data_formatada = f"{date_parts[2]}-{date_parts[1]}-{date_parts[0]} {time_part}"

                # Criar INSERT
                insert = f"INSERT INTO acessos (tipo, matricula, nome, cpf, data_acesso, sentido) VALUES ('{tipo}', '{matricula}', '{nome}', '{cpf}', '{data_formatada}', '{sentido}');"
                batch.append(insert)
                count += 1

                # Escrever em lotes de 100
                if len(batch) >= 100:
                    f.write('\n'.join(batch) + '\n\n')
                    batch = []
                    print(f"Processados {count} registros...")

            except Exception as e:
                print(f"Erro ao processar linha: {row}")
                print(f"Erro: {e}")
                continue

        # Escrever registros restantes
        if batch:
            f.write('\n'.join(batch) + '\n\n')

        f.write(f"\n-- Total de {count} registros importados\n")
        f.write("\n-- Verificar importação:\n")
        f.write("SELECT COUNT(*) FROM acessos;\n")
        f.write("SELECT tipo, COUNT(*) FROM acessos GROUP BY tipo;\n")

print(f"\n✅ Script SQL gerado com sucesso!")
print(f"📄 Arquivo: {sql_file}")
print(f"📊 Total de registros: {count}")
print(f"\n▶️  Próximo passo:")
print(f"   1. Abra o arquivo {sql_file}")
print(f"   2. Copie todo o conteúdo")
print(f"   3. Cole no SQL Editor do Supabase")
print(f"   4. Execute o script")
