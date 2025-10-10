@echo off
echo ========================================
echo   CONVERSOR DE MKV PARA MP4
echo   CineVision - Arquivos Restantes
echo ========================================
echo.
echo Este script ira converter 5 arquivos .mkv para .mp4
echo Tempo estimado: 8-15 minutos
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
    echo Por favor, instale o FFmpeg ou adicione ao PATH
    echo.
    pause
    exit /b 1
)

echo FFmpeg encontrado! Versao:
%FFMPEG% -version | findstr "ffmpeg version"
echo.
echo Iniciando conversoes...
echo.

REM ========================================
REM 1. A Hora do Mal (2025) - DUBLADO
REM ========================================
echo [1/5] Convertendo: A Hora do Mal - DUBLADO
echo Entrada: A Hora do Mal (2025) - DUBLADO-014.mkv
echo Saida:   A Hora do Mal (2025) - DUBLADO.mp4
echo.
%FFMPEG% -i "%MOVIES_DIR%\FILME_ A Hora do Mal (2025)\A Hora do Mal (2025) - DUBLADO-014.mkv" -c:v copy -c:a aac -b:a 192k "%MOVIES_DIR%\FILME_ A Hora do Mal (2025)\A Hora do Mal (2025) - DUBLADO.mp4" -y
if errorlevel 1 (
    echo [X] ERRO ao converter A Hora do Mal
) else (
    echo [OK] A Hora do Mal convertido com sucesso!
)
echo.
echo ----------------------------------------
echo.

REM ========================================
REM 2. Como Treinar o Seu Dragao (2025) - DUBLADO
REM ========================================
echo [2/5] Convertendo: Como Treinar o Seu Dragao - DUBLADO
echo Entrada: Como Treinar o Seu Dragao (2025) - DUBLADO-007.mkv
echo Saida:   Como Treinar o Seu Dragao (2025) - DUBLADO.mp4
echo.
%FFMPEG% -i "%MOVIES_DIR%\FILME_ Como Treinar o Seu Dragão (2025)\Como Treinar o Seu Dragão (2025) - DUBLADO-007.mkv" -c:v copy -c:a aac -b:a 192k "%MOVIES_DIR%\FILME_ Como Treinar o Seu Dragão (2025)\Como Treinar o Seu Dragão (2025) - DUBLADO.mp4" -y
if errorlevel 1 (
    echo [X] ERRO ao converter Como Treinar o Seu Dragao
) else (
    echo [OK] Como Treinar o Seu Dragao convertido com sucesso!
)
echo.
echo ----------------------------------------
echo.

REM ========================================
REM 3. F1 - O Filme (2025) - DUBLADO (versao 011)
REM ========================================
echo [3/5] Convertendo: F1 - O Filme - DUBLADO (versao 011)
echo Entrada: F1_ O Filme (2025) - DUBLADO-011.mkv
echo Saida:   F1_ O Filme (2025) - DUBLADO.mp4
echo.
%FFMPEG% -i "%MOVIES_DIR%\FILME_ F1 - O Filme (2025)\F1_ O Filme (2025) - DUBLADO-011.mkv" -c:v copy -c:a aac -b:a 192k "%MOVIES_DIR%\FILME_ F1 - O Filme (2025)\F1_ O Filme (2025) - DUBLADO.mp4" -y
if errorlevel 1 (
    echo [X] ERRO ao converter F1 - O Filme (v011)
) else (
    echo [OK] F1 - O Filme (v011) convertido com sucesso!
)
echo.
echo ----------------------------------------
echo.

REM ========================================
REM 4. F1 - O Filme (2025) - DUBLADO (versao 014 - BACKUP)
REM ========================================
echo [4/5] Convertendo: F1 - O Filme - DUBLADO (versao 014 - backup)
echo Entrada: F1_ O Filme (2025) - DUBLADO-014.mkv
echo Saida:   F1_ O Filme (2025) - DUBLADO-014-backup.mp4
echo.
%FFMPEG% -i "%MOVIES_DIR%\FILME_ F1 - O Filme (2025)\F1_ O Filme (2025) - DUBLADO-014.mkv" -c:v copy -c:a aac -b:a 192k "%MOVIES_DIR%\FILME_ F1 - O Filme (2025)\F1_ O Filme (2025) - DUBLADO-014-backup.mp4" -y
if errorlevel 1 (
    echo [X] ERRO ao converter F1 - O Filme (v014)
) else (
    echo [OK] F1 - O Filme (v014) convertido com sucesso!
)
echo.
echo ----------------------------------------
echo.

REM ========================================
REM 5. Jurassic World - Recomeco (2025) - DUBLADO (versao 015)
REM ========================================
echo [5/5] Convertendo: Jurassic World - Recomeco - DUBLADO
echo Entrada: Jurassic World_ Recomeço (2025) - DUBLADO-015.mkv
echo Saida:   Jurassic World_ Recomeço (2025) - DUBLADO.mp4
echo.
%FFMPEG% -i "%MOVIES_DIR%\FILME_ Jurassic World_ Recomeço (2025)\Jurassic World_ Recomeço (2025) - DUBLADO-015.mkv" -c:v copy -c:a aac -b:a 192k "%MOVIES_DIR%\FILME_ Jurassic World_ Recomeço (2025)\Jurassic World_ Recomeço (2025) - DUBLADO.mp4" -y
if errorlevel 1 (
    echo [X] ERRO ao converter Jurassic World
) else (
    echo [OK] Jurassic World convertido com sucesso!
)
echo.
echo ----------------------------------------
echo.

echo ========================================
echo   CONVERSAO CONCLUIDA!
echo ========================================
echo.
echo Arquivos convertidos:
echo 1. A Hora do Mal (2025) - DUBLADO.mp4
echo 2. Como Treinar o Seu Dragao (2025) - DUBLADO.mp4
echo 3. F1_ O Filme (2025) - DUBLADO.mp4
echo 4. F1_ O Filme (2025) - DUBLADO-014-backup.mp4
echo 5. Jurassic World_ Recomeço (2025) - DUBLADO.mp4
echo.
echo Todos os arquivos .mp4 foram salvos em: %MOVIES_DIR%
echo.
echo Voce pode agora fazer upload dos arquivos via dashboard admin
echo.
echo Pressione qualquer tecla para fechar...
pause >nul
