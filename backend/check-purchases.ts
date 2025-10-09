import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://mxzjtjopivzdgsexdhqp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14emp0am9waXZ6ZGdzZXhkaHFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzU5MjI5MywiZXhwIjoyMDQ5MTY4MjkzfQ.QFMm1DlQnV3UH95V74Mv3Q16tBGilqJ3hB17ZuDsD-c'
);

async function checkPurchases() {
  console.log('Checking purchases for user: 61cf8d35-2692-4507-9784-176a3fc047cd\n');

  const { data, error } = await supabase
    .from('purchases')
    .select('*')
    .eq('user_id', '61cf8d35-2692-4507-9784-176a3fc047cd');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${data?.length || 0} purchases:`);
  console.log(JSON.stringify(data, null, 2));

  // Also check with email
  console.log('\n\nChecking user by email:');
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'eduardogelista@gmail.com');

  if (userError) {
    console.error('User Error:', userError);
  } else {
    console.log('User data:', JSON.stringify(userData, null, 2));
  }
}

checkPurchases();
