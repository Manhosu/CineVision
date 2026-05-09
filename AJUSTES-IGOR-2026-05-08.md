# Ajustes Igor — Rodada 08/05/2026 (madrugada)

3 vídeos enviados pelo Igor entre 00:19 e 00:44, transcritos via Whisper. Continuação dos itens N1-N19 das rodadas anteriores.

---

## N20 — IA pausa o chat mas não está chamando o Igor no DM
**Origem**: vídeo `12.19.11 AM` 08/05

**Reportado**: Igor mostrou prints de conversas reais onde:
- Cliente pediu um filme inexistente ("O Exorcista 1972").
- IA respondeu "Hmm, esse título eu não tô achando aqui no momento. Vou anotar e te aviso quando entrar no catálogo!" (resposta correta do prompt N19).
- A conversa **ficou pausada** no painel admin (status: "chat pausado") ✅.
- **MAS o Igor NÃO recebeu a notificação no DM dele** ❌.

Outro caso similar: cliente enviou comprovante (print de pagamento) e bot não enxergou (esperado — IA não lê imagem) — neste caso também deveria pausar e chamar Igor.

**Diagnóstico**:
- O `<<PAUSE:content_not_found>>` está funcionando (chat pausa), mas a notificação Telegram pro Igor não está disparando para esse `pause_reason` específico.
- `notifyAdminForTakeover` em [ai-chat.service.ts](backend/src/modules/ai-chat/ai-chat.service.ts) provavelmente só dispara em `claude_failure` (timeout/rate_limit), não em `content_not_found` ou `needs_human`.
- Pode ser bug de `shouldNotifyClaudeFailure` que só checa erro do Claude, não pause_reason qualquer.

**Fix necessário**:
- Garantir que **TODOS** os `<<PAUSE:reason>>` disparem notificação pro DM do Igor (não só falha do Claude).
- Mensagem do DM deve incluir:
  - Nome/telegram_id do cliente
  - Última mensagem do cliente
  - `pause_reason` específico (`content_not_found`, `needs_human`, `payment_proof`, etc.)
  - Link de retomada `/admin/ai-chat?conversation=<id>` pra Igor abrir e responder
- Adicionar novo trigger: quando IA recebe **imagem/foto/documento** sem texto, pausa automático com `pause_reason='media_received'` + notifica.

**Comportamento esperado pelo Igor**:
> "O bot pode falar pro cliente: 'um agente vai entrar pra te atender' — aí quando eu ver a notificação eu vou lá e atendo."

Resposta sugerida da IA pra cliente quando pausa: ajustar o prompt N19 pra **adicionar frase confirmando atendimento humano**:
> "Hmm, esse título eu não tô achando aqui agora. **Já chamei alguém da equipe pra te ajudar — em instantes te respondemos** 💕"

**Prioridade**: 🔴 crítica (cliente fica sem resposta + Igor perde venda).

---

## N21 — Auto-reativar IA após chat esfriar (30min-1h sem atividade)
**Origem**: vídeo `12.19.11 AM` 08/05 (segunda parte)

**Reportado**: Igor lembrou de pedido antigo (já tinha falado, "não sei se foi feito"). Quando o chat fica frio (cliente não responde por X tempo, agente também sai), o bot deve:
1. **Re-ativar a IA** naquela conversa (estado volta de `paused` → `active`).
2. Mandar mensagem pro cliente do tipo:
   > "Digite /restart pra efetuar novas compras."
3. Inspirar o cliente a voltar pro fluxo de venda do bot em vez de ficar mandando msg avulsa.

**Status atual**:
- Não existe um cron/job que re-ative conversas pausadas. Conversas ficam pausadas indefinidamente.
- Mensagem de "digite /restart" já existe em outros fluxos do bot — pode ser reusada.

**Fix necessário**:
- Cron job a cada 5min que busca `ai_chat_conversations` com:
  - `status = 'paused'`
  - `last_message_at < NOW() - 30 minutes`
  - `pause_reason IN ('content_not_found', 'needs_human', 'manual')` (não inclui `claude_failure`/`claude_overloaded` etc.)
- Pra cada conversa: muda status pra `active`, manda mensagem padrão "Digite /restart...", reseta `last_message_at`.
- Janela configurável via `admin_settings.ai_chat_cooldown_minutes` (default: 30).
- Logar no `system_logs` cada reativação pra Igor poder auditar.

**Edge case**: se Igor já está conversando ativamente (mandou mensagem nas últimas 30min), NÃO reativar — só pula. Verificar via `last_admin_message_at` ou similar.

**Prioridade**: 🟠 alta (recupera vendas perdidas com fluxo padronizado).

---

## N22 — Painel do funcionário: card "Total de Conteúdo" está zerado
**Origem**: vídeo `12.20.18 AM` 08/05

**Reportado**: No painel admin (que o funcionário Mattheus acessa), o card **"Total de Conteúdo"** mostra **0** mesmo tendo 100+ filmes/séries no catálogo. Igor quer que o número apareça pro funcionário também — não só pro admin master.

A "Minha Produtividade" (N6 da rodada anterior, conteúdo que ESSE funcionário adicionou) está funcionando corretamente.

**Diagnóstico**:
- Card "Total de Conteúdo" hoje deve estar restrito a admins (talvez verificação `role === 'admin'` no endpoint que retorna o stat).
- Funcionário precisa ver o número global pra ter contexto do tamanho do catálogo.

**Fix necessário**:
- Auditar endpoint que retorna o stat `total_content` (provavelmente `/api/v1/admin/stats` ou similar).
- Permitir role `EMPLOYEE` + `MODERATOR` lerem (sem expor detalhes sensíveis — só o count).
- Ou expor um endpoint público `/api/v1/content/stats/count` que qualquer admin/employee pode ler.
- Frontend: card já existe na rota base do `/admin`, só precisa funcionar quando logado como funcionário.

**Prioridade**: 🟡 média (UX pro funcionário — sem urgência mas é fácil de fazer).

---

## N23 — Redesign dos badges "Novidade" / "Nova Temporada" — estilo Netflix idêntico, ABAIXO do pôster
**Origem**: vídeo `12.44.07 AM` 08/05

**Reportado**: Igor não gostou do badge que entreguei na rodada N18 (canto superior esquerdo do pôster, gradient vermelho/laranja). Ele já vinha fazendo manualmente no Photoshop um estilo idêntico ao Netflix — **legenda abaixo do pôster, fora da imagem**, ocupando a largura total do card.

**Visual do Netflix**:
- Texto "Novidade" / "Nova Temporada" em fonte pesada, branca
- Background com fundo **vermelho Netflix** (`#E50914` aproximadamente)
- Posicionamento: **logo abaixo do pôster**, antes do título do filme
- Largura: **toda a largura do card**, sem padding lateral
- Altura: ~22-28px
- Borda: nenhuma (continua visualmente o pôster)

**Visual atual (errado)**:
- Badge no canto superior esquerdo do pôster, dentro da imagem
- Gradient vermelho-rosa/laranja-âmbar
- Tamanho pequeno
- Cobre parte do pôster

**Fix necessário**:
- Em `MovieCard.tsx`: remover overlay atual, criar uma `<div>` ABAIXO da `<div>` do pôster (mas dentro do card container) com o texto.
- Estilo:
  ```tsx
  <div className="bg-[#E50914] py-1 text-center">
    <span className="text-white text-xs font-bold uppercase tracking-wide">
      {is_release ? 'Novidade' : 'Nova Temporada'}
    </span>
  </div>
  ```
- Aplicar em `MovieCard` E `Top10MovieCard`.
- Igor deixou claro: "se não tem como, prefiro **tirar** essas novidades que ficou desse jeito aqui em cima". Ou seja, **se não conseguir replicar exatamente o estilo Netflix abaixo, remover o overlay atual**.

**Prioridade**: 🟠 alta (Igor explicitamente não gostou do entregue, quer ajuste).

---

## Resumo executivo

| # | Item | Prioridade |
|---|------|------------|
| **N20** | IA pausa mas não chama Igor no DM | 🔴 crítica |
| **N21** | Auto-reativar IA após 30min sem atividade | 🟠 alta |
| **N22** | Card "Total de Conteúdo" zerado pra funcionário | 🟡 média |
| **N23** | Badge Novidade/Nova Temporada redesign Netflix-style | 🟠 alta |

**Ordem sugerida**:
1. **N20 primeiro** — venda perdida em tempo real (cliente pediu filme, IA não chamou Igor, conversa morre).
2. **N23** — Igor explicitamente reclamou do design, fix rápido.
3. **N21** — recovery automático de chats.
4. **N22** — quick win, alterar role check de 1 endpoint.
