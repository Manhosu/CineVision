#!/usr/bin/env python3
"""
Transcrição de áudios/vídeos do Igor via Whisper.
Uso: python transcrever.py arquivo1.mp4 [arquivo2.mp3 ...] [--modelo small|medium|large]
"""

import sys
import os
import argparse
import re
from datetime import datetime
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description="Transcreve áudios/vídeos do Igor para texto")
    parser.add_argument("arquivos", nargs="+", help="Arquivos de áudio ou vídeo")
    parser.add_argument(
        "--modelo", "-m",
        choices=["tiny", "base", "small", "medium", "large", "turbo"],
        default="medium",
        help="Modelo do Whisper (default: medium). 'large' é mais preciso, 'small' é mais rápido."
    )
    parser.add_argument(
        "--idioma", "-i",
        default="pt",
        help="Idioma do áudio (default: pt para português)"
    )
    parser.add_argument(
        "--saida", "-o",
        help="Arquivo de saída (default: AJUSTES-IGOR-<DATA>.md)"
    )
    parser.add_argument(
        "--timestamps", "-t",
        action="store_true",
        help="Incluir timestamps de cada segmento na transcrição"
    )
    args = parser.parse_args()

    try:
        import whisper
    except ImportError:
        print("ERRO: openai-whisper não instalado. Execute: pip install openai-whisper")
        sys.exit(1)

    # Define arquivo de saída
    hoje = datetime.now().strftime("%Y-%m-%d")
    saida_path = args.saida or f"AJUSTES-IGOR-{hoje}-TRANSCRICAO.md"

    print(f"[Whisper] Carregando modelo '{args.modelo}'...")
    modelo = whisper.load_model(args.modelo)

    resultados = []

    for arquivo in args.arquivos:
        caminho = Path(arquivo)
        if not caminho.exists():
            print(f"[AVISO] Arquivo não encontrado: {arquivo}")
            continue

        print(f"\n[Whisper] Transcrevendo: {caminho.name} ...")
        resultado = modelo.transcribe(
            str(caminho),
            language=args.idioma,
            verbose=False,
        )

        texto_completo = resultado["text"].strip()
        segmentos = resultado.get("segments", [])

        print(f"  -> {len(texto_completo)} caracteres transcritos")

        resultados.append({
            "arquivo": caminho.name,
            "texto": texto_completo,
            "segmentos": segmentos,
        })

    if not resultados:
        print("\nNenhum arquivo transcrito.")
        sys.exit(1)

    # Monta markdown de saída
    hora_geracao = datetime.now().strftime("%d/%m/%Y %H:%M")
    linhas = [
        f"# Transcrições Igor — {hoje}",
        f"",
        f"Gerado automaticamente via Whisper ({args.modelo}) em {hora_geracao}.",
        f"{len(resultados)} arquivo(s) transcritos.",
        "",
        "---",
        "",
    ]

    for idx, r in enumerate(resultados, start=1):
        linhas.append(f"## Vídeo {idx} — `{r['arquivo']}`")
        linhas.append("")

        if args.timestamps and r["segmentos"]:
            for seg in r["segmentos"]:
                inicio = formatar_tempo(seg["start"])
                texto_seg = seg["text"].strip()
                linhas.append(f"**[{inicio}]** {texto_seg}")
            linhas.append("")
        else:
            linhas.append(r["texto"])
            linhas.append("")

        linhas.append("---")
        linhas.append("")

    conteudo = "\n".join(linhas)

    with open(saida_path, "w", encoding="utf-8") as f:
        f.write(conteudo)

    print(f"\n[OK] Transcrição salva em: {saida_path}")
    print(f"\n{'='*60}")
    print("PRÉVIA DA TRANSCRIÇÃO:")
    print('='*60)
    for r in resultados:
        print(f"\n[{r['arquivo']}]")
        print(r["texto"][:500] + ("..." if len(r["texto"]) > 500 else ""))


def formatar_tempo(segundos: float) -> str:
    m, s = divmod(int(segundos), 60)
    h, m = divmod(m, 60)
    if h:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


if __name__ == "__main__":
    main()
