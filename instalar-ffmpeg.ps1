# Script de Instalação Automática do FFmpeg
# Execute como Administrador

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INSTALADOR AUTOMÁTICO DO FFMPEG" -ForegroundColor Cyan
Write-Host "  CineVision - Conversor de MKV" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se já existe FFmpeg
Write-Host "[1/5] Verificando se FFmpeg já está instalado..." -ForegroundColor Yellow
$ffmpegTest = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($ffmpegTest) {
    Write-Host "✅ FFmpeg já está instalado!" -ForegroundColor Green
    ffmpeg -version | Select-String "ffmpeg version"
    Write-Host ""
    Write-Host "Você pode executar o script de conversão agora:" -ForegroundColor Green
    Write-Host "  converter-mkv-completo.bat" -ForegroundColor White
    Write-Host ""
    Read-Host "Pressione Enter para sair"
    exit 0
}

Write-Host "FFmpeg não encontrado. Iniciando instalação..." -ForegroundColor Yellow
Write-Host ""

# Criar pasta
Write-Host "[2/5] Criando pasta C:\ffmpeg..." -ForegroundColor Yellow
New-Item -Path "C:\ffmpeg" -ItemType Directory -Force | Out-Null
Write-Host "✅ Pasta criada" -ForegroundColor Green
Write-Host ""

# Baixar FFmpeg
Write-Host "[3/5] Baixando FFmpeg (≈150MB)..." -ForegroundColor Yellow
Write-Host "Isso pode demorar alguns minutos..." -ForegroundColor Gray
$url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$output = "C:\ffmpeg\ffmpeg.zip"

try {
    # Baixar com barra de progresso
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing
    Write-Host "✅ Download concluído" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro no download: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Tente fazer o download manual:" -ForegroundColor Yellow
    Write-Host "https://www.gyan.dev/ffmpeg/builds/" -ForegroundColor White
    Read-Host "Pressione Enter para sair"
    exit 1
}
Write-Host ""

# Extrair
Write-Host "[4/5] Extraindo arquivos..." -ForegroundColor Yellow
try {
    Expand-Archive -Path $output -DestinationPath "C:\ffmpeg" -Force

    # Encontrar a pasta extraída
    $extractedFolder = Get-ChildItem -Path "C:\ffmpeg" -Directory | Where-Object { $_.Name -like "ffmpeg-*" } | Select-Object -First 1

    if ($extractedFolder) {
        # Copiar arquivos do bin para C:\ffmpeg\bin
        if (Test-Path "$($extractedFolder.FullName)\bin") {
            Copy-Item -Path "$($extractedFolder.FullName)\bin\*" -Destination "C:\ffmpeg" -Recurse -Force
        }
    }

    Write-Host "✅ Arquivos extraídos" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao extrair: $_" -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}
Write-Host ""

# Adicionar ao PATH
Write-Host "[5/5] Adicionando ao PATH do sistema..." -ForegroundColor Yellow
try {
    $currentPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::Machine)

    if ($currentPath -notlike "*C:\ffmpeg*") {
        $newPath = $currentPath + ";C:\ffmpeg"
        [Environment]::SetEnvironmentVariable("Path", $newPath, [EnvironmentVariableTarget]::Machine)
        Write-Host "✅ PATH atualizado" -ForegroundColor Green
    } else {
        Write-Host "✅ PATH já contém C:\ffmpeg" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️ Aviso: Não foi possível atualizar PATH automaticamente" -ForegroundColor Yellow
    Write-Host "Você precisará adicionar manualmente: C:\ffmpeg" -ForegroundColor Yellow
}
Write-Host ""

# Testar
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INSTALAÇÃO CONCLUÍDA!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Testando FFmpeg..." -ForegroundColor Yellow

# Atualizar PATH na sessão atual
$env:Path += ";C:\ffmpeg"

try {
    $version = & "C:\ffmpeg\ffmpeg.exe" -version 2>&1 | Select-Object -First 1
    Write-Host "✅ $version" -ForegroundColor Green
    Write-Host ""
    Write-Host "FFmpeg instalado com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Próximo passo:" -ForegroundColor Yellow
    Write-Host "1. Feche este PowerShell" -ForegroundColor White
    Write-Host "2. Abra um NOVO Prompt de Comando" -ForegroundColor White
    Write-Host "3. Execute: converter-mkv-completo.bat" -ForegroundColor White
} catch {
    Write-Host "⚠️ FFmpeg instalado, mas teste falhou" -ForegroundColor Yellow
    Write-Host "Reinicie o computador e tente novamente" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Pressione Enter para sair"
