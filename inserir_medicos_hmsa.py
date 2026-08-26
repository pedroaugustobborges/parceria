#!/usr/bin/env python3
"""
Script: inserir_medicos_hmsa.py
Insere todos os médicos do arquivo 'medicos - HMSA.csv' na base de dados ParcerIA.

Conecta via Kong (localhost:8000) — API interna do Supabase self-hosted,
evitando o problema de roteamento VPC onde o servidor não alcança seu próprio
domínio público (https://parceria.daherlab.org.br).

Configuração copiada de ALINE PLACA FERREIRA (CPF 50036131806):
  - tipo: terceiro
  - especialidade: ['Clínica Geral']
  - contrato e nm_unidade: derivados do registro da ALINE no banco

Uso:
  DRY_RUN=1 python3 /opt/parceria/inserir_medicos_hmsa.py   # simulação
  python3 /opt/parceria/inserir_medicos_hmsa.py              # execução real
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

ALINE_CPF    = "50036131806"
CSV_FILE     = Path(__file__).parent / "medicos - HMSA.csv"
DOTENV_PATH  = Path("/opt/parceria/.env")
DRY_RUN      = os.getenv("DRY_RUN", "0") == "1"

# URL interna do Kong (acessível apenas dentro do servidor)
INTERNAL_URL = "http://localhost:8000"


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
# Lógica principal
# ---------------------------------------------------------------------------

def get_aline_context(client: SupabaseClient) -> tuple[str, str]:
    """Retorna (contrato_id, nm_unidade) derivados do registro da ALINE."""

    users = client.select("usuarios", {"cpf": f"eq.{ALINE_CPF}", "select": "id,nome,contrato_id"})
    if not users:
        print(f"ERRO: ALINE PLACA FERREIRA (CPF {ALINE_CPF}) não encontrada.")
        sys.exit(1)
    aline = users[0]
    print(f"✔ Referência encontrada: {aline['nome']} (id={aline['id']})")

    # Contrato via usuario_contrato (preferencial)
    uc = client.select("usuario_contrato", {"usuario_id": f"eq.{aline['id']}", "select": "contrato_id"})
    if uc:
        contrato_id = uc[0]["contrato_id"]
        print(f"  contrato_id (via usuario_contrato): {contrato_id}")
    elif aline.get("contrato_id"):
        contrato_id = aline["contrato_id"]
        print(f"  contrato_id (via usuarios.contrato_id legado): {contrato_id}")
    else:
        print("ERRO: ALINE não possui contrato vinculado.")
        sys.exit(1)

    # Detalhes do contrato
    contratos = client.select(
        "contratos",
        {"id": f"eq.{contrato_id}", "select": "id,nome,empresa,unidade_hospitalar_id"},
    )
    if not contratos:
        print(f"ERRO: Contrato {contrato_id} não encontrado.")
        sys.exit(1)
    contrato = contratos[0]
    print(f"  Contrato: {contrato['nome']} — {contrato['empresa']}")

    # nm_unidade = codigo da unidade hospitalar
    if not contrato.get("unidade_hospitalar_id"):
        print("AVISO: Contrato sem unidade_hospitalar_id. nm_unidade será vazio.")
        nm_unidade = ""
    else:
        uhs = client.select(
            "unidades_hospitalares",
            {"id": f"eq.{contrato['unidade_hospitalar_id']}", "select": "codigo,nome"},
        )
        if not uhs:
            print("AVISO: Unidade hospitalar não encontrada. nm_unidade será vazio.")
            nm_unidade = ""
        else:
            nm_unidade = uhs[0]["codigo"]
            print(f"  Unidade hospitalar: {uhs[0]['nome']} (código='{nm_unidade}')")

    return contrato_id, nm_unidade


def insert_doctor(
    client: SupabaseClient,
    doctor: dict,
    contrato_id: str,
    nm_unidade: str,
    existing_cpfs: set,
    existing_codigomvs: set,
) -> str:
    cpf, nome, codigo_mv = doctor["cpf"], doctor["nome"], doctor["codigo_mv"]

    if cpf in existing_cpfs:
        return "cpf_duplicado"
    if (codigo_mv, nm_unidade) in existing_codigomvs:
        return "codigomv_duplicado"

    new_id = str(uuid.uuid4())

    if DRY_RUN:
        print(f"    [DRY-RUN] usuarios:         id={new_id}, cpf={cpf}, nome={nome}, codigomv={codigo_mv}")
        print(f"    [DRY-RUN] usuario_contrato: contrato_id={contrato_id}")
        print(f"    [DRY-RUN] usuario_codigomv: codigomv={codigo_mv}, nm_unidade={nm_unidade}")
        existing_cpfs.add(cpf)
        existing_codigomvs.add((codigo_mv, nm_unidade))
        return "inserido"

    # 1. usuarios
    client.insert("usuarios", {
        "id":                  new_id,
        "email":               None,
        "nome":                nome,
        "cpf":                 cpf,
        "tipo":                "terceiro",
        "codigomv":            codigo_mv,        # campo legado (retrocompatibilidade)
        "especialidade":       ["Clínica Geral"],
        "unidade_hospitalar_id": None,
        "contrato_id":         contrato_id,      # campo legado (primeiro contrato)
    })

    # 2. usuario_contrato
    client.insert("usuario_contrato", {
        "usuario_id":  new_id,
        "contrato_id": contrato_id,
        "cpf":         cpf,
    })

    # 3. usuario_codigomv
    client.insert("usuario_codigomv", {
        "usuario_id": new_id,
        "codigomv":   codigo_mv,
        "nm_unidade": nm_unidade,
    })

    existing_cpfs.add(cpf)
    existing_codigomvs.add((codigo_mv, nm_unidade))
    return "inserido"


def main():
    print("=" * 60)
    print("ParcerIA — Inserção de médicos HMSA")
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
    doctors  = deduplicate(all_rows)
    print(f"CSV lido: {len(all_rows)} linhas → {len(doctors)} médicos únicos por CPF\n")

    print("Buscando contexto de ALINE PLACA FERREIRA...")
    contrato_id, nm_unidade = get_aline_context(client)
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

    for doctor in doctors:
        try:
            status = insert_doctor(
                client, doctor, contrato_id, nm_unidade,
                existing_cpfs, existing_codigomvs,
            )
            counts[status] += 1
            labels = {
                "inserido":           ("✔", "INSERIDO"),
                "cpf_duplicado":      ("⚠", "IGNORADO (CPF já existe)"),
                "codigomv_duplicado": ("⚠", "IGNORADO (código MV já em uso por outro usuário)"),
            }
            icon, label = labels[status]
            print(f"  {icon} [{label}] {doctor['nome']} — CPF {doctor['cpf']} — MV {doctor['codigo_mv']}")
        except Exception as e:
            counts["erro"] += 1
            print(f"  ✘ [ERRO] {doctor['nome']} — CPF {doctor['cpf']}: {e}")

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
