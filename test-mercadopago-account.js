/**
 * Test script to verify Mercado Pago account configuration
 * Run: node test-mercadopago-account.js
 */

const axios = require('axios');

// Replace with your actual access token
const ACCESS_TOKEN = 'APP_USR-2790127687766077-110215-00693d48ca03833b472196039192a2eb-452973387';

async function testMercadoPagoAccount() {
  console.log('🔍 Testing Mercado Pago Account Configuration...\n');

  try {
    // 1. Test account info
    console.log('1️⃣ Checking account info...');
    const accountResponse = await axios.get('https://api.mercadopago.com/users/me', {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });

    console.log(`✅ Account ID: ${accountResponse.data.id}`);
    console.log(`✅ Email: ${accountResponse.data.email}`);
    console.log(`✅ Account Type: ${accountResponse.data.site_id}`);
    console.log(`✅ Nickname: ${accountResponse.data.nickname}`);
    console.log('');

    // 2. Test payment methods available
    console.log('2️⃣ Checking available payment methods...');
    const paymentMethodsResponse = await axios.get(
      `https://api.mercadopago.com/v1/payment_methods`,
      {
        headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
      }
    );

    const pixMethod = paymentMethodsResponse.data.find(m => m.id === 'pix');
    if (pixMethod) {
      console.log('✅ PIX is available as payment method');
      console.log(`   Status: ${pixMethod.status}`);
    } else {
      console.log('❌ PIX not found in available payment methods');
    }
    console.log('');

    // 3. Try to create a test PIX payment
    console.log('3️⃣ Testing PIX payment creation...');
    const paymentData = {
      transaction_amount: 0.01, // R$ 0.01 for testing
      description: 'Test PIX - CineVision',
      payment_method_id: 'pix',
      payer: {
        email: 'test@cinevision.com',
      }
    };

    const paymentResponse = await axios.post(
      'https://api.mercadopago.com/v1/payments',
      paymentData,
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        }
      }
    );

    console.log('✅ PIX payment created successfully!');
    console.log(`   Payment ID: ${paymentResponse.data.id}`);
    console.log(`   Status: ${paymentResponse.data.status}`);

    if (paymentResponse.data.point_of_interaction?.transaction_data?.qr_code) {
      console.log('✅ QR Code generated successfully!');
      console.log('\n📊 RESULT: Your Mercado Pago account is READY for PIX payments! 🎉\n');
    } else {
      console.log('❌ QR Code NOT generated');
      console.log('\n⚠️ RESULT: Account is partially configured. QR Code generation failed.\n');
    }

  } catch (error) {
    console.log('\n❌ ERROR DETAILS:\n');
    console.log(`Status: ${error.response?.status}`);
    console.log(`Message: ${error.response?.data?.message || error.message}`);
    console.log(`Cause: ${error.response?.data?.cause?.[0]?.description || 'Unknown'}`);

    console.log('\n📋 DIAGNOSIS:');

    if (error.response?.data?.message?.includes('without key enabled')) {
      console.log('❌ PIX is not enabled on your Mercado Pago account');
      console.log('\n📝 TO FIX:');
      console.log('1. Go to: https://www.mercadopago.com.br/');
      console.log('2. Navigate to "Seu negócio" → "Configurações" → "Meios de pagamento"');
      console.log('3. Enable PIX');
      console.log('4. Register a PIX key (CPF/CNPJ recommended)');
      console.log('5. Ensure your account type is "Vendedor" (not just personal)');
    } else if (error.response?.status === 401) {
      console.log('❌ Invalid access token or expired credentials');
      console.log('\n📝 TO FIX:');
      console.log('1. Go to: https://www.mercadopago.com.br/developers/panel/app');
      console.log('2. Regenerate your credentials');
      console.log('3. Update MERCADO_PAGO_ACCESS_TOKEN in Render');
    } else {
      console.log('❌ Unknown error - check response above');
    }

    console.log('\n');
  }
}

testMercadoPagoAccount();
