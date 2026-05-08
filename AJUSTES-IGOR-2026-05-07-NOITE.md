# Ajustes Igor — Rodada 07/05/2026 (noite)

3 vídeos enviados pelo Igor entre 21:59 e 22:23, transcritos via Whisper. Continuação dos itens da rodada anterior (N1-N14).

---

## N15 — Reenviar entrega: link do conteúdo não vem na mensagem do WhatsApp
**Origem**: vídeo `9.59.47 PM` 07/05

**Reportado**: Igor abre uma compra órfã, clica em **"Reenviar entrega"**, escolhe **"Mandar mensagem pelo WhatsApp"**, clica em **"Abrir"**, e a mensagem que abre no WhatsApp Web/App **não inclui o link do conteúdo** — só o template padrão. Ele tem que copiar o link manualmente e colar.

Igor ouviu que no painel de **"Compras órfãs sem Telegram"** — quando a pessoa registra WhatsApp na hora do pedido — a mensagem que abre **JÁ VEM com o link pronto**. Ele quer o mesmo comportamento aqui no "Reenviar entrega" do painel de compras órfãs do Telegram.

**Análise**:
- Provavelmente o template de mensagem do "Reenviar entrega" no admin de orphan-orders Telegram não está fazendo string interpolation com a URL do conteúdo. Ou o backend retorna só o template estático.
- Verificar `admin/orphan-orders` (front + back) e o handler que monta a URL `wa.me/<phone>?text=<encoded>`.
- Comparar com o template do painel "órfãs sem Telegram" (que Igor diz funcionar) pra reusar a mesma lógica.

**Fix sugerido**:
- Garantir que o template de mensagem inclua `${conteudo.titulo}` + URL completa do filme (`https://cinevisionapp.com.br/movies/<slug>` ou link de acesso direto se aplicável).
- Encode pra `wa.me/?text=` corretamente (URL-encoded).

**Prioridade**: 🟠 alta (Igor faz isso várias vezes ao dia, copiar manual é fricção).

---

## N16 — Mensagem do popup de WhatsApp em compras órfãs precisa ser mais convincente
**Origem**: vídeo `9.59.47 PM` 07/05 (segunda parte)

**Reportado**: No painel de **"Compras órfãs sem Telegram"**, quando o cliente faz a compra e o sistema pede o WhatsApp dele, **muitos clientes não estão preenchendo** porque "ficam com medo de digitar o WhatsApp". A mensagem atual não convence.

Igor quer reescrever pra deixar explícito:
1. O número **NÃO vai ser compartilhado com ninguém**.
2. O número **só serve pro caso de a pessoa não conseguir receber o filme pelo Telegram** — aí o atendimento entra em contato pelo WhatsApp.
3. Tom mais empático/explicativo, não burocrático.

**Análise**:
- O componente que pede WhatsApp em orphan-orders (provavelmente em `frontend/src/components/WhatsApp/...` ou direto no fluxo de checkout sem-Telegram) tem texto curto/genérico.
- Igor quer texto mais longo, com bullets ou frases curtas explicativas.

**Sugestão de texto** (pra Igor validar):
> "📱 Pra garantir que você receba seu filme:
>
> Caso aconteça algum problema na entrega pelo Telegram, vamos te chamar pelo WhatsApp pra liberar o acesso manualmente. Seu número fica salvo só pra isso — **a gente não compartilha com ninguém** e nem usa pra divulgação. Promessa."

**Prioridade**: 🟡 média (impacto: percentual de orphan-orders sem contato fica menor).

---

## N17 — Marcar compra órfã como "perdido" não pode invalidar o link de acesso
**Origem**: vídeo `10.01.02 PM` 07/05

**Reportado**: Igor usa "Marcar como perdido" no painel de compras órfãs **só pra controle interno** dele — quando ele já reenviou o link pro cliente via WhatsApp e quer tirar essa compra da fila ativa pra não acumular. **NÃO** quer que o link seja invalidado, porque o cliente ainda pode acessar.

**Dúvida explícita**: "Eu queria saber: se eu marco como perdido, esse link **continua funcionando** ou é invalidado? **Se ficar invalidado, eu vou pedir pra você que ele continue funcionando mesmo depois que eu apague ele do painel**."

**Análise**:
- Hoje "marcar como perdido" provavelmente atualiza um campo de status (`order.status = 'lost'` ou similar) ou deleta a row.
- Verificar se a query de validação do link/invite (no fluxo de entrega ao cliente) checa esse status — se sim, e bloqueia, precisa **desacoplar**: status `lost` é só pro painel de Igor, **não afeta acesso**.
- Nome melhor: trocar "Perdido" por "Arquivado" ou "Resolvido manualmente" no front (mais claro do que está acontecendo).

**Fix sugerido**:
- Auditar o flow de delivery/access em `orders.service.ts` ou `telegrams-enhanced.service.ts` — confirmar que o `getOrCreateAccessLinkForPurchasedContent` não filtra por status.
- Se filtra: remover. Status `lost` afeta SÓ a query do painel admin (filtra fora da lista padrão).
- Adicionar tooltip no botão: "Marca como resolvido manualmente. **Não invalida o link** — cliente ainda consegue acessar."

**Prioridade**: 🔴 crítica se hoje invalida (cliente fica sem acesso). 🟠 alta se já não invalida (só faltou confirmar pro Igor + melhorar UX).

---

## N18 — Toggle "Novidade / Nova Temporada" como sticker no admin (sem editar PNG do pôster)
**Origem**: vídeo `10.23.48 PM` 07/05

**Reportado**: Hoje o Igor está adicionando o sticker "**Novidade**" / "**Nova Temporada**" / "**Novidade**" diretamente no PNG do pôster antes de fazer upload. Problema:
1. Daqui a uns dias o conteúdo deixa de ser novidade — Igor tem que **abrir Photoshop/Canva, remover o sticker, re-fazer upload** do pôster.
2. No Top 10, o nome da série/temporada do filme aparece sobreposto ao texto "nova temporada" do sticker — fica visualmente feio.

Igor quer:
- **Caixinha (checkbox)** no admin de criar/editar conteúdo: "Novidade" e "Nova Temporada" (mutually exclusive ou independentes — Igor que valida).
- Frontend renderiza o sticker como **overlay** em cima do pôster (CSS/SVG, não foto).
- Quando Igor desmarca, o sticker some sem precisar reupload do pôster.
- No Top 10, o overlay fica em camada separada e não conflita com o nome do filme/série.

**Análise**:
- Tabela `content` provavelmente já tem `is_release` (já existe no admin atual via checkbox "Marcar como Lançamento") — ESSE pode ser o "Novidade".
- Pode adicionar campo `is_new_season BOOLEAN` pra "Nova Temporada".
- Frontend nos cards do MovieGrid/Top10 verifica esses flags e renderiza badge sobreposto (CSS positionado top-left ou similar).
- Cuidar do z-index pra não cobrir título/preço.

**Fix sugerido**:
1. Verificar se `is_release` já é exposto no admin form como toggle (acho que sim).
2. Adicionar campo `is_new_season` (migration + DTO + form admin).
3. Componente `<MovieCard>` renderiza badges quando flags ativos:
   - 🆕 NOVIDADE (vermelho/rosa)
   - 📺 NOVA TEMPORADA (laranja)
4. Posicionamento: top-left do pôster, com padding pra não cobrir índice no Top 10.
5. Igor edita conteúdo, marca/desmarca flag → frontend re-renderiza sem alterar pôster.

**Prioridade**: 🟡 média (qualidade de vida, evita re-trabalho recorrente do Igor).

---

## Resumo executivo

| # | Item | Prioridade |
|---|------|------------|
| **N15** | Reenviar entrega: link não vem na mensagem WhatsApp | 🟠 alta |
| **N16** | Mensagem popup WhatsApp em órfãs precisa convencer | 🟡 média |
| **N17** | "Marcar como perdido" não pode invalidar link | 🔴 crítica/alta |
| **N18** | Toggle Novidade/Nova Temporada (sticker overlay) | 🟡 média |

**Ordem sugerida**:
1. **N17 primeiro** — risco de cliente sem acesso. Validar comportamento atual + ajustar se necessário.
2. **N15** — quick win, melhora produtividade do atendimento.
3. **N18** — feature visual, UX bonita.
4. **N16** — copy revision, depende de Igor validar o texto sugerido.
