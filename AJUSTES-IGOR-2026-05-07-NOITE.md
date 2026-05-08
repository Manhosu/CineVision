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

## N19 — IA fazendo perguntas pessoais quando cliente manda título curto
**Origem**: screenshot Igor 23:22:59 — Cliente: "Meu meio irmão" / IA: "Você procura um filme chamado 'Meu Meio Irmão'? Ou quer me contar algo sobre seu meio irmão mesmo?"

**Reportado**: Cliente mandou um título de filme (curto), e a IA respondeu como se pudesse ser uma conversa pessoal sobre o irmão do cliente. Igor disse: "a IA deve falar única e exclusivamente sobre filmes e séries, jamais da vida da pessoa ou qualquer coisa nesse sentido. Se a pessoa chega e fala um título dessa forma, a IA já deve entender como a existência de um conteúdo".

**Diagnóstico**: o system prompt anterior tinha uma regra "MENSAGEM AMBÍGUA" que classificava frases curtas como ambíguas e mandava a IA fazer pergunta aberta. Isso fazia ela considerar interpretações pessoais.

**Fix entregue**:
Reescrevi o system prompt da IA (UPDATE direto em `ai_training_config` — efeito imediato, sem redeploy). Mudanças:

1. **Nova regra ABSOLUTA de escopo no topo**: "SEU ÚNICO ASSUNTO É FILMES E SÉRIES DO CATÁLOGO". Proíbe conversa sobre vida pessoal, sentimento, política, religião, conselho. Se cliente puxar assunto pessoal: traz de volta pra filmes ("aqui eu cuido só do catálogo 🎬").

2. **Nova regra CRÍTICA de interpretação**: QUALQUER mensagem que não seja saudação pura (oi/boa noite/tudo bem) ou pergunta de suporte (filme não baixa/como pago/tem reembolso) é **TÍTULO DE FILME OU SÉRIE até prova em contrário**. IA assume direto e busca no catálogo. Se achar: emite `<<DETAIL:uuid>>`. Se não achar: `<<PAUSE:content_not_found>>` com mensagem neutra.

3. **Lista de exemplos explícitos**:
   - "Meu meio irmão" → busca catálogo, segue protocolo. NUNCA pergunta sobre o irmão.
   - "Eu te amo" → busca catálogo (existe filme com esse nome).
   - "Não consigo dormir" → busca catálogo. Se não achar, content_not_found. NÃO oferece conselho.
   - "Meu pai morreu" → busca primeiro. Se não for título: `needs_human` neutro. **Não oferece pêsames, não entra no assunto**.

4. **Lista explícita de PROIBIÇÕES**:
   - "Você procura um filme chamado X? Ou quer me contar algo sobre X mesmo?" → ERRADO
   - "É um filme ou é sobre você?" → ERRADO
   - "Posso te ajudar com algum sentimento?" → ERRADO

5. **Regra dedicada (item 6) "ASSUNTO PESSOAL / FORA DE ESCOPO"**: resposta padrão "Aqui eu cuido só do catálogo de filmes e séries 🎬 quer dar uma olhada?" — sem entrar no mérito, sem conselho, sem pergunta de acompanhamento.

**Validação**: efeito imediato — próxima mensagem da IA já usa o prompt novo. Igor pode testar mandando "Meu meio irmão" pro bot e a IA deve responder com `<<PAUSE:content_not_found>>` (porque o filme provavelmente não está no catálogo) em vez de fazer pergunta pessoal.

**Prioridade**: 🔴 crítica (UX ruim, faz IA parecer terapeuta amador, atrapalha venda).

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
