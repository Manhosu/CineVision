# Ajustes Igor — Relatório Consolidado (2026-05-03)

Compilação de **8 prints + 4 áudios + 20 vídeos + 3 mensagens textuais** enviados pelo Igor, somados aos achados nos logs de produção e no código. Todas as transcrições de áudio/vídeo abaixo foram geradas com **OpenAI Whisper** (modelo `small` para áudio, `base` para vídeo, idioma PT-BR) — leia interpretando o sentido, não a letra (whisper erra palavras esporadicamente).

> **Use este documento para alinhar prioridade e atacar.** Ele agrupa por severidade (CRÍTICO → ALTO → MÉDIO → BAIXO) e em cada item indica os arquivos do código que provavelmente vão ser tocados.

## Mensagens textuais que vieram junto com as mídias

O Igor mandou 3 mensagens em texto puro no chat, paralelas às mídias. Mapeamento:

| # | Mensagem (texto exato) | Mídia relacionada | Item no plano |
|---|---|---|---|
| **T1** | `🛍 Para realizar novas compras no aplicativo, digite /start` | Áudio 3 (`5163657124907058837.ogg`) — Igor descreve este texto como o template a enviar quando a conversa esfriar (5/10/30/60 min sem resposta) | **M2** |
| **T2** | "Essa mensagem de adicionar 5 filmes, tem que ver uma forma ou uma palavra pra boa por conta que é filmes/séries ou substituir para Conteúdos vê um jeito melhor pra se coloca" | Sem mídia direta — refina o pedido sobre o card de incentivo de desconto | **B6** |
| **T3** | "Eduardo outra coisa que reparei tem que adicionar aqui pra marcar nos funcionários a questão de (OPÇÃO AUTORES, ADICIONAR FOTOS AOS SEM FOTOS)" | Sem mídia direta — pedido de nova permissão de funcionário | **M8** |

Cada uma dessas mensagens está aplicada no item correspondente abaixo (M2, B6, M8) com a especificação detalhada.

> **Nota (atualização):** depois desse documento ter sido escrito, o Igor enviou mais 1 vídeo (`IMG_8846.MOV`) com 2 pedidos novos: (1) **dashboard de produtividade** por funcionário com gráfico/lista detalhada (ele paga por produção); (2) **refinamento da permissão `can_add_people_photos`** com janela de 1h + workflow de pendência igual ao de filmes. Detalhes ao final, na seção de transcrições brutas.

---

## 🔴 CRÍTICO — bloqueando receita agora

### C1. PIX Oasyfy fora do ar (credencial inválida)

**Sintoma observado nos logs do backend (02/05/2026 18:30):**

```
[OasyfyService] Error creating Oasyfy PIX: 401
[OasyfyService] errorCode: GATEWAY_INVALID_CREDENTIALS
```

**Cascata:**
- Bot manda `❌ Erro ao gerar QR Code PIX` ao cliente (prints 1 e 8 — Mad Max 2).
- Compras nem chegam a ser geradas → painel órfãs vazio.
- Clientes pagam por outro canal (compra externa, anterior) e ficam "pendentes".

**Ação:** rotacionar credencial no painel Oasyfy e atualizar env vars de produção (`OASYFY_API_KEY` / `OASYFY_TOKEN`).

**Arquivos:** [backend/src/modules/payments/services/oasyfy.service.ts](backend/src/modules/payments/services/oasyfy.service.ts), env de produção (Render/Vercel).

### C2. Comando `/start` retornando "Erro ao processar usuário"

Print 7 — bot responde em loop:

> ❌ Erro ao processar usuário. Tente novamente com /start

Cliente que digita "Quero impuros" também falha. Loops infinitos no `/start` quebram o ponto de entrada principal do bot.

**Arquivos:** [backend/src/modules/telegrams/telegrams-enhanced.service.ts](backend/src/modules/telegrams/telegrams-enhanced.service.ts) — `handleStartCommand`.

### C3. Bot do Telegram com instâncias duplicadas (Conflict 409)

```
ERROR Conflict detected (409): Another instance may be polling
```

**Sintoma reportado pelo Igor (vídeo IMG_8775 + IMG_8775(1)):** mensagens duplicadas, QR Code aparecendo 2x, mensagens de erro vazando para múltiplos clientes ao mesmo tempo. Ele tenta chamar 5–6 pessoas no privado e elas não estão sendo atendidas direito.

**Causa-raiz:** mais de uma instância do bot fazendo polling. Pode ser deploy duplicado em produção, ou backend local que subi para teste. Já matei o local — verificar produção não ter 2 instâncias rodando.

**Bônus pedido:** apagar mensagens de erro do chat para não ficar poluindo a conversa.

### C4. Compras pagas que não chegam ao cliente nem aparecem em órfãs

**Múltiplos clientes reclamando** (prints 2, 3, 4):
- Jogleisiane: "fiz um pagamento e ainda continua pendente"
- Julia Felix: "Paguei, mas não recebi"
- +55 95 99139-5035: "Olá não consegui acesso ao filme"

**Vídeo IMG_8794 — Igor confirma:**
> Já umas 4–5 pessoas me reportaram que faz a compra, link automático, e não recebe. Não sei se ela não coloca o WhatsApp lá... não aparece também nas compras órfãs.

**Vídeo (7) (mais grave):**
> 1/5 às 22:23, 10 min atrás. Pessoa comprou e não colocou WhatsApp. Não consigo localizar. Várias compras: 21,82 / 20,20 / 14 — sem WhatsApp. Eu testei, coloquei meu WhatsApp, deu certo, apareceu lá. Mas dessas pessoas não aparece. **Como recuperar?** E botão pra excluir compras perdidas do painel pra não poluir.

**Causa-raiz dupla:**
1. Painel órfãs filtra só `status='paid' AND telegram_chat_id IS NULL` — compras pagas com falha de entrega (telegram_chat_id preenchido mas `delivery_sent=false`) ficam invisíveis.
2. WhatsApp obrigatório só foi pro deploy hoje — compras anteriores ficaram opcionais e o cliente pulou. Sem WhatsApp e sem chat_id → impossível recuperar manualmente.

**Ação imediata:**
- Adicionar segunda visão no painel: **"Pagas não entregues"** (filtro: `paid AND delivery_sent=false`).
- Botão **"Marcar como perdido"** ou **"Excluir do painel"** para limpar fantasmas.
- Para recuperar compras antigas sem WhatsApp: extrair lista do banco com order_token + provider transaction_id, cruzar com a Oasyfy se possível, e tentar contatar manualmente por outro canal.

---

## 🟠 ALTO — qualidade de produto e operação

### A1. IA do bot inventando / mandando links 404

**Vídeo IMG_8814 — exemplo concreto:**
> "Velozes e Furiosos" — IA responde com valor mas link dá erro. "Top Gun" — clica, dá 404. Está criando links que não existem.

**Vídeo (5):**
> Cliente perguntou "Tendrama" (apelido em inglês de "O Drama"). Filme existe no catálogo, tem título em inglês cadastrado. Mas IA não detectou.

**Causa-raiz:**
- Catálogo da IA usa busca tokenizada simples ([backend/src/modules/ai-chat/services/catalog-context.service.ts](backend/src/modules/ai-chat/services/catalog-context.service.ts)), sem RAG/embeddings.
- `createQuickBuyLink` não valida ID antes de gerar deep link → produz URL `404`.
- LLM "alucina" títulos quando o contexto não traz match exato.

**Ações:**
1. **Validar ID antes de mandar** — se conteúdo não existe ou foi removido, IA fala "vou anotar e te aviso quando entrar" (não invente link).
2. **Endurecer prompt do sistema:** "NUNCA invente título. Só responda com filmes que estão no contexto fornecido."
3. **Indexar títulos secundários** (inglês/aliases) na busca do catálogo.
4. **Busca insensível a acentos** ("diario" → "Diário"; "panico" → "Pânico"). Vídeo IMG_8806 confirma esse pedido.

### A2. IA leva 3 mensagens pra responder

**Vídeo IMG_8814:**
> Pediu "qual Top Gun você quer?", cliente respondeu "1986", IA não respondeu. Só depois de 3 chamadas que ela respondeu. Tem espaçamento de 2 mensagens? Verifica.

**Hipótese:** algum debounce/buffering que requer N tokens antes de processar. **Verificar [ai-chat.service.ts](backend/src/modules/ai-chat/ai-chat.service.ts)**.

### A3. IA vazando códigos internos para o cliente

**Vídeo IMG_8771:**
> Pessoa perguntou "Diabo Veste Prada dublada", IA respondeu "qual é, 2016 ou novo de 2026?" e enviou pra ele "**possivelmente algum código interno**" — cliente perguntou "o que é isso?". IA continuou respondendo mas o código vazou.

**Causa-raiz provável:** markers como `<<DETAIL:id>>`, `<<BUY:id>>`, etc., que deveriam ser substituídos por links no `buildDetailLinks` mas escaparam por algum motivo (id não encontrado, regex falhou, render quebrado).

**Arquivo:** [backend/src/modules/ai-chat/services/catalog-context.service.ts:373](backend/src/modules/ai-chat/services/catalog-context.service.ts#L373).

### A4. IA não responde clientes que tiveram conversa assumida manualmente

**Vídeo (6):**
> Não sei se é porque cliquei "assumir manualmente" e reativei a IA. Conversa não responde minhas perguntas. Clientes novos respondem ok, mas alguns que chegaram a "Já paguei" ela trava.

**Hipótese:** flag `ia_paused` ou `manual_takeover` numa tabela de sessão pode ficar "suja" depois de retomar. **Verificar lógica em [telegrams-enhanced.service.ts](backend/src/modules/telegrams/telegrams-enhanced.service.ts)** + tabelas de sessão de IA.

### A5. Compra anônima (web sem Telegram) não aplica desconto promocional

**Vídeo IMG_8832:**
> Filme em promoção: 7,02. Clico em comprar, o PIX vem com 7,80 (cheio). Escaneio o QR e o valor que chega é 7,80. **Não aparece o valor com desconto**.

**Ação:** garantir que o fluxo `cart/checkout` para anônimo (que implementei na rodada anterior) leia `discounted_price_cents` da tabela `content` e use ele em `total_cents` da order.

**Arquivos:** [frontend/src/app/cart/checkout/page.tsx](frontend/src/app/cart/checkout/page.tsx), [backend/src/modules/orders/orders.service.ts](backend/src/modules/orders/orders.service.ts) — `createOrderFromCart`.

### A6. Splash Screen ainda cortando + áudio não toca + URL Vercel desatualizada

**Vídeos IMG_8766 + IMG_8767:**
> Splash continua cortando do mesmo jeito. **O link que aparece em cima é o do Vercel**, não o `cinevisionapp.com.br`. **A versão Vercel é a que o bot está puxando**. O áudio das fleites (Netflix-style jingle) não está tocando.

**Causa-raiz:**
- O patch de splash (que validei no DevTools com sucesso) foi para o ambiente correto, **mas o bot do Telegram está apontando para uma URL diferente** (provavelmente `cine-vision-murex.vercel.app` em vez de `cinevisionapp.com.br`).
- Áudio tocando só em desktop por design (Igor pediu antes pra mutar mobile) — verificar se mobile foi reativado.

**Ação:**
1. **Verificar `NEXT_PUBLIC_FRONTEND_URL` ou similar nos env vars** do bot, e apontar pra `cinevisionapp.com.br`.
2. Confirmar que o deploy do `cinevisionapp.com.br` tem o patch da splash (window.load + preço centralizado).
3. **Reativar áudio em mobile?** Ele pediu antes pra mutar; agora cobra "fleites" (jingle). Conflitante. **Confirmar com o Igor**.

### A7. Funcionários — Rafaela aparece na lista mas não consegue logar

**Print 5 (Funcionários):** lista mostra "Rafaela · rafaelaa@cinevision.com" expandida com permissões marcadas. Email tem 3 letras "a" (`rafaelaa`) — pode ser typo no momento da criação OU formulário aceitando email sem validação.

**Reportado pelo Igor:** "Rafaela não aparece na lista (apesar do pop-up de sucesso) e não consegue logar (Acesso Negado)".

**Hipóteses:**
1. **Listagem:** `getEmployees` retorna stale data se cache não invalida após `POST /admin/employees`. Vê o pop-up de sucesso mas a lista não atualiza.
2. **Login:** o role `employee` pode não estar sendo aceito no `auth/login` (que talvez exija `admin`/`user`). Verificar [backend/src/modules/auth/auth.controller.ts](backend/src/modules/auth/auth.controller.ts) e `JwtAuthGuard` + `RolesGuard` no employee endpoint.
3. **Senha:** pode não estar sendo hashada (bcrypt) na criação, e o login compara hash → falha sempre.

**Arquivos:** [backend/src/modules/employees/employees.controller.ts](backend/src/modules/employees/employees.controller.ts), [backend/src/modules/employees/employees.service.ts](backend/src/modules/employees/employees.service.ts), `auth/login`.

### A8. Edições e exclusões de funcionário precisam virar "Solicitações" pendentes

**Vídeos IMG_8809 + IMG_8812 + IMG_8813:**

Cenário atual:
- Funcionário tenta editar conteúdo que ele mesmo criou — recebe "Você não tem permissão para editar este conteúdo".
- Funcionário tenta excluir — confirma exclusão e remove direto.

**Pedidos do Igor:**
1. **Tirar a janela de 1h** (atual): toda edição do funcionário, mesmo do próprio conteúdo, vira solicitação pendente.
2. Aparece pop-up: "Está enviando solicitação para o administrador".
3. Painel admin: "**Edições Pendentes**" lista as solicitações com:
   - Qual conteúdo (título)
   - O que foi editado (campo + valor antes/depois)
   - Botões: aprovar / cancelar
4. Se funcionário editar 3 campos (título, trailer, capa), aparecem 3 solicitações ou 1 com 3 mudanças listadas.
5. **Mesmo fluxo para exclusão** — funcionário pede pra excluir, conteúdo fica em rascunho (não some) até admin aceitar.
6. Indicador visual (**badge/contador**) no menu/dashboard com a quantidade de pendentes.

**Arquivos:** [backend/src/modules/content-edit-requests/](backend/src/modules/content-edit-requests/) (tabela já existe pela migration `20260426000002_content_edit_requests.sql`), painel admin frontend.

### A9. Conteúdo recém-criado fica em rascunho, não vai pro site

**Vídeo IMG_8811:**
> Funcionário cria conteúdo. Vai em "gerenciar conteúdo" pra publicar — recebe erro "você só pode editar dentro da janela permitida". Pela conta master eu consigo subir, mas **TODAS as contas (não só funcionário)** quando criam conteúdo pelo painel, ele não vai direto pro site, fica em rascunho.

**Pedido:** ao criar conteúdo, **publicar direto** sem precisar do passo "subir para o site".

**Arquivos:** [backend/src/modules/content/](backend/src/modules/content/) — verificar default de `status` ao criar (provavelmente `DRAFT`, mudar para `PUBLISHED`).

### A10. Dashboard de funcionário não atualiza estatísticas

Já confirmado: tabela `employee_daily_stats` só recebe `INSERT` quando funcionário **adiciona conteúdo** no dia. Sem trigger. Sem polling no front.

**Ação:** trigger SQL no banco que cria row de stats no INSERT de `content` por funcionário, OU calcular stats on-the-fly via SQL agregado por usuário (sem tabela cache).

### A11. WhatsApp obrigatório no dashboard ainda não aparece pro Igor

**Áudio 1:**
> Eu fui entrar agora em "minhas compras" para ver aquela tela que pede o WhatsApp da pessoa pra ter forma secundária. **Não apareceu pra mim**.

**Causas possíveis (em ordem):**
1. Deploy pode não ter ido pro ambiente que ele usa (Vercel desatualizado — ver A6).
2. Igor já tem `whatsapp` preenchido no banco (gate só dispara se `!user.whatsapp`).
3. Login antigo retorna user sem `whatsapp_joined`/`whatsapp` (cache/JWT antigo).

**Ação:** Igor precisa **fazer logout + login novamente** pra puxar o JSON novo do user com o campo `whatsapp`. Se ainda não aparecer e ele não tiver whatsapp gravado no banco, é deploy desatualizado.

---

## 🟡 MÉDIO — UX e melhorias estruturais

### M1. Comprovantes (imagens) enviados no atendimento não aparecem no painel

**Vídeo IMG_8772:**
> Cliente envia imagem do comprovante PIX. **Não consigo ver no painel admin**. Tenho que pedir pra ele me chamar no privado pra ver. Seria ideal: na hora que cliente envia imagem, aparecer aqui no chat do painel. **Bônus:** se IA detectar comprovante, pausar a conversa pra Igor verificar; idealmente verificar pagamento automaticamente no banco do provider.

**Ações em ordem de complexidade:**
1. **Já:** painel exibir mídias (fotos/vídeos) que o cliente envia pelo Telegram, não só texto.
2. **Médio prazo:** detectar imagem com OCR/visão para identificar "comprovante" e pausar IA → cair pra Igor.
3. **Longo prazo:** consultar API do provider PIX (Oasyfy) com o transaction_id que aparece no comprovante e auto-confirmar.

### M2. Mensagem automática de re-engajamento ("conversa esfriou")

**Áudio 3:**
> Quando a conversa esfria (5 / 10 / 30 min / 1h sem resposta), enviar mensagem padrão: "Para realizar novas compras digite /start". Funciona mesmo se eu assumi manualmente — depois de 30min/1h, manda essa mensagem.

**Texto exato a usar (mensagem que o Igor colou no chat junto com o áudio):**

```
🛍 Para realizar novas compras no aplicativo, digite /start
```

**Ação:** cron job/scheduled task que percorre conversas com última mensagem > N min e envia o template acima. Configurável por tier de tempo. Disparar **mesmo quando a IA estiver pausada** (manual takeover) — Igor confirmou que esse é o comportamento desejado.

**Arquivos:** novo service em [backend/src/modules/ai-chat/](backend/src/modules/ai-chat/) ou [backend/src/modules/telegrams/](backend/src/modules/telegrams/).

### M3. Layout do preço no detalhe (versão Vercel) ainda no meio

**Vídeo IMG_8767:**
> Preço aparece no meio. Quero **bem em cima do botão de compra, centralizado**.

Já implementado e validado por mim na rodada anterior, mas o Igor está vendo a versão Vercel desatualizada. **Mesmo issue do A6 — deploy.**

### M4. Limite de marketing em 100 mil usuários

**Vídeo (8):**
> Marketing limitado a 100k. Já passei. Tenho 1M+ usuários disponíveis. Liberar pra todos.

**Arquivos:** [backend/src/modules/marketing/](backend/src/modules/marketing/) — procurar constante `MAX_USERS` ou `BATCH_LIMIT`.

### M5. Botão "Voltar para Menu Principal" em abas admin

Pedido recorrente: nas abas **Funcionários**, **Liberar Conteúdo Manualmente** e **Recuperação de Vendas**, adicionar botão de voltar — hoje precisa editar URL manualmente.

**Arquivos:** [frontend/src/app/admin/employees/](frontend/src/app/admin/), [frontend/src/app/admin/manual-release/](frontend/src/app/admin/), [frontend/src/app/admin/pix-recovery/](frontend/src/app/admin/) — adicionar `<AdminBackButton />` (componente já existe em outras telas).

### M6. Histórico Pix Recovery — UX

Pedido:
- Mostrar nome/ID do usuário (hoje só mostra ID curto).
- Filtro de busca por usuário.
- Paginação (lista vai inflar com tempo).
- Coluna "bloqueado até" com data/hora.

### M7. Reset diário de upload à meia-noite

Atualmente o limite diário do funcionário (`daily_content_limit`) é por dia, mas reset não é automático. Confirmar lógica de "rolagem do dia" — se usar `created_at >= start_of_day`, é automático; se for contador persistente, precisa cron que zera às 0h.

### M8. Permissão "Autores / Adicionar fotos aos sem foto"

**Mensagem do Igor (texto direto no chat):**

> Eduardo outra coisa que reparei, tem que adicionar aqui pra marcar nos funcionários a questão de **(OPÇÃO AUTORES, ADICIONAR FOTOS AOS SEM FOTOS)**.

**O que ele quer:** uma permissão dedicada de funcionário que libera só a aba "Pessoas" (atores/diretores/autores) com filtro "**sem foto**" — funcionário pode procurar e cadastrar foto pra essas pessoas, **sem mexer em mais nada** do site.

**Caso de uso:** Igor quer poder delegar "tarefa de mutirão" pra um funcionário trabalhar nos perfis de atores/diretores que estão sem foto, sem dar acesso completo ao painel.

**Implementação:**

**Backend:**
- Adicionar `can_add_people_photos: boolean` no enum/schema de permissions em [backend/src/modules/employees/employees.service.ts](backend/src/modules/employees/employees.service.ts) (linhas 13–25, junto com `can_add_movies`, `can_add_series` etc.).
- Migration: `ALTER TABLE employee_permissions ADD COLUMN IF NOT EXISTS can_add_people_photos BOOLEAN DEFAULT false;` (ou no jsonb de permissions, se for o caso).
- Endpoint novo (ou reusar existente): `GET /admin/people?photo=missing` retorna pessoas com `photo_url IS NULL`.
- Endpoint para upload de foto: `POST /admin/people/:id/photo` — restrito a admin OU `can_add_people_photos=true`.

**Frontend:**
- **Tela Funcionários** (criação/edição): adicionar checkbox "**Autores — Adicionar fotos aos sem foto**" junto com os outros (`can_add_movies`, `can_add_series`, etc.).
- **Painel funcionário**: se a permissão estiver ativa, mostrar nova aba "Autores sem foto" com listagem das pessoas filtradas + upload simples de foto por linha.
- Bloquear todas as outras abas se essa for a única permissão ativa.

**Validação:** quando o admin marcar essa permissão, o funcionário só vê a aba "Autores sem foto"; não deve ter acesso a filmes/séries/usuários/etc.

### M9. Visualização "Usuários ativos" toggleable por funcionário

**Vídeo IMG_8810:**
> Total de conteúdos OK pra funcionário ver. Mas "usuários ativos" — alguns funcionários quero permitir ver, outros não. Coloca uma caixinha (checkbox) pra marcar.

**Ação:** adicionar `can_view_active_users` no enum de permissions, refletir no formulário e no filtro do dashboard.

### M10. Compra anônima — checkout com QR demora 1.5–8s

**Vídeo IMG_8768:**
> Comprei pelo Safari fora do Telegram, processou, gerou PIX — mas demora 1.5 a 8s. Otimizar.

**Ação:** medir o tempo do `POST /api/v1/cart/checkout` (provavelmente o gargalo é a chamada síncrona à Oasyfy). Considerar:
- **UI:** mostrar QR de carregamento mais elegante enquanto Pix está sendo gerado.
- **Backend:** se Oasyfy responde em ~1s, o resto é overhead nosso (auth, query). Investigar.

---

## 🟢 BAIXO — pedidos de polish e features

### B1. Confirmação se ainda preciso testar (Áudio 4)

> Eu revisei só as coisas dos vídeos. Não testei ainda. Me avisa que tá pronto pra eu testar.

**Ação:** depois de aplicarmos os fixes acima, mandar mensagem confirmando que está liberado.

### B2. Implementar IA no DM pessoal do Igor

**Vídeo IMG_8771:**
> A IA tá funcionando legal, gostei bastante. Daqui a pouco a gente já pode também implementar na minha DM aqui do privado, do pessoal.

**Ação:** estender `Telegram Business AI` (já existe pelo nome do projeto e migrations 20260430000001 a 20260430000004) ao DM pessoal do Igor.

### B3. Botão pra excluir compras "perdidas" do painel órfãs

**Vídeo (7):** "Tem algum botão aqui pra a gente excluir? No caso essas que já foram perdidas, só pra não ficar poluindo aqui tanto".

### B4. Agrupamento de pedidos no painel "Gerenciar Compras"

Pedido conhecido: quando cliente comprou pacote (vários itens juntos), agrupar em 1 card com "Ver mais" — expande mostrando filmes, desconto e total.

### B5. Página de busca

- Aumentar limite de resultados (sagas como Velozes e Furiosos têm muitos filmes — alguns não aparecem).
- Botão "Adicionar ao Carrinho" minimalista direto nos resultados.

### B6. Mensagem "Adicione X filmes" — trocar para "Conteúdos"

**Mensagem que o Igor mandou no chat:**

> Essa mensagem de adicionar 5 filmes, tem que ver uma forma ou uma palavra pra boa por conta que é filmes/séries ou substituir para "Conteúdos", vê um jeito melhor pra se colocar.

**Problema:** o card e o hint usam "filmes" hardcoded, mas o catálogo tem **filmes E séries**. Quando o cliente está num card de série e vê "Adicione 5 **filmes** ao carrinho e ganhe 25% de desconto", a mensagem soa errada / exclui o produto que ele está olhando.

**Sugestões de copy:**
- ✅ "Adicione 5 **conteúdos** ao carrinho e ganhe 25% de desconto" (genérico, funciona pra tudo)
- Alternativa: "Adicione 5 **itens** ao carrinho..." (mais comercial)
- Alternativa: "Adicione mais 5 e ganhe 25% de desconto" (omitir o substantivo)

**Onde aparece (locais conhecidos):**
- [frontend/src/components/Cart/DiscountHint.tsx](frontend/src/components/Cart/DiscountHint.tsx) — hint inline na página de detalhe e nos cards.
- [frontend/src/app/cart/page.tsx](frontend/src/app/cart/page.tsx) — texto "Adicione mais N filmes/itens..." (linhas ~191–209).
- [frontend/src/components/Cart/CartDiscountBar.tsx](frontend/src/components/Cart/CartDiscountBar.tsx) — barra de progresso do carrinho.
- [frontend/src/components/Cart/CheckoutIncentiveModal.tsx](frontend/src/components/Cart/CheckoutIncentiveModal.tsx) — pop-up de incentivo no checkout.

**Ação:** grep por `'filmes'` e `"filmes"` em `frontend/src/components/Cart/` e trocar para `'conteúdos'` (ou variável dinâmica baseada no tipo do conteúdo no carrinho — se 100% séries, fala "séries"; se mix, fala "conteúdos"). A versão simples (`conteúdos` fixo) já resolve.

### B7. Humanização da IA — tom de voz + delay digitação 5–8s

- Delay com status "Digitando…" antes de responder.
- Mensagens curtas, sem lista enorme nem emojis demais.
- Tolerância a erros de digitação ("como baixa o telegram" → entender "baixar Telegram").

### B8. Stories — IA detectar contexto

Quando cliente responde a Story do Igor, identificar qual pôster foi postado e usar isso de contexto. **Investigação técnica primeiro** (Telegram Business API expõe isso?).

---

## 📊 Transcrições brutas

> Para auditoria. Cada bloco abaixo é o texto cru do whisper, sem edição. **Whisper pode confundir palavras esporadicamente** (ex: "Eduardo" → "Eduard" / "do ardo" / "dou ardo"); leia interpretando o sentido.

### Áudio 1 — `5163657124907058816.ogg` (deploy do gate WhatsApp ainda não aparece)

> Eu dou só uma dúvida, esse ex-um que você me viu já tá funcionando tudo, porque eu fui entrar aqui agora em minhas compras com a via dita que ela outra vez, tipo assim, quando a pessoa abrisse pela primeira vez ali depois que você editasse, pedisse o número do WhatsApp da pessoa pra ter uma forma secundária. A dita entra em contato com esse cliente, sabe? E mesmo assim, não apareceu ainda, ainda tá atualizando no site, tá subindo pro site, ou já está funcionando mesmo. Me dá uma retorna aqui, por favor.

### Áudio 2 — `5163657124907058827.ogg` (perguntando se transcrevi)

> O Eduardo, beleza? Outra questão é sobre o que você falou que está liberado para testar — no caso, essas coisas que eu reportei nos vídeos ali e os áudios. Você conseguiu escutar eles, ver certinho, pra resolver aquelas questão que eu reportei?

### Áudio 3 — `5163657124907058837.ogg` (mensagem de re-engajamento)

> O Eduardo, outra coisa legal pra implementar na IA do bot é o seguinte: na hora que a conversa "esfria" — ficou 5 ou 10 minutos, ou meia hora, ou uma hora — a gente identifica se a pessoa não comprou nada. Aí já envia a mensagem padrão "para realizar novas compras no aplicativo digite /start". Mesmo que eu tenha assumido a conversa manualmente, depois de uns 30 minutos ou 1 hora, mandar essa mensagem pra ela saber que pode voltar pelo aplicativo e clicar no /start.

### Áudio 4 — `5163657124907058838.ogg` (esperando ok pra testar)

> Eduardo, eu revisei só as coisas que você me enviou nessa mensagem aqui — as coisas que eu tinha dado feedback nos vídeos. Eu ainda não testei. Se você puder me dar um ok aqui que aquilo dos vídeos já tá pronto pra eu efetuar novos testes, me avisa pra eu já começar a testar, beleza?

### Vídeo IMG_8766.MP4 — Splash cortando + URL Vercel + áudio fleites

> Vamos lá, Eduardo. Aqui na primeira clópica que você selecionou, você colocou aqui. Splash Spin, animação de abertura. No caso, era patecido corrigido. A gente clica aqui, olha, a gente abre o site, olha, vai fazer a animação, ele já corta. E no caso, ainda está do mesmo jeito o diante sabe. E o link que, em cima, está aparecendo o link que dá Morex, Versão. Não está aparecendo o link do cineviso, enquanto é ponto com ponto BR. Beleza? O caso precisa corrigir, na questão, olha a animação. Fazer o barulho lá, no caso, do que a gente combinou, que é o áudio das fleites. E na hora que estiver fazendo aqui, a tela de carregamento, não já aí carregando o site, no caso no fundo, de segundo plano.

### Vídeo IMG_8767.MP4 — Preço no meio + URL Vercel desatualizada

> Eduardo vamos lá, pelo jeito atualização ela só veio para esse link aqui, sabe? Tipo, o link oficial lá, cinevisionapp.com.br. Aquele lá que o bot está puxando, tá puxando pelo jeito pelo versão lá, pela quele aquele link, aquele link lá, acredito deve ser alguma base que você deve tá testando. E no caso ela ficou como oficial para acessar pelo botão lá do bot, sabe? E o que acontece, vamos retornar no caso na página, no top 2 aqui, páginas de detalhamento do filme, sobre o preço. O preço aqui ele tá aparecendo no meio, sabe? Eu não gostei muito desse que ele ficou aqui no meio. Eu prefiro que ele realmente fica bem aqui em cima de compra, que centralizado aqui com o botão de compra, sabe? Eu até dei um olhado em outros filmes aqui pra ver se estava realmente desse jeito, mas precisa corrigir isso, sabe? Por exemplo, a pessoa entrou aqui no Diabo Veste Prada e o filme tá aparecendo o valor aqui no meio. E na hora que clica para voltar no início é por causa que o meio de pai com o dia que solte ele que recarrega a gente na tudo, deixa eu só verificar isso aqui de novo. Tão bem com o início voltou, é beleza, no caso eu acho que é só corrigir no caso o valor. Ele mesmo que o valor ele tá aparecendo no meio aqui, sabe? Eu gostaria que ele aparecesse bem aqui mesmo em cima do botão compro, centralizado com o botão compro aqui. Acho que ficaria algo bem mais legal e bonito, beleza?

### Vídeo IMG_8768.MP4 — Compra órfã pelo Safari

> Vamos lá Eduardo, eu vou efetuar agora o teste 3 de compra-órfã, no caso fora do telegram. Eu vou pelo navegador Safari, vou comprar no caso Fórmula 1 real. Vou ter que aí comprar, processando, vamos ver, você vai gerar o pix aqui no navegador, olha, está algo bem demorado, vamos ver o qual vai ser que vai acontecer. Gerou o pix, beleza, eu vou efetuar o pagamento aqui pra ver qual que é as próximas passos. Mas no caso eu vou te enviar esse vídeo, se tiver como melhorar essa velocidade de carregamento ali depois que a pessoa que em processar está demorando relativamente 1,5 a 8 segundos. Se conseguir comprimir essa velocidade, beleza?

### Vídeo IMG_8771.MOV — IA + código interno vazado

> Eduardo, eu estou dando uma olhada aqui na AIA funcionando, cara, está funcionando legal de mais, gostei bastante. Espero daqui a pouco a gente já pode também implementar na minha DM aqui do privado aqui, do pessoal. Mas vamos lá, a pessoa veio aqui em cima e perguntou lá: tem o "Diabo Veste Prada dublada"? E respondeu lá: tem assim, qual é o 2016 ou um novo de 2026? Só que aí o que acontece, aí a IA enviou essa mensagem que, pra ele, possivelmente algum código interno. A gente respondeu "o que é isso, o que é isso?" Aí tipo, ela responde aqui "é que não te você vê o sino, óbvio, tudo mais, não consegui entrar aqui, tipo de reparé, sabe?". Continua respondendo, e no caso, precisa verificar essa questão aqui, desse código que enviou aqui, pra no caso, tá enviando o link do filme pra pessoa, beleza?

### Vídeo IMG_8772.MOV — Comprovantes não aparecem no painel

> Eduardo. E outra questão também é analisando alguns chats aqui que as pessoas chamam pelo bot. Vamos supor essa pessoa aqui — "Segue o comprovante" assim. Possivelmente ela deve ter pago no PIX manual, alguma coisa, ou realmente até pelo bot não conseguiu acessar, talvez algum problema, ou porque ela não sabe ou tem alguma dificuldade, e ela colocou assim "segue o comprovante". Possivelmente aqui no chat ela me enviou o comprovante. E pelo que acesso aqui pelo painel administrador, no caso eu não consigo ver o comprovante. Se tivesse como na hora que a pessoa enviasse uma imagem... por mais que aí talvez não consiga detectar esse comprovante (acho muito difícil), tipo assim, possivelmente talvez um post, alguma coisa — eu acredito que ela deve achar o filme que a pessoa está procurando pelo post. Mas vamos lá nesse caso aqui: a pessoa enviou o comprovante aqui pelo atendimento e o comprovante não aparece, sabe? Então aqui eu vou ter que enviar uma mensagem pra ele, pra ele me chamar no privado lá pessoal, pra ele conseguir me enviar essa imagem. Só que o que acontece? Queria ver com você pra a gente não seguir nesse modelo: no caso eu tenho que enviar o link do meu privado. Seria o ideal mesmo na hora que ele enviar alguma imagem aqui, por esse chat aqui, pelo atendimento eu conseguir verificar o comprovante. E na hora que a pessoa enviar essa imagem de comprovante, e o bot, no caso a IA detectar aqui "é um comprovante", ela pegar e fazer aquela pausa ali, pra mim entrar e verificar se essa pessoa realmente fez o pagamento. Se realmente não tiver como a IA verificar esse pagamento lá no banco do provider (Oasyfy), beleza? Mas se não tiver como, acho que seria o ideal. Mas se tiver como verificar automaticamente o comprovante, melhor ainda, beleza?

### Vídeo IMG_8775.MP4 (= IMG_8775 (1).MP4 — duplicata) — Mensagens duplicadas no bot

> Eduardo, vamos lá, eu acabei de fazer um teste aqui — o Leonardo digitou /start, ele está gerando no caso esses dois "Gerar QR Code Pix" — ele dá um "Gerar QR Code" e depois está gerando outro "Gerar QR Code", sabe? Agora pouco mesmo, o Leonardo que eu te chamei, só estava dando um "Gerar QR Code Pix" e não estava gerando aqui embaixo. Vou tentar simular aqui novamente só pra você ver. O jeito que está sendo: voltou a duplicar as mensagens, sabe? Algumas mensagens. Vamos entrar aqui — eu acredito que você deve estar mexendo, alguma coisa. Só que tipo, é muita gente como cliente que tá me chamando aqui no privado — umas 5 ou 6 pessoas tá me chamando, e tem outras tentando efetuar, gerar o Pix e não estavam conseguindo. Lá, gerou no caso, clico em Pix, vamos ver como vai acontecer. Gerou um QR Code, deu problema nenhum, vamos ver se vai gerar outro... Só que no caso faz 2 — gerar e um dá "ai eu vou gerar outro", entendeu? Não sei se tem como apagar essas mensagens aqui pra não aparecer esse erro. Se tiver como excluir esse erro aqui também pra não aparecer, beleza?

### Vídeo IMG_8794.MP4 — Compras que não chegaram (4–5 pessoas)

> Boa noite Eduardo, beleza? O Eduardo, já é umas 4 ou 5 pessoas a me reportar sobre isso: ela faz a compra, link automático, e não recebe, sabe? E o que acontece? Eu não sei se ela não coloca o número do WhatsApp dela lá, se ela não cadastra, mas não aparece também nas compras órfãs. E se você analisar aqui, ó, quando uma compra fica desse jeito aqui, "N-A", ela foi paga realmente — 21:31, 21:32 — então possivelmente essa compra mesmo foi feita pelo navegador externo, fora do bot, e ela informa que não recebeu o link. Eu não sei se é uma pessoa que não tem tanta familiarização com a tecnologia por isso ela não conseguiu a liberação certinha, ou se é necessário verificar pra ver se está ocorrendo tudo OK. Beleza?

### Vídeo IMG_8806.MP4 — Busca sem acentos + título inglês

> Eduardo, vamos à outra coisa que eu verifiquei: se a gente tem "Diário de um Vampiro", se você escreveu por exemplo "diário" sem acento, "de um vampiro", olha, não aparece o conteúdo. Então no caso eu queria que a busca ficasse inteligente também, sem acentos. Se eu colocar aqui "diários", olha lá, aparece o conteúdo. Eu não sei se a busca perdeu a inteligência conforme fez as atualizações, mas queria que você desse uma olhada aí depois. Porque... e ver aquela questão também de colocar os títulos em inglês — no caso a gente colocou inglês como secundário, ali, mas a pessoa pesquisa e aparece o conteúdo também, entendeu? No caso vai aparecer em português, mas tipo assim, na hora que a gente foi lançar o filme a gente lançou um título em português que é o principal e o secundário que é o inglês, e a pessoa pesquisou "The Vampire Diaries", aí no caso aparecia "Diário de um Vampiro", entendeu? Por causa que o principal é português, secundário inglês, beleza?

### Vídeo IMG_8809.MOV — Edições pendentes

> Aqui eu estou numa conta teste de um funcionário, no caso só pra eu te passar feedback. Esse "Impurus" aqui eu publiquei pela minha conta. Na conta do funcionário aparecem todos os filmes que estão no site. Se a pessoa vier clicar nesse lapizinho do funcionário, pra ele editar alguma coisa — por mais que eu acredito que não irá ser necessário — vou supor que ele edite, vou colocar três "L" aqui, vou clicar pra salvar. Aparece essa informação "você não tem permissão para editar o conteúdo". Show, ele não tem a permissão. **Só que o que dá pra fazer:** na hora que em vez de aparecer "salvar o conteúdo" vai aparecer um pop-up informando que ele tá enviando uma solicitação pro administrador do que ele editou. Aí no caso, pra mim, na minha conta master, eu venho aqui em "Liberar edições pendentes" e aparecer certinho — o conteúdo é o "Impurus", aparecer o que ele tá editando, querendo editar. Pedindo pra mim conceder a edição que ele fez ou cancelar. Ele vai abrir o chamado pra mim ver se eu autorizo ou não essa edição. Aí no caso os conteúdos que ele adicionar pelo painel administrador, você no caso já fez aquela função pra ele fazer a edição do conteúdo — hoje a janela de edição tá uma hora. Eu deixei essa conta aqui, não cheguei a testar essa opção. Vou estar testando pra ver se tá funcionando. Se você puder solucionar fazer esse ajuste, eu acredito que vai ajudar bastante, beleza?

### Vídeo IMG_8810.MOV — Permissão "Usuários ativos" toggleable

> Outro caso, olha esse "Total de conteúdos". Eu não sei se é até legal aparecer pra funcionários. Só que esse "Usuários ativos" aqui pra mim, acho que essa "barrinha" você pode tá tirando pra funcionários, porque eu acredito que ou você coloca "barrinha" lá pra ativar pra só conseguir usar — os usuários ativos ou não — porque tem alguns usuários que eu vou permitir ver essa questão, só que alguns funcionários eu não vou querer permitir. Colocar essa caixinha pra marcar — na hora que eu for mexer aqui no usuário, na configuração, ter essa opção desses "Usuários ativos", beleza?

### Vídeo IMG_8811.MOV — Conteúdo criado fica em rascunho

> Eduardo, outra questão também: no caso eu cliquei pra adicionar conteúdo na conta do funcionário, só pra efeito de teste. Adicionei o conteúdo, ele vem aqui pra "Gerenciar conteúdo", ele fica desta forma aparecendo pra eu publicar pro site. E na hora que o funcionário clica pra publicar, vamos aguardar a hora — esse erro aqui: "ele não é publicado, você só pode editar o conteúdo que é adicionado dentro da janela permitida". Então o que está acontecendo: na hora que a pessoa cria o conteúdo direto, ele já não está subindo pro site, sabe? Ele não está subindo. Então o que precisa ser feito: na hora que a pessoa vier aqui adicionar o conteúdo, ela adicionou, esse conteúdo ele já subiu pro site. Só que o que acontece: ele está vindo pra rascunho, "Digerir o conteúdo", aí você tem que clicar nessa "barrinha" aqui pra subir pro site. No caso a conta do funcionário não está permitindo fazer isso. Agora se eu vim aqui pela minha conta principal, eu consigo subir pro site — vai aceitar o concluído, "publicado com sucesso". Então o que acontece: **todas as contas, não é nem só a do funcionário**, é todas as contas — na hora que você clica pra adicionar o conteúdo no CDS faz o conteúdo completo, só que ele não vai direto pro site. Você precisa vir em "Gerenciar conteúdo" e clicar nessa "barrinha" pra subir. No caso a conta do funcionário está nem com o sentinho, subir pro site todo. Você pode verificar pra mim?

### Vídeo IMG_8812.MOV — Detalhe de edições pendentes (granular)

> Informar também outra questão, só pra já informar pra ser corrigido: por mais que esse conteúdo aqui eu crie pela aba do funcionário — o que acontece, eu clico no lapizinho — no caso era pra deixar esse conteúdo uma hora pra ele ser editável, certo? Vamos supor que eu vou colocar "dois D" aqui no título só pra você ver, vou clicar em salvar — ele dá esse aviso "você não tem permissão para editar este conteúdo". Por mais que um conteúdo que o funcionário adicionou, no caso ele teria uma hora ainda pra ele conseguir editar. **Eduardo, vamos fazer o seguinte:** ele editou o conteúdo, ele precisa editar — você já pega no caso, ele já enviou uma solicitação aqui de "edição pendente". No caso já vejo a edição dele aqui, pra eu ter um real controle sobre isso. Beleza? Ele pega, sobe uma edição "tipo, subiu o edição do título", ó, beleza, aparece a edição do título. Aí ele pega e fala assim "eu esqueci de um botar trailer, esqueci, ele veio errado". Ele pega, edita o trailer, sobe outra edição. No caso eu preciso aprovar cada edição que ele fez. Ou se ele veio e editou tudo, ele editou três coisas e três barras vão aparecer aqui — uma solicitação só, mas que foi editado três coisas, e aparece as coisas que ele editou. Bem específico, pra eu entender o que ele tá editando, qual conteúdo, qual o título do conteúdo que ele tá editando, pra eu ter o real controle do que esse funcionário tá fazendo no site. Beleza?

### Vídeo IMG_8813.MOV — Exclusões também viram solicitações

> Eduardo, também questão de excluir conteúdos, editar tudo isso. Por exemplo, clico aqui no lixinho, ele vai confirmar exclusão, beleza, apareceu pop-up que está enviando uma solicitação pra mim — se eu aceito, se eu excluo. Esse conteúdo, mas foi ele que adicionou, envia pra mim ver se eu aceito, se excluo, e antes de eu aceitar esse conteúdo ainda fica em rascunho, beleza?

### Vídeo IMG_8814.MP4 — IA mandando links 404

> Eduardo, outra coisa que verificando: um exemplo, a pergunta é dos filmes pra IA. Ela responde como se tivesse mesmo o valor, mas só que ela não manda o link do filme certo. Por exemplo, "Velozes e Furiosos" — eu clico aqui no link, o link dá erro. Ela tá criando links que não existem, link que não existe. Mesma coisa que "Top Gun" — clica no link, link dá erro 404, porque o link não existe. Desse conteúdo, no caso, existe o filme — a gente tem o filme — só que não tá enviando o link correto. E muito das vezes, se você analisar, exemplo aqui: ela pergunta "qual Top Gun você deseja?", eu falei "eu quero de 1986", ela não respondeu, eu quero "Top Gun no primeiro filme", aí depois de três chamadas que eu dei na IA, ela vem me respondendo. Então tipo, precisa ser um gatilho um pouco mais rápido. Não sei se você colocou um espaçamento de umas duas mensagens pra ela responder — tipo, teve que ser duas mensagens pra ela responder. Você pode verificar isso pra mim também, beleza?

### Vídeo IMG_8832.MP4 — Compra anônima sem desconto

> Eduardo, vamos lá, outra questão também: na hora que a pessoa está aqui no navegador, "órfão" vamos dizer assim, que ela não está com a conta logada do Telegram. Exemplo, ele está 7,02 o conteúdo, correto? Só que na hora que clico em comprar — ela está na promoção 7,02 — na hora que gera o PIX, ele vem com o valor de 7,80. Vamos só aguardar aqui... olha lá, ele vem com o PIX, vem com o valor de 7,80. Eu escaneio realmente o valor, o valor que chega é o 7,80, entendeu? Não aparece o valor com o desconto. Então seria legal também aqui nesse total aparecer o desconto, o valor de 7,80, o valor com o "verdinho" no caso com o desconto, pra a pessoa pagar no navegador, sem estar logada com o Telegram, pegar o desconto também, beleza?

### Vídeo video (5).mp4 — Busca por título inglês

> Eduardo, vamos lá, no caso é esse cliente aqui, pela IA tá verificando ela trabalhando aqui. O cliente tá procurando o filme "Tendrama". Esse filme realmente a gente tem no catálogo, mas só que o que acontece: ele tem o título em português, eu coloquei o WiFi aqui (sic — "Wi-Fi" provavelmente é "title"), coloquei o título em inglês, então no caso acredito que era pra ele reconhecer, sabe? E uma coisa também que eu queria ver se é possível adicionar no catálogo: é porque tem muita gente que vem pesquisar o nome de um filme e a pessoa digita o nome do filme em inglês, e não acha o filme na barra de buscar lá em cima, no caso na lupinha lá de cima. Eu queria ver com você se teria essa opção: no site lá vai aparecer o título em português, só vai aparecer o título em português, mas se a pessoa pesquisar o nome em inglês, aparecer o português também, entendeu? No caso de colocar duas barrinhas de título: na hora que a pessoa for criar um conteúdo, colocar o título em português e o título em inglês — mas só que o que vai prevalecer no site é o título em português, entendeu? E o título em inglês, a pessoa pesquisando pela lupa, alguma coisa ali no site, ele já pesquisando o conteúdo pelo nome em inglês já vai encontrar o filme realmente certo, sabe? Porque esse filme aqui é muito conhecido pelo "T-drama", mas só que o nome no Brasil é "O Drama". Tem gente que conhece pelo "Pôdrama", tem gente que conhece pelo "T-drama". Aí no caso é esse cliente aqui, ele pediu pela IA o "T-drama", mas só que a IA não conseguiu detectar. Se puder estar verificando isso pra mim, beleza?

### Vídeo video (6).mp4 — IA não responde alguns clientes

> Boa noite, Eduardo, beleza? O Eduardo, vamos lá. Isso aqui sou eu conversando com o bot, perguntando tipo de alguns filmes. Só que o que acontece: eu não sei se é porque eu já cliquei aqui uma vez e assumi manualmente, que reativei aí a conversa — eu vou conversar com ele, ele não responde minhas perguntas, sabe? Tipo, os clientes novos que estão conversando com ele, vão respondendo. Só que tem alguns também que chegam num momento — exemplo, se cara tem "o que eu cancelar", tipo assim, por mais que não devam responder — eu já perguntei pra perguntar "qual filme você deseja?", porque talvez vire um gancho ali pra ele comprar um filme. Mas tipo, alguns aqui — esse daqui o cara digitou "qual filme você procura?" — então tipo, já vai fazendo um gancho. Alguns aqui tipo, tá respondendo super bem, só que não, olha lá, tipo "já paguei", tipo assim, aí ela não tá respondendo algumas pessoas, sabe? Eu não sei por qual motivo, se você puder tá dando uma analisada e me informando, beleza?

### Vídeo video (7).mp4 — Compras sem WhatsApp = perdidas

> Eduardo, o que eu verifiquei aqui, olha: um exemplo hoje, 1/5, 22:23 — isso foi praticamente 10 minutos atrás — essa pessoa que comprou o filme, só que não colocaram o WhatsApp. E eu não consigo localizar a pessoa. No caso tem várias compras aqui: 21,82 / 20,20 / 14, e não tenho WhatsApp das pessoas aqui. Eu acabei de efetuar o teste, eu coloquei meu WhatsApp lá, deu certo, e eu vim que olhei, parecia um WhatsApp, no arco entrei e resgatei e atualizou. Só que dessas pessoas aqui não tá aparecendo WhatsApp. O que você acha que a gente deve fazer pra não perder esse cliente? Porque tipo, **muita pessoa veio atrás de mim por causa disso aqui**. E seria legal também: nessa aba aqui — por mais que esse aqui que já foi perdido, vamos dizer assim — tem algum botão aqui pra a gente excluir, pra não ficar poluindo aqui tanto. E ver alguma forma pra a gente não perder esse cliente. Porque altamente a gente perdendo ele, isso aí acaba complicando, talvez a pessoa compra, já pode botar "você não recebeu conteúdo", beleza?

### Vídeo video (8).mp4 — Limite marketing 100k

> Eduardo, outra coisa que verifiquei aqui também: no marketing, já tem 100 mil pessoas, 359 usuários disponíveis pra me enviar o marketing. Só que aqui ele está limitando em 100 mil usuários. Se você conseguir verificar isso aqui pra mim, fazer essa liberação no caso do marketing pra enviar pra todos os usuários — menos esse usuário que foi pra 1 milhão, 2 milhões, 3 milhões. Já pensa lá na frente, pra fazer essa liberação pra não ficar travado, beleza?

### Vídeo IMG_8846.MOV — Dashboard de produtividade + refinamento permissão fotos

> Vamos lá, outra questão também que eu queria ter um controle total como já vi no início lá pros funcionários. O que acontece: é um controle total dos funcionários. Acredito ter um botão aqui pra eu saber — vamos supor um gráfico — pra eu saber um exemplo de cada funcionário, o que adicionou no dia, separado por dia, por mês. Exemplo: funcionário tal, organizar um exemplo ideal: funcionário "matioso" (?) — o que tenho agora — eu clico aqui e vejo os detalhes dele. Abrir os detalhes dele numa aba, e conseguir ver quantos filmes ele adicionou por exemplo no dia 3 tipo de meia-noite até meia-noite, quantos conteúdos ele adicionou, quantos filmes / quantas séries. Se conseguir especificar certinho quais filmes e quais séries ele adicionou. E ter esse dashboard com gráfico, pra eu ter esse controle diariamente e mensalmente. Eu quero ter o controle certinho do que esse funcionário adicionou — porque como eu vou pagar por conteúdo do que ele adicionar na plataforma, eu preciso ter o exato, quanto conteúdo foi adicionado, tudo certinho, tudo especificado.
>
> E outra questão também (eu recortei em outro vídeo, não sei se você chegou a ver): adicionar nas opções aqui de marcar certinho a opção pra ele conseguir mexer nos atores — mas só nos atores sem foto. O que acontece: ele adicionou uma foto ali, depois ele já não consegue mais mexer naquele ator. Entendeu? Adicionar é tipo "filme/série" — os atores que já estão na lista, beleza. Ou seja, ele tem acesso à lista toda, e pega no caso essa mesma janela de edição: ele adicionou, consegue ver a lista toda, adicionou foto num ator, consegue editar esse ator dentro de 1 hora. Se ele precisar editar (exemplo) outro ator que ele viu que tem algum erro, beleza — ele vai editar e vai aparecer um pop-up dizendo que está enviando pra eu aprovar. Aí vai pra "Edições pendentes". Tipo todas as edições que ele fizer (de filme, de ator), todas as edições fora daquela janela de 1 hora, ou qualquer edição em conteúdo antigo do site, vai aparecer pendente pra mim aprovar. Eu aprovando aqui, já sobe direto pro site. Antes da aprovação, fica esperando minha aprovação. Pra eu ter um total controle sobre funcionário.

**Pedidos consolidados desse vídeo:**

#### NOVO — Dashboard de produtividade por funcionário (F3.10)
- Gráfico de conteúdos por dia / por mês, por funcionário.
- Clicar num funcionário abre painel detalhado:
  - Total de filmes vs total de séries adicionados em cada janela.
  - Lista exata de quais filmes e séries (com link).
  - Filtro de data (3 ago, último mês, custom).
- **Razão de negócio:** Igor paga por produção do funcionário, precisa de relatório fiel.
- **Implementação sugerida:** estender `/admin/employees/[id]/page.tsx` com tab "Produtividade" + endpoint `GET /admin/employees/:id/productivity?from=&to=` que devolve `{ daily: [...], monthly: [...], items: [...] }`.

#### REFINAMENTO de F2.5 — Permissão `can_add_people_photos`
- Funcionário com a permissão **vê toda a lista de atores** (incluindo com foto).
- Adicionar foto a ator sem foto → libera "ownership" de 1 hora pra editar essa foto.
- Após 1h → edição vira solicitação pendente em `content_edit_requests` (mesma tabela usada pra filmes/séries).
- Editar ator que ele NÃO adicionou foto (atores antigos do site) → **SEMPRE** vira solicitação pendente.
- Admin aprova → sobe direto pro site (mesmo workflow de F2.3).
- Implementação:
  - Migration: adicionar `request_type` (varchar: `update`|`delete`) e `target_table` (`content`|`people`) em `content_edit_requests`. Ou criar tabela `people_edit_requests` espelhada — decidir baseado no esforço.
  - Endpoint `PATCH /admin/people/:id` com mesma lógica de `resolveEditCapability` da `admin-content.controller.ts`.
  - Track de "ownership" — quem adicionou a foto: nova coluna em `people` (`photo_added_by_user_id`, `photo_added_at`).

---

## ✅ Checklist de execução sugerido

Em ordem de impacto financeiro × esforço, atacaria nessa sequência:

1. **C1 — PIX Oasyfy 401** (config, 5 min se tiver acesso ao painel)
2. **A6 + A11 — confirmar URL Vercel/cinevisionapp + forçar Igor logout/login** (verificar deploy + env do bot, 30 min)
3. **C4 + B3 — segunda visão "Pagas não entregues" + botão excluir órfãs perdidas** (1 dia)
4. **C2 + C3 — `/start` quebrado + Conflict 409** (debug + verificar instâncias prod, 2–4h)
5. **A7 — funcionário não loga** (debug auth + role employee, 2–4h)
6. **A1 + A3 — IA inventando link / vazando códigos** (validação rígida + endurecer prompt, 1 dia)
7. **A5 — desconto na compra anônima** (corrigir `total_cents`, 1–2h)
8. **A8 + A9 — edições/exclusões viram solicitações + publicação direta** (refator módulo content, 1–2 dias)
9. **A10 — stats funcionário em tempo real** (trigger SQL ou query agregada, 4h)
10. **A2 + A4 — IA atrasa 3 mensagens / ignora cliente "retomado"** (debug, 4h)
11. **M1 — comprovantes no painel** (1 dia)
12. **M2 — re-engajamento por inatividade** (cron + template, 1 dia)
13. **M5 — botões voltar admin** (2h)
14. **M6 — Pix Recovery UX** (paginação + busca, 1 dia)
15. **M7 + M8 + M9 — reset diário + permissão fotos + permissão usuários ativos** (4–6h)
16. **M10 — otimizar checkout** (medir + otimizar, 4h)
17. **M4 — limite marketing 100k** (1–2h)
18. **B4–B8 — agrupamento, busca, humanização IA, stories** (cada um meio dia a 1 dia)

**Total estimado:** 7–10 dias de trabalho contínuo para tudo, **mas o bloqueio de receita é o C1 (PIX). Resolver isso primeiro, mesmo antes de qualquer outra coisa.**
