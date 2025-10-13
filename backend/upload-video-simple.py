#!/usr/bin/env python
# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import requests
import os
from pathlib import Path

# Configuration
API_BASE_URL = "http://localhost:3001/api/v1"
CONTENT_LANGUAGE_ID = "8ac92abe-e9e8-4856-8429-4c04659fe833"
VIDEO_FILE = r"E:/movies/FILME_ Invocação do Mal 4_ O Último Ritual (2025)/Invocação do Mal 4_ O Último Ritual (2025) - DUBLADO-015.mp4"

# Chunk size: 100MB
CHUNK_SIZE = 100 * 1024 * 1024

def main():
    print("="* 80)
    print("UPLOAD DE VIDEO PARA AUDIO TRACK")
    print("=" * 80)

    # Get file info
    file_path = Path(VIDEO_FILE)
    if not file_path.exists():
        print(f"[ERROR] Arquivo nao encontrado: {VIDEO_FILE}")
        return

    file_size = file_path.stat().st_size
    file_name = file_path.name

    print(f"\n[FILE] Arquivo: {file_name}")
    print(f"[SIZE] Tamanho: {file_size / (1024**3):.2f} GB")
    print(f"[ID] Audio Track ID: {CONTENT_LANGUAGE_ID}")
    print(f"[API] API: {API_BASE_URL}")

    # Step 1: Initiate multipart upload
    print(f"\n{'='*80}")
    print("PASSO 1: Iniciando upload multipart...")
    print("=" * 80)

    initiate_payload = {
        "content_language_id": CONTENT_LANGUAGE_ID,
        "file_name": file_name,
        "file_size": file_size,
        "content_type": "video/mp4"
    }

    print(f"[REQUEST] Payload: {initiate_payload}")

    try:
        response = requests.post(
            f"{API_BASE_URL}/content-language-upload/initiate-multipart",
            json=initiate_payload,
            headers={"Content-Type": "application/json"}
        )

        print(f"[RESPONSE] Status: {response.status_code}")
        print(f"[RESPONSE] Body: {response.text[:500]}")

        if response.status_code != 200:
            print(f"[ERROR] Erro ao iniciar upload: {response.text}")
            return

        init_data = response.json()
        upload_id = init_data.get("upload_id")
        key = init_data.get("key")
        total_parts = init_data.get("total_parts")

        print(f"\n[SUCCESS] Upload iniciado!")
        print(f"[INFO] Upload ID: {upload_id}")
        print(f"[INFO] Key: {key}")
        print(f"[INFO] Total de partes: {total_parts}")

    except Exception as e:
        print(f"[ERROR] Erro ao iniciar upload: {e}")
        return

    # Step 2: Upload each part
    print(f"\n{'='*80}")
    print("PASSO 2: Fazendo upload das partes...")
    print("=" * 80)

    uploaded_parts = []

    with open(file_path, 'rb') as f:
        for part_number in range(1, total_parts + 1):
            print(f"\n[PART] Parte {part_number}/{total_parts}")

            # Get presigned URL
            presigned_payload = {
                "content_language_id": CONTENT_LANGUAGE_ID,
                "upload_id": upload_id,
                "part_number": part_number
            }

            try:
                presigned_response = requests.post(
                    f"{API_BASE_URL}/content-language-upload/presigned-url",
                    json=presigned_payload,
                    headers={"Content-Type": "application/json"}
                )

                if presigned_response.status_code != 200:
                    print(f"[ERROR] Erro ao obter URL presigned: {presigned_response.text}")
                    return

                presigned_data = presigned_response.json()
                presigned_url = presigned_data.get("url")

                # Read chunk
                chunk = f.read(CHUNK_SIZE)
                chunk_size_mb = len(chunk) / (1024 * 1024)

                print(f"[UPLOAD] Enviando {chunk_size_mb:.2f} MB...")

                # Upload to S3
                upload_response = requests.put(
                    presigned_url,
                    data=chunk,
                    headers={"Content-Type": "video/mp4"}
                )

                if upload_response.status_code not in [200, 201]:
                    print(f"[ERROR] Erro no upload da parte {part_number}: {upload_response.status_code}")
                    return

                etag = upload_response.headers.get("ETag", "").strip('"')

                uploaded_parts.append({
                    "ETag": etag,
                    "PartNumber": part_number
                })

                progress = (part_number / total_parts) * 100
                print(f"[SUCCESS] Parte {part_number} enviada! ETag: {etag}")
                print(f"[PROGRESS] Progresso: {progress:.1f}%")

            except Exception as e:
                print(f"[ERROR] Erro no upload da parte {part_number}: {e}")
                return

    # Step 3: Complete upload
    print(f"\n{'='*80}")
    print("PASSO 3: Finalizando upload...")
    print("=" * 80)

    complete_payload = {
        "content_language_id": CONTENT_LANGUAGE_ID,
        "upload_id": upload_id,
        "parts": uploaded_parts
    }

    try:
        complete_response = requests.post(
            f"{API_BASE_URL}/content-language-upload/complete-multipart",
            json=complete_payload,
            headers={"Content-Type": "application/json"}
        )

        print(f"[RESPONSE] Status: {complete_response.status_code}")
        print(f"[RESPONSE] Body: {complete_response.text}")

        if complete_response.status_code == 200:
            print(f"\n{'='*80}")
            print("[SUCCESS] UPLOAD CONCLUIDO COM SUCESSO!")
            print("=" * 80)
            complete_data = complete_response.json()
            print(f"[INFO] Arquivo: {complete_data.get('file_name')}")
            print(f"[INFO] URL: {complete_data.get('video_url', 'N/A')}")
        else:
            print(f"[ERROR] Erro ao completar upload: {complete_response.text}")

    except Exception as e:
        print(f"[ERROR] Erro ao completar upload: {e}")

if __name__ == "__main__":
    main()
