import ctypes
import time

# Constantes da API do Windows
ES_CONTINUOUS = 0x80000000
ES_SYSTEM_REQUIRED = 0x00000001
ES_DISPLAY_REQUIRED = 0x00000002

# Configuração
DURACAO_TOTAL_SEGUNDOS = 11 * 60 * 60  # 11 horas

def prevenir_suspensao():
    """Informa ao Windows para não dormir."""
    print("Prevenção de suspensão ATIVADA.")
    ctypes.windll.kernel32.SetThreadExecutionState(
        ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED
    )

def permitir_suspensao():
    """Libera o Windows para dormir normalmente."""
    print("\nPrevenção de suspensão DESATIVADA. O PC pode hibernar.")
    ctypes.windll.kernel32.SetThreadExecutionState(
        ES_CONTINUOUS
    )

# --- Execução Principal ---
start_time = time.time()
end_time = start_time + DURACAO_TOTAL_SEGUNDOS

prevenir_suspensao()

try:
    while time.time() < end_time:
        tempo_restante = int(end_time - time.time())
        # Atualiza o console a cada segundo
        horas, rem = divmod(tempo_restante, 3600)
        minutos, segundos = divmod(rem, 60)
        # Adiciona espaços no final para limpar a linha anterior
        print(f"Script em execução. Tempo restante: {horas:02}:{minutos:02}:{segundos:02}   ", end="\r")
        
        time.sleep(1) # Dorme por 1 segundo e verifica o tempo novamente

except KeyboardInterrupt:
    print("\nScript interrompido pelo usuário (Ctrl+C).")

finally:
    # ISSO É MUITO IMPORTANTE:
    # Garante que o estado normal seja restaurado ao sair
    permitir_suspensao()
    print("Script encerrado.")