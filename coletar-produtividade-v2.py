"""
Script para coletar dados de produtividade do sistema MV por range de datas.
Versão 2 - com XPaths específicos para formulário e divs de dados.

MELHORIAS:
- Detecção e tratamento de timeouts HTTP
- Recuperação automática de conexões
- Circuit breaker pattern melhorado
- Health checks do driver
- Retry mais inteligente
- Gerenciamento de memória
- XPaths específicos para extração de dados via divs
"""
import os
import sys
import time
import random
import glob
import signal
import psutil
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import (
    TimeoutException,
    NoSuchElementException,
    WebDriverException,
    StaleElementReferenceException,
    InvalidSessionIdException
)
from supabase import create_client, Client
from dotenv import load_dotenv
import logging
from functools import wraps

# Configurar logging com mais detalhes
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - [%(funcName)s] - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/produtividade-mv-v2.log'),
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

# ============================================================================
# CONFIGURAÇÕES APRIMORADAS DE RESILIÊNCIA
# ============================================================================
MAX_RETRIES = 5
INITIAL_RETRY_DELAY = 8
MAX_RETRY_DELAY = 120
DRIVER_RESTART_INTERVAL = 25
CONSECUTIVE_FAILURE_THRESHOLD = 3
MIN_DELAY_BETWEEN_REQUESTS = 10
MAX_DELAY_BETWEEN_REQUESTS = 20
SCREENSHOT_RETENTION_DAYS = 7
PAGE_LOAD_TIMEOUT = 240
IMPLICIT_WAIT = 8
ELEMENT_WAIT_TIMEOUT = 45

# Timeouts específicos para operações críticas
TIMEOUT_FORMULARIO = 60
TIMEOUT_DADOS = 90
TIMEOUT_SUBMIT = 45

# Health check do driver
DRIVER_HEALTH_CHECK_INTERVAL = 5
MAX_DRIVER_AGE_MINUTES = 30

# ============================================================================
# XPATHS DO FORMULÁRIO
# ============================================================================
XPATH_CODIGO_PRESTADOR = "/html/body/div/div/div[46]/div/div/table/tbody/tr[2]/td[2]/table/tbody/tr/td/input"
XPATH_DATA_INICIAL = "/html/body/div/div/div[46]/div/div/table/tbody/tr[1]/td[4]/table/tbody/tr/td[1]/input"
XPATH_DATA_FINAL = "/html/body/div/div/div[46]/div/div/table/tbody/tr[2]/td[4]/table/tbody/tr/td[1]/input"
XPATH_SUBMIT_BUTTON = "/html/body/div/div/div[46]/div/div/table/tbody/tr[4]/td[4]/table/tbody/tr/td[2]/div/table/tbody/tr/td"

# ============================================================================
# XPATHS DOS DADOS (DIVS)
# ============================================================================
XPATH_BASE_DADOS = "/html/body/div/div/div[11]/div/div"

XPATH_DADOS = {
    'codigo_mv': f"{XPATH_BASE_DADOS}/div[35]/div",
    'nome': f"{XPATH_BASE_DADOS}/div[36]/div",
    'especialidade': f"{XPATH_BASE_DADOS}/div[37]/div",
    'cirurgia_realizada': f"{XPATH_BASE_DADOS}/div[38]/div",
    'vinculo': f"{XPATH_BASE_DADOS}/div[39]/div",
    'parecer_solicitado': f"{XPATH_BASE_DADOS}/div[40]/div",
    'parecer_realizado': f"{XPATH_BASE_DADOS}/div[41]/div",
    'prescricao': f"{XPATH_BASE_DADOS}/div[42]/div",
    'evolucao': f"{XPATH_BASE_DADOS}/div[43]/div",
    'procedimento': f"{XPATH_BASE_DADOS}/div[44]/div",
    'urgencia': f"{XPATH_BASE_DADOS}/div[45]/div",
    'ambulatorio': f"{XPATH_BASE_DADOS}/div[46]/div",
    'encaminhamento': f"{XPATH_BASE_DADOS}/div[47]/div",
    'auxiliar': f"{XPATH_BASE_DADOS}/div[48]/div",
}

# User Agents para rotação
USER_AGENTS = [
    'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/116.0',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
]

# --- Range de Datas para Processar ---
DATA_INICIO = datetime(2026, 2, 9)  # 09/02/2026
DATA_FIM = datetime(2026, 2, 28)    # 28/02/2026

# ============================================================================
# CAMPOS QUE REQUEREM PERÍODO D-1 até D
# ============================================================================
CAMPOS_PERIODO_ANTERIOR = [
    'procedimento',
    'parecer_solicitado',
    'parecer_realizado',
    'encaminhamento',
]

# ============================================================================
# CAMPOS QUE FUNCIONAM COM MESMO DIA (D até D)
# ============================================================================
CAMPOS_MESMO_DIA = [
    'cirurgia_realizada',
    'prescricao',
    'evolucao',
    'urgencia',
    'ambulatorio',
    'auxiliar'
]

# ============================================================================
# UTILITÁRIOS DE RESILIÊNCIA
# ============================================================================

class TimeoutError(Exception):
    """Exceção customizada para timeout."""
    pass

class DriverHealthError(Exception):
    """Exceção para problemas de saúde do driver."""
    pass

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

def cleanup_temp_files():
    """Limpa arquivos temporários do Firefox."""
    try:
        import subprocess
        subprocess.run("rm -rf /tmp/rust_mozprofile* 2>/dev/null || true", shell=True, timeout=10)
        subprocess.run("rm -rf /tmp/tmp* 2>/dev/null || true", shell=True, timeout=10)
        logger.debug("Arquivos temporários limpos")
    except Exception as e:
        logger.warning(f"Erro ao limpar arquivos temporários: {e}")

def kill_zombie_processes():
    """Mata processos Firefox e Geckodriver órfãos."""
    try:
        import subprocess

        try:
            result = subprocess.run(
                "ps aux | grep -E 'firefox|geckodriver' | grep -v grep | wc -l",
                shell=True,
                capture_output=True,
                text=True,
                timeout=5
            )
            before_count = int(result.stdout.strip() or 0)
            if before_count > 0:
                logger.info(f"Encontrados {before_count} processos Firefox/Geckodriver rodando")
        except:
            before_count = 0

        for attempt in range(3):
            subprocess.run("pkill -9 firefox 2>/dev/null || true", shell=True, timeout=5)
            subprocess.run("pkill -9 geckodriver 2>/dev/null || true", shell=True, timeout=5)
            time.sleep(1)

        try:
            result = subprocess.run(
                "ps aux | grep -E 'firefox|geckodriver' | grep -v grep | wc -l",
                shell=True,
                capture_output=True,
                text=True,
                timeout=5
            )
            after_count = int(result.stdout.strip() or 0)
            if after_count == 0 and before_count > 0:
                logger.info(f"Todos os {before_count} processos foram terminados")
            elif after_count > 0:
                logger.warning(f"Ainda restam {after_count} processos rodando")
        except:
            pass

    except Exception as e:
        logger.warning(f"Erro ao matar processos zumbis: {e}")

def random_delay(min_seconds: int = MIN_DELAY_BETWEEN_REQUESTS,
                 max_seconds: int = MAX_DELAY_BETWEEN_REQUESTS):
    """Aguarda um tempo aleatório para simular comportamento humano."""
    delay = random.uniform(min_seconds, max_seconds)
    logger.debug(f"Aguardando {delay:.2f} segundos...")
    time.sleep(delay)

def check_system_resources():
    """Verifica recursos do sistema e retorna status."""
    try:
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')

        memory_percent = memory.percent
        disk_percent = disk.percent

        if memory_percent > 90:
            logger.warning(f"Memoria alta: {memory_percent:.1f}%")

        if disk_percent > 90:
            logger.warning(f"Disco alto: {disk_percent:.1f}%")

        return {
            'memory_percent': memory_percent,
            'disk_percent': disk_percent,
            'healthy': memory_percent < 90 and disk_percent < 90
        }
    except Exception as e:
        logger.warning(f"Erro ao verificar recursos: {e}")
        return {'healthy': True}

def retry_with_exponential_backoff(max_retries: int = MAX_RETRIES,
                                   initial_delay: int = INITIAL_RETRY_DELAY,
                                   max_delay: int = MAX_RETRY_DELAY,
                                   refresh_page_on_retry: bool = True,
                                   restart_driver_on_failure: bool = True):
    """Decorator que implementa retry com exponential backoff e recuperação inteligente."""
    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            delay = initial_delay
            last_exception = None

            for attempt in range(1, max_retries + 1):
                try:
                    if hasattr(self, 'driver') and self.driver:
                        if not self.is_driver_healthy():
                            logger.warning("Driver nao esta saudavel, reiniciando...")
                            self.setup_driver(restart=True)

                    return func(self, *args, **kwargs)

                except InvalidSessionIdException as e:
                    logger.error(f"Sessao invalida detectada: {e}")
                    if hasattr(self, 'setup_driver'):
                        logger.info("Recriando driver devido a sessao invalida...")
                        self.setup_driver(restart=True)
                    last_exception = e

                except (TimeoutException, WebDriverException) as e:
                    last_exception = e
                    error_msg = str(e)

                    is_connection_error = any(x in error_msg.lower() for x in [
                        'connection', 'timeout', 'timed out', 'read timed out',
                        'httpconnectionpool', 'remoteerror'
                    ])

                    is_element_error = any(x in error_msg.lower() for x in [
                        'no such element', 'stale element', 'element not found'
                    ])

                    if is_connection_error:
                        logger.error(f"Erro de conexao detectado (tentativa {attempt}/{max_retries}): {error_msg[:200]}")
                    elif is_element_error:
                        logger.error(f"Erro de elemento detectado (tentativa {attempt}/{max_retries}): {error_msg[:200]}")
                    else:
                        logger.error(f"Erro WebDriver (tentativa {attempt}/{max_retries}): {error_msg[:200]}")

                    if attempt == max_retries:
                        logger.error(f"FALHA FINAL apos {max_retries} tentativas")
                        raise

                    jitter = random.uniform(0, 0.3 * delay)
                    wait_time = min(delay + jitter, max_delay)

                    logger.warning(f"Aguardando {wait_time:.1f}s antes da tentativa {attempt + 1}...")

                    if is_connection_error and attempt >= 2 and restart_driver_on_failure:
                        logger.info("Erro de conexao persistente, reiniciando driver...")
                        if hasattr(self, 'setup_driver'):
                            try:
                                self.setup_driver(restart=True)
                                logger.info("Driver reiniciado com sucesso")
                            except Exception as restart_error:
                                logger.error(f"Erro ao reiniciar driver: {restart_error}")

                    elif refresh_page_on_retry and hasattr(self, 'driver') and self.driver:
                        try:
                            logger.info("Tentando recarregar pagina...")

                            try:
                                alert = self.driver.switch_to.alert
                                alert.dismiss()
                                logger.info("Alert fechado")
                            except:
                                pass

                            try:
                                self.driver.switch_to.default_content()
                            except:
                                pass

                            try:
                                self.driver.get(MV_REPORT_URL)
                                logger.info("Pagina recarregada")
                                time.sleep(random.uniform(5, 8))
                            except Exception as nav_error:
                                logger.warning(f"Erro ao navegar: {nav_error}")

                        except Exception as refresh_error:
                            logger.warning(f"Erro ao recarregar pagina: {refresh_error}")

                    time.sleep(wait_time)
                    delay = min(delay * 2, max_delay)

                except Exception as e:
                    last_exception = e
                    logger.error(f"Erro inesperado (tentativa {attempt}/{max_retries}): {e}")

                    if attempt == max_retries:
                        raise

                    time.sleep(min(delay, max_delay))
                    delay = min(delay * 2, max_delay)

            raise last_exception
        return wrapper
    return decorator


class ProdutividadeCollectorV2:
    """Classe para coletar dados de produtividade do MV usando XPaths de divs."""

    def __init__(self):
        """Inicializa o coletor."""
        self.driver = None
        self.supabase = None
        self.consecutive_failures = 0
        self.processed_count = 0
        self.current_user_agent = random.choice(USER_AGENTS)
        self.driver_start_time = None
        self.last_health_check = 0

        self.stats_por_dia = {}

        self.error_counts = {
            'timeout': 0,
            'connection': 0,
            'element_not_found': 0,
            'other': 0
        }

    def is_driver_healthy(self) -> bool:
        """Verifica se o driver está saudável e funcionando."""
        if not self.driver:
            return False

        try:
            _ = self.driver.title

            if self.driver_start_time:
                age_minutes = (datetime.now() - self.driver_start_time).total_seconds() / 60
                if age_minutes > MAX_DRIVER_AGE_MINUTES:
                    logger.warning(f"Driver muito antigo ({age_minutes:.1f} min), requer reinicializacao")
                    return False

            return True

        except (InvalidSessionIdException, WebDriverException) as e:
            logger.warning(f"Driver nao esta saudavel: {e}")
            return False
        except Exception as e:
            logger.warning(f"Erro ao verificar saude do driver: {e}")
            return False

    def periodic_health_check(self):
        """Realiza verificação periódica de saúde."""
        self.last_health_check += 1

        if self.last_health_check >= DRIVER_HEALTH_CHECK_INTERVAL:
            logger.info("Verificacao de saude periodica...")

            resources = check_system_resources()
            if not resources['healthy']:
                logger.warning("Recursos do sistema baixos, aguardando...")
                time.sleep(30)

            if not self.is_driver_healthy():
                logger.warning("Driver nao saudavel, reiniciando...")
                self.setup_driver(restart=True)

            self.last_health_check = 0

    def setup_driver(self, restart: bool = False):
        """Configura o driver do Selenium com Firefox headless."""
        if restart and self.driver:
            logger.info("Reiniciando driver - fechando instancia anterior...")
            try:
                self.driver.quit()
            except Exception as e:
                logger.warning(f"Erro ao fechar driver anterior: {e}")
            finally:
                self.driver = None

            kill_zombie_processes()
            cleanup_temp_files()
            time.sleep(5)

        logger.info(f"Configurando Firefox driver...")
        logger.info(f"User-Agent: {self.current_user_agent[:60]}...")

        import shutil
        global GECKODRIVER_PATH
        if not os.path.exists(GECKODRIVER_PATH):
            logger.error(f"Geckodriver nao encontrado em: {GECKODRIVER_PATH}")
            geckodriver_path = shutil.which('geckodriver')
            if geckodriver_path:
                logger.info(f"Geckodriver encontrado em: {geckodriver_path}")
                GECKODRIVER_PATH = geckodriver_path
            else:
                raise FileNotFoundError("Geckodriver nao encontrado.")

        options = Options()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--disable-software-rasterizer')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--disable-extensions')
        options.add_argument('--disable-infobars')
        options.add_argument('--disable-notifications')
        options.add_argument('--disable-blink-features=AutomationControlled')

        options.set_preference('general.useragent.override', self.current_user_agent)
        options.set_preference('marionette.port', 2828)
        options.set_preference('browser.cache.disk.enable', False)
        options.set_preference('browser.cache.memory.enable', True)
        options.set_preference('network.http.connection-timeout', 120)
        options.set_preference('network.http.response.timeout', 120)
        options.set_preference('dom.max_script_run_time', 120)
        options.set_preference('dom.max_chrome_script_run_time', 120)

        firefox_paths = ['/usr/bin/firefox', '/usr/bin/firefox-esr', '/snap/bin/firefox']
        firefox_binary = None
        for path in firefox_paths:
            if os.path.exists(path):
                firefox_binary = path
                break

        if firefox_binary:
            options.binary_location = firefox_binary

        logger.info("Limpando processos Firefox/Geckodriver travados...")
        kill_zombie_processes()

        service = Service(
            executable_path=GECKODRIVER_PATH,
            log_output='/tmp/geckodriver.log'
        )

        try:
            logger.info("Iniciando Firefox em modo headless...")
            self.driver_start_time = datetime.now()
            self.driver = webdriver.Firefox(service=service, options=options)
            self.driver.set_page_load_timeout(PAGE_LOAD_TIMEOUT)
            self.driver.implicitly_wait(IMPLICIT_WAIT)
            logger.info(f"Firefox driver configurado com sucesso as {self.driver_start_time.strftime('%H:%M:%S')}")
        except Exception as e:
            self.driver = None
            self.driver_start_time = None
            logger.error(f"Erro ao configurar Firefox driver: {e}")
            kill_zombie_processes()
            raise

    def connect_supabase(self):
        """Conecta ao Supabase com retry."""
        logger.info("Conectando ao Supabase...")
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise ValueError("VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY sao obrigatorios")

        max_attempts = 3
        for attempt in range(1, max_attempts + 1):
            try:
                self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
                self.supabase.table('usuarios').select('id').limit(1).execute()
                logger.info("Conectado ao Supabase com sucesso")
                return
            except Exception as e:
                if attempt == max_attempts:
                    logger.error(f"Falha ao conectar no Supabase apos {max_attempts} tentativas: {e}")
                    raise
                logger.warning(f"Tentativa {attempt}/{max_attempts} falhou, tentando novamente...")
                time.sleep(5 * attempt)

    def clear_browser_data(self):
        """Limpa cookies e cache do navegador."""
        if not self.driver:
            return

        try:
            logger.debug("Limpando cookies e cache do navegador...")
            self.driver.delete_all_cookies()
            try:
                self.driver.execute_script("window.localStorage.clear();")
                self.driver.execute_script("window.sessionStorage.clear();")
            except Exception:
                pass
            logger.debug("Browser data limpo com sucesso")
        except Exception as e:
            logger.warning(f"Erro ao limpar browser data: {e}")

    def should_restart_driver(self) -> bool:
        """Verifica se o driver deve ser reiniciado."""
        return self.processed_count > 0 and self.processed_count % DRIVER_RESTART_INTERVAL == 0

    def handle_consecutive_failures(self):
        """Implementa circuit breaker pattern."""
        if self.consecutive_failures >= CONSECUTIVE_FAILURE_THRESHOLD:
            logger.warning(f"CIRCUIT BREAKER: {self.consecutive_failures} falhas consecutivas detectadas")
            logger.info(f"Estatisticas de erros: {self.error_counts}")
            logger.info("Pausando por 60s e reiniciando driver...")

            time.sleep(60)

            kill_zombie_processes()
            cleanup_temp_files()
            time.sleep(5)

            self.setup_driver(restart=True)
            self.current_user_agent = random.choice(USER_AGENTS)
            self.consecutive_failures = 0
            logger.info("Circuit breaker: Sistema reiniciado")

    def buscar_usuarios_terceiros(self, cpfs_filtro: Optional[List[str]] = None) -> List[Dict]:
        """Busca usuários do tipo 'terceiro' com codigomv."""
        logger.info("Buscando usuarios terceiros...")
        try:
            query = self.supabase.table('usuarios').select(
                'id, nome, cpf, codigomv, especialidade'
            ).eq('tipo', 'terceiro').not_.is_('codigomv', 'null')

            if cpfs_filtro:
                logger.info(f"Filtrando por {len(cpfs_filtro)} CPFs especificos")
                query = query.in_('cpf', cpfs_filtro)

            response = query.execute()
            usuarios = response.data

            logger.info(f"Encontrados {len(usuarios)} usuarios terceiros")
            return usuarios

        except Exception as e:
            logger.error(f"Erro ao buscar usuarios terceiros: {e}")
            raise

    def formatar_data_mv(self, data: datetime) -> str:
        """Retorna a data no formato mm.dd.yyyy."""
        return data.strftime('%m.%d.%Y')

    def obter_data_iso(self, data: datetime) -> str:
        """Retorna a data no formato ISO (YYYY-MM-DD)."""
        return data.strftime('%Y-%m-%d')

    def buscar_cpfs_acessos_dia(self, data: datetime) -> List[str]:
        """Busca CPFs únicos que acessaram o sistema em um dia específico."""
        logger.info(f"Buscando CPFs que acessaram em {data.strftime('%d/%m/%Y')}...")
        try:
            data_iso = self.obter_data_iso(data)
            data_inicio = f"{data_iso} 00:00:00"
            data_fim_obj = data + timedelta(days=1)
            data_fim = data_fim_obj.strftime('%Y-%m-%d 00:00:00')

            response = self.supabase.table('acessos').select('cpf').gte(
                'data_acesso', data_inicio
            ).lt('data_acesso', data_fim).execute()

            if not response.data:
                logger.warning(f"Nenhum acesso encontrado para {data.strftime('%d/%m/%Y')}")
                return []

            cpfs = list(set([acesso['cpf'] for acesso in response.data if acesso.get('cpf')]))
            logger.info(f"Encontrados {len(response.data)} acessos com {len(cpfs)} CPFs unicos")

            return cpfs
        except Exception as e:
            logger.error(f"Erro ao buscar CPFs de acessos: {e}")
            raise

    def aguardar_elemento_com_retry(self, xpath: str, timeout: int = ELEMENT_WAIT_TIMEOUT,
                                     max_tentativas: int = 3) -> Optional[any]:
        """Aguarda um elemento com múltiplas tentativas."""
        for tentativa in range(1, max_tentativas + 1):
            try:
                wait = WebDriverWait(self.driver, timeout)
                elemento = wait.until(EC.presence_of_element_located((By.XPATH, xpath)))
                return elemento
            except TimeoutException:
                if tentativa < max_tentativas:
                    logger.debug(f"Tentativa {tentativa}/{max_tentativas} falhou para xpath: {xpath[:50]}...")
                    time.sleep(2)
                else:
                    return None
        return None

    @retry_with_exponential_backoff(
        max_retries=MAX_RETRIES,
        initial_delay=INITIAL_RETRY_DELAY,
        refresh_page_on_retry=True,
        restart_driver_on_failure=True
    )
    def preencher_formulario(self, codigo_mv: str, data_inicial: str, data_final: str):
        """Preenche o formulário do relatório MV com retry automático."""
        wait = WebDriverWait(self.driver, ELEMENT_WAIT_TIMEOUT)

        try:
            logger.info(f"Preenchendo formulario...")
            logger.info(f"   Codigo: {codigo_mv}")
            logger.info(f"   Periodo: {data_inicial} ate {data_final}")

            time.sleep(random.uniform(3, 5))

            # Fechar alertas
            try:
                alert = self.driver.switch_to.alert
                alert.dismiss()
                logger.info("Alert fechado")
                time.sleep(1)
            except:
                pass

            # Campo Código Prestador
            logger.debug("Localizando campo Codigo Prestador...")
            try:
                campo_codigo = wait.until(
                    EC.presence_of_element_located((By.XPATH, XPATH_CODIGO_PRESTADOR))
                )
                campo_codigo.clear()
                campo_codigo.send_keys(codigo_mv)
                time.sleep(random.uniform(1.5, 2.5))
                logger.debug("Codigo preenchido")
            except TimeoutException:
                logger.error("Campo Codigo Prestador nao encontrado")
                self.error_counts['element_not_found'] += 1
                raise

            # Campo Data Inicial
            logger.debug("Localizando campo Data Inicial...")
            try:
                campo_data_inicial = wait.until(
                    EC.presence_of_element_located((By.XPATH, XPATH_DATA_INICIAL))
                )
                campo_data_inicial.send_keys(Keys.CONTROL + "a")
                campo_data_inicial.send_keys(Keys.BACKSPACE)
                time.sleep(random.uniform(0.8, 1.2))
                campo_data_inicial.send_keys(data_inicial)
                time.sleep(random.uniform(1.5, 2.5))
                logger.debug("Data inicial preenchida")
            except TimeoutException:
                logger.error("Campo Data Inicial nao encontrado")
                self.error_counts['element_not_found'] += 1
                raise

            # Campo Data Final
            logger.debug("Localizando campo Data Final...")
            try:
                campo_data_final = wait.until(
                    EC.presence_of_element_located((By.XPATH, XPATH_DATA_FINAL))
                )
                campo_data_final.send_keys(Keys.CONTROL + "a")
                campo_data_final.send_keys(Keys.BACKSPACE)
                time.sleep(random.uniform(0.8, 1.2))
                campo_data_final.send_keys(data_final)
                time.sleep(random.uniform(1.5, 2.5))
                logger.debug("Data final preenchida")
            except TimeoutException:
                logger.error("Campo Data Final nao encontrado")
                self.error_counts['element_not_found'] += 1
                raise

            # Botão Submit
            logger.debug("Procurando botao Submit...")
            try:
                botao_submit = wait.until(
                    EC.element_to_be_clickable((By.XPATH, XPATH_SUBMIT_BUTTON))
                )
                logger.debug("Botao Submit encontrado")
            except TimeoutException:
                # Fallback: tentar encontrar por texto
                try:
                    botao_submit = wait.until(
                        EC.element_to_be_clickable((By.XPATH, "//td[contains(text(), 'Submit')]"))
                    )
                    logger.debug("Botao Submit encontrado (fallback)")
                except TimeoutException:
                    logger.error("Botao Submit nao encontrado")
                    self.error_counts['element_not_found'] += 1
                    raise

            logger.info("Clicando no botao Submit...")
            botao_submit.click()

            # Aguardar carregamento do relatório
            delay = random.uniform(15, 22)
            logger.info(f"Aguardando carregamento do relatorio ({delay:.1f}s)...")
            time.sleep(delay)

            logger.info("Formulario preenchido e submetido com sucesso")

        except TimeoutException as e:
            logger.error(f"Timeout ao preencher formulario")
            self.error_counts['timeout'] += 1

            try:
                screenshot_path = f"/tmp/screenshot_erro_{codigo_mv}_{int(time.time())}.png"
                self.driver.save_screenshot(screenshot_path)
                logger.error(f"Screenshot salvo em: {screenshot_path}")
            except Exception as se:
                logger.error(f"Falha ao salvar screenshot: {se}")

            raise e

        except WebDriverException as e:
            if 'connection' in str(e).lower() or 'timeout' in str(e).lower():
                self.error_counts['connection'] += 1
                logger.error(f"Erro de conexao ao preencher formulario")
            else:
                self.error_counts['other'] += 1
            raise e

        except Exception as e:
            self.error_counts['other'] += 1
            logger.error(f"Erro inesperado ao preencher formulario: {e}")
            raise e

    def extrair_texto_div(self, xpath: str, default: str = "0") -> str:
        """Extrai texto de uma div pelo xpath."""
        try:
            elemento = self.driver.find_element(By.XPATH, xpath)
            texto = elemento.text.strip()
            return texto if texto else default
        except NoSuchElementException:
            logger.debug(f"Elemento nao encontrado: {xpath[:60]}...")
            return default
        except StaleElementReferenceException:
            logger.debug(f"Elemento obsoleto: {xpath[:60]}...")
            return default
        except Exception as e:
            logger.debug(f"Erro ao extrair texto: {e}")
            return default

    def extrair_dados_divs(self, codigo_mv: str, campos_extrair: List[str]) -> Optional[Dict]:
        """Extrai os dados das divs de produtividade usando XPaths específicos."""
        wait = WebDriverWait(self.driver, TIMEOUT_DADOS)

        try:
            logger.debug(f"Buscando dados para codigo {codigo_mv}")
            logger.debug(f"   Campos: {', '.join(campos_extrair)}")

            # Aguardar carregamento das divs
            time.sleep(5)

            # Tentar primeiro na página principal
            dados = self._tentar_extrair_dados_divs(codigo_mv, campos_extrair)
            if dados:
                return dados

            # Tentar dentro de iframes
            logger.debug("Tentando extrair de iframe...")
            iframes = self.driver.find_elements(By.TAG_NAME, "iframe")

            for idx, iframe in enumerate(iframes[:5]):  # Limitar a 5 iframes
                try:
                    self.driver.switch_to.frame(iframe)
                    logger.debug(f"Mudanca para iframe {idx + 1} bem-sucedida")

                    dados = self._tentar_extrair_dados_divs(codigo_mv, campos_extrair)

                    self.driver.switch_to.default_content()

                    if dados:
                        return dados

                except Exception as e:
                    logger.debug(f"Erro no iframe {idx + 1}: {e}")
                    try:
                        self.driver.switch_to.default_content()
                    except:
                        pass

            logger.warning(f"Dados nao encontrados para codigo {codigo_mv}")
            return None

        except Exception as e:
            logger.error(f"Erro ao extrair dados: {e}")
            try:
                self.driver.switch_to.default_content()
            except:
                pass
            return None

    def _tentar_extrair_dados_divs(self, codigo_mv: str, campos_extrair: List[str]) -> Optional[Dict]:
        """Tenta extrair dados das divs."""
        try:
            # Verificar se a div de código existe e contém o código esperado
            codigo_encontrado = self.extrair_texto_div(XPATH_DADOS['codigo_mv'], "")

            if not codigo_encontrado:
                logger.debug("Div de codigo nao encontrada")
                return None

            # Verificar se o código corresponde (pode ter formatação diferente)
            if codigo_encontrado != str(codigo_mv) and codigo_encontrado != codigo_mv:
                logger.debug(f"Codigo encontrado ({codigo_encontrado}) diferente do esperado ({codigo_mv})")
                # Continuar mesmo assim - pode ser que o código esteja formatado diferente

            logger.info(f"Codigo {codigo_encontrado} encontrado nas divs")

            # Extrair dados básicos
            dados = {
                'codigo_mv': codigo_encontrado or str(codigo_mv),
                'nome': self.extrair_texto_div(XPATH_DADOS['nome'], ""),
                'especialidade': self.extrair_texto_div(XPATH_DADOS['especialidade'], ""),
                'vinculo': self.extrair_texto_div(XPATH_DADOS['vinculo'], ""),
            }

            # Extrair campos numéricos solicitados
            for campo in campos_extrair:
                if campo in XPATH_DADOS:
                    valor_texto = self.extrair_texto_div(XPATH_DADOS[campo], "0")
                    dados[campo] = self._converter_para_int(valor_texto)

            # Log dos dados extraídos
            campos_str = ', '.join([f"{k}={v}" for k, v in dados.items() if k in campos_extrair])
            logger.info(f"   {dados['nome']}: {campos_str}")

            return dados

        except Exception as e:
            logger.debug(f"Erro na extracao de divs: {e}")
            return None

    def _converter_para_int(self, valor: str) -> int:
        """Converte string para int, tratando casos especiais."""
        try:
            if not valor or not valor.strip():
                return 0
            # Remover caracteres não numéricos exceto sinal negativo
            valor_limpo = ''.join(c for c in valor if c.isdigit() or c == '-')
            return int(valor_limpo) if valor_limpo else 0
        except ValueError:
            return 0

    def inserir_produtividade(self, dados: Dict, data: datetime):
        """Insere os dados de produtividade no Supabase."""
        try:
            logger.debug(f"Salvando produtividade para {dados['nome']}...")

            data_iso = self.obter_data_iso(data)

            # Verificar existente
            existing = self.supabase.table('produtividade').select('id').eq(
                'codigo_mv', dados['codigo_mv']
            ).eq('data', data_iso).execute()

            # Preparar payload
            data_payload = {
                'nome': dados['nome'],
                'especialidade': dados['especialidade'],
                'vinculo': dados['vinculo'],
                'procedimento': dados.get('procedimento', 0),
                'parecer_solicitado': dados.get('parecer_solicitado', 0),
                'parecer_realizado': dados.get('parecer_realizado', 0),
                'cirurgia_realizada': dados.get('cirurgia_realizada', 0),
                'prescricao': dados.get('prescricao', 0),
                'evolucao': dados.get('evolucao', 0),
                'urgencia': dados.get('urgencia', 0),
                'ambulatorio': dados.get('ambulatorio', 0),
                'auxiliar': dados.get('auxiliar', 0),
                'encaminhamento': dados.get('encaminhamento', 0),
            }

            if existing.data and len(existing.data) > 0:
                self.supabase.table('produtividade').update(data_payload).eq(
                    'id', existing.data[0]['id']
                ).execute()
                logger.debug("Registro atualizado")
            else:
                data_payload['codigo_mv'] = dados['codigo_mv']
                data_payload['data'] = data_iso
                self.supabase.table('produtividade').insert(data_payload).execute()
                logger.debug("Novo registro inserido")

        except Exception as e:
            logger.error(f"Erro ao inserir produtividade: {e}")
            raise

    def processar_usuario(self, usuario: Dict, data: datetime, index: int, total: int):
        """Processa um único usuário fazendo DUAS buscas."""
        codigo_mv = usuario['codigomv']
        nome = usuario['nome']

        logger.info(f"\n{'='*70}")
        logger.info(f"[{index}/{total}] {nome} (MV: {codigo_mv})")
        logger.info(f"{'='*70}")

        try:
            # Health check periódico
            self.periodic_health_check()

            # Reiniciar driver se necessário
            if self.should_restart_driver():
                logger.info(f"Reiniciando driver (processados: {self.processed_count})")
                self.clear_browser_data()
                self.setup_driver(restart=True)
                self.current_user_agent = random.choice(USER_AGENTS)

            # Circuit breaker
            self.handle_consecutive_failures()

            # Limpar cache periodicamente
            if self.processed_count > 0 and self.processed_count % 10 == 0:
                self.clear_browser_data()

            # =================================================================
            # BUSCA 1: Período D-1 até D
            # =================================================================
            logger.info(f"\nBUSCA 1/2: Periodo D-1 ate D")
            logger.info(f"   Campos: {', '.join(CAMPOS_PERIODO_ANTERIOR)}")

            data_anterior = data - timedelta(days=1)
            data_inicial_str = self.formatar_data_mv(data_anterior)
            data_final_str = self.formatar_data_mv(data)

            logger.info(f"   {data_anterior.strftime('%d/%m/%Y')} -> {data.strftime('%d/%m/%Y')}")

            self.driver.get(MV_REPORT_URL)
            time.sleep(random.uniform(5, 8))

            self.preencher_formulario(codigo_mv, data_inicial_str, data_final_str)
            dados_periodo = self.extrair_dados_divs(codigo_mv, CAMPOS_PERIODO_ANTERIOR)

            if not dados_periodo:
                logger.warning(f"Sem dados na busca 1")
                dados_periodo = {
                    'codigo_mv': codigo_mv,
                    'nome': nome,
                    'especialidade': usuario.get('especialidade', ''),
                    'vinculo': ''
                }
                for campo in CAMPOS_PERIODO_ANTERIOR:
                    dados_periodo[campo] = 0

            # Pausa entre buscas
            time.sleep(random.uniform(4, 7))

            # =================================================================
            # BUSCA 2: Mesmo dia D até D
            # =================================================================
            logger.info(f"\nBUSCA 2/2: Mesmo dia D ate D")
            logger.info(f"   Campos: {', '.join(CAMPOS_MESMO_DIA)}")

            data_str = self.formatar_data_mv(data)
            logger.info(f"   {data.strftime('%d/%m/%Y')} -> {data.strftime('%d/%m/%Y')}")

            self.driver.get(MV_REPORT_URL)
            time.sleep(random.uniform(5, 8))

            self.preencher_formulario(codigo_mv, data_str, data_str)
            dados_mesmo_dia = self.extrair_dados_divs(codigo_mv, CAMPOS_MESMO_DIA)

            if not dados_mesmo_dia:
                logger.warning(f"Sem dados na busca 2")
                dados_mesmo_dia = {}
                for campo in CAMPOS_MESMO_DIA:
                    dados_mesmo_dia[campo] = 0

            # =================================================================
            # COMBINAR DADOS
            # =================================================================
            logger.info(f"\nCombinando dados...")

            dados_completos = {
                'codigo_mv': dados_periodo['codigo_mv'],
                'nome': dados_periodo['nome'],
                'especialidade': dados_periodo['especialidade'],
                'vinculo': dados_periodo.get('vinculo', dados_mesmo_dia.get('vinculo', ''))
            }

            for campo in CAMPOS_PERIODO_ANTERIOR:
                dados_completos[campo] = dados_periodo.get(campo, 0)

            for campo in CAMPOS_MESMO_DIA:
                dados_completos[campo] = dados_mesmo_dia.get(campo, 0)

            total_periodo = sum([dados_completos[c] for c in CAMPOS_PERIODO_ANTERIOR])
            total_mesmo_dia = sum([dados_completos[c] for c in CAMPOS_MESMO_DIA])

            logger.info(f"   Periodo D-1->D: {total_periodo} atividades")
            logger.info(f"   Mesmo dia D: {total_mesmo_dia} atividades")

            # Salvar
            self.inserir_produtividade(dados_completos, data)

            self.consecutive_failures = 0
            self.processed_count += 1

            logger.info(f"Usuario processado com sucesso")

            random_delay()

        except Exception as e:
            self.consecutive_failures += 1
            logger.error(f"Erro (falha #{self.consecutive_failures}): {str(e)[:200]}")
            raise e

    def processar_dia(self, data: datetime):
        """Processa todos os usuários para um dia específico."""
        data_str = data.strftime('%d/%m/%Y')

        logger.info(f"\n{'#'*70}")
        logger.info(f"PROCESSANDO: {data_str}")
        logger.info(f"{'#'*70}")

        inicio = datetime.now()

        self.stats_por_dia[data_str] = {
            'total': 0,
            'sucesso': 0,
            'erros': 0,
            'duracao': None
        }

        try:
            # Buscar CPFs do dia
            cpfs_dia = self.buscar_cpfs_acessos_dia(data)

            if not cpfs_dia:
                logger.warning(f"Sem acessos em {data_str}")
                return

            # Buscar usuários
            usuarios = self.buscar_usuarios_terceiros(cpfs_filtro=cpfs_dia)

            if not usuarios:
                logger.warning(f"Sem usuarios terceiros em {data_str}")
                return

            total = len(usuarios)
            self.stats_por_dia[data_str]['total'] = total
            sucesso = 0
            erros = 0

            logger.info(f"{total} usuarios para processar")

            # Processar cada usuário
            for index, usuario in enumerate(usuarios, 1):
                try:
                    self.processar_usuario(usuario, data, index, total)
                    sucesso += 1
                except Exception as e:
                    logger.error(f"Falha no usuario: {e}")
                    erros += 1
                    continue

            # Estatísticas
            fim = datetime.now()
            duracao = fim - inicio

            self.stats_por_dia[data_str]['sucesso'] = sucesso
            self.stats_por_dia[data_str]['erros'] = erros
            self.stats_por_dia[data_str]['duracao'] = duracao

            taxa = (sucesso / total * 100) if total > 0 else 0

            logger.info(f"\n{'='*70}")
            logger.info(f"RESUMO: {data_str}")
            logger.info(f"{'='*70}")
            logger.info(f"Total: {total} | Sucesso: {sucesso} ({taxa:.1f}%) | Erros: {erros}")
            logger.info(f"Duracao: {duracao}")
            logger.info(f"{'='*70}\n")

        except Exception as e:
            logger.error(f"Erro critico no dia {data_str}: {e}")
            raise

    def executar(self):
        """Executa o processo completo."""
        inicio = datetime.now()

        logger.info(f"\n{'#'*70}")
        logger.info(f"INICIO DA COLETA - V2 (XPaths DIVs)")
        logger.info(f"{'#'*70}")
        logger.info(f"Periodo: {DATA_INICIO.strftime('%d/%m/%Y')} ate {DATA_FIM.strftime('%d/%m/%Y')}")
        logger.info(f"Inicio: {inicio.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"{'#'*70}\n")

        try:
            # Setup
            cleanup_old_screenshots()
            cleanup_temp_files()
            self.connect_supabase()
            self.setup_driver()

            # Processar dias
            data_atual = DATA_INICIO
            dias = 0

            while data_atual <= DATA_FIM:
                try:
                    self.processar_dia(data_atual)
                    dias += 1
                except Exception as e:
                    logger.error(f"Erro no dia {data_atual.strftime('%d/%m/%Y')}: {e}")

                data_atual += timedelta(days=1)

                if data_atual <= DATA_FIM:
                    time.sleep(random.uniform(8, 15))

            # Resumo final
            fim = datetime.now()
            duracao = fim - inicio

            logger.info(f"\n{'#'*70}")
            logger.info(f"COLETA CONCLUIDA")
            logger.info(f"{'#'*70}")
            logger.info(f"Termino: {fim.strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info(f"Duracao total: {duracao}")
            logger.info(f"Dias processados: {dias}")
            logger.info(f"")
            logger.info(f"ESTATISTICAS POR DIA:")
            logger.info(f"{'='*70}")

            total_usuarios = 0
            total_sucesso = 0
            total_erros = 0

            for dia, stats in self.stats_por_dia.items():
                total_usuarios += stats['total']
                total_sucesso += stats['sucesso']
                total_erros += stats['erros']

                taxa = (stats['sucesso'] / stats['total'] * 100) if stats['total'] > 0 else 0
                logger.info(
                    f"{dia}: {stats['total']} | "
                    f"Sucesso: {stats['sucesso']} ({taxa:.1f}%) | "
                    f"Erros: {stats['erros']} | "
                    f"Duracao: {stats['duracao']}"
                )

            logger.info(f"{'='*70}")
            logger.info(f"TOTAIS:")
            logger.info(f"  Usuarios: {total_usuarios}")
            logger.info(f"  Sucesso: {total_sucesso}")
            logger.info(f"  Erros: {total_erros}")
            logger.info(f"  Buscas: {total_sucesso * 2}")

            if total_usuarios > 0:
                taxa_geral = (total_sucesso / total_usuarios * 100)
                logger.info(f"  Taxa de sucesso: {taxa_geral:.1f}%")

            logger.info(f"")
            logger.info(f"Estatisticas de erros:")
            logger.info(f"  Timeouts: {self.error_counts['timeout']}")
            logger.info(f"  Conexao: {self.error_counts['connection']}")
            logger.info(f"  Elementos: {self.error_counts['element_not_found']}")
            logger.info(f"  Outros: {self.error_counts['other']}")
            logger.info(f"{'#'*70}\n")

        except Exception as e:
            logger.error(f"Erro fatal: {e}", exc_info=True)
            raise
        finally:
            if self.driver:
                logger.info("Fechando navegador...")
                try:
                    self.driver.quit()
                except:
                    pass
                kill_zombie_processes()


def main():
    """Função principal,"""
    collector = ProdutividadeCollectorV2()
    try:
        collector.executar()
    except KeyboardInterrupt:
        logger.info("\nInterrompido pelo usuario")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Erro fatal: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
