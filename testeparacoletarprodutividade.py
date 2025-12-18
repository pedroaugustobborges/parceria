import os
import datetime
import shutil
from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import csv
import pyautogui
import time
from datetime import datetime
import pyperclip
import re
import base64
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import matplotlib.pyplot as plt


# --- CONFIGURAÇÃO INICIAL ---

# Especificar o caminho para o executável do geckodriver
geckodriver_path = "C:\\Users\\16144-pedro\\Documents\\bot_solicitacao\\geckodriver.exe"

# Criar um objeto Service com o caminho do executável
service = Service(geckodriver_path)

# Criar um driver Firefox usando o objeto Service
driver = webdriver.Firefox(service=service)

# Configurar uma espera explícita
wait = WebDriverWait(driver, 20) 

driver.maximize_window()
driver.get("http://mvpepprd.saude.go.gov.br/report-executor/report-viewer?id=7076")

# --- PASSO 1: INSERIR O CÓDIGO "12110" ---

try:
    print("Passo 1: Inserindo o código '12110'...")
    
    input_codigo_xpath = "/html/body/div/div/div[46]/div/div/table/tbody/tr[2]/td[2]/table/tbody/tr/td/input"
    input_codigo = wait.until(EC.element_to_be_clickable((By.XPATH, input_codigo_xpath)))
    
    input_codigo.clear()
    input_codigo.send_keys("12110")
    print("Código '12110' inserido.")
    
    time.sleep(2) # PAUSA DE 2 SEGUNDOS

except Exception as e:
    print(f"Erro no Passo 1 (Inserir Código): {e}")
    driver.quit()
    exit()

# --- PASSO 2: INSERIR DATA INÍCIO (JS + DISPARO DE EVENTOS) ---

try:
    print("Passo 2: Inserindo Data Início '30.11.2025' via JavaScript e disparando eventos...")
    
    input_data_inicio_xpath = "/html/body/div/div/div[46]/div/div/table/tbody/tr[1]/td[4]/table/tbody/tr/td[1]/input"
    input_data_inicio = wait.until(EC.presence_of_element_located((By.XPATH, input_data_inicio_xpath)))
    
    # 1. Executa JavaScript para definir o valor no DOM
    driver.execute_script("arguments[0].value = '30.11.2025';", input_data_inicio)
    
    # 2. Executa JavaScript para disparar o evento 'change' (mudança de valor)
    driver.execute_script("arguments[0].dispatchEvent(new Event('change'));", input_data_inicio)
    
    # 3. Executa JavaScript para disparar o evento 'blur' (perda de foco)
    driver.execute_script("arguments[0].dispatchEvent(new Event('blur'));", input_data_inicio)
    
    print("Data Início '30.11.2025' inserida e eventos de validação disparados.")

    time.sleep(2) # PAUSA DE 2 SEGUNDOS

except Exception as e:
    print(f"Erro no Passo 2 (Data Início - Eventos): {e}")
    driver.quit()
    exit()

# --- PASSO 3: INSERIR DATA FINAL (JS + DISPARO DE EVENTOS) ---

try:
    print("Passo 3: Inserindo Data Final '01.12.2025' via JavaScript e disparando eventos...")
    
    input_data_final_xpath = "/html/body/div/div/div[46]/div/div/table/tbody/tr[2]/td[4]/table/tbody/tr/td[1]/input"
    input_data_final = wait.until(EC.presence_of_element_located((By.XPATH, input_data_final_xpath)))
    
    # 1. Executa JavaScript para definir o valor no DOM
    driver.execute_script("arguments[0].value = '01.12.2025';", input_data_final)
    
    # 2. Executa JavaScript para disparar o evento 'change' (mudança de valor)
    driver.execute_script("arguments[0].dispatchEvent(new Event('change'));", input_data_final)
    
    # 3. Executa JavaScript para disparar o evento 'blur' (perda de foco)
    driver.execute_script("arguments[0].dispatchEvent(new Event('blur'));", input_data_final)
    
    print("Data Final '01.12.2025' inserida e eventos de validação disparados.")

    time.sleep(2) # PAUSA DE 2 SEGUNDOS

except Exception as e:
    print(f"Erro no Passo 3 (Data Final - Eventos): {e}")
    driver.quit()
    exit()

# --- PASSO 4: CLICAR NO BOTÃO ENVIAR ---

try:
    print("Passo 4: Clicando no botão 'enviar'...")
    
    botao_enviar_xpath = "/html/body/div/div/div[46]/div/div/table/tbody/tr[4]/td[4]/table/tbody/tr/td[2]/div/table/tbody/tr/td"
    
    # Espera até que o botão Enviar esteja visível e clicável
    botao_enviar = wait.until(EC.element_to_be_clickable((By.XPATH, botao_enviar_xpath)))
    
    # Clicar no botão
    botao_enviar.click()
    print("Botão 'enviar' clicado.")
    
    # Adicionar uma espera fixa mais longa para o carregamento do relatório
    print("Aguardando o carregamento do relatório (15 segundos)...")
    time.sleep(15) 

except Exception as e:
    print(f"Erro no Passo 4 (Botão Enviar): {e}")
    
# --- PASSO 5: EXTRAIR E IMPRIMIR OS VALORES DA TABELA ---

try:
    print("Passo 5: Extraindo e imprimindo os valores da linha da tabela...")
    
    linha_tabela_xpath = "/html/body/div/div/div[11]/div/table/tbody/tr[15]"
    
    # Espera até que a linha da tabela esteja visível 
    linha_tabela = wait.until(EC.visibility_of_element_located((By.XPATH, linha_tabela_xpath)))
    
    # Extrair o texto completo da linha
    conteudo_linha = linha_tabela.text
    
    # Imprimir o conteúdo extraído no terminal
    print("\n--- CONTEÚDO DA LINHA DA TABELA (TR[15]) ---")
    print(conteudo_linha)
    print("-------------------------------------------\n")

except Exception as e:
    print(f"Erro no Passo 5 (Extração da Tabela - Relatório vazio ou elemento não encontrado): {e}")
    
finally:
    # --- FIM DO PROCESSO ---
    print("Processo concluído. Fechando o navegador em 500 segundos...")
    time.sleep(500)
    driver.quit()

time.sleep(600)