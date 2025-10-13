#!/usr/bin/env python3
"""
Upload de video otimizado com chunks de 100MB
"""

import os
import requests
import json
from pathlib import Path

# Configurações
API_BASE_URL = "http://localhost:3001/api/v1"
CONTENT_LANGUAGE_ID = "8ac92abe-e9e8-4856-8429-4c04659fe833"
VIDEO_FILE = r"E:/movies/FILME_ Invocação do Mal 4_ O Último Ritual (2025)/Invocação do Mal 4_ O Último Ritual (2025) - DUBLADO-015.mp4"
CHUNK_SIZE = 100 * 1024 * 1024  # 100MB chunks (reduz de 404 para 41 parts)

def format_size(size_bytes):
    """Formata tamanho em bytes para formato legível"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} TB"

def main():
    print("=" * 80)
    print("UPLOAD DE VIDEO OTIMIZADO (100MB chunks)")
    print("=" * 80)
    print()

    # Verificar arquivo
    if not os.path.exists(VIDEO_FILE):
        print(f"[ERROR] Arquivo não encontrado: {VIDEO_FILE}")
        return

    file_size = os.path.getsize(VIDEO_FILE)
    filename = os.path.basename(VIDEO_FILE)

    print(f"[FILE] Arquivo: {filename}")
    print(f"[SIZE] Tamanho: {format_size(file_size)}")
    print(f"[CHUNK] Tamanho do chunk: {format_size(CHUNK_SIZE)}")

    # Calcular número de parts
    num_parts = (file_size + CHUNK_SIZE - 1) // CHUNK_SIZE
    print(f"[PARTS] Total de parts: {num_parts}")
    print(f"[ID] Audio Track ID: {CONTENT_LANGUAGE_ID}")
    print(f"[API] API: {API_BASE_URL}")
    print()

    # Passo 1: Iniciar upload multipart
    print("=" * 80)
    print("PASSO 1: Iniciando upload multipart...")
    print("=" * 80)

    payload = {
        "content_language_id": CONTENT_LANGUAGE_ID,
        "file_name": filename,
        "file_size": file_size,
        "content_type": "video/mp4"
    }

    print(f"[REQUEST] Payload: {payload}")

    try:
        response = requests.post(
            f"{API_BASE_URL}/content-language-upload/initiate-multipart",
            json=payload,
            timeout=30
        )

        print(f"[RESPONSE] Status: {response.status_code}")
        print(f"[RESPONSE] Body: {response.text[:500]}")

        if response.status_code != 200:
            print(f"[ERROR] Erro ao iniciar upload: {response.text}")
            return

        data = response.json()
        upload_id = data.get("uploadId")
        storage_key = data.get("storage_key")
        presigned_urls = data.get("presignedUrls", [])

        print(f"[SUCCESS] Upload iniciado!")
        print(f"[UPLOAD_ID] {upload_id}")
        print(f"[KEY] {storage_key}")
        print(f"[URLS] {len(presigned_urls)} URLs geradas")
        print()

        # Passo 2: Upload dos chunks
        print("=" * 80)
        print("PASSO 2: Fazendo upload dos chunks...")
        print("=" * 80)

        parts = []

        with open(VIDEO_FILE, 'rb') as f:
            for part_number in range(1, num_parts + 1):
                # Ler chunk
                chunk_data = f.read(CHUNK_SIZE)
                chunk_size_actual = len(chunk_data)

                if not chunk_data:
                    break

                print(f"[PART {part_number}/{num_parts}] Uploading {format_size(chunk_size_actual)}...")

                # Upload para S3
                presigned_url = presigned_urls[part_number - 1]

                upload_response = requests.put(
                    presigned_url,
                    data=chunk_data,
                    headers={'Content-Type': 'application/octet-stream'},
                    timeout=300  # 5 minutos
                )

                if upload_response.status_code not in [200, 204]:
                    print(f"[ERROR] Falha no upload da part {part_number}: {upload_response.status_code}")
                    print(f"[ERROR] Response: {upload_response.text[:200]}")
                    return

                etag = upload_response.headers.get('ETag', '').strip('"')
                parts.append({
                    "ETag": etag,
                    "PartNumber": part_number
                })

                progress = (part_number / num_parts) * 100
                print(f"[PROGRESS] {progress:.1f}% - ETag: {etag[:20]}...")

        print()
        print("[SUCCESS] Todos os chunks foram enviados!")
        print()

        # Passo 3: Completar upload
        print("=" * 80)
        print("PASSO 3: Completando upload...")
        print("=" * 80)

        complete_payload = {
            "content_language_id": CONTENT_LANGUAGE_ID,
            "upload_id": upload_id,
            "parts": parts
        }

        complete_response = requests.post(
            f"{API_BASE_URL}/content-language-upload/complete-multipart",
            json=complete_payload,
            timeout=60
        )

        print(f"[RESPONSE] Status: {complete_response.status_code}")
        print(f"[RESPONSE] Body: {complete_response.text}")

        if complete_response.status_code == 200:
            print()
            print("=" * 80)
            print("UPLOAD CONCLUÍDO COM SUCESSO!")
            print("=" * 80)
        else:
            print(f"[ERROR] Erro ao completar upload: {complete_response.text}")

    except Exception as e:
        print(f"[ERROR] Exceção: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
