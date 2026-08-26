#!/usr/bin/env python3
"""
Script: inserir_usuarios_hmsa.py
Insere os usuários do arquivo 'usuarios_hmsa.csv' na base de dados ParcerIA.

Regras:
  - tipo:          terceiro
  - especialidade: ['Clínica Geral']
  - nm_unidade:    'HMSA' (para usuario_codigomv)
  - contratos:     TODOS os contratos ativos vinculados à unidade HMSA
  - deduplicação:  por CPF (ignora se já existir)

Uso:
  DRY_RUN=1 python3 /opt/parceria/inserir_usuarios_hmsa.py   # simulação
  python3 /opt/parceria/inserir_usuarios_hmsa.py              # execução real
"""

import csv
import os
import sys
import uuid
import requests
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

CSV_FILE     = Path(__file__).parent / "usuarios_hmsa.csv"
DOTENV_PATH  = Path("/opt/parceria/.env")
INTERNAL_URL = "http://localhost:8000"
NM_UNIDADE   = "HMSA"
DRY_RUN      = os.getenv("DRY_RUN", "0") == "1"


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

    def insert(self, table: str, data: dict | list) -> list:
        r = requests.post(
            f"{self.base}/{table}",
            headers=self.headers,
            json=data,
            timeout=15,
        )
        if r.status_code not in (200, 201):
            raise RuntimeError(f"Erro ao inserir em {table}: {r.status_code} — {r.text}")
        return r.json()


# ---------------------------------------------------------------------------
# Helpers CSV
# ---------------------------------------------------------------------------

def pad_cpf(cpf: str) -> str:
    """Garante 11 dígitos com zeros à esquerda."""
    return "".join(c for c in cpf if c.isdigit()).zfill(11)


def load_csv(path: Path) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return [
            {
                "codigo_mv": row["codigo_mv"].strip(),
                "cpf":       pad_cpf(row["cpf"].strip()),
                "nome":      row["nome"].strip(),
            }
            for row in csv.DictReader(f)
        ]


def deduplicate(rows: list[dict]) -> list[dict]:
    """Mantém apenas a primeira ocorrência de cada CPF."""
    seen, result = set(), []
    for row in rows:
        if row["cpf"] not in seen:
            seen.add(row["cpf"])
            result.append(row)
    return result


# ---------------------------------------------------------------------------
# Busca contratos HMSA
# ---------------------------------------------------------------------------

def get_hmsa_contracts(client: SupabaseClient) -> tuple[str, list[str]]:
    """
    Retorna (hmsa_unidade_id, [contrato_id, ...]) — todos os contratos ativos
    vinculados à unidade hospitalar com código 'HMSA'.
    """
    uhs = client.select(
        "unidades_hospitalares",
        {"codigo": f"eq.{NM_UNIDADE}", "select": "id,codigo,nome"},
    )
    if not uhs:
        print(f"ERRO: Unidade hospitalar com código '{NM_UNIDADE}' não encontrada.")
        sys.exit(1)
    uh = uhs[0]
    print(f"✔ Unidade hospitalar: {uh['nome']} (id={uh['id']})")

    contratos = client.select(
        "contratos",
        {
            "unidade_hospitalar_id": f"eq.{uh['id']}",
            "ativo":                 "eq.true",
            "select":                "id,nome,empresa",
        },
    )
    if not contratos:
        print(f"ERRO: Nenhum contrato ativo encontrado para a unidade '{NM_UNIDADE}'.")
        sys.exit(1)

    print(f"  Contratos ativos vinculados à HMSA ({len(contratos)}):")
    for c in contratos:
        print(f"    • {c['nome']} — {c['empresa']} (id={c['id']})")

    return uh["id"], [c["id"] for c in contratos]


# ---------------------------------------------------------------------------
# Inserção
# ---------------------------------------------------------------------------

def insert_user(
    client: SupabaseClient,
    user: dict,
    contrato_ids: list[str],
    existing_cpfs: set,
    existing_codigomvs: set,
) -> str:
    cpf, nome, codigo_mv = user["cpf"], user["nome"], user["codigo_mv"]

    if cpf in existing_cpfs:
        return "cpf_duplicado"

    if (codigo_mv, NM_UNIDADE) in existing_codigomvs:
        return "codigomv_duplicado"

    new_id = str(uuid.uuid4())

    if DRY_RUN:
        print(f"    [DRY-RUN] usuarios:         id={new_id}, cpf={cpf}, nome={nome}, codigomv={codigo_mv}")
        for cid in contrato_ids:
            print(f"    [DRY-RUN] usuario_contrato: contrato_id={cid}")
        print(f"    [DRY-RUN] usuario_codigomv: codigomv={codigo_mv}, nm_unidade={NM_UNIDADE}")
        existing_cpfs.add(cpf)
        existing_codigomvs.add((codigo_mv, NM_UNIDADE))
        return "inserido"

    # 1. usuarios
    client.insert("usuarios", {
        "id":                    new_id,
        "email":                 None,
        "nome":                  nome,
        "cpf":                   cpf,
        "tipo":                  "terceiro",
        "codigomv":              codigo_mv,          # campo legado (retrocompatibilidade)
        "especialidade":         ["Clínica Geral"],
        "unidade_hospitalar_id": None,
        "contrato_id":           contrato_ids[0],    # campo legado (primeiro contrato)
    })

    # 2. usuario_contrato — um registro por contrato HMSA
    for cid in contrato_ids:
        client.insert("usuario_contrato", {
            "usuario_id":  new_id,
            "contrato_id": cid,
            "cpf":         cpf,
        })

    # 3. usuario_codigomv
    client.insert("usuario_codigomv", {
        "usuario_id": new_id,
        "codigomv":   codigo_mv,
        "nm_unidade": NM_UNIDADE,
    })

    existing_cpfs.add(cpf)
    existing_codigomvs.add((codigo_mv, NM_UNIDADE))
    return "inserido"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("ParcerIA — Inserção de usuários HMSA")
    print("=" * 60)
    if DRY_RUN:
        print("⚠  MODO DRY-RUN ATIVADO — nenhum dado será gravado\n")

    service_key = get_service_key()
    client = SupabaseClient(service_key)
    print(f"Conectando via Kong interno: {INTERNAL_URL}\n")

    if not CSV_FILE.exists():
        print(f"ERRO: CSV não encontrado: {CSV_FILE}")
        sys.exit(1)

    all_rows = load_csv(CSV_FILE)
    users    = deduplicate(all_rows)
    print(f"CSV lido: {len(all_rows)} linhas → {len(users)} usuários únicos por CPF\n")

    print("Buscando contratos ativos da unidade HMSA...")
    _, contrato_ids = get_hmsa_contracts(client)
    print()

    print("Verificando registros existentes no banco...")
    existing_cpfs = {r["cpf"] for r in client.select("usuarios", {"select": "cpf"})}
    existing_codigomvs = {
        (r["codigomv"], r["nm_unidade"])
        for r in client.select("usuario_codigomv", {"select": "codigomv,nm_unidade"})
    }
    print(f"  CPFs cadastrados:              {len(existing_cpfs)}")
    print(f"  Pares (codigomv, nm_unidade): {len(existing_codigomvs)}\n")

    counts = {"inserido": 0, "cpf_duplicado": 0, "codigomv_duplicado": 0, "erro": 0}

    for user in users:
        try:
            status = insert_user(
                client, user, contrato_ids,
                existing_cpfs, existing_codigomvs,
            )
            counts[status] += 1
            labels = {
                "inserido":           ("✔", "INSERIDO"),
                "cpf_duplicado":      ("⚠", "IGNORADO (CPF já existe)"),
                "codigomv_duplicado": ("⚠", "IGNORADO (código MV já em uso por outro usuário)"),
            }
            icon, label = labels[status]
            print(f"  {icon} [{label}] {user['nome']} — CPF {user['cpf']} — MV {user['codigo_mv']}")
        except Exception as e:
            counts["erro"] += 1
            print(f"  ✘ [ERRO] {user['nome']} — CPF {user['cpf']}: {e}")

    print()
    print("=" * 60)
    print("Resumo:")
    print(f"  Inseridos:                    {counts['inserido']}")
    print(f"  CPF já existia (ignorados):   {counts['cpf_duplicado']}")
    print(f"  Código MV em uso (ignorados): {counts['codigomv_duplicado']}")
    print(f"  Erros:                        {counts['erro']}")
    print("=" * 60)
    if DRY_RUN:
        print("\n⚠  Dry-run concluído. Nenhum dado foi gravado.")
    else:
        print("\nConcluído.")


if __name__ == "__main__":
    main()
