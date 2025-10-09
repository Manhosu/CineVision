import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixUserAuth() {
  // 1. Deletar usuário novo do Auth (ID errado)
  console.log('1. Deleting new user from auth...');
  await supabase.auth.admin.deleteUser('1c8f3b47-90ad-41ea-be3b-fd2d100f08b9');
  console.log('✅ Deleted new user');

  // 2. Verificar se já existe usuário com ID correto no Auth
  console.log('\n2. Checking if auth user exists with correct ID...');
  const { data: existingUser } = await supabase.auth.admin.getUserById('38789f6f-afc4-4eb5-8dbe-f9b69b01435a');

  if (existingUser.user) {
    console.log('✅ User already exists in auth with correct ID');
    console.log('Email:', existingUser.user.email);

    // Atualizar senha se necessário
    console.log('\n3. Updating password...');
    await supabase.auth.admin.updateUserById('38789f6f-afc4-4eb5-8dbe-f9b69b01435a', {
      password: 'Teste123',
      email_confirm: true
    });
    console.log('✅ Password updated');
  } else {
    // Criar usuário com ID correto
    console.log('⚠️ User does not exist in auth, creating...');
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'eduardogelista@gmail.com',
      password: 'Teste123',
      email_confirm: true,
      user_metadata: {
        name: 'Eduardo Gelista',
        role: 'user'
      }
    });

    if (error) {
      console.error('Error creating user:', error);
      process.exit(1);
    }

    console.log('✅ User created with ID:', data.user.id);
  }

  console.log('\n✅ All done! You can now login with:');
  console.log('Email: eduardogelista@gmail.com');
  console.log('Password: Teste123');
}

fixUserAuth().catch(console.error);
