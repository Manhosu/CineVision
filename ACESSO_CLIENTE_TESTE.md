# 🎬 CineVision - Acesso para Testes do Cliente

## 📋 Informações de Acesso

### Credenciais de Login
- **Email:** `eduardogelista@gmail.com`
- **Senha:** `Teste123`

### URLs da Aplicação
- **Backend API:** http://localhost:3001
- **Documentação API (Swagger):** http://localhost:3001/api/docs
- **Frontend:** http://localhost:3000 _(se estiver rodando)_

---

## 🎥 Conteúdo Disponível

### Filme Liberado para Teste: **Lilo & Stitch (2025)**
✅ **Status:** Completamente funcional e liberado para sua conta

**Versões Disponíveis:**
- 🇧🇷 **Dublado** (2.2 GB - MKV)
- 🇧🇷 **Legendado** (1.3 GB - MP4)

**Recursos do Player:**
- ✅ Seleção de idioma (Dublado/Legendado)
- ✅ Controles de playback (play, pause, volume)
- ✅ Barra de progresso
- ✅ Salvar posição de visualização

---

## 📚 Catálogo Completo (11 Filmes)

Todos os filmes abaixo aparecem no catálogo com seus posters, mas **apenas Lilo & Stitch pode ser assistido**. Os demais exigem compra.

1. ✅ **Lilo & Stitch** (2025) - LIBERADO
2. ⚠️ **Superman** (2025) - Requer compra
3. ⚠️ **A Hora do Mal** (2025) - Requer compra
4. ⚠️ **A Longa Marcha - Caminhe ou Morra** (2025) - Requer compra
5. ⚠️ **Como Treinar o Seu Dragão** (2025) - Requer compra
6. ⚠️ **Demon Slayer - Castelo Infinito** (2025) - Requer compra
7. ⚠️ **F1 - O Filme** (2025) - Requer compra
8. ⚠️ **Invocação do Mal 4: O Último Ritual** (2025) - Requer compra
9. ⚠️ **Jurassic World: Recomeço** (2025) - Requer compra
10. ⚠️ **Quarteto Fantástico 4 - Primeiros Passos** (2025) - Requer compra
11. ⚠️ **Superman (TESTE)** (2025) - Requer compra

---

## 🧪 O Que Testar

### 1. Autenticação
- [ ] Login com as credenciais fornecidas
- [ ] Logout
- [ ] Verificar perfil do usuário

### 2. Catálogo
- [ ] Ver todos os 11 filmes com posters
- [ ] Clicar em Lilo & Stitch (deve abrir)
- [ ] Clicar em outros filmes (deve pedir compra)

### 3. Player de Vídeo - Lilo & Stitch
- [ ] Reproduzir versão dublada
- [ ] Reproduzir versão legendada
- [ ] Trocar entre dublado/legendado
- [ ] Pausar e retomar
- [ ] Avançar/retroceder na timeline
- [ ] Ajustar volume
- [ ] Fechar e reabrir (deve retomar de onde parou)

### 4. Minha Lista
- [ ] Acessar "Minha Lista" ou "My List"
- [ ] Verificar que Lilo & Stitch aparece como comprado
- [ ] Verificar informações da compra

---

## 🔧 Informações Técnicas

### Backend
- **Framework:** NestJS
- **Banco de Dados:** Supabase (PostgreSQL)
- **Storage:** AWS S3 (bucket: cinevision-filmes)
- **Autenticação:** JWT
- **Status:** ✅ Rodando em http://localhost:3001

### Dados do Usuário no Sistema
- **ID:** `38789f6f-afc4-4eb5-8dbe-f9b69b01435a`
- **Role:** `user`
- **Compras:** 1 (Lilo & Stitch)
- **Status da Compra:** `paid`
- **Token de Acesso:** Válido até 2026

### Dados do Filme
- **ID:** `c7ed9623-7bcb-4c13-91b7-6f96b76facd1`
- **Título:** Lilo & Stitch
- **Ano:** 2025
- **Preço:** R$ 15,00
- **Duração:** 95 minutos
- **Status:** PUBLISHED

---

## 🐛 Problemas Conhecidos

1. **Outros Filmes:** Apenas Lilo & Stitch tem vídeo. Outros filmes mostram apenas poster.
2. **HLS/Streaming:** Vídeos estão em formato direto (MKV/MP4), não HLS. CloudFront CDN não configurado ainda.
3. **Telegram Bot:** Implementado mas não testado completamente.
4. **Stripe:** Integração configurada em modo teste.

---

## 📞 Suporte

Para reportar bugs ou solicitar ajustes, entre em contato com a equipe de desenvolvimento.

**Data de Preparação:** 07/10/2025
**Versão:** 1.0 (Teste Cliente)
