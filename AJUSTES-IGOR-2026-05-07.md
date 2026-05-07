# Ajustes Igor — Rodada 07/05/2026

Lote de **15 áudios/vídeos** enviados pelo Igor entre 06/05 noite e 07/05 final-da-tarde, transcritos via Whisper. Consolida 2 mensagens textuais já recebidas (IA não chama no privado, ativar IA no DM pessoal pra cirurgia de sábado).

**Total: 13 itens distintos** (alguns vídeos duplicados — o `6.05.46 PM` e `6.05.52 PM` são reenvios da mesma queixa, e o `6.04.52 PM` é o intro daquela mesma reclamação).

---

## 🔴 Críticos (bloqueiam vendas / atendimento — fazer primeiro)

### N1 — IA não chama Igor no privado quando não consegue responder, e algumas conversas ficam sem resposta
**Origem**: vídeo `6.55.03 PM` 06/05 + vídeo `9.20.27 PM` 06/05 + mensagem texto direto

**Reportado**:
- IA não está chamando o Igor no DM do Telegram quando uma conversa precisa de atendimento humano (cliente pediu filme fora do catálogo, falha na IA, etc).
- Cliente perguntou de "Devorador de Estrelas" (filme que TEM no catálogo) e a IA não respondeu — conversa ficou ativa mas sem resposta.
- Cliente pagou e enviou comprovante (R$ 7,52) — Igor não recebeu notificação.
- Comportamento intermitente: às vezes a IA chama, outras não.

**Causa provável**: `TELEGRAM_ADMIN_CHAT_ID` não configurada no Render, ou a notificação está silenciando em catch sem log. O fluxo de fallback chama `notifyAdminForTakeover` em [ai-chat.service.ts:966](backend/src/modules/ai-chat/ai-chat.service.ts#L966), que retorna early se a env var estiver faltando.

**Fix**:
- Validar via `/admin/ai-chat/health` ou logs do Render se `TELEGRAM_ADMIN_CHAT_ID` está set.
- Caso não, configurar com o chat_id pessoal do Igor (`2006803983`).
- Adicionar log explícito quando ela tá faltando + alerta no banner do `/admin/ai-chat`.
- Investigar por que a IA não responde "Devorador de Estrelas" mesmo estando no catálogo (debug do `searchContent` ou contexto do prompt).

**Prioridade**: 🔴 crítica (Igor cirurgia sábado — IA tem que estar 95%+ funcional).

---

### N2 — Ativar IA no DM pessoal do Igor (Telegram Business)
**Origem**: mensagem texto direto

**Reportado**: "Vou fazer cirurgia no sábado, preciso que a IA esteja pelo menos uns 95% atendendo os clientes". A IA já tem toggle no `/admin/ai-chat` (Business connection), mas precisa ser **explicitamente habilitada** pra a DM pessoal.

**Fix**:
- Validar que existe Business connection ativa pro telegram_id do Igor.
- Habilitar via toggle `is_enabled=true` (endpoint `PUT /admin/ai-chat/business-connections/:id` já existe — feature N17 da rodada anterior).
- Confirmar via teste: mandar mensagem pro DM pessoal do Igor de outra conta → IA responde.

**Prioridade**: 🔴 crítica (cirurgia sábado).

---

### N3 — Filme com Chat ID configurado retorna "conteúdo indisponível" (fluxo Sirāt + entrega geral)
**Origem**: vídeo `6.04.52 PM` + `6.05.46 PM` + `6.05.52 PM` + `6.08.43 PM`

**Reportado**:
- Igor configurou Chat ID do filme **Sirāt**, bot é admin do grupo, ID está correto.
- Cliente clica "Assistir" no dashboard → "Conteúdo indisponível no momento".
- Mesma coisa quando comprou e clicou em "Assistir agora" depois do PIX → "Pular por enquanto" também não libera.
- Sirāt foi cadastrado SÓ com Chat ID, sem link de convite regular.

**Causa provável**: o fix do `getOrCreateAccessLinkForPurchasedContent` (commit `7f6ad96`) tenta `createInviteLinkForUser(chatId)`. Se falhar **e** não tem `telegram_group_link` cadastrado, retorna `BadRequestException`. No vídeo, Igor diz "bot é admin" — então o `createChatInviteLink` deveria funcionar. Pode ser:
1. ID com formato inválido (`-3766259398` tem 10 dígitos sem prefixo `-100` que supergrupos usam).
2. Bot não tem permissão específica de **"Convidar usuários via link"** mesmo sendo admin.
3. O endpoint do bot está retornando erro silenciosamente.

**Fix**:
- Adicionar log detalhado em `createInviteLinkForUser` mostrando exatamente o erro retornado pelo Telegram API (`error.response.data`).
- Validar formato do Chat ID antes de salvar no admin form (rejeitar se não bater regex `/^-100\d+$/`).
- Idealmente, **botão "Testar Chat ID"** no admin form que faz uma chamada `getChat` via Bot API e mostra: "✅ Bot é admin com permissão" ou "❌ Erro X".

**Prioridade**: 🔴 crítica (cliente paga e não recebe acesso).

---

### N4 — Compra anônima com Chat ID: pagou pelo deep link mas não liberou
**Origem**: vídeo `1.02.51 AM` 07/05

**Reportado**: Cliente clica em "receber pelo Telegram" sem estar logado, faz o PIX, abre o bot, recebe "pagamento confirmado" mas o filme não é entregue. Mesmo problema do N3 mas via fluxo de order anônima (orphan order).

**Causa**: `notifyBotForDelivery` em [orders.service.ts](backend/src/modules/orders/orders.service.ts) já tem fallback (commit `7f6ad96`), mas pode estar caindo no caso "sem buttonUrl" se o `createInviteLinkForUser` falhar e não tiver link regular.

**Fix**:
- Mesmo fix do N3 — log detalhado + validação de Chat ID no save.
- Garantir que content sempre tem **pelo menos um** dos dois (Chat ID ou link regular) — validação no admin form (já implementada).

**Prioridade**: 🔴 crítica.

---

### N5 — Popup do WhatsApp reabre toda vez que o usuário fecha (não salva)
**Origem**: vídeo `6.12.28 PM`

**Reportado**: User entra no dashboard pela primeira vez, popup pede WhatsApp, ele preenche e salva → toast "WhatsApp salvo". Mas se fechar (X) e voltar pro dashboard, o popup aparece de novo pedindo WhatsApp de novo. Igor diz: "informação não está sendo salva no banco, e está solicitando novamente".

**Análise**:
- O `WhatsAppNumberGate.handleSave` em [WhatsAppNumberGate.tsx:38-87](frontend/src/components/WhatsApp/WhatsAppNumberGate.tsx) faz `PATCH /users/:id/whatsapp` E atualiza localStorage.
- O check é `!!user?.telegram_id && !(user as any)?.whatsapp` em [dashboard/page.tsx:325](frontend/src/app/dashboard/page.tsx).
- Quando user volta, `useAuth` recarrega user do servidor — se o servidor não tá retornando `whatsapp`, o gate volta.

**Causa provável**:
- O `PATCH` está salvando no banco, mas o **endpoint que retorna o user** (`/auth/me` ou similar) **não está incluindo o campo `whatsapp` no SELECT**.
- OU a coluna `whatsapp` existe mas o serializer/DTO está omitindo.

**Fix**:
- Auditar endpoint `/auth/me` (ou equivalente que `useAuth` chama) → garantir que retorna `whatsapp`.
- Ajustar a UserDto/serializer pra incluir o campo.

**Prioridade**: 🔴 crítica (UX quebrado, usuário fica preso no popup).

---

## 🟠 Alto (UX importante / produtividade Igor)

### N6 — Painel de funcionário precisa ter o mesmo controle de produtividade que o admin
**Origem**: vídeo `5.43.30 PM`

**Reportado**: Funcionário (ex: Mattheus) precisa ter dashboard próprio mostrando:
- Quantos conteúdos postou no dia (filmes vs séries vs total).
- Lista nominal dos conteúdos por dia.
- Gráfico ou breakdown diário/mensal.
- Reflete em tempo real (excluídos descontam).

Igor também quer **reformular o painel admin Master**: a aba "Funcionários" tem essas métricas, mas ele quer total geral (próprios + dos funcionários) no painel principal admin, com botão "ver detalhado por dia".

**Fix**:
- Criar página `/employee/productivity` (rota pra funcionário ver suas próprias stats).
  - Reusa `getProductivity()` de `employees.service.ts` (já filtra ARCHIVED após fix d086264).
- No painel admin, adicionar coluna "Total de conteúdos adicionados por você" com link "ver detalhado".
- Render gráfico simples (barra por dia, série dupla movies vs series).

**Prioridade**: 🟠 alta.

---

### N7 — Excluir conteúdo por funcionário tem que virar pending de aprovação
**Origem**: vídeo `5.48.36 PM`

**Reportado**: Igor diz: "se o funcionário clicar pra excluir, eu não quero que exclua direto. Quero que vá pro meu painel de admin como edição pendente, informando 'funcionário tal deseja excluir tal conteúdo'". Não testou ainda mas pediu pra deixar implementado.

**Status atual**:
- `getEditCapability` (após N12 da rodada 04/05) retorna `needs_approval` em todos os caminhos não-diretos.
- `deleteContent` virou soft-delete em commit `d086264` (07/05).

**O que FALTA**:
- Confirmar que o **delete via funcionário** passa por `getEditCapability` antes — se retornar `needs_approval`, deve criar uma row em `content_edit_requests` com tipo `delete` (não executar o soft-delete direto).
- Validar que `/admin/edit-requests` lista esses pedidos e Igor consegue aprovar/rejeitar.

**Fix**:
- Auditar `admin-content.controller.ts` rota DELETE → passa por `resolveEditCapability`?
- Se direct → soft-delete. Se needs_approval → cria edit-request tipo `delete`.
- Validar UI em `/admin/edit-requests` mostra tipo `delete` distinto.

**Prioridade**: 🟠 alta.

---

### N8 — Splash da Netflix sem áudio + animação corta no navegador do Telegram
**Origem**: vídeo `5.56.56 PM`

**Reportado**: Igor já tinha mencionado isso (N10 da rodada 04/05), parcialmente entregue (commit `083a4ff` faz skip da splash em UA Telegram). Mas:
- No **PC + Chrome desktop**, o áudio do "tudum" Netflix continua **sem tocar** (esperado em alguns casos por autoplay block).
- A animação **ainda corta** no navegador do Telegram (mesmo após o skip).
- Reporte de cliente: mesmo problema no celular dele.

**Status atual**: o skip foi adicionado, mas Igor relata que a animação ainda corta no Telegram in-app.

**Fix**:
- Confirmar que `cv_intro_played` está sendo setado ANTES da splash mostrar (na detecção de UA Telegram).
- Verificar se o autoplay do `<audio>` está sendo bloqueado por política do navegador no PC desktop também (ainda que a splash funcione, o áudio não toca).
- Igor sugere: "site já carrega no fundo, animação completa, depois mostra". Confirmar que a animação roda 100% sem cortes.

**Prioridade**: 🟠 alta (UX no Telegram que é o principal canal).

---

### N9 — Painel admin: indicar funcionários online em tempo real
**Origem**: vídeo `6.55.03 PM` 06/05 + vídeo `6.20.00 PM` 07/05

**Reportado**: Igor quer ver no painel master quais funcionários estão **online no momento** (logados E ativos dentro da janela de 10min de heartbeat). Quando funcionário desloga ou expira o heartbeat, muda pra offline.

Atualmente existe a aba "Análise em Tempo Real" mostrando "Usuários Online" — mas é só TOTAL, não diferencia entre cliente e funcionário, nem mostra nomes.

**Fix**:
- Adicionar seção/card específico "Funcionários Online Agora" no `/admin`:
  - Lista nominal (nome + role + telegram_id).
  - Filtra `users.role IN ('employee', 'admin')` + `last_active_at` dentro dos últimos 10min.
- Reusa `last_active_at` que já existe (vi nos test queries — Mattheus tem `last_login_at: 2026-05-07T03:04:31`).
- Pode ficar na aba "Funcionários" ou no painel principal — Igor sugere reformulação geral.

**Prioridade**: 🟠 alta.

---

### N14 — Consolidar aprovação de foto no painel de edit-requests (refactor)
**Origem**: feedback Igor pós-implementação 07/05.

**Reportado**: "Aquele endpoint de foto pra aprovação só funciona quando o usuário edita um conteúdo após aquela janela de tempo, daí você precisa aceitar ali? Se for isso, remove esse endpoint e adiciona essa função naquele endpoint que já fizemos dedicado a edições para aprovação após janela de tempo."

**Diagnóstico**: tinha 2 sistemas paralelos:
1. `/admin/photos-pending` (queue própria em `people.photo_pending_url`).
2. `/admin/edit-requests` (queue genérica em `content_edit_requests` pra update/delete de conteúdo).

Igor quer **um sistema só** — substituição de foto fora da janela vira request no mesmo painel.

**Fix entregue**:
- Migration: `content_edit_requests` ganhou coluna `person_id UUID REFERENCES people(id)`. `content_id` virou nullable. Constraint `chk_target_required` garante que ao menos um dos dois está set.
- `EditRequestType` aceita `'photo_replace'` além de `update | delete`.
- `submitPhotoReplaceRequest({ employeeId, personId, photoUrl })` cria request com `request_type='photo_replace'`, `changes={photo_url}`, `original_snapshot={photo_url, name, role}`.
- `approve()` detecta `photo_replace` e aplica direto na tabela `people` (com ownership + cleanup de campos legados).
- `submitPhoto` em `admin-people.service` agora chama `editRequestsService.submitPhotoReplaceRequest` em vez de escrever em `photo_pending_url` — remove o conceito da fila dedicada.
- `/admin/edit-requests` page renderiza requests `photo_replace` com badge "FOTO" + comparação visual lado-a-lado da foto antes vs depois.
- `/admin/photos-pending` virou redirect pra `/admin/edit-requests` (preserva bookmarks).
- Card "Fotos pendentes" removido do dashboard admin (consolidado em "Edições pendentes").
- Notificação Telegram pro admin tem texto específico ("📷 Nova troca de foto aguardando aprovação") com nome da pessoa.

**Prioridade**: 🟠 alta (consolidação de UX, evita Igor olhar em 2 lugares).

---

### N10 — Aprovar fotos de funcionário em batch (checkbox + "Aprovar selecionados")
**Origem**: vídeo `6.30.57 PM`

**Reportado**: Hoje Igor aprova foto por foto, e cada uma carrega o grupo do Telegram (acesso ao link demora). Quer:
1. Checkbox em cada card de "fotos pendentes".
2. Marcar todas que ele já validou via segundo monitor.
3. Botão "Aprovar todas as selecionadas" no topo.
4. Acelera supervisão (Igor diz: "se eu tiver muitos filmes pra aprovar, vai demorar demais").

**Fix**:
- Adicionar `selected: Set<string>` no state de [admin/photos-pending/page.tsx](frontend/src/app/admin/photos-pending/page.tsx).
- Cada card ganha `<input type="checkbox" />`.
- Header com "X selecionadas" + botão "Aprovar X selecionadas".
- Endpoint backend: `POST /admin/people/photos/approve-batch` recebe `{ ids: string[] }`.
- Reusa `approvePendingPhoto(id, adminUserId)` em loop, retorna `{ approved: N, failed: [...] }`.

**Prioridade**: 🟠 alta (Igor faz aprovação várias vezes ao dia, ganha muito tempo).

---

## 🟡 Médio (qualidade de vida)

### N11 — Fotos de funcionário aprovadas direto na criação (ja entregue, validar)
**Origem**: vídeo `1.34.04 AM`

**Reportado**: Igor explica o critério: foto de funcionário não precisa aprovação na **criação inicial** (pessoa nunca teve foto). Só vai pra fila de aprovação se ele tentar **editar/substituir** uma foto existente, igual ao workflow de edit-request de conteúdo.

**Status**: ✅ **Entregue no commit `1ee4558` da rodada 07/05**. Bug 2 da última rodada.

**Validação E2E**:
- Login como Mattheus.
- Em `/employee/photos`, escolhe pessoa SEM foto.
- Toast "Foto aprovada" + pessoa some da lista de "missing".
- `/admin/photos-pending` mostra 0 pendentes (não foi pra fila).
- Confirmar `select photo_added_by_user_id from people where id = ?` retorna user_id do Mattheus (não null).

**Prioridade**: 🟡 média (aguardando confirmação do Igor depois do redeploy).

---

### N12 — Título secundário em inglês: busca aceitar título em inglês
**Origem**: áudio `5.13.58 PM`

**Reportado**: Igor adicionou "Anora" e quer que pesquisar pelo título em inglês também ache o filme (mesmo que cadastrado em português). Pediu na rodada anterior — quer confirmar implementação.

**Status atual**:
- Search já é acento-insensível (commit `3d0fcab` da rodada anterior).
- Não tem suporte a "título secundário" — campo único `title`.

**Fix**:
- Adicionar coluna `title_en` em `content` (ou `aliases TEXT[]` mais flexível).
- Form admin ganha campo opcional "Título em inglês / nomes alternativos".
- `searchMoviesAccentInsensitive` filtra também por título secundário.

**Prioridade**: 🟡 média (afeta busca, mas não bloqueia compra).

---

### N13 — Gerenciar usuários: mostrar WhatsApp salvo do cliente
**Origem**: vídeo `6.12.28 PM`

**Reportado**: Cliente cadastra WhatsApp no popup do dashboard. Igor quer ver esse número quando pesquisa o cliente em `/admin/users`.

**Fix**:
- Adicionar coluna "WhatsApp" na tabela de users do `/admin/users`.
- Backend já retorna o campo (validei no `auth/login` — Igor tem `whatsapp: "21998280890"`).
- Só falta mostrar no frontend.

**Prioridade**: 🟡 média.

---

## Resumo executivo (pra Igor)

| Item | Status | O que fazer |
|---|---|---|
| **N1** IA não chama Igor | 🔴 investigar Render env | Confirmar `TELEGRAM_ADMIN_CHAT_ID` |
| **N2** IA no DM Igor | 🔴 ativar via painel | Toggle Business connection |
| **N3** Sirāt indisponível | 🔴 debugar Bot API | Log detalhado no `createChatInviteLink` |
| **N4** Compra anônima Chat ID | 🔴 mesmo fix N3 | — |
| **N5** Popup WhatsApp reabre | 🔴 fix endpoint user | Garantir `/auth/me` retorna `whatsapp` |
| **N6** Produtividade funcionário | 🟠 nova página | `/employee/productivity` |
| **N7** Delete vira pending | 🟠 wire edit-request | DELETE → edit-request tipo `delete` |
| **N8** Splash Telegram | 🟠 audit fix existente | Confirmar `083a4ff` ainda funciona |
| **N9** Online em tempo real | 🟠 nova seção | Card "Funcionários Online" |
| **N10** Aprovar fotos batch | 🟠 checkbox + endpoint | `POST /photos/approve-batch` |
| **N11** Foto inicial direta | ✅ entregue | Validar pós-deploy |
| **N12** Título inglês | 🟡 schema + search | Coluna `title_en` |
| **N13** WhatsApp em /admin/users | 🟡 só frontend | Adicionar coluna |

**Ordem sugerida (cirurgia sábado é prioridade absoluta):**
1. N1 + N2 hoje à tarde (IA funcional pra cobrir Igor sábado).
2. N3 + N4 hoje (cliente pagando e não recebendo é receita parando).
3. N5 amanhã (UX bug, mas não bloqueia compra).
4. N7 + N10 amanhã/sexta.
5. Resto na próxima rodada.
