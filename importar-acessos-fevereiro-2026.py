"""
Script para importar registros de acesso de FEVEREIRO 2026 do Data Warehouse para o Supabase.
- Busca CPFs da tabela usuarios (apenas tipo 'terceiro')
- Extrai acessos do Suricato sem filtro de tipo (busca qualquer tipo de acesso)
- Filtra por data_acesso entre 2026-02-01 e 2026-02-28
- Inclui os campos planta e codin
- Evita duplicações verificando se o registro já existe antes de inserir
- Normaliza CPFs para 11 dígitos (adiciona zeros à esquerda quando necessário)
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

# Configurações do Supabase pip install psycopg2-binary python-dotenv supabase pytz
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("❌ Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY são obrigatórias!")

# Período de busca - Fevereiro 2026
DATA_INICIO = '2026-02-01'
DATA_FIM = '2026-02-28 23:59:59'


def normalizar_cpf(cpf):
    """
    Normaliza um CPF para ter exatamente 11 dígitos.
    Remove caracteres não numéricos e adiciona zeros à esquerda se necessário.

    Args:
        cpf: CPF em qualquer formato (string ou número)

    Returns:
        CPF normalizado com 11 dígitos (string)
    """
    if cpf is None:
        return None

    # Converte para string e remove caracteres não numéricos
    cpf_limpo = ''.join(filter(str.isdigit, str(cpf)))

    if not cpf_limpo:
        return None

    # Adiciona zeros à esquerda para completar 11 dígitos
    cpf_normalizado = cpf_limpo.zfill(11)

    return cpf_normalizado


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
    """
    Busca todos os CPFs da tabela usuarios do tipo 'terceiro'.
    Retorna um dicionário mapeando CPF sem zeros à esquerda -> CPF normalizado (11 dígitos).
    """
    try:
        print("\n📋 Buscando CPFs da tabela usuarios (tipo 'terceiro')...")
        response = supabase.table('usuarios').select('cpf').eq('tipo', 'terceiro').execute()

        # Cria um mapeamento de CPF (sem zeros) -> CPF normalizado
        cpf_map = {}
        for usuario in response.data:
            cpf_original = usuario.get('cpf')
            if cpf_original:
                cpf_normalizado = normalizar_cpf(cpf_original)
                if cpf_normalizado:
                    # Versão sem zeros à esquerda (como vem do Suricato)
                    cpf_sem_zeros = cpf_normalizado.lstrip('0') or '0'
                    cpf_map[cpf_sem_zeros] = cpf_normalizado
                    # Também mapeia a versão completa
                    cpf_map[cpf_normalizado] = cpf_normalizado

        print(f"  ✅ {len(cpf_map) // 2} CPFs únicos encontrados na tabela usuarios")
        return cpf_map
    except Exception as e:
        print(f"❌ Erro ao buscar CPFs dos usuários: {e}")
        raise


def extrair_acessos(conn, cpf_map):
    """
    Extrai os acessos de Fevereiro 2026 para cada CPF da tabela usuarios.

    Args:
        conn: Conexão com o Data Warehouse
        cpf_map: Dicionário mapeando CPFs (com/sem zeros) -> CPF normalizado
    """
    try:
        if not cpf_map:
            print("⚠️ Nenhum CPF encontrado na tabela usuarios. Nada para importar.")
            return []

        cursor = conn.cursor()
        todos_resultados = []

        # Extrai CPFs únicos normalizados para consulta
        cpfs_unicos = list(set(cpf_map.values()))
        total_cpfs = len(cpfs_unicos)

        print(f"\n📊 Executando query para buscar acessos de {DATA_INICIO} a {DATA_FIM}")
        print(f"   para cada um dos {total_cpfs} CPFs...")

        for i, cpf_normalizado in enumerate(cpfs_unicos, 1):
            try:
                # Versão do CPF sem zeros à esquerda (como pode estar no Suricato)
                cpf_sem_zeros = cpf_normalizado.lstrip('0') or '0'

                # Query sem filtro de tipo - busca qualquer tipo de acesso
                # Filtra por período (Fevereiro 2026)
                # Usa BOTH versões do CPF (com e sem zeros à esquerda)
                query = """
                SELECT
                    tipo, matricula, nome, cpf, data_acesso, sentido, pis,
                    cracha, planta, codin, grupo_de_acess, desc_perm,
                    tipo_acesso, descr_acesso, modelo, cod_planta, cod_codin
                FROM suricato.acesso_colaborador
                WHERE (cpf = %s OR cpf = %s)
                  AND data_acesso >= %s
                  AND data_acesso <= %s
                ORDER BY data_acesso ASC
                """

                cursor.execute(query, (cpf_normalizado, cpf_sem_zeros, DATA_INICIO, DATA_FIM))
                resultados = cursor.fetchall()

                if resultados:
                    todos_resultados.extend(resultados)

                # Mostra progresso a cada 10 CPFs ou no último
                if i % 10 == 0 or i == total_cpfs:
                    print(f"  Progresso: {i}/{total_cpfs} CPFs processados - {len(todos_resultados)} registros coletados")

            except Exception as e:
                print(f"  ⚠️ Erro ao processar CPF {cpf_normalizado}: {e}")
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


def inserir_em_supabase(supabase: Client, dados, cpf_map):
    """
    Insere os dados no Supabase, evitando duplicatas.
    Verifica cada registro individualmente antes de inserir.
    Normaliza CPFs para 11 dígitos antes de inserir.
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
        cpfs_nao_encontrados = 0

        print(f"\n📤 Iniciando inserção de {total} registros no Supabase...")

        for i, registro in enumerate(dados, 1):
            try:
                # Normaliza o CPF para 11 dígitos
                cpf_original = registro.get('cpf', '')
                cpf_normalizado = normalizar_cpf(cpf_original)

                if not cpf_normalizado:
                    erros += 1
                    continue

                # Verifica se o CPF existe no mapeamento (está na tabela usuarios)
                cpf_sem_zeros = cpf_normalizado.lstrip('0') or '0'
                if cpf_normalizado not in cpf_map and cpf_sem_zeros not in cpf_map:
                    cpfs_nao_encontrados += 1
                    continue

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
                # Usa o CPF normalizado (11 dígitos) para inserção
                acesso = {
                    'tipo': registro.get('tipo', ''),
                    'matricula': registro.get('matricula', ''),
                    'nome': registro.get('nome', ''),
                    'cpf': cpf_normalizado,  # CPF normalizado com 11 dígitos
                    'data_acesso': data_acesso_str,
                    'sentido': registro.get('sentido', ''),
                    'planta': registro.get('planta'),
                    'codin': registro.get('codin')
                }

                # Verifica se já existe (usando CPF normalizado)
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
        print(f"     - CPFs não encontrados na tabela usuarios: {cpfs_nao_encontrados}")
        print(f"     - Erros: {erros}")

    except Exception as e:
        print(f"❌ Erro ao inserir dados no Supabase: {e}")
        raise


def main():
    """Função principal do script."""
    print("=" * 70)
    print("IMPORTAÇÃO DE ACESSOS DO DATA WAREHOUSE PARA SUPABASE")
    print(f"Período: FEVEREIRO 2026 ({DATA_INICIO} a {DATA_FIM})")
    print("(CPFs de usuarios 'terceiro' - Todos os tipos de acesso do Suricato)")
    print("(Normalização de CPF para 11 dígitos)")
    print(f"Horário: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)

    conn = None
    try:
        # Conecta ao Supabase primeiro para buscar os CPFs
        supabase = conectar_supabase()

        # Busca os CPFs da tabela usuarios (retorna mapeamento)
        cpf_map = buscar_cpfs_usuarios(supabase)

        if not cpf_map:
            print("\n⚠️ Nenhum CPF encontrado na tabela usuarios. Nada para importar.")
            return

        # Conecta ao Data Warehouse
        conn = conectar_data_warehouse()

        print(f"\n📥 Extraindo acessos de Fevereiro 2026 do Data Warehouse...")
        dados_extraidos = extrair_acessos(conn, cpf_map)

        if dados_extraidos:
            inserir_em_supabase(supabase, dados_extraidos, cpf_map)
        else:
            print(f"\nℹ️ Nenhum acesso encontrado para os CPFs cadastrados no período.")

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
