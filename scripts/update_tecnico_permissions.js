
const { createClient } = require('@supabase/supabase-js');
const {
  TECNICO_ROLE_NAME,
  TECNICO_ROLE_LABEL,
  TECNICO_ROLE_DESCRIPTION,
  TECNICO_ROLE_PERMISSIONS,
} = require('./tecnico_role_config');

// Load environment variables manually or use dotenv if available
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const ROLE_NAME = TECNICO_ROLE_NAME;

async function main() {
  console.log(`Updating permissions for role '${ROLE_NAME}'...`);

  // Fetch existing role definition to preserve other fields
  const { error: fetchError } = await supabase
    .from('role_definitions')
    .select('*')
    .eq('role_id', ROLE_NAME)
    .single();

  if (fetchError) {
    console.error('Error fetching role definition:', fetchError);
    process.exit(1);
  }

  const newPermissions = TECNICO_ROLE_PERMISSIONS;

  console.log('New Permissions:', JSON.stringify(newPermissions, null, 2));

  // Update DB
  const { error: updateError } = await supabase
    .from('role_definitions')
    .update({
      label: TECNICO_ROLE_LABEL,
      description: TECNICO_ROLE_DESCRIPTION,
      permissions: newPermissions,
      updated_at: new Date().toISOString()
    })
    .eq('role_id', ROLE_NAME);

  if (updateError) {
    console.error('Error updating role:', updateError);
    process.exit(1);
  }

  console.log('Role permissions updated successfully.');
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
