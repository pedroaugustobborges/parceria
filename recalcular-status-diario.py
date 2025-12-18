#!/usr/bin/env python3
"""
Script Automático: Recalcular Status de Escalas
Executa diariamente às 14h para recalcular status das escalas do dia anterior

Data: 2025-12-15
"""

import os
import sys
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/recalcular-status.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

# Carregar variáveis de ambiente
load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    logger.error("❌ Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY são obrigatórias!")
    sys.exit(1)

# Conectar ao Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
logger.info(f"✅ Conectado ao Supabase: {SUPABASE_URL}")


def calcular_horas_escaladas(horario_entrada: str, horario_saida: str) -> float:
    """Calcula as horas estabelecidas na escala"""
    try:
        hora_e, min_e = map(int, horario_entrada.split(':'))
        hora_s, min_s = map(int, horario_saida.split(':'))

        minutos_entrada = hora_e * 60 + min_e
        minutos_saida = hora_s * 60 + min_s

        # Se horário de saída é menor, passou da meia-noite
        if minutos_saida >= minutos_entrada:
            duracao_minutos = minutos_saida - minutos_entrada
        else:
            duracao_minutos = 1440 - minutos_entrada + minutos_saida

        return duracao_minutos / 60
    except Exception as e:
        logger.error(f"Erro ao calcular horas escaladas: {e}")
        return 0


def calcular_horas_trabalhadas(cpf: str, data_escala: str, horario_entrada: str, horario_saida: str) -> float:
    """
    Calcula as horas trabalhadas por um médico baseado nos acessos
    Com fallback para acessos fora da janela de ±3h
    """
    try:
        # Normalizar a data para garantir que estamos buscando o dia correto
        data_obj = datetime.strptime(data_escala, "%Y-%m-%d")
        data_formatada = data_obj.strftime("%Y-%m-%d")

        # Verificar se a escala atravessa meia-noite
        hora_e, min_e = map(int, horario_entrada.split(':'))
        hora_s, min_s = map(int, horario_saida.split(':'))
        minutos_entrada = hora_e * 60 + min_e
        minutos_saida = hora_s * 60 + min_s
        atravessa_meia_noite = minutos_saida < minutos_entrada

        logger.info(f"  Buscando acessos para CPF {cpf} no dia {data_formatada}")

        # Buscar acessos
        if atravessa_meia_noite:
            # Buscar acessos de dois dias
            dia_seguinte = (data_obj + timedelta(days=1)).strftime("%Y-%m-%d")

            response1 = supabase.table("acessos").select("*").eq("cpf", cpf)\
                .gte("data_acesso", f"{data_formatada}T00:00:00")\
                .lte("data_acesso", f"{data_formatada}T23:59:59")\
                .order("data_acesso").execute()

            response2 = supabase.table("acessos").select("*").eq("cpf", cpf)\
                .gte("data_acesso", f"{dia_seguinte}T00:00:00")\
                .lte("data_acesso", f"{dia_seguinte}T23:59:59")\
                .order("data_acesso").execute()

            acessos = (response1.data or []) + (response2.data or [])
        else:
            # Buscar acessos de um único dia
            response = supabase.table("acessos").select("*").eq("cpf", cpf)\
                .gte("data_acesso", f"{data_formatada}T00:00:00")\
                .lte("data_acesso", f"{data_formatada}T23:59:59")\
                .order("data_acesso").execute()

            acessos = response.data or []

        if not acessos:
            logger.info(f"  ❌ Nenhum acesso encontrado para CPF {cpf}")
            return 0

        logger.info(f"  ✅ {len(acessos)} acessos encontrados")

        # Separar entradas e saídas
        entradas = [a for a in acessos if a['sentido'] == 'E']
        saidas = [a for a in acessos if a['sentido'] == 'S']

        if not entradas or not saidas:
            logger.info(f"  ❌ Não há pares completos de entrada/saída")
            return 0

        # Criar horários esperados
        horario_entrada_esperado = datetime.strptime(f"{data_formatada} {horario_entrada}", "%Y-%m-%d %H:%M")

        if atravessa_meia_noite:
            dia_seguinte = (data_obj + timedelta(days=1)).strftime("%Y-%m-%d")
            horario_saida_esperado = datetime.strptime(f"{dia_seguinte} {horario_saida}", "%Y-%m-%d %H:%M")
        else:
            horario_saida_esperado = datetime.strptime(f"{data_formatada} {horario_saida}", "%Y-%m-%d %H:%M")

        # Janela de tolerância: ±3 horas
        JANELA_TOLERANCIA = timedelta(hours=3)

        # Encontrar entrada mais próxima
        entrada_mais_proxima = None
        menor_diferenca_entrada = None

        for entrada in entradas:
            data_entrada = datetime.fromisoformat(entrada['data_acesso'].replace('Z', '+00:00'))
            diferenca = abs((data_entrada - horario_entrada_esperado).total_seconds())

            if diferenca <= JANELA_TOLERANCIA.total_seconds():
                if menor_diferenca_entrada is None or diferenca < menor_diferenca_entrada:
                    menor_diferenca_entrada = diferenca
                    entrada_mais_proxima = entrada

        # FALLBACK: Se não encontrou dentro da janela, usar primeira entrada
        if not entrada_mais_proxima:
            logger.info(f"  ⚠️  Nenhuma entrada dentro da janela de ±3h, usando primeira entrada do dia")
            entrada_mais_proxima = entradas[0]

        data_entrada_selecionada = datetime.fromisoformat(entrada_mais_proxima['data_acesso'].replace('Z', '+00:00'))

        # Encontrar saída mais próxima (após a entrada)
        saida_mais_proxima = None
        menor_diferenca_saida = None

        for saida in saidas:
            data_saida = datetime.fromisoformat(saida['data_acesso'].replace('Z', '+00:00'))

            # Saída deve ser após a entrada
            if data_saida <= data_entrada_selecionada:
                continue

            diferenca = abs((data_saida - horario_saida_esperado).total_seconds())

            if diferenca <= JANELA_TOLERANCIA.total_seconds():
                if menor_diferenca_saida is None or diferenca < menor_diferenca_saida:
                    menor_diferenca_saida = diferenca
                    saida_mais_proxima = saida

        # FALLBACK: Se não encontrou saída dentro da janela, usar última saída após entrada
        if not saida_mais_proxima:
            logger.info(f"  ⚠️  Nenhuma saída dentro da janela de ±3h, usando última saída do dia")
            saidas_apos_entrada = [s for s in saidas if datetime.fromisoformat(s['data_acesso'].replace('Z', '+00:00')) > data_entrada_selecionada]
            if saidas_apos_entrada:
                saida_mais_proxima = saidas_apos_entrada[-1]
            else:
                logger.info(f"  ❌ Nenhuma saída encontrada após a entrada")
                return 0

        data_saida_selecionada = datetime.fromisoformat(saida_mais_proxima['data_acesso'].replace('Z', '+00:00'))

        # Calcular horas trabalhadas
        diff = data_saida_selecionada - data_entrada_selecionada
        horas_trabalhadas = diff.total_seconds() / 3600

        logger.info(f"  🎯 Horas trabalhadas: {horas_trabalhadas:.2f}h ({data_entrada_selecionada.strftime('%H:%M')} - {data_saida_selecionada.strftime('%H:%M')})")

        return horas_trabalhadas

    except Exception as e:
        logger.error(f"Erro ao calcular horas trabalhadas: {e}")
        return 0


def analisar_escala(escala: dict) -> str:
    """Analisa uma escala e determina seu status automático"""
    try:
        data_escala = datetime.strptime(escala['data_inicio'], "%Y-%m-%d")
        hoje = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

        logger.info(f"\n📋 Analisando Escala ID: {escala['id']}")
        logger.info(f"   Data: {data_escala.strftime('%d/%m/%Y')}")
        logger.info(f"   Horário: {escala['horario_entrada']} - {escala['horario_saida']}")

        # Se a escala é futura, status deve ser "Programado"
        if data_escala > hoje:
            logger.info(f"   ⏭️  Escala futura. Status: Programado")
            return "Programado"

        # Se já foi aprovado ou reprovado manualmente, não alterar
        if escala['status'] in ['Aprovado', 'Reprovado']:
            logger.info(f"   🔒 Status já finalizado: {escala['status']}")
            return escala['status']

        # Calcular horas esperadas
        horas_esperadas = calcular_horas_escaladas(escala['horario_entrada'], escala['horario_saida'])
        logger.info(f"   ⏱️  Horas esperadas: {horas_esperadas:.2f}h")

        # Para cada médico escalado, verificar se cumpriu a carga horária
        medicos = escala['medicos']
        todos_cumpriram = True
        algum_nao_compareceu = False
        algum_trabalhou_parcial = False

        for medico in medicos:
            logger.info(f"\n   👨‍⚕️ Médico: {medico['nome']} (CPF: {medico['cpf']})")

            horas_trabalhadas = calcular_horas_trabalhadas(
                medico['cpf'],
                escala['data_inicio'],
                escala['horario_entrada'],
                escala['horario_saida']
            )

            logger.info(f"   📊 Comparação: {horas_trabalhadas:.2f}h trabalhadas vs {horas_esperadas:.2f}h esperadas")

            if horas_trabalhadas == 0:
                logger.info(f"   ❌ Médico não compareceu (0 horas)")
                algum_nao_compareceu = True
                todos_cumpriram = False
            elif horas_trabalhadas < horas_esperadas:
                logger.info(f"   ⚠️  Médico trabalhou parcialmente ({horas_trabalhadas:.2f}h < {horas_esperadas:.2f}h)")
                algum_trabalhou_parcial = True
                todos_cumpriram = False
            else:
                logger.info(f"   ✅ Médico cumpriu carga horária ({horas_trabalhadas:.2f}h >= {horas_esperadas:.2f}h)")

        # Determinar status
        if algum_nao_compareceu:
            status_final = "Atenção"
            logger.info(f"\n   🔴 Status final: ATENÇÃO (médico não compareceu)")
        elif algum_trabalhou_parcial:
            status_final = "Aprovação Parcial"
            logger.info(f"\n   🟡 Status final: APROVAÇÃO PARCIAL (trabalho parcial)")
        else:
            status_final = "Pré-Aprovado"
            logger.info(f"\n   ✅ Status final: PRÉ-APROVADO (todos cumpriram)")

        return status_final

    except Exception as e:
        logger.error(f"Erro ao analisar escala: {e}")
        return "Atenção"


def recalcular_status_ontem():
    """
    Recalcula o status de todas as escalas do dia anterior com status "Programado"
    """
    try:
        # Calcular data de ontem
        ontem = (datetime.now() - timedelta(days=1)).date()
        data_ontem = ontem.strftime("%Y-%m-%d")

        logger.info("="*80)
        logger.info(f"🤖 INICIANDO RECÁLCULO AUTOMÁTICO DE STATUS")
        logger.info(f"📅 Data alvo: {ontem.strftime('%d/%m/%Y')} (ontem)")
        logger.info(f"🕐 Executado em: {datetime.now().strftime('%d/%m/%Y às %H:%M:%S')}")
        logger.info("="*80)

        # Buscar escalas de ontem com status "Programado"
        response = supabase.table("escalas_medicas").select("*")\
            .eq("data_inicio", data_ontem)\
            .eq("status", "Programado")\
            .execute()

        escalas = response.data or []

        if not escalas:
            logger.info(f"\n✅ Nenhuma escala encontrada para recalcular em {ontem.strftime('%d/%m/%Y')}")
            logger.info("="*80)
            return {
                'success': True,
                'atualizadas': 0,
                'erros': 0,
                'data': data_ontem,
                'mensagem': 'Nenhuma escala para recalcular'
            }

        logger.info(f"\n📊 {len(escalas)} escala(s) encontrada(s) para recalcular")

        atualizadas = 0
        erros = 0

        # Analisar cada escala
        for escala in escalas:
            try:
                novo_status = analisar_escala(escala)

                # Atualizar apenas se o status mudou
                if novo_status != escala['status']:
                    update_response = supabase.table("escalas_medicas")\
                        .update({'status': novo_status})\
                        .eq('id', escala['id'])\
                        .execute()

                    if update_response.data:
                        logger.info(f"✅ Escala {escala['id'][:8]}... atualizada: {escala['status']} → {novo_status}")
                        atualizadas += 1
                    else:
                        logger.error(f"❌ Erro ao atualizar escala {escala['id']}")
                        erros += 1
                else:
                    logger.info(f"⏭️  Escala {escala['id'][:8]}... mantém status: {novo_status}")

            except Exception as e:
                logger.error(f"❌ Erro ao processar escala {escala.get('id', 'unknown')}: {e}")
                erros += 1

        logger.info("\n" + "="*80)
        logger.info(f"🎯 RESULTADO FINAL:")
        logger.info(f"   ✅ Escalas atualizadas: {atualizadas}")
        logger.info(f"   ❌ Erros encontrados: {erros}")
        logger.info(f"   📊 Total processado: {len(escalas)}")
        logger.info("="*80)

        return {
            'success': True,
            'atualizadas': atualizadas,
            'erros': erros,
            'data': data_ontem,
            'total': len(escalas),
            'mensagem': f'{atualizadas} escala(s) atualizada(s) com sucesso' + (f'. {erros} erro(s) encontrado(s)' if erros > 0 else '')
        }

    except Exception as e:
        logger.error(f"❌ Erro geral ao recalcular status: {e}")
        return {
            'success': False,
            'atualizadas': 0,
            'erros': 0,
            'mensagem': f'Erro ao recalcular status: {str(e)}'
        }


if __name__ == "__main__":
    try:
        resultado = recalcular_status_ontem()

        if resultado['success']:
            logger.info("\n✅ Script executado com sucesso!")
            sys.exit(0)
        else:
            logger.error("\n❌ Script executado com erros!")
            sys.exit(1)

    except Exception as e:
        logger.error(f"\n💥 Erro fatal: {e}")
        sys.exit(1)
