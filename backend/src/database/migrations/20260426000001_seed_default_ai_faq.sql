-- ============================================================================
-- Seed default FAQ pairs for the AI assistant.
-- Idempotent: only updates the singleton row when faq_pairs is empty/null.
-- ============================================================================

UPDATE ai_training_config
SET faq_pairs = '[
  {
    "question": "Como baixo o Telegram?",
    "answer": "Super tranquilo! É só ir na loja de apps do seu celular (Play Store no Android, App Store no iPhone), pesquisar Telegram, instalar e criar conta com seu número. Em menos de 1 minuto você já tá dentro!"
  },
  {
    "question": "Como assistir o filme na TV?",
    "answer": "Você tem 2 opções show de bola: 1) Baixa o app Telegram direto na sua smart TV (se ela tiver loja de apps); 2) Espelha do celular pra TV via Chromecast ou AirPlay. A opção 2 funciona em qualquer TV e é mais prática."
  },
  {
    "question": "Como funciona o pagamento?",
    "answer": "É 100% via PIX, super rápido. Você gera o QR Code, paga no app do banco, e em segundos eu te mando o link do filme aqui no chat. Sem cartão de crédito, sem cadastro complicado."
  },
  {
    "question": "O acesso é vitalício?",
    "answer": "Sim! Depois que você paga, o acesso ao conteúdo é seu pra sempre. Pode assistir quando quiser, quantas vezes quiser, no celular ou na TV."
  },
  {
    "question": "Posso assistir no celular?",
    "answer": "Claro! É a forma mais fácil. Depois de pagar, você acessa o filme direto no app do Telegram do seu celular. Funciona offline também depois de baixar o vídeo."
  },
  {
    "question": "Quanto tempo demora pra liberar depois do pagamento?",
    "answer": "É praticamente na hora! Em poucos segundos depois do PIX cair, você já recebe o link aqui no chat automaticamente."
  },
  {
    "question": "E se eu pagar e não receber?",
    "answer": "Relaxa que isso quase nunca acontece. Se passou mais de 5 minutos e você ainda não recebeu, me chama aqui que eu resolvo na hora!"
  }
]'::jsonb,
updated_at = CURRENT_TIMESTAMP
WHERE faq_pairs IS NULL OR faq_pairs::text = '[]' OR faq_pairs = '[]'::jsonb;
