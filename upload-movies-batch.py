#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para fazer upload em lote de filmes para o sistema CineVision
"""
import sys
import os

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
import re
import json
import boto3
import psycopg2
from pathlib import Path
from datetime import datetime
import hashlib

# Configuração AWS
AWS_REGION = 'us-east-2'
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID', 'your_aws_access_key_id_here')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', 'your_aws_secret_access_key_here')
S3_VIDEO_BUCKET = 'cinevision-video'
S3_COVER_BUCKET = 'cinevision-cover'

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

# Lista de filmes para upload (excluindo Superman)
MOVIES_TO_UPLOAD = [
    "FILME_  Lilo & Stitch (2025)",
    "FILME_ A Hora do Mal (2025)",
    "FILME_ A Longa Marcha - Caminhe ou Morra (2025)",
    "FILME_ Como Treinar o Seu Dragão (2025)",
    "FILME_ Demon Slayer - Castelo Infinito (2025)",
    "FILME_ F1 - O Filme (2025)",
    "FILME_ Invocação do Mal 4_ O Último Ritual (2025)",
    "FILME_ Jurassic World_ Recomeço (2025)",
    "FILME_ Quarteto Fantástico 4 - Primeiros Passos (2025)",
]

def clean_title(folder_name):
    """Extrai título limpo do nome da pasta"""
    # Remove 'FILME_' e ano
    title = re.sub(r'^FILME_\s*', '', folder_name)
    title = re.sub(r'\s*\(\d{4}\)$', '', title)
    return title.strip()

def get_year(folder_name):
    """Extrai ano do nome da pasta"""
    match = re.search(r'\((\d{4})\)', folder_name)
    return int(match.group(1)) if match else 2025

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

def find_cover_image(movie_dir):
    """Encontra imagem de capa"""
    for file in os.listdir(movie_dir):
        if file.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            if any(keyword in file.lower() for keyword in ['capa', 'cover', 'poster']):
                return os.path.join(movie_dir, file)
    # Se não encontrar, pega a primeira imagem
    for file in os.listdir(movie_dir):
        if file.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
            return os.path.join(movie_dir, file)
    return None

def upload_to_s3(file_path, bucket, key):
    """Faz upload de arquivo para S3"""
    print(f"  📤 Uploading {os.path.basename(file_path)} to s3://{bucket}/{key}")
    s3_client = boto3.client(
        's3',
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY
    )

    file_size = os.path.getsize(file_path)
    print(f"     Size: {file_size / (1024**3):.2f} GB")

    # Upload com progress
    s3_client.upload_file(file_path, bucket, key)

    # Retorna URL pública
    url = f"https://{bucket}.s3.{AWS_REGION}.amazonaws.com/{key}"
    print(f"  ✅ Uploaded to: {url}")
    return url, key

def create_content_in_db(content_data):
    """Cria registro de conteúdo no banco de dados"""
    conn = psycopg2.connect(**SUPABASE_DB)
    cursor = conn.cursor()

    try:
        # Inserir conteúdo principal
        cursor.execute("""
            INSERT INTO content (
                title, description, release_year, content_type,
                poster_url, cover_storage_key, price_cents, currency,
                status, is_online, created_at, updated_at
            ) VALUES (
                %(title)s, %(description)s, %(release_year)s, 'movie',
                %(poster_url)s, %(cover_storage_key)s, 1500, 'BRL',
                'ACTIVE', true, NOW(), NOW()
            ) RETURNING id
        """, content_data)

        content_id = cursor.fetchone()[0]
        print(f"  ✅ Created content record: {content_id}")

        conn.commit()
        return content_id
    except Exception as e:
        conn.rollback()
        print(f"  ❌ Error creating content: {e}")
        raise
    finally:
        cursor.close()
        conn.close()

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

def create_purchase_for_user(user_email, content_id):
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

        # Criar purchase
        cursor.execute("""
            INSERT INTO purchases (
                user_id, content_id, amount_cents, currency,
                status, purchase_token, created_at, updated_at
            ) VALUES (
                %s, %s, 1500, 'BRL',
                'COMPLETED', %s, NOW(), NOW()
            ) RETURNING id
        """, (user_id, content_id, hashlib.md5(f"{user_id}{content_id}".encode()).hexdigest()))

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

def process_movie(movie_folder):
    """Processa um filme completo"""
    print(f"\n{'='*80}")
    print(f"🎬 Processing: {movie_folder}")
    print(f"{'='*80}")

    movie_dir = os.path.join(MOVIES_DIR, movie_folder)

    # 1. Extrair informações
    title = clean_title(movie_folder)
    year = get_year(movie_folder)
    print(f"📝 Title: {title}")
    print(f"📅 Year: {year}")

    # 2. Encontrar arquivos
    videos = find_video_files(movie_dir)
    cover = find_cover_image(movie_dir)

    print(f"🎥 Videos found: {len(videos)}")
    for lang, path in videos.items():
        print(f"   - {lang}: {os.path.basename(path)}")

    if cover:
        print(f"🖼️  Cover: {os.path.basename(cover)}")

    # 3. Upload capa
    cover_url = None
    cover_key = None
    if cover:
        timestamp = int(datetime.now().timestamp())
        cover_key = f"covers/movies/{title.lower().replace(' ', '-')}-{timestamp}{Path(cover).suffix}"
        cover_url, cover_key = upload_to_s3(cover, S3_COVER_BUCKET, cover_key)

    # 4. Criar registro de conteúdo
    content_data = {
        'title': title,
        'description': f'{title} ({year})',
        'release_year': year,
        'poster_url': cover_url,
        'cover_storage_key': cover_key
    }

    content_id = create_content_in_db(content_data)

    # 5. Upload vídeos e criar registros de idiomas
    for lang_type, video_path in videos.items():
        timestamp = int(datetime.now().timestamp())
        video_key = f"videos/movies/{title.lower().replace(' ', '-')}-{lang_type}-{timestamp}{Path(video_path).suffix}"
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

    # 6. Criar compra para usuário
    create_purchase_for_user('cinevision@teste.com', content_id)

    print(f"\n✅ Movie '{title}' processed successfully!")
    print(f"   Content ID: {content_id}")
    print(f"   Languages: {len(videos)}")

    return content_id

def main():
    """Função principal"""
    print("🎬 CineVision - Batch Movie Upload")
    print(f"📁 Movies directory: {MOVIES_DIR}")
    print(f"📊 Movies to process: {len(MOVIES_TO_UPLOAD)}")
    print()

    results = []

    for i, movie_folder in enumerate(MOVIES_TO_UPLOAD, 1):
        try:
            print(f"\n[{i}/{len(MOVIES_TO_UPLOAD)}] Starting: {movie_folder}")
            content_id = process_movie(movie_folder)
            results.append({'movie': movie_folder, 'status': 'success', 'content_id': content_id})
        except Exception as e:
            print(f"\n❌ FAILED: {movie_folder}")
            print(f"   Error: {str(e)}")
            results.append({'movie': movie_folder, 'status': 'failed', 'error': str(e)})
            continue

    # Sumário final
    print(f"\n{'='*80}")
    print(f"📊 UPLOAD SUMMARY")
    print(f"{'='*80}")
    print(f"✅ Success: {sum(1 for r in results if r['status'] == 'success')}")
    print(f"❌ Failed: {sum(1 for r in results if r['status'] == 'failed')}")
    print()

    for result in results:
        status_icon = '✅' if result['status'] == 'success' else '❌'
        print(f"{status_icon} {result['movie']}")
        if result['status'] == 'success':
            print(f"   Content ID: {result['content_id']}")
        else:
            print(f"   Error: {result['error']}")

    print(f"\n{'='*80}")

if __name__ == '__main__':
    main()
