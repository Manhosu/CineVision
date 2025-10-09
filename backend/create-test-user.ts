import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://szghyvnbmjlquznxhqum.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6Z2h5dm5ibWpscXV6bnhocXVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0OTk5OSwiZXhwIjoyMDc0MzI1OTk5fQ.p9_G_CjLg8h2CVZqteKLdK9WUFKFdXSqTuTolHFiWGc';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createUser() {
  console.log('Creating user eduardogelista@gmail.com...');

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

  console.log('✅ User created successfully!');
  console.log('User ID:', data.user.id);
  console.log('Email:', data.user.email);
  console.log('Email confirmed:', data.user.email_confirmed_at);
}

createUser().catch(console.error);
