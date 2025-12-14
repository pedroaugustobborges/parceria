import sys
import codecs
if sys.platform == 'win32':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

from datetime import datetime
from dateutil import parser
import pytz

# Simular o que acontece atualmente
print("=" * 70)
print("COMPARACAO: ANTES vs DEPOIS DA CORRECAO")
print("=" * 70)

# Exemplo real do seu banco
timestamp_atual = "2025-10-07T14:35:37+00:00"

print("\nSITUACAO ATUAL (INCORRETA):")
print(f"   Armazenado no banco: {timestamp_atual}")
dt_atual = parser.isoparse(timestamp_atual)
print(f"   O que o browser exibe: {dt_atual.astimezone(pytz.timezone('America/Sao_Paulo')).strftime('%d/%m/%Y %H:%M:%S')}")
print(f"   >>> Horario incorreto! (3 horas a menos)")

print("\nAPOS CORRECAO:")
timestamp_corrigido = "2025-10-07T14:35:37-03:00"
print(f"   Armazenado no banco: {timestamp_corrigido}")
dt_corrigido = parser.isoparse(timestamp_corrigido)
print(f"   O que o browser exibe: {dt_corrigido.astimezone(pytz.timezone('America/Sao_Paulo')).strftime('%d/%m/%Y %H:%M:%S')}")
print(f"   >>> Horario correto!")

print("\n" + "=" * 70)
print("RESUMO")
print("=" * 70)
print("Horario real do acesso: 14:35:37 (Brasilia)")
print(f"Antes da correcao, exibia: {dt_atual.astimezone(pytz.timezone('America/Sao_Paulo')).strftime('%H:%M:%S')}")
print(f"Depois da correcao, exibira: {dt_corrigido.astimezone(pytz.timezone('America/Sao_Paulo')).strftime('%H:%M:%S')}")
print("=" * 70)
