# Como Ativar PIX no Mercado Pago

**Problema Atual:** Sistema retornando erro "Collector user without key enabled for QR render"

**Causa:** PIX não está ativado na conta do Mercado Pago (rafagomes2404@gmail.com)

**Solução:** Ativar PIX e cadastrar chave PIX (5-10 minutos)

---

## Opção 1: Via App Mercado Pago (MAIS RÁPIDO) ⚡

### Passo 1: Baixe o App
- Android: https://play.google.com/store/apps/details?id=com.mercadopago.wallet
- iOS: https://apps.apple.com/br/app/mercado-pago/id925436649

### Passo 2: Faça Login
- Email: `rafagomes2404@gmail.com`
- Senha: [sua senha]

### Passo 3: Ative PIX
1. Na tela inicial, toque em **"Transferir"** ou **"PIX"**
2. Toque em **"Criar chave PIX"** ou **"Minhas chaves"**
3. Escolha o tipo de chave:
   - ✅ **CPF** (recomendado - mais rápido)
   - Email
   - Telefone
   - Chave aleatória
4. Siga as instruções na tela
5. Aguarde confirmação (geralmente instantâneo)

### Passo 4: Verifique se Funcionou
1. No app, vá em **"PIX" → "Minhas chaves"**
2. Deve aparecer sua chave cadastrada
3. Status deve ser **"Ativa"** ✅

---

## Opção 2: Via Site (Desktop) 💻

### Passo 1: Acesse o Site
https://www.mercadopago.com.br/

### Passo 2: Faça Login
- Email: `rafagomes2404@gmail.com`
- Senha: [sua senha]

### Passo 3: Navegue até PIX
1. No menu superior, clique em **"Transferir"**
2. Ou vá em **"Dinheiro na conta" → "PIX"**

### Passo 4: Crie Chave PIX
1. Clique em **"Criar chave PIX"** ou **"Cadastrar chave"**
2. Escolha o tipo:
   - ✅ **CPF/CNPJ** (recomendado)
   - Email
   - Telefone
   - Chave aleatória
3. Preencha as informações
4. Confirme no seu celular/email
5. Aguarde aprovação

### Passo 5: Verifique Status
- Vá em **"Minhas chaves PIX"**
- Status deve estar **"Ativa"**
- Você pode receber PIX nessa chave

---

## Opção 3: Converter Conta para Vendedor (Se necessário) 🏪

Se o PIX não aparecer nas opções acima, sua conta pode ser **apenas pessoal**. Você precisa ativar o modo vendedor:

### Passo 1: Verifique Tipo de Conta
1. Vá em: https://www.mercadopago.com.br/settings/account
2. Procure **"Tipo de conta"**
3. Se aparecer "Pessoal" → precisa converter

### Passo 2: Ative Modo Vendedor
1. No menu, clique em **"Seu negócio"** ou **"Vender"**
2. Clique em **"Começar a vender"** ou **"Quero vender"**
3. Preencha os dados:
   - **Nome do negócio:** CineVision
   - **Tipo:** Pessoa Física ou Jurídica
   - **Documento:** CPF ou CNPJ
   - **Categoria:** Entretenimento/Streaming/Vídeo sob demanda
   - **Site:** [seu domínio no Render]
4. Aguarde aprovação (pode levar até 24h)

### Passo 3: Após Aprovação
1. Volte ao **Passo 3** da Opção 1 ou 2
2. Agora PIX deve estar disponível
3. Cadastre sua chave PIX

---

## Verificar se PIX Está Funcionando ✅

Depois de ativar PIX, execute este comando para testar:

```bash
cd /c/Users/delas/OneDrive/Documentos/Projetos/Filmes
node verify-mercadopago-pix.js
```

**Resultado esperado:**
```
✅ PIX está disponível!
✅ Pagamento criado: 123456789
✅ QR Code gerado com sucesso!
🎉 SUCESSO! Mercado Pago PIX está FUNCIONANDO!
```

Se der erro, leia as instruções que o script exibe.

---

## Problemas Comuns e Soluções 🔧

### "PIX não aparece no menu"
**Causa:** Conta pessoal sem modo vendedor ativado
**Solução:** Siga a Opção 3 acima para converter para vendedor

### "Chave PIX já existe"
**Causa:** CPF/Email/Telefone já usado em outra conta MP
**Solução:** Use chave aleatória ou outro tipo de chave

### "Cadastro pendente de aprovação"
**Causa:** Mercado Pago está analisando seus dados
**Solução:** Aguarde 24-48h e verifique email

### "Documento inválido"
**Causa:** CPF/CNPJ incorreto ou bloqueado
**Solução:** Verifique os dados ou use outro documento

### "Sua conta está restrita"
**Causa:** Problemas de segurança ou compliance
**Solução:** Contate suporte do Mercado Pago

---

## Suporte Mercado Pago 📞

Se tiver problemas:

- **Central de Ajuda:** https://www.mercadopago.com.br/ajuda
- **Suporte para Desenvolvedores:** https://www.mercadopago.com.br/developers/pt/support
- **Chat:** Disponível no app ou site (canto inferior direito)
- **Email:** desenvolvedores@mercadopago.com

---

## Informações da Conta

- **Email:** rafagomes2404@gmail.com
- **ID da Conta:** 452973387
- **Tipo:** MLB (Brasil)
- **Nickname:** GORA2773201

---

## Próximos Passos Após Ativar PIX

1. ✅ Executar `verify-mercadopago-pix.js` para confirmar
2. ✅ Testar pagamento PIX no bot do Telegram
3. ✅ Configurar webhook (se ainda não configurado)
4. ✅ Adicionar `MERCADO_PAGO_WEBHOOK_SECRET` no Render
5. ✅ Testar fluxo completo de pagamento → entrega

---

## Tempo Estimado

- **Cadastro chave PIX:** 2-5 minutos
- **Ativação imediata:** 90% dos casos
- **Aprovação (se necessário):** 24-48 horas
- **Conversão para vendedor:** 1-2 dias úteis

---

**⚠️ IMPORTANTE:**

Você precisa ativar PIX para que o sistema funcione. Sem isso, todos os pagamentos PIX vão falhar com o erro atual.

O código já está pronto e funcionando. O único bloqueio é a configuração da conta do Mercado Pago.
