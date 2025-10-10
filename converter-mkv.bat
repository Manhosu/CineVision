@echo off
echo ========================================
echo   CONVERSOR DE MKV PARA MP4
echo   CineVision - Conversao Automatica
echo ========================================
echo.

REM Definir caminho do FFmpeg
set FFMPEG=C:\Users\delas\Downloads\ffmpeg-8.0\ffmpeg-8.0\ffmpeg.exe

REM Verificar se FFmpeg existe
if not exist "%FFMPEG%" (
    echo ERRO: FFmpeg nao encontrado em %FFMPEG%
    echo.
    echo Vou tentar usar ffmpeg do PATH do sistema...
    set FFMPEG=ffmpeg
)

echo Usando FFmpeg: %FFMPEG%
echo.

REM Diretorio dos filmes
set MOVIES_DIR=E:\movies

echo Iniciando conversao dos arquivos .mkv...
echo.

REM 1. Lilo & Stitch (2025) - DUBLADO
echo [1/8] Convertendo: Lilo ^& Stitch - DUBLADO
"%FFMPEG%" -i "%MOVIES_DIR%\FILME_  Lilo & Stitch (2025)\Lilo & Stitch (2025) - DUBLADO-009.mkv" -c:v copy -c:a aac -b:a 192k "%MOVIES_DIR%\FILME_  Lilo & Stitch (2025)\Lilo & Stitch (2025) - DUBLADO.mp4"
if errorlevel 1 (
    echo ERRO ao converter Lilo ^& Stitch
) else (
    echo OK - Lilo ^& Stitch convertido
)
echo.

REM 2. A Hora do Mal (2025) - DUBLADO
echo [2/8] Convertendo: A Hora do Mal - DUBLADO
"%FFMPEG%" -i "%MOVIES_DIR%\FILME_ A Hora do Mal (2025)\A Hora do Mal (2025) - DUBLADO-014.mkv" -c:v copy -c:a aac -b:a 192k "%MOVIES_DIR%\FILME_ A Hora do Mal (2025)\A Hora do Mal (2025) - DUBLADO.mp4"
if errorlevel 1 (
    echo ERRO ao converter A Hora do Mal
) else (
    echo OK - A Hora do Mal convertido
)
echo.

REM 3. Como Treinar o Seu Dragao (2025) - DUBLADO
echo [3/8] Convertendo: Como Treinar o Seu Dragao - DUBLADO
"%FFMPEG%" -i "%MOVIES_DIR%\FILME_ Como Treinar o Seu Dragao (2025)\Como Treinar o Seu Dragao (2025) - DUBLADO-007.mkv" -c:v copy -c:a aac -b:a 192k "%MOVIES_DIR%\FILME_ Como Treinar o Seu Dragao (2025)\Como Treinar o Seu Dragao (2025) - DUBLADO.mp4"
if errorlevel 1 (
    echo ERRO ao converter Como Treinar o Seu Dragao
) else (
    echo OK - Como Treinar o Seu Dragao convertido
)
echo.

REM 4. F1 - O Filme (2025) - DUBLADO (versao 011)
echo [4/8] Convertendo: F1 - O Filme - DUBLADO (v011)
"%FFMPEG%" -i "%MOVIES_DIR%\FILME_ F1 - O Filme (2025)\F1_ O Filme (2025) - DUBLADO-011.mkv" -c:v copy -c:a aac -b:a 192k "%MOVIES_DIR%\FILME_ F1 - O Filme (2025)\F1_ O Filme (2025) - DUBLADO.mp4"
if errorlevel 1 (
    echo ERRO ao converter F1 - O Filme
) else (
    echo OK - F1 - O Filme convertido
)
echo.

REM 5. Jurassic World - Recomeco (2025) - DUBLADO (versao 013)
echo [5/8] Convertendo: Jurassic World - Recomeco - DUBLADO (v013)
"%FFMPEG%" -i "%MOVIES_DIR%\FILME_ Jurassic World_ Recomeco (2025)\Jurassic World_ Recomeco (2025) - DUBLADO-013.mkv" -c:v copy -c:a aac -b:a 192k "%MOVIES_DIR%\FILME_ Jurassic World_ Recomeco (2025)\Jurassic World_ Recomeco (2025) - DUBLADO.mp4"
if errorlevel 1 (
    echo ERRO ao converter Jurassic World - Recomeco
) else (
    echo OK - Jurassic World - Recomeco convertido
)
echo.

REM 6. Superman (2025) - DUBLADO
echo [6/8] Convertendo: Superman - DUBLADO
"%FFMPEG%" -i "%MOVIES_DIR%\FILME_ Superman (2025)\Superman (2025) - DUBLADO-010.mkv" -c:v copy -c:a aac -b:a 192k "%MOVIES_DIR%\FILME_ Superman (2025)\Superman (2025) - DUBLADO.mp4"
if errorlevel 1 (
    echo ERRO ao converter Superman
) else (
    echo OK - Superman convertido
)
echo.

echo ========================================
echo   CONVERSAO CONCLUIDA!
echo ========================================
echo.
echo Arquivos .mp4 gerados em: %MOVIES_DIR%
echo.
echo Pressione qualquer tecla para fechar...
pause >nul
