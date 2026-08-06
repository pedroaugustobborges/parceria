"""
backup-produtividade.py
=======================
Baixa TODOS os registros da tabela 'produtividade' do Supabase e salva
em CSV com timestamp no nome do arquivo.

Uso:
    python backup-produtividade.py
"""

import os
import csv
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY")

DOWNLOADS = os.path.expanduser("~/Downloads")
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
ARQUIVO   = os.path.join(DOWNLOADS, f"backup_produtividade_{TIMESTAMP}.csv")

PAGE_SIZE = 1000  # máximo por requisição no Supabase

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("VITE_SUPABASE_URL ou VITE_SUPABASE_SERVICE_ROLE_KEY não encontrados no .env")

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Conectado ao Supabase. Baixando produtividade...")

todos = []
offset = 0

while True:
    resp = (
        sb.table("produtividade")
        .select("*")
        .order("data", desc=False)
        .order("codigo_mv", desc=False)
        .range(offset, offset + PAGE_SIZE - 1)
        .execute()
    )
    lote = resp.data or []
    todos.extend(lote)
    print(f"  {len(todos)} registros baixados...")

    if len(lote) < PAGE_SIZE:
        break
    offset += PAGE_SIZE

print(f"\nTotal: {len(todos)} registros")

if not todos:
    print("Tabela vazia — nenhum arquivo gerado.")
else:
    colunas = list(todos[0].keys())
    with open(ARQUIVO, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=colunas)
        writer.writeheader()
        writer.writerows(todos)
    print(f"Backup salvo em:\n  {ARQUIVO}")
