# Configuração e Uso do Sistema de Importação Google Drive → S3

Este documento detalha como configurar e usar o sistema de importação de vídeos diretamente do Google Drive para AWS S3.

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Configuração do Google Drive API](#configuração-do-google-drive-api)
3. [Configuração das Variáveis de Ambiente](#configuração-das-variáveis-de-ambiente)
4. [Como Usar](#como-usar)
5. [Arquitetura e Fluxo](#arquitetura-e-fluxo)
6. [Solução de Problemas](#solução-de-problemas)

---

## 🎯 Pré-requisitos

- Conta Google Cloud Platform com billing ativado
- Conta AWS com bucket S3 configurado
- Projeto CineVision configurado e rodando
- Node.js 18+ instalado

---

## 🔧 Configuração do Google Drive API

### 1. Criar Projeto no Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com)
2. Crie um novo projeto ou selecione um existente
3. Nome sugerido: `CineVision-Drive-Import`

### 2. Ativar Google Drive API

1. No menu lateral, vá em **APIs & Services** > **Library**
2. Procure por "Google Drive API"
3. Clique em **ENABLE**

### 3. Criar Service Account

1. Vá em **APIs & Services** > **Credentials**
2. Clique em **CREATE CREDENTIALS** > **Service Account**
3. Preencha:
   - **Service account name**: `cinevision-drive-importer`
   - **Service account ID**: (será gerado automaticamente)
   - **Description**: `Service account for importing videos from Google Drive`
4. Clique em **CREATE AND CONTINUE**
5. Em **Grant this service account access to project**, selecione:
   - Role: **Editor** (ou crie uma role customizada apenas com Drive read)
6. Clique em **CONTINUE** e depois **DONE**

### 4. Gerar Chave Privada

1. Na lista de Service Accounts, clique na conta recém-criada
2. Vá na aba **KEYS**
3. Clique em **ADD KEY** > **Create new key**
4. Selecione o tipo **JSON**
5. Clique em **CREATE**
6. Arquivo JSON será baixado automaticamente

### 5. Extrair Credenciais do JSON

Abra o arquivo JSON baixado e encontre:

```json
{
  "type": "service_account",
  "project_id": "seu-projeto-123456",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "cinevision-drive-importer@seu-projeto-123456.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "...",
  "token_uri": "...",
  ...
}
```

Você precisará dos valores:
- `client_email`
- `private_key`

---

## 🔑 Configuração das Variáveis de Ambiente

### Backend (.env)

Edite o arquivo `backend/.env` e adicione:

```bash
# ==============================================
# GOOGLE DRIVE API CONFIGURATION
# ==============================================
GOOGLE_CLIENT_EMAIL=cinevision-drive-importer@seu-projeto-123456.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0B...\n-----END PRIVATE KEY-----\n"
```

**⚠️ IMPORTANTE:**
- A `GOOGLE_PRIVATE_KEY` deve estar entre aspas duplas
- Mantenha os `\n` (quebras de linha) no formato do JSON original
- Não remova os marcadores `-----BEGIN PRIVATE KEY-----` e `-----END PRIVATE KEY-----`

### Verificar Outras Configurações Necessárias

Certifique-se de que as seguintes variáveis estão configuradas:

```bash
# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=sua_access_key
AWS_SECRET_ACCESS_KEY=sua_secret_key
AWS_S3_BUCKET=cinevision-filmes

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
```

---

## 🚀 Como Usar

### 1. Preparar Vídeo no Google Drive

#### Opção A: Arquivo Individual

1. Faça upload do vídeo para seu Google Drive
2. Clique com botão direito no arquivo > **Compartilhar**
3. Em "Acesso geral", selecione: **Qualquer pessoa com o link**
4. Permissão: **Visualizador**
5. Copie o link (formato: `https://drive.google.com/file/d/FILE_ID/view`)

#### Opção B: Pasta com Vídeos

1. Crie uma pasta no Google Drive
2. Faça upload dos vídeos para a pasta
3. Clique com botão direito na pasta > **Compartilhar**
4. Em "Acesso geral", selecione: **Qualquer pessoa com o link**
5. Permissão: **Visualizador**
6. Copie o link (formato: `https://drive.google.com/drive/folders/FOLDER_ID`)

**🎯 Sistema suporta ambos os formatos!**
- Se você fornecer um link de pasta, o sistema importará automaticamente o primeiro arquivo de vídeo encontrado

### 2. Acessar Interface Admin

1. Acesse `http://localhost:3000/admin`
2. Faça login com credenciais de administrador
3. No menu lateral ou dashboard, procure por **"Importar do Google Drive"**
4. Ou acesse diretamente: `http://localhost:3000/admin/content/drive-import`

### 3. Importar Vídeo

1. **Cole o link do Google Drive**
   - Arquivo: `https://drive.google.com/file/d/1ABC...XYZ/view`
   - Pasta: `https://drive.google.com/drive/folders/1ABC...XYZ`

2. **Selecione o conteúdo de destino**
   - Escolha o filme/série que receberá o vídeo

3. **Configure as opções**
   - **Tipo de Áudio**: Dublado, Legendado ou Original
   - **Idioma**: pt-BR, en-US, es, fr, etc
   - **Qualidade**: 480p, 720p, 1080p, 4K

4. **Clique em "Iniciar Importação"**

5. **Acompanhe o progresso em tempo real**
   - Validando link
   - Baixando do Google Drive
   - Enviando para AWS S3
   - Salvando no banco de dados

### 4. Verificar Importação

Após concluído:
- ✅ Upload ID será exibido
- ✅ URL do S3 será mostrada
- ✅ Registro será salvo na tabela `content_languages`
- ✅ Vídeo estará disponível no player do frontend

---

## 🏗️ Arquitetura e Fluxo

### Fluxo Completo

```
┌─────────────────┐
│  Google Drive   │
│   (Arquivo)     │
└────────┬────────┘
         │ 1. Stream Download
         ▼
┌─────────────────┐
│   Backend API   │
│ DriveToS3Service│
└────────┬────────┘
         │ 2. Stream Upload (Multipart se > 100MB)
         ▼
┌─────────────────┐
│    AWS S3       │
│ cinevision-     │
│    filmes       │
└────────┬────────┘
         │ 3. Save Metadata
         ▼
┌─────────────────┐
│   Supabase      │
│ content_        │
│  languages      │
└─────────────────┘
```

### Componentes

#### 1. Frontend (`frontend/src/app/admin/content/drive-import/page.tsx`)
- Interface de usuário
- Formulário de importação
- Exibição de progresso em tempo real
- Polling da API para updates

#### 2. Backend Controller (`backend/src/modules/admin/controllers/drive-import.controller.ts`)
- Endpoint: `POST /admin/drive-import/import`
- Validação de parâmetros
- Detecção automática de pasta vs arquivo
- Gerenciamento de progresso

#### 3. Service (`backend/src/modules/admin/services/drive-to-s3.service.ts`)
- Conexão com Google Drive API
- Streaming direto Drive → S3
- Upload simples (< 100MB) ou Multipart (> 100MB)
- Eventos de progresso

#### 4. Database
Tabela: `content_languages`
```sql
- content_id: UUID do filme/série
- language_type: 'dublado' | 'legendado' | 'original'
- language_code: 'pt-BR', 'en-US', etc
- video_url: URL do S3
- video_storage_key: Chave no S3
- file_size_bytes: Tamanho do arquivo
- status: 'ready'
```

### Estratégias de Upload

#### Upload Simples (< 100MB)
1. Download completo do Drive para memória
2. Upload único para S3
3. Mais rápido para arquivos pequenos

#### Upload Multipart (>= 100MB)
1. Stream do Drive em chunks de 10MB
2. Upload de cada parte para S3 em paralelo
3. Finalização do multipart upload
4. Ideal para arquivos grandes (2GB+)

---

## 🔧 Solução de Problemas

### Erro: "URL do Google Drive inválida"

**Causa**: Link não está no formato correto

**Solução**:
- Verifique se o link contém `drive.google.com`
- Formatos aceitos:
  - `https://drive.google.com/file/d/FILE_ID/view`
  - `https://drive.google.com/drive/folders/FOLDER_ID`
  - `https://drive.google.com/open?id=FILE_ID`

### Erro: "Não foi possível acessar o arquivo"

**Causa**: Permissões do arquivo/pasta não estão configuradas

**Solução**:
1. Abra o arquivo/pasta no Google Drive
2. Clique em "Compartilhar"
3. Configure "Acesso geral" para **"Qualquer pessoa com o link"**
4. Ou adicione o email do Service Account (`GOOGLE_CLIENT_EMAIL`) como visualizador

### Erro: "GOOGLE_CLIENT_EMAIL is not defined"

**Causa**: Variáveis de ambiente não configuradas

**Solução**:
1. Verifique `backend/.env`
2. Confirme que `GOOGLE_CLIENT_EMAIL` e `GOOGLE_PRIVATE_KEY` estão preenchidos
3. Reinicie o servidor backend

### Erro: "Invalid grant" ou "Unauthorized"

**Causa**: Problemas com a chave privada

**Solução**:
1. Verifique se a `GOOGLE_PRIVATE_KEY` está **entre aspas duplas**
2. Confirme que os `\n` estão presentes
3. Regenere a chave no Google Cloud Console se necessário

### Erro: "Nenhum arquivo de vídeo encontrado na pasta"

**Causa**: Pasta não contém vídeos ou vídeos não são detectados

**Solução**:
- Certifique-se de que há arquivos `.mp4`, `.mkv`, `.avi` na pasta
- Google Drive deve reconhecer como tipo `video/*`
- Tente usar link direto do arquivo individual

### Upload Muito Lento

**Causa**: Arquivo muito grande ou conexão lenta

**Solução**:
- Sistema usa multipart upload automaticamente para arquivos > 100MB
- Considere comprimir o vídeo antes do upload
- Verifique sua conexão de internet
- Upload direto via AWS CLI pode ser mais rápido para arquivos > 5GB

### Erro ao Salvar no Banco de Dados

**Causa**: content_id não existe ou duplicação

**Solução**:
1. Verifique se o filme/série existe: `SELECT id FROM content WHERE id = 'UUID'`
2. Se já existe language para este content + audio_type, será atualizado
3. Verifique logs do backend para detalhes

---

## 📊 Monitoramento

### Logs do Backend

```bash
cd backend
npm run start:dev

# Observe logs do tipo:
# [DriveImportController] Iniciando import do Drive para content_id: xxx
# [DriveToS3Service] File ID extraído: xxx
# [DriveToS3Service] Arquivo: video.mp4 (2500000000 bytes)
# [DriveToS3Service] Upload multipart concluído: https://...
```

### Verificar no Banco

```sql
-- Verificar languages criadas
SELECT
  cl.id,
  c.title,
  cl.language_type,
  cl.language_code,
  cl.status,
  cl.file_size_bytes / 1024 / 1024 as size_mb,
  cl.created_at
FROM content_languages cl
JOIN content c ON c.id = cl.content_id
ORDER BY cl.created_at DESC
LIMIT 10;
```

### Verificar no S3 (AWS CLI)

```bash
# Listar arquivos no bucket
aws s3 ls s3://cinevision-filmes/movies/ --recursive --human-readable

# Verificar arquivo específico
aws s3 ls s3://cinevision-filmes/movies/CONTENT_ID/dublado/
```

---

## ✅ Checklist de Configuração

Antes de usar, confirme que tudo está configurado:

- [ ] Google Drive API ativada no Google Cloud
- [ ] Service Account criada e chave JSON baixada
- [ ] `GOOGLE_CLIENT_EMAIL` configurada no `.env`
- [ ] `GOOGLE_PRIVATE_KEY` configurada no `.env` (com aspas e `\n`)
- [ ] AWS credentials configuradas (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- [ ] Bucket S3 `cinevision-filmes` existe e está acessível
- [ ] Backend rodando na porta 3001
- [ ] Frontend rodando na porta 3000
- [ ] Supabase configurado e banco de dados acessível
- [ ] Pelo menos 1 filme cadastrado na tabela `content`

---

## 🎬 Exemplo Completo

### 1. Upload para Google Drive

```
1. Faça upload de: "Superman_2025_1080p_Dublado.mp4" (2.5GB)
2. Compartilhe publicamente
3. Copie link: https://drive.google.com/file/d/1ABC...XYZ/view
```

### 2. Importar via Interface

```
Link: https://drive.google.com/file/d/1ABC...XYZ/view
Conteúdo: Superman (2025)
Tipo: Dublado
Idioma: pt-BR
Qualidade: 1080p
```

### 3. Resultado

```
✅ Upload ID: 7ef17049-402d-49d5-bf7d-12811f2f4c45-dublado-1760123456789
✅ S3 URL: https://cinevision-filmes.s3.us-east-1.amazonaws.com/movies/7ef17049.../dublado/1760123456789-superman_2025_1080p_dublado.mp4
✅ Tamanho: 2.35 GB
✅ Tempo: ~5 minutos (depende da conexão)
✅ Status: Importação concluída!
```

---

## 🚦 Status do Sistema

**✅ Funcionalidades Implementadas**
- ✅ Importação de arquivos individuais
- ✅ Importação de pastas (primeiro vídeo)
- ✅ Upload simples para arquivos < 100MB
- ✅ Upload multipart para arquivos >= 100MB
- ✅ Progresso em tempo real
- ✅ Múltiplos idiomas (dublado, legendado, original)
- ✅ Salvamento automático no banco
- ✅ Interface web completa

**⚠️ Pendente**
- ⚠️ Configurar `GOOGLE_CLIENT_EMAIL` e `GOOGLE_PRIVATE_KEY` no `.env`
- ⚠️ Testar com arquivo real do Google Drive
- ⚠️ Documentar processo de compartilhamento do Drive com Service Account

**🔮 Melhorias Futuras**
- Import de múltiplos vídeos de uma pasta
- Agendamento de imports
- Notificações via email/Telegram
- Retry automático em caso de falha
- Dashboard de imports com histórico

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique os logs do backend
2. Consulte a seção "Solução de Problemas"
3. Verifique as configurações no Google Cloud Console
4. Teste a conexão com AWS S3 separadamente

---

**Última atualização**: 10 de Outubro de 2025
**Versão do Sistema**: 1.0.0
