import os
import boto3
from pathlib import Path

# Configuração
s3_client = boto3.client('s3', region_name='us-east-1')
POSTER_BUCKET = 'cinevision-capas'
MOVIES_DIR = r'E:\movies'

# Lista de filmes para processar (excluindo Lilo & Stitch)
movies = [
    ('A Hora do Mal', 2025, r'E:\movies\FILME_ A Hora do Mal (2025)\POSTER.png'),
    ('A Longa Marcha - Caminhe ou Morra', 2025, r'E:\movies\FILME_ A Longa Marcha - Caminhe ou Morra (2025)\POSTER.png'),
    ('Como Treinar o Seu Dragão', 2025, r'E:\movies\FILME_ Como Treinar o Seu Dragão (2025)\POSTER.png'),
    ('Demon Slayer - Castelo Infinito', 2025, r'E:\movies\FILME_ Demon Slayer - Castelo Infinito (2025)\POSTER.png'),
    ('F1 - O Filme', 2025, r'E:\movies\FILME_ F1 - O Filme (2025)\POSTER.png'),
    ('Invocação do Mal 4_ O Último Ritual', 2025, r'E:\movies\FILME_ Invocação do Mal 4_ O Último Ritual (2025)\POSTER.png'),
    ('Jurassic World_ Recomeço', 2025, r'E:\movies\FILME_ Jurassic World_ Recomeço (2025)\POSTER.png'),
    ('Quarteto Fantástico 4 - Primeiros Passos', 2025, r'E:\movies\FILME_ Quarteto Fantástico 4 - Primeiros Passos (2025)\POSTER.png'),
    ('Superman', 2025, r'E:\movies\FILME_ Superman (2025)\POSTER.png'),
]

import re

print('Iniciando upload de posters...\n')

for title, year, poster_path in movies:
    # Gera o ID do filme
    movie_id = f"{title.lower().replace(' ', '-').replace('_', '-')}"
    # Remove caracteres especiais
    movie_id = re.sub(r'[^a-z0-9-]', '', movie_id)
    movie_id = f"{movie_id}-{year}"

    s3_key = f"posters/{movie_id}.png"

    try:
        # Upload para S3
        print(f">> {title} ({year})")
        print(f"   Arquivo: {poster_path}")
        print(f"   S3 Key: {s3_key}")

        with open(poster_path, 'rb') as f:
            s3_client.put_object(
                Bucket=POSTER_BUCKET,
                Key=s3_key,
                Body=f,
                ContentType='image/png'
            )

        print(f"   OK - Upload concluido\n")

    except Exception as e:
        print(f"   ERRO: {e}\n")

print('\nUpload de posters concluido!')
