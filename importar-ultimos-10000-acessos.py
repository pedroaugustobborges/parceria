"""
Script para importar os últimos 500 registros de acesso do tipo 'Terceiro' POR CPF do Data Warehouse para o Supabase.
Inclui os campos planta e codin.
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

def buscar_cpfs_usuarios(supabase: Client):
    """Busca todos os CPFs da tabela usuarios."""
    try:
        print("\n📋 Buscando CPFs da tabela usuarios...")
        response = supabase.table('usuarios').select('cpf').execute()
        cpfs = [usuario['cpf'] for usuario in response.data if usuario.get('cpf')]
        print(f"  ✅ {len(cpfs)} CPFs encontrados na tabela usuarios")
        return cpfs
    except Exception as e:
        print(f"❌ Erro ao buscar CPFs dos usuários: {e}")
        raise

def extrair_acessos(conn, cpfs_usuarios, limite_por_cpf=500):
    """
    Extrai os últimos N acessos do tipo 'Terceiro' para cada CPF da tabela usuarios.

    Args:
        conn: Conexão com o Data Warehouse
        cpfs_usuarios: Lista de CPFs da tabela usuarios
        limite_por_cpf: Número máximo de registros por CPF (padrão: 500)
    """
    try:
        if not cpfs_usuarios:
            print("⚠️ Nenhum CPF encontrado na tabela usuarios. Nada para importar.")
            return []

        cursor = conn.cursor()
        todos_resultados = []
        total_cpfs = len(cpfs_usuarios)

        print(f"\n📊 Executando query para buscar os últimos {limite_por_cpf} registros do tipo 'Terceiro' para cada um dos {total_cpfs} CPFs...")

        for i, cpf in enumerate(cpfs_usuarios, 1):
            try:
                # Query filtrada por tipo='Terceiro' e incluindo planta e codin
                query = """
                SELECT
                    tipo, matricula, nome, cpf, data_acesso, sentido, pis,
                    cracha, planta, codin, grupo_de_acess, desc_perm,
                    tipo_acesso, descr_acesso, modelo, cod_planta, cod_codin
                FROM suricato.acesso_colaborador
                WHERE cpf = %s
                  AND tipo = 'Terceiro'
                ORDER BY data_acesso DESC
                LIMIT %s
                """

                cursor.execute(query, (cpf, limite_por_cpf))
                resultados = cursor.fetchall()

                if resultados:
                    # Inverte para ordem cronológica (mais antigo para mais recente)
                    resultados.reverse()
                    todos_resultados.extend(resultados)

                # Mostra progresso a cada 10 CPFs ou no último
                if i % 10 == 0 or i == total_cpfs:
                    print(f"  Progresso: {i}/{total_cpfs} CPFs processados - {len(todos_resultados)} registros coletados")

            except Exception as e:
                print(f"  ⚠️ Erro ao processar CPF {cpf}: {e}")
                continue

        colunas = [desc[0] for desc in cursor.description] if cursor.description else []
        cursor.close()

        print(f"  ✅ Total de registros encontrados: {len(todos_resultados)}")

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
    print("IMPORTAÇÃO DE ACESSOS DO DATA WAREHOUSE PARA SUPABASE")
    print("(Últimos 500 registros tipo 'Terceiro' POR CPF com planta e codin)")
    print(f"Horário: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    conn = None
    try:
        # Conecta ao Supabase primeiro para buscar os CPFs
        supabase = conectar_supabase()

        # Busca os CPFs da tabela usuarios
        cpfs_usuarios = buscar_cpfs_usuarios(supabase)

        if not cpfs_usuarios:
            print("\n⚠️ Nenhum CPF encontrado na tabela usuarios. Nada para importar.")
            return

        # Conecta ao Data Warehouse
        conn = conectar_data_warehouse()

        # Define o limite de registros por CPF
        limite_por_cpf = 500
        if len(sys.argv) > 1:
            try:
                limite_por_cpf = int(sys.argv[1])
                print(f"\n⚙️ Limite por CPF definido via argumento: {limite_por_cpf}")
            except ValueError:
                print(f"⚠️ Argumento '{sys.argv[1]}' inválido. Usando o padrão de 500 registros por CPF.")

        print(f"\n📥 Extraindo os últimos {limite_por_cpf} registros do tipo 'Terceiro' para cada CPF do Data Warehouse...")
        dados_extraidos = extrair_acessos(conn, cpfs_usuarios, limite_por_cpf)

        if dados_extraidos:
            inserir_em_supabase(supabase, dados_extraidos)
        else:
            print(f"\nℹ️ Nenhum acesso encontrado para os CPFs cadastrados.")

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
