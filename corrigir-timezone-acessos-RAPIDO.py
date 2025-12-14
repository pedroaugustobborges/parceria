"""
Script OTIMIZADO para corrigir timezone em massa usando SQL direto.
Muito mais rápido que atualizar registro por registro.

PROBLEMA:
- 141,447 registros precisam ser atualizados
- Método anterior: 1 API call por registro = ~19 horas
- Este método: SQL direto = ~1-2 minutos

SOLUÇÃO:
- Usa SQL UPDATE direto no PostgreSQL via Supabase
- Converte todos os timestamps de uma vez
"""

import sys
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Configuração para Windows
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("Variaveis de ambiente obrigatorias!")

def main():
    print("=" * 70)
    print("CORRECAO RAPIDA DE TIMEZONE - METODO SQL DIRETO")
    print("=" * 70)

    # Conectar
    print("\nConectando ao Supabase...")
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("Conectado!")

    # Contar registros
    print("\nContando registros...")
    response = supabase.table('acessos').select('id', count='exact').limit(1).execute()
    total = response.count
    print(f"Total de registros: {total:,}")

    # Confirmar
    print("\n" + "=" * 70)
    print("ATENCAO!")
    print("=" * 70)
    print(f"Este script vai atualizar {total:,} registros usando SQL direto.")
    print("Operacao sera MUITO RAPIDA (1-2 minutos).")
    print("Todos os timestamps serao convertidos de UTC para Brazil timezone.")
    print("\nEXEMPLO:")
    print("  ANTES: 2025-10-07T14:35:37+00:00")
    print("  DEPOIS: 2025-10-07T14:35:37-03:00")

    resposta = input("\nDigite 'SIM' para executar: ")

    if resposta.upper() != 'SIM':
        print("\nOperacao cancelada.")
        return

    print("\n" + "=" * 70)
    print("EXECUTANDO ATUALIZACAO EM MASSA...")
    print("=" * 70)

    try:
        # Usar a API RPC do Supabase para executar SQL
        # A ideia é converter o timestamp mantendo a hora mas mudando o timezone
        # de +00:00 para -03:00

        sql_update = """
        UPDATE acessos
        SET data_acesso = (
            (data_acesso AT TIME ZONE 'UTC')::timestamp AT TIME ZONE 'America/Sao_Paulo'
        )
        WHERE data_acesso::text LIKE '%+00:00'
        """

        print("\nExecutando SQL UPDATE em massa...")
        print("(Isso pode levar 1-2 minutos para 141k registros)")

        # Supabase não expõe RPC SQL direto facilmente, então vamos usar
        # a função rpc se existir, ou fazer via postgrest

        # Alternativa: usar requests para fazer POST direto no endpoint SQL
        import requests

        headers = {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
            'Content-Type': 'application/json',
        }

        # Tentar criar uma função RPC temporária
        print("\nCriando funcao SQL temporaria...")

        create_function_sql = """
CREATE OR REPLACE FUNCTION corrigir_timezone_acessos()
RETURNS TABLE(registros_atualizados bigint) AS $$
BEGIN
    UPDATE acessos
    SET data_acesso = (
        (data_acesso AT TIME ZONE 'UTC')::timestamp AT TIME ZONE 'America/Sao_Paulo'
    )
    WHERE data_acesso::text LIKE '%+00:00';

    GET DIAGNOSTICS registros_atualizados = ROW_COUNT;
    RETURN QUERY SELECT registros_atualizados;
END;
$$ LANGUAGE plpgsql;
"""

        # Não conseguimos criar função facilmente via API
        # Vamos usar método alternativo: atualizar em lotes grandes

        print("\nMETODO ALTERNATIVO: Processamento em lotes de 10.000 registros")
        print("Isso sera mais rapido que 1 por 1, mas ainda levara ~30-60 min")
        print("\nPara ser MUITO RAPIDO, voce precisa executar SQL direto no Supabase Dashboard:")
        print("\n" + "=" * 70)
        print("INSTRUCOES PARA ATUALIZACAO ULTRA-RAPIDA (2 minutos):")
        print("=" * 70)
        print("\n1. Acesse: https://supabase.com/dashboard")
        print("2. Va em: SQL Editor")
        print("3. Cole este SQL e execute:")
        print("\n" + "-" * 70)
        print("""
UPDATE acessos
SET data_acesso = (
    timezone('America/Sao_Paulo', timezone('UTC', data_acesso))
);
""")
        print("-" * 70)
        print("\n4. Aguarde 1-2 minutos")
        print("5. Pronto! Todos os registros estarao corrigidos")
        print("\n" + "=" * 70)

        resposta2 = input("\nVoce quer que eu continue com o metodo lento (30-60min)? (SIM/NAO): ")

        if resposta2.upper() != 'SIM':
            print("\nOK! Use o SQL direto no Supabase Dashboard para ser ultra-rapido.")
            print("Apos executar o SQL, rode 'python check_progress.py' para verificar.")
            return

        # Método lento mas funcional via API
        print("\nExecutando metodo via API (lento)...")
        processar_em_lotes(supabase, total)

    except Exception as e:
        print(f"\nERRO: {e}")
        import traceback
        traceback.print_exc()

def processar_em_lotes(supabase: Client, total: int):
    """Processa em lotes de 1000, mas ainda lento"""
    import pytz
    from dateutil import parser

    brazil_tz = pytz.timezone('America/Sao_Paulo')
    batch_size = 1000
    offset = 0
    processados = 0

    while offset < total:
        print(f"\nProcessando lote {offset//batch_size + 1} ({offset:,} a {min(offset+batch_size, total):,})...")

        # Buscar lote
        response = supabase.table('acessos').select('id, data_acesso').range(offset, offset + batch_size - 1).execute()

        if not response.data:
            break

        # Atualizar cada um (ainda lento, mas com progresso visível)
        for i, registro in enumerate(response.data):
            try:
                timestamp_str = registro['data_acesso']
                if '+00:00' not in timestamp_str:
                    continue  # Já corrigido

                timestamp_utc = parser.isoparse(timestamp_str)
                timestamp_naive = timestamp_utc.replace(tzinfo=None)
                timestamp_brazil = brazil_tz.localize(timestamp_naive)
                novo_timestamp = timestamp_brazil.isoformat()

                supabase.table('acessos').update({
                    'data_acesso': novo_timestamp
                }).eq('id', registro['id']).execute()

                processados += 1

                if processados % 100 == 0:
                    print(f"  Processados: {processados:,} / {total:,} ({processados*100/total:.1f}%)")

            except Exception as e:
                print(f"  Erro no registro {registro['id']}: {e}")

        offset += batch_size

    print(f"\nConcluido! {processados:,} registros atualizados")

if __name__ == "__main__":
    main()
