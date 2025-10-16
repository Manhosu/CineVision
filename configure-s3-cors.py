#!/usr/bin/env python3
"""
Script para configurar CORS no bucket S3 cinevision-video.

Este script requer credenciais AWS com permissões administrativas.
Execute com: python configure-s3-cors.py
"""

import boto3
import json
from botocore.exceptions import ClientError

def configure_s3_cors():
    """Configura CORS no bucket S3 para permitir uploads do frontend."""

    # Nome do bucket
    bucket_name = 'cinevision-video'

    # Configuração CORS
    cors_configuration = {
        'CORSRules': [
            {
                'AllowedOrigins': [
                    'http://localhost:3000',
                    'http://localhost:3001',
                    'https://*.vercel.app',
                    '*'  # Para desenvolvimento - remover em produção
                ],
                'AllowedMethods': ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                'AllowedHeaders': ['*'],
                'ExposeHeaders': [
                    'ETag',
                    'x-amz-server-side-encryption',
                    'x-amz-request-id',
                    'x-amz-id-2',
                    'x-amz-version-id'
                ],
                'MaxAgeSeconds': 3000
            }
        ]
    }

    try:
        # Criar cliente S3
        s3_client = boto3.client('s3', region_name='us-east-2')

        print(f'Configurando CORS no bucket: {bucket_name}')
        print(f'Configuração CORS:\n{json.dumps(cors_configuration, indent=2)}')

        # Aplicar configuração CORS
        s3_client.put_bucket_cors(
            Bucket=bucket_name,
            CORSConfiguration=cors_configuration
        )

        print(f'\n✅ CORS configurado com sucesso no bucket {bucket_name}!')

        # Verificar a configuração
        print('\nVerificando configuração CORS...')
        cors_rules = s3_client.get_bucket_cors(Bucket=bucket_name)
        print(f'Configuração atual:\n{json.dumps(cors_rules["CORSRules"], indent=2)}')

    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']

        print(f'\n❌ Erro ao configurar CORS:')
        print(f'   Código: {error_code}')
        print(f'   Mensagem: {error_message}')

        if error_code == 'AccessDenied':
            print('\n⚠️  Você precisa executar este script com credenciais AWS administrativas.')
            print('   Configure o AWS CLI com credenciais de administrador:')
            print('   $ aws configure --profile admin')
            print('   $ AWS_PROFILE=admin python configure-s3-cors.py')

        return False

    return True

if __name__ == '__main__':
    print('=' * 60)
    print('Configuração de CORS para S3 - Cine Vision')
    print('=' * 60)
    print()

    success = configure_s3_cors()

    if success:
        print('\n✨ Configuração concluída! Agora você pode fazer uploads do frontend.')
    else:
        print('\n⚠️  Configuração falhou. Verifique as credenciais AWS.')
        print('\n📝 Instruções alternativas:')
        print('   1. Acesse o AWS Console: https://console.aws.amazon.com/s3')
        print('   2. Selecione o bucket "cinevision-video"')
        print('   3. Vá em "Permissions" → "Cross-origin resource sharing (CORS)"')
        print('   4. Cole a seguinte configuração:')
        print()
        print(json.dumps({
            'CORSRules': [{
                'AllowedOrigins': ['*'],
                'AllowedMethods': ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                'AllowedHeaders': ['*'],
                'ExposeHeaders': ['ETag', 'x-amz-server-side-encryption', 'x-amz-request-id', 'x-amz-id-2'],
                'MaxAgeSeconds': 3000
            }]
        }, indent=2))
