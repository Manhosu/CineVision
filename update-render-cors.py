#!/usr/bin/env python3
"""
Script para atualizar variável CORS_ORIGIN no Render
"""
import requests
import json

# Configurações
API_KEY = "rnd_YSVYzEamaF7ZQWJFZ4OLAXRnDHrK"
SERVICE_ID = "srv-d3mp4ibipnbc73ctm470"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# URL da API do Render para variáveis de ambiente
base_url = f"https://api.render.com/v1/services/{SERVICE_ID}/env-vars"

print("=" * 60)
print("Atualizando CORS_ORIGIN no Render")
print("=" * 60)

# Primeiro, vamos listar todas as variáveis para encontrar o ID do CORS_ORIGIN
print("\nBuscando variaveis de ambiente...")
response = requests.get(base_url, headers=headers)

if response.status_code != 200:
    print(f"[ERRO] Erro ao buscar variaveis: {response.status_code}")
    print(response.text)
    exit(1)

env_vars = response.json()
cors_var = None

for var in env_vars:
    if var.get('envVar', {}).get('key') == 'CORS_ORIGIN':
        cors_var = var['envVar']
        break

if not cors_var:
    print("[AVISO] CORS_ORIGIN nao encontrado. Criando nova variavel...")
    # Criar nova variável
    new_var = {
        "key": "CORS_ORIGIN",
        "value": "https://cine-vision-murex.vercel.app,https://cine-vision-murex-git-main.vercel.app"
    }
    response = requests.post(base_url, headers=headers, json=new_var)
    if response.status_code in [200, 201]:
        print("[OK] CORS_ORIGIN criado com sucesso!")
        print(f"   Valor: {new_var['value']}")
    else:
        print(f"[ERRO] Erro ao criar CORS_ORIGIN: {response.status_code}")
        print(response.text)
        exit(1)
else:
    # Atualizar variável existente
    var_id = cors_var.get('id', cors_var.get('key'))
    print(f"[OK] CORS_ORIGIN encontrado: {var_id}")
    print(f"   Valor atual: {cors_var.get('value', 'N/A')}")

    new_value = "https://cine-vision-murex.vercel.app,https://cine-vision-murex-git-main.vercel.app"

    if cors_var['value'] == new_value:
        print("[INFO] Valor ja esta correto. Nada a fazer.")
    else:
        # Atualizar valor
        update_data = {
            "key": "CORS_ORIGIN",
            "value": new_value
        }

        var_id = cors_var.get('id', cors_var.get('key'))
        update_url = f"{base_url}/{var_id}"
        response = requests.put(update_url, headers=headers, json=update_data)

        if response.status_code == 200:
            print(f"[OK] CORS_ORIGIN atualizado com sucesso!")
            print(f"   Novo valor: {new_value}")
        else:
            print(f"[ERRO] Erro ao atualizar CORS_ORIGIN: {response.status_code}")
            print(response.text)
            exit(1)

# Verificar se FRONTEND_URL existe e atualizar
print("\nVerificando FRONTEND_URL...")
frontend_var = None

for var in env_vars:
    if var.get('envVar', {}).get('key') == 'FRONTEND_URL':
        frontend_var = var['envVar']
        break

if not frontend_var:
    print("[AVISO] FRONTEND_URL nao encontrado. Criando nova variavel...")
    new_var = {
        "key": "FRONTEND_URL",
        "value": "https://cine-vision-murex.vercel.app"
    }
    response = requests.post(base_url, headers=headers, json=new_var)
    if response.status_code in [200, 201]:
        print("[OK] FRONTEND_URL criado com sucesso!")
        print(f"   Valor: {new_var['value']}")
    else:
        print(f"[ERRO] Erro ao criar FRONTEND_URL: {response.status_code}")
        print(response.text)
else:
    var_id = frontend_var.get('id', frontend_var.get('key'))
    print(f"[OK] FRONTEND_URL encontrado: {var_id}")
    print(f"   Valor atual: {frontend_var.get('value', 'N/A')}")

    new_value = "https://cine-vision-murex.vercel.app"

    if frontend_var['value'] == new_value:
        print("[INFO] Valor ja esta correto. Nada a fazer.")
    else:
        update_data = {
            "key": "FRONTEND_URL",
            "value": new_value
        }

        var_id = frontend_var.get('id', frontend_var.get('key'))
        update_url = f"{base_url}/{var_id}"
        response = requests.put(update_url, headers=headers, json=update_data)

        if response.status_code == 200:
            print(f"[OK] FRONTEND_URL atualizado com sucesso!")
            print(f"   Novo valor: {new_value}")
        else:
            print(f"[ERRO] Erro ao atualizar FRONTEND_URL: {response.status_code}")
            print(response.text)

print("\n" + "=" * 60)
print("Configuracao concluida!")
print("=" * 60)
print("\nIMPORTANTE:")
print("   O Render vai reiniciar o servico automaticamente.")
print("   Aguarde ~2-3 minutos para o backend ficar disponivel.")
print("\nURLs configuradas:")
print("   - Frontend: https://cine-vision-murex.vercel.app")
print("   - Backend: https://cinevisionn.onrender.com")
print("\nO CORS agora aceita requisicoes da Vercel!")
