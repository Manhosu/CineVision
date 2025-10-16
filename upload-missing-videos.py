# -*- coding: utf-8 -*-
import sys
import os

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

import re
import boto3
import psycopg2
from pathlib import Path
from datetime import datetime

# Configuração AWS
AWS_REGION = 'us-east-2'
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID', 'your_aws_access_key_id_here')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', 'your_aws_secret_access_key_here')
S3_VIDEO_BUCKET = 'cinevision-video'

# Configuração Supabase
SUPABASE_DB = {
    'host': 'aws-1-sa-east-1.pooler.supabase.com',
    'port': 5432,
    'database': 'postgres',
    'user': 'postgres.szghyvnbmjlquznxhqum',
    'password': 'Umeomesmo1,'
}

# Diretório dos filmes
MOVIES_DIR = 'E:/movies'

# Mapeamento: Título no DB -> Nome da pasta
MOVIE_MAPPING = {
    'A Longa Marcha - Caminhe ou Morra': 'FILME_ A Longa Marcha - Caminhe ou Morra (2025)',
    'Quarteto Fantástico 4 - Primeiros Passos': 'FILME_ Quarteto Fantástico 4 - Primeiros Passos (2025)',
    'Jurassic World: Recomeço': 'FILME_ Jurassic World_ Recomeço (2025)',
    'F1 - O Filme': 'FILME_ F1 - O Filme (2025)',
    'Como Treinar o Seu Dragão': 'FILME_ Como Treinar o Seu Dragão (2025)',
}

# Content IDs dos filmes que precisam de vídeos
CONTENT_IDS = {
    'A Longa Marcha - Caminhe ou Morra': '560796b5-f5dd-4b02-a769-0f4f5df22892',
    'Quarteto Fantástico 4 - Primeiros Passos': 'f1465fe2-8b04-4522-8c97-56b725270312',
    'Jurassic World: Recomeço': '22311a9e-8aac-4fad-b62c-175468296bf6',
    'F1 - O Filme': '0b2dfa6d-782d-4982-83d3-490fea4bfc5b',
    'Como Treinar o Seu Dragão': 'ec38b056-0b6e-48d8-9d94-b5081e0b7855',
}

def find_video_files(movie_dir):
    """Encontra arquivos de vídeo (DUBLADO e LEGENDADO)"""
    videos = {}
    for file in os.listdir(movie_dir):
        if file.endswith(('.mp4', '.mkv', '.avi')):
            if 'DUBLADO' in file.upper():
                videos['dubbed'] = os.path.join(movie_dir, file)
            elif 'LEGENDADO' in file.upper():
                videos['subtitled'] = os.path.join(movie_dir, file)
    return videos

def upload_to_s3(file_path, bucket, key):
    """Faz upload de arquivo para S3"""
    print(f"  Uploading {os.path.basename(file_path)} to s3://{bucket}/{key}")
    s3_client = boto3.client(
        's3',
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY
    )

    file_size = os.path.getsize(file_path)
    print(f"     Size: {file_size / (1024**3):.2f} GB")

    # Upload
    s3_client.upload_file(file_path, bucket, key)

    # Retorna URL pública
    url = f"https://{bucket}.s3.{AWS_REGION}.amazonaws.com/{key}"
    print(f"  ✅ Uploaded to: {url}")
    return url, key

def create_content_language(content_id, language_data):
    """Cria registro de idioma para o conteúdo"""
    conn = psycopg2.connect(**SUPABASE_DB)
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO content_languages (
                content_id, language_type, language_code, language_name,
                video_url, video_storage_key, upload_status,
                is_active, is_default, created_at, updated_at
            ) VALUES (
                %(content_id)s, %(language_type)s, %(language_code)s, %(language_name)s,
                %(video_url)s, %(video_storage_key)s, 'completed',
                true, %(is_default)s, NOW(), NOW()
            ) RETURNING id
        """, language_data)

        language_id = cursor.fetchone()[0]
        conn.commit()
        print(f"  ✅ Created language record: {language_id} ({language_data['language_type']})")
        return language_id
    except Exception as e:
        conn.rollback()
        print(f"  ❌ Error creating language: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

def create_purchase_for_user(user_email, content_id, price_cents):
    """Cria compra para um usuário"""
    conn = psycopg2.connect(**SUPABASE_DB)
    cursor = conn.cursor()

    try:
        # Buscar user_id
        cursor.execute("SELECT id FROM users WHERE email = %s", (user_email,))
        result = cursor.fetchone()

        if not result:
            print(f"  ⚠️  User {user_email} not found")
            return None

        user_id = result[0]

        # Verificar se já existe purchase
        cursor.execute("""
            SELECT id FROM purchases
            WHERE user_id = %s AND content_id = %s
        """, (user_id, content_id))

        existing = cursor.fetchone()
        if existing:
            print(f"  ℹ️  Purchase already exists: {existing[0]}")
            return existing[0]

        # Criar purchase
        cursor.execute("""
            INSERT INTO purchases (
                user_id, content_id, amount_cents, currency,
                status, created_at, updated_at
            ) VALUES (
                %s, %s, %s, 'BRL',
                'COMPLETED', NOW(), NOW()
            ) RETURNING id
        """, (user_id, content_id, price_cents))

        purchase_id = cursor.fetchone()[0]
        conn.commit()
        print(f"  ✅ Created purchase for {user_email}: {purchase_id}")
        return purchase_id
    except Exception as e:
        conn.rollback()
        print(f"  ❌ Error creating purchase: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

def get_content_price(content_id):
    """Busca o preço do conteúdo"""
    conn = psycopg2.connect(**SUPABASE_DB)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT price_cents FROM content WHERE id = %s", (content_id,))
        result = cursor.fetchone()
        return result[0] if result else 700
    finally:
        cursor.close()
        conn.close()

def process_movie(title, content_id):
    """Adiciona vídeos a um filme existente"""
    print(f"\n{'='*80}")
    print(f"Processing: {title}")
    print(f"Content ID: {content_id}")
    print(f"{'='*80}")

    # Encontrar pasta do filme
    if title not in MOVIE_MAPPING:
        print(f"  ❌ Movie folder not found in mapping")
        return False

    movie_folder = MOVIE_MAPPING[title]
    movie_dir = os.path.join(MOVIES_DIR, movie_folder)

    if not os.path.exists(movie_dir):
        print(f"  ❌ Directory not found: {movie_dir}")
        return False

    # Encontrar vídeos
    videos = find_video_files(movie_dir)

    print(f"Videos found: {len(videos)}")
    for lang, path in videos.items():
        print(f"   - {lang}: {os.path.basename(path)}")

    if not videos:
        print(f"  ⚠️  No videos found")
        return False

    # Upload vídeos e criar registros de idiomas
    for lang_type, video_path in videos.items():
        timestamp = int(datetime.now().timestamp())
        video_key = f"videos/movies/{title.lower().replace(' ', '-').replace(':', '')}-{lang_type}-{timestamp}{Path(video_path).suffix}"
        video_url, video_key = upload_to_s3(video_path, S3_VIDEO_BUCKET, video_key)

        language_data = {
            'content_id': content_id,
            'language_type': lang_type,
            'language_code': 'pt-BR' if lang_type == 'dubbed' else 'en-US',
            'language_name': 'Português (Brasil)' if lang_type == 'dubbed' else 'English (US)',
            'video_url': video_url,
            'video_storage_key': video_key,
            'is_default': lang_type == 'dubbed'
        }

        create_content_language(content_id, language_data)

    # Criar compra para usuário
    price_cents = get_content_price(content_id)
    create_purchase_for_user('cinevision@teste.com', content_id, price_cents)

    print(f"\n✅ Movie '{title}' processed successfully!")
    print(f"   Languages added: {len(videos)}")

    return True

if __name__ == '__main__':
    print("="*80)
    print("CineVision - Upload Missing Videos")
    print("="*80)
    print(f"Movies directory: {MOVIES_DIR}")
    print(f"Movies to process: {len(CONTENT_IDS)}")
    print(f"User: cinevision@teste.com")
    print("="*80)
    print()

    results = []

    for title, content_id in CONTENT_IDS.items():
        try:
            print(f"\nStarting: {title}")
            success = process_movie(title, content_id)
            results.append({'movie': title, 'status': 'success' if success else 'skipped'})
        except Exception as e:
            print(f"\nFAILED: {title}")
            print(f"   Error: {str(e)}")
            results.append({'movie': title, 'status': 'failed', 'error': str(e)})
            continue

    # Summary
    print(f"\n{'='*80}")
    print(f"UPLOAD SUMMARY")
    print(f"{'='*80}")
    print(f"Success: {sum(1 for r in results if r['status'] == 'success')}")
    print(f"Failed: {sum(1 for r in results if r['status'] == 'failed')}")
    print(f"Skipped: {sum(1 for r in results if r['status'] == 'skipped')}")
    print()

    for result in results:
        icon = 'OK' if result['status'] == 'success' else ('SKIP' if result['status'] == 'skipped' else 'FAIL')
        print(f"[{icon}] {result['movie']}")
        if result.get('error'):
            print(f"       Error: {result['error']}")

    print(f"\n{'='*80}")
