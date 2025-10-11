# 🎬 Sistema de Upload via Google Drive - CineVision

## ✅ STATUS: PRONTO PARA USO

---

## 🚀 Acesso Rápido

| Serviço | URL | Status |
|---------|-----|--------|
| **Frontend** | http://localhost:3000 | ✅ Online |
| **Admin Import** | http://localhost:3000/admin/content/drive-import | ✅ Online |
| **Backend API** | http://localhost:3001/api/v1 | ✅ Online |
| **API Health** | http://localhost:3001/api/v1/health | ✅ Online |
| **Swagger Docs** | http://localhost:3001/api/docs | ✅ Online |

---

## 🎯 Como Usar (Resumo)

### 1️⃣ Preparar Vídeo
- Faça upload no Google Drive
- Compartilhe publicamente ("Qualquer pessoa com o link")
- Copie o link

### 2️⃣ Importar
- Acesse: http://localhost:3000/admin/content/drive-import
- Cole o link do Google Drive
- Selecione filme, idioma e qualidade
- Clique em "Importar"

### 3️⃣ Acompanhar
- Progresso atualiza automaticamente a cada 2 segundos
- Aguarde conclusão (100%)
- Vídeo será salvo no S3 e banco de dados

---

## 📋 Configurações

### Google Drive API ✅
```
Service Account: cinevision-drive-uploader@projeto1workana.iam.gserviceaccount.com
Projeto: projeto1workana
Status: Ativo
```

### AWS S3 ✅
```
Bucket: cinevision-filmes
Region: us-east-1
Status: Configurado
```

### Supabase ✅
```
Tabela: content_languages
Status: Conectado
```

---

## 🔗 Links Suportados

### ✅ Arquivo Individual
```
https://drive.google.com/file/d/FILE_ID/view
```

### ✅ Pasta Completa
```
https://drive.google.com/drive/folders/FOLDER_ID
```
*Importa automaticamente o primeiro vídeo encontrado*

---

## 📊 Upload Automático

| Tamanho | Método | Tempo Estimado |
|---------|--------|----------------|
| < 100 MB | Simples | 1-3 min |
| 100 MB - 1 GB | Multipart | 3-10 min |
| 1 GB - 5 GB | Multipart | 10-30 min |
| 5 GB - 10 GB | Multipart | 30-60 min |
| > 10 GB | Multipart | 60+ min |

---

## 🛠️ Comandos Úteis

### Verificar Backend
```bash
curl http://localhost:3001/api/v1/health
```

### Reiniciar Backend
```bash
npx kill-port 3001
cd backend && npm run start:dev
```

### Reiniciar Frontend
```bash
npx kill-port 3000
cd frontend && npm run dev
```

---

## 📚 Documentação Completa

- **SISTEMA_PRONTO.md** - Guia completo de uso
- **SYSTEM_STATUS_REPORT.md** - Status detalhado de componentes
- **GOOGLE_DRIVE_IMPORT_SETUP.md** - Configuração do Google Cloud
- **ALTERACOES_FINAIS.md** - Últimas modificações realizadas

---

## ⚡ Teste Rápido

```bash
# 1. Verifique se serviços estão rodando
curl http://localhost:3001/api/v1/health
curl http://localhost:3000

# 2. Acesse interface admin
# http://localhost:3000/admin/content/drive-import

# 3. Use este link de teste
# https://drive.google.com/drive/folders/1VGtalbZAP-x9gUUqNY0_rPbB3NxMsHH1

# 4. Verifique resultado no banco
# SELECT * FROM content_languages ORDER BY created_at DESC LIMIT 1;
```

---

## 🐛 Problemas Comuns

### "URL do Google Drive inválida"
→ Certifique-se que o arquivo está compartilhado publicamente

### "Não foi possível acessar o arquivo"
→ Verifique permissões de compartilhamento

### "Upload travado em 0%"
→ Verifique se backend está rodando: http://localhost:3001/api/v1/health

### Mais ajuda?
→ Consulte **SISTEMA_PRONTO.md** seção "Solução de Problemas"

---

## 🎉 Sistema Operacional!

**Desenvolvido**: 10 de Outubro de 2025
**Status**: ✅ **PRONTO PARA PRODUÇÃO**

Todos os componentes estão configurados e testados.
O sistema está pronto para importar vídeos do Google Drive para AWS S3.
