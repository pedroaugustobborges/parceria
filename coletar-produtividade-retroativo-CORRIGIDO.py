"""
Script aprimorado para coletar dados de produtividade do sistema MV por range de datas.
Versão com melhor tratamento de erros, timeouts e recuperação de falhas.

MELHORIAS:
- Detecção e tratamento de timeouts HTTP
- Recuperação automática de conexões
- Circuit breaker pattern melhorado
- Health checks do driver
- Retry mais inteligente
- Gerenciamento de memória
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
        logging.FileHandler('/var/log/produtividade-mv-range-dual.log'),
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
MAX_RETRIES = 5  # Aumentado de 3 para 5
INITIAL_RETRY_DELAY = 8  # Aumentado de 5 para 8
MAX_RETRY_DELAY = 120  # Aumentado de 60 para 120
DRIVER_RESTART_INTERVAL = 25  # Reduzido de 50 para 25 (reinicia mais frequentemente)
CONSECUTIVE_FAILURE_THRESHOLD = 3  # Reduzido de 5 para 3 (mais sensível)
MIN_DELAY_BETWEEN_REQUESTS = 10  # Aumentado de 8 para 10
MAX_DELAY_BETWEEN_REQUESTS = 20  # Aumentado de 15 para 20
SCREENSHOT_RETENTION_DAYS = 7
PAGE_LOAD_TIMEOUT = 240  # Aumentado de 180 para 240
IMPLICIT_WAIT = 8  # Aumentado de 5 para 8
ELEMENT_WAIT_TIMEOUT = 45  # Aumentado de 30 para 45

# Timeouts específicos para operações críticas
TIMEOUT_FORMULARIO = 60
TIMEOUT_TABELA = 90
TIMEOUT_SUBMIT = 45

# Health check do driver
DRIVER_HEALTH_CHECK_INTERVAL = 5  # Verifica saúde a cada 5 processamentos
MAX_DRIVER_AGE_MINUTES = 30  # Reinicia driver após 30 minutos

# User Agents para rotação
USER_AGENTS = [
    'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/116.0',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
]

# --- Range de Datas para Processar ---
DATA_INICIO = datetime(2026, 1, 6)  # 01/12/2025
DATA_FIM = datetime(2026, 1, 7)    # 29/12/2025

# --- XPaths do Formulário ---
BASE_CONTAINER = "//div[contains(@id, '_ParametersPanelContainer')]"
XPATH_CODIGO_PRESTADOR = f"{BASE_CONTAINER}//tr[2]/td[2]//input"
XPATH_DATA_INICIAL = f"{BASE_CONTAINER}//tr[1]/td[4]//input"
XPATH_DATA_FINAL = f"{BASE_CONTAINER}//tr[2]/td[4]//input"
XPATH_SUBMIT_BUTTON = f"{BASE_CONTAINER}//tr[4]/td[4]//td[contains(., 'Submit')]"

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
# UTILITÁRIOS DE RESILIÊNCIA APRIMORADOS
# ============================================================================

class TimeoutError(Exception):
    """Exceção customizada para timeout."""
    pass

class DriverHealthError(Exception):
    """Exceção para problemas de saúde do driver."""
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
        
        # Listar processos antes
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
        
        # Matar processos
        for attempt in range(3):
            subprocess.run("pkill -9 firefox 2>/dev/null || true", shell=True, timeout=5)
            subprocess.run("pkill -9 geckodriver 2>/dev/null || true", shell=True, timeout=5)
            time.sleep(1)
        
        # Verificar após
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
                logger.info(f"✅ Todos os {before_count} processos foram terminados")
            elif after_count > 0:
                logger.warning(f"⚠️ Ainda restam {after_count} processos rodando")
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
            logger.warning(f"⚠️ Memória alta: {memory_percent:.1f}%")
        
        if disk_percent > 90:
            logger.warning(f"⚠️ Disco alto: {disk_percent:.1f}%")
        
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
                    # Verificar saúde do driver antes de tentar
                    if hasattr(self, 'driver') and self.driver:
                        if not self.is_driver_healthy():
                            logger.warning("⚠️ Driver não está saudável, reiniciando...")
                            self.setup_driver(restart=True)
                    
                    return func(self, *args, **kwargs)
                    
                except InvalidSessionIdException as e:
                    logger.error(f"❌ Sessão inválida detectada: {e}")
                    if hasattr(self, 'setup_driver'):
                        logger.info("🔄 Recriando driver devido a sessão inválida...")
                        self.setup_driver(restart=True)
                    last_exception = e
                    
                except (TimeoutException, WebDriverException) as e:
                    last_exception = e
                    error_msg = str(e)
                    
                    # Detectar tipos específicos de erro
                    is_connection_error = any(x in error_msg.lower() for x in [
                        'connection', 'timeout', 'timed out', 'read timed out',
                        'httpconnectionpool', 'remoteerror'
                    ])
                    
                    is_element_error = any(x in error_msg.lower() for x in [
                        'no such element', 'stale element', 'element not found'
                    ])
                    
                    if is_connection_error:
                        logger.error(f"❌ Erro de conexão detectado (tentativa {attempt}/{max_retries}): {error_msg[:200]}")
                    elif is_element_error:
                        logger.error(f"❌ Erro de elemento detectado (tentativa {attempt}/{max_retries}): {error_msg[:200]}")
                    else:
                        logger.error(f"❌ Erro WebDriver (tentativa {attempt}/{max_retries}): {error_msg[:200]}")
                    
                    if attempt == max_retries:
                        logger.error(f"❌ FALHA FINAL após {max_retries} tentativas")
                        raise
                    
                    # Calcular tempo de espera com jitter
                    jitter = random.uniform(0, 0.3 * delay)
                    wait_time = min(delay + jitter, max_delay)
                    
                    logger.warning(
                        f"⚠️ Aguardando {wait_time:.1f}s antes da tentativa {attempt + 1}..."
                    )
                    
                    # Estratégia de recuperação baseada no tipo de erro
                    if is_connection_error and attempt >= 2 and restart_driver_on_failure:
                        logger.info("🔄 Erro de conexão persistente, reiniciando driver...")
                        if hasattr(self, 'setup_driver'):
                            try:
                                self.setup_driver(restart=True)
                                logger.info("✅ Driver reiniciado com sucesso")
                            except Exception as restart_error:
                                logger.error(f"❌ Erro ao reiniciar driver: {restart_error}")
                    
                    elif refresh_page_on_retry and hasattr(self, 'driver') and self.driver:
                        try:
                            logger.info("🔄 Tentando recarregar página...")
                            
                            # Fechar alertas
                            try:
                                alert = self.driver.switch_to.alert
                                alert.dismiss()
                                logger.info("Alert fechado")
                            except:
                                pass
                            
                            # Voltar ao contexto padrão
                            try:
                                self.driver.switch_to.default_content()
                            except:
                                pass
                            
                            # Navegar para URL
                            try:
                                self.driver.get(MV_REPORT_URL)
                                logger.info("✅ Página recarregada")
                                time.sleep(random.uniform(5, 8))
                            except Exception as nav_error:
                                logger.warning(f"Erro ao navegar: {nav_error}")
                                
                        except Exception as refresh_error:
                            logger.warning(f"Erro ao recarregar página: {refresh_error}")
                    
                    time.sleep(wait_time)
                    delay = min(delay * 2, max_delay)
                
                except Exception as e:
                    last_exception = e
                    logger.error(f"❌ Erro inesperado (tentativa {attempt}/{max_retries}): {e}")
                    
                    if attempt == max_retries:
                        raise
                    
                    time.sleep(min(delay, max_delay))
                    delay = min(delay * 2, max_delay)
            
            raise last_exception
        return wrapper
    return decorator

class ProdutividadeCollector:
    """Classe aprimorada para coletar dados de produtividade do MV."""
    
    def __init__(self):
        """Inicializa o coletor."""
        self.driver = None
        self.supabase = None
        self.consecutive_failures = 0
        self.processed_count = 0
        self.current_user_agent = random.choice(USER_AGENTS)
        self.driver_start_time = None
        self.last_health_check = 0
        
        # Estatísticas por dia
        self.stats_por_dia = {}
        
        # Contadores de erros
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
            # Tentar obter título da página
            _ = self.driver.title
            
            # Verificar idade do driver
            if self.driver_start_time:
                age_minutes = (datetime.now() - self.driver_start_time).total_seconds() / 60
                if age_minutes > MAX_DRIVER_AGE_MINUTES:
                    logger.warning(f"⚠️ Driver muito antigo ({age_minutes:.1f} min), requer reinicialização")
                    return False
            
            return True
            
        except (InvalidSessionIdException, WebDriverException) as e:
            logger.warning(f"⚠️ Driver não está saudável: {e}")
            return False
        except Exception as e:
            logger.warning(f"⚠️ Erro ao verificar saúde do driver: {e}")
            return False

    def periodic_health_check(self):
        """Realiza verificação periódica de saúde."""
        self.last_health_check += 1
        
        if self.last_health_check >= DRIVER_HEALTH_CHECK_INTERVAL:
            logger.info("🏥 Verificação de saúde periódica...")
            
            # Verificar recursos do sistema
            resources = check_system_resources()
            if not resources['healthy']:
                logger.warning("⚠️ Recursos do sistema baixos, aguardando...")
                time.sleep(30)
            
            # Verificar saúde do driver
            if not self.is_driver_healthy():
                logger.warning("⚠️ Driver não saudável, reiniciando...")
                self.setup_driver(restart=True)
            
            self.last_health_check = 0

    def setup_driver(self, restart: bool = False):
        """Configura o driver do Selenium com Firefox headless."""
        if restart and self.driver:
            logger.info("🔄 Reiniciando driver - fechando instância anterior...")
            try:
                self.driver.quit()
            except Exception as e:
                logger.warning(f"Erro ao fechar driver anterior: {e}")
            finally:
                self.driver = None
            
            # Limpar processos órfãos
            kill_zombie_processes()
            cleanup_temp_files()
            time.sleep(5)

        logger.info(f"🚀 Configurando Firefox driver...")
        logger.info(f"User-Agent: {self.current_user_agent[:60]}...")
        
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
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--disable-software-rasterizer')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--disable-extensions')
        options.add_argument('--disable-infobars')
        options.add_argument('--disable-notifications')
        options.add_argument('--disable-blink-features=AutomationControlled')
        
        # Preferências otimizadas
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

        logger.info("🧹 Limpando processos Firefox/Geckodriver travados...")
        kill_zombie_processes()

        service = Service(
            executable_path=GECKODRIVER_PATH,
            log_output='/tmp/geckodriver.log'
        )
        
        try:
            logger.info("🌐 Iniciando Firefox em modo headless...")
            self.driver = webdriver.Firefox(service=service, options=options)
            self.driver.set_page_load_timeout(PAGE_LOAD_TIMEOUT)
            self.driver.implicitly_wait(IMPLICIT_WAIT)
            self.driver_start_time = datetime.now()
            logger.info(f"✅ Firefox driver configurado com sucesso às {self.driver_start_time.strftime('%H:%M:%S')}")
        except Exception as e:
            logger.error(f"❌ Erro ao configurar Firefox driver: {e}")
            kill_zombie_processes()
            raise

    def connect_supabase(self):
        """Conecta ao Supabase com retry."""
        logger.info("📡 Conectando ao Supabase...")
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise ValueError("VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY são obrigatórios")
        
        max_attempts = 3
        for attempt in range(1, max_attempts + 1):
            try:
                self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
                # Testar conexão
                self.supabase.table('usuarios').select('id').limit(1).execute()
                logger.info("✅ Conectado ao Supabase com sucesso")
                return
            except Exception as e:
                if attempt == max_attempts:
                    logger.error(f"❌ Falha ao conectar no Supabase após {max_attempts} tentativas: {e}")
                    raise
                logger.warning(f"⚠️ Tentativa {attempt}/{max_attempts} falhou, tentando novamente...")
                time.sleep(5 * attempt)

    def clear_browser_data(self):
        """Limpa cookies e cache do navegador."""
        if not self.driver:
            return
        
        try:
            logger.debug("🧹 Limpando cookies e cache do navegador...")
            self.driver.delete_all_cookies()
            try:
                self.driver.execute_script("window.localStorage.clear();")
                self.driver.execute_script("window.sessionStorage.clear();")
            except Exception:
                pass
            logger.debug("✅ Browser data limpo com sucesso")
        except Exception as e:
            logger.warning(f"⚠️ Erro ao limpar browser data: {e}")

    def should_restart_driver(self) -> bool:
        """Verifica se o driver deve ser reiniciado."""
        return self.processed_count > 0 and self.processed_count % DRIVER_RESTART_INTERVAL == 0

    def handle_consecutive_failures(self):
        """Implementa circuit breaker pattern melhorado."""
        if self.consecutive_failures >= CONSECUTIVE_FAILURE_THRESHOLD:
            logger.warning(
                f"🔴 CIRCUIT BREAKER: {self.consecutive_failures} falhas consecutivas detectadas"
            )
            logger.info(f"Estatísticas de erros: {self.error_counts}")
            logger.info("Pausando por 60s e reiniciando driver...")
            
            time.sleep(60)
            
            # Limpar tudo
            kill_zombie_processes()
            cleanup_temp_files()
            time.sleep(5)
            
            # Reiniciar
            self.setup_driver(restart=True)
            self.current_user_agent = random.choice(USER_AGENTS)
            self.consecutive_failures = 0
            logger.info("✅ Circuit breaker: Sistema reiniciado")

    def buscar_usuarios_terceiros(self, cpfs_filtro: Optional[List[str]] = None) -> List[Dict]:
        """Busca usuários do tipo 'terceiro' com codigomv."""
        logger.info("👥 Buscando usuários terceiros...")
        try:
            query = self.supabase.table('usuarios').select(
                'id, nome, cpf, codigomv, especialidade'
            ).eq('tipo', 'terceiro').not_.is_('codigomv', 'null')
            
            if cpfs_filtro:
                logger.info(f"Filtrando por {len(cpfs_filtro)} CPFs específicos")
                query = query.in_('cpf', cpfs_filtro)
            
            response = query.execute()
            usuarios = response.data
            
            logger.info(f"✅ Encontrados {len(usuarios)} usuários terceiros")
            return usuarios
            
        except Exception as e:
            logger.error(f"❌ Erro ao buscar usuários terceiros: {e}")
            raise

    def formatar_data_mv(self, data: datetime) -> str:
        """Retorna a data no formato mm.dd.yyyy."""
        return data.strftime('%m.%d.%Y')

    def obter_data_iso(self, data: datetime) -> str:
        """Retorna a data no formato ISO (YYYY-MM-DD)."""
        return data.strftime('%Y-%m-%d')

    def buscar_cpfs_acessos_dia(self, data: datetime) -> List[str]:
        """Busca CPFs únicos que acessaram o sistema em um dia específico."""
        logger.info(f"📅 Buscando CPFs que acessaram em {data.strftime('%d/%m/%Y')}...")
        try:
            data_iso = self.obter_data_iso(data)
            data_inicio = f"{data_iso} 00:00:00"
            data_fim_obj = data + timedelta(days=1)
            data_fim = data_fim_obj.strftime('%Y-%m-%d 00:00:00')
            
            response = self.supabase.table('acessos').select('cpf').gte(
                'data_acesso', data_inicio
            ).lt('data_acesso', data_fim).execute()
            
            if not response.data:
                logger.warning(f"⚠️ Nenhum acesso encontrado para {data.strftime('%d/%m/%Y')}")
                return []
            
            cpfs = list(set([acesso['cpf'] for acesso in response.data if acesso.get('cpf')]))
            logger.info(f"✅ Encontrados {len(response.data)} acessos com {len(cpfs)} CPFs únicos")
            
            return cpfs
        except Exception as e:
            logger.error(f"❌ Erro ao buscar CPFs de acessos: {e}")
            raise

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
            logger.info(f"📝 Preenchendo formulário...")
            logger.info(f"   Código: {codigo_mv}")
            logger.info(f"   Período: {data_inicial} até {data_final}")
            
            # Aguardar carregamento inicial
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
            logger.debug("Localizando campo Código Prestador...")
            try:
                campo_codigo = wait.until(
                    EC.presence_of_element_located((By.XPATH, XPATH_CODIGO_PRESTADOR))
                )
                campo_codigo.clear()
                campo_codigo.send_keys(codigo_mv)
                time.sleep(random.uniform(1.5, 2.5))
                logger.debug("✅ Código preenchido")
            except TimeoutException:
                logger.error("❌ Campo Código Prestador não encontrado")
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
                logger.debug("✅ Data inicial preenchida")
            except TimeoutException:
                logger.error("❌ Campo Data Inicial não encontrado")
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
                logger.debug("✅ Data final preenchida")
            except TimeoutException:
                logger.error("❌ Campo Data Final não encontrado")
                self.error_counts['element_not_found'] += 1
                raise
            
            # Botão Submit
            logger.debug("Procurando botão Submit...")
            try:
                botao_submit = wait.until(
                    EC.element_to_be_clickable((By.XPATH, XPATH_SUBMIT_BUTTON))
                )
                logger.debug("✅ Botão Submit encontrado")
            except TimeoutException:
                try:
                    botao_submit = wait.until(
                        EC.element_to_be_clickable((By.XPATH, "//td[contains(text(), 'Submit')]"))
                    )
                    logger.debug("✅ Botão Submit encontrado (fallback)")
                except TimeoutException:
                    logger.error("❌ Botão Submit não encontrado")
                    self.error_counts['element_not_found'] += 1
                    raise
            
            logger.info("🔘 Clicando no botão Submit...")
            botao_submit.click()
            
            # Aguardar carregamento do relatório
            delay = random.uniform(15, 22)
            logger.info(f"⏳ Aguardando carregamento do relatório ({delay:.1f}s)...")
            time.sleep(delay)
            
            logger.info("✅ Formulário preenchido e submetido com sucesso")
            
        except TimeoutException as e:
            logger.error(f"❌ Timeout ao preencher formulário")
            self.error_counts['timeout'] += 1
            
            # Salvar screenshot
            try:
                screenshot_path = f"/tmp/screenshot_erro_{codigo_mv}_{int(time.time())}.png"
                self.driver.save_screenshot(screenshot_path)
                logger.error(f"📸 Screenshot salvo em: {screenshot_path}")
            except Exception as se:
                logger.error(f"Falha ao salvar screenshot: {se}")
            
            raise e
            
        except WebDriverException as e:
            if 'connection' in str(e).lower() or 'timeout' in str(e).lower():
                self.error_counts['connection'] += 1
                logger.error(f"❌ Erro de conexão ao preencher formulário")
            else:
                self.error_counts['other'] += 1
            raise e
            
        except Exception as e:
            self.error_counts['other'] += 1
            logger.error(f"❌ Erro inesperado ao preencher formulário: {e}")
            raise e

    def extrair_dados_tabela(self, codigo_mv: str, campos_extrair: List[str]) -> Optional[Dict]:
        """Extrai os dados da tabela de produtividade."""
        wait = WebDriverWait(self.driver, TIMEOUT_TABELA)
        
        def tentar_extrair_dados() -> Optional[Dict]:
            try:
                logger.debug(f"🔍 Buscando dados para código {codigo_mv}")
                logger.debug(f"   Campos: {', '.join(campos_extrair)}")
                
                time.sleep(3)
                
                # Buscar tabela via cabeçalho
                target_table = None
                try:
                    header_cells = self.driver.find_elements(By.XPATH, "//td[contains(text(), 'CÓD.')]")
                    if header_cells:
                        logger.debug(f"Encontradas {len(header_cells)} células com cabeçalho 'CÓD.'")
                        for header_cell in header_cells:
                            try:
                                parent_table = header_cell.find_element(By.XPATH, "./ancestor::table[1]")
                                tbody = parent_table.find_element(By.TAG_NAME, "tbody")
                                rows = tbody.find_elements(By.TAG_NAME, "tr")
                                if len(rows) > 2:
                                    logger.debug(f"✅ Tabela encontrada com {len(rows)} linhas")
                                    target_table = parent_table
                                    break
                            except:
                                continue
                except Exception as e:
                    logger.debug(f"Busca via cabeçalho falhou: {e}")
                
                if target_table:
                    tbody = target_table.find_element(By.TAG_NAME, "tbody")
                    rows = tbody.find_elements(By.TAG_NAME, "tr")
                    
                    for row_idx, row in enumerate(rows, 1):
                        cells = row.find_elements(By.TAG_NAME, "td")
                        if len(cells) > 0:
                            first_cell = cells[0].text.strip()
                            if first_cell == str(codigo_mv):
                                logger.info(f"✅ Código {codigo_mv} encontrado na linha {row_idx}")
                                
                                def get_cell_text(index: int) -> str:
                                    try:
                                        if index < len(cells):
                                            return cells[index].text.strip()
                                        return "0"
                                    except:
                                        return "0"
                                
                                dados = {
                                    'codigo_mv': get_cell_text(0),
                                    'nome': get_cell_text(1),
                                    'especialidade': get_cell_text(2),
                                    'vinculo': get_cell_text(3)
                                }
                                
                                mapa_indices = {
                                    'procedimento': 4,
                                    'parecer_solicitado': 5,
                                    'parecer_realizado': 6,
                                    'cirurgia_realizada': 7,
                                    'prescricao': 8,
                                    'evolucao': 9,
                                    'urgencia': 10,
                                    'ambulatorio': 11,
                                    'auxiliar': 12,
                                    'encaminhamento': 13,
                                    'folha_objetivo_diario': 14,
                                    'evolucao_diurna_cti': 15,
                                    'evolucao_noturna_cti': 16
                                }
                                
                                for campo in campos_extrair:
                                    if campo in mapa_indices:
                                        dados[campo] = self._converter_para_int(get_cell_text(mapa_indices[campo]))
                                
                                campos_str = ', '.join([f"{k}={v}" for k, v in dados.items() if k in campos_extrair])
                                logger.info(f"   {dados['nome']}: {campos_str}")
                                return dados
                    
                    logger.warning(f"⚠️ Código {codigo_mv} não encontrado na tabela")
                
                # Fallback
                logger.debug("Tentando fallback: buscar em todas as tabelas...")
                all_tables = self.driver.find_elements(By.TAG_NAME, "table")
                tables_to_check = all_tables[:min(50, len(all_tables))]
                
                for table_idx, table in enumerate(tables_to_check, 1):
                    try:
                        tbody = table.find_element(By.TAG_NAME, "tbody")
                        rows = tbody.find_elements(By.TAG_NAME, "tr")
                        
                        if len(rows) < 2:
                            continue
                        
                        for row in rows:
                            cells = row.find_elements(By.TAG_NAME, "td")
                            if len(cells) > 0:
                                first_cell = cells[0].text.strip()
                                if first_cell == str(codigo_mv):
                                    logger.info(f"✅ Código {codigo_mv} encontrado (fallback - tabela {table_idx})")
                                    
                                    def get_cell_text(index: int) -> str:
                                        try:
                                            if index < len(cells):
                                                return cells[index].text.strip()
                                            return "0"
                                        except:
                                            return "0"
                                    
                                    dados = {
                                        'codigo_mv': get_cell_text(0),
                                        'nome': get_cell_text(1),
                                        'especialidade': get_cell_text(2),
                                        'vinculo': get_cell_text(3)
                                    }
                                    
                                    mapa_indices = {
                                        'procedimento': 4,
                                        'parecer_solicitado': 5,
                                        'parecer_realizado': 6,
                                        'cirurgia_realizada': 7,
                                        'prescricao': 8,
                                        'evolucao': 9,
                                        'urgencia': 10,
                                        'ambulatorio': 11,
                                        'auxiliar': 12,
                                        'encaminhamento': 13,
                                        'folha_objetivo_diario': 14,
                                        'evolucao_diurna_cti': 15,
                                        'evolucao_noturna_cti': 16
                                    }
                                    
                                    for campo in campos_extrair:
                                        if campo in mapa_indices:
                                            dados[campo] = self._converter_para_int(get_cell_text(mapa_indices[campo]))
                                    
                                    return dados
                    except:
                        continue
                
                logger.error(f"❌ Código {codigo_mv} não encontrado em nenhuma tabela")
                return None
                
            except Exception as e:
                logger.error(f"❌ Erro na extração: {e}")
                return None
        
        try:
            # Tentar na página principal
            dados = tentar_extrair_dados()
            if dados:
                return dados
            
            # Tentar dentro de iframe
            logger.debug("Tentando extrair de iframe...")
            try:
                iframe = wait.until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "iframe[id*='Viewer']"))
                )
                self.driver.switch_to.frame(iframe)
                logger.debug("Mudança para iframe bem-sucedida")
                dados = tentar_extrair_dados()
                self.driver.switch_to.default_content()
                if dados:
                    return dados
            except TimeoutException:
                self.driver.switch_to.default_content()
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Erro ao extrair dados: {e}")
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
            logger.debug(f"💾 Salvando produtividade para {dados['nome']}...")
            
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
                'folha_objetivo_diario': dados.get('folha_objetivo_diario', 0),
                'evolucao_diurna_cti': dados.get('evolucao_diurna_cti', 0),
                'evolucao_noturna_cti': dados.get('evolucao_noturna_cti', 0),
            }
            
            if existing.data and len(existing.data) > 0:
                self.supabase.table('produtividade').update(data_payload).eq(
                    'id', existing.data[0]['id']
                ).execute()
                logger.debug("✅ Registro atualizado")
            else:
                data_payload['codigo_mv'] = dados['codigo_mv']
                data_payload['data'] = data_iso
                self.supabase.table('produtividade').insert(data_payload).execute()
                logger.debug("✅ Novo registro inserido")
            
        except Exception as e:
            logger.error(f"❌ Erro ao inserir produtividade: {e}")
            raise

    def processar_usuario(self, usuario: Dict, data: datetime, index: int, total: int):
        """Processa um único usuário fazendo DUAS buscas."""
        codigo_mv = usuario['codigomv']
        nome = usuario['nome']
        
        logger.info(f"\n{'='*70}")
        logger.info(f"👤 [{index}/{total}] {nome} (MV: {codigo_mv})")
        logger.info(f"{'='*70}")
        
        try:
            # Health check periódico
            self.periodic_health_check()
            
            # Reiniciar driver se necessário
            if self.should_restart_driver():
                logger.info(f"🔄 Reiniciando driver (processados: {self.processed_count})")
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
            logger.info(f"\n📊 BUSCA 1/2: Período D-1 até D")
            logger.info(f"   Campos: {', '.join(CAMPOS_PERIODO_ANTERIOR)}")
            
            data_anterior = data - timedelta(days=1)
            data_inicial_str = self.formatar_data_mv(data_anterior)
            data_final_str = self.formatar_data_mv(data)
            
            logger.info(f"   {data_anterior.strftime('%d/%m/%Y')} → {data.strftime('%d/%m/%Y')}")
            
            self.driver.get(MV_REPORT_URL)
            time.sleep(random.uniform(5, 8))
            
            self.preencher_formulario(codigo_mv, data_inicial_str, data_final_str)
            dados_periodo = self.extrair_dados_tabela(codigo_mv, CAMPOS_PERIODO_ANTERIOR)
            
            if not dados_periodo:
                logger.warning(f"⚠️ Sem dados na busca 1")
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
            logger.info(f"\n📊 BUSCA 2/2: Mesmo dia D até D")
            logger.info(f"   Campos: {', '.join(CAMPOS_MESMO_DIA)}")
            
            data_str = self.formatar_data_mv(data)
            logger.info(f"   {data.strftime('%d/%m/%Y')} → {data.strftime('%d/%m/%Y')}")
            
            self.driver.get(MV_REPORT_URL)
            time.sleep(random.uniform(5, 8))
            
            self.preencher_formulario(codigo_mv, data_str, data_str)
            dados_mesmo_dia = self.extrair_dados_tabela(codigo_mv, CAMPOS_MESMO_DIA)
            
            if not dados_mesmo_dia:
                logger.warning(f"⚠️ Sem dados na busca 2")
                dados_mesmo_dia = {}
                for campo in CAMPOS_MESMO_DIA:
                    dados_mesmo_dia[campo] = 0
            
            # =================================================================
            # COMBINAR DADOS
            # =================================================================
            logger.info(f"\n✅ Combinando dados...")
            
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
            
            logger.info(f"   Período D-1→D: {sum([dados_completos[c] for c in CAMPOS_PERIODO_ANTERIOR])} atividades")
            logger.info(f"   Mesmo dia D: {sum([dados_completos[c] for c in CAMPOS_MESMO_DIA])} atividades")
            
            # Salvar
            self.inserir_produtividade(dados_completos, data)
            
            self.consecutive_failures = 0
            self.processed_count += 1
            
            logger.info(f"✅ Usuário processado com sucesso")
            
            random_delay()
            
        except Exception as e:
            self.consecutive_failures += 1
            logger.error(f"❌ Erro (falha #{self.consecutive_failures}): {str(e)[:200]}")
            raise e

    def processar_dia(self, data: datetime):
        """Processa todos os usuários para um dia específico."""
        data_str = data.strftime('%d/%m/%Y')
        
        logger.info(f"\n{'#'*70}")
        logger.info(f"📅 PROCESSANDO: {data_str}")
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
                logger.warning(f"⚠️ Sem acessos em {data_str}")
                return
            
            # Buscar usuários
            usuarios = self.buscar_usuarios_terceiros(cpfs_filtro=cpfs_dia)
            
            if not usuarios:
                logger.warning(f"⚠️ Sem usuários terceiros em {data_str}")
                return
            
            total = len(usuarios)
            self.stats_por_dia[data_str]['total'] = total
            sucesso = 0
            erros = 0
            
            logger.info(f"🎯 {total} usuários para processar")
            
            # Processar cada usuário
            for index, usuario in enumerate(usuarios, 1):
                try:
                    self.processar_usuario(usuario, data, index, total)
                    sucesso += 1
                except Exception as e:
                    logger.error(f"❌ Falha no usuário: {e}")
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
            logger.info(f"📊 RESUMO: {data_str}")
            logger.info(f"{'='*70}")
            logger.info(f"Total: {total} | Sucesso: {sucesso} ({taxa:.1f}%) | Erros: {erros}")
            logger.info(f"Duração: {duracao}")
            logger.info(f"{'='*70}\n")
            
        except Exception as e:
            logger.error(f"❌ Erro crítico no dia {data_str}: {e}")
            raise

    def executar(self):
        """Executa o processo completo."""
        inicio = datetime.now()
        
        logger.info(f"\n{'#'*70}")
        logger.info(f"🚀 INÍCIO DA COLETA - MODO DUAL")
        logger.info(f"{'#'*70}")
        logger.info(f"📅 Período: {DATA_INICIO.strftime('%d/%m/%Y')} até {DATA_FIM.strftime('%d/%m/%Y')}")
        logger.info(f"🕐 Início: {inicio.strftime('%Y-%m-%d %H:%M:%S')}")
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
                    logger.error(f"❌ Erro no dia {data_atual.strftime('%d/%m/%Y')}: {e}")
                
                data_atual += timedelta(days=1)
                
                if data_atual <= DATA_FIM:
                    time.sleep(random.uniform(8, 15))
            
            # Resumo final
            fim = datetime.now()
            duracao = fim - inicio
            
            logger.info(f"\n{'#'*70}")
            logger.info(f"🎉 COLETA CONCLUÍDA")
            logger.info(f"{'#'*70}")
            logger.info(f"🕐 Término: {fim.strftime('%Y-%m-%d %H:%M:%S')}")
            logger.info(f"⏱️  Duração total: {duracao}")
            logger.info(f"📅 Dias processados: {dias}")
            logger.info(f"")
            logger.info(f"📊 ESTATÍSTICAS POR DIA:")
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
                    f"✅ {stats['sucesso']} ({taxa:.1f}%) | "
                    f"❌ {stats['erros']} | "
                    f"⏱️  {stats['duracao']}"
                )
            
            logger.info(f"{'='*70}")
            logger.info(f"TOTAIS:")
            logger.info(f"  👥 Usuários: {total_usuarios}")
            logger.info(f"  ✅ Sucesso: {total_sucesso}")
            logger.info(f"  ❌ Erros: {total_erros}")
            logger.info(f"  🔍 Buscas: {total_sucesso * 2}")
            
            if total_usuarios > 0:
                taxa_geral = (total_sucesso / total_usuarios * 100)
                logger.info(f"  📈 Taxa de sucesso: {taxa_geral:.1f}%")
            
            logger.info(f"")
            logger.info(f"🔧 Estatísticas de erros:")
            logger.info(f"  Timeouts: {self.error_counts['timeout']}")
            logger.info(f"  Conexão: {self.error_counts['connection']}")
            logger.info(f"  Elementos: {self.error_counts['element_not_found']}")
            logger.info(f"  Outros: {self.error_counts['other']}")
            logger.info(f"{'#'*70}\n")
            
        except Exception as e:
            logger.error(f"❌ Erro fatal: {e}", exc_info=True)
            raise
        finally:
            if self.driver:
                logger.info("🔒 Fechando navegador...")
                try:
                    self.driver.quit()
                except:
                    pass
                kill_zombie_processes()

def main():
    """Função principal."""
    collector = ProdutividadeCollector()
    try:
        collector.executar()
    except KeyboardInterrupt:
        logger.info("\n⚠️ Interrompido pelo usuário")
        sys.exit(0)
    except Exception as e:
        logger.error(f"❌ Erro fatal: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()