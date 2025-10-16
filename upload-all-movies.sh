#!/bin/bash

# Script para fazer upload de todos os filmes (exceto Superman)

MOVIES=(
    "FILME_  Lilo & Stitch (2025)"
    "FILME_ A Hora do Mal (2025)"
    "FILME_ A Longa Marcha - Caminhe ou Morra (2025)"
    "FILME_ Como Treinar o Seu Dragão (2025)"
    "FILME_ Demon Slayer - Castelo Infinito (2025)"
    "FILME_ F1 - O Filme (2025)"
    "FILME_ Invocação do Mal 4_ O Último Ritual (2025)"
    "FILME_ Jurassic World_ Recomeço (2025)"
    "FILME_ Quarteto Fantástico 4 - Primeiros Passos (2025)"
)

LOG_FILE="upload-movies-$(date +%Y%m%d-%H%M%S).log"

echo "======================================================================"
echo "CineVision - Batch Movie Upload"
echo "======================================================================"
echo "Movies to upload: ${#MOVIES[@]}"
echo "Log file: $LOG_FILE"
echo "======================================================================"
echo ""

TOTAL=${#MOVIES[@]}
SUCCESS=0
FAILED=0

for i in "${!MOVIES[@]}"; do
    MOVIE="${MOVIES[$i]}"
    NUM=$((i + 1))

    echo "[$NUM/$TOTAL] Processing: $MOVIE"
    echo ""

    python upload-single-movie.py "$MOVIE" 2>&1 | tee -a "$LOG_FILE"

    if [ ${PIPESTATUS[0]} -eq 0 ]; then
        SUCCESS=$((SUCCESS + 1))
        echo "✅ SUCCESS: $MOVIE"
    else
        FAILED=$((FAILED + 1))
        echo "❌ FAILED: $MOVIE"
    fi

    echo ""
    echo "----------------------------------------------------------------------"
    echo ""
done

echo "======================================================================"
echo "FINAL SUMMARY"
echo "======================================================================"
echo "✅ Success: $SUCCESS"
echo "❌ Failed: $FAILED"
echo "Total: $TOTAL"
echo "Log file: $LOG_FILE"
echo "======================================================================"
