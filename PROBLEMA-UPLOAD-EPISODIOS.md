# Problema: Upload de Episódios Falhando

## Diagnóstico

Analisando os logs do Render, identifiquei que **TODOS os 5 episódios** da série "Tremembé" falharam com o mesmo erro:

```
[ERROR] Failed to initialize upload: The request signature we calculated does not match the signature you provided. Check your key and signing method.
```

### Evidências dos Logs:

1. **S01E05** - 20:18:43 - ❌ ERRO
2. **S01E04** - 20:18:44 - ❌ ERRO
3. **S01E03** - 20:18:44 - ❌ ERRO
4. **S01E02** - 20:18:45 - ❌ ERRO
5. **S01E01** - 20:18:47 - ❌ ERRO

## Causa Raiz

**As credenciais AWS S3 configuradas no Render estão INCORRETAS ou EXPIRADAS!**

Esse erro específico significa que:
- `AWS_ACCESS_KEY_ID` está incorreto, OU
- `AWS_SECRET_ACCESS_KEY` está incorreto, OU
- As credenciais expiraram e precisam ser renovadas

## Solução

### 1. Verificar Credenciais AWS Locais

Primeiro, vamos confirmar que as credenciais no arquivo `.env` local estão corretas:

```bash
# No arquivo backend/.env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-2
S3_RAW_BUCKET=cinevision-raw
```

### 2. Testar Credenciais Localmente

Execute o upload de um episódio **localmente** para confirmar que as credenciais funcionam:

```bash
cd backend
npm run dev
# Tente fazer upload de um episódio pelo dashboard local
```

### 3. Atualizar Credenciais no Render

Se as credenciais locais funcionarem, você precisa atualizar no Render:

**Opção A - Via Dashboard Render:**
1. Acesse: https://dashboard.render.com/web/srv-d3mp4ibipnbc73ctm470
2. Vá em "Environment"
3. Verifique/Atualize:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`
   - `S3_RAW_BUCKET`
4. Clique em "Save Changes"
5. O serviço fará redeploy automaticamente

**Opção B - Via Script (posso fazer isso para você):**
```bash
# Posso usar o MCP do Render para atualizar as variáveis de ambiente
```

## Por que uploads de filmes funcionam mas episódios não?

Ambos usam a mesma API S3, então se um falha, o outro também deveria falhar. Possíveis razões:

1. **As credenciais foram atualizadas recentemente** e os uploads de filmes foram feitos antes
2. **Cache de credenciais** - o serviço pode ter cache das credenciais antigas
3. **Bucket diferente** - verificar se S3_RAW_BUCKET está correto

## Próximos Passos

1. ✅ Confirme que as credenciais no `.env` local estão corretas
2. ✅ Teste upload de episódio localmente
3. ✅ Se funcionar localmente, atualize no Render
4. ✅ Aguarde redeploy (~2-3 min)
5. ✅ Tente fazer upload dos episódios novamente

## Credenciais AWS Corretas

As credenciais devem ser de um usuário IAM com as seguintes permissões no bucket `cinevision-raw`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": [
        "arn:aws:s3:::cinevision-raw/*",
        "arn:aws:s3:::cinevision-raw"
      ]
    }
  ]
}
```

---

**Status**: 🔴 CRÍTICO - Upload de episódios completamente bloqueado
**Impacto**: Não é possível fazer upload de nenhum episódio até corrigir as credenciais
**Prioridade**: ALTA - Precisa ser resolvido imediatamente
