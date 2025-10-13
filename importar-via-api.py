import csv
import requests
import os
from datetime import datetime

# Configurações do Supabase (do arquivo .env)
SUPABASE_URL = "https://qszqzdnlhxpglllyqtht.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzenF6ZG5saHhwZ2xsbHlxdGh0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDI4MzcxNCwiZXhwIjoyMDc1ODU5NzE0fQ.NbzZAKa3X1mkSVetR_JQoq1UoE1mUtaETVkndBs-wgk"

# Headers para requisições
headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# URL da API
api_url = f"{SUPABASE_URL}/rest/v1/acessos"

print("🚀 Iniciando importação via Supabase API...")
print(f"📂 Lendo arquivo Acessos.csv...\n")

# Contadores
total = 0
sucesso = 0
erros = 0
batch = []
batch_size = 100

# Ler e importar CSV
with open('Acessos.csv', 'r', encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)

    for row in reader:
        try:
            # Converter data DD/MM/YYYY HH:MM:SS -> YYYY-MM-DD HH:MM:SS
            data_parts = row['data_acesso'].split(' ')
            date_parts = data_parts[0].split('/')
            time_part = data_parts[1] if len(data_parts) > 1 else '00:00:00'
            data_formatada = f"{date_parts[2]}-{date_parts[1]}-{date_parts[0]} {time_part}"

            # Criar registro
            registro = {
                "tipo": row['tipo'],
                "matricula": row['matricula'],
                "nome": row['nome'],
                "cpf": row['cpf'],
                "data_acesso": data_formatada,
                "sentido": row['sentido']
            }

            batch.append(registro)
            total += 1

            # Enviar batch quando atingir o tamanho
            if len(batch) >= batch_size:
                response = requests.post(api_url, json=batch, headers=headers)

                if response.status_code in [200, 201]:
                    sucesso += len(batch)
                    print(f"✅ Importados {sucesso}/{total} registros...")
                else:
                    erros += len(batch)
                    print(f"❌ Erro no lote: {response.status_code} - {response.text[:100]}")

                batch = []

        except Exception as e:
            erros += 1
            print(f"❌ Erro ao processar linha {total}: {e}")
            continue

    # Enviar registros restantes
    if batch:
        response = requests.post(api_url, json=batch, headers=headers)

        if response.status_code in [200, 201]:
            sucesso += len(batch)
            print(f"✅ Importados {sucesso}/{total} registros...")
        else:
            erros += len(batch)
            print(f"❌ Erro no último lote: {response.status_code}")

print(f"\n{'='*50}")
print(f"🎉 Importação concluída!")
print(f"{'='*50}")
print(f"📊 Total processado: {total}")
print(f"✅ Sucesso: {sucesso}")
print(f"❌ Erros: {erros}")
print(f"\n▶️  Acesse o dashboard para ver os dados!")
