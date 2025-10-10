========================================
  CONVERSÃO DE .MKV PARA .MP4
  CineVision - Guia Rápido
========================================

📁 ARQUIVOS CRIADOS PARA VOCÊ:
--------------------------------
✅ instalar-ffmpeg.ps1           → Instala FFmpeg automaticamente
✅ converter-mkv-completo.bat    → Converte todos os 8 arquivos .mkv
✅ INSTALAR-FFMPEG.md            → Guia de instalação detalhado
✅ COMO-CONVERTER-MKV.md         → Instruções completas

========================================
  INÍCIO RÁPIDO (3 PASSOS)
========================================

PASSO 1: INSTALAR FFMPEG
-------------------------
1. Abra PowerShell como Administrador:
   - Windows → Digite "PowerShell"
   - Botão direito → "Executar como administrador"

2. Execute:
   cd C:\Users\delas\OneDrive\Documentos\Projetos\Filmes
   .\instalar-ffmpeg.ps1

3. Aguarde (2-5 minutos)


PASSO 2: CONVERTER ARQUIVOS
----------------------------
1. FECHE o PowerShell

2. Abra NOVO Prompt de Comando:
   - Windows + R
   - Digite: cmd
   - Enter

3. Execute:
   cd C:\Users\delas\OneDrive\Documentos\Projetos\Filmes
   converter-mkv-completo.bat

4. Aguarde (10-20 minutos)


PASSO 3: VERIFICAR RESULTADO
-----------------------------
Arquivos .mp4 estarão em:
E:\movies\FILME_  Lilo & Stitch (2025)\
E:\movies\FILME_ A Hora do Mal (2025)\
E:\movies\FILME_ Como Treinar o Seu Dragão (2025)\
E:\movies\FILME_ F1 - O Filme (2025)\
E:\movies\FILME_ Jurassic World_ Recomeço (2025)\
E:\movies\FILME_ Superman (2025)\

========================================
  ARQUIVOS QUE SERÃO CONVERTIDOS
========================================

[1/8] Lilo & Stitch (2025) - DUBLADO-009.mkv
      → Lilo & Stitch (2025) - DUBLADO.mp4

[2/8] A Hora do Mal (2025) - DUBLADO-014.mkv
      → A Hora do Mal (2025) - DUBLADO.mp4

[3/8] Como Treinar o Seu Dragão (2025) - DUBLADO-007.mkv
      → Como Treinar o Seu Dragão (2025) - DUBLADO.mp4

[4/8] F1_ O Filme (2025) - DUBLADO-011.mkv
      → F1_ O Filme (2025) - DUBLADO.mp4

[5/8] F1_ O Filme (2025) - DUBLADO-014.mkv
      → F1_ O Filme (2025) - DUBLADO-014-backup.mp4

[6/8] Jurassic World_ Recomeço (2025) - DUBLADO-013.mkv
      → Jurassic World_ Recomeço (2025) - DUBLADO.mp4

[7/8] Jurassic World_ Recomeço (2025) - DUBLADO-015.mkv
      → Jurassic World_ Recomeço (2025) - DUBLADO-015-backup.mp4

[8/8] Superman (2025) - DUBLADO-010.mkv
      → Superman (2025) - DUBLADO.mp4

========================================
  INFORMAÇÕES TÉCNICAS
========================================

✅ Qualidade: 100% preservada (vídeo não é re-encodado)
✅ Compatibilidade: Todos os navegadores modernos
✅ Tempo: ~10-20 minutos total
✅ Comando: ffmpeg -c:v copy -c:a aac

========================================
  SOLUÇÃO DE PROBLEMAS
========================================

Erro: "ffmpeg não é reconhecido"
→ Feche TODOS os terminais e abra um NOVO

Erro: "Arquivo não encontrado"
→ Verifique se os .mkv estão em E:\movies\

Conversão muito lenta (>10 min/arquivo)
→ Pode estar re-encodando. Verifique se o script tem -c:v copy

========================================
  PRÓXIMOS PASSOS APÓS CONVERSÃO
========================================

1. Testar um arquivo .mp4 no navegador
2. Se funcionar, fazer upload via dashboard admin
3. Pode deletar os .mkv depois (economiza espaço)

========================================

Para mais informações, leia:
- COMO-CONVERTER-MKV.md (guia completo)
- INSTALAR-FFMPEG.md (instalação detalhada)

Qualquer dúvida, me avise! 🎬

========================================
