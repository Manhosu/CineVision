import requests
import json
from datetime import datetime
import uuid

# Configurações
API_URL = "http://localhost:3001/api/v1"
CONTENT_ID = "cea7478d-abcd-4039-bb1b-b15839da4cfe"  # Invocação do Mal 4
TEST_EMAIL = "cinevision@teste.com"

def get_user_id():
    """Busca o ID do usuário de teste"""
    response = requests.post(
        f"{API_URL}/supabase-auth/login",
        json={"email": TEST_EMAIL, "password": "teste123"}
    )
    if response.status_code == 200:
        data = response.json()
        print(f"OK - Login bem-sucedido")
        print(f"User ID: {data['user']['id']}")
        print(f"Token: {data['access_token'][:50]}...")
        return data['user']['id'], data['access_token']
    else:
        print(f"ERRO no login: {response.status_code}")
        print(response.text)
        return None, None

def create_purchase(user_id, token):
    """Cria uma compra para o usuário de teste"""
    purchase_id = str(uuid.uuid4())
    payment_id = str(uuid.uuid4())

    # Dados da compra
    purchase_data = {
        "id": purchase_id,
        "user_id": user_id,
        "content_id": CONTENT_ID,
        "price_paid_cents": 720,
        "currency": "BRL",
        "status": "COMPLETED",
        "purchased_at": datetime.utcnow().isoformat(),
        "expires_at": None,  # Compra permanente
        "payment_method": "MANUAL",
        "payment_id": payment_id
    }

    print(f"\nCriando compra...")
    print(f"Purchase ID: {purchase_id}")
    print(f"User ID: {user_id}")
    print(f"Content ID: {CONTENT_ID}")

    # Como não temos endpoint direto, vamos usar o Supabase diretamente
    from supabase import create_client, Client
    import os

    supabase_url = "https://bxddcejjjcclglnvhzoo.supabase.co"
    supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4ZGRjZWpqamNjbGdsbnZoem9vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODMzNTMxNywiZXhwIjoyMDQzOTExMzE3fQ.OImnJ0s1hVWrMSUQfOMCbvyOoqGKDH8n-oM_QmjZEq0"

    supabase: Client = create_client(supabase_url, supabase_key)

    try:
        # Inserir compra
        result = supabase.table("purchases").insert({
            "id": purchase_id,
            "user_id": user_id,
            "content_id": CONTENT_ID,
            "price_paid_cents": 720,
            "currency": "BRL",
            "status": "COMPLETED",
            "purchased_at": datetime.utcnow().isoformat(),
            "payment_method": "MANUAL",
            "payment_id": payment_id
        }).execute()

        print(f"OK - Compra criada com sucesso!")
        print(f"Dados: {json.dumps(result.data, indent=2)}")
        return True

    except Exception as e:
        print(f"ERRO ao criar compra: {e}")
        return False

def check_telegram_config():
    """Verifica configuração do Telegram"""
    print(f"\nVerificando configuracao do Telegram...")

    # Ler arquivo de configuração do Telegram
    try:
        with open("../backend/src/modules/telegrams/telegrams.service.ts", "r", encoding="utf-8") as f:
            content = f.read()
            if "sendVideoToUser" in content:
                print("OK - Funcao sendVideoToUser encontrada")
            else:
                print("AVISO - Funcao sendVideoToUser nao encontrada")

        # Verificar se o serviço enhanced existe
        with open("../backend/src/modules/telegrams/telegrams-enhanced.service.ts", "r", encoding="utf-8") as f:
            content = f.read()
            if "sendVideoWithProgress" in content:
                print("OK - Funcao sendVideoWithProgress encontrada")
            else:
                print("AVISO - Funcao sendVideoWithProgress nao encontrada")

    except Exception as e:
        print(f"AVISO - Erro ao verificar arquivos: {e}")

def verify_purchase(user_id, token):
    """Verifica se a compra foi criada"""
    print(f"\nVerificando compras do usuario...")

    response = requests.get(
        f"{API_URL}/purchases/user/{user_id}",
        headers={"Authorization": f"Bearer {token}"}
    )

    if response.status_code == 200:
        purchases = response.json()
        print(f"OK - Total de compras: {len(purchases)}")
        for p in purchases:
            print(f"  - {p.get('content_id')} | Status: {p.get('status')}")
        return True
    else:
        print(f"ERRO ao buscar compras: {response.status_code}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("ADICIONAR FILME AO DASHBOARD DO USUARIO DE TESTE")
    print("=" * 60)

    # 1. Fazer login
    user_id, token = get_user_id()

    if not user_id or not token:
        print("\nERRO - Falha ao obter credenciais do usuario")
        exit(1)

    # 2. Criar compra
    success = create_purchase(user_id, token)

    if not success:
        print("\nERRO - Falha ao criar compra")
        exit(1)

    # 3. Verificar compra
    verify_purchase(user_id, token)

    # 4. Verificar configuração do Telegram
    check_telegram_config()

    print("\n" + "=" * 60)
    print("PROCESSO CONCLUIDO!")
    print("=" * 60)
    print(f"\nAcesse: http://localhost:3000/dashboard")
    print(f"Login: {TEST_EMAIL}")
    print(f"Senha: teste123")
    print("\nO filme 'Invocacao do Mal 4' deve aparecer em 'Minhas Compras'")
