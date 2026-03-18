"""
Script para coletar dados de produtividade do sistema MV para o dia ANTERIOR (D-1).
Versão OTIMIZADA PARA LINUX/DEBIAN/DROPLET/AWS
Busca médicos que têm ACESSOS ou ESCALAS no dia anterior.

CARACTERÍSTICAS:
- Processa apenas o dia anterior (ontem)
- Combina acessos (catracas) + escalas médicas
- Pula médicos já processados
- Ideal para execução diária via cron
"""
import os
import sys
import time
import random
import glob
import signal
import psutil
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple, Set
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

# ============================================================================
# Configuração de Log
# ============================================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - [%(funcName)s] - %(message)s',
    handlers=[
        logging.FileHandler('produtividade-mv-ontem.log', encoding='utf-8'),
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
# CONFIGURAÇÕES DE RESILIÊNCIA
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

# Timeouts específicos
TIMEOUT_FORMULARIO = 60
TIMEOUT_TABELA = 90
TIMEOUT_SUBMIT = 45
TIMEOUT_CODIGO_APARECER = 45

# Health check do driver
DRIVER_HEALTH_CHECK_INTERVAL = 5
MAX_DRIVER_AGE_MINUTES = 30

# User Agents para rotação
USER_AGENTS = [
    'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/116.0',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
]

# --- XPaths do Formulário ---
BASE_CONTAINER = "//div[contains(@id, '_ParametersPanelContainer')]"
XPATH_CODIGO_PRESTADOR = f"{BASE_CONTAINER}//tr[2]/td[2]//input"
XPATH_DATA_INICIAL = f"{BASE_CONTAINER}//tr[1]/td[4]//input"
XPATH_DATA_FINAL = f"{BASE_CONTAINER}//tr[2]/td[4]//input"
XPATH_SUBMIT_BUTTON = f"{BASE_CONTAINER}//tr[4]/td[4]//td[contains(., 'Submit')]"

# --- XPaths para Extração de Dados ---
XPATH_CAMPOS = {
    'codigo_mv': '/html/body/div/div/div[11]/div/div/div[35]/div',
    'nome': '/html/body/div/div/div[11]/div/div/div[36]/div',
    'especialidade': '/html/body/div/div/div[11]/div/div/div[37]/div',
    'procedimento': '/html/body/div/div/div[11]/div/div/div[44]/div',
    'parecer_solicitado': '/html/body/div/div/div[11]/div/div/div[40]/div',
    'parecer_realizado': '/html/body/div/div/div[11]/div/div/div[41]/div',
    'cirurgia_realizada': '/html/body/div/div/div[11]/div/div/div[38]/div',
    'prescricao': '/html/body/div/div/div[11]/div/div/div[42]/div',
    'evolucao': '/html/body/div/div/div[11]/div/div/div[43]/div',
    'urgencia': '/html/body/div/div/div[11]/div/div/div[45]/div',
    'ambulatorio': '/html/body/div/div/div[11]/div/div/div[46]/div',
    'auxiliar': '/html/body/div/div/div[11]/div/div/div[48]/div',
    'encaminhamento': '/html/body/div/div/div[11]/div/div/div[47]/div',
    'folha_objetivo_diario': '/html/body/div/div/div[11]/div/div/div[49]/div',
    'evolucao_diurna_cti': '/html/body/div/div/div[11]/div/div/div[50]/div',
    'evolucao_noturna_cti': '/html/body/div/div/div[11]/div/div/div[51]/div',
}

# ============================================================================
# CAMPOS QUE REQUEREM PERÍODO D-1 até D
# ============================================================================
CAMPOS_PERIODO_ANTERIOR = [
    'procedimento',
    'parecer_solicitado',
    'parecer_realizado',
    'encaminhamento',
    'folha_objetivo_diario',
    'evolucao_diurna_cti',
    'evolucao_noturna_cti'
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
# UTILITÁRIOS
# ============================================================================

class TimeoutError(Exception):
    """Exceção customizada para timeout."""
    pass

class DriverHealthError(Exception):
    """Exceção para problemas de saúde do driver."""
    pass

def cleanup_old_screenshots(retention_days: int = SCREENSHOT_RETENTION_DAYS):
    """Remove screenshots antigos."""
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
    """Aguarda um tempo aleatório."""
    delay = random.uniform(min_seconds, max_seconds)
    logger.debug(f"Aguardando {delay:.2f} segundos...")
    time.sleep(delay)

def check_system_resources():
    """Verifica recursos do sistema."""
    try:
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')

        memory_percent = memory.percent
        disk_percent = disk.percent

        if memory_percent > 90:
            logger.warning(f"Memória alta: {memory_percent:.1f}%")

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
    """Decorator para retry com exponential backoff."""
    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            delay = initial_delay
            last_exception = None

            for attempt in range(1, max_retries + 1):
                try:
                    if hasattr(self, 'driver') and self.driver:
                        if not self.is_driver_healthy():
                            logger.warning("Driver não está saudável, reiniciando...")
                            self.setup_driver(restart=True)

                    return func(self, *args, **kwargs)

                except InvalidSessionIdException as e:
                    logger.error(f"Sessão inválida detectada: {e}")
                    if hasattr(self, 'setup_driver'):
                        logger.info("Recriando driver devido a sessão inválida...")
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
                        logger.error(f"Erro de conexão (tentativa {attempt}/{max_retries}): {error_msg[:200]}")
                    elif is_element_error:
                        logger.error(f"Erro de elemento (tentativa {attempt}/{max_retries}): {error_msg[:200]}")
                    else:
                        logger.error(f"Erro WebDriver (tentativa {attempt}/{max_retries}): {error_msg[:200]}")

                    if attempt == max_retries:
                        logger.error(f"FALHA FINAL após {max_retries} tentativas")
                        raise

                    jitter = random.uniform(0, 0.3 * delay)
                    wait_time = min(delay + jitter, max_delay)

                    logger.warning(f"Aguardando {wait_time:.1f}s antes da tentativa {attempt + 1}...")

                    if is_connection_error and attempt >= 2 and restart_driver_on_failure:
                        logger.info("Erro de conexão persistente, reiniciando driver...")
                        if hasattr(self, 'setup_driver'):
                            try:
                                self.setup_driver(restart=True)
                                logger.info("Driver reiniciado com sucesso")
                            except Exception as restart_error:
                                logger.error(f"Erro ao reiniciar driver: {restart_error}")

                    elif refresh_page_on_retry and hasattr(self, 'driver') and self.driver:
                        try:
                            logger.info("Tentando recarregar página...")
                            try:
                                alert = self.driver.switch_to.alert
                                alert.dismiss()
                            except:
                                pass

                            try:
                                self.driver.switch_to.default_content()
                            except:
                                pass

                            try:
                                self.driver.get(MV_REPORT_URL)
                                logger.info("Página recarregada")
                                time.sleep(random.uniform(5, 8))
                            except Exception as nav_error:
                                logger.warning(f"Erro ao navegar: {nav_error}")

                        except Exception as refresh_error:
                            logger.warning(f"Erro ao recarregar página: {refresh_error}")

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


class ProdutividadeOntemCollector:
    """Classe para coletar produtividade do dia anterior (ACESSOS + ESCALAS)."""

    def __init__(self):
        """Inicializa o coletor."""
        self.driver = None
        self.supabase = None
        self.consecutive_failures = 0
        self.processed_count = 0
        self.current_user_agent = random.choice(USER_AGENTS)
        self.driver_start_time = None
        self.last_health_check = 0

        # Data de ontem
        self.data_ontem = datetime.now() - timedelta(days=1)

        # Estatísticas
        self.stats = {
            'total': 0,
            'sucesso': 0,
            'erros': 0,
            'pulados': 0,
            'cpfs_acessos': 0,
            'cpfs_escalas': 0,
            'cpfs_unicos': 0
        }

        # Contadores de erros
        self.error_counts = {
            'timeout': 0,
            'connection': 0,
            'element_not_found': 0,
            'other': 0
        }

    def is_driver_healthy(self) -> bool:
        """Verifica se o driver está saudável."""
        if not self.driver:
            return False

        try:
            _ = self.driver.title

            if self.driver_start_time:
                age_minutes = (datetime.now() - self.driver_start_time).total_seconds() / 60
                if age_minutes > MAX_DRIVER_AGE_MINUTES:
                    logger.warning(f"Driver muito antigo ({age_minutes:.1f} min)")
                    return False

            return True

        except (InvalidSessionIdException, WebDriverException) as e:
            logger.warning(f"Driver não está saudável: {e}")
            return False
        except Exception as e:
            logger.warning(f"Erro ao verificar saúde do driver: {e}")
            return False

    def periodic_health_check(self):
        """Verificação periódica de saúde."""
        self.last_health_check += 1

        if self.last_health_check >= DRIVER_HEALTH_CHECK_INTERVAL:
            logger.info("Verificação de saúde periódica...")

            resources = check_system_resources()
            if not resources['healthy']:
                logger.warning("Recursos do sistema baixos, aguardando...")
                time.sleep(30)

            if not self.is_driver_healthy():
                logger.warning("Driver não saudável, reiniciando...")
                self.setup_driver(restart=True)

            self.last_health_check = 0

    def setup_driver(self, restart: bool = False):
        """Configura o driver do Selenium."""
        if restart and self.driver:
            logger.info("Reiniciando driver...")
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

        import shutil
        global GECKODRIVER_PATH
        if not os.path.exists(GECKODRIVER_PATH):
            logger.warning(f"Geckodriver não encontrado em: {GECKODRIVER_PATH}")
            geckodriver_path = shutil.which('geckodriver')
            if geckodriver_path:
                logger.info(f"Geckodriver encontrado em: {geckodriver_path}")
                GECKODRIVER_PATH = geckodriver_path
            else:
                raise FileNotFoundError("Geckodriver não encontrado.")

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

        options.binary_location = '/usr/bin/firefox-esr'

        logger.info("Limpando processos travados...")
        kill_zombie_processes()

        service = Service(
            executable_path=GECKODRIVER_PATH,
            log_output='/tmp/geckodriver.log'
        )

        try:
            logger.info("Iniciando Firefox headless...")
            self.driver = webdriver.Firefox(service=service, options=options)
            self.driver.set_page_load_timeout(PAGE_LOAD_TIMEOUT)
            self.driver.implicitly_wait(IMPLICIT_WAIT)
            self.driver_start_time = datetime.now()
            logger.info(f"Firefox driver configurado às {self.driver_start_time.strftime('%H:%M:%S')}")
        except Exception as e:
            logger.error(f"Erro ao configurar Firefox driver: {e}")
            kill_zombie_processes()
            raise

    def connect_supabase(self):
        """Conecta ao Supabase."""
        logger.info("Conectando ao Supabase...")
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise ValueError("VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY são obrigatórios")

        max_attempts = 3
        for attempt in range(1, max_attempts + 1):
            try:
                self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
                self.supabase.table('usuarios').select('id').limit(1).execute()
                logger.info("Conectado ao Supabase com sucesso")
                return
            except Exception as e:
                if attempt == max_attempts:
                    logger.error(f"Falha ao conectar no Supabase após {max_attempts} tentativas: {e}")
                    raise
                logger.warning(f"Tentativa {attempt}/{max_attempts} falhou...")
                time.sleep(5 * attempt)

    def clear_browser_data(self):
        """Limpa cookies e cache."""
        if not self.driver:
            return

        try:
            self.driver.delete_all_cookies()
            try:
                self.driver.execute_script("window.localStorage.clear();")
                self.driver.execute_script("window.sessionStorage.clear();")
            except Exception:
                pass
        except Exception as e:
            logger.warning(f"Erro ao limpar browser data: {e}")

    def should_restart_driver(self) -> bool:
        """Verifica se deve reiniciar o driver."""
        return self.processed_count > 0 and self.processed_count % DRIVER_RESTART_INTERVAL == 0

    def handle_consecutive_failures(self):
        """Circuit breaker pattern."""
        if self.consecutive_failures >= CONSECUTIVE_FAILURE_THRESHOLD:
            logger.warning(f"CIRCUIT BREAKER: {self.consecutive_failures} falhas consecutivas")
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
        """Busca usuários terceiros com codigomv."""
        logger.info("Buscando usuários terceiros...")
        try:
            query = self.supabase.table('usuarios').select(
                'id, nome, cpf, codigomv, especialidade'
            ).eq('tipo', 'terceiro').not_.is_('codigomv', 'null')

            if cpfs_filtro:
                logger.info(f"Filtrando por {len(cpfs_filtro)} CPFs específicos")
                query = query.in_('cpf', cpfs_filtro)

            response = query.execute()
            usuarios = response.data

            logger.info(f"Encontrados {len(usuarios)} usuários terceiros")
            return usuarios

        except Exception as e:
            logger.error(f"Erro ao buscar usuários terceiros: {e}")
            raise

    def formatar_data_mv(self, data: datetime) -> str:
        """Retorna a data no formato mm.dd.yyyy."""
        return data.strftime('%m.%d.%Y')

    def obter_data_iso(self, data: datetime) -> str:
        """Retorna a data no formato ISO (YYYY-MM-DD)."""
        return data.strftime('%Y-%m-%d')

    def buscar_cpfs_acessos_dia(self, data: datetime) -> Set[str]:
        """Busca CPFs que acessaram o hospital em um dia específico."""
        logger.info(f"Buscando CPFs de ACESSOS para {data.strftime('%d/%m/%Y')}...")
        try:
            data_iso = self.obter_data_iso(data)
            data_inicio = f"{data_iso} 00:00:00"
            data_fim_obj = data + timedelta(days=1)
            data_fim = data_fim_obj.strftime('%Y-%m-%d 00:00:00')

            response = self.supabase.table('acessos').select('cpf').gte(
                'data_acesso', data_inicio
            ).lt('data_acesso', data_fim).execute()

            if not response.data:
                logger.info(f"Nenhum acesso encontrado para {data.strftime('%d/%m/%Y')}")
                return set()

            cpfs = {acesso['cpf'] for acesso in response.data if acesso.get('cpf')}
            logger.info(f"Encontrados {len(response.data)} acessos com {len(cpfs)} CPFs únicos")

            return cpfs
        except Exception as e:
            logger.error(f"Erro ao buscar CPFs de acessos: {e}")
            return set()

    def buscar_cpfs_escalas_dia(self, data: datetime) -> Set[str]:
        """Busca CPFs de médicos com escalas em um dia específico."""
        logger.info(f"Buscando CPFs de ESCALAS para {data.strftime('%d/%m/%Y')}...")
        try:
            data_iso = self.obter_data_iso(data)

            response = self.supabase.table('escalas_medicas').select(
                'id, medicos'
            ).eq('data_inicio', data_iso).eq('ativo', True).execute()

            if not response.data:
                logger.info(f"Nenhuma escala encontrada para {data.strftime('%d/%m/%Y')}")
                return set()

            cpfs = set()
            for escala in response.data:
                medicos = escala.get('medicos', [])
                if isinstance(medicos, list):
                    for medico in medicos:
                        if isinstance(medico, dict) and medico.get('cpf'):
                            cpfs.add(medico['cpf'])

            logger.info(f"Encontradas {len(response.data)} escalas com {len(cpfs)} CPFs únicos")

            return cpfs
        except Exception as e:
            logger.error(f"Erro ao buscar CPFs de escalas: {e}")
            return set()

    def buscar_cpfs_combinados(self, data: datetime) -> List[str]:
        """
        Busca CPFs de ACESSOS e ESCALAS para um dia específico.
        Combina as duas fontes e retorna CPFs únicos.
        """
        logger.info(f"Buscando CPFs combinados (ACESSOS + ESCALAS) para {data.strftime('%d/%m/%Y')}...")

        # Buscar de ambas as fontes
        cpfs_acessos = self.buscar_cpfs_acessos_dia(data)
        cpfs_escalas = self.buscar_cpfs_escalas_dia(data)

        # Salvar estatísticas
        self.stats['cpfs_acessos'] = len(cpfs_acessos)
        self.stats['cpfs_escalas'] = len(cpfs_escalas)

        # Combinar (união dos conjuntos)
        cpfs_combinados = cpfs_acessos | cpfs_escalas
        self.stats['cpfs_unicos'] = len(cpfs_combinados)

        # Log detalhado
        apenas_acessos = cpfs_acessos - cpfs_escalas
        apenas_escalas = cpfs_escalas - cpfs_acessos
        ambos = cpfs_acessos & cpfs_escalas

        logger.info(f"Resumo de CPFs:")
        logger.info(f"   Apenas ACESSOS: {len(apenas_acessos)}")
        logger.info(f"   Apenas ESCALAS: {len(apenas_escalas)}")
        logger.info(f"   Em AMBOS: {len(ambos)}")
        logger.info(f"   TOTAL ÚNICO: {len(cpfs_combinados)}")

        return list(cpfs_combinados)

    def buscar_codigos_mv_ja_processados(self, data: datetime) -> Set[str]:
        """Busca codigo_mv que já têm produtividade para uma data."""
        logger.info(f"Verificando produtividade já coletada para {data.strftime('%d/%m/%Y')}...")
        try:
            data_iso = self.obter_data_iso(data)

            response = self.supabase.table('produtividade').select(
                'codigo_mv'
            ).eq('data', data_iso).execute()

            if not response.data:
                logger.info("Nenhuma produtividade encontrada para esta data")
                return set()

            codigos_processados = {str(item['codigo_mv']) for item in response.data if item.get('codigo_mv')}
            logger.info(f"Encontrados {len(codigos_processados)} médicos já processados")

            return codigos_processados
        except Exception as e:
            logger.error(f"Erro ao buscar produtividade existente: {e}")
            return set()

    @retry_with_exponential_backoff(
        max_retries=MAX_RETRIES,
        initial_delay=INITIAL_RETRY_DELAY,
        refresh_page_on_retry=True,
        restart_driver_on_failure=True
    )
    def preencher_formulario(self, codigo_mv: str, data_inicial: str, data_final: str):
        """Preenche o formulário do relatório MV."""
        wait = WebDriverWait(self.driver, ELEMENT_WAIT_TIMEOUT)

        try:
            logger.info(f"Preenchendo formulário...")
            logger.info(f"   Código: {codigo_mv}")
            logger.info(f"   Período: {data_inicial} até {data_final}")

            time.sleep(random.uniform(3, 5))

            try:
                alert = self.driver.switch_to.alert
                alert.dismiss()
                time.sleep(1)
            except:
                pass

            # Campo Código Prestador
            try:
                campo_codigo = wait.until(
                    EC.presence_of_element_located((By.XPATH, XPATH_CODIGO_PRESTADOR))
                )
                campo_codigo.clear()
                campo_codigo.send_keys(codigo_mv)
                time.sleep(random.uniform(1.5, 2.5))
            except TimeoutException:
                logger.error("Campo Código Prestador não encontrado")
                self.error_counts['element_not_found'] += 1
                raise

            # Campo Data Inicial
            try:
                campo_data_inicial = wait.until(
                    EC.presence_of_element_located((By.XPATH, XPATH_DATA_INICIAL))
                )
                campo_data_inicial.send_keys(Keys.CONTROL + "a")
                campo_data_inicial.send_keys(Keys.BACKSPACE)
                time.sleep(random.uniform(0.8, 1.2))
                campo_data_inicial.send_keys(data_inicial)
                time.sleep(random.uniform(1.5, 2.5))
            except TimeoutException:
                logger.error("Campo Data Inicial não encontrado")
                self.error_counts['element_not_found'] += 1
                raise

            # Campo Data Final
            try:
                campo_data_final = wait.until(
                    EC.presence_of_element_located((By.XPATH, XPATH_DATA_FINAL))
                )
                campo_data_final.send_keys(Keys.CONTROL + "a")
                campo_data_final.send_keys(Keys.BACKSPACE)
                time.sleep(random.uniform(0.8, 1.2))
                campo_data_final.send_keys(data_final)
                time.sleep(random.uniform(1.5, 2.5))
            except TimeoutException:
                logger.error("Campo Data Final não encontrado")
                self.error_counts['element_not_found'] += 1
                raise

            # Botão Submit
            try:
                botao_submit = wait.until(
                    EC.element_to_be_clickable((By.XPATH, XPATH_SUBMIT_BUTTON))
                )
            except TimeoutException:
                try:
                    botao_submit = wait.until(
                        EC.element_to_be_clickable((By.XPATH, "//td[contains(text(), 'Submit')]"))
                    )
                except TimeoutException:
                    logger.error("Botão Submit não encontrado")
                    self.error_counts['element_not_found'] += 1
                    raise

            logger.info("Clicando no botão Submit...")
            botao_submit.click()

            # Aguardar código aparecer
            logger.info(f"Aguardando código {codigo_mv} aparecer...")
            codigo_apareceu = False
            tempo_inicio = time.time()
            max_wait = TIMEOUT_CODIGO_APARECER

            while (time.time() - tempo_inicio) < max_wait:
                try:
                    xpath_codigo = XPATH_CAMPOS['codigo_mv']

                    try:
                        elem_codigo = self.driver.find_element(By.XPATH, xpath_codigo)
                        codigo_na_pagina = elem_codigo.text.strip()

                        if codigo_na_pagina == str(codigo_mv):
                            tempo_decorrido = time.time() - tempo_inicio
                            logger.info(f"Código {codigo_mv} apareceu após {tempo_decorrido:.1f}s")
                            codigo_apareceu = True
                            break
                    except:
                        pass

                    try:
                        iframe = self.driver.find_element(By.CSS_SELECTOR, "iframe[id*='Viewer']")
                        self.driver.switch_to.frame(iframe)

                        elem_codigo = self.driver.find_element(By.XPATH, xpath_codigo)
                        codigo_na_pagina = elem_codigo.text.strip()

                        self.driver.switch_to.default_content()

                        if codigo_na_pagina == str(codigo_mv):
                            tempo_decorrido = time.time() - tempo_inicio
                            logger.info(f"Código {codigo_mv} apareceu (iframe) após {tempo_decorrido:.1f}s")
                            codigo_apareceu = True
                            break
                    except:
                        self.driver.switch_to.default_content()

                    time.sleep(0.5)

                except Exception as e:
                    time.sleep(0.5)

            if not codigo_apareceu:
                tempo_decorrido = time.time() - tempo_inicio
                logger.warning(f"Código não apareceu após {tempo_decorrido:.1f}s, prosseguindo...")

            time.sleep(2)
            logger.info("Formulário preenchido e submetido com sucesso")

        except TimeoutException as e:
            logger.error(f"Timeout ao preencher formulário")
            self.error_counts['timeout'] += 1

            try:
                screenshot_path = f"/tmp/screenshot_erro_{codigo_mv}_{int(time.time())}.png"
                self.driver.save_screenshot(screenshot_path)
                logger.error(f"Screenshot salvo: {screenshot_path}")
            except:
                pass

            raise e

        except WebDriverException as e:
            if 'connection' in str(e).lower() or 'timeout' in str(e).lower():
                self.error_counts['connection'] += 1
            else:
                self.error_counts['other'] += 1
            raise e

        except Exception as e:
            self.error_counts['other'] += 1
            raise e

    def extrair_dados_tabela(self, codigo_mv: str, campos_extrair: List[str]) -> Optional[Dict]:
        """Extrai os dados usando XPaths específicos."""

        try:
            def get_xpath_text(xpath: str, campo_nome: str = "") -> str:
                try:
                    elemento = self.driver.find_element(By.XPATH, xpath)
                    texto = elemento.text.strip()
                    return texto
                except Exception:
                    return "0"

            codigo_encontrado = get_xpath_text(XPATH_CAMPOS['codigo_mv'], 'Código')

            if not codigo_encontrado or codigo_encontrado == "0":
                try:
                    wait = WebDriverWait(self.driver, 10)
                    iframe = wait.until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, "iframe[id*='Viewer']"))
                    )
                    self.driver.switch_to.frame(iframe)
                    codigo_encontrado = get_xpath_text(XPATH_CAMPOS['codigo_mv'], 'Código')
                except TimeoutException:
                    self.driver.switch_to.default_content()

            if codigo_encontrado != str(codigo_mv):
                logger.warning(f"Código encontrado ({codigo_encontrado}) != esperado ({codigo_mv})")

            dados = {
                'codigo_mv': codigo_encontrado,
                'nome': get_xpath_text(XPATH_CAMPOS['nome'], 'Nome'),
                'especialidade': get_xpath_text(XPATH_CAMPOS['especialidade'], 'Especialidade'),
                'vinculo': ''
            }

            for campo in campos_extrair:
                if campo in XPATH_CAMPOS:
                    valor_texto = get_xpath_text(XPATH_CAMPOS[campo], campo)
                    dados[campo] = self._converter_para_int(valor_texto)
                else:
                    dados[campo] = 0

            self.driver.switch_to.default_content()

            if dados['codigo_mv'] == "0" or not dados['nome']:
                logger.error(f"Não foi possível extrair dados para código {codigo_mv}")
                return None

            campos_str = ', '.join([f"{k}={v}" for k, v in dados.items() if k in campos_extrair])
            logger.info(f"Dados extraídos: {dados['nome']}")
            logger.info(f"   {campos_str}")

            return dados

        except Exception as e:
            logger.error(f"Erro ao extrair dados: {e}")
            self.driver.switch_to.default_content()
            return None

    def _converter_para_int(self, valor: str) -> int:
        """Converte string para int."""
        try:
            return int(valor) if valor and valor.strip() else 0
        except ValueError:
            return 0

    def inserir_produtividade(self, dados: Dict, data: datetime):
        """Insere os dados de produtividade no Supabase."""
        try:
            logger.debug(f"Salvando produtividade para {dados['nome']}...")

            data_iso = self.obter_data_iso(data)

            existing = self.supabase.table('produtividade').select('id').eq(
                'codigo_mv', dados['codigo_mv']
            ).eq('data', data_iso).execute()

            data_payload = {
                'nome': dados['nome'],
                'especialidade': dados['especialidade'],
                'vinculo': dados.get('vinculo', ''),
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
                'folha_objetivo_diario': dados.get('folha_objetivo_diario', 0),
                'evolucao_diurna_cti': dados.get('evolucao_diurna_cti', 0),
                'evolucao_noturna_cti': dados.get('evolucao_noturna_cti', 0),
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
            self.periodic_health_check()

            if self.should_restart_driver():
                logger.info(f"Reiniciando driver (processados: {self.processed_count})")
                self.clear_browser_data()
                self.setup_driver(restart=True)
                self.current_user_agent = random.choice(USER_AGENTS)

            self.handle_consecutive_failures()

            if self.processed_count > 0 and self.processed_count % 10 == 0:
                self.clear_browser_data()

            # =================================================================
            # BUSCA 1: Período D-2 até D-1
            # =================================================================
            logger.info(f"\nBUSCA 1/2: Período D-2 até D-1")
            logger.info(f"   Campos: {', '.join(CAMPOS_PERIODO_ANTERIOR)}")

            data_anterior = data - timedelta(days=1)
            data_inicial_str = self.formatar_data_mv(data_anterior)
            data_final_str = self.formatar_data_mv(data)

            logger.info(f"   {data_anterior.strftime('%d/%m/%Y')} -> {data.strftime('%d/%m/%Y')}")

            self.driver.get(MV_REPORT_URL)
            time.sleep(random.uniform(5, 8))

            self.preencher_formulario(codigo_mv, data_inicial_str, data_final_str)
            dados_periodo = self.extrair_dados_tabela(codigo_mv, CAMPOS_PERIODO_ANTERIOR)

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

            time.sleep(random.uniform(4, 7))

            # =================================================================
            # BUSCA 2: Mesmo dia D-1
            # =================================================================
            logger.info(f"\nBUSCA 2/2: Mesmo dia D-1")
            logger.info(f"   Campos: {', '.join(CAMPOS_MESMO_DIA)}")

            data_str = self.formatar_data_mv(data)
            logger.info(f"   {data.strftime('%d/%m/%Y')} -> {data.strftime('%d/%m/%Y')}")

            self.driver.get(MV_REPORT_URL)
            time.sleep(random.uniform(5, 8))

            self.preencher_formulario(codigo_mv, data_str, data_str)
            dados_mesmo_dia = self.extrair_dados_tabela(codigo_mv, CAMPOS_MESMO_DIA)

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

            logger.info(f"   Período D-2->D-1: {sum([dados_completos[c] for c in CAMPOS_PERIODO_ANTERIOR])} atividades")
            logger.info(f"   Mesmo dia D-1: {sum([dados_completos[c] for c in CAMPOS_MESMO_DIA])} atividades")

            self.inserir_produtividade(dados_completos, data)

            self.consecutive_failures = 0
            self.processed_count += 1

            logger.info(f"Usuário processado com sucesso")

            random_delay()

        except Exception as e:
            self.consecutive_failures += 1
            logger.error(f"Erro (falha #{self.consecutive_failures}): {str(e)[:200]}")
            raise e

    def executar(self):
        """Executa o processo para o dia anterior."""
        inicio = datetime.now()
        data_ontem = self.data_ontem
        data_str = data_ontem.strftime('%d/%m/%Y')

        logger.info(f"\n{'#'*70}")
        logger.info(f"COLETA DE PRODUTIVIDADE - DIA ANTERIOR (ONTEM)")
        logger.info(f"{'#'*70}")
        logger.info(f"Data processada: {data_str}")
        logger.info(f"Início: {inicio.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"")
        logger.info(f"CARACTERÍSTICAS:")
        logger.info(f"   - Busca ACESSOS (catracas) + ESCALAS médicas")
        logger.info(f"   - Pula médicos já coletados")
        logger.info(f"   - Ideal para execução diária via cron")
        logger.info(f"{'#'*70}\n")

        try:
            cleanup_old_screenshots()
            cleanup_temp_files()
            self.connect_supabase()
            self.setup_driver()

            # Buscar CPFs combinados (acessos + escalas)
            cpfs_dia = self.buscar_cpfs_combinados(data_ontem)

            if not cpfs_dia:
                logger.warning(f"Sem acessos ou escalas em {data_str}")
                return

            # Buscar usuários terceiros
            usuarios = self.buscar_usuarios_terceiros(cpfs_filtro=cpfs_dia)

            if not usuarios:
                logger.warning(f"Sem usuários terceiros com acessos/escalas em {data_str}")
                return

            # Filtrar já processados
            codigos_ja_processados = self.buscar_codigos_mv_ja_processados(data_ontem)
            usuarios_pulados = 0

            if codigos_ja_processados:
                usuarios_originais = len(usuarios)
                usuarios = [u for u in usuarios if str(u.get('codigomv', '')) not in codigos_ja_processados]
                usuarios_pulados = usuarios_originais - len(usuarios)

                if usuarios_pulados > 0:
                    logger.info(f"Pulando {usuarios_pulados} médicos já processados")
                    self.stats['pulados'] = usuarios_pulados

            if not usuarios:
                logger.info(f"Todos os médicos já foram processados para {data_str}")
                return

            total = len(usuarios)
            self.stats['total'] = total
            sucesso = 0
            erros = 0

            logger.info(f"{total} usuários para processar")

            # Processar cada usuário
            for index, usuario in enumerate(usuarios, 1):
                try:
                    self.processar_usuario(usuario, data_ontem, index, total)
                    sucesso += 1
                except Exception as e:
                    logger.error(f"Falha no usuário: {e}")
                    erros += 1
                    continue

            # Estatísticas finais
            fim = datetime.now()
            duracao = fim - inicio

            self.stats['sucesso'] = sucesso
            self.stats['erros'] = erros

            taxa = (sucesso / total * 100) if total > 0 else 0

            logger.info(f"\n{'#'*70}")
            logger.info(f"COLETA CONCLUÍDA - {data_str}")
            logger.info(f"{'#'*70}")
            logger.info(f"Término: {fim.strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info(f"Duração: {duracao}")
            logger.info(f"")
            logger.info(f"FONTES DE DADOS:")
            logger.info(f"   CPFs de ACESSOS: {self.stats['cpfs_acessos']}")
            logger.info(f"   CPFs de ESCALAS: {self.stats['cpfs_escalas']}")
            logger.info(f"   CPFs ÚNICOS: {self.stats['cpfs_unicos']}")
            logger.info(f"")
            logger.info(f"RESULTADOS:")
            logger.info(f"   Processados: {total}")
            logger.info(f"   Sucesso: {sucesso} ({taxa:.1f}%)")
            logger.info(f"   Erros: {erros}")
            logger.info(f"   Pulados (já coletados): {self.stats.get('pulados', 0)}")
            logger.info(f"   Buscas realizadas: {sucesso * 2}")
            logger.info(f"")
            logger.info(f"Estatísticas de erros:")
            logger.info(f"   Timeouts: {self.error_counts['timeout']}")
            logger.info(f"   Conexão: {self.error_counts['connection']}")
            logger.info(f"   Elementos: {self.error_counts['element_not_found']}")
            logger.info(f"   Outros: {self.error_counts['other']}")
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
    """Função principal."""
    collector = ProdutividadeOntemCollector()
    try:
        collector.executar()
    except KeyboardInterrupt:
        logger.info("\nInterrompido pelo usuário")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Erro fatal: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
