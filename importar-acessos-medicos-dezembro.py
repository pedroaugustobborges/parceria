"""
Script para importar registros de acesso do tipo 'Terceiro' para CPFs específicos
desde dezembro de 2025 até hoje do Data Warehouse para o Supabase.
CPFs: 04164100575 e 02725459109
Evita duplicações verificando se o registro já existe antes de inserir.
"""

import sys
import os
import psycopg2
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv
import pytz

# Configuração para Windows suportar caracteres Unicode no console
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Carrega variáveis de ambiente do arquivo .env
load_dotenv()

# Configurações do Data Warehouse (AWS RDS)
DW_CONFIG = {
    'host': 'db-rds-postgres.cx4bovrfmkbp.sa-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'db_rds_01',
    'user': 'gest_contratos',
    'password': 'asdgRTFG98'
}

# Configurações do Supabase
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("❌ Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY são obrigatórias!")

# CPFs específicos dos Terceiros
CPFS_MEDICOS = ['12585625702','3189293171','70460241117','2007340160','04164100575', '2725459109', '5142257189','2055839110', '70492224102']

def conectar_data_warehouse():
    """Conecta ao Data Warehouse PostgreSQL na AWS."""
    try:
        conn = psycopg2.connect(**DW_CONFIG, connect_timeout=10)
        print(f"✅ Conectado ao Data Warehouse: {DW_CONFIG['host']}")
        return conn
    except psycopg2.OperationalError as e:
        print("\n" + "="*70)
        print("❌ FALHA NA CONEXÃO COM O DATA WAREHOUSE")
        print("="*70)
        print("  A mensagem de erro original para a equipe de TI é:")
        print(f"\n  {e}\n")
        print("="*70)
        raise

def conectar_supabase():
    """Conecta ao Supabase usando a service role key."""
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print(f"✅ Conectado ao Supabase: {SUPABASE_URL}")
        return supabase
    except Exception as e:
        print(f"❌ Erro ao conectar no Supabase: {e}")
        raise

def extrair_acessos_medicos(conn, cpfs_medicos, data_inicio='2025-12-01'):
    """
    Extrai acessos do tipo 'Terceiro' para CPFs específicos desde dezembro de 2025.

    Args:
        conn: Conexão com o Data Warehouse
        cpfs_medicos: Lista de CPFs dos Terceiros
        data_inicio: Data de início do filtro (padrão: '2025-12-01')
    """
    try:
        if not cpfs_medicos:
            print("⚠️ Nenhum CPF fornecido. Nada para importar.")
            return []

        cursor = conn.cursor()
        todos_resultados = []
        total_cpfs = len(cpfs_medicos)
        data_hoje = datetime.now().strftime('%Y-%m-%d')

        print(f"\n📊 Executando query para buscar registros do tipo 'Terceiro' de {data_inicio} até {data_hoje}...")
        print(f"   CPFs: {', '.join(cpfs_medicos)}")

        for i, cpf in enumerate(cpfs_medicos, 1):
            try:
                # Query filtrada por tipo='Terceiro', CPF e data
                query = """
                SELECT
                    tipo, matricula, nome, cpf, data_acesso, sentido, pis,
                    cracha, planta, codin, grupo_de_acess, desc_perm,
                    tipo_acesso, descr_acesso, modelo, cod_planta, cod_codin
                FROM suricato.acesso_colaborador
                WHERE cpf = %s
                  AND tipo = 'Terceiro'
                  AND data_acesso >= %s::timestamp
                  AND data_acesso <= %s::timestamp
                ORDER BY data_acesso ASC
                """

                cursor.execute(query, (cpf, data_inicio, data_hoje + ' 23:59:59'))
                resultados = cursor.fetchall()

                if resultados:
                    todos_resultados.extend(resultados)
                    print(f"  ✅ CPF {cpf}: {len(resultados)} registros encontrados")
                else:
                    print(f"  ℹ️ CPF {cpf}: Nenhum registro encontrado")

            except Exception as e:
                print(f"  ⚠️ Erro ao processar CPF {cpf}: {e}")
                continue

        colunas = [desc[0] for desc in cursor.description] if cursor.description else []
        cursor.close()

        print(f"\n  ✅ Total de registros encontrados: {len(todos_resultados)}")

        dados = [dict(zip(colunas, row)) for row in todos_resultados]
        return dados

    except Exception as e:
        print(f"❌ Erro ao extrair dados: {e}")
        raise

def registro_existe(supabase: Client, cpf: str, data_acesso: str, sentido: str):
    """
    Verifica se já existe um registro com o mesmo CPF, data_acesso e sentido.
    Esta combinação deve ser única para evitar duplicatas.
    """
    try:
        response = supabase.table('acessos').select('id').eq('cpf', cpf).eq('data_acesso', data_acesso).eq('sentido', sentido).limit(1).execute()
        return len(response.data) > 0
    except Exception as e:
        print(f"⚠️ Erro ao verificar duplicata: {e}")
        return False

def inserir_em_supabase(supabase: Client, dados):
    """
    Insere os dados no Supabase, evitando duplicatas.
    Verifica cada registro individualmente antes de inserir.
    """
    if not dados:
        print("⚠️ Nenhum dado para inserir.")
        return

    try:
        # Timezone do Brasil (Brasília)
        brazil_tz = pytz.timezone('America/Sao_Paulo')

        total = len(dados)
        inseridos = 0
        duplicados = 0
        erros = 0

        print(f"\n📤 Iniciando inserção de {total} registros no Supabase...")

        for i, registro in enumerate(dados, 1):
            try:
                # Processa data_acesso com timezone do Brasil
                data_acesso_original = registro.get('data_acesso')
                if hasattr(data_acesso_original, 'isoformat'):
                    # Se é datetime, assume que está em horário do Brasil (timezone-naive)
                    if data_acesso_original.tzinfo is None:
                        # Marca como horário do Brasil
                        data_acesso_br = brazil_tz.localize(data_acesso_original)
                    else:
                        # Já tem timezone, converte para Brasil
                        data_acesso_br = data_acesso_original.astimezone(brazil_tz)
                    data_acesso_str = data_acesso_br.isoformat()
                else:
                    data_acesso_str = str(data_acesso_original)

                # Extrai apenas os campos necessários para a tabela acessos
                acesso = {
                    'tipo': registro.get('tipo', ''),
                    'matricula': registro.get('matricula', ''),
                    'nome': registro.get('nome', ''),
                    'cpf': registro.get('cpf', ''),
                    'data_acesso': data_acesso_str,
                    'sentido': registro.get('sentido', ''),
                    'planta': registro.get('planta'),
                    'codin': registro.get('codin')
                }

                # Verifica se já existe
                if registro_existe(supabase, acesso['cpf'], acesso['data_acesso'], acesso['sentido']):
                    duplicados += 1
                    if i % 100 == 0 or i == total:
                        print(f"  Progresso: {i}/{total} - Inseridos: {inseridos} | Duplicados: {duplicados} | Erros: {erros}")
                    continue

                # Insere no Supabase
                supabase.table('acessos').insert(acesso).execute()
                inseridos += 1

                # Mostra progresso a cada 100 registros ou no último
                if i % 100 == 0 or i == total:
                    print(f"  Progresso: {i}/{total} - Inseridos: {inseridos} | Duplicados: {duplicados} | Erros: {erros}")

            except Exception as e:
                erros += 1
                if erros <= 5:  # Mostra apenas os primeiros 5 erros
                    print(f"  ⚠️ Erro no registro {i}: {e}")

        print(f"\n✅ Importação concluída!")
        print(f"  📊 Resumo:")
        print(f"     - Total processado: {total}")
        print(f"     - Inseridos com sucesso: {inseridos}")
        print(f"     - Duplicados (ignorados): {duplicados}")
        print(f"     - Erros: {erros}")

    except Exception as e:
        print(f"❌ Erro ao inserir dados no Supabase: {e}")
        raise

def main():
    """Função principal do script."""
    print("=" * 70)
    print("IMPORTAÇÃO DE ACESSOS DE TerceiroS - DEZEMBRO 2025 ATÉ HOJE")
    print(f"CPFs: {', '.join(CPFS_MEDICOS)}")
    print(f"Período: 2025-12-01 até {datetime.now().strftime('%Y-%m-%d')}")
    print(f"Horário: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    conn = None
    try:
        # Conecta ao Supabase
        supabase = conectar_supabase()

        # Conecta ao Data Warehouse
        conn = conectar_data_warehouse()

        # Extrai os dados
        print(f"\n📥 Extraindo registros de acesso do tipo 'Terceiro' do Data Warehouse...")
        dados_extraidos = extrair_acessos_medicos(conn, CPFS_MEDICOS)

        if dados_extraidos:
            inserir_em_supabase(supabase, dados_extraidos)
        else:
            print(f"\nℹ️ Nenhum acesso encontrado para os CPFs e período especificados.")

    except Exception as e:
        print(f"\n❌ O SCRIPT FOI INTERROMPIDO DEVIDO A UM ERRO: {e}")
        import traceback
        traceback.print_exc()

    finally:
        if conn:
            conn.close()
            print("\n🔌 Conexão com o Data Warehouse encerrada.")

if __name__ == "__main__":
    main()
