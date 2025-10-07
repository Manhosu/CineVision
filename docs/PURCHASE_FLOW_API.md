# Purchase Flow API Documentation

## Overview

This document describes the complete purchase flow implementation for Cine Vision, including backend API endpoints, Telegram bot integration, and content delivery system.

## Flow Summary

1. **Frontend** → `POST /purchases/initiate` → Get deep link
2. **User** → Opens Telegram → Bot shows payment UI
3. **User** → Makes payment → **Payment Provider** → Webhook
4. **Backend** → `POST /webhooks/payments` → Updates purchase status
5. **Backend** → Notifies Bot → Content delivery

---

## API Endpoints

### 1. Purchase Initiation

**Endpoint:** `POST /purchases/initiate`

**Description:** Creates a pending purchase and returns Telegram deep link.

**Headers:**
- `Content-Type: application/json`

**Request Body:**
```json
{
  "user_id": "123e4567-e89b-12d3-a456-426614174000",  // Optional - null for guest
  "content_id": "987fcdeb-51a2-43d7-8765-123456789abc",
  "preferred_delivery": "site"  // "site" | "telegram"
}
```

**Response (201 Created):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "purchase_token": "987fcdeb-51a2-43d7-8765-123456789abc",
  "telegram_deep_link": "https://t.me/CineVisionApp_Bot?start=987fcdeb-51a2-43d7-8765-123456789abc",
  "status": "pending",
  "amount_cents": 1990,
  "currency": "BRL",
  "preferred_delivery": "site",
  "content": {
    "id": "987fcdeb-51a2-43d7-8765-123456789abc",
    "title": "Vingadores: Ultimato",
    "poster_url": "https://example.com/poster.jpg"
  },
  "created_at": "2024-09-25T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid request data
- `404 Not Found`: Content not found

---

### 2. Get Purchase by Token

**Endpoint:** `GET /purchases/token/{token}`

**Description:** Used by Telegram bot to retrieve purchase details.

**Parameters:**
- `token` (path): Purchase token UUID

**Response (200 OK):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "purchase_token": "987fcdeb-51a2-43d7-8765-123456789abc",
  "status": "pending",
  "amount_cents": 1990,
  "currency": "BRL",
  "preferred_delivery": "site",
  "content": {
    "id": "987fcdeb-51a2-43d7-8765-123456789abc",
    "title": "Vingadores: Ultimato",
    "poster_url": "https://example.com/poster.jpg"
  },
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "João Silva",
    "telegram_id": "123456789"
  },
  "created_at": "2024-09-25T10:30:00Z"
}
```

**Error Responses:**
- `404 Not Found`: Purchase not found

---

### 3. Payment Webhook Handler

**Endpoint:** `POST /webhooks/payments`

**Description:** Receives payment status updates from payment providers.

**Headers:**
- `Content-Type: application/json`
- `X-Webhook-Signature: sha256=...` (for verification)

**Request Body:**
```json
{
  "payment_id": "stripe_pi_1234567890",
  "purchase_token": "987fcdeb-51a2-43d7-8765-123456789abc",
  "status": "paid",  // "pending" | "paid" | "failed" | "cancelled" | "refunded"
  "amount_cents": 1990,
  "signature": "sha256=1234567890abcdef",
  "metadata": {
    "provider": "stripe",
    "method": "pix"
  },
  "failure_reason": "insufficient_funds"  // Optional, for failed payments
}
```

**Response (200 OK):**
```json
{
  "purchase_id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "paid",
  "delivery": {
    "type": "site",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": "2024-09-26T10:30:00Z"
  },
  "processed_at": "2024-09-25T10:35:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid webhook payload or amount mismatch
- `401 Unauthorized`: Invalid webhook signature
- `404 Not Found`: Purchase not found

---

### 4. Get User Purchases

**Endpoint:** `GET /purchases`

**Description:** Get authenticated user's purchase history.

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Response (200 OK):**
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "paid",
    "amount_cents": 1990,
    "currency": "BRL",
    "preferred_delivery": "site",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "access_expires_at": "2024-09-26T10:30:00Z",
    "content": {
      "id": "987fcdeb-51a2-43d7-8765-123456789abc",
      "title": "Vingadores: Ultimato",
      "poster_url": "https://example.com/poster.jpg"
    },
    "created_at": "2024-09-25T10:30:00Z"
  }
]
```

---

### 5. Get Purchase by ID

**Endpoint:** `GET /purchases/{id}`

**Description:** Get specific purchase details.

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Parameters:**
- `id` (path): Purchase ID

**Response (200 OK):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "paid",
  "amount_cents": 1990,
  "currency": "BRL",
  "preferred_delivery": "site",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "access_expires_at": "2024-09-26T10:30:00Z",
  "content": {
    "id": "987fcdeb-51a2-43d7-8765-123456789abc",
    "title": "Vingadores: Ultimato",
    "poster_url": "https://example.com/poster.jpg"
  },
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "João Silva"
  },
  "created_at": "2024-09-25T10:30:00Z"
}
```

---

## Telegram Bot Integration

### Webhook Endpoint

**Endpoint:** `POST /webhook/payment-confirmed` (Bot service)

**Description:** Backend notifies bot when payment is confirmed.

**Headers:**
- `Content-Type: application/json`
- `X-Webhook-Signature: <signature>`

**Request Body:**
```json
{
  "purchase_token": "987fcdeb-51a2-43d7-8765-123456789abc",
  "status": "paid",
  "purchase_id": "123e4567-e89b-12d3-a456-426614174000",
  "content_id": "987fcdeb-51a2-43d7-8765-123456789abc",
  "preferred_delivery": "site"
}
```

### Bot Commands

1. **`/start <purchase_token>`**: Process purchase flow
2. **Callback Queries**:
   - `pay_pix_<token>`: PIX payment flow
   - `pay_card_<token>`: Card payment flow
   - `cancel_<token>`: Cancel purchase

---

## Content Delivery

### For Site Delivery (`preferred_delivery: "site"`)

1. Generate JWT access token (24h validity)
2. Send streaming link to user via Telegram
3. User can watch with token verification

**Streaming URL Format:**
```
https://cinevision.com/watch/{content_id}?token={access_token}
```

### For Telegram Delivery (`preferred_delivery: "telegram"`)

1. Bot sends video file directly to user chat
2. Fallback to download link if file > 50MB
3. File access expires after download

---

## Environment Variables

### Backend (.env)
```bash
TELEGRAM_BOT_USERNAME=CineVisionApp_Bot
BOT_WEBHOOK_URL=http://localhost:3003
WEBHOOK_SECRET=your-webhook-secret
JWT_SECRET=your-jwt-secret
```

### Bot (.env)
```bash
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
BACKEND_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
PIX_KEY=pix@cinevision.com
PAYMENT_GATEWAY_URL=https://pay.cinevision.com
WEBHOOK_SECRET=your-webhook-secret
```

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| `PURCHASE_NOT_FOUND` | Purchase not found | Invalid purchase token/ID |
| `CONTENT_NOT_FOUND` | Content not found | Invalid content ID |
| `AMOUNT_MISMATCH` | Amount mismatch | Webhook amount ≠ purchase amount |
| `INVALID_SIGNATURE` | Invalid signature | Webhook signature verification failed |
| `INVALID_TOKEN` | Invalid access token | JWT token expired/invalid |
| `DELIVERY_FAILED` | Content delivery failed | Error sending content via Telegram |

---

## Testing

### Test Purchase Flow

1. **Create Purchase**:
   ```bash
   curl -X POST http://localhost:3001/api/purchases/initiate \
     -H "Content-Type: application/json" \
     -d '{
       "content_id": "test-content-id",
       "preferred_delivery": "site"
     }'
   ```

2. **Simulate Payment Webhook**:
   ```bash
   curl -X POST http://localhost:3001/api/webhooks/payments \
     -H "Content-Type: application/json" \
     -H "X-Webhook-Signature: dev-signature" \
     -d '{
       "payment_id": "test-payment-123",
       "purchase_token": "your-purchase-token",
       "status": "paid",
       "amount_cents": 1990,
       "signature": "test-signature"
     }'
   ```

3. **Test Bot Integration**:
   ```
   https://t.me/YourBot?start=your-purchase-token
   ```

---

## Security Considerations

1. **Webhook Signatures**: Always verify payment webhook signatures
2. **JWT Tokens**: Use short-lived tokens for streaming access
3. **Rate Limiting**: Implement rate limiting on public endpoints
4. **Input Validation**: Validate all inputs on both frontend and backend
5. **HTTPS Only**: All endpoints must use HTTPS in production
6. **Token Expiration**: Implement automatic cleanup of expired tokens

---

## Monitoring & Logging

1. **Purchase Events**: Log all purchase state changes
2. **Payment Events**: Log all webhook received and processed
3. **Delivery Events**: Log all content delivery attempts
4. **Error Tracking**: Monitor and alert on delivery failures
5. **Performance**: Monitor response times for all endpoints