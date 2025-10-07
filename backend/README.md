# Cine Vision Backend

REST API para a plataforma de streaming Cine Vision.

## 🚀 Setup Rápido

```bash
# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp ../.env.example .env

# Executar em modo desenvolvimento
npm run start:dev

# Build para produção
npm run build
npm run start:prod
```

## 📋 Scripts Disponíveis

- `npm run start:dev` - Servidor de desenvolvimento com hot reload
- `npm run build` - Build para produção
- `npm run start:prod` - Executar versão de produção
- `npm run lint` - Linter ESLint
- `npm run test` - Executar testes

## 🔧 Tecnologias

- **Framework:** NestJS
- **Database:** PostgreSQL + TypeORM
- **Auth:** JWT + Passport
- **Docs:** Swagger/OpenAPI

## 📚 Documentação API

Após executar o servidor, acesse:
- **Swagger UI:** http://localhost:3001/api/docs
- **OpenAPI JSON:** http://localhost:3001/api/docs-json