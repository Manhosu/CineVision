# 🧪 Guia de Teste - Endpoint de Broadcast

## ✅ Status do Deploy

**Deploy ID**: `dep-d41euc63jp1c73c6ar5g`
**Status**: ✅ **LIVE** (desde 04:55:08)
**Endpoint**: https://cinevisionn.onrender.com

---

## 🔍 Verificação do Endpoint

✅ **Endpoint está FUNCIONANDO!**

Teste realizado:
```bash
curl -X POST https://cinevisionn.onrender.com/api/v1/admin/broadcast/upload-image
```

**Resposta**: `401 Unauthorized` (correto! endpoint existe e está protegido)

---

## 📝 Como Testar

### 1. Limpe o Cache do Navegador
```
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

Ou abra em aba anônima.

### 2. Faça Login como Admin
1. Acesse: https://cine-vision-murex.vercel.app/admin/login
2. Use suas credenciais de admin

### 3. Acesse a Página de Marketing
https://cine-vision-murex.vercel.app/admin/broadcast

### 4. Teste o Upload de Imagem

**Preencha:**
- **Telegram IDs**: `5212925997, 1134910998` (IDs válidos do teste)
- **Mensagem**: Qualquer texto teste
- **Imagem**: Anexe uma imagem PNG/JPG (máx 5MB)

**Clique em**: "Enviar Marketing"

---

## ⚠️ Se Ainda Der Erro 404

### Opção 1: Verificar Token
Abra DevTools (F12) → Console → Execute:
```javascript
console.log('Token:', localStorage.getItem('access_token'));
```

Se não aparecer ou for `null`:
1. Faça logout
2. Faça login novamente
3. Tente novamente

### Opção 2: Hard Refresh
```
Ctrl + Shift + Delete → Limpar Cache
```

### Opção 3: Verificar URL da API
No DevTools → Network → Veja a requisição que falhou:
- URL deve ser: `https://cinevisionn.onrender.com/api/v1/admin/broadcast/upload-image`
- Método: POST
- Headers: Authorization: Bearer {token}

---

## 🐛 Debug no Console

Se ainda houver erro, abra o Console (F12) e veja:

```javascript
// Ver a URL da API configurada
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);

// Testar endpoint manualmente
fetch('https://cinevisionn.onrender.com/api/v1/admin/broadcast/users-count', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
  }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

---

## 📊 Endpoints Disponíveis

Todos devem responder (com ou sem auth):

✅ **GET** `/api/v1/admin/broadcast/users-count`
✅ **GET** `/api/v1/admin/broadcast/history`
✅ **POST** `/api/v1/admin/broadcast/upload-image`
✅ **POST** `/api/v1/admin/broadcast/send`

---

## 🎯 Teste Rápido (Via Curl)

### Com Token Válido
```bash
# 1. Pegue seu token do localStorage (F12 → Console)
TOKEN="seu-token-aqui"

# 2. Teste contagem de usuários
curl -H "Authorization: Bearer $TOKEN" \
  https://cinevisionn.onrender.com/api/v1/admin/broadcast/users-count

# 3. Teste upload de imagem
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@/caminho/sua/imagem.jpg" \
  https://cinevisionn.onrender.com/api/v1/admin/broadcast/upload-image
```

---

## 💡 Dicas

1. **Cache do Browser**: O erro 404 pode ser cache antigo
2. **Token Expirado**: Tokens JWT expiram após 1 hora
3. **Deploy Delay**: Aguarde 1-2 min após deploy completar
4. **URL Errada**: Verifique se não está usando localhost

---

## ✅ Resposta Esperada

### Upload bem-sucedido:
```json
{
  "success": true,
  "image_url": "https://cinevision-cover.s3.us-east-1.amazonaws.com/..."
}
```

### Envio bem-sucedido:
```json
{
  "success": true,
  "message": "Broadcast enviado com sucesso",
  "total_users": 2,
  "successful_sends": 2,
  "failed_sends": 0,
  "broadcast_id": "uuid-aqui"
}
```

---

## 🆘 Se Nada Funcionar

1. Verifique os logs do Render:
   https://dashboard.render.com/web/srv-d3mp4ibipnbc73ctm470/logs

2. Execute o script de teste local:
   ```bash
   cd backend
   node test-broadcast-integration.js
   ```

3. Envie print do erro completo do Console (F12 → Network → Request)

---

**Última atualização**: 30/01/2025 04:55
**Deploy Status**: ✅ LIVE
