# 🎬 Como Validar o Upload dos Filmes

## 📊 Status Atual

✅ **Upload em Andamento!**

O script `bulk-upload-movies.ts` está rodando em background e processando todos os 10 filmes da pasta `E:\movies`.

---

## 👀 Acompanhar Progresso

### Opção 1: Ver Log em Tempo Real

```bash
cd backend
tail -f upload-log.txt
```

### Opção 2: Ver Log Completo

```bash
cd backend
cat upload-log.txt
```

### Opção 3: Verificar Status do Processo

```bash
# Windows
tasklist | findstr node

# Linux/Mac
ps aux | grep tsx
```

---

## ⏱️ Tempo Estimado

Com base no tamanho total de **45.42 GB**:

- **Conexão 100 Mbps:** ~50-60 minutos
- **Conexão 50 Mbps:** ~100-120 minutos
- **Conexão 20 Mbps:** ~3-4 horas

O script está usando **multipart upload** com chunks de 10MB, então o progresso é visível em tempo real.

---

## ✅ Validação Pós-Upload

### 1. Verificar se o Script Terminou

O script mostrará uma mensagem final:

```
============================================================
✅ Processamento Concluído!
   Sucessos: 10
   Erros: 0
============================================================
```

### 2. Verificar Banco de Dados (Supabase)

Acesse o painel do Supabase ou execute:

```bash
cd backend
npx tsx scripts/check-supabase-data.ts
```

**Você deve ver:**
- 10 registros na tabela `content`
- ~16 registros na tabela `content_languages` (alguns filmes só têm dublado)

### 3. Verificar S3 (AWS)

```bash
# Verificar posters
aws s3 ls s3://cinevision-capas/posters/ | wc -l
# Deve mostrar: 10

# Verificar vídeos
aws s3 ls s3://cinevision-filmes/videos/ | wc -l
# Deve mostrar: 16
```

Ou acesse o console AWS: https://s3.console.aws.amazon.com/

### 4. Testar no Frontend

```bash
# Iniciar o frontend
cd frontend
npm run dev
```

Acesse: **http://localhost:3000**

**Checklist de Validação:**

- [ ] **Home Page**
  - [ ] Mostra os 10 filmes
  - [ ] Posters carregam corretamente
  - [ ] Títulos e anos estão corretos

- [ ] **Página do Filme** (clique em qualquer filme)
  - [ ] Poster e informações aparecem
  - [ ] Botão "Assistir" funciona
  - [ ] Preço está correto (R$ 15,00)

- [ ] **Player de Vídeo** (após "comprar" ou se configurado como free)
  - [ ] Vídeo carrega
  - [ ] Controles funcionam (play, pause, volume)
  - [ ] Barra de progresso funciona
  - [ ] Qualidade pode ser alterada

- [ ] **Seletor de Idioma** (para filmes com dublado e legendado)
  - [ ] Mostra opções: "Dublado" e "Legendado"
  - [ ] Consegue alternar entre idiomas
  - [ ] Vídeo correto é carregado ao trocar

- [ ] **Formatos de Vídeo**
  - [ ] MKV reproduz corretamente
  - [ ] MP4 reproduz corretamente

---

## 🧪 Testes Específicos

### Teste 1: Filme com Dublado e Legendado

Filme: **Superman (2025)**

1. Acesse o filme
2. Inicie a reprodução (versão dublada deve carregar por padrão)
3. Abra o seletor de idioma
4. Troque para "Legendado"
5. Verifique se o vídeo muda

### Teste 2: Filme Apenas Dublado

Filme: **Como Treinar o Seu Dragão (2025)**

1. Acesse o filme
2. Verifique que NÃO aparece seletor de idioma
3. Inicie a reprodução
4. Vídeo dublado deve carregar

### Teste 3: Formato MKV

Filme: **Lilo & Stitch (2025) - DUBLADO**

1. Este arquivo é MKV
2. Teste se o player Shaka reproduz corretamente
3. Verifique qualidade de vídeo e áudio

### Teste 4: Formato MP4

Filme: **Superman (2025) - LEGENDADO**

1. Este arquivo é MP4
2. Teste se reproduz corretamente
3. Compare com o MKV

---

## 🔧 Troubleshooting

### Problema: Vídeo não carrega

**Diagnóstico:**
```bash
# Verificar se o vídeo está no S3
aws s3 ls s3://cinevision-filmes/videos/ | grep superman

# Testar URL diretamente
curl -I https://cinevision-filmes.s3.amazonaws.com/videos/superman-2025-dubbed.mkv
```

**Possíveis causas:**
1. Upload não completou
2. Bucket S3 não é público
3. CloudFront não está configurado
4. Codec não suportado pelo player

**Solução:**
```bash
# Re-rodar upload para um filme específico
cd backend
# Editar scripts/bulk-upload-movies.ts e mudar MOVIES_DIR
npx tsx scripts/bulk-upload-movies.ts
```

### Problema: Poster não aparece

**Verificar:**
```sql
-- No Supabase
SELECT title, poster_url FROM content WHERE title LIKE '%Superman%';
```

Se `poster_url` estiver NULL, o poster não foi enviado.

**Solução:**
```bash
cd backend
npx tsx scripts/upload-posters.ts
```

### Problema: Seletor de idioma não aparece

**Isso é NORMAL se o filme tem apenas uma versão!**

Verificar no banco:
```sql
SELECT
  c.title,
  COUNT(cl.id) as idiomas
FROM content c
LEFT JOIN content_languages cl ON c.id = cl.content_id
WHERE c.title LIKE '%Superman%'
GROUP BY c.title;
```

Se mostrar apenas 1 idioma, o seletor não aparecerá.

---

## 📈 Próximos Passos Após Validação

1. **✅ Configurar CloudFront**
   - Melhor performance de streaming
   - URLs assinadas para segurança
   - Adaptive bitrate

2. **✅ Implementar Sistema de Pagamento**
   - Stripe integration
   - PIX integration
   - Liberar acesso após pagamento

3. **✅ Adicionar Analytics**
   - Rastrear visualizações
   - Popular filmes
   - Tempo de watch

4. **✅ Sistema de Busca**
   - Buscar por título
   - Filtrar por gênero
   - Filtrar por ano

5. **✅ Recomendações**
   - Filmes similares
   - Baseado em histórico
   - Novos lançamentos

---

## 📞 Suporte

Se encontrar problemas:

1. **Verificar logs:**
   ```bash
   cd backend
   cat upload-log.txt | grep "❌"
   ```

2. **Verificar erro específico:**
   - Erro de S3: Verificar credenciais AWS
   - Erro de Supabase: Verificar conexão
   - Erro de parsing: Verificar nome da pasta do filme

3. **Re-executar script:**
   ```bash
   cd backend
   npx tsx scripts/bulk-upload-movies.ts
   ```

---

## ✨ Conclusão

Após a validação completa, você terá:

✅ 10 filmes no sistema
✅ 16 versões de vídeo (dublado/legendado)
✅ Player funcional com Shaka
✅ Seletor de idioma automático
✅ Suporte para MKV e MP4
✅ Sistema pronto para produção

**Próximo comando:**
```bash
cd frontend
npm run dev
```

Acesse http://localhost:3000 e aproveite! 🎬🍿
