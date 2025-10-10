# Script automatico que busca e converte todos os .mkv restantes
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CONVERSOR AUTOMATICO MKV PARA MP4" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Diretorio dos filmes
$MOVIES_DIR = "E:\movies"

# Testar FFmpeg
try {
    $null = ffmpeg -version 2>&1
    Write-Host "FFmpeg encontrado!" -ForegroundColor Green
} catch {
    Write-Host "ERRO: FFmpeg nao encontrado" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""
Write-Host "Buscando arquivos .mkv..." -ForegroundColor Yellow
Write-Host ""

# Buscar todos os .mkv recursivamente
$mkvFiles = Get-ChildItem -Path $MOVIES_DIR -Recurse -Filter "*.mkv"

if ($mkvFiles.Count -eq 0) {
    Write-Host "Nenhum arquivo .mkv encontrado!" -ForegroundColor Yellow
    pause
    exit 0
}

Write-Host "Encontrados $($mkvFiles.Count) arquivo(s) .mkv para converter" -ForegroundColor Green
Write-Host ""

$contador = 1
foreach ($mkv in $mkvFiles) {
    Write-Host "[$contador/$($mkvFiles.Count)] Convertendo: $($mkv.Name)" -ForegroundColor Cyan
    Write-Host "Pasta: $($mkv.DirectoryName)" -ForegroundColor Gray

    # Criar nome do arquivo de saida (substituir .mkv por .mp4)
    $outputName = $mkv.Name -replace '-\d{3}\.mkv$', '.mp4'
    $outputPath = Join-Path $mkv.DirectoryName $outputName

    Write-Host "Saida: $outputName" -ForegroundColor Gray
    Write-Host ""

    # Executar FFmpeg
    & ffmpeg -i $mkv.FullName -c:v copy -c:a aac -b:a 192k $outputPath -y 2>&1 | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Convertido com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "[X] ERRO na conversao!" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "----------------------------------------" -ForegroundColor Gray
    Write-Host ""

    $contador++
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CONVERSAO CONCLUIDA!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total convertido: $($mkvFiles.Count) arquivo(s)" -ForegroundColor Green
Write-Host ""
Write-Host "Pressione qualquer tecla para fechar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
