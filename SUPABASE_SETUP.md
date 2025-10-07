# Configuração do Sistema com Supabase

Este documento descreve como configurar e executar o sistema utilizando apenas Supabase como banco de dados, sem TypeORM.

## ✅ Status dos Testes

### Backend
- ✅ **Compilação**: Backend compila corretamente sem TypeORM
- ✅ **Execução**: Backend roda sem erros com `ENABLE_TYPEORM="false"`
- ✅ **Health Check**: Endpoint `/api/v1/health` funciona (retorna status "error" com database "disconnected", que é esperado)

### Integrações
- ✅ **Stripe**: Endpoints de teste criados e funcionando
  - `/api/v1/stripe-test/products` - Lista produtos
  - `/api/v1/stripe-test/customers` - Lista clientes  
  - `/api/v1/stripe-test/health` - Health check do Stripe
  - **Status**: Configurado mas requer credenciais válidas

- ✅ **Supabase**: Endpoints de teste criados e funcionando
  - `/api/v1/supabase-test/health` - Health check do Supabase
  - `/api/v1/supabase-test/database-info` - Informações do banco
  - `/api/v1/supabase-test/test-query` - Query de teste
  - **Status**: Configurado mas requer ajustes nas credenciais

### Frontend
- ✅ **Conectividade**: Frontend consegue se conectar ao backend
- ✅ **Execução**: Roda em `http://localhost:3000`
- ⚠️ **Endpoints de Conteúdo**: Retornam 404 (esperado sem TypeORM)

## 🚀 Como Executar

### 1. Configurar Variáveis de Ambiente

Edite o arquivo `.env` e configure as seguintes variáveis:

#### Supabase (Obrigatório)
```env
SUPABASE_URL=sua_url_do_supabase
SUPABASE_ANON_KEY=sua_chave_anonima
SUPABASE_SERVICE_ROLE_KEY=sua_chave_de_servico
SUPABASE_DATABASE_URL=sua_connection_string_completa
```

#### Stripe (Opcional para testes)
```env
STRIPE_SECRET_KEY=sk_test_sua_chave_secreta
STRIPE_WEBHOOK_SECRET=whsec_sua_chave_webhook
```

#### TypeORM (Desabilitar)
```env
ENABLE_TYPEORM=false
```

### 2. Executar o Backend

```bash
cd backend
npm install
npm run build
ENABLE_TYPEORM="false" node dist/src/main.js
```

O backend estará disponível em `http://localhost:3001`

### 3. Executar o Frontend

```bash
cd frontend
npm install
npm run dev
```

O frontend estará disponível em `http://localhost:3000`

## 🧪 Endpoints de Teste

### Health Check Geral
```bash
curl http://localhost:3001/api/v1/health
```

### Stripe (Testes)
```bash
# Health check do Stripe
curl http://localhost:3001/api/v1/stripe-test/health

# Listar produtos
curl http://localhost:3001/api/v1/stripe-test/products

# Listar clientes
curl http://localhost:3001/api/v1/stripe-test/customers
```

### Supabase (Testes)
```bash
# Health check do Supabase
curl http://localhost:3001/api/v1/supabase-test/health

# Informações do banco
curl http://localhost:3001/api/v1/supabase-test/database-info

# Query de teste
curl http://localhost:3001/api/v1/supabase-test/test-query
```

## 📋 Checklist de Configuração

- [ ] Variáveis do Supabase configuradas no `.env`
- [ ] `ENABLE_TYPEORM=false` definido
- [ ] Backend compilado com `npm run build`
- [ ] Backend executando com Supabase
- [ ] Frontend conectando ao backend
- [ ] Endpoints de teste do Supabase respondendo
- [ ] (Opcional) Credenciais do Stripe configuradas

## 🔧 Próximos Passos

1. **Configurar Credenciais Reais**: Substituir os placeholders por credenciais válidas do Supabase e Stripe
2. **Implementar Endpoints de Produção**: Criar endpoints que utilizem o `SupabaseRestClient` para operações reais
3. **Migrar Dados**: Se necessário, migrar dados existentes para o Supabase
4. **Testes de Integração**: Criar testes automatizados para as integrações

## 🚨 Problemas Conhecidos

1. **Supabase 406/404 Errors**: Indicam problemas de configuração das credenciais ou endpoints inexistentes
2. **Stripe 400 Invalid API Key**: Credenciais placeholder precisam ser substituídas
3. **Frontend 404s**: Endpoints de conteúdo não funcionam sem TypeORM (comportamento esperado)

## 📁 Arquivos Importantes

- `src/config/supabase-rest-client.ts` - Cliente REST do Supabase
- `src/modules/supabase/` - Módulos e controladores de teste do Supabase
- `src/modules/stripe-test/` - Módulos e controladores de teste do Stripe
- `.env` - Configurações de ambiente
- `src/app.module.ts` - Configuração principal dos módulos