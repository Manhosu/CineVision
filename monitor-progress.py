#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import time
import requests
import json
from datetime import datetime

# Force UTF-8 encoding for Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

API_URL = "http://localhost:3001/api/v1"

def get_upload_progress():
    """Verifica o progresso do upload consultando a API"""
    try:
        response = requests.get(f"{API_URL}/content/movies", timeout=10)
        if response.status_code != 200:
            print(f"[ERRO] Erro ao consultar API: {response.status_code}")
            return None

        data = response.json()
        movies = data.get('movies', [])

        return movies
    except Exception as e:
        print(f"[ERRO] Erro ao consultar API: {e}")
        return None

def display_progress(movies):
    """Exibe o progresso do upload"""
    print("\n" + "="*80)
    print("PROGRESSO DO UPLOAD DE VIDEOS")
    print("="*80)
    print(f"Horario: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")

    total_movies = len(movies)
    movies_with_videos = 0

    for movie in movies:
        title = movie.get('title', 'N/A')
        languages = movie.get('languages', [])

        if not languages:
            print(f"[FILME] {title}")
            print(f"   [AVISO] Nenhuma versao cadastrada\n")
            continue

        print(f"[FILME] {title}")

        has_video = False
        for lang in languages:
            audio_type = (lang.get('audio_type') or 'N/A').upper()
            video_url = lang.get('video_url')
            status = lang.get('status', 'pending')
            quality = lang.get('quality', 'N/A')

            if video_url and video_url.strip():
                has_video = True
                icon = "[OK]"
            else:
                icon = "[AGUARDANDO]"

            print(f"   {icon} {audio_type.ljust(12)} | {quality.ljust(8)} | {status}")

        if has_video:
            movies_with_videos += 1

        print()

    progress_percent = (movies_with_videos / total_movies * 100) if total_movies > 0 else 0

    print("="*80)
    print("RESUMO:")
    print(f"   Total de filmes: {total_movies}")
    print(f"   Filmes com videos: {movies_with_videos}/{total_movies} ({progress_percent:.1f}%)")
    print("="*80)

    # Barra de progresso
    bar_length = 50
    filled = int(bar_length * progress_percent / 100)
    bar = "#" * filled + "-" * (bar_length - filled)
    print(f"\n[{bar}] {progress_percent:.1f}%\n")

    return movies_with_videos == total_movies

def monitor_loop(interval=30):
    """Loop principal de monitoramento"""
    print("Iniciando monitoramento de upload...")
    print(f"Intervalo de verificacao: {interval} segundos\n")

    while True:
        movies = get_upload_progress()

        if movies is None:
            print("[AVISO] Nao foi possivel obter dados. Tentando novamente em 30s...\n")
            time.sleep(30)
            continue

        completed = display_progress(movies)

        if completed:
            print("TODOS OS UPLOADS FORAM CONCLUIDOS!\n")
            break

        print(f"Proxima verificacao em {interval} segundos...")
        print("   (Pressione Ctrl+C para parar o monitoramento)\n")

        try:
            time.sleep(interval)
        except KeyboardInterrupt:
            print("\n\n[AVISO] Monitoramento interrompido pelo usuario.\n")
            break

if __name__ == "__main__":
    try:
        monitor_loop()
    except KeyboardInterrupt:
        print("\n\n[AVISO] Programa encerrado.\n")
    except Exception as e:
        print(f"\n[ERRO] Erro fatal: {e}\n")
