# 🤖 Fluxo Completo do Bot do Telegram - CineVision

## 📋 Visão Geral

O bot do Telegram agora possui um fluxo completo de criação/validação de conta, compra e entrega de conteúdo.

---

## 🚀 Novo Fluxo Implementado

### **1. Comando /start**

```
Usuário: /start

Bot: 🎬 Bem-vindo ao CineVision Bot!

Aqui você pode:
• 🛒 Comprar filmes
• 📱 Assistir online ou baixar
• 💾 Receber filmes no Telegram
• 🔔 Notificações de lançamentos

Use /catalogo para ver os filmes disponíveis!

[Botões]
🎬 Ver Catálogo
📱 Minhas Compras
❓ Ajuda
```

---

### **2. Fluxo de Compra**

#### **2.1. Usuário clica em "Comprar"**

```
Bot: 🎬 [Nome do Filme]

💰 R$ [Preço]

Você possui uma conta no CineVision?

[Botões]
✅ Sim, tenho conta
📝 Criar conta agora
🚫 Comprar sem conta
🔙 Voltar ao catálogo
```

---

### **3. Cenário A: Usuário TEM CONTA**

#### **3.1. Clica "Sim, tenho conta"**

```
Bot: ✉️ Por favor, digite seu e-mail cadastrado:

Usuário: meuemail@exemplo.com

Bot: [Validando...]

✅ E-mail encontrado! Vinculando compra à sua conta...
🔐 Gerando link de pagamento...

💳 Link de Pagamento

✅ Compra vinculada à conta meuemail@exemplo.com.
Após o pagamento, o filme aparecerá em "Meus Filmes"
no site e você receberá o link aqui no Telegram.

[Botão]
💳 Pagar Agora
```

#### **3.2. Após pagamento confirmado:**

```
Bot: 🎉 Pagamento Confirmado!

✅ Sua compra de "[Nome do Filme]" foi aprovada!
💰 Valor: R$ [Preço]

🌐 O filme foi adicionado ao seu dashboard!
Acesse em: https://cinevision.com/dashboard

📺 Escolha o idioma para assistir:

🎬 2 idioma(s) disponível(is):

[Botões]
🎙️ Dublado - Português (Brasil)
📝 Legendado - Português (Brasil)
🌐 Ver no Dashboard
```

---

### **4. Cenário B: Usuário QUER CRIAR CONTA**

#### **4.1. Clica "Criar conta agora"**

```
Bot: 📝 Criação de Conta

Vamos criar sua conta em 3 passos simples:

1️⃣ Nome completo
2️⃣ E-mail
3️⃣ Senha

👤 Digite seu nome completo:
```

#### **4.2. Passo 1: Nome**

```
Usuário: João Silva

Bot: ✅ Nome: João Silva

📧 Agora digite seu e-mail:
```

#### **4.3. Passo 2: Email**

```
Usuário: joao@exemplo.com

Bot: [Validando email...]

✅ E-mail: joao@exemplo.com

🔐 Agora crie uma senha (mínimo 6 caracteres):
```

**Validações:**
- ✅ Formato válido (regex)
- ✅ Email não cadastrado anteriormente
- ❌ Se email já existe: "Este e-mail já está cadastrado! Use a opção 'Sim, tenho conta'"

#### **4.4. Passo 3: Senha**

```
Usuário: minhasenha123

Bot: ⏳ Criando sua conta...

🎉 Conta criada com sucesso!

👤 Nome: João Silva
📧 E-mail: joao@exemplo.com

✅ Sua conta foi vinculada ao Telegram!

🔐 Gerando link de pagamento...

💳 Link de Pagamento

[Botão]
💳 Pagar Agora
🎬 Ver Catálogo
```

#### **4.5. Após pagamento:**

```
Bot: 🎉 Pagamento Confirmado!

✅ Sua compra de "[Nome do Filme]" foi aprovada!
💰 Valor: R$ [Preço]

🌐 O filme foi adicionado ao seu dashboard!
Acesse em: https://cinevision.com/dashboard

📺 Escolha o idioma para assistir:

🎬 2 idioma(s) disponível(is):

[Botões]
🎙️ Dublado - Português (Brasil)
📝 Legendado - Português (Brasil)
🌐 Ver no Dashboard
```

---

### **5. Cenário C: Compra SEM CONTA (Anônima)**

#### **5.1. Clica "Comprar sem conta"**

```
Bot: 🔐 Gerando link de pagamento...

💳 Pagamento Anônimo

Compra sem cadastro. Após o pagamento, você receberá
o filme diretamente aqui no chat. Os dados não serão
salvos no sistema.

💰 Valor: R$ [Preço]

[Botão]
💳 Pagar Agora
```

#### **5.2. Após pagamento:**

```
Bot: 🎉 Pagamento Confirmado!

✅ Sua compra de "[Nome do Filme]" foi aprovada!
💰 Valor: R$ [Preço]

📱 Compra sem conta: Vídeos disponíveis apenas neste chat.

📺 Escolha o idioma para assistir:

🎬 2 idioma(s) disponível(is):

[Botões]
🎙️ Dublado - Português (Brasil)
📝 Legendado - Português (Brasil)
```

**Diferença:** Não tem botão "Ver no Dashboard" e não salva no banco vinculado ao usuário.

---

## 🎬 Assistir Vídeo

### **Quando usuário clica em um idioma:**

```
Bot: ⏳ Gerando link de acesso...

🎬 [Nome do Filme]

Português (Brasil) - Dublado

📊 Tamanho: 1.87 GB
⏱️ Link válido por: 4 horas

💡 Como assistir:
• Clique no botão abaixo
• O vídeo abrirá no navegador
• Você pode assistir online ou baixar

⚠️ Importante:
• Link expira em 4 horas
• Você pode solicitar novo link a qualquer momento

[Botões]
▶️ Assistir Agora
🔄 Gerar Novo Link
🔙 Minhas Compras
```

---

## 📊 Comparação: COM vs SEM Conta

| Aspecto | COM Conta | SEM Conta |
|---------|-----------|-----------|
| **Criação de Conta** | ✅ Cria conta no sistema | ❌ Não cria |
| **Dashboard Web** | ✅ Filme aparece em "Meus Filmes" | ❌ Não aparece |
| **Telegram** | ✅ Recebe links no chat | ✅ Recebe links no chat |
| **Múltiplos Idiomas** | ✅ Todos disponíveis | ✅ Todos disponíveis |
| **Persistência** | ✅ Filme fica na conta para sempre | ❌ Apenas no chat |
| **Login no Site** | ✅ Pode fazer login e assistir | ❌ Não pode |
| **Banco de Dados** | ✅ `user_id` vinculado | ❌ `user_id = null` |

---

## 🔐 Segurança

### **Senha:**
- ✅ Hashed com `bcrypt` (12 rounds)
- ✅ Nunca armazenada em texto plano
- ✅ Nunca enviada em logs

### **Telegram:**
- ✅ `telegram_id` vinculado ao usuário
- ✅ `telegram_chat_id` salvo para notificações
- ✅ Links presigned do S3 (expiram em 4 horas)

---

## 🗄️ Banco de Dados

### **Tabela `users`:**

```sql
INSERT INTO users (
  name,
  email,
  password,
  telegram_id,
  telegram_chat_id,
  telegram_username,
  role,
  status
) VALUES (
  'João Silva',
  'joao@exemplo.com',
  '$2b$12$...', -- hashed
  '123456789', -- Telegram user ID
  '987654321', -- Chat ID
  'João Silva',
  'user',
  'active'
);
```

### **Tabela `purchases`:**

**COM Conta:**
```sql
INSERT INTO purchases (
  user_id, -- ✅ PREENCHIDO
  content_id,
  amount_cents,
  status,
  provider_meta
) VALUES (
  'uuid-do-usuario', -- ✅
  'uuid-do-filme',
  1990,
  'paid',
  '{"telegram_chat_id": "987654321"}'
);
```

**SEM Conta:**
```sql
INSERT INTO purchases (
  user_id, -- ❌ NULL
  content_id,
  amount_cents,
  status,
  provider_meta
) VALUES (
  NULL, -- ❌ Compra anônima
  'uuid-do-filme',
  1990,
  'paid',
  '{"telegram_user_id": "123456789", "telegram_chat_id": "987654321", "anonymous_purchase": true}'
);
```

---

## 🎯 Casos de Uso

### **Caso 1: Usuário novo que quer criar conta**
```
1. /start
2. Clica "Ver Catálogo"
3. Clica "Comprar" em um filme
4. Clica "Criar conta agora"
5. Digita nome, email, senha
6. Conta criada automaticamente
7. Link de pagamento gerado
8. Paga
9. Recebe filme no Telegram + Dashboard
```

### **Caso 2: Usuário existente no site**
```
1. /start
2. Clica "Ver Catálogo"
3. Clica "Comprar"
4. Clica "Sim, tenho conta"
5. Digita email cadastrado
6. Email validado ✅
7. Link de pagamento gerado
8. Paga
9. Recebe filme no Telegram + Dashboard
```

### **Caso 3: Usuário que só quer Telegram**
```
1. /start
2. Clica "Ver Catálogo"
3. Clica "Comprar"
4. Clica "Comprar sem conta"
5. Link de pagamento gerado
6. Paga
7. Recebe filme APENAS no Telegram (não salva no sistema)
```

---

## 📝 Validações Implementadas

### **Nome:**
- ✅ Mínimo 3 caracteres
- ✅ Remove espaços extras (trim)

### **Email:**
- ✅ Formato válido (regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
- ✅ Verifica se já existe no banco
- ✅ Case insensitive

### **Senha:**
- ✅ Mínimo 6 caracteres
- ✅ Hash com bcrypt (12 rounds)
- ✅ Nunca logada ou exposta

---

## 🔄 Fluxo de Entrega Múltiplos Idiomas

### **Quando pagamento é confirmado:**

```typescript
// Backend automaticamente:
1. Busca o filme (content)
2. Busca TODOS os content_languages vinculados
3. Filtra apenas os ativos com video_storage_key
4. Cria botões para CADA idioma
5. Envia mensagem com TODOS os botões
6. Se compra COM conta: Adiciona botão "Ver no Dashboard"
```

**Exemplo - Filme com 2 idiomas:**
```
🎬 2 idioma(s) disponível(is):

[Botões]
🎙️ Dublado - Português (Brasil)
📝 Legendado - Português (Brasil)
🌐 Ver no Dashboard  // Só se tiver conta
```

**Exemplo - Filme com 3 idiomas:**
```
🎬 3 idioma(s) disponível(is):

[Botões]
🎙️ Dublado - Português (Brasil)
📝 Legendado - Português (Brasil)
🎬 Original - English (US)
🌐 Ver no Dashboard  // Só se tiver conta
```

---

## ⚡ Performance

### **Cache de Registros:**
- ✅ `pendingRegistrations` - Armazena estado do fluxo de criação
- ✅ `emailVerifications` - Armazena aguardo de email
- ✅ `pendingPurchases` - Armazena compras pendentes

**Nota:** Em produção, migrar para Redis.

---

## 🐛 Tratamento de Erros

### **Email já cadastrado:**
```
❌ Este e-mail já está cadastrado!
Use a opção "Sim, tenho conta" ou tente outro e-mail.
```

### **Email não encontrado:**
```
❌ E-mail não encontrado no sistema.
Deseja comprar sem cadastro?

[Botões]
✅ Sim, comprar sem cadastro
🔙 Voltar
```

### **Senha muito curta:**
```
❌ Senha muito curta.
Digite uma senha com pelo menos 6 caracteres:
```

### **Vídeo não disponível:**
```
❌ Vídeo não disponível.
Entre em contato com suporte.
```

---

## 🎯 Resumo Técnico

### **Arquivos Modificados:**
1. ✅ `telegrams-enhanced.service.ts` - Lógica principal do bot
2. ✅ `telegrams.module.ts` - Importação do UsersModule

### **Novas Interfaces:**
```typescript
interface PendingRegistration {
  chat_id: number;
  telegram_user_id: number;
  content_id?: string;
  step: 'name' | 'email' | 'password';
  data: {
    name?: string;
    email?: string;
    password?: string;
  };
  timestamp: number;
}
```

### **Novos Métodos:**
- ✅ `handleRegistrationStep()` - Processa cada etapa do registro
- ✅ `handleHasAccountCallback()` - Quando usuário tem conta
- ✅ `handleCreateAccountCallback()` - Inicia criação de conta
- ✅ `deliverContentAfterPayment()` - **ATUALIZADO** para enviar todos os idiomas

### **Callbacks Adicionados:**
- ✅ `has_account_{contentId}` - Solicita email
- ✅ `create_account_{contentId}` - Inicia registro
- ✅ `watch_{purchaseId}_{languageId}` - Gera link do vídeo

---

## ✅ Checklist Final

- [x] Comando `/start` atualizado
- [x] Fluxo "Sim, tenho conta" implementado
- [x] Fluxo "Criar conta agora" implementado (3 passos)
- [x] Fluxo "Comprar sem conta" implementado
- [x] Validação de email existente
- [x] Criação de usuário no banco
- [x] Hash de senha com bcrypt
- [x] Vinculação `telegram_id` e `telegram_chat_id`
- [x] Compra vinculada ao `user_id` (com conta)
- [x] Compra anônima (`user_id = null`)
- [x] Entrega no Dashboard (com conta)
- [x] Entrega no Telegram (ambos casos)
- [x] Envio de TODOS os idiomas disponíveis
- [x] Links presigned do S3 (4 horas)
- [x] Tratamento de erros

---

## 🚀 Como Testar

### **1. Testar criação de conta:**
```
1. /start
2. Ver Catálogo
3. Comprar filme
4. "Criar conta agora"
5. Digite nome, email novo, senha
6. ✅ Conta criada
7. ✅ Telegram vinculado
8. ✅ Pode fazer login no site
```

### **2. Testar vinculação conta existente:**
```
1. Criar conta no site: https://cinevision.com/signup
2. /start no bot
3. Comprar filme
4. "Sim, tenho conta"
5. Digite email cadastrado
6. ✅ Telegram vinculado
7. ✅ Filme aparece no dashboard
```

### **3. Testar compra anônima:**
```
1. /start
2. Comprar filme
3. "Comprar sem conta"
4. Pagar
5. ✅ Recebe filme no Telegram
6. ❌ Não aparece no site
```

---

## 🎬 Resultado Final

**Agora o bot está 100% funcional com:**

1. ✅ Criação de conta via Telegram (3 passos)
2. ✅ Validação de email existente
3. ✅ Compra COM conta → Dashboard + Telegram
4. ✅ Compra SEM conta → Apenas Telegram
5. ✅ Entrega de TODOS os idiomas (dublado, legendado, etc.)
6. ✅ Links presigned do S3 (seguro, expira em 4h)
7. ✅ Telegram vinculado automaticamente
8. ✅ Sistema completo de ponta a ponta

**Experiência do usuário:** ⭐⭐⭐⭐⭐
