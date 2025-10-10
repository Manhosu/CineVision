# Configurar encoding UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================"
Write-Host "  CONVERSOR DE MKV PARA MP4"
Write-Host "  2 Filmes Pendentes"
Write-Host "========================================"
Write-Host ""
Write-Host "Este script ira converter 2 arquivos .mkv para .mp4"
Write-Host "Tempo estimado: 3-6 minutos"
Write-Host ""
Write-Host "Pressione qualquer tecla para iniciar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Write-Host ""

# Diretorio dos filmes
$MOVIES_DIR = "E:\movies"

# Testar se FFmpeg funciona
try {
    $null = ffmpeg -version 2>&1
    Write-Host "FFmpeg encontrado!"
    Write-Host ""
} catch {
    Write-Host "ERRO: FFmpeg nao encontrado no PATH do sistema"
    Write-Host ""
    pause
    exit 1
}

Write-Host "Iniciando conversoes..."
Write-Host ""

# ========================================
# 1. Como Treinar o Seu Dragão (2025) - DUBLADO
# ========================================
Write-Host "[1/2] Convertendo: Como Treinar o Seu Dragao - DUBLADO"
Write-Host ""

$input1 = "$MOVIES_DIR\FILME_ Como Treinar o Seu Dragão (2025)\Como Treinar o Seu Dragão (2025) - DUBLADO-007.mkv"
$output1 = "$MOVIES_DIR\FILME_ Como Treinar o Seu Dragão (2025)\Como Treinar o Seu Dragão (2025) - DUBLADO.mp4"

if (Test-Path $input1) {
    & ffmpeg -i $input1 -c:v copy -c:a aac -b:a 192k $output1 -y
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Como Treinar o Seu Dragao convertido!" -ForegroundColor Green
    } else {
        Write-Host "[X] ERRO ao converter Como Treinar o Seu Dragao" -ForegroundColor Red
    }
} else {
    Write-Host "[X] ERRO: Arquivo nao encontrado: $input1" -ForegroundColor Red
}

Write-Host ""
Write-Host "----------------------------------------"
Write-Host ""

# ========================================
# 2. Jurassic World - Recomeço (2025) - DUBLADO
# ========================================
Write-Host "[2/2] Convertendo: Jurassic World - Recomeco - DUBLADO"
Write-Host ""

$input2 = "$MOVIES_DIR\FILME_ Jurassic World_ Recomeço (2025)\Jurassic World_ Recomeço (2025) - DUBLADO-015.mkv"
$output2 = "$MOVIES_DIR\FILME_ Jurassic World_ Recomeço (2025)\Jurassic World_ Recomeço (2025) - DUBLADO.mp4"

if (Test-Path $input2) {
    & ffmpeg -i $input2 -c:v copy -c:a aac -b:a 192k $output2 -y
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Jurassic World convertido!" -ForegroundColor Green
    } else {
        Write-Host "[X] ERRO ao converter Jurassic World" -ForegroundColor Red
    }
} else {
    Write-Host "[X] ERRO: Arquivo nao encontrado: $input2" -ForegroundColor Red
}

Write-Host ""
Write-Host "----------------------------------------"
Write-Host ""

Write-Host "========================================"
Write-Host "  CONVERSAO CONCLUIDA!"
Write-Host "========================================"
Write-Host ""
Write-Host "Arquivos convertidos salvos em: $MOVIES_DIR"
Write-Host ""
Write-Host "Pressione qualquer tecla para fechar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
