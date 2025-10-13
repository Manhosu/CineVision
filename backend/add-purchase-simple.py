from supabase import create_client, Client
import uuid
from datetime import datetime

# Configurações Supabase
SUPABASE_URL = "https://bxddcejjjcclglnvhzoo.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4ZGRjZWpqamNjbGdsbnZoem9vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODMzNTMxNywiZXhwIjoyMDQzOTExMzE3fQ.OImnJ0s1hVWrMSUQfOMCbvyOoqGKDH8n-oM_QmjZEq0"

# IDs
CONTENT_ID = "cea7478d-abcd-4039-bb1b-b15839da4cfe"  # Invocação do Mal 4
TEST_EMAIL = "cinevision@teste.com"

def main():
    print("=" * 60)
    print("ADICIONAR COMPRA - Invocacao do Mal 4")
    print("=" * 60)

    # Conectar ao Supabase
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 1. Buscar usuário
    print(f"\n1. Buscando usuario: {TEST_EMAIL}")
    user_result = supabase.table("users").select("*").eq("email", TEST_EMAIL).execute()

    if not user_result.data or len(user_result.data) == 0:
        print(f"ERRO: Usuario nao encontrado!")
        return

    user = user_result.data[0]
    user_id = user["id"]
    print(f"OK - Usuario encontrado: {user_id}")
    print(f"   Nome: {user.get('name', 'N/A')}")
    print(f"   Role: {user.get('role', 'N/A')}")

    # 2. Verificar se já tem a compra
    print(f"\n2. Verificando compras existentes...")
    existing = supabase.table("purchases").select("*").eq("user_id", user_id).eq("content_id", CONTENT_ID).execute()

    if existing.data and len(existing.data) > 0:
        print(f"AVISO: Usuario ja possui esta compra!")
        print(f"   Purchase ID: {existing.data[0]['id']}")
        print(f"   Status: {existing.data[0]['status']}")
        print(f"   Data: {existing.data[0]['purchased_at']}")
        choice = input("\nDeseja criar outra compra? (s/n): ")
        if choice.lower() != 's':
            print("Operacao cancelada.")
            return

    # 3. Criar compra
    print(f"\n3. Criando compra...")
    purchase_id = str(uuid.uuid4())
    payment_id = str(uuid.uuid4())

    purchase_data = {
        "id": purchase_id,
        "user_id": user_id,
        "content_id": CONTENT_ID,
        "price_paid_cents": 720,
        "currency": "BRL",
        "status": "COMPLETED",
        "purchased_at": datetime.utcnow().isoformat(),
        "payment_method": "MANUAL",
        "payment_id": payment_id
    }

    try:
        result = supabase.table("purchases").insert(purchase_data).execute()
        print(f"OK - Compra criada com sucesso!")
        print(f"   Purchase ID: {purchase_id}")
        print(f"   Payment ID: {payment_id}")
        print(f"   Valor: R$ 7,20")
    except Exception as e:
        print(f"ERRO ao criar compra: {e}")
        return

    # 4. Verificar áudio do filme
    print(f"\n4. Verificando audio do filme...")
    audio_result = supabase.table("content_languages").select("*").eq("content_id", CONTENT_ID).execute()

    if audio_result.data:
        print(f"OK - Encontrados {len(audio_result.data)} audios:")
        for audio in audio_result.data:
            print(f"   - {audio.get('language_name', 'N/A')} | Status: {audio.get('upload_status', 'N/A')}")
            print(f"     URL: {audio.get('video_url', 'N/A')[:80]}...")
    else:
        print(f"AVISO: Nenhum audio encontrado para este filme!")

    # 5. Informações finais
    print(f"\n" + "=" * 60)
    print("PROCESSO CONCLUIDO!")
    print("=" * 60)
    print(f"\nAcesse: http://localhost:3000/dashboard")
    print(f"Login: {TEST_EMAIL}")
    print(f"Senha: teste123")
    print(f"\nO filme 'Invocacao do Mal 4' deve aparecer em 'Minhas Compras'")
    print(f"Com audio dublado em Portugues Brasil")

if __name__ == "__main__":
    main()
