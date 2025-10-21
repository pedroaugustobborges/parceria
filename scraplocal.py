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

# Configurar logging para um arquivo local com encoding UTF-8
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('produtividade-mv-local.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Carregar variáveis de ambiente
load_dotenv()

# Configurações
MV_REPORT_URL = "http://mvpepprd.saude.go.gov.br/report-executor/report-viewer?id=7076"
SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('VITE_SUPABASE_SERVICE_ROLE_KEY')
GECKODRIVER_PATH = r"C:\Users\16144-pedro\Documents\bot_solicitacao\geckodriver.exe"

# --- XPaths do Formulário (Funcionando) ---
BASE_CONTAINER = "//div[contains(@id, '_ParametersPanelContainer')]"
XPATH_CODIGO_PRESTADOR = f"{BASE_CONTAINER}//tr[2]/td[2]//input"
XPATH_DATA_INICIAL = f"{BASE_CONTAINER}//tr[1]/td[4]//input"
XPATH_DATA_FINAL = f"{BASE_CONTAINER}//tr[2]/td[4]//input"
XPATH_SUBMIT_BUTTON = f"{BASE_CONTAINER}//tr[4]/td[4]//td[contains(., 'Enviar')]"


class ProdutividadeCollector:
    """Classe para coletar dados de produtividade do MV."""

    def __init__(self):
        """Inicializa o coletor."""
        self.driver = None
        self.supabase = None
        self.usuarios_terceiros = []

    def setup_driver(self):
        """Configura o driver do Selenium com timeouts aumentados."""
        logger.info("Configurando Firefox driver local...")
        global GECKODRIVER_PATH
        if not os.path.exists(GECKODRIVER_PATH):
            logger.error(f"Geckodriver não encontrado em: {GECKODRIVER_PATH}")
            raise FileNotFoundError(f"Geckodriver não encontrado: {GECKODRIVER_PATH}")

        options = Options()
        try:
            options.binary_location = r"C:\Program Files\Mozilla Firefox\firefox.exe"
        except Exception as e:
            logger.warning(f"Não foi possível definir o binary_location (caminho do Firefox): {e}")

        service = Service(
            executable_path=GECKODRIVER_PATH,
            log_output='geckodriver-local.log'
        )

        try:
            logger.info("Iniciando Firefox localmente...")
            self.driver = webdriver.Firefox(service=service, options=options)
            
            # --- TIMEOUT AUMENTADO (Baseado no Log de Erro) ---
            logger.info("Definindo Page Load Timeout para 60 segundos.")
            self.driver.set_page_load_timeout(60) # Aumentado de 30 para 60s
            
            self.driver.maximize_window()
            logger.info("Firefox driver configurado com sucesso")
        except Exception as e:
            logger.error(f"Erro ao configurar Firefox driver local: {e}")
            raise

    def connect_supabase(self):
        """Conecta ao Supabase."""
        logger.info("Conectando ao Supabase...")
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise ValueError("VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env")
        try:
            self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
            logger.info("Conectado ao Supabase com sucesso")
        except Exception as e:
            logger.error(f"Erro ao conectar no Supabase: {e}")
            raise

    def buscar_usuarios_terceiros(self) -> List[Dict]:
        """Busca todos os usuários do tipo 'terceiro' com codigomv."""
        logger.info("Buscando usuários terceiros...")
        try:
            response = self.supabase.table('usuarios').select(
                'id, nome, cpf, codigomv, especialidade'
            ).eq('tipo', 'terceiro').not_.is_('codigomv', 'null').execute()
            usuarios = response.data
            logger.info(f"Encontrados {len(usuarios)} usuários terceiros com codigomv")
            return usuarios
        except Exception as e:
            logger.error(f"Erro ao buscar usuários terceiros: {e}")
            raise

    def formatar_data_ontem(self) -> str:
        """Retorna a data de ontem no formato dd.MM.yyyy (com pontos)."""
        ontem = datetime.now() - timedelta(days=1)
        return ontem.strftime('%d.%m.%Y')

    def preencher_formulario(self, codigo_mv: str, data: str):
        """Preenche o formulário do relatório MV."""
        wait = WebDriverWait(self.driver, 20)
        try:
            # Campo Código Prestador
            logger.info(f"Preenchendo código MV: {codigo_mv}")
            campo_codigo = wait.until(
                EC.presence_of_element_located((By.XPATH, XPATH_CODIGO_PRESTADOR))
            )
            campo_codigo.clear()
            campo_codigo.send_keys(codigo_mv)
            time.sleep(2)

            # Campo Data Inicial
            logger.info(f"Preenchendo data inicial: {data} (formato dd.mm.yyyy)")
            campo_data_inicial = wait.until(
                EC.presence_of_element_located((By.XPATH, XPATH_DATA_INICIAL))
            )
            logger.info("Limpando campo data inicial (Ctrl+A + Backspace)...")
            campo_data_inicial.send_keys(Keys.CONTROL + "a")
            campo_data_inicial.send_keys(Keys.BACKSPACE)
            time.sleep(1)
            campo_data_inicial.send_keys(data)
            time.sleep(2)

            # Campo Data Final
            logger.info(f"Preenchendo data final: {data} (formato dd.mm.yyyy)")
            campo_data_final = wait.until(
                EC.presence_of_element_located((By.XPATH, XPATH_DATA_FINAL))
            )
            logger.info("Limpando campo data final (Ctrl+A + Backspace)...")
            campo_data_final.send_keys(Keys.CONTROL + "a")
            campo_data_final.send_keys(Keys.BACKSPACE)
            time.sleep(1)
            campo_data_final.send_keys(data)
            time.sleep(2)

            # Clicar no botão Submit
            logger.info("Clicando no botão Submit")
            botao_submit = wait.until(
                EC.element_to_be_clickable((By.XPATH, XPATH_SUBMIT_BUTTON))
            )
            botao_submit.click()
            
            logger.info("Aguardando carregamento do relatório (12 segundos)...")
            time.sleep(12) 

        except TimeoutException as e:
            logger.error(f"Timeout ao preencher formulário: {e}")
            try:
                screenshot_path = f"screenshot_erro_{codigo_mv}.png" 
                self.driver.save_screenshot(screenshot_path)
                logger.error(f"DEBUG: Screenshot salvo em: {screenshot_path}")
            except Exception as se:
                logger.error(f"Falha ao salvar screenshot: {se}")
            raise e
        except Exception as e:
            logger.error(f"Erro ao preencher formulário: {e}")
            raise e

    def extrair_dados_tabela(self, codigo_mv: str) -> Optional[Dict]:
        """
        Extrai os dados da tabela de produtividade.
        Tenta encontrar a tabela primeiro na página principal, depois em iframes.
        """
        wait = WebDriverWait(self.driver, 30)

        def tentar_extrair_dados() -> Optional[Dict]:
            """Função auxiliar para tentar extrair dados do contexto atual."""
            try:
                # 1. Esperar um pouco mais para garantir que a tabela de resultados carregou
                logger.info("Aguardando 5 segundos adicionais para carregamento completo...")
                time.sleep(5)

                # 2. Procurar todas as tabelas na página
                logger.info("Procurando TODAS as tabelas na página...")
                all_tables = self.driver.find_elements(By.TAG_NAME, "table")
                logger.info(f"Total de tabelas encontradas na página: {len(all_tables)}")

                # 3. Procurar em cada tabela até encontrar uma com o codigo_mv
                for table_idx, table in enumerate(all_tables, 1):
                    try:
                        tbody = table.find_element(By.TAG_NAME, "tbody")
                        rows = tbody.find_elements(By.TAG_NAME, "tr")

                        logger.info(f"Tabela {table_idx}: {len(rows)} linhas encontradas")

                        # Ignorar tabelas com muito poucas linhas (provavelmente formulários)
                        if len(rows) == 0:
                            logger.info(f"  -> Tabela {table_idx} ignorada (sem linhas)")
                            continue

                        # Procurar o codigo_mv nesta tabela
                        for row_idx, row in enumerate(rows, 1):
                            cells = row.find_elements(By.TAG_NAME, "td")
                            if len(cells) > 0:
                                first_cell = cells[0].text.strip()
                                logger.info(f"  -> Tabela {table_idx}, Linha {row_idx}: '{first_cell}' ({len(cells)} células)")

                                # Se encontrou o codigo_mv, esta é a tabela certa!
                                if first_cell == str(codigo_mv):
                                    logger.info(f"[OK] CÓDIGO {codigo_mv} ENCONTRADO na Tabela {table_idx}, Linha {row_idx}!")

                                    # Extrair dados desta linha
                                    def get_cell_text(index: int) -> str:
                                        try:
                                            if index < len(cells):
                                                return cells[index].text.strip()
                                            return "0"
                                        except:
                                            return "0"

                                    # Mapear os dados
                                    dados = {}
                                    dados['codigo_mv'] = get_cell_text(0)
                                    dados['nome'] = get_cell_text(1)
                                    dados['especialidade'] = get_cell_text(2)
                                    dados['vinculo'] = get_cell_text(3)
                                    dados['procedimento'] = self._converter_para_int(get_cell_text(4))
                                    dados['parecer_solicitado'] = self._converter_para_int(get_cell_text(5))
                                    dados['parecer_realizado'] = self._converter_para_int(get_cell_text(6))
                                    dados['cirurgia_realizada'] = self._converter_para_int(get_cell_text(7))
                                    dados['prescricao'] = self._converter_para_int(get_cell_text(8))
                                    dados['evolucao'] = self._converter_para_int(get_cell_text(9))
                                    dados['urgencia'] = self._converter_para_int(get_cell_text(10))
                                    dados['ambulatorio'] = self._converter_para_int(get_cell_text(11))
                                    dados['auxiliar'] = self._converter_para_int(get_cell_text(12))
                                    dados['encaminhamento'] = self._converter_para_int(get_cell_text(13))
                                    dados['folha_objetivo_diario'] = self._converter_para_int(get_cell_text(14))
                                    dados['evolucao_diurna_cti'] = self._converter_para_int(get_cell_text(15))
                                    dados['evolucao_noturna_cti'] = self._converter_para_int(get_cell_text(16))

                                    logger.info(f"[OK] Dados extraídos: {dados['nome']} - Procedimentos: {dados['procedimento']}")
                                    return dados

                    except Exception as e:
                        logger.debug(f"Erro ao processar tabela {table_idx}: {e}")
                        continue

                # Se chegou aqui, não encontrou o código em nenhuma tabela
                logger.error(f"Código {codigo_mv} não encontrado em nenhuma das {len(all_tables)} tabelas")
                return None

            except Exception as e:
                logger.error(f"Erro na função auxiliar de extração: {e}", exc_info=True)
                return None

        try:
            # ESTRATÉGIA 1: Tentar na página principal primeiro
            logger.info("ESTRATÉGIA 1: Tentando extrair dados da página principal...")
            dados = tentar_extrair_dados()

            if dados:
                return dados

            # ESTRATÉGIA 2: Tentar dentro de iframe
            logger.info("ESTRATÉGIA 2: Tentando extrair dados de dentro de iframe...")
            try:
                iframe = wait.until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "iframe[id*='Viewer']"))
                )
                self.driver.switch_to.frame(iframe)
                logger.info("Mudança para iframe bem-sucedida.")

                dados = tentar_extrair_dados()

                self.driver.switch_to.default_content()

                if dados:
                    return dados

            except TimeoutException:
                logger.info("Nenhum iframe encontrado ou timeout ao procurar iframe")
                self.driver.switch_to.default_content()

            # Se chegou aqui, nenhuma estratégia funcionou
            logger.error(f"Não foi possível extrair dados para o código {codigo_mv}")
            try:
                screenshot_path = f"screenshot_linha_nao_encontrada_{codigo_mv}.png"
                self.driver.save_screenshot(screenshot_path)
                logger.error(f"DEBUG: Screenshot salvo em: {screenshot_path}")
            except:
                pass

            return None

        except Exception as e:
            logger.error(f"Erro ao extrair dados da tabela: {e}", exc_info=True)
            try:
                screenshot_path = f"screenshot_erro_{codigo_mv}.png"
                self.driver.save_screenshot(screenshot_path)
                logger.error(f"DEBUG: Screenshot do erro salvo em: {screenshot_path}")
            except:
                pass
            self.driver.switch_to.default_content()
            return None

    def _converter_para_int(self, valor: str) -> int:
        """Converte string para int, retornando 0 se vazio ou inválido."""
        try:
            return int(valor) if valor and valor.strip() else 0
        except ValueError:
            return 0

    def inserir_produtividade(self, dados: Dict, data: str):
        """Insere os dados de produtividade no Supabase."""
        try:
            logger.info(f"Inserindo produtividade para {dados['nome']}...")
            data_obj = datetime.strptime(data, '%d.%m.%Y')
            data_iso = data_obj.strftime('%Y-%m-%d')

            existing = self.supabase.table('produtividade').select('id').eq(
                'codigo_mv', dados['codigo_mv']
            ).eq('data', data_iso).execute()

            data_payload = {
                'nome': dados['nome'],
                'especialidade': dados['especialidade'],
                'vinculo': dados['vinculo'],
                'procedimento': dados['procedimento'],
                'parecer_solicitado': dados['parecer_solicitado'],
                'parecer_realizado': dados['parecer_realizado'],
                'cirurgia_realizada': dados['cirurgia_realizada'],
                'prescricao': dados['prescricao'],
                'evolucao': dados['evolucao'],
                'urgencia': dados['urgencia'],
                'ambulatorio': dados['ambulatorio'],
                'auxiliar': dados['auxiliar'],
                'encaminhamento': dados['encaminhamento'],
                'folha_objetivo_diario': dados['folha_objetivo_diario'],
                'evolucao_diurna_cti': dados['evolucao_diurna_cti'],
                'evolucao_noturna_cti': dados['evolucao_noturna_cti'],
            }

            if existing.data and len(existing.data) > 0:
                logger.info(f"Atualizando registro existente para {dados['nome']}")
                self.supabase.table('produtividade').update(data_payload).eq('id', existing.data[0]['id']).execute()
            else:
                logger.info(f"Inserindo novo registro para {dados['nome']}")
                data_payload['codigo_mv'] = dados['codigo_mv']
                data_payload['data'] = data_iso
                self.supabase.table('produtividade').insert(data_payload).execute()

            logger.info(f"[OK] Produtividade salva com sucesso para {dados['nome']}")

        except Exception as e:
            logger.error(f"Erro ao inserir produtividade: {e}")
            raise

    def processar_usuario(self, usuario: Dict, data: str, index: int, total: int):
        """Processa um único usuário."""
        codigo_mv = usuario['codigomv']
        nome = usuario['nome']

        logger.info(f"\n{'='*70}")
        logger.info(f"Processando [{index}/{total}]: {nome} (Código MV: {codigo_mv})")
        logger.info(f"{'='*70}")

        try:
            logger.info(f"Acessando relatório MV...")
            self.driver.get(MV_REPORT_URL)
            time.sleep(5) # Espera extra para a página instável

            self.preencher_formulario(codigo_mv, data)

            # Tentar método tradicional de scraping diretamente
            logger.info("Extraindo dados da tabela...")
            dados = self.extrair_dados_tabela(codigo_mv)

            if dados:
                self.inserir_produtividade(dados, data)
            else:
                logger.warning(f"Nenhum dado encontrado para {nome}. Marcando como falha.")
                raise Exception(f"Nenhum dado encontrado na tabela para {nome} ({codigo_mv})")

            logger.info("Aguardando 10 segundos antes do próximo usuário...")
            time.sleep(10)

        except Exception as e:
            raise e

    def executar(self):
        """Executa o processo completo de coleta de produtividade."""
        inicio = datetime.now()
        logger.info(f"\n{'#'*70}")
        logger.info(f"INÍCIO DA COLETA DE PRODUTIVIDADE (LOCAL)")
        logger.info(f"Horário: {inicio.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"{'#'*70}\n")

        try:
            self.connect_supabase()
            self.setup_driver()
            self.usuarios_terceiros = self.buscar_usuarios_terceiros()

            if not self.usuarios_terceiros:
                logger.warning("Nenhum usuário terceiro encontrado. Encerrando.")
                return

            data_ontem = self.formatar_data_ontem()
            logger.info(f"Data a ser consultada: {data_ontem}")

            total = len(self.usuarios_terceiros)
            sucesso = 0
            erros = 0

            for index, usuario in enumerate(self.usuarios_terceiros, 1):
                try:
                    self.processar_usuario(usuario, data_ontem, index, total)
                    sucesso += 1
                except Exception as e:
                    logger.error(f"Erro crítico ao processar usuário: {usuario['nome']} - {e}")
                    erros += 1
                    continue 

            # Resumo
            fim = datetime.now()
            duracao = fim - inicio

            logger.info(f"\n{'#'*70}")
            logger.info(f"COLETA DE PRODUTIVIDADE CONCLUÍDA (LOCAL)")
            logger.info(f"{'#'*70}")
            logger.info(f"Horário de término: {fim.strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info(f"Duração: {duracao}")
            logger.info(f"Total de usuários: {total}")
            logger.info(f"Processados com sucesso: {sucesso}")
            logger.info(f"Erros: {erros}")
            logger.info(f"{'#'*70}\n")

        except Exception as e:
            logger.error(f"Erro crítico na execução: {e}", exc_info=True)
            raise

        finally:
            if self.driver:
                logger.info("Fechando navegador...")
                self.driver.quit()


def main():
    """Função principal."""
    collector = ProdutividadeCollector()

    try:
        collector.executar()
    except KeyboardInterrupt:
        logger.info("\nProcesso interrompido pelo usuário")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Erro fatal: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()