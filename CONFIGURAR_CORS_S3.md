# Configurar CORS no Bucket S3

O upload de vídeos está funcionando, mas está sendo bloqueado por CORS. Você precisa configurar o CORS no bucket S3 `cinevision-video`.

## ⚠️ PROBLEMA ATUAL

```
Access to fetch at 'https://cinevision-video.s3.us-east-2.amazonaws.com/...'
from origin 'http://localhost:3000' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present
```

## ✅ SOLUÇÃO

### Opção 1: Via AWS Console (Recomendado)

1. Acesse o AWS Console: https://s3.console.aws.amazon.com/s3/buckets/cinevision-video?region=us-east-2&tab=permissions

2. Clique na aba **"Permissions"**

3. Role até **"Cross-origin resource sharing (CORS)"**

4. Clique em **"Edit"**

5. Cole a seguinte configuração JSON:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": [
            "ETag",
            "x-amz-server-side-encryption",
            "x-amz-request-id",
            "x-amz-id-2",
            "x-amz-version-id"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

6. Clique em **"Save changes"**

### Opção 2: Via AWS CLI com credenciais administrativas

Se você tem AWS CLI configurado com credenciais de administrador:

```bash
# Navegue até a pasta do projeto
cd "C:\Users\delas\OneDrive\Documentos\Projetos\Filmes"

# Execute o script Python
python configure-s3-cors.py
```

Ou use o AWS CLI diretamente:

```bash
# Criar arquivo de configuração CORS
cat > cors-config.json << EOF
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "x-amz-server-side-encryption", "x-amz-request-id", "x-amz-id-2"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

# Aplicar configuração CORS
aws s3api put-bucket-cors --bucket cinevision-video --cors-configuration file://cors-config.json
```

## 🧪 TESTAR

Depois de configurar o CORS:

1. **Recarregue a página** no navegador (Ctrl+Shift+R)
2. Acesse `http://localhost:3000/admin/content/create`
3. Crie um novo filme ou edite o Superman
4. Adicione os arquivos de vídeo:
   - Dublado: `E:\movies\FILME_ Superman (2025)\Superman (2025) - DUBLADO.mkv`
   - Legendado: `E:\movies\FILME_ Superman (2025)\Superman (2025) - LEGENDADO.mp4`
5. Clique em **"Finalizar"**
6. A barra de progresso deve aparecer e o upload deve funcionar! ✨

## 📊 PROGRESSO ATUAL

✅ Upload iniciando corretamente
✅ Barra de progresso aparecendo
✅ Arquivos sendo detectados
✅ Requisições sendo enviadas ao S3
❌ **Bloqueado por CORS** ← Você está aqui!

Depois de configurar o CORS, o upload vai funcionar completamente! 🚀
