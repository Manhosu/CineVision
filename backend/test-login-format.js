const axios = require('axios');

async function testLogin() {
    try {
        const response = await axios.post('http://localhost:3001/api/v1/supabase-auth/login', {
            email: 'cinevision@teste.com',
            password: 'teste123'
        });

        console.log('Login Response:');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

testLogin();
