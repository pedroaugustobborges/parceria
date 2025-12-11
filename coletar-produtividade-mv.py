"""
Script para coletar dados de produtividade do sistema MV e inserir na tabela produtividade.
Executa automaticamente via cron às 2h da manhã.

Este script:
1. Busca todos os usuários tipo "terceiro" com codigomv
2. Para cada um, acessa o relatório MV de produtividade
3. Extrai os dados da tabela
4. Insere na tabela produtividade do Supabase
"""

import os
import sys
import time
import random
import glob
import signal
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
from supabase import create_client, Client
from dotenv import load_dotenv
import logging
from functools import wraps

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/produtividade-mv.log'),
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
GECKODRIVER_PATH = '/usr/local/bin/geckodriver'  # Ajustar conforme instalação no droplet

# Configurações de Resiliência e Escalabilidade
MAX_RETRIES = 3  # Número máximo de tentativas por usuário
INITIAL_RETRY_DELAY = 5  # Delay inicial para retry (segundos)
MAX_RETRY_DELAY = 60  # Delay máximo para retry (segundos)
DRIVER_RESTART_INTERVAL = 50  # Reiniciar driver a cada N usuários (previne "200 Wall")
CONSECUTIVE_FAILURE_THRESHOLD = 5  # Pausar e reiniciar driver após N falhas consecutivas
MIN_DELAY_BETWEEN_REQUESTS = 8  # Delay mínimo entre requisições (segundos)
MAX_DELAY_BETWEEN_REQUESTS = 15  # Delay máximo entre requisições (segundos)
SCREENSHOT_RETENTION_DAYS = 7  # Dias para manter screenshots antigos

# User Agents para rotação (aparentar navegação normal)
USER_AGENTS = [
    'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/116.0',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
]

# --- XPaths do Formulário (Melhorados - Mais Flexíveis) ---
BASE_CONTAINER = "//div[contains(@id, '_ParametersPanelContainer')]"
XPATH_CODIGO_PRESTADOR = f"{BASE_CONTAINER}//tr[2]/td[2]//input"
XPATH_DATA_INICIAL = f"{BASE_CONTAINER}//tr[1]/td[4]//input"
XPATH_DATA_FINAL = f"{BASE_CONTAINER}//tr[2]/td[4]//input"
XPATH_SUBMIT_BUTTON = f"{BASE_CONTAINER}//tr[4]/td[4]//td[contains(., 'Submit')]"  # Firefox em inglês no droplet


# ============================================================================
# UTILITÁRIOS DE RESILIÊNCIA
# ============================================================================

class TimeoutError(Exception):
    """Exceção customizada para timeout."""
    pass


def timeout_handler(signum, frame):
    """Handler para timeout de operações."""
    raise TimeoutError("Operação excedeu o tempo limite")


def cleanup_old_screenshots(retention_days: int = SCREENSHOT_RETENTION_DAYS):
    """Remove screenshots antigos para evitar acúmulo de arquivos."""
    try:
        cutoff_time = time.time() - (retention_days * 24 * 60 * 60)
        screenshot_pattern = "/tmp/screenshot_*.png"

        for filepath in glob.glob(screenshot_pattern):
            if os.path.getmtime(filepath) < cutoff_time:
                os.remove(filepath)
                logger.debug(f"Screenshot antigo removido: {filepath}")
    except Exception as e:
        logger.warning(f"Erro ao limpar screenshots antigos: {e}")


def random_delay(min_seconds: int = MIN_DELAY_BETWEEN_REQUESTS,
                 max_seconds: int = MAX_DELAY_BETWEEN_REQUESTS):
    """Aguarda um tempo aleatório para simular comportamento humano."""
    delay = random.uniform(min_seconds, max_seconds)
    logger.debug(f"Aguardando {delay:.2f} segundos...")
    time.sleep(delay)


def retry_with_exponential_backoff(max_retries: int = MAX_RETRIES,
                                   initial_delay: int = INITIAL_RETRY_DELAY,
                                   max_delay: int = MAX_RETRY_DELAY,
                                   refresh_page_on_retry: bool = True):
    """
    Decorator que implementa retry com exponential backoff.

    Args:
        max_retries: Número máximo de tentativas
        initial_delay: Delay inicial em segundos
        max_delay: Delay máximo em segundos
        refresh_page_on_retry: Se True, recarrega a página antes de cada retry
    """
    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            delay = initial_delay
            last_exception = None

            for attempt in range(1, max_retries + 1):
                try:
                    return func(self, *args, **kwargs)
                except (TimeoutException, WebDriverException, Exception) as e:
                    last_exception = e

                    if attempt == max_retries:
                        logger.error(f"Falha após {max_retries} tentativas: {e}")
                        raise

                    # Calcular delay com jitter
                    jitter = random.uniform(0, 0.3 * delay)
                    wait_time = min(delay + jitter, max_delay)

                    logger.warning(
                        f"⚠️  Tentativa {attempt}/{max_retries} falhou. "
                        f"Aguardando {wait_time:.1f}s antes de tentar novamente..."
                    )

                    # IMPORTANTE: Recarregar URL completo antes do retry (não apenas refresh)
                    if refresh_page_on_retry and hasattr(self, 'driver') and self.driver:
                        try:
                            logger.info("🔄 Navegando para URL inicial antes do retry...")

                            # Pegar a URL atual para determinar se devemos voltar
                            current_url = self.driver.current_url

                            # Se estamos no relatório MV, navegar novamente
                            if 'mvpepprd.saude.go.gov.br' in current_url or 'report' in current_url:
                                # Pegar MV_REPORT_URL do escopo global
                                report_url = "http://mvpepprd.saude.go.gov.br/report-executor/report-viewer?id=7076"
                                self.driver.get(report_url)
                                logger.info("URL recarregado completamente")
                                time.sleep(random.uniform(3, 5))

                            # Tentar fechar qualquer alert/popup
                            try:
                                alert = self.driver.switch_to.alert
                                alert.dismiss()
                                logger.info("Alert/popup fechado")
                            except:
                                pass

                            # Voltar para o contexto principal
                            try:
                                self.driver.switch_to.default_content()
                            except:
                                pass

                        except Exception as refresh_error:
                            logger.warning(f"Erro ao recarregar página: {refresh_error}")

                    time.sleep(wait_time)

                    # Exponential backoff
                    delay = min(delay * 2, max_delay)

            # Não deve chegar aqui, mas por segurança
            raise last_exception

        return wrapper
    return decorator


class ProdutividadeCollector:
    """Classe para coletar dados de produtividade do MV."""

    def __init__(self):
        """Inicializa o coletor."""
        self.driver = None
        self.supabase = None
        self.usuarios_terceiros = []
        self.consecutive_failures = 0  # Contador para circuit breaker
        self.processed_count = 0  # Contador para reinício periódico do driver
        self.current_user_agent = random.choice(USER_AGENTS)  # User agent aleatório

    def setup_driver(self, restart: bool = False):
        """
        Configura o driver do Selenium com Firefox headless.

        Args:
            restart: Se True, fecha o driver existente antes de criar um novo
        """
        if restart and self.driver:
            logger.info("Reiniciando driver - fechando instância anterior...")
            try:
                self.driver.quit()
            except Exception as e:
                logger.warning(f"Erro ao fechar driver anterior: {e}")
            self.driver = None
            time.sleep(3)  # Aguardar cleanup completo

        logger.info(f"Configurando Firefox driver (User-Agent: {self.current_user_agent[:50]}...)...")

        # Verificar se geckodriver existe
        import shutil
        global GECKODRIVER_PATH

        if not os.path.exists(GECKODRIVER_PATH):
            logger.error(f"Geckodriver não encontrado em: {GECKODRIVER_PATH}")
            # Tentar encontrar geckodriver no PATH
            geckodriver_path = shutil.which('geckodriver')
            if geckodriver_path:
                logger.info(f"Geckodriver encontrado em: {geckodriver_path}")
                GECKODRIVER_PATH = geckodriver_path
            else:
                raise FileNotFoundError("Geckodriver não encontrado. Instale com: https://github.com/mozilla/geckodriver/releases")

        options = Options()

        # Argumentos críticos para headless Linux
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--disable-software-rasterizer')
        options.add_argument('--window-size=1920,1080')

        # Argumentos adicionais para prevenir travamentos
        options.add_argument('--disable-extensions')
        options.add_argument('--disable-infobars')
        options.add_argument('--disable-notifications')
        options.add_argument('--disable-crash-reporter')

        # Configurações de performance e stealth
        options.set_preference('devtools.console.stdout.content', True)
        options.set_preference('general.useragent.override', self.current_user_agent)

        # FIX: Marionette protocol (corrige erro "Failed to decode response from marionette")
        options.set_preference('marionette.port', 2828)
        options.set_preference('marionette.log.level', 'Info')
        options.set_preference('remote.log.level', 'Info')

        # Otimizações de memória
        options.set_preference('browser.cache.disk.enable', False)
        options.set_preference('browser.cache.memory.enable', True)
        options.set_preference('browser.cache.offline.enable', False)
        options.set_preference('network.http.use-cache', False)

        # Desabilitar recursos desnecessários
        options.set_preference('browser.tabs.remote.autostart', False)
        options.set_preference('browser.tabs.remote.autostart.2', False)
        options.set_preference('media.peerconnection.enabled', False)
        options.set_preference('media.navigator.enabled', False)
        options.set_preference('geo.enabled', False)

        # Timeouts
        options.set_preference('http.response.timeout', 90)
        options.set_preference('dom.max_script_run_time', 90)

        # Verificar se Firefox existe antes de setar binary_location
        firefox_paths = ['/usr/bin/firefox', '/usr/bin/firefox-esr', '/snap/bin/firefox']
        firefox_binary = None
        for path in firefox_paths:
            if os.path.exists(path):
                firefox_binary = path
                break

        if firefox_binary:
            options.binary_location = firefox_binary
            logger.info(f"Firefox binary encontrado: {firefox_binary}")
        else:
            logger.warning("Firefox binary não encontrado em locais padrão")

        # Log de depuração
        logger.info(f"DISPLAY: {os.environ.get('DISPLAY')}")
        logger.info(f"Firefox binary: {options.binary_location if hasattr(options, 'binary_location') else 'default'}")
        logger.info(f"Geckodriver path: {GECKODRIVER_PATH}")

        # Matar processos Firefox/Geckodriver travados
        logger.info("Verificando processos Firefox/Geckodriver travados...")
        try:
            import subprocess
            subprocess.run("pkill -9 firefox 2>/dev/null || true", shell=True, timeout=5)
            subprocess.run("pkill -9 geckodriver 2>/dev/null || true", shell=True, timeout=5)
            time.sleep(2)
            logger.info("Processos antigos limpos")
        except Exception:
            pass

        service = Service(
            executable_path=GECKODRIVER_PATH,
            log_output='/tmp/geckodriver.log'
        )

        try:
            logger.info("Iniciando Firefox em modo headless (timeout: 60s)...")

            # Configurar timeout para inicialização do driver
            if sys.platform != 'win32':  # Timeout só funciona em Unix
                signal.signal(signal.SIGALRM, timeout_handler)
                signal.alarm(60)  # 60 segundos para iniciar

            try:
                self.driver = webdriver.Firefox(service=service, options=options)

                if sys.platform != 'win32':
                    signal.alarm(0)  # Cancelar alarme

                self.driver.set_page_load_timeout(90)
                self.driver.implicitly_wait(5)

                logger.info("✅ Firefox driver configurado com sucesso")

            except TimeoutError:
                logger.error("❌ TIMEOUT: Firefox não iniciou em 60 segundos")
                logger.error("Isso geralmente indica:")
                logger.error("  1. Firefox não está instalado corretamente")
                logger.error("  2. Dependências faltando (libgtk-3-0, libdbus-glib-1-2, etc)")
                logger.error("  3. Versão incompatível entre Firefox e Geckodriver")
                logger.error("")
                logger.error("Execute o diagnóstico: python3 diagnose-firefox.py")
                raise

        except Exception as e:
            if sys.platform != 'win32':
                signal.alarm(0)  # Cancelar alarme em caso de erro

            logger.error(f"❌ Erro ao configurar Firefox driver: {e}")
            logger.error("=" * 70)
            logger.error("DIAGNÓSTICO RÁPIDO:")
            logger.error(f"  1. Firefox instalado? Execute: firefox --version")
            logger.error(f"  2. Geckodriver OK? Execute: {GECKODRIVER_PATH} --version")
            logger.error(f"  3. Ver logs: cat /tmp/geckodriver.log")
            logger.error(f"  4. Executar diagnóstico completo: python3 diagnose-firefox.py")
            logger.error("=" * 70)

            # Tentar ler logs do geckodriver
            if os.path.exists('/tmp/geckodriver.log'):
                try:
                    with open('/tmp/geckodriver.log', 'r') as f:
                        gecko_logs = f.read()
                        if gecko_logs:
                            logger.error("ÚLTIMAS LINHAS DO GECKODRIVER LOG:")
                            for line in gecko_logs.split('\n')[-10:]:
                                if line.strip():
                                    logger.error(f"  {line}")
                except Exception:
                    pass

            # Matar processos travados
            try:
                import subprocess
                subprocess.run("pkill -9 firefox", shell=True, timeout=5)
                subprocess.run("pkill -9 geckodriver", shell=True, timeout=5)
            except Exception:
                pass

            raise

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

    def clear_browser_data(self):
        """Limpa cookies e cache do navegador para evitar acúmulo."""
        if not self.driver:
            return

        try:
            logger.debug("Limpando cookies e cache do navegador...")
            self.driver.delete_all_cookies()

            # Limpar localStorage e sessionStorage via JavaScript
            try:
                self.driver.execute_script("window.localStorage.clear();")
                self.driver.execute_script("window.sessionStorage.clear();")
            except Exception:
                pass  # Pode falhar se não houver página carregada

            logger.debug("Browser data limpo com sucesso")
        except Exception as e:
            logger.warning(f"Erro ao limpar browser data: {e}")

    def should_restart_driver(self) -> bool:
        """
        Verifica se o driver deve ser reiniciado.

        Reinicia o driver a cada DRIVER_RESTART_INTERVAL usuários processados
        para prevenir o "200 Wall".
        """
        return self.processed_count > 0 and self.processed_count % DRIVER_RESTART_INTERVAL == 0

    def handle_consecutive_failures(self):
        """
        Implementa circuit breaker pattern.

        Se muitas falhas consecutivas ocorrem, pausa e reinicia o driver.
        """
        if self.consecutive_failures >= CONSECUTIVE_FAILURE_THRESHOLD:
            logger.warning(
                f"⚠️  CIRCUIT BREAKER: {self.consecutive_failures} falhas consecutivas detectadas. "
                f"Pausando por 30s e reiniciando driver..."
            )

            time.sleep(30)  # Pausa mais longa para "esfriar"
            self.setup_driver(restart=True)
            self.current_user_agent = random.choice(USER_AGENTS)  # Novo User-Agent
            self.consecutive_failures = 0  # Reset contador

            logger.info("Circuit breaker: Driver reiniciado com novo User-Agent")

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
        """Retorna a data de ontem no formato mm.dd.yyyy (com pontos) - formato americano."""
        ontem = datetime.now() - timedelta(days=1)
        return ontem.strftime('%m.%d.%Y')  # Formato americano: mm.dd.yyyy

    @retry_with_exponential_backoff()
    def preencher_formulario(self, codigo_mv: str, data: str):
        """Preenche o formulário do relatório MV com retry automático e refresh."""
        wait = WebDriverWait(self.driver, 30)  # Aumentado de 25 para 30

        try:
            # Aguardar a página carregar completamente
            logger.info(f"Aguardando página carregar completamente...")
            time.sleep(random.uniform(2, 4))

            # Fechar qualquer alert que possa estar aberto
            try:
                alert = self.driver.switch_to.alert
                alert.dismiss()
                logger.info("Alert encontrado e fechado")
                time.sleep(1)
            except:
                pass

            # Campo Código Prestador
            logger.info(f"Preenchendo código MV: {codigo_mv}")
            try:
                campo_codigo = wait.until(
                    EC.presence_of_element_located((By.XPATH, XPATH_CODIGO_PRESTADOR))
                )
                campo_codigo.clear()
                campo_codigo.send_keys(codigo_mv)
                time.sleep(random.uniform(1.5, 3))
            except TimeoutException:
                logger.error("❌ Campo Código Prestador não encontrado")
                raise

            # Campo Data Inicial
            logger.info(f"Preenchendo data inicial: {data} (formato mm.dd.yyyy)")
            try:
                campo_data_inicial = wait.until(
                    EC.presence_of_element_located((By.XPATH, XPATH_DATA_INICIAL))
                )
                logger.info("Limpando campo data inicial (Ctrl+A + Backspace)...")
                campo_data_inicial.send_keys(Keys.CONTROL + "a")
                campo_data_inicial.send_keys(Keys.BACKSPACE)
                time.sleep(random.uniform(0.8, 1.5))
                campo_data_inicial.send_keys(data)
                time.sleep(random.uniform(1.5, 3))
            except TimeoutException:
                logger.error("❌ Campo Data Inicial não encontrado")
                raise

            # Campo Data Final
            logger.info(f"Preenchendo data final: {data} (formato mm.dd.yyyy)")
            try:
                campo_data_final = wait.until(
                    EC.presence_of_element_located((By.XPATH, XPATH_DATA_FINAL))
                )
                logger.info("Limpando campo data final (Ctrl+A + Backspace)...")
                campo_data_final.send_keys(Keys.CONTROL + "a")
                campo_data_final.send_keys(Keys.BACKSPACE)
                time.sleep(random.uniform(0.8, 1.5))
                campo_data_final.send_keys(data)
                time.sleep(random.uniform(1.5, 3))
            except TimeoutException:
                logger.error("❌ Campo Data Final não encontrado")
                raise

            # Clicar no botão Submit - com múltiplas estratégias
            logger.info("Procurando botão Submit...")

            # Estratégia 1: XPath original
            try:
                botao_submit = wait.until(
                    EC.element_to_be_clickable((By.XPATH, XPATH_SUBMIT_BUTTON))
                )
                logger.info("✅ Botão Submit encontrado (XPath)")
            except TimeoutException:
                # Estratégia 2: Tentar encontrar qualquer botão com texto "Submit"
                logger.warning("Tentando estratégia alternativa para encontrar Submit...")
                try:
                    botao_submit = wait.until(
                        EC.element_to_be_clickable((By.XPATH, "//td[contains(text(), 'Submit')]"))
                    )
                    logger.info("✅ Botão Submit encontrado (texto)")
                except TimeoutException:
                    # Estratégia 3: Procurar input type=submit
                    logger.warning("Tentando encontrar input[type=submit]...")
                    try:
                        botao_submit = wait.until(
                            EC.element_to_be_clickable((By.XPATH, "//input[@type='submit']"))
                        )
                        logger.info("✅ Botão Submit encontrado (input)")
                    except TimeoutException:
                        logger.error("❌ Botão Submit não encontrado em nenhuma estratégia")
                        raise

            logger.info("Clicando no botão Submit...")
            botao_submit.click()

            # Aguardar carregamento do relatório com delay variável
            delay = random.uniform(12, 18)  # Aumentado para dar mais tempo
            logger.info(f"Aguardando carregamento do relatório ({delay:.1f} segundos)...")
            time.sleep(delay)

        except TimeoutException as e:
            logger.error(f"❌ Timeout ao preencher formulário: {str(e)[:200]}")
            try:
                screenshot_path = f"/tmp/screenshot_erro_{codigo_mv}_{int(time.time())}.png"
                self.driver.save_screenshot(screenshot_path)
                logger.error(f"📸 Screenshot salvo em: {screenshot_path}")

                # Log do HTML da página para debug
                try:
                    page_source = self.driver.page_source[:1000]
                    logger.error(f"HTML (primeiros 1000 chars): {page_source}")
                except:
                    pass
            except Exception as se:
                logger.error(f"Falha ao salvar screenshot: {se}")
            raise e
        except Exception as e:
            logger.error(f"❌ Erro inesperado ao preencher formulário: {e}")
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
                screenshot_path = f"/tmp/screenshot_linha_nao_encontrada_{codigo_mv}.png"
                self.driver.save_screenshot(screenshot_path)
                logger.error(f"DEBUG: Screenshot salvo em: {screenshot_path}")
            except:
                pass

            return None

        except Exception as e:
            logger.error(f"Erro ao extrair dados da tabela: {e}", exc_info=True)
            try:
                screenshot_path = f"/tmp/screenshot_erro_{codigo_mv}.png"
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

            # Converter data de mm.dd.yyyy para yyyy-MM-dd
            data_obj = datetime.strptime(data, '%m.%d.%Y')
            data_iso = data_obj.strftime('%Y-%m-%d')

            # Verificar se já existe registro para este código MV e data
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
        """
        Processa um único usuário com resiliência.

        Implementa:
        - Reinício periódico do driver (previne "200 Wall")
        - Circuit breaker para falhas consecutivas
        - Limpeza de dados do navegador
        - Delays aleatórios
        """
        codigo_mv = usuario['codigomv']
        nome = usuario['nome']

        logger.info(f"\n{'='*70}")
        logger.info(f"Processando [{index}/{total}]: {nome} (Código MV: {codigo_mv})")
        logger.info(f"Processed count: {self.processed_count} | Consecutive failures: {self.consecutive_failures}")
        logger.info(f"{'='*70}")

        try:
            # 1. Verificar se precisa reiniciar driver (previne "200 Wall")
            if self.should_restart_driver():
                logger.warning(
                    f"🔄 Reiniciando driver após {self.processed_count} processamentos "
                    f"(intervalo: {DRIVER_RESTART_INTERVAL})"
                )
                self.clear_browser_data()
                self.setup_driver(restart=True)
                self.current_user_agent = random.choice(USER_AGENTS)  # Novo User-Agent

            # 2. Verificar circuit breaker
            self.handle_consecutive_failures()

            # 3. Limpar browser data periodicamente (a cada 10 usuários)
            if self.processed_count > 0 and self.processed_count % 10 == 0:
                logger.debug("Limpando browser data (cookies, cache)...")
                self.clear_browser_data()

            # 4. Acessar relatório com delay inicial variável
            logger.info(f"Acessando relatório MV...")
            self.driver.get(MV_REPORT_URL)
            time.sleep(random.uniform(4, 7))  # Delay variável

            # 5. Preencher formulário (com retry automático via decorator)
            # O decorator já faz refresh automático em caso de falha
            self.preencher_formulario(codigo_mv, data)

            # 6. Extrair dados
            logger.info("Extraindo dados da tabela...")
            dados = self.extrair_dados_tabela(codigo_mv)

            if dados:
                self.inserir_produtividade(dados, data)

                # SUCESSO: resetar contador de falhas consecutivas
                self.consecutive_failures = 0
            else:
                logger.warning(f"Nenhum dado encontrado para {nome}. Marcando como falha.")
                raise Exception(f"Nenhum dado encontrado na tabela para {nome} ({codigo_mv})")

            # 7. Incrementar contador de processados
            self.processed_count += 1

            # 8. Delay aleatório antes do próximo usuário (stealth)
            random_delay()

        except Exception as e:
            # Incrementar contador de falhas consecutivas
            self.consecutive_failures += 1
            logger.error(f"❌ Erro ao processar usuário (falha #{self.consecutive_failures}): {e}")
            raise e

    def executar(self):
        """Executa o processo completo de coleta de produtividade com resiliência."""
        inicio = datetime.now()
        logger.info(f"\n{'#'*70}")
        logger.info(f"INÍCIO DA COLETA DE PRODUTIVIDADE (Versão Otimizada)")
        logger.info(f"Horário: {inicio.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"{'#'*70}")
        logger.info(f"Configurações de Resiliência:")
        logger.info(f"  - Max retries: {MAX_RETRIES}")
        logger.info(f"  - Driver restart interval: {DRIVER_RESTART_INTERVAL}")
        logger.info(f"  - Consecutive failure threshold: {CONSECUTIVE_FAILURE_THRESHOLD}")
        logger.info(f"  - Delay between requests: {MIN_DELAY_BETWEEN_REQUESTS}-{MAX_DELAY_BETWEEN_REQUESTS}s")
        logger.info(f"{'#'*70}\n")

        try:
            # Limpar screenshots antigos
            logger.info("Limpando screenshots antigos...")
            cleanup_old_screenshots()

            # Setup
            self.connect_supabase()
            self.setup_driver()

            # Buscar usuários
            self.usuarios_terceiros = self.buscar_usuarios_terceiros()

            if not self.usuarios_terceiros:
                logger.warning("Nenhum usuário terceiro encontrado. Encerrando.")
                return

            # Data de ontem
            data_ontem = self.formatar_data_ontem()
            logger.info(f"Data a ser consultada: {data_ontem}")

            # Processar cada usuário
            total = len(self.usuarios_terceiros)
            sucesso = 0
            erros = 0

            for index, usuario in enumerate(self.usuarios_terceiros, 1):
                try:
                    self.processar_usuario(usuario, data_ontem, index, total)
                    sucesso += 1
                except Exception as e:
                    logger.error(f"Erro crítico ao processar usuário: {e}")
                    erros += 1
                    continue

            # Resumo
            fim = datetime.now()
            duracao = fim - inicio
            taxa_sucesso = (sucesso / total * 100) if total > 0 else 0

            logger.info(f"\n{'#'*70}")
            logger.info(f"COLETA DE PRODUTIVIDADE CONCLUÍDA")
            logger.info(f"{'#'*70}")
            logger.info(f"Horário de término: {fim.strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info(f"Duração: {duracao}")
            logger.info(f"")
            logger.info(f"Estatísticas:")
            logger.info(f"  - Total de usuários: {total}")
            logger.info(f"  - Processados com sucesso: {sucesso} ({taxa_sucesso:.1f}%)")
            logger.info(f"  - Erros: {erros}")
            logger.info(f"  - Reinícios de driver: {self.processed_count // DRIVER_RESTART_INTERVAL}")
            logger.info(f"  - Taxa de processamento: {total / (duracao.total_seconds() / 60):.1f} usuários/minuto")
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
