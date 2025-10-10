# 📦 Guia de Instalação do FFmpeg

## Opção 1: Download Manual (Mais Fácil)

### Passo 1: Baixar FFmpeg
1. Abra o navegador e acesse: https://www.gyan.dev/ffmpeg/builds/
2. Clique em **"ffmpeg-release-essentials.zip"** (ou "ffmpeg-git-essentials.7z")
3. Aguarde o download (≈150MB)

### Passo 2: Extrair o Arquivo
1. Abra a pasta **Downloads**
2. Clique com botão direito em **ffmpeg-release-essentials.zip**
3. Selecione **"Extrair tudo..."**
4. Extraia para: `C:\ffmpeg`

### Passo 3: Adicionar ao PATH do Windows
1. Pressione **Windows + R**
2. Digite: `sysdm.cpl` e pressione **Enter**
3. Vá na aba **"Avançado"**
4. Clique em **"Variáveis de Ambiente"**
5. Em **"Variáveis do sistema"**, encontre **"Path"**
6. Clique em **"Editar"**
7. Clique em **"Novo"**
8. Digite: `C:\ffmpeg\bin`
9. Clique **OK** em todas as janelas

### Passo 4: Testar Instalação
1. Abra um **Prompt de Comando NOVO** (importante: novo!)
2. Digite: `ffmpeg -version`
3. Se aparecer a versão, está funcionando!

---

## Opção 2: Usando o FFmpeg que Você Já Tem

Se a pasta `C:\Users\delas\Downloads\ffmpeg-8.0\ffmpeg-8.0` for a compilação correta:

### Verificar se tem executável:
1. Abra a pasta: `C:\Users\delas\Downloads\ffmpeg-8.0\ffmpeg-8.0`
2. Procure por uma pasta chamada `bin`
3. Dentro dela deve ter `ffmpeg.exe`, `ffprobe.exe`, `ffplay.exe`

Se **NÃO** tiver a pasta `bin`, essa é a versão de código-fonte e você precisa baixar a versão compilada (Opção 1).

---

## Opção 3: Instalação Rápida via PowerShell (Recomendada)

### Abra o PowerShell como Administrador:
1. Pressione **Windows**
2. Digite: `PowerShell`
3. Clique com botão direito em **"Windows PowerShell"**
4. Selecione **"Executar como administrador"**

### Execute os comandos:

```powershell
# Criar pasta
New-Item -Path "C:\ffmpeg" -ItemType Directory -Force

# Baixar FFmpeg
Invoke-WebRequest -Uri "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -OutFile "C:\ffmpeg\ffmpeg.zip"

# Extrair
Expand-Archive -Path "C:\ffmpeg\ffmpeg.zip" -DestinationPath "C:\ffmpeg" -Force

# Mover arquivos para C:\ffmpeg\bin
Move-Item -Path "C:\ffmpeg\ffmpeg-*\bin" -Destination "C:\ffmpeg" -Force

# Adicionar ao PATH
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\ffmpeg\bin", [EnvironmentVariableTarget]::Machine)

# Testar
ffmpeg -version
```

Se aparecer a versão do FFmpeg, está instalado!

---

## Depois de Instalar

1. **Feche todos os Prompts de Comando/PowerShell** abertos
2. **Abra um novo Prompt de Comando**
3. Execute o script de conversão:
   ```
   cd C:\Users\delas\OneDrive\Documentos\Projetos\Filmes
   converter-mkv-completo.bat
   ```

---

## Solução de Problemas

### Erro: "ffmpeg não é reconhecido"
**Causa:** PATH não foi atualizado ou terminal não foi reiniciado

**Solução:**
1. Feche **TODOS** os Prompts de Comando/PowerShell
2. Abra um **NOVO** Prompt de Comando
3. Tente novamente: `ffmpeg -version`

### Erro: "Acesso negado"
**Causa:** PowerShell não está como Administrador

**Solução:**
Execute o PowerShell como Administrador (botão direito → Executar como administrador)

### FFmpeg muito lento
**Causa:** Pode estar re-encodando o vídeo

**Solução:**
O script usa `-c:v copy` que é rápido. Se ainda estiver lento, verifique se o arquivo .mkv tem codec H.264 ou H.265.

---

## Verificar Codec do Arquivo MKV

Para saber qual codec seu arquivo usa:

```bash
ffprobe "E:\movies\FILME_ Superman (2025)\Superman (2025) - DUBLADO-010.mkv"
```

Procure por:
- **Video:** `h264` ou `hevc` (H.265)
- **Audio:** `ac3`, `dts`, `aac`, `opus`

Se for `h264`, a conversão será rápida (1-2 min)
Se for `hevc` (H.265), ainda será rápido com `-c:v copy`

---

## Quanto Tempo Vai Demorar?

**Com `-c:v copy` (nossa abordagem):**
- Arquivo de 2GB: ~1-2 minutos
- 8 arquivos: ~10-15 minutos total

**Sem `-c:v copy` (re-encode completo):**
- Arquivo de 2GB: ~30-60 minutos
- 8 arquivos: ~4-8 horas (NÃO RECOMENDADO)

**Por isso usamos `-c:v copy`!**

---

## Após Converter

Você terá:
- 8 arquivos .mkv (originais - pode deletar depois)
- 8 arquivos .mp4 (novos - fazer upload destes)

**Tamanho:** Os .mp4 terão aproximadamente o mesmo tamanho dos .mkv (porque não re-encodamos o vídeo)

---

## Precisa de Ajuda?

Se encontrar algum erro, me envie:
1. A mensagem de erro completa
2. A saída do comando: `ffmpeg -version`
3. O tamanho do arquivo .mkv que está tentando converter

