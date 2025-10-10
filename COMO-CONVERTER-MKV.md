# 🎬 Como Converter Arquivos .MKV para .MP4

## 📋 Resumo

Você tem **8 arquivos .mkv** que precisam ser convertidos para .mp4 para funcionar no navegador.

**Tempo Total:** 10-20 minutos
**Qualidade:** 100% preservada (não há re-encode do vídeo)

---

## 🚀 Passo a Passo Rápido

### PASSO 1: Instalar FFmpeg

**Opção A - Automática (Recomendada):**
1. Abra o **PowerShell como Administrador**:
   - Pressione **Windows**
   - Digite: `PowerShell`
   - **Clique com botão direito** em "Windows PowerShell"
   - Selecione **"Executar como administrador"**

2. Execute:
   ```powershell
   cd C:\Users\delas\OneDrive\Documentos\Projetos\Filmes
   .\instalar-ffmpeg.ps1
   ```

3. Aguarde a instalação (2-5 minutos)

**Opção B - Manual:**
Siga o guia em: **INSTALAR-FFMPEG.md**

---

### PASSO 2: Converter os Arquivos

1. **Feche** o PowerShell (se estava aberto)

2. Abra um **NOVO Prompt de Comando**:
   - Pressione **Windows + R**
   - Digite: `cmd`
   - Pressione **Enter**

3. Execute:
   ```cmd
   cd C:\Users\delas\OneDrive\Documentos\Projetos\Filmes
   converter-mkv-completo.bat
   ```

4. Aguarde a conversão (10-20 minutos)

---

### PASSO 3: Verificar Resultados

Após a conversão, você terá os arquivos .mp4 em:
```
E:\movies\FILME_  Lilo & Stitch (2025)\Lilo & Stitch (2025) - DUBLADO.mp4
E:\movies\FILME_ A Hora do Mal (2025)\A Hora do Mal (2025) - DUBLADO.mp4
E:\movies\FILME_ Como Treinar o Seu Dragão (2025)\Como Treinar o Seu Dragão (2025) - DUBLADO.mp4
E:\movies\FILME_ F1 - O Filme (2025)\F1_ O Filme (2025) - DUBLADO.mp4
E:\movies\FILME_ Jurassic World_ Recomeço (2025)\Jurassic World_ Recomeço (2025) - DUBLADO.mp4
E:\movies\FILME_ Superman (2025)\Superman (2025) - DUBLADO.mp4
```

**NOTA:** Os arquivos duplicados (F1 e Jurassic World) terão "-backup" no nome para você escolher qual usar depois.

---

## 📁 Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| **instalar-ffmpeg.ps1** | Script de instalação automática do FFmpeg |
| **converter-mkv-completo.bat** | Script de conversão dos 8 arquivos .mkv |
| **INSTALAR-FFMPEG.md** | Guia detalhado de instalação manual |
| **COMO-CONVERTER-MKV.md** | Este guia |

---

## ⚙️ O Que o Script Faz?

O script `converter-mkv-completo.bat` executa 8 conversões:

```bash
ffmpeg -i input.mkv -c:v copy -c:a aac -b:a 192k output.mp4
```

**Explicação dos parâmetros:**
- `-i input.mkv` → Arquivo de entrada
- `-c:v copy` → **NÃO re-encode o vídeo** (apenas copia - RÁPIDO!)
- `-c:a aac` → Converte áudio para AAC (compatível com navegadores)
- `-b:a 192k` → Bitrate de áudio 192kbps (alta qualidade)
- `output.mp4` → Arquivo de saída
- `-y` → Sobrescreve arquivo se já existir

---

## ⏱️ Tempo Estimado por Arquivo

| Arquivo | Tamanho (aprox) | Tempo |
|---------|-----------------|-------|
| Lilo & Stitch | ~2.2 GB | 1-2 min |
| A Hora do Mal | ~2.9 GB | 1-3 min |
| Como Treinar o Seu Dragão | ~2.5 GB | 1-2 min |
| F1 - O Filme (v011) | ~2.8 GB | 1-3 min |
| F1 - O Filme (v014) | ~2.8 GB | 1-3 min |
| Jurassic World (v013) | ~3.0 GB | 2-3 min |
| Jurassic World (v015) | ~3.0 GB | 2-3 min |
| Superman | ~3.0 GB | 2-3 min |
| **TOTAL** | **~22 GB** | **10-20 min** |

---

## ❓ Perguntas Frequentes

### Por que não re-encodar o vídeo?
**Resposta:** Re-encode é **MUITO** mais lento (30-60 min por arquivo) e pode reduzir a qualidade. Com `-c:v copy`, copiamos o stream de vídeo sem alterações = rápido + qualidade 100%.

### Os arquivos .mp4 terão o mesmo tamanho?
**Resposta:** Sim, aproximadamente o mesmo tamanho. Apenas o áudio muda de codec.

### Posso deletar os .mkv depois?
**Resposta:** Sim! Após confirmar que os .mp4 funcionam no navegador, pode deletar os .mkv para economizar espaço.

### E se eu tiver mais de um PC?
**Resposta:** Você pode distribuir os arquivos entre PCs diferentes. Por exemplo:
- PC 1: Converte arquivos 1-4
- PC 2: Converte arquivos 5-8

Basta editar o script `.bat` removendo as linhas dos arquivos que não quer converter em cada PC.

### O que fazer com os arquivos duplicados?
**Resposta:** Você tem 2 versões de:
- **F1 - O Filme:** versão 011 e 014
- **Jurassic World:** versão 013 e 015

O script converte ambas. Depois você pode:
1. Testar ambas no navegador
2. Escolher a de melhor qualidade
3. Deletar a outra

---

## 🔧 Solução de Problemas

### Erro: "ffmpeg não é reconhecido"
1. Feche **TODOS** os Prompts/PowerShell abertos
2. Abra um **NOVO** Prompt de Comando
3. Digite: `ffmpeg -version`
4. Se ainda não funcionar, reinicie o PC

### Erro: "Arquivo de entrada não encontrado"
Verifique se os arquivos estão realmente em `E:\movies\`

### Conversão muito lenta (>10 min por arquivo)
Significa que está re-encodando. Verifique se o comando tem `-c:v copy`

### Erro de codec H.265/HEVC
Alguns navegadores não suportam H.265. Nesse caso, precisamos re-encodar para H.264:
```bash
ffmpeg -i input.mkv -c:v libx264 -preset fast -crf 18 -c:a aac -b:a 192k output.mp4
```
(Mais lento, mas compatível)

---

## 📊 Após Converter

### Arquivos .MP4 Prontos: 8 (ou 10 com backups)
### Próximo Passo: Upload via Dashboard Admin

Você pode usar:
1. Upload manual via dashboard (um por vez)
2. Upload via presigned URL (já implementado)
3. Upload direto no S3 via AWS CLI

---

## 📞 Precisa de Ajuda?

Se encontrar algum erro:
1. Anote a mensagem de erro completa
2. Copie a saída do comando: `ffmpeg -version`
3. Me envie as informações

**Scripts Criados:**
- ✅ `instalar-ffmpeg.ps1` - Instalador automático
- ✅ `converter-mkv-completo.bat` - Conversor de todos os 8 arquivos
- ✅ `INSTALAR-FFMPEG.md` - Guia de instalação
- ✅ `COMO-CONVERTER-MKV.md` - Este guia

**Boa conversão!** 🎬
