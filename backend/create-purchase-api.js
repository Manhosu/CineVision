const axios = require('axios');

const API_URL = 'http://localhost:3001/api/v1';
const CONTENT_ID = 'cea7478d-abcd-4039-bb1b-b15839da4cfe'; // Invocação do Mal 4
const TEST_EMAIL = 'cinevision@teste.com';

async function main() {
    console.log('='.repeat(60));
    console.log('ADICIONAR COMPRA - Invocacao do Mal 4');
    console.log('='.repeat(60));

    try {
        // 1. Login do usuário
        console.log(`\n1. Fazendo login: ${TEST_EMAIL}`);
        const loginResponse = await axios.post(`${API_URL}/supabase-auth/login`, {
            email: TEST_EMAIL,
            password: 'teste123'
        });

        console.log('OK - Login bem-sucedido');
        const token = loginResponse.data.access_token || loginResponse.data.token;
        const userId = loginResponse.data.id || loginResponse.data.user_id || loginResponse.data.user?.id;

        console.log(`User ID: ${userId}`);
        console.log(`Token: ${token.substring(0, 50)}...`);

        // 2. Verificar compras existentes
        console.log(`\n2. Verificando compras existentes...`);
        try {
            const purchasesResponse = await axios.get(`${API_URL}/purchases/user/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const hasContent = purchasesResponse.data.some(p => p.content_id === CONTENT_ID);

            console.log(`OK - Total de compras: ${purchasesResponse.data.length}`);

            if (hasContent) {
                console.log('AVISO: Usuario ja possui este filme!');
            }
        } catch (error) {
            console.log('Sem compras anteriores ou erro ao buscar');
        }

        // 3. Criar compra via SQL direto no Supabase (usando endpoint de diagnóstico)
        console.log(`\n3. Criando compra...`);

        const purchaseId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const paymentId = `payment-${Date.now()}`;

        const createSQL = `
            INSERT INTO purchases (
                id,
                user_id,
                content_id,
                price_paid_cents,
                currency,
                status,
                purchased_at,
                payment_method,
                payment_id
            ) VALUES (
                '${purchaseId}',
                '${userId}',
                '${CONTENT_ID}',
                720,
                'BRL',
                'COMPLETED',
                NOW(),
                'MANUAL',
                '${paymentId}'
            )
            ON CONFLICT (id) DO NOTHING
            RETURNING *;
        `;

        // Executar via endpoint de teste do Supabase
        const insertResponse = await axios.post(`${API_URL}/supabase-test/test-query`, {
            query: createSQL
        });

        console.log('OK - Compra criada com sucesso!');
        console.log(`Purchase ID: ${purchaseId}`);
        console.log(`Payment ID: ${paymentId}`);
        console.log(`Valor: R$ 7,20`);

        // 4. Verificar áudios
        console.log(`\n4. Verificando audios do filme...`);
        const audiosResponse = await axios.get(`${API_URL}/content-language-upload/languages/${CONTENT_ID}`);

        console.log(`OK - Encontrados ${audiosResponse.data.length} audios:`);
        audiosResponse.data.forEach(audio => {
            console.log(`   - ${audio.language_name} | Status: ${audio.upload_status || audio.status}`);
            if (audio.video_url) {
                console.log(`     URL: ${audio.video_url.substring(0, 80)}...`);
            }
        });

        // 5. Informações finais
        console.log(`\n${'='.repeat(60)}`);
        console.log('PROCESSO CONCLUIDO!');
        console.log('='.repeat(60));
        console.log(`\nAcesse: http://localhost:3000/dashboard`);
        console.log(`Login: ${TEST_EMAIL}`);
        console.log(`Senha: teste123`);
        console.log(`\nO filme 'Invocacao do Mal 4' deve aparecer em 'Minhas Compras'`);
        console.log(`Com audio dublado em Portugues Brasil`);

    } catch (error) {
        console.error('\nERRO:', error.response?.data || error.message);
        if (error.response?.data) {
            console.error('Detalhes:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

main();
