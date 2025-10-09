# 📽️ Upload de Filmes - Resumo e Instruções

## ✅ Status do Upload

**Data:** 2025-10-07
**Script Executado:** `backend/scripts/bulk-upload-movies.ts`
**Origem:** `E:\movies`

### Filmes Processados (10 total):

1. **Lilo & Stitch (2025)**
   - 🎙️ Dublado: `Lilo & Stitch (2025) - DUBLADO-009.mkv` (2.18 GB)
   - 📝 Legendado: `Lilo & Stitch (2025) - LEGENDADO.mp4`
   - 🖼️ Poster: POSTER.png

2. **A Hora do Mal (2025)**
   - 🎙️ Dublado: `A Hora do Mal (2025) - DUBLADO-014.mkv`
   - 📝 Legendado: `A Hora do Mal (2025) - LEGENDADO.mp4`
   - 🖼️ Poster: POSTER.png

3. **A Longa Marcha - Caminhe ou Morra (2025)**
   - 🎙️ Dublado: `A Longa Marcha_ Caminhe ou Morra (2025) - DUBLADO -013.mp4` (versão mais recente)
   - 🖼️ Poster: POSTER.png

4. **Como Treinar o Seu Dragão (2025)**
   - 🎙️ Dublado: `Como Treinar o Seu Dragão (2025) - DUBLADO-007.mkv`
   - 🖼️ Poster: POSTER.png

5. **Demon Slayer - Castelo Infinito (2025)**
   - 🎙️ Dublado: `Demon Slayer - Castelo Infinito (2025) - DUBLADO-001.mp4`
   - 📝 Legendado: `DEMON SLAYER LEGENDADO-016.mp4` (versão mais recente)
   - 🖼️ Poster: POSTER.png

6. **F1 - O Filme (2025)**
   - 🎙️ Dublado: `F1_ O Filme (2025) - DUBLADO-014.mkv` (versão mais recente)
   - 📝 Legendado: `F1_ O Filme (2025) - LEGENDADO-005.mp4`
   - 🖼️ Poster: POSTER.png

7. **Invocação do Mal 4 - O Último Ritual (2025)**
   - 🎙️ Dublado: `Invocação do Mal 4_ O Último Ritual (2025) - DUBLADO-015.mp4`
   - 🖼️ Poster: POSTER.png

8. **Jurassic World - Recomeço (2025)**
   - 🎙️ Dublado: `Jurassic World_ Recomeço (2025) - DUBLADO-015.mkv` (versão mais recente)
   - 📝 Legendado: `Jurassic World_ Recomeço (2025) - LEGENDADO.mp4`
   - 🖼️ Poster: POSTER.png

9. **Quarteto Fantástico 4 - Primeiros Passos (2025)**
   - 🎙️ Dublado: `Quarteto Fantástico_ Primeiros Passos (2025) - DUBLADO-003.mp4`
   - 🖼️ Poster: POSTER.png

10. **Superman (2025)**
    - 🎙️ Dublado: `Superman (2025) - DUBLADO-010.mkv`
    - 📝 Legendado: `Superman (2025) - LEGENDADO.mp4`
    - 🖼️ Poster: POSTER.png

---

## 📊 Estatísticas

- **Total de Filmes:** 10
- **Total de Vídeos:** 16 (alguns filmes têm apenas dublado)
- **Tamanho Total:** 45.42 GB
- **Formatos:** MKV e MP4
- **Idiomas:** Português (Dublado) e Português (Legendado)

---

## 🗄️ Estrutura do Banco de Dados

### Tabela `content`
Cada filme possui um registro com:
- `title`: Título do filme
- `release_year`: 2025
- `poster_url`: URL do poster no S3
- `price_cents`: 1500 (R$ 15,00)
- `status`: PUBLISHED
- `content_type`: movie

### Tabela `content_languages`
Cada versão (dublado/legendado) possui um registro com:
- `content_id`: ID do filme (FK)
- `language_type`: 'dubbed' ou 'subtitled'
- `language_code`: 'pt-BR'
- `language_name`: 'Português (Brasil) - Dublado' ou 'Legendado'
- `video_storage_key`: Caminho do vídeo no S3
- `is_default`: true para dublado
- `is_active`: true

---

## ✅ Checklist de Validação

### 1. Verificar Banco de Dados

```sql
-- Verificar filmes adicionados
SELECT id, title, release_year, status, poster_url
FROM content
WHERE release_year = 2025
ORDER BY title;

-- Verificar idiomas
SELECT
  c.title,
  cl.language_type,
  cl.language_name,
  cl.is_default,
  cl.video_storage_key
FROM content c
JOIN content_languages cl ON c.id = cl.content_id
WHERE c.release_year = 2025
ORDER BY c.title, cl.language_type;
```

### 2. Verificar S3

**Bucket de Posters:** `cinevision-capas`
```bash
aws s3 ls s3://cinevision-capas/posters/
```

**Bucket de Vídeos:** `cinevision-filmes`
```bash
aws s3 ls s3://cinevision-filmes/videos/
```

### 3. Testar Frontend

1. **Acessar:** http://localhost:3000
2. **Verificar:** Os 10 filmes aparecem na home
3. **Clicar:** Em um filme com dublado e legendado
4. **Testar Player:**
   - ✅ Vídeo carrega corretamente
   - ✅ Player Shaka funciona
   - ✅ Controles funcionam (play, pause, volume)
   - ✅ Seletor de qualidade funciona
5. **Testar Seletor de Idioma:**
   - ✅ Mostra opções: "Dublado" e "Legendado"
   - ✅ Troca entre idiomas funciona
   - ✅ Vídeo correto é carregado

### 4. Testar MKV vs MP4

**MKV (normalmente dublado):**
- Superman - DUBLADO
- Como Treinar o Seu Dragão - DUBLADO
- F1 - DUBLADO

**MP4 (normalmente legendado):**
- Superman - LEGENDADO
- A Hora do Mal - LEGENDADO

Verificar se ambos os formatos reproduzem corretamente no Shaka Player.

### 5. Testar Chromecast/AirPlay

Se disponível, testar:
- ✅ Botão Chromecast aparece
- ✅ Conexão com Chromecast funciona
- ✅ Vídeo transmite corretamente

---

## 🛠️ Scripts Úteis

### Limpar Filmes de Teste

```sql
-- Remover filmes de teste (caso necessário)
DELETE FROM content_languages
WHERE content_id IN (
  SELECT id FROM content WHERE title LIKE '%(TESTE)%'
);

DELETE FROM content WHERE title LIKE '%(TESTE)%';
```

### Reprocessar um Filme Específico

Se algum filme falhar, você pode reprocessar apenas ele:

```typescript
// Editar backend/scripts/bulk-upload-movies.ts
// Mudar a linha do MOVIES_DIR para:
const MOVIES_DIR = 'E:/movies/FILME_ Superman (2025)';
```

### Verificar Logs de Upload

```bash
cd backend
cat upload-log.txt
```

---

## 🔧 Troubleshooting

### Erro: "Failed to upload part X"

**Causa:** Problema de conexão com S3
**Solução:**
1. Verificar credenciais AWS no `.env`
2. Verificar permissões do bucket S3
3. Tentar novamente (o script tem retry automático)

### Erro: "Movie already exists"

**Causa:** Filme já foi processado anteriormente
**Comportamento:** O script atualiza os registros existentes

### Vídeo não reproduz no player

**Possíveis causas:**
1. **Formato não suportado:** Verificar se o Shaka Player suporta o codec
2. **URL inválida:** Verificar se o CloudFront está configurado
3. **Permissões S3:** Verificar se o bucket é público ou tem URLs assinadas

**Solução:**
```bash
# Testar URL diretamente
curl -I https://cinevision-filmes.s3.amazonaws.com/videos/superman-2025-dubbed.mkv
```

### Seletor de idioma não aparece

**Causa:** Filme tem apenas uma versão (ex: só dublado)
**Comportamento esperado:** Seletor não aparece se há apenas um idioma

---

## 📈 Próximos Passos

1. ✅ Validar upload completo
2. ✅ Testar player com todos os filmes
3. ⏳ Configurar CloudFront para streaming otimizado
4. ⏳ Implementar HLS para adaptive bitrate
5. ⏳ Adicionar sistema de transcoding automático
6. ⏳ Implementar analytics de visualizações

---

## 📝 Notas Técnicas

### Multipart Upload
- **Chunk Size:** 10 MB
- **Vantagem:** Permite upload de arquivos grandes (>5GB)
- **Retry:** Automático por parte
- **Progress:** Barra de progresso em tempo real

### Detecção de Idioma
O script detecta automaticamente o tipo de idioma baseado no nome do arquivo:
- **DUBLADO/DUBBED** → `language_type: 'dubbed'`
- **LEGENDADO/SUBTITLED** → `language_type: 'subtitled'`

### Múltiplas Versões
Quando há múltiplos arquivos do mesmo tipo (ex: "DUBLADO-013" e "DUBLADO-014"), o script escolhe automaticamente a versão com o número maior.

---

## 🎯 Conclusão

Este documento serve como referência completa para o processo de upload de filmes no CineVision. Mantenha-o atualizado conforme adicionar novos filmes ou fazer alterações no sistema.

**Última atualização:** 2025-10-07
