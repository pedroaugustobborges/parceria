"""
Script para corrigir o timezone dos registros existentes na tabela acessos.

PROBLEMA:
- Os registros foram armazenados como UTC quando na verdade eram horário do Brasil
- Exemplo: 07:17 Brasil foi armazenado como 07:17 UTC
- Quando exibido, mostra 04:17 Brasil (07:17 - 3h = 04:17)

SOLUÇÃO:
- Converter cada timestamp assumindo que o valor armazenado é horário do Brasil
- Ajustar para o timezone correto do Brasil (-03:00)
"""

import sys
import os
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv
import pytz
from dateutil import parser

# Configuração para Windows suportar caracteres Unicode no console
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Carrega variáveis de ambiente
load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("❌ Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY são obrigatórias!")

def conectar_supabase():
    """Conecta ao Supabase usando a service role key."""
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print(f"✅ Conectado ao Supabase: {SUPABASE_URL}")
        return supabase
    except Exception as e:
        print(f"❌ Erro ao conectar no Supabase: {e}")
        raise

def corrigir_timezone_acessos(supabase: Client, modo_teste=True):
    """
    Corrige o timezone dos registros na tabela acessos.

    Args:
        supabase: Cliente Supabase
        modo_teste: Se True, apenas mostra o que seria feito sem aplicar mudanças
    """
    try:
        # Timezone do Brasil
        brazil_tz = pytz.timezone('America/Sao_Paulo')

        # Buscar todos os registros (em lotes de 1000)
        print("\n📊 Buscando registros da tabela acessos...")

        offset = 0
        limit = 1000
        total_registros = 0
        registros_corrigidos = 0
        erros = 0

        while True:
            response = supabase.table('acessos').select('id, data_acesso, cpf, nome').range(offset, offset + limit - 1).execute()

            if not response.data:
                break

            total_registros += len(response.data)
            print(f"\n📦 Processando lote {offset // limit + 1} ({len(response.data)} registros)...")

            for registro in response.data:
                try:
                    # Parse do timestamp atual (está como UTC mas deveria ser Brasil)
                    timestamp_str = registro['data_acesso']
                    timestamp_utc = parser.isoparse(timestamp_str)

                    # Remove timezone info para trabalhar com o valor "cru"
                    timestamp_naive = timestamp_utc.replace(tzinfo=None)

                    # Assume que esse valor é horário do Brasil e marca como tal
                    timestamp_brazil = brazil_tz.localize(timestamp_naive)

                    # Converte para string ISO (agora com timezone correto do Brasil)
                    novo_timestamp = timestamp_brazil.isoformat()

                    if modo_teste:
                        # Modo teste: apenas mostra os primeiros 5 exemplos
                        if registros_corrigidos < 5:
                            print(f"\n  Exemplo {registros_corrigidos + 1}:")
                            print(f"    CPF: {registro['cpf']} - Nome: {registro['nome']}")
                            print(f"    Antes: {timestamp_str}")
                            print(f"    Depois: {novo_timestamp}")
                    else:
                        # Atualiza o registro
                        supabase.table('acessos').update({
                            'data_acesso': novo_timestamp
                        }).eq('id', registro['id']).execute()

                    registros_corrigidos += 1

                except Exception as e:
                    erros += 1
                    if erros <= 5:
                        print(f"  ⚠️ Erro ao processar registro {registro['id']}: {e}")

            offset += limit

            if modo_teste and offset >= 1000:
                print(f"\n⚠️ Modo teste limitado a 1000 registros")
                break

        print(f"\n{'='*70}")
        print(f"{'🧪 SIMULAÇÃO' if modo_teste else '✅ CORREÇÃO CONCLUÍDA'}")
        print(f"{'='*70}")
        print(f"📊 Total de registros processados: {total_registros}")
        print(f"✅ Registros {'que seriam corrigidos' if modo_teste else 'corrigidos'}: {registros_corrigidos}")
        print(f"❌ Erros: {erros}")

        if modo_teste:
            print(f"\n⚠️ Este foi um teste! Nenhuma alteração foi aplicada.")
            print(f"   Para aplicar as correções, execute: python corrigir-timezone-acessos.py aplicar")

    except Exception as e:
        print(f"❌ Erro ao corrigir timezone: {e}")
        raise

def main():
    """Função principal."""
    print("=" * 70)
    print("CORREÇÃO DE TIMEZONE DOS ACESSOS")
    print(f"Horário: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    # Verifica modo de execução
    modo_teste = True
    if len(sys.argv) > 1 and sys.argv[1].lower() == 'aplicar':
        resposta = input("\n⚠️ ATENÇÃO: Você está prestes a MODIFICAR todos os registros da tabela acessos.\n"
                        "   Esta operação não pode ser desfeita facilmente.\n"
                        "   Digite 'CONFIRMO' para prosseguir: ")
        if resposta == 'CONFIRMO':
            modo_teste = False
            print("\n✅ Modo de aplicação confirmado!")
        else:
            print("\n❌ Operação cancelada.")
            return
    else:
        print("\n🧪 Executando em MODO TESTE (nenhuma alteração será feita)")

    try:
        supabase = conectar_supabase()
        corrigir_timezone_acessos(supabase, modo_teste=modo_teste)

    except Exception as e:
        print(f"\n❌ O SCRIPT FOI INTERROMPIDO DEVIDO A UM ERRO: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
