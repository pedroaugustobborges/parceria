#!/usr/bin/env python3
"""
Script: reset_status_pagamento_fev2026.py
Redefine status_pagamento para "Não" em todas as escalas de fevereiro/2026.

Conecta via Kong interno (localhost:8000) — padrão dos scripts deste projeto.

Uso:
  DRY_RUN=1 python3 /opt/parceria/reset_status_pagamento_fev2026.py   # simulação
  python3 /opt/parceria/reset_status_pagamento_fev2026.py              # execução real
"""

import os
import sys
import requests
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

DOTENV_PATH  = Path("/opt/parceria/.env")
INTERNAL_URL = "http://localhost:8000"
DRY_RUN      = os.getenv("DRY_RUN", "0") == "1"

MES_INICIO = "2026-02-01"
MES_FIM    = "2026-02-28"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_env_file(path: Path) -> dict:
    env = {}
    if not path.exists():
        return env
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def get_service_key() -> str:
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        env = load_env_file(DOTENV_PATH)
        key = env.get("VITE_SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        print(f"ERRO: VITE_SUPABASE_SERVICE_ROLE_KEY não encontrado em {DOTENV_PATH}")
        sys.exit(1)
    return key

# ---------------------------------------------------------------------------
# Cliente REST (Kong interno)
# ---------------------------------------------------------------------------

class SupabaseClient:
    def __init__(self, service_key: str):
        self.base = f"{INTERNAL_URL}/rest/v1"
        self.headers = {
            "apikey":        service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type":  "application/json",
            "Prefer":        "return=representation",
        }

    def select(self, table: str, params: dict | None = None) -> list:
        r = requests.get(
            f"{self.base}/{table}",
            headers=self.headers,
            params=params or {},
            timeout=15,
        )
        r.raise_for_status()
        return r.json()

    def patch(self, table: str, filters: dict, data: dict) -> list:
        """PATCH (update) rows matching filters."""
        params = {k: v for k, v in filters.items()}
        headers = {**self.headers, "Prefer": "return=representation"}
        r = requests.patch(
            f"{self.base}/{table}",
            headers=headers,
            params=params,
            json=data,
            timeout=30,
        )
        if r.status_code not in (200, 204):
            raise RuntimeError(f"Erro ao atualizar {table}: {r.status_code} — {r.text}")
        return r.json() if r.content else []

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    service_key = get_service_key()
    db = SupabaseClient(service_key)

    print(f"{'[DRY RUN] ' if DRY_RUN else ''}Buscando escalas de fevereiro/2026...")

    # Conta quantas escalas serão afetadas
    escalas = db.select("escalas_medicas", {
        "select":     "id,data_inicio,status_pagamento",
        "data_inicio": f"gte.{MES_INICIO}",
        "data_inicio": f"lte.{MES_FIM}",
    })

    # PostgREST não aceita duas chaves iguais em dict — usar params como lista de tuplas
    r = requests.get(
        f"{INTERNAL_URL}/rest/v1/escalas_medicas",
        headers={
            "apikey":        service_key,
            "Authorization": f"Bearer {service_key}",
        },
        params=[
            ("select",      "id,data_inicio,status_pagamento"),
            ("data_inicio", f"gte.{MES_INICIO}"),
            ("data_inicio", f"lte.{MES_FIM}"),
        ],
        timeout=30,
    )
    r.raise_for_status()
    escalas = r.json()

    total = len(escalas)
    ja_nao  = sum(1 for e in escalas if e.get("status_pagamento") == "Não")
    outros  = total - ja_nao

    print(f"  Total de escalas em fev/2026 : {total}")
    print(f"  Já marcadas como 'Não'       : {ja_nao}")
    print(f"  Serão atualizadas            : {outros}")

    if outros == 0:
        print("Nenhuma escala precisa ser atualizada. Encerrando.")
        return

    if DRY_RUN:
        print("\n[DRY RUN] Nenhuma alteração aplicada.")
        return

    # Aplica o PATCH via PostgREST (filtro por intervalo de datas)
    print("\nAtualizando status_pagamento → 'Não'...")
    resp = requests.patch(
        f"{INTERNAL_URL}/rest/v1/escalas_medicas",
        headers={
            "apikey":        service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type":  "application/json",
            "Prefer":        "return=representation",
        },
        params=[
            ("data_inicio", f"gte.{MES_INICIO}"),
            ("data_inicio", f"lte.{MES_FIM}"),
        ],
        json={"status_pagamento": "Não"},
        timeout=60,
    )

    if resp.status_code not in (200, 204):
        print(f"ERRO: {resp.status_code} — {resp.text}")
        sys.exit(1)

    atualizados = len(resp.json()) if resp.content else outros
    print(f"  ✓ {atualizados} escala(s) atualizadas com sucesso.")


if __name__ == "__main__":
    main()
