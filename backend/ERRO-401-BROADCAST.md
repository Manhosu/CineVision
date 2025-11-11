# 🚨 Erro 401 (Unauthorized) na Página de Broadcast

## Problema Reportado

Ao acessar `/admin/broadcast`, os seguintes erros 401 aparecem:

```
GET /api/v1/admin/broadcast/users-count → 401 Unauthorized
GET /api/v1/admin/broadcast/history?limit=10 → 401 Unauthorized
```

---

## ✅ Diagnóstico Realizado

### 1. Backend está Correto
- ✅ Controller `BroadcastController` está configurado corretamente
- ✅ Guards de autenticação aplicados: `JwtAuthGuard` e `RolesGuard`
- ✅ Requer role `ADMIN` conforme esperado
- ✅ Endpoints funcionam corretamente com token válido

### 2. Frontend está Enviando Token
- ✅ Código busca token do `localStorage`
- ✅ Token é enviado no header `Authorization: Bearer <token>`
- ✅ Fallback entre `access_token` e `auth_token`

### 3. Usuário Admin Existe
- ✅ Email: `admin@cinevision.com`
- ✅ ID: `84dca2a4-02cd-4dfa-a7df-6f2afcb26027`
- ✅ Role: `admin`
- ✅ Telegram ID: `2006803983`

---

## 🔍 Causas Possíveis do Erro 401

### Causa 1: Token Expirado ⚠️ (MAIS PROVÁVEL)
**Sintoma:** Token JWT expirou
**Como verificar:**
1. Abrir Console do navegador (F12 → Console)
2. Executar: `localStorage.getItem('access_token')`
3. Copiar o token
4. Executar: `node backend/verificar-token-jwt.js "TOKEN_AQUI"`

**Solução:**
- Fazer logout e login novamente
- Isso gerará novo token válido

### Causa 2: Usuário Logado não é Admin ⚠️
**Sintoma:** Usuário está logado mas não tem role `admin`
**Como verificar:**
1. No Console: `JSON.parse(localStorage.getItem('user'))`
2. Verificar campo `role`

**Solução:**
- Fazer logout
- Fazer login com a conta `admin@cinevision.com`

### Causa 3: Token não Existe
**Sintoma:** `localStorage.getItem('access_token')` retorna `null`
**Como verificar:**
1. Console: `localStorage.getItem('access_token')`
2. Console: `localStorage.getItem('auth_token')`

**Solução:**
- Fazer login na plataforma

### Causa 4: Token Corrompido
**Sintoma:** Token existe mas está malformado
**Como verificar:**
- Executar: `node backend/verificar-token-jwt.js "TOKEN"`
- Se der erro de decodificação → token corrompido

**Solução:**
- Limpar localStorage: `localStorage.clear()`
- Fazer login novamente

---

## 🛠️ Passo a Passo para Resolver

### Opção 1: Logout e Login (Recomendado)

1. **Fazer Logout:**
   - Clicar em "Sair" na dashboard

2. **Fazer Login como Admin:**
   - Ir para `/admin/login`
   - Email: `admin@cinevision.com`
   - Senha: [sua senha admin]

3. **Acessar Broadcast:**
   - Ir para `/admin/broadcast`
   - Deve funcionar agora ✅

### Opção 2: Limpar Cache e Login

1. **Abrir Console (F12 → Console)**

2. **Limpar localStorage:**
   ```javascript
   localStorage.clear()
   ```

3. **Recarregar página:**
   ```javascript
   location.reload()
   ```

4. **Fazer login novamente como admin**

### Opção 3: Verificar e Diagnosticar

1. **Verificar token atual:**
   ```javascript
   // No Console do navegador
   const token = localStorage.getItem('access_token');
   console.log('Token:', token ? 'Existe' : 'Não existe');

   const user = JSON.parse(localStorage.getItem('user') || '{}');
   console.log('Usuário:', user);
   console.log('Role:', user.role);
   ```

2. **Se token existe, verificar se é válido:**
   ```bash
   # No terminal
   cd backend
   node verificar-token-jwt.js "COLAR_TOKEN_AQUI"
   ```

3. **Verificar resposta:**
   - Se expirado → Fazer logout e login
   - Se role não é admin → Fazer login com conta admin
   - Se malformado → Limpar localStorage e fazer login

---

## 📋 Scripts de Diagnóstico

### 1. Verificar Usuários Admin
```bash
cd backend
node verificar-usuario-admin.js
```

**Resultado esperado:**
- Lista todos os usuários admin no banco
- Mostra email, ID, role e telegram_id

### 2. Verificar Token JWT
```bash
cd backend
node verificar-token-jwt.js "TOKEN"
```

**Resultado esperado:**
- Decodifica o token
- Mostra payload (user_id, email, role)
- Verifica se está expirado
- Valida se role é `admin`

---

## 🔧 Como Criar Novo Usuário Admin

Se precisar criar um novo usuário admin:

1. **Fazer login como usuário normal**

2. **Verificar seu user_id:**
   ```bash
   cd backend
   node verificar-usuario-admin.js
   ```

3. **Criar script para promover usuário:**
   ```bash
   cd backend
   node -e "
   require('dotenv').config();
   const { createClient } = require('@supabase/supabase-js');
   const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

   const userId = process.argv[1];

   supabase.from('users')
     .update({ role: 'admin' })
     .eq('id', userId)
     .then(({ error }) => {
       if (error) console.error('Erro:', error);
       else console.log('✅ Usuário promovido a admin!');
     });
   " "SEU_USER_ID_AQUI"
   ```

---

## 🎯 Resumo da Solução Rápida

**Para a maioria dos casos:**

1. Abrir `/admin/broadcast`
2. Se der erro 401 → Fazer **Logout**
3. Fazer login com `admin@cinevision.com`
4. Tentar novamente

**Se não funcionar:**

1. Abrir Console (F12)
2. Executar: `localStorage.clear()`
3. Recarregar página
4. Fazer login como admin novamente

---

## 📊 Endpoints Afetados

Todos os endpoints em `/api/v1/admin/broadcast/*` requerem:
- ✅ Token JWT válido
- ✅ Role `admin`

Lista de endpoints:
- `GET /api/v1/admin/broadcast/users-count` - Contagem de usuários
- `GET /api/v1/admin/broadcast/history` - Histórico de broadcasts
- `POST /api/v1/admin/broadcast/send` - Enviar broadcast
- `POST /api/v1/admin/broadcast/upload-image` - Upload de imagem

---

## 🔐 Segurança

O erro 401 é **ESPERADO** e **CORRETO** quando:
- Token não existe
- Token expirou
- Usuário não é admin

Isso protege os endpoints administrativos de acessos não autorizados.

---

**Criado:** 2025-01-10
**Status:** Documentado
**Prioridade:** MÉDIA (solução simples: logout/login)
