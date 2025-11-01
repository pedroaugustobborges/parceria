"""
Script para coletar dados RETROATIVOS de produtividade do sistema MV.
EXECUÇÃO ÚNICA - Coleta dados de 01/09/2025 até ontem.

Este script:
1. Busca todos os usuários tipo "terceiro" com codigomv
2. Para cada dia do período, coleta a produtividade de todos os médicos
3. Aguarda 15 segundos entre cada dia para não sobrecarregar o servidor
4. Insere os dados na tabela produtividade do Supabase

⚠️ ATENÇÃO: Este script deve ser executado APENAS UMA VEZ manualmente!
"""

import os
import sys
import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/produtividade-mv-retroativo.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Carregar variáveis de ambiente
load_dotenv()

# ==================== CONFIGURAÇÕES ====================
DATA_INICIO = datetime(2025, 9, 1)  # 01 de setembro de 2025
DATA_FIM = datetime.now() - timedelta(days=1)  # Ontem
INTERVALO_ENTRE_DIAS = 15  # segundos
# ======================================================

MV_REPORT_URL = "http://mvpepprd.saude.go.gov.br/report-executor/report-viewer?id=7076"
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')
GECKODRIVER_PATH = '/usr/local/bin/geckodriver'

# XPaths do Formulário
BASE_CONTAINER = "//div[contains(@id, '_ParametersPanelContainer')]"
XPATH_CODIGO_PRESTADOR = f"{BASE_CONTAINER}//tr[2]/td[2]//input"
XPATH_DATA_INICIAL = f"{BASE_CONTAINER}//tr[1]/td[4]//input"
XPATH_DATA_FINAL = f"{BASE_CONTAINER}//tr[2]/td[4]//input"
XPATH_SUBMIT_BUTTON = f"{BASE_CONTAINER}//tr[4]/td[4]//td[contains(., 'Submit')]"

class ProdutividadeRetroativoCollector:
    """Classe para coletar dados retroativos de produtividade do MV."""

    def __init__(self):
        """Inicializa o coletor."""
        self.driver = None
        self.supabase = None
        self.usuarios_terceiros = []
        self.total_dias = 0
        self.dias_processados = 0
        self.total_registros_inseridos = 0

    def setup_driver(self):
        """Configura o driver do Selenium com Firefox headless."""
        logger.info("Configurando Firefox driver...")

        import os
        import shutil
        global GECKODRIVER_PATH

        if not os.path.exists(GECKODRIVER_PATH):
            logger.error(f"Geckodriver não encontrado em: {GECKODRIVER_PATH}")
            geckodriver_path = shutil.which('geckodriver')
            if geckodriver_path:
                logger.info(f"Geckodriver encontrado em: {geckodriver_path}")
                GECKODRIVER_PATH = geckodriver_path
            else:
                raise FileNotFoundError("Geckodriver não encontrado")

        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')

        service = Service(GECKODRIVER_PATH)

        try:
            logger.info("Iniciando Firefox em modo headless...")
            self.driver = webdriver.Firefox(service=service, options=options)
            # Timeouts aumentados
            self.driver.set_page_load_timeout(300)
            self.driver.set_script_timeout(300)
            logger.info("Firefox iniciado com sucesso!")
        except Exception as e:
            logger.error(f"Erro ao configurar Firefox driver: {e}")
            raise

    def conectar_supabase(self):
        """Conecta ao Supabase."""
        logger.info("Conectando ao Supabase...")
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise ValueError("Variáveis de ambiente SUPABASE não configuradas")

        self.supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        logger.info("Conectado ao Supabase com sucesso")

    def buscar_usuarios_terceiros(self):
        """Busca todos os usuários do tipo 'terceiro' com codigomv."""
        logger.info("Buscando usuários terceiros com código MV...")

        try:
            response = self.supabase.table('usuarios').select('*').eq('tipo', 'terceiro').execute()

            # Filtrar apenas usuários com codigomv
            self.usuarios_terceiros = [
                usuario for usuario in response.data
                if usuario.get('codigomv')
            ]

            logger.info(f"Encontrados {len(self.usuarios_terceiros)} médicos terceiros com código MV")
            return len(self.usuarios_terceiros) > 0

        except Exception as e:
            logger.error(f"Erro ao buscar usuários: {e}")
            return False

    def coletar_produtividade_dia(self, data: datetime, codigo_mv: str, nome_medico: str) -> List[Dict]:
        """Coleta produtividade de um médico em uma data específica."""
        data_str = data.strftime("%d/%m/%Y")

        try:
            # Acessar o relatório
            if self.driver.current_url != MV_REPORT_URL:
                self.driver.get(MV_REPORT_URL)
                time.sleep(2)

            # Preencher código do prestador
            campo_codigo = WebDriverWait(self.driver, 20).until(
                EC.presence_of_element_located((By.XPATH, XPATH_CODIGO_PRESTADOR))
            )
            campo_codigo.clear()
            campo_codigo.send_keys(codigo_mv)

            # Preencher data inicial
            campo_data_inicial = self.driver.find_element(By.XPATH, XPATH_DATA_INICIAL)
            campo_data_inicial.clear()
            campo_data_inicial.send_keys(data_str)

            # Preencher data final (mesmo dia)
            campo_data_final = self.driver.find_element(By.XPATH, XPATH_DATA_FINAL)
            campo_data_final.clear()
            campo_data_final.send_keys(data_str)

            # Clicar no botão Submit
            submit_button = self.driver.find_element(By.XPATH, XPATH_SUBMIT_BUTTON)
            submit_button.click()

            # Aguardar tabela carregar
            time.sleep(5)

            # Extrair dados da tabela
            dados = self._extrair_dados_tabela(data, codigo_mv, nome_medico)
            return dados

        except Exception as e:
            logger.warning(f"Erro ao coletar dados de {nome_medico} ({codigo_mv}) em {data_str}: {e}")
            return []

    def _extrair_dados_tabela(self, data: datetime, codigo_mv: str, nome_medico: str) -> List[Dict]:
        """Extrai dados da tabela de produtividade."""
        dados = []

        try:
            # Localizar tabela
            tabelas = self.driver.find_elements(By.TAG_NAME, "table")

            if not tabelas:
                return dados

            # Procurar tabela com dados de produtividade
            for tabela in tabelas:
                try:
                    linhas = tabela.find_elements(By.TAG_NAME, "tr")

                    if len(linhas) < 2:  # Precisa ter header + pelo menos 1 linha de dados
                        continue

                    # Processar cada linha de dados
                    for linha in linhas[1:]:  # Pular header
                        try:
                            colunas = linha.find_elements(By.TAG_NAME, "td")

                            if len(colunas) < 10:  # Verificar se tem colunas suficientes
                                continue

                            # Extrair valores (ajustar índices conforme estrutura da tabela)
                            registro = {
                                'codigo_mv': codigo_mv,
                                'nome': nome_medico,
                                'especialidade': colunas[2].text.strip() if len(colunas) > 2 else None,
                                'vinculo': colunas[3].text.strip() if len(colunas) > 3 else None,
                                'data': data.strftime("%Y-%m-%d"),
                                'procedimento': self._parse_int(colunas[4].text) if len(colunas) > 4 else 0,
                                'parecer_solicitado': self._parse_int(colunas[5].text) if len(colunas) > 5 else 0,
                                'parecer_realizado': self._parse_int(colunas[6].text) if len(colunas) > 6 else 0,
                                'cirurgia_realizada': self._parse_int(colunas[7].text) if len(colunas) > 7 else 0,
                                'prescricao': self._parse_int(colunas[8].text) if len(colunas) > 8 else 0,
                                'evolucao': self._parse_int(colunas[9].text) if len(colunas) > 9 else 0,
                                'urgencia': self._parse_int(colunas[10].text) if len(colunas) > 10 else 0,
                                'ambulatorio': self._parse_int(colunas[11].text) if len(colunas) > 11 else 0,
                                'auxiliar': self._parse_int(colunas[12].text) if len(colunas) > 12 else 0,
                                'encaminhamento': self._parse_int(colunas[13].text) if len(colunas) > 13 else 0,
                                'folha_objetivo_diario': self._parse_int(colunas[14].text) if len(colunas) > 14 else 0,
                                'evolucao_diurna_cti': self._parse_int(colunas[15].text) if len(colunas) > 15 else 0,
                                'evolucao_noturna_cti': self._parse_int(colunas[16].text) if len(colunas) > 16 else 0,
                            }

                            dados.append(registro)

                        except Exception as e:
                            logger.debug(f"Erro ao processar linha: {e}")
                            continue

                except Exception as e:
                    logger.debug(f"Erro ao processar tabela: {e}")
                    continue

        except Exception as e:
            logger.error(f"Erro ao extrair dados da tabela: {e}")

        return dados

    def _parse_int(self, valor: str) -> int:
        """Converte string para int, retornando 0 em caso de erro."""
        try:
            return int(valor.strip().replace(',', '').replace('.', ''))
        except:
            return 0

    def inserir_dados_supabase(self, dados: List[Dict]) -> int:
        """Insere dados no Supabase."""
        if not dados:
            return 0

        try:
            response = self.supabase.table('produtividade').insert(dados).execute()
            return len(dados)
        except Exception as e:
            logger.error(f"Erro ao inserir dados no Supabase: {e}")
            return 0

    def executar(self):
        """Executa a coleta retroativa."""
        logger.info("\n" + "="*70)
        logger.info("INÍCIO DA COLETA RETROATIVA DE PRODUTIVIDADE")
        logger.info(f"Período: {DATA_INICIO.strftime('%d/%m/%Y')} até {DATA_FIM.strftime('%d/%m/%Y')}")
        logger.info(f"Intervalo entre dias: {INTERVALO_ENTRE_DIAS} segundos")
        logger.info("="*70 + "\n")

        try:
            # Conectar ao Supabase
            self.conectar_supabase()

            # Buscar usuários terceiros
            if not self.buscar_usuarios_terceiros():
                logger.error("Nenhum usuário terceiro encontrado")
                return

            # Configurar driver
            self.setup_driver()

            # Calcular total de dias
            self.total_dias = (DATA_FIM - DATA_INICIO).days + 1
            logger.info(f"Total de dias a processar: {self.total_dias}")
            logger.info(f"Total de médicos: {len(self.usuarios_terceiros)}")
            logger.info(f"Total de coletas: {self.total_dias * len(self.usuarios_terceiros)}\n")

            # Iterar por cada dia
            data_atual = DATA_INICIO
            while data_atual <= DATA_FIM:
                self.dias_processados += 1
                data_str = data_atual.strftime("%d/%m/%Y")

                logger.info(f"\n{'='*70}")
                logger.info(f"DIA {self.dias_processados}/{self.total_dias}: {data_str}")
                logger.info(f"{'='*70}")

                registros_dia = 0

                # Coletar dados de todos os médicos neste dia
                for idx, usuario in enumerate(self.usuarios_terceiros, 1):
                    codigo_mv = usuario.get('codigomv')
                    nome = usuario.get('nome')

                    logger.info(f"[{idx}/{len(self.usuarios_terceiros)}] Processando {nome} ({codigo_mv})...")

                    try:
                        dados = self.coletar_produtividade_dia(data_atual, codigo_mv, nome)

                        if dados:
                            inseridos = self.inserir_dados_supabase(dados)
                            registros_dia += inseridos
                            logger.info(f"  ✓ {inseridos} registros inseridos")
                        else:
                            logger.info(f"  - Sem dados para este dia")

                    except Exception as e:
                        logger.error(f"  ✗ Erro: {e}")
                        continue

                self.total_registros_inseridos += registros_dia
                logger.info(f"\nResumo do dia: {registros_dia} registros inseridos")
                logger.info(f"Total acumulado: {self.total_registros_inseridos} registros")

                # Avançar para próximo dia
                data_atual += timedelta(days=1)

                # Aguardar antes do próximo dia (exceto no último)
                if data_atual <= DATA_FIM:
                    logger.info(f"\nAguardando {INTERVALO_ENTRE_DIAS} segundos antes do próximo dia...\n")
                    time.sleep(INTERVALO_ENTRE_DIAS)

            # Resumo final
            logger.info("\n" + "="*70)
            logger.info("COLETA RETROATIVA CONCLUÍDA!")
            logger.info(f"Dias processados: {self.dias_processados}")
            logger.info(f"Total de registros inseridos: {self.total_registros_inseridos}")
            logger.info("="*70 + "\n")

        except Exception as e:
            logger.error(f"Erro crítico na execução: {e}")
            raise
        finally:
            if self.driver:
                self.driver.quit()
                logger.info("Firefox fechado")

def main():
    """Função principal."""
    # Confirmar execução
    print("\n" + "="*70)
    print("COLETA RETROATIVA DE PRODUTIVIDADE MV")
    print("="*70)
    print(f"Período: {DATA_INICIO.strftime('%d/%m/%Y')} até {DATA_FIM.strftime('%d/%m/%Y')}")
    print(f"Intervalo: {INTERVALO_ENTRE_DIAS} segundos entre cada dia")
    print(f"Total de dias: {(DATA_FIM - DATA_INICIO).days + 1}")
    print("="*70)
    print("\n⚠️  ATENÇÃO: Este processo pode levar várias horas!")
    print("⚠️  Certifique-se de que o droplet não será desligado.\n")

    resposta = input("Deseja continuar? (sim/não): ").strip().lower()

    if resposta not in ['sim', 's', 'yes', 'y']:
        print("Operação cancelada pelo usuário.")
        return

    print("\nIniciando coleta retroativa...\n")

    collector = ProdutividadeRetroativoCollector()
    collector.executar()

if __name__ == "__main__":
    main()
