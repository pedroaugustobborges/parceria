#!/usr/bin/env python3
"""
Script: inserir_medicos_hmsa.py
Insere todos os médicos do arquivo 'medicos - HMSA.csv' na base de dados ParcerIA.

Configuração copiada de ALINE PLACA FERREIRA (CPF 50036131806):
  - tipo: terceiro
  - especialidade: ['Clínica Geral']
  - contrato: derivado do registro da ALINE no banco
  - nm_unidade (usuario_codigomv): derivado do contrato vinculado à ALINE

Uso:
  # No servidor (lê automaticamente de /opt/parceria/.env):
  python3 inserir_medicos_hmsa.py

  # Localmente (passe as variáveis de ambiente):
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python3 inserir_medicos_hmsa.py

  # Dry-run (mostra o que seria feito, sem inserir):
  DRY_RUN=1 python3 inserir_medicos_hmsa.py
"""

import csv
import os
import sys
import uuid
import json
import requests
from pathlib import Path


# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

ALINE_CPF = "50036131806"  # CPF de referência para buscar contrato/unidade
CSV_FILE = Path(__file__).parent / "medicos - HMSA.csv"
DOTENV_PATH = Path("/opt/parceria/.env")
DRY_RUN = os.getenv("DRY_RUN", "0") == "1"


def load_env_file(path: Path) -> dict:
    """Lê pares KEY=VALUE de um arquivo .env sem dependências externas."""
    env = {}
    if not path.exists():
        return env
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip().strip('"').strip("'")
        env[key.strip()] = value
    return env


def get_credentials() -> tuple[str, str]:
    """Obtém SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do ambiente ou do .env."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        env = load_env_file(DOTENV_PATH)
        url = url or env.get("VITE_SUPABASE_URL")
        key = key or env.get("VITE_SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("ERRO: Não foi possível encontrar SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.")
        print(f"  - Defina as variáveis de ambiente, ou")
        print(f"  - Garanta que o arquivo {DOTENV_PATH} existe com VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY.")
        sys.exit(1)

    return url.rstrip("/"), key


# ---------------------------------------------------------------------------
# Cliente PostgREST simples
# ---------------------------------------------------------------------------

class SupabaseClient:
    def __init__(self, url: str, service_key: str):
        self.base = f"{url}/rest/v1"
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def select(self, table: str, params: dict | None = None) -> list:
        r = requests.get(f"{self.base}/{table}", headers=self.headers, params=params or {})
        r.raise_for_status()
        return r.json()

    def insert(self, table: str, data: dict | list) -> list:
        r = requests.post(f"{self.base}/{table}", headers=self.headers, json=data)
        if r.status_code not in (200, 201):
            raise RuntimeError(f"Erro ao inserir em {table}: {r.status_code} {r.text}")
        return r.json()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def pad_cpf(cpf: str) -> str:
    """Garante exatamente 11 dígitos numéricos com zeros à esquerda."""
    digits = "".join(c for c in cpf if c.isdigit())
    return digits.zfill(11)


def load_csv(path: Path) -> list[dict]:
    """Lê o CSV e retorna lista de dicts com keys: codigo_mv, cpf, nome."""
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            rows.append({
                "codigo_mv": row["codigo_mv"].strip(),
                "cpf": pad_cpf(row["cpf"].strip()),
                "nome": row["nome"].strip(),
            })
    return rows


def deduplicate(rows: list[dict]) -> list[dict]:
    """
    Remove linhas duplicadas por CPF, mantendo a primeira ocorrência.
    Para o mesmo CPF com código_mv diferente, isso não acontece no CSV atual
    (cada CPF aparece no máximo 2x com o mesmo codigo_mv), mas mesmo assim
    garantimos unicidade por CPF para a tabela usuarios.
    """
    seen_cpfs: set[str] = set()
    unique: list[dict] = []
    for row in rows:
        if row["cpf"] not in seen_cpfs:
            seen_cpfs.add(row["cpf"])
            unique.append(row)
    return unique


# ---------------------------------------------------------------------------
# Lógica principal
# ---------------------------------------------------------------------------

def get_aline_context(client: SupabaseClient) -> tuple[str, str]:
    """
    Busca o contrato e a unidade hospitalar vinculados à ALINE PLACA FERREIRA.
    Retorna (contrato_id, nm_unidade).
    """
    # 1. Encontrar o registro da ALINE em usuarios
    users = client.select("usuarios", {"cpf": f"eq.{ALINE_CPF}", "select": "id,cpf,nome,contrato_id"})
    if not users:
        print(f"ERRO: Usuária ALINE PLACA FERREIRA (CPF {ALINE_CPF}) não encontrada em usuarios.")
        sys.exit(1)
    aline = users[0]
    print(f"✔ Referência encontrada: {aline['nome']} (id={aline['id']})")

    # 2. Pegar contrato via usuario_contrato (preferencial) ou fallback para usuarios.contrato_id
    uc_rows = client.select(
        "usuario_contrato",
        {"usuario_id": f"eq.{aline['id']}", "select": "contrato_id"},
    )
    if uc_rows:
        contrato_id = uc_rows[0]["contrato_id"]
        print(f"  contrato_id (via usuario_contrato): {contrato_id}")
    elif aline.get("contrato_id"):
        contrato_id = aline["contrato_id"]
        print(f"  contrato_id (via usuarios.contrato_id legado): {contrato_id}")
    else:
        print("ERRO: ALINE não possui nenhum contrato vinculado.")
        sys.exit(1)

    # 3. Buscar o código da unidade hospitalar do contrato
    contratos = client.select(
        "contratos",
        {"id": f"eq.{contrato_id}", "select": "id,nome,empresa,unidade_hospitalar_id"},
    )
    if not contratos:
        print(f"ERRO: Contrato {contrato_id} não encontrado.")
        sys.exit(1)
    contrato = contratos[0]
    print(f"  Contrato: {contrato['nome']} — {contrato['empresa']}")

    if not contrato.get("unidade_hospitalar_id"):
        print("AVISO: Contrato não possui unidade_hospitalar_id. nm_unidade será vazio.")
        nm_unidade = ""
    else:
        unidades = client.select(
            "unidades_hospitalares",
            {"id": f"eq.{contrato['unidade_hospitalar_id']}", "select": "id,codigo,nome"},
        )
        if not unidades:
            print(f"AVISO: Unidade hospitalar {contrato['unidade_hospitalar_id']} não encontrada.")
            nm_unidade = ""
        else:
            nm_unidade = unidades[0]["codigo"]
            print(f"  Unidade hospitalar: {unidades[0]['nome']} (código='{nm_unidade}')")

    return contrato_id, nm_unidade


def get_existing_cpfs(client: SupabaseClient) -> set[str]:
    """Retorna conjunto de CPFs já cadastrados em usuarios (paginando)."""
    existing: set[str] = set()
    page_size = 1000
    page = 0
    while True:
        rows = client.select(
            "usuarios",
            {
                "select": "cpf",
                "limit": str(page_size),
                "offset": str(page * page_size),
            },
        )
        if not rows:
            break
        for r in rows:
            existing.add(r["cpf"])
        if len(rows) < page_size:
            break
        page += 1
    return existing


def get_existing_codigomvs(client: SupabaseClient) -> set[tuple[str, str]]:
    """Retorna conjunto de (codigomv, nm_unidade) já cadastrados em usuario_codigomv."""
    rows = client.select("usuario_codigomv", {"select": "codigomv,nm_unidade"})
    return {(r["codigomv"], r["nm_unidade"]) for r in rows}


def insert_doctor(
    client: SupabaseClient,
    doctor: dict,
    contrato_id: str,
    nm_unidade: str,
    existing_cpfs: set[str],
    existing_codigomvs: set[tuple[str, str]],
) -> str:
    """
    Insere um médico nas três tabelas: usuarios, usuario_contrato, usuario_codigomv.
    Retorna o status: 'inserido', 'cpf_duplicado', 'codigomv_duplicado_para_outro_usuario'.
    """
    cpf = doctor["cpf"]
    nome = doctor["nome"]
    codigo_mv = doctor["codigo_mv"]
    especialidade = ["Clínica Geral"]

    # Verificar CPF duplicado
    if cpf in existing_cpfs:
        return "cpf_duplicado"

    # Verificar se codigomv+nm_unidade já existe para outro usuário
    if (codigo_mv, nm_unidade) in existing_codigomvs:
        return "codigomv_duplicado_para_outro_usuario"

    new_id = str(uuid.uuid4())

    if DRY_RUN:
        print(f"    [DRY-RUN] INSERT usuarios: id={new_id}, cpf={cpf}, nome={nome}, codigomv={codigo_mv}")
        print(f"    [DRY-RUN] INSERT usuario_contrato: usuario_id={new_id}, contrato_id={contrato_id}")
        print(f"    [DRY-RUN] INSERT usuario_codigomv: usuario_id={new_id}, codigomv={codigo_mv}, nm_unidade={nm_unidade}")
        existing_cpfs.add(cpf)
        existing_codigomvs.add((codigo_mv, nm_unidade))
        return "inserido"

    # 1. Inserir em usuarios
    client.insert("usuarios", {
        "id": new_id,
        "email": None,
        "nome": nome,
        "cpf": cpf,
        "tipo": "terceiro",
        "codigomv": codigo_mv,          # campo legado (mantido para retrocompatibilidade)
        "especialidade": especialidade,
        "unidade_hospitalar_id": None,   # terceiro não tem unidade própria
        "contrato_id": contrato_id,      # campo legado (primeiro contrato)
    })

    # 2. Inserir em usuario_contrato
    client.insert("usuario_contrato", {
        "usuario_id": new_id,
        "contrato_id": contrato_id,
        "cpf": cpf,
    })

    # 3. Inserir em usuario_codigomv
    client.insert("usuario_codigomv", {
        "usuario_id": new_id,
        "codigomv": codigo_mv,
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

    # Credenciais
    url, key = get_credentials()
    client = SupabaseClient(url, key)
    print(f"Conectado a: {url}\n")

    # CSV
    if not CSV_FILE.exists():
        print(f"ERRO: Arquivo não encontrado: {CSV_FILE}")
        sys.exit(1)
    all_rows = load_csv(CSV_FILE)
    doctors = deduplicate(all_rows)
    print(f"CSV lido: {len(all_rows)} linhas → {len(doctors)} médicos únicos por CPF\n")

    # Contexto a partir da ALINE
    print("Buscando contexto de ALINE PLACA FERREIRA...")
    contrato_id, nm_unidade = get_aline_context(client)
    print()

    # Pré-carregar existentes
    print("Verificando registros existentes no banco...")
    existing_cpfs = get_existing_cpfs(client)
    existing_codigomvs = get_existing_codigomvs(client)
    print(f"  CPFs cadastrados: {len(existing_cpfs)}")
    print(f"  Pares (codigomv, nm_unidade) cadastrados: {len(existing_codigomvs)}\n")

    # Processar cada médico
    counts = {"inserido": 0, "cpf_duplicado": 0, "codigomv_duplicado_para_outro_usuario": 0, "erro": 0}
    for doctor in doctors:
        try:
            status = insert_doctor(
                client, doctor, contrato_id, nm_unidade, existing_cpfs, existing_codigomvs
            )
            counts[status] += 1
            icon = "✔" if status == "inserido" else "⚠"
            label = {
                "inserido": "INSERIDO",
                "cpf_duplicado": "IGNORADO (CPF já existe)",
                "codigomv_duplicado_para_outro_usuario": "IGNORADO (código MV já em uso por outro usuário)",
            }[status]
            print(f"  {icon} [{label}] {doctor['nome']} — CPF {doctor['cpf']} — MV {doctor['codigo_mv']}")
        except Exception as e:
            counts["erro"] += 1
            print(f"  ✘ [ERRO] {doctor['nome']} — CPF {doctor['cpf']}: {e}")

    # Resumo
    print()
    print("=" * 60)
    print("Resumo:")
    print(f"  Inseridos:                        {counts['inserido']}")
    print(f"  CPF já existia (ignorados):       {counts['cpf_duplicado']}")
    print(f"  Código MV em uso (ignorados):     {counts['codigomv_duplicado_para_outro_usuario']}")
    print(f"  Erros:                            {counts['erro']}")
    print("=" * 60)
    if DRY_RUN:
        print("\n⚠  Dry-run concluído. Nenhum dado foi gravado.")
    else:
        print("\nConcluído.")


if __name__ == "__main__":
    main()
