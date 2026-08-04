#!/usr/bin/env python3
"""
Script Automático: Verificar Presença nas Escalas via Acessos
Executa diariamente às 13h (Horário de Brasília / UTC-3 = 16h UTC).

Lógica:
  - Busca todas as escalas com status="Programado" de datas anteriores até hoje
  - Para cada escala, obtém a unidade hospitalar via contrato → unidades_hospitalares
  - Para cada médico na escala, verifica seus acessos na coluna "planta" da tabela "acessos"
  - Janela de busca: 2h antes do horário de entrada até 2h após o horário de saída
  - Plantão noturno: horario_saida <= horario_entrada → saída é no dia seguinte
  - Duração calculada: último acesso - primeiro acesso dentro da janela
  - Resultados por escala:
      * "Pré-Aprovado"   → todos os médicos cumpriram (dentro da tolerância de 1h)
      * "Aprovado Parcial" → algum médico ficou mais de 1h abaixo do esperado
      * "Atenção"        → algum médico sem nenhum acesso na unidade no período

Cron (servidor em UTC):
  0 16 * * * /usr/bin/python3 /caminho/para/verificar-presenca-escalas.py

Cron (servidor em BRT):
  0 13 * * * /usr/bin/python3 /caminho/para/verificar-presenca-escalas.py
"""

import os
import sys
from datetime import datetime, timedelta, date
from typing import Optional
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

# ── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'verificar-presenca-escalas.log')),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# ── Supabase ─────────────────────────────────────────────────────────────────

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    logger.error("❌ Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY são obrigatórias!")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
logger.info(f"✅ Conectado ao Supabase: {SUPABASE_URL}")

# ── Helpers de horário ────────────────────────────────────────────────────────

def parse_hhmm(horario: str) -> tuple[int, int]:
    """Extrai (hora, minuto) de uma string 'HH:MM' ou 'HH:MM:SS'."""
    partes = horario.split(':')
    return int(partes[0]), int(partes[1])


def is_overnight(horario_entrada: str, horario_saida: str) -> bool:
    """
    Retorna True se o turno atravessa a meia-noite.
    Regra: horario_saida <= horario_entrada (em minutos).
    """
    h_e, m_e = parse_hhmm(horario_entrada)
    h_s, m_s = parse_hhmm(horario_saida)
    return (h_s * 60 + m_s) <= (h_e * 60 + m_e)


def calcular_duracao_horas(horario_entrada: str, horario_saida: str) -> float:
    """Duração total da escala em horas (suporta plantão noturno)."""
    h_e, m_e = parse_hhmm(horario_entrada)
    h_s, m_s = parse_hhmm(horario_saida)
    minutos_e = h_e * 60 + m_e
    minutos_s = h_s * 60 + m_s

    if minutos_s <= minutos_e:
        # Noturno: saída no dia seguinte
        duracao_min = (1440 - minutos_e) + minutos_s
    else:
        duracao_min = minutos_s - minutos_e

    return duracao_min / 60.0


BRT_TO_UTC = timedelta(hours=3)  # acessos.data_acesso é armazenado em UTC real; escalas usam BRT


def calcular_janela_busca(data_inicio_str: str, horario_entrada: str, horario_saida: str) -> tuple[str, str]:
    """
    Janela de busca de acessos: 2h antes da entrada até 2h após a saída.
    Para plantões noturnos a saída é no dia seguinte.

    Os horários da escala estão em BRT (UTC-3).
    Os acessos são armazenados em UTC real (confirmado pelos offsets +00:00).
    Portanto, convertemos a janela para UTC somando +3h antes de enviar a query.

    Retorna (window_start, window_end) em formato "YYYY-MM-DDTHH:MM:SS" (UTC).
    """
    data = datetime.strptime(data_inicio_str, "%Y-%m-%d")
    h_e, m_e = parse_hhmm(horario_entrada)
    h_s, m_s = parse_hhmm(horario_saida)

    entrada_brt = data.replace(hour=h_e, minute=m_e, second=0, microsecond=0)

    if is_overnight(horario_entrada, horario_saida):
        dia_seguinte = data + timedelta(days=1)
        saida_brt = dia_seguinte.replace(hour=h_s, minute=m_s, second=0, microsecond=0)
    else:
        saida_brt = data.replace(hour=h_s, minute=m_s, second=0, microsecond=0)

    window_start = ((entrada_brt - timedelta(hours=2)) + BRT_TO_UTC).strftime("%Y-%m-%dT%H:%M:%S")
    window_end   = ((saida_brt   + timedelta(hours=2)) + BRT_TO_UTC).strftime("%Y-%m-%dT%H:%M:%S")

    return window_start, window_end


# ── Caches (evita queries repetidas ao Supabase) ──────────────────────────────

_cache_contratos: dict[str, Optional[str]] = {}   # contrato_id → unidade_id
_cache_unidades:  dict[str, Optional[str]] = {}   # unidade_id  → codigo


def obter_codigo_unidade(contrato_id: str) -> Optional[str]:
    """Resolve contrato_id → codigo da unidade hospitalar."""
    # 1. Resolver contrato → unidade_id
    if contrato_id not in _cache_contratos:
        try:
            resp = supabase.table("contratos") \
                .select("unidade_hospitalar_id") \
                .eq("id", contrato_id) \
                .single() \
                .execute()
            _cache_contratos[contrato_id] = (resp.data or {}).get('unidade_hospitalar_id')
        except Exception as e:
            logger.error(f"Erro ao buscar contrato {contrato_id}: {e}")
            _cache_contratos[contrato_id] = None

    unidade_id = _cache_contratos[contrato_id]
    if not unidade_id:
        return None

    # 2. Resolver unidade_id → codigo
    if unidade_id not in _cache_unidades:
        try:
            resp = supabase.table("unidades_hospitalares") \
                .select("codigo") \
                .eq("id", unidade_id) \
                .single() \
                .execute()
            _cache_unidades[unidade_id] = (resp.data or {}).get('codigo')
        except Exception as e:
            logger.error(f"Erro ao buscar unidade {unidade_id}: {e}")
            _cache_unidades[unidade_id] = None

    return _cache_unidades.get(unidade_id)


# ── Análise de presença ───────────────────────────────────────────────────────

def buscar_acessos(cpf: str, planta: str, window_start: str, window_end: str) -> list:
    """Retorna todos os acessos de um médico em uma unidade dentro da janela."""
    try:
        resp = supabase.table("acessos") \
            .select("data_acesso, sentido") \
            .eq("cpf", cpf) \
            .eq("planta", planta) \
            .gte("data_acesso", window_start) \
            .lte("data_acesso", window_end) \
            .order("data_acesso") \
            .execute()
        return resp.data or []
    except Exception as e:
        logger.error(f"Erro ao buscar acessos (CPF={cpf}, planta={planta}): {e}")
        return []


def calcular_tempo_presenca(acessos: list) -> float:
    """
    Calcula o tempo de presença em horas: último acesso - primeiro acesso.
    Retorna 0.0 se houver menos de 2 registros de acesso.
    """
    timestamps = []
    for a in acessos:
        try:
            ts_str = a['data_acesso'].replace('Z', '+00:00')
            timestamps.append(datetime.fromisoformat(ts_str))
        except Exception:
            continue

    if len(timestamps) < 2:
        return 0.0

    return (max(timestamps) - min(timestamps)).total_seconds() / 3600.0


def avaliar_medico(cpf: str, nome: str, planta: str,
                   duracao_escala: float, window_start: str, window_end: str) -> str:
    """
    Avalia a presença de um médico e retorna:
      "presente_total"   → cumpriu com até 1h de tolerância
      "presente_parcial" → faltou mais de 1h
      "ausente"          → nenhum acesso encontrado
    """
    acessos = buscar_acessos(cpf, planta, window_start, window_end)

    if not acessos:
        logger.info(f"      ❌ {nome} ({cpf}): nenhum acesso em '{planta}' na janela")
        return "ausente"

    horas = calcular_tempo_presenca(acessos)
    tolerancia = duracao_escala - 1.0

    logger.info(
        f"      📊 {nome} ({cpf}): {len(acessos)} acesso(s) | "
        f"{horas:.2f}h registradas de {duracao_escala:.2f}h esperadas"
    )

    if horas >= tolerancia:
        logger.info(f"      ✅ Aprovado ({horas:.2f}h ≥ {tolerancia:.2f}h)")
        return "presente_total"
    else:
        logger.info(f"      ⚠️  Parcial ({horas:.2f}h < {tolerancia:.2f}h)")
        return "presente_parcial"


# ── Processamento de escala ───────────────────────────────────────────────────

def analisar_escala(escala: dict) -> Optional[str]:
    """
    Analisa uma única escala e retorna o novo status ou None se não for possível analisar.
    """
    escala_id     = escala['id']
    data_inicio   = escala['data_inicio']        # "YYYY-MM-DD"
    hora_entrada  = escala['horario_entrada']    # "HH:MM" ou "HH:MM:SS"
    hora_saida    = escala['horario_saida']
    contrato_id   = escala['contrato_id']
    medicos       = escala.get('medicos') or []

    logger.info(
        f"\n  📋 Escala {escala_id[:8]}… | "
        f"{data_inicio} | {hora_entrada[:5]}–{hora_saida[:5]}"
    )

    if not medicos:
        logger.info(f"     ⚠️  Sem médicos cadastrados — ignorando")
        return None

    # Resolver unidade hospitalar
    planta = obter_codigo_unidade(contrato_id)
    if not planta:
        logger.warning(f"     ⚠️  Unidade não encontrada para contrato {contrato_id} — ignorando")
        return None

    overnight      = is_overnight(hora_entrada, hora_saida)
    duracao_escala = calcular_duracao_horas(hora_entrada, hora_saida)
    window_start, window_end = calcular_janela_busca(data_inicio, hora_entrada, hora_saida)

    logger.info(
        f"     🏥 Unidade: {planta} | "
        f"{'Noturno' if overnight else 'Diurno'} | "
        f"{duracao_escala:.2f}h"
    )
    logger.info(f"     🔍 Janela: {window_start} → {window_end}")

    algum_ausente = False
    algum_parcial = False

    for medico in medicos:
        cpf  = (medico.get('cpf') or '').strip()
        nome = (medico.get('nome') or 'Desconhecido').strip()

        if not cpf:
            logger.info(f"     ⚠️  Médico '{nome}' sem CPF — ignorando")
            continue

        resultado = avaliar_medico(cpf, nome, planta, duracao_escala, window_start, window_end)

        if resultado == "ausente":
            algum_ausente = True
        elif resultado == "presente_parcial":
            algum_parcial = True

    # Status final da escala
    if algum_ausente:
        novo_status = "Atenção"
        logger.info(f"     🔴 Resultado: ATENÇÃO (médico(s) sem acesso)")
    elif algum_parcial:
        novo_status = "Aprovação Parcial"
        logger.info(f"     🟡 Resultado: APROVAÇÃO PARCIAL (carga incompleta)")
    else:
        novo_status = "Pré-Aprovado"
        logger.info(f"     🟢 Resultado: PRÉ-APROVADO")

    return novo_status


# ── Entrada principal ─────────────────────────────────────────────────────────

def executar():
    hoje     = date.today()
    hoje_str = hoje.strftime("%Y-%m-%d")

    logger.info("=" * 80)
    logger.info("🤖  VERIFICAÇÃO AUTOMÁTICA DE PRESENÇA NAS ESCALAS")
    logger.info(f"📅  Escalas até: {hoje.strftime('%d/%m/%Y')}")
    logger.info(f"🕐  Execução:    {datetime.now().strftime('%d/%m/%Y às %H:%M:%S')}")
    logger.info("=" * 80)

    # Buscar todas as escalas "Programado" de dias passados até hoje
    try:
        resp = supabase.table("escalas_medicas") \
            .select("id, contrato_id, data_inicio, horario_entrada, horario_saida, medicos, status") \
            .eq("status", "Programado") \
            .eq("ativo", True) \
            .lt("data_inicio", hoje_str) \
            .execute()
        escalas = resp.data or []
    except Exception as e:
        logger.error(f"❌ Erro ao buscar escalas: {e}")
        sys.exit(1)

    if not escalas:
        logger.info(f"\n✅ Nenhuma escala 'Programado' pendente até {hoje.strftime('%d/%m/%Y')}.")
        return

    logger.info(f"\n📊 {len(escalas)} escala(s) para analisar\n")

    atualizadas  = 0
    sem_dados    = 0
    erros        = 0

    for escala in escalas:
        try:
            novo_status = analisar_escala(escala)

            if novo_status is None:
                sem_dados += 1
                continue

            if novo_status != escala['status']:
                upd = supabase.table("escalas_medicas") \
                    .update({'status': novo_status}) \
                    .eq('id', escala['id']) \
                    .execute()

                if upd.data:
                    logger.info(
                        f"     ✅ Atualizada: "
                        f"{escala['status']} → {novo_status}"
                    )
                    atualizadas += 1
                else:
                    logger.error(f"     ❌ Falha ao gravar status para escala {escala['id']}")
                    erros += 1
            else:
                logger.info(f"     ⏭️  Status mantido: {novo_status}")

        except Exception as e:
            logger.error(f"❌ Erro inesperado na escala {escala.get('id', '?')}: {e}")
            erros += 1

    logger.info("\n" + "=" * 80)
    logger.info("🎯  RESULTADO FINAL")
    logger.info(f"    ✅  Escalas atualizadas : {atualizadas}")
    logger.info(f"    ⚠️   Sem dados suficientes: {sem_dados}")
    logger.info(f"    ❌  Erros               : {erros}")
    logger.info(f"    📊  Total analisado     : {len(escalas)}")
    logger.info("=" * 80)


if __name__ == "__main__":
    try:
        executar()
        sys.exit(0)
    except Exception as e:
        logger.error(f"\n💥 Erro fatal: {e}")
        sys.exit(1)
