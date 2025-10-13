import os

# Ler o arquivo SQL grande
input_file = 'importar-acessos.sql'
batch_size = 1000  # 1000 registros por arquivo

print(f"📂 Lendo arquivo {input_file}...")

with open(input_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Filtrar apenas linhas de INSERT
inserts = [line for line in lines if line.strip().startswith('INSERT INTO')]

total_registros = len(inserts)
num_arquivos = (total_registros + batch_size - 1) // batch_size

print(f"📊 Total de registros: {total_registros}")
print(f"📦 Serão criados {num_arquivos} arquivos")
print(f"")

# Criar diretório para os lotes
os.makedirs('lotes_sql', exist_ok=True)

# Dividir em lotes
for i in range(num_arquivos):
    start_idx = i * batch_size
    end_idx = min((i + 1) * batch_size, total_registros)

    batch_file = f'lotes_sql/lote_{i+1:03d}_de_{num_arquivos:03d}.sql'

    with open(batch_file, 'w', encoding='utf-8') as f:
        f.write(f"-- Lote {i+1} de {num_arquivos}\n")
        f.write(f"-- Registros {start_idx+1} a {end_idx}\n\n")
        f.writelines(inserts[start_idx:end_idx])
        f.write(f"\n-- ✅ Lote {i+1} concluído ({end_idx - start_idx} registros)\n")

    print(f"✅ Criado: {batch_file} ({end_idx - start_idx} registros)")

print(f"\n🎉 Divisão concluída!")
print(f"📁 Arquivos criados na pasta: lotes_sql/")
print(f"\n▶️  Próximos passos:")
print(f"   1. Abra a pasta 'lotes_sql'")
print(f"   2. Comece pelo 'lote_001_de_{num_arquivos:03d}.sql'")
print(f"   3. Copie e execute no Supabase SQL Editor")
print(f"   4. Repita para cada lote (ou execute os primeiros 5-10)")
print(f"\n💡 Dica: Você não precisa importar todos os lotes se quiser apenas testar!")
