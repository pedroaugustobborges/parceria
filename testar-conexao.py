import requests

SUPABASE_URL = "https://qszqzdnlhxpglllyqtht.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzenF6ZG5saHhwZ2xsbHlxdGh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyODM3MTQsImV4cCI6MjA3NTg1OTcxNH0.gNdDe2BEm9wDBH4_wQKlsh2kJSk9pgLH5X92GBYG7Iw"

print("Testando conexao com Supabase...\n")

# Teste 1: Conexao basica
try:
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}"
        },
        timeout=10
    )
    if response.status_code == 200:
        print("[OK] Conexao com Supabase OK!")
    else:
        print(f"[ERRO] Erro na conexao: {response.status_code}")
        print(f"   Resposta: {response.text[:200]}")
except Exception as e:
    print(f"[ERRO] Erro de rede: {e}")

# Teste 2: Verificar usuario
print("\nVerificando usuario na tabela...\n")
try:
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/usuarios?email=eq.pedro.borges@agirsaude.org.br",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}"
        },
        timeout=10
    )
    if response.status_code == 200:
        data = response.json()
        if data:
            print(f"[OK] Usuario encontrado!")
            print(f"   ID: {data[0]['id']}")
            print(f"   Nome: {data[0]['nome']}")
            print(f"   Tipo: {data[0]['tipo']}")
        else:
            print("[ERRO] Usuario nao encontrado na tabela")
    else:
        print(f"[ERRO] Erro ao buscar usuario: {response.status_code}")
        print(f"   Resposta: {response.text[:200]}")
except Exception as e:
    print(f"[ERRO] Erro: {e}")

print("\n" + "="*50)
print("Para testar login direto, abra: testar-supabase.html")
