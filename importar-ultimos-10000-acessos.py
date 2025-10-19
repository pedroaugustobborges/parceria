"""
Script para importar os últimos registros de acesso do Data Warehouse para o Supabase.
Evita duplicações verificando se o registro já existe antes de inserir.
"""

import sys
import os
import psycopg2
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

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
        # Conexão simples sem opções adicionais (compatível com supabase 2.3.2)
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print(f"✅ Conectado ao Supabase: {SUPABASE_URL}")
        return supabase
    except Exception as e:
        print(f"❌ Erro ao conectar no Supabase: {e}")
        raise

def extrair_acessos(conn, limite=30000):
    """Extrai os últimos N acessos do banco de dados."""
    try:
        cursor = conn.cursor()

        query = """
        SELECT
            tipo, matricula, nome, cpf, data_acesso, sentido, pis,
            cracha, planta, codin, grupo_de_acess, desc_perm,
            tipo_acesso, descr_acesso, modelo, cod_planta, cod_codin
        FROM suricato.acesso_colaborador
        ORDER BY data_acesso DESC
        LIMIT %s
        """

        print(f"\n📊 Executando query para buscar os últimos {limite} registros...")
        cursor.execute(query, (limite,))

        resultados = cursor.fetchall()
        colunas = [desc[0] for desc in cursor.description]

        print(f"  Total de registros encontrados: {len(resultados)}")
        cursor.close()

        # Inverte a lista para ordem cronológica (mais antigo para mais recente)
        if resultados:
            resultados.reverse()

        dados = [dict(zip(colunas, row)) for row in resultados]
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
        total = len(dados)
        inseridos = 0
        duplicados = 0
        erros = 0

        print(f"\n📤 Iniciando inserção de {total} registros no Supabase...")

        for i, registro in enumerate(dados, 1):
            try:
                # Extrai apenas os campos necessários para a tabela acessos
                acesso = {
                    'tipo': registro.get('tipo', ''),
                    'matricula': registro.get('matricula', ''),
                    'nome': registro.get('nome', ''),
                    'cpf': registro.get('cpf', ''),
                    'data_acesso': registro.get('data_acesso').isoformat() if hasattr(registro.get('data_acesso'), 'isoformat') else str(registro.get('data_acesso')),
                    'sentido': registro.get('sentido', '')
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
    print("=" * 60)
    print("IMPORTAÇÃO DE ACESSOS DO DATA WAREHOUSE PARA SUPABASE")
    print(f"Horário: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    conn = None
    try:
        # Conecta aos dois bancos
        conn = conectar_data_warehouse()
        supabase = conectar_supabase()

        # Define o limite de registros
        limite = 30000
        if len(sys.argv) > 1:
            try:
                limite = int(sys.argv[1])
            except ValueError:
                print(f"⚠️ Argumento '{sys.argv[1]}' inválido. Usando o padrão de 30000 registros.")

        print(f"\n📥 Extraindo os últimos {limite} registros do Data Warehouse...")
        dados_extraidos = extrair_acessos(conn, limite)

        if dados_extraidos:
            inserir_em_supabase(supabase, dados_extraidos)
        else:
            print(f"\nℹ️ Nenhum acesso encontrado na tabela.")

    except Exception as e:
        print(f"\n❌ O SCRIPT FOI INTERROMPIDO DEVIDO A UM ERRO: {e}")

    finally:
        if conn:
            conn.close()
            print("\n🔌 Conexão com o Data Warehouse encerrada.")

if __name__ == "__main__":
    main()
