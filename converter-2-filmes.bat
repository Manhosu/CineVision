@echo off
echo ========================================
echo   CONVERSOR DE MKV PARA MP4
echo   2 Filmes Pendentes
echo ========================================
echo.
echo Este script ira converter 2 arquivos .mkv para .mp4
echo Tempo estimado: 3-6 minutos
echo.
echo Pressione qualquer tecla para iniciar...
pause >nul
echo.

REM Diretorio dos filmes
set MOVIES_DIR=E:\movies

REM Tentar encontrar FFmpeg
set FFMPEG=ffmpeg

REM Testar se FFmpeg funciona
%FFMPEG% -version >nul 2>&1
if errorlevel 1 (
    echo ERRO: FFmpeg nao encontrado no PATH do sistema
    echo.
    pause
    exit /b 1
)

echo FFmpeg encontrado!
echo.
echo Iniciando conversoes...
echo.

REM ========================================
REM 1. Como Treinar o Seu Dragao (2025) - DUBLADO
REM ========================================
echo [1/2] Convertendo: Como Treinar o Seu Dragao - DUBLADO
echo.
%FFMPEG% -i "%MOVIES_DIR%\FILME_ Como Treinar o Seu Dragão (2025)\Como Treinar o Seu Dragão (2025) - DUBLADO-007.mkv" -c:v copy -c:a aac -b:a 192k "%MOVIES_DIR%\FILME_ Como Treinar o Seu Dragão (2025)\Como Treinar o Seu Dragão (2025) - DUBLADO.mp4" -y
if errorlevel 1 (
    echo [X] ERRO ao converter Como Treinar o Seu Dragao
) else (
    echo [OK] Como Treinar o Seu Dragao convertido!
)
echo.
echo ----------------------------------------
echo.

REM ========================================
REM 2. Jurassic World - Recomeco (2025) - DUBLADO
REM ========================================
echo [2/2] Convertendo: Jurassic World - Recomeco - DUBLADO
echo.
%FFMPEG% -i "%MOVIES_DIR%\FILME_ Jurassic World_ Recomeço (2025)\Jurassic World_ Recomeço (2025) - DUBLADO-015.mkv" -c:v copy -c:a aac -b:a 192k "%MOVIES_DIR%\FILME_ Jurassic World_ Recomeço (2025)\Jurassic World_ Recomeço (2025) - DUBLADO.mp4" -y
if errorlevel 1 (
    echo [X] ERRO ao converter Jurassic World
) else (
    echo [OK] Jurassic World convertido!
)
echo.
echo ----------------------------------------
echo.

echo ========================================
echo   CONVERSAO CONCLUIDA!
echo ========================================
echo.
echo Arquivos convertidos salvos em: %MOVIES_DIR%
echo.
echo Pressione qualquer tecla para fechar...
pause >nul
