# ESCOPO DE MELHORIAS — CINE VISION

**Valor total:** R$1.000,00
**Pagamento:** 50/50 — R$500 no início + R$500 na entrega final
**Prazo total:** 7 a 10 dias (com entregas separadas por prioridade)

---

## PRIORIDADE 1 — Carrinho

- Botão "Adicionar ao carrinho" na página de detalhes de cada filme/série, junto com o botão de compra direta
- Ícone de carrinho (bolinha) no canto da tela, acompanhando a navegação entre páginas
- Página do carrinho com listagem dos itens, valores e total
- Barrinha de progresso estilo Mercado Livre mostrando quanto falta pro próximo nível de desconto
- Faixas de desconto progressivas e configuráveis pelo painel ADM (ex: 3 itens → 10%, 5 itens → 25%)
- Mensagem de incentivo na página de cada filme informando sobre o desconto
- Pop-up ao finalizar compra com menos itens que a primeira faixa, incentivando a adicionar mais
- Se não quiser, fecha o pop-up e finaliza normalmente
- Pagamento único via PIX para todos os itens do carrinho
- Botão de adicionar ao carrinho direto na listagem de busca (ex: pesquisou "Harry Potter", cada resultado já tem o botãozinho de carrinho pra adicionar sem precisar entrar no filme)

## PRIORIDADE 2 — IA de Atendimento (Telegram + WhatsApp)

- IA integrada ao privado do Telegram, respondendo clientes de forma humanizada como se fosse o Igor
- Conhece todo o catálogo do site (títulos, valores, disponibilidade)
- Conversa naturalmente, apresenta o conteúdo e envia link de pagamento
- Detecta o pagamento e envia instruções de como assistir
- O Igor pode intervir e assumir a conversa a qualquer momento
- Preparada para funcionar também no WhatsApp quando quiser ativar futuramente
- Treinamento da IA com o jeito de falar do Igor (gírias, tom, forma de apresentar os filmes)
- IA treinada pra responder dúvidas comuns dos clientes (como baixar Telegram, como espelhar na TV, etc.)
- Quando o cliente pedir um conteúdo que não está no site, a IA pausa o chat, avisa o cliente que vai verificar a disponibilidade e envia notificação pro Igor assumir manualmente

## PRIORIDADE 3 — Recuperação de Vendas + Antiabuso

- Monitoramento automático de PIX gerados e não pagos
- Após tempo configurável (ex: 3 a 5 min), disparo automático de oferta com desconto
- Geração de novo PIX com valor já com desconto, vinculado à compra original
- Tratamento para não gerar conflito caso o cliente pague o PIX antigo
- O desconto de recuperação só é oferecido para compras de até 2 itens no carrinho (sem desconto do carrinho)
- Se o cliente já está com desconto do carrinho (3+ itens), não oferece desconto adicional de recuperação
- Controle antiabuso: identifica se o cliente sempre espera o desconto
- Bloqueio por usuário: desconto de recuperação disponível apenas a cada 48h por usuário
- Histórico de ofertas enviadas disponível no painel ADM

## DEMAIS ITENS

### Tela inicial com animação
Logo do Cine Vision com efeito de aproximação + som sincronizado, otimizado pra não pesar o site

### Liberação manual de conteúdo
Opção no painel ADM para liberar conteúdo manualmente por ID ou nome do usuário

### Limpeza do chat do bot
Bot apaga mensagens anteriores conforme o usuário avança nas etapas, mantendo apenas a mensagem atual e o "/start para iniciar novamente"

### Correção de sessão/login do painel ADM
- Corrigir expiração prematura da sessão no painel administrativo
- Renovação automática do token enquanto o usuário estiver ativo
- Aviso claro caso a sessão expire, pedindo pra logar novamente
- Bloquear ações no painel se estiver deslogado, evitando perda de dados

### Sistema de login para funcionários
- Login separado para funcionários com painel próprio
- Administrador master (Igor) cria o acesso pelo painel ADM principal
- Define o que cada funcionário pode ver e fazer (ex: um só adiciona filmes, outro só séries)
- Funcionário só vê e edita conteúdos que ele mesmo adicionou (por padrão)
- Igor pode habilitar permissão pra editar conteúdos de outros funcionários ou do próprio Igor
- Após 5 horas da adição, funcionário perde o acesso de edição daquele conteúdo automaticamente
- Limite diário de adições configurável por funcionário (ex: máximo 50 por dia). Ao atingir, o sistema bloqueia e avisa
- Funcionário não vê: usuários do site, vendas, compras, Top 10, descontos, usuários online — a menos que Igor libere
- Fiscalização de links do Telegram: Igor visualiza os links que cada funcionário adicionou com prévia mostrando pra onde redireciona, garantindo que aponta pro grupo correto
- Acompanhamento de produtividade: quantidade de filmes/séries adicionados nos últimos 7, 15 e 30 dias
- Métricas visíveis tanto no painel do funcionário quanto no painel do administrador

---

## CUSTOS RECORRENTES (à parte do desenvolvimento)

- **Telegram:** R$30 a R$200/mês dependendo do volume de conversas (só o custo da IA)
- **WhatsApp:** custo da IA + API do WhatsApp Business (~R$80-150/mês pro volume atual de ~30-50 mensagens/dia)
