# Ajustes Igor — Rodada 07/06/2026

8 arquivos transcritos via Whisper (modelo medium) + mensagens de texto do WhatsApp + screenshot do Telegram.
Continuação dos itens N1-N23 das rodadas anteriores.

**Fontes desta rodada:**
- 6 vídeos + 2 áudios enviados entre 18:34/05-06 e 02:12/06-06
- Mensagens de texto do WhatsApp (06/06/2026)
- Screenshot do chat do Telegram com cliente Caroline mostrando bug da IA

---

## N24 — IA informando que filme não tem dublado quando TEM
**Origem**: screenshot Telegram (chat com cliente Caroline) + mensagem de texto do Igor

**Reportado**: A cliente Caroline perguntou "Dublado? Ou leg?" — a IA respondeu "Esse aí é legendado em português" (correto até aqui), depois a cliente perguntou "Quero dublado?" e a IA disse "o Michael Jackson (2026) que temos aqui é legendado mesmo. **Não temos a versão dublada desse no catálogo agora**". Porém o site **claramente exibe o badge "Dub·Leg"** na página do filme, confirmando que existe versão dublada.

Igor confirmou via texto: *"O filme tem dublado porém a IA não está reconhecendo e informando errado por cliente."*

**Diagnóstico**:
- A IA busca as informações de áudio/legenda a partir do campo `audio_languages` ou similar do catálogo.
- Provavelmente a IA não está lendo corretamente o campo que indica disponibilidade de dublagem, ou o campo de busca semântica não inclui essa informação.
- O badge "Dub·Leg" no frontend vem de campos como `has_dubbed` / `audio_options` / `content_languages` na tabela `content` ou `content_languages`.
- Verificar em `catalog-context.service.ts` (backend/src/modules/ai-chat/services/) o que é enviado como contexto pra Claude — se inclui informação de áudio.

**Fix necessário**:
- Auditar `catalog-context.service.ts`: garantir que o contexto enviado à IA inclua **explicitamente** se o conteúdo tem Dublado e/ou Legendado.
- Adicionar no texto de contexto de cada filme: `"Áudio: Dublado + Legendado"` ou `"Áudio: Apenas Legendado"`.
- Testar: enviar "Michael Jackson dublado" pro bot e verificar resposta correta.

**Prioridade**: 🔴 crítica — IA está **mentindo** pro cliente, causando perda de venda e desconfiança.

---

## N25 — Popup do WhatsApp: poder desativar e editar link pelo painel ADM
**Origem**: mensagem de texto WhatsApp do Igor (06/06, 16:20-16:21)

**Reportado**: O número de WhatsApp do Igor saiu fora do ar e o link do popup foi redefinido automaticamente. Ele pediu pra desativar temporariamente o popup. Depois que o número foi reabilitado, precisa atualizar o link. Hoje isso exige intervenção do desenvolvedor.

Igor: *"Se puder fazer uma função que consigo desabilitar e editar o link pelo painel adm aí não fico te atrapalhando se possível"*

**Fix necessário**:
- No painel ADM → Configurações (admin-settings): adicionar toggle **"Ativar popup de WhatsApp"** (boolean).
- Campo de texto editável: **"Link do WhatsApp"** (ex: `https://wa.me/5567813647...`).
- Salvar em `admin_settings` (tabela já existe no Supabase).
- Frontend: antes de exibir o popup de WhatsApp, checar se está ativo via `/api/v1/admin/settings/public`.
- Relacionado ao N16 (texto do popup) — pode ser feita na mesma tela de configuração.

**Prioridade**: 🟠 alta — Igor precisou pedir manualmente e ficou sem WhatsApp no popup por um período.

---

## N26 — Backdrop/OG image não aparece no preview do Twitter/X para filmes antigos
**Origem**: mensagem de texto WhatsApp do Igor (06/06, 17:13)

**Reportado**: Após Eduardo mexer nas OG images, o preview ao compartilhar no Twitter/X aparece corretamente só em **2 filmes**: "Todo mundo em pânico 6" e "Mestre dos Universos". Os filmes antigos que já estavam no catálogo antes do ajuste **não aparecem**.

Igor: *"Se puder ver pra mim por favor"*

**Diagnóstico**:
- A rota de OG image provavelmente é `/api/og-image?id=<slug>` (ver `frontend/src/app/api/og-image/route.ts`).
- Filmes novos podem ter backdrop salvo corretamente, filmes antigos podem ter campo `backdrop_url` nulo ou em formato diferente.
- Twitter/X faz cache agressivo do OG tag — filmes já compartilhados antes podem estar com cache antigo no Twitter.
- Verificar se a meta tag `og:image` está sendo gerada corretamente na página `movies/[id]/page.tsx` com a URL absoluta correta.

**Fix necessário**:
1. Verificar `frontend/src/app/movies/[id]/page.tsx` — meta tag `og:image` usa `backdrop_url` ou `poster_url`?
2. Auditar quantos filmes têm `backdrop_url` nulo no Supabase (query: `SELECT COUNT(*) FROM content WHERE backdrop_url IS NULL`).
3. Se muitos filmes não têm backdrop: usar `poster_url` como fallback para OG image.
4. Para filmes já cacheados no Twitter: usar Twitter Card Validator para forçar re-fetch.

**Prioridade**: 🟡 média — impacta marketing/divulgação nos stories e posts.

---

## N27 — Rotação de bots: PIX sendo gerado no bot errado (comportamento atual analisado)
**Origem**: vídeo `6.34.13 PM` 05/06 + vídeo `8.18.42 PM` 05/06 + áudio `6.39.23 PM` 05/06

**Reportado (vídeo 6:34 PM)**: Igor mostrou que ao clicar em comprar no Bot 1, o redirecionamento vai pro Bot 2, mas o PIX + informações do filme foram enviados em bots **diferentes** (PIX no bot 2, info do filme no bot 1). Isso indica que a rotação de bots está quebrando a sessão — o usuário está em um bot, mas parte do fluxo acontece em outro.

**Evolução (vídeo 8:18 PM — mesma noite)**: Igor fez novos testes e observou um comportamento diferente que ele achou positivo:
- Bot 1 redireciona para Bot 2 → PIX gerado no Bot 2 ✅
- Próxima compra → redireciona para Bot 5 → PIX gerado no Bot 5 ✅
- Resultado: a pessoa vai ficando em vários bots ao mesmo tempo.

Igor avaliou: *"Se continuar desse jeito aqui, show. Porque aí a pessoa se alentrou mais de uma vez, ela sempre, todo mundo vai estar nos 5 bots... Se cair em um, ela tá em outro, entendeu? Então aí acaba tipo, talvez não perdemos o público todo... Cara, achei genial."*

**Status atual**: Igor **aprovou** o comportamento de rotação atual (cada compra vai para um bot diferente). O problema do vídeo 6:34 PM (PIX e info em bots diferentes) pode ter sido corrigido entre os dois testes ou era cenário específico.

**Fix necessário**:
- Confirmar se o bug do vídeo 6:34 (info/PIX em bots separados) ainda ocorre ou foi resolvido.
- Se ainda ocorre: garantir que dentro de uma única transação de compra, **todo** o fluxo (QR Code + texto informativo) vai pro **mesmo bot** que gerou o redirect.
- O comportamento de rotação entre compras diferentes pode ser mantido como está (Igor aprovou).

**Prioridade**: 🟠 alta se bug ainda existe, 🟢 resolvido se foi coincidência do primeiro teste.

---

## N28 — Compras Órfãs não estão rotacionando entre bots
**Origem**: vídeo `1.28.02 AM` 06/06

**Reportado**: Igor estava enviando as "Compras Órfãs" (orphan orders) e percebeu que **todos os links de entrega estão indo para o "Cinevision Brasil"** bot — sem fazer o rodízio entre os bots cadastrados.

Igor: *"O bot das compras Orphans não tá fazendo aquele rodízio. Que no caso, cada link aqui, eu acho que deveria alternar, né? Um em cada compra que for chegando, ela vai alternando em um bot diferente."*

**Diagnóstico**:
- A lógica de rodízio de bots provavelmente existe para o fluxo principal de compra, mas **não foi aplicada** no módulo de Compras Órfãs.
- O módulo de orphan orders deve estar gerando o link de convite com um bot hardcoded (possivelmente o primeiro ou o "principal").
- Verificar `admin-purchases-simple.service.ts` ou `orders.service.ts` — função que gera o link de entrega das orphan orders.

**Fix necessário**:
- Aplicar a mesma lógica de rodízio (round-robin ou aleatório) ao gerar link de entrega das orphan orders.
- Usar o mesmo serviço/função de seleção de bot que já é usada no fluxo normal de compra.

**Prioridade**: 🟠 alta — orphan orders são retrabalho manual do Igor, e perder o rodízio concentra tudo em um bot (risco de ban).

---

## N29 — Link rotativo para portal Telegram (round-robin entre bots)
**Origem**: vídeo `7.21.50 PM` 05/06 + áudio `7.22.40 PM` 05/06

**Reportado**: Igor está criando um "portal" — um grupo Telegram com botões fixos: "Solicitar Entrada" e "Acessar Conteúdos". Para o botão "Acessar Conteúdos", ele precisa decidir: colocar link do site ou link de um bot.

Problema com o link do site: se a pessoa entrar pelo site e comprar, vai cair em um bot rotativo sem Igor ter o ID dela salvo em nenhum bot para marketing futuro.

Solução que Igor quer: **link rotativo de bot** — na hora que a pessoa clicar, o sistema escolhe um dos N bots e redireciona (round-robin ou aleatório), para que o ID do usuário fique salvo no bot escolhido.

Igor (áudio 7:22 PM): *"Tem algum link mutativo? Tipo assim, na hora que a pessoa clicar vai escolher um dos cinco links do bot pra startar... Ou realmente tipo assim, a próxima pessoa que entrar entra no grupo 1, a próxima depois entra no 2... Que eu acho que seria o ideal, né? Fazer escalonada desse jeito pra sempre ficar dividido com o tanto de público certo em cada grupo."*

**Solução proposta**:
- Criar endpoint no backend: `GET /api/v1/bots/rotate-link` → retorna o link do próximo bot no rodízio e incrementa o contador.
- Esse endpoint gera um redirect HTTP 302 para `https://t.me/<bot_username>`.
- Igor coloca a URL do endpoint no botão do portal → cada clique vai pro próximo bot.
- Alternativa mais simples: encurtador de URL com round-robin (ex: link.rotativo.cinevision.com.br) apontando para o endpoint acima.

**Prioridade**: 🟡 média — feature de crescimento, não é urgente mas impacta a estratégia de captura de leads.

---

## N30 — Painel de usuários por bot (contagem individual + total deduplicado)
**Origem**: vídeo `2.10.36 AM` 06/06

**Reportado**: No painel admin atual, aparece "97 pessoas" no bot — Igor não sabe se é o total de todos os bots ou só do "Cinevision Brasil Bot". Ele quer ver:

1. **Por bot**: quantas pessoas iniciaram cada bot individualmente.
2. **Total geral**: soma de todos os bots (pode ter duplicatas — mesmo usuário em vários bots).
3. **Total único**: deduplicado por Telegram ID — quantas pessoas únicas em todos os bots.
4. **Detalhe por usuário**: filtrar por ID do Telegram e ver em quais bots aquele usuário está.

Igor: *"Seria legal se desse pra dividir. Pra mim saber cada bot, quantas pessoas tem em cada bot. Quantas iniciaram em cada bot... E ter a soma geral... E um que elimina, no caso, o mesmo ID que entrou em vários bots."*

**Fix necessário**:
- No painel de Bots (`/admin/bots`): adicionar seção de estatísticas de usuários:
  - Card por bot com `started_users_count`.
  - Card "Total geral" (SUM de todos os bots).
  - Card "Usuários únicos" (COUNT DISTINCT de telegram_id em todos os bots).
- Endpoint: `GET /api/v1/admin/bots/stats` → retorna array com `{ bot_id, bot_name, user_count }` + totais.
- Query Supabase: `SELECT bot_id, COUNT(*) FROM telegram_bot_users GROUP BY bot_id`.

**Prioridade**: 🟡 média — visibilidade operacional importante mas não bloqueia nada.

---

## N31 — Broadcast para todos os grupos onde o bot é admin (enviar e deletar em massa)
**Origem**: vídeo `2.12.51 AM` 06/06

**Reportado**: Igor tem muitos grupos Telegram onde bots antigos (inclusive bots já banidos) e novos são administradores. Ele quer uma ferramenta para:

1. **Selecionar uma mensagem template** (ou escrever uma nova).
2. **Enviar para TODOS os grupos** onde qualquer bot cadastrado é admin — de uma vez.
3. **Deletar uma mensagem anterior** de todos os grupos também de uma vez.

Hoje ele faz isso manualmente (2 a 3 horas de trabalho). O objetivo é "reerguer os grupos" e fazer marketing nos grupos existentes.

Igor: *"Todos os bots no caso, os que já foram banidos se possível né, os que já foram banidos e os novos, todos esses bots que estão de administrador nos grupos, eu conseguir enviar no caso... um esqueleto de mensagem aqui... para todos os grupos... E um dia eu quiser enviar uma mensagem dessa aqui novamente... apagar em todos os grupos... enviar em todos os grupos que o bot no caso tá como administrador."*

**Fix necessário**:
- Tela no painel: `/admin/broadcast-groups` (diferente do broadcast atual que é pra usuários individuais).
- Listar todos os grupos cadastrados onde algum bot é admin.
- Textarea para escrever a mensagem + preview.
- Botão "Enviar para todos os grupos" → chama endpoint que itera pelos grupos e manda a mensagem via API do Telegram.
- Lista de "Mensagens enviadas" com botão "Apagar de todos os grupos" por mensagem.
- Para bots banidos: ignorar (bot banido não consegue enviar), mas registrar no log.

**Relacionado a**: módulo `broadcast` já existente — porém o atual é para usuários, não grupos.

**Prioridade**: 🟠 alta — Igor está fazendo isso manualmente, 2-3h por vez. É a principal estratégia de reengajamento.

---

## Transcrições brutas (referência)

### `WhatsApp Video 2026-06-05 at 6.34.13 PM.mp4`
> Opa, Eduardo, beleza? Só pra você entender, olha, eu vou clicar aqui em comprar esse filme, né, no Telegram. Só que o que que acontece, olha, ele tá fazendo a rotação. Ele não tá identificando que eu tô aqui pelo bot 2. Esse primeiro aqui, ele identificou que eu tava nele, ele enviou o Pix aqui, mas só o Copicola. Só que o que que acontece? A outra informação que era parte de QR Code, a informação do filme, ele enviou no bot 1, entendeu? Então, tipo assim, ele tá fazendo a rotação, mas essa pessoa iniciou nesse bot. Ele teria que gerar o Pix, as coisas nesse bot aqui, entendeu? Aí ele tá encaminhando pra outro, abrindo outro bot, entendeu? Ele tá fazendo a rotação, mas ele tá tipo assim, não tá executando a mesma tarefa no mesmo bot, entendeu?

### `WhatsApp Ptt 2026-06-05 at 6.39.23 PM.ogg`
> Eu entrei no bot no que caiu, né, pra ver se era esse secretar mode aí, se tava ativo. E ele tava ativo, entendeu? Será que não mudou apenas o nome? Ou realmente não tem nada a ver?

### `WhatsApp Video 2026-06-05 at 7.21.50 PM.mp4`
> Eduardo, boa noite, vamos lá. Eu estou criando agora um portal novo aqui, né? Geralmente muitas pessoas chegam aqui nesse portal. Eu estou criando dois botões: "solicitar entrada" e "acessar conteúdos". Vou criar um grupo privado, o único que vai ficar público vai ser os portais. Aqui nesse segundo botão, eu vou dar um entry. Olha, eu criei dois botões, no caso o solicitar entrada no grupo e acessar conteúdos. Se acessar conteúdos, eu coloquei o link do site. A pessoa entrando aqui, ela vai entrar aqui no site, só que ela vai escolher um conteúdo, se ela comprar, ela vai cair em um bot rotativo. Só que se ela não comprar, eu também não fico com o ID dela salvo no bot, se um dia eu quiser fazer um marketing. Então, pensando por esse lado, colocar o login do site aqui, já não é tão vantajoso assim. Então, se eu colocar um link de um bot aqui, o fluxo de pessoas vai ficar focado em um bot só, e não rotativo. O que você acha que dá pra fazer nessa questão aqui do portal?

### `WhatsApp Ptt 2026-06-05 at 7.22.40 PM.ogg`
> Sobre esse último vídeo, o que você acha que dá pra fazer? Dá pra ter algum link mutativo? Tipo, eu sei que tem aqueles encurtadores de link, tipo assim, na hora que a pessoa clicar vai escolher um dos cinco links do bot pra startar. Tem alguma coisa que dá pra fazer nesse sentido? Ou realmente tipo assim, a próxima pessoa que entrar entra no grupo 1, a próxima depois entra no 2, a próxima entra no 3, que eu acho que seria o ideal, né? Fazer escalonada desse jeito pra sempre ficar dividido com o tanto de público certo em cada grupo.

### `WhatsApp Video 2026-06-05 at 8.18.42 PM.mp4`
> Eduardo, vamos lá, um teste que eu estava efetuando aqui em uma conta secundária minha do Telegram. Vamos supor, Backrooms, vou clicar no filme, vou clicar em comprar. Ele me redireciona pro bot 2. Eu entrei pelo bot 1, ele me encaminhou pro bot 2 e gerou a compra no bot 2. Até aí, tudo ok. O bom é que ele fica jogando as pessoas pra todos os bots. Se essa pessoa entrar pra comprar 5 filmes, possivelmente vai chegar o momento que ela vai estar no 5 bot. Então se chegar a cair um dos bots, ainda vou ter acesso a essa pessoa em outro bot. Eu acredito que seja uma ideia super legal. Só que aí o que acontece? Eu clico aqui em Pix. Ele gerou o Pix aqui no bot 2. Vou cancelar aqui novamente só pra gente efetuar o teste de novo. Aqui, obsessão, vou clicar em comprar. Olha lá, ele me mandou pro bot 5. Vou clicar em Iniciar. Start, ele vai gerar o Pix. Gerou QR Code. Gerou nesse mesmo bot. Cara, se continuar tem que continuar dessa mesma forma. Antes eu testei isso e ele tinha gerado o Pix em outro bot. Se continuar desse jeito aqui, show. Porque aí a pessoa se entrou mais de uma vez ela sempre, todo mundo vai estar nos 5 bots. Eu acho que isso daí é o ideal acontecer. Então aí acaba, talvez não perdemos o público todo. Mas desse jeito aqui achei genial.

### `WhatsApp Video 2026-06-06 at 1.28.02 AM.mp4`
> Boa noite Eduardo, beleza? Desculpa o horário. Vamos lá. Eu tô aqui nas compras Orphans, enviando as compras Orphans. O que acontece? O bot das compras Orphans não tá fazendo aquele rodízio, sabe? Que no caso, cada link aqui, eu acho que deveria alternar, né? Um em cada compra que for chegando, ela vai alternando em um bot diferente. No caso todos estão indo pro Cinevision Brasil. Você puder verificar isso depois pra mim. No caso, que as próximas compras pra ir alternando de bot em bot. Beleza?

### `WhatsApp Video 2026-06-06 at 2.10.36 AM.mp4`
> Boa noite Eduardo, beleza? No bot, esse daqui, Cinevision Brasil Bot, já conta com 97 pessoas, né? Eu acredito que deve ser só no Cinevision Brasil Bot. O que eu pensei que dava pra gente fazer? Aqui no caso, colocar um geral, né? De todos os bots. E aparecer no caso todos os bots que foram cadastrados. E quantos usuários iniciaram cada bot daqueles. No caso, detalhado de cada bot. E um aqui em cima, no caso, seria o geral. Quantas pessoas em todos os bots, entendeu? E esse progresso de migração aqui, legal. Aí no caso, tipo assim, só separar por bots, né? Pra ver quantas pessoas iniciaram cada bot. Eu não sei se esse 97 é o total realmente, ou é só o que iniciou o Cinevision Brasil Bot, né? Mas, tipo assim, seria legal se desse pra dividir. Pra mim saber cada bot, quantas pessoas tem em cada bot. Quantas iniciaram em cada bot, né? E ter a soma geral, quantas pessoas tem em todos os bots. E também, no geral mesmo, filtrar por ID. Porque tipo assim, se é o meu ID, eu iniciei os cinco bots. Aparecer que eu entrei nos cinco bots, tipo, contei em todos. Só que também tem a contagem que elimina, no caso, o mesmo ID que entrou em vários bots, entendeu? No caso, não sei se tem como fazer essa separação.

### `WhatsApp Video 2026-06-06 at 2.12.51 AM.mp4`
> Eduardo outra coisa no caso eu tô aqui no Telegram né, isso daqui é uma mensagem que eu fiz encaminhando nos grupos que eu já tinha no caso nos grupos que as pessoas já comprou de filme, nos grupos que eu já tenho, que eu tenho muitos grupos sabe. Então tipo assim, tem boa quantidade de pessoas. Eu queria ver se seria possível que eu sei que tem alguns bots que fazem isso, eu sei que tipo assim, todos os bots, no caso os que já foi banido se possível né, os que já foi banido e os novos, todos esses bots que estão de administrador nos grupos, eu conseguir enviar no caso, exemplo, esse esqueleto de mensagem aqui, tipo escolher o esqueleto para encaminhar, no caso para todos os grupos. Se olhar aqui, eu enviei para vários grupos que eu tenho. Tipo assim, eu adicionar isso em todos os grupos, e um dia eu quiser enviar uma mensagem dessa aqui novamente, um exemplo, eu apaguei essa mensagem, apagar em todos os grupos. Eu enviei essa mensagem, enviar em todos os grupos que o bot no caso tá como administrador. Tem como fazer isso? É muito complexo para fazer ou é rápido? Se for possível claro, se tiver como adicionar essa questão, essa funcionalidade. Porque tipo assim, eu fiz tudo manual, é tipo, acaba demorando ali umas duas, três horas para me fazer isso tudo manual, sabe? Então se tivesse como fazer isso automático, ele iria te agradecer bastante.

---

## Resumo executivo

| # | Item | Prioridade |
|---|------|------------|
| **N24** | IA informa errado que filme não tem dublado (tem!) | 🔴 crítica |
| **N25** | Popup WhatsApp: toggle on/off + editar link pelo painel ADM | 🟠 alta |
| **N26** | Backdrop/OG image não aparece no Twitter para filmes antigos | 🟡 média |
| **N27** | Rotação de bots: PIX em bot errado (verificar se ainda ocorre) | 🟠 alta (se ativo) |
| **N28** | Compras Órfãs não rotacionam entre bots (todas no CineVision Brasil) | 🟠 alta |
| **N29** | Link rotativo round-robin para portal Telegram | 🟡 média |
| **N30** | Painel: usuários por bot + total geral + total único deduplicado | 🟡 média |
| **N31** | Broadcast para grupos (enviar e deletar mensagem em todos os grupos admin) | 🟠 alta |

**Ordem sugerida:**
1. **N24** — IA mentindo pro cliente sobre dublagem → perda de venda imediata.
2. **N25** — Popup WhatsApp: Igor ficou sem controle quando número caiu.
3. **N28** — Orphan orders todas no mesmo bot → risco de ban concentrado.
4. **N31** — Broadcast em grupos → principal ferramenta de reengajamento que Igor está esperando.
5. **N27** — Confirmar se bug do PIX em bot errado ainda ocorre.
6. **N26** — OG images Twitter.
7. **N30** — Dashboard de usuários por bot.
8. **N29** — Link rotativo portal.
