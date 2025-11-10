#!/usr/bin/env python3
"""
Script para COLETAR DADOS HISTÓRICOS de produtividade do sistema MV.
Executa UMA ÚNICA VEZ para preencher o banco de dados.
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
        logging.FileHandler('/var/log/produtividade-historico.log'), # Log separado
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
GECKODRIVER_PATH = '/usr/local/bin/geckodriver' 

# XPaths
BASE_CONTAINER = "//div[contains(@id, '_ParametersPanelContainer')]"
XPATH_CODIGO_PRESTADOR = f"{BASE_CONTAINER}//tr[2]/td[2]//input"
XPATH_DATA_INICIAL = f"{BASE_CONTAINER}//tr[1]/td[4]//input"
XPATH_DATA_FINAL = f"{BASE_CONTAINER}//tr[2]/td[4]//input"
XPATH_SUBMIT_BUTTON = f"{BASE_CONTAINER}//tr[4]/td[4]//td[contains(., 'Submit')]" 

class ProdutividadeCollector:
    """Classe para coletar dados de produtividade do MV."""

    def __init__(self):
        """Inicializa o coletor."""
        self.driver = None
        self.supabase = None
        self.usuarios_terceiros = []

    # --- FUNÇÃO ATUALIZADA (v4.2) ---
    def setup_driver(self):
            """Configura o driver do Selenium com Firefox headless."""
            logger.info("Configurando Firefox driver...")

            import os
            # Garante que o DISPLAY não está setado
            if 'DISPLAY' in os.environ:
                logger.warning(f"Removendo variável 'DISPLAY' ({os.environ['DISPLAY']}) para forçar modo headless nativo.")
                del os.environ['DISPLAY']

            # Verificar se geckodriver existe
            import shutil
            global GECKODRIVER_PATH

            if not os.path.exists(GECKODRIVER_PATH):
                logger.error(f"Geckodriver não encontrado em: {GECKODRIVER_PATH}")
                geckodriver_path = shutil.which('geckodriver')
                if geckodriver_path:
                    logger.info(f"Geckodriver encontrado em: {geckodriver_path}")
                    GECKODRIVER_PATH = geckodriver_path
                else:
                    raise FileNotFoundError("Geckodriver não encontrado.")

            options = Options()
            options.add_argument('--headless') 
            options.add_argument('--window-size=1920,1080')
            
            # Desabilita aceleração gráfica (Correção GFX1-)
            options.set_preference("layers.acceleration.disabled", True)
            options.set_preference("gfx.headless.opengl.disabled", True)
            
            # Configurações adicionais para Firefox
            options.set_preference('devtools.console.stdout.content', True)
            options.binary_location = '/usr/bin/firefox' 

            # --- MODIFICAÇÃO (v4.2) ---
            # A linha 'os.environ["MOZ_DBUS_REMOTE"] = "1"' foi REMOVIDA.
            # --- FIM DA MODIFICAÇÃO ---

            # Log de depuração
            logger.info(f"DISPLAY: {os.environ.get('DISPLAY')}")
            logger.info(f"Firefox binary: {options.binary_location}")
            logger.info(f"Geckodriver path: {GECKODRIVER_PATH}")

            service = Service(
                executable_path=GECKODRIVER_PATH,
                log_output='/tmp/geckodriver-historico.log'
            )

            try:
                logger.info("Iniciando Firefox em modo headless nativo (com GPU desabilitada)...")
                self.driver = webdriver.Firefox(service=service, options=options)
                # Timeouts aumentados
                self.driver.set_page_load_timeout(300)
                self.driver.set_script_timeout(300)
                self.driver.set_page_load_timeout(60)

                logger.info("Firefox driver configurado com sucesso")
            except Exception as e:
                logger.error(f"Erro ao configurar Firefox driver: {e}")
                logger.error("=" * 70)
                logger.error("DIAGNÓSTICO:")
                logger.error(f"  1. Verifique se as libs foram instaladas (libgtk-3-0, libglib2.0-0, etc).")
                logger.error(f"  2. Ver logs: cat /tmp/geckodriver-historico.log")
                logger.error("=" * 70)
                raise
    # --- FIM DA FUNÇÃO ATUALIZADA ---

    def connect_supabase(self):
        """Conecta ao Supabase."""
        logger.info("Conectando ao Supabase...")

        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise ValueError("VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY são obrigatórios")

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

    def gerar_intervalo_datas(self) -> List[str]:
        """
        Gera uma lista de datas (string) de 01/09/2025 até ontem.
        Retorna no formato americano mm.dd.yyyy (com pontos).
        """
        logger.info("Gerando intervalo de datas...")
        datas_formatadas = []
        
        try:
            data_inicio = datetime(2025, 9, 1)
            data_fim = datetime.now() - timedelta(days=1) # Ontem
        except ValueError as e:
            logger.error(f"Erro ao definir datas. A data atual é anterior a 01/09/2025? Erro: {e}")
            return []

        data_atual = data_inicio
        while data_atual <= data_fim:
            # Formato americano: mm.dd.yyyy
            datas_formatadas.append(data_atual.strftime('%m.%d.%Y'))
            data_atual += timedelta(days=1)
            
        logger.info(f"Total de {len(datas_formatadas)} dias a processar (de {data_inicio.strftime('%Y-%m-%d')} a {data_fim.strftime('%Y-%m-%d')})")
        return datas_formatadas

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
            logger.info(f"Preenchendo data inicial: {data} (formato mm.dd.yyyy)")
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
            logger.info(f"Preenchendo data final: {data} (formato mm.dd.yyyy)")
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

            # Aguardar carregamento do relatório
            logger.info("Aguardando carregamento do relatório (12 segundos)...")
            time.sleep(12)

        except TimeoutException as e:
            logger.error(f"Timeout ao preencher formulário: {e.msg}")
            try:
                screenshot_path = f"/tmp/screenshot_erro_{codigo_mv}_{data}.png"
                self.driver.save_screenshot(screenshot_path)
                logger.error(f"DEBUG: Screenshot salvo em: {screenshot_path}")
            except Exception as se:
                logger.error(f"Falha ao salvar screenshot: {se}")
            raise e
        except Exception as e:
            logger.error(f"Erro ao preencher formulário: {e}")
            raise e

    def extrair_dados_tabela(self, codigo_mv: str, data: str) -> Optional[Dict]:
        """
        Extrai os dados da tabela de produtividade.
        """
        wait = WebDriverWait(self.driver, 30)

        def tentar_extrair_dados() -> Optional[Dict]:
            """Função auxiliar para tentar extrair dados do contexto atual."""
            try:
                logger.info("Aguardando 5 segundos adicionais para carregamento completo...")
                time.sleep(5)

                logger.info("Procurando TODAS as tabelas na página...")
                all_tables = self.driver.find_elements(By.TAG_NAME, "table")
                logger.info(f"Total de tabelas encontradas na página: {len(all_tables)}")

                for table_idx, table in enumerate(all_tables, 1):
                    try:
                        tbody = table.find_element(By.TAG_NAME, "tbody")
                        rows = tbody.find_elements(By.TAG_NAME, "tr")

                        logger.info(f"Tabela {table_idx}: {len(rows)} linhas encontradas")

                        if len(rows) == 0:
                            logger.info(f"  -> Tabela {table_idx} ignorada (sem linhas)")
                            continue

                        for row_idx, row in enumerate(rows, 1):
                            cells = row.find_elements(By.TAG_NAME, "td")
                            if len(cells) > 0:
                                first_cell = cells[0].text.strip()
                                logger.info(f"  -> Tabela {table_idx}, Linha {row_idx}: '{first_cell}' ({len(cells)} células)")

                                if first_cell == str(codigo_mv):
                                    logger.info(f"[OK] CÓDIGO {codigo_mv} ENCONTRADO na Tabela {table_idx}, Linha {row_idx}!")

                                    def get_cell_text(index: int) -> str:
                                        try:
                                            if index < len(cells):
                                                return cells[index].text.strip()
                                            return "0"
                                        except:
                                            return "0"

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

                logger.error(f"Código {codigo_mv} não encontrado em nenhuma das {len(all_tables)} tabelas")
                return None

            except Exception as e:
                logger.error(f"Erro na função auxiliar de extração: {e}", exc_info=True)
                return None

        try:
            logger.info("ESTRATÉGIA 1: Tentando extrair dados da página principal...")
            dados = tentar_extrair_dados()

            if dados:
                return dados

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

            logger.error(f"Não foi possível extrair dados para o código {codigo_mv} na data {data}")
            try:
                screenshot_path = f"/tmp/screenshot_linha_nao_encontrada_{codigo_mv}_{data}.png"
                self.driver.save_screenshot(screenshot_path)
                logger.error(f"DEBUG: Screenshot salvo em: {screenshot_path}")
            except:
                pass

            return None

        except Exception as e:
            logger.error(f"Erro ao extrair dados da tabela: {e}", exc_info=True)
            try:
                screenshot_path = f"/tmp/screenshot_erro_extracao_{codigo_mv}_{data}.png"
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
        """
        Insere ou ATUALIZA (Upsert) os dados de produtividade no Supabase.
        """
        try:
            logger.info(f"Inserindo/Atualizando produtividade para {dados['nome']}...")

            data_obj = datetime.strptime(data, '%m.%d.%Y')
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
                logger.info(f"Atualizando registro existente para {dados['nome']} em {data_iso}")
                self.supabase.table('produtividade').update(data_payload).eq('id', existing.data[0]['id']).execute()
            else:
                logger.info(f"Inserindo novo registro para {dados['nome']} em {data_iso}")
                data_payload['codigo_mv'] = dados['codigo_mv']
                data_payload['data'] = data_iso
                self.supabase.table('produtividade').insert(data_payload).execute()

            logger.info(f"[OK] Produtividade salva com sucesso para {dados['nome']} em {data_iso}")

        except Exception as e:
            logger.error(f"Erro ao inserir produtividade: {e}")
            raise

    def processar_consulta(self, usuario: Dict, data: str, consulta_num: int, total_consultas: int, tentativa: int, max_tentativas: int):
        """Processa uma única consulta (usuário + data)."""
        codigo_mv = usuario['codigomv']
        nome = usuario['nome']

        logger.info(f"\n{'='*70}")
        logger.info(f"Processando Consulta [{consulta_num}/{total_consultas}] (Tentativa {tentativa}/{max_tentativas})")
        logger.info(f"Usuário: {nome} (MV: {codigo_mv}) | Data: {data}")
        logger.info(f"{'='*70}")

        try:
            logger.info(f"Acessando relatório MV...")
            self.driver.get(MV_REPORT_URL)
            time.sleep(5) 

            self.preencher_formulario(codigo_mv, data)

            logger.info("Extraindo dados da tabela...")
            dados = self.extrair_dados_tabela(codigo_mv, data)

            if dados:
                self.inserir_produtividade(dados, data)
            else:
                logger.warning(f"Nenhum dado encontrado para {nome} na data {data}.")
                raise Exception(f"Nenhum dado encontrado na tabela para {nome} ({codigo_mv}) em {data}")

        except Exception as e:
            raise e 

    def executar(self):
        """Executa o processo completo de coleta de produtividade."""
        inicio = datetime.now()
        logger.info(f"\n{'#'*70}")
        logger.info(f"INÍCIO DA COLETA HISTÓRICA DE PRODUTIVIDADE")
        logger.info(f"Horário: {inicio.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"{'#'*70}\n")
        
        MAX_TENTATIVAS = 5

        try:
            # Setup
            self.connect_supabase()
            self.setup_driver()

            # Buscar usuários
            self.usuarios_terceiros = self.buscar_usuarios_terceiros()
            
            # Gerar intervalo de datas
            datas_a_processar = self.gerar_intervalo_datas()

            if not self.usuarios_terceiros or not datas_a_processar:
                logger.warning("Nenhum usuário ou nenhuma data para processar. Encerrando.")
                return

            # Processar cada usuário para cada dia
            total_usuarios = len(self.usuarios_terceiros)
            total_datas = len(datas_a_processar)
            total_consultas = total_usuarios * total_datas
            
            logger.info(f"Iniciando processamento histórico...")
            logger.info(f"Total de usuários a processar: {total_usuarios}")
            logger.info(f"Total de dias por usuário: {total_datas}")
            logger.info(f"Total de consultas (Usuários * Dias): {total_consultas}")
            logger.info(f"Máximo de tentativas por consulta: {MAX_TENTATIVAS}")

            sucesso = 0
            erros = 0
            consulta_atual = 0

            for index_usr, usuario in enumerate(self.usuarios_terceiros, 1):
                nome_usuario = usuario.get('nome', 'N/A')
                
                for index_data, data_str in enumerate(datas_a_processar, 1):
                    consulta_atual += 1
                    sucesso_na_data = False 

                    # Loop de Tentativas
                    for tentativa in range(1, MAX_TENTATIVAS + 1):
                        try:
                            self.processar_consulta(
                                usuario, data_str, consulta_atual, total_consultas,
                                tentativa, MAX_TENTATIVAS
                            )
                            
                            sucesso += 1
                            sucesso_na_data = True
                            break # Sai do loop de tentativas

                        except Exception as e:
                            logger.warning(f"FALHA na Tentativa {tentativa}/{MAX_TENTATIVAS} (Consulta {consulta_atual})")
                            logger.warning(f"Usuário: {nome_usuario}, Data: {data_str}")
                            try:
                                logger.warning(f"Erro: {e.msg.splitlines()[0] if hasattr(e, 'msg') else str(e).splitlines()[0]}")
                            except:
                                logger.warning(f"Erro: {e}")
                            
                            if tentativa == MAX_TENTATIVAS:
                                logger.error(f"ERRO CRÍTICO: Consulta {consulta_atual} ({nome_usuario} | {data_str}) falhou após {MAX_TENTATIVAS} tentativas.")
                                erros += 1
                            else:
                                logger.info(f"Aguardando 10s antes de tentar novamente...")
                                time.sleep(10)
                    
                    # Pausa de 15s ENTRE DIAS (apenas se sucesso)
                    if sucesso_na_data and (index_data < total_datas): 
                        logger.info(f"Consulta bem-sucedida. Aguardando 15s para a próxima data do usuário {nome_usuario}...")
                        time.sleep(15)
                
                # Pausa de 10s ENTRE USUÁRIOS
                if index_usr < total_usuarios:
                    logger.info(f"Processamento do usuário {nome_usuario} concluído. Aguardando 10s para o próximo usuário...")
                    time.sleep(10)

            # Resumo
            fim = datetime.now()
            duracao = fim - inicio

            logger.info(f"\n{'#'*70}")
            logger.info(f"COLETA HISTÓRICA CONCLUÍDA")
            logger.info(f"{'#'*70}")
            logger.info(f"Horário de término: {fim.strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info(f"Duração: {duracao}")
            logger.info(f"Total de consultas planejadas: {total_consultas}")
            logger.info(f"Consultas com sucesso: {sucesso}")
            logger.info(f"Consultas com erro (após {MAX_TENTATIVAS} tentativas): {erros}")
            logger.info(f"{'#'*70}\n")

        except Exception as e:
            logger.error(f"Erro crítico na execução: {e}", exc_info=True)
            raise

        finally:
            # Cleanup
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