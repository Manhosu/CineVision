# Integração PIX no Bot do Telegram - CineVision

## 📋 Resumo da Implementação

Sistema de pagamentos PIX implementado com geração de QR Code EMV padrão Banco Central do Brasil.

---

## ✅ O que foi implementado

### 1. **Backend - Geração de QR Code PIX**

#### Arquivo: `backend/src/modules/payments/services/pix-qrcode.service.ts`
- ✅ Serviço completo de geração de QR Code PIX seguindo padrão EMV
- ✅ Suporte a todos os tipos de chave PIX (CPF, CNPJ, Email, Telefone, Aleatória)
- ✅ Validação de chaves PIX
- ✅ Geração de código EMV para pagamento
- ✅ Geração de imagem QR Code em base64
- ✅ Cálculo de CRC16-CCITT para validação

**Principais funcionalidades:**
```typescript
// Gerar QR Code PIX
generatePixQRCode(data: PixQRCodeData): GeneratedPixQRCode

// Validar chave PIX
validatePixKey(pixKey: string): {valid: boolean, type?: string}

// Gerar imagem QR Code
generateQRCodeImage(emvPayload: string): Promise<string>
```

---

### 2. **Backend - Integração com Pagamentos**

#### Arquivo: `backend/src/modules/payments/payments-supabase.service.ts`
- ✅ Método `createPixPayment(purchaseId)` adicionado
- ✅ Busca configurações PIX do `admin_settings`
- ✅ Valida chave PIX antes de gerar QR Code
- ✅ Cria registro de pagamento no banco
- ✅ Retorna QR Code EMV + imagem base64

**Fluxo:**
1. Busca purchase no banco
2. Busca configurações PIX (chave, merchant name, city)
3. Valida chave PIX
4. Gera ID único da transação
5. Gera QR Code EMV
6. Salva payment no banco com status `pending`
7. Retorna dados do pagamento

---

### 3. **Backend - Configuração Admin**

#### Arquivo: `backend/src/modules/admin/services/admin-settings-supabase.service.ts`
- ✅ Service para gerenciar configurações PIX via Supabase
- ✅ Métodos `getPixSettings()` e `updatePixSettings()`
- ✅ Integrado com `admin_settings` table

#### Arquivo: `backend/src/modules/admin/controllers/admin-settings.controller.ts`
- ✅ Endpoints já existentes:
  - `GET /api/v1/admin/settings/pix`
  - `PUT /api/v1/admin/settings/pix`

---

### 4. **Database - Tabela de Configurações**

#### Arquivo: `backend/src/database/migrations/20250102000001_create_admin_settings.sql`
- ✅ Tabela `admin_settings` criada
- ✅ Campos padrão para PIX:
  - `pix_key` - Chave PIX do destinatário
  - `pix_merchant_name` - Nome do lojista (max 25 chars)
  - `pix_merchant_city` - Cidade do lojista (max 15 chars)

---

## 🔧 O que precisa ser configurado

### 1. **Configurar Chave PIX no Admin**

No painel `/admin`, o administrador precisa:

1. Acessar configurações
2. Adicionar chave PIX (email, CPF, CNPJ, telefone ou chave aleatória)
3. Definir nome do comerciante (ex: "Cine Vision")
4. Definir cidade (ex: "SAO PAULO")

**Endpoint:**
```http
PUT /api/v1/admin/settings/pix
Content-Type: application/json

{
  "pix_key": "admin@cinevision.com",
  "merchant_name": "Cine Vision",
  "merchant_city": "SAO PAULO"
}
```

---

### 2. **Integrar PIX no Bot do Telegram**

#### Arquivo para editar: `backend/src/modules/telegrams/telegrams-enhanced.service.ts`

Adicione opção de pagamento PIX no método `initiateTelegramPurchase`:

```typescript
// Linha ~200 no método initiateTelegramPurchase
async initiateTelegramPurchase(dto: InitiateTelegramPurchaseDto) {
  // ... código existente ...

  // ADICIONAR: Oferecer escolha de método de pagamento
  const message = `
💳 *Escolha o método de pagamento:*

🎬 ${content.title}
💰 Valor: R$ ${(content.price_cents / 100).toFixed(2)}

Selecione uma opção:
`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '💳 Cartão de Crédito (Stripe)', callback_data: `pay_stripe_${purchaseId}` },
      ],
      [
        { text: '📱 PIX', callback_data: `pay_pix_${purchaseId}` },
      ]
    ]
  };

  await axios.post(`${this.botApiUrl}/sendMessage`, {
    chat_id: dto.chat_id,
    text: message,
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}
```

#### Adicionar handler para PIX:

```typescript
// No método handleCallbackQuery ou similar
async handlePixPayment(chatId: number, purchaseId: string) {
  try {
    // Chamar serviço de pagamento PIX
    const pixPayment = await this.paymentsService.createPixPayment(purchaseId);

    // Enviar QR Code como imagem
    if (pixPayment.qr_code_image) {
      await axios.post(`${this.botApiUrl}/sendPhoto`, {
        chat_id: chatId,
        photo: `data:image/png;base64,${pixPayment.qr_code_image}`,
        caption: `
📱 *Pagamento PIX*

💰 Valor: R$ ${pixPayment.amount_brl}
⏱️ Válido por: 1 hora

*Como pagar:*
1. Abra seu app bancário
2. Escaneie o QR Code acima
3. Confirme o pagamento

Ou use o código Pix Copia e Cola abaixo:
        `,
        parse_mode: 'Markdown'
      });
    }

    // Enviar código copia e cola
    await axios.post(`${this.botApiUrl}/sendMessage`, {
      chat_id: chatId,
      text: `\`${pixPayment.copy_paste_code}\``,
      parse_mode: 'Markdown'
    });

    // Adicionar botão para confirmar pagamento
    await axios.post(`${this.botApiUrl}/sendMessage`, {
      chat_id: chatId,
      text: '✅ Assim que o pagamento for confirmado, você terá acesso ao conteúdo!',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Já paguei!', callback_data: `check_pix_${purchaseId}` }]
        ]
      }
    });

  } catch (error) {
    this.logger.error('Error sending PIX payment:', error);
    throw error;
  }
}
```

---

### 3. **Criar Endpoint no PaymentsController**

#### Arquivo: `backend/src/modules/payments/payments.controller.ts`

Adicione o endpoint para criar pagamento PIX:

```typescript
@Post('pix/create')
@ApiOperation({ summary: 'Create PIX payment' })
@ApiResponse({ status: 201, description: 'PIX payment created successfully' })
async createPixPayment(@Body() dto: { purchase_id: string }) {
  return this.paymentsService.createPixPayment(dto.purchase_id);
}
```

---

### 4. **Implementar Confirmação de Pagamento PIX**

Como PIX não tem webhook automático (a menos que use gateway), você precisa:

**Opção A - Manual (Simples):**
- Admin acessa painel e marca pagamento como "pago" manualmente
- Notificação automática enviada ao usuário

**Opção B - Integração com Gateway (Avançado):**
- Integrar com Mercado Pago, PagSeguro, etc.
- Usar webhooks do gateway para confirmar pagamento automaticamente

**Opção C - Polling (Intermediário):**
- Bot pergunta ao usuário se já pagou
- Admin revisa comprovante e aprova

---

## 🎨 UI Admin - Configuração PIX

Criar página no frontend admin para gerenciar chave PIX:

### Arquivo: `frontend/src/app/admin/settings/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

export default function AdminSettingsPage() {
  const [pixKey, setPixKey] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [merchantCity, setMerchantCity] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/v1/admin/settings/pix', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setPixKey(data.pix_key || '');
      setMerchantName(data.merchant_name || '');
      setMerchantCity(data.merchant_city || '');
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/admin/settings/pix', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          pix_key: pixKey,
          merchant_name: merchantName,
          merchant_city: merchantCity
        })
      });

      if (response.ok) {
        toast.success('Configurações PIX salvas com sucesso!');
      } else {
        toast.error('Erro ao salvar configurações');
      }
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Configurações PIX</h1>

      <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Chave PIX
          </label>
          <input
            type="text"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="email@exemplo.com ou CPF/CNPJ"
          />
          <p className="text-xs text-gray-500 mt-1">
            Pode ser: Email, CPF, CNPJ, Telefone ou Chave Aleatória
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Nome do Comerciante (max 25 caracteres)
          </label>
          <input
            type="text"
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
            maxLength={25}
            className="w-full border rounded px-3 py-2"
            placeholder="Cine Vision"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Cidade (max 15 caracteres)
          </label>
          <input
            type="text"
            value={merchantCity}
            onChange={(e) => setMerchantCity(e.target.value)}
            maxLength={15}
            className="w-full border rounded px-3 py-2"
            placeholder="SAO PAULO"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
}
```

---

## 📝 Checklist de Implementação

- [x] ✅ Serviço de geração QR Code PIX (EMV)
- [x] ✅ Validação de chaves PIX
- [x] ✅ Método createPixPayment no PaymentsSupabaseService
- [x] ✅ AdminSettingsSupabaseService para Supabase
- [x] ✅ Migration com tabela admin_settings
- [ ] ⏳ Endpoint POST /api/v1/payments/pix/create
- [ ] ⏳ Integração PIX no bot do Telegram
- [ ] ⏳ UI Admin para configurar chave PIX
- [ ] ⏳ Sistema de confirmação de pagamento PIX
- [ ] ⏳ Testes end-to-end

---

## 🔐 Segurança

1. **Validação de Chave PIX**: O sistema valida formato antes de gerar QR Code
2. **Transação ID Única**: Cada pagamento gera ID único com timestamp
3. **CRC16**: QR Code inclui checksum para validação
4. **Timeout**: QR Code expira em 1 hora (configurável)
5. **Admin Only**: Apenas admins podem configurar chave PIX

---

## 📚 Referências

- [Manual PIX - Banco Central](https://www.bcb.gov.br/estabilidadefinanceira/pix)
- [Padrão EMV QR Code](https://www.emvco.com/emv-technologies/qrcodes/)
- Biblioteca: `crc` - Cálculo CRC16-CCITT
- Biblioteca: `qrcode` - Geração de imagem QR Code

---

## 🐛 Troubleshooting

### QR Code não é reconhecido pelo banco
- Verificar se chave PIX está correta no admin
- Verificar se merchant_name tem até 25 caracteres
- Verificar se merchant_city tem até 15 caracteres

### Erro "PIX key not configured"
- Acessar `/admin/settings` e configurar chave PIX
- Verificar se tabela `admin_settings` foi criada pela migration

### Imagem QR Code não aparece
- Verificar se biblioteca `qrcode` está instalada: `npm install qrcode`
- Verificar se `@types/qrcode` está instalada: `npm install --save-dev @types/qrcode`

---

## 📞 Suporte

Para dúvidas ou problemas, contate o desenvolvedor.
