import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://mxzjtjopivzdgsexdhqp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14emp0am9waXZ6ZGdzZXhkaHFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzU5MjI5MywiZXhwIjoyMDQ5MTY4MjkzfQ.QFMm1DlQnV3UH95V74Mv3Q16tBGilqJ3hB17ZuDsD-c'
);

async function fixPurchaseStatus() {
  console.log('Updating purchase status from PAID to paid...\n');

  const { data, error } = await supabase
    .from('purchases')
    .update({ status: 'paid' })
    .eq('status', 'PAID')
    .select();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Updated ${data?.length || 0} purchases`);
  console.log(JSON.stringify(data, null, 2));
}

fixPurchaseStatus();
