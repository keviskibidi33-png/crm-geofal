
const { createClient } = require('@supabase/supabase-js');

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

const ROLE_NAME = 'tecnico';

async function main() {
  console.log(`Updating permissions for role '${ROLE_NAME}'...`);

  // Fetch existing role definition to preserve other fields
  const { data: roleDef, error: fetchError } = await supabase
    .from('role_definitions')
    .select('*')
    .eq('role_id', ROLE_NAME)
    .single();

  if (fetchError) {
    console.error('Error fetching role definition:', fetchError);
    process.exit(1);
  }

  const currentPermissions = roleDef.permissions || {};
  
  // Update permissions
  const newPermissions = {
    ...currentPermissions,
    // Disable access to Clientes and Proyectos
    clientes: { read: false, write: false, delete: false },
    proyectos: { read: false, write: false, delete: false },
    
    // Enable access to Tracing (Seguimiento)
    tracing: { read: true, write: true, delete: false },
    
    // Ensure other modules remain as intended (re-asserting for clarity)
    recepcion: { read: true, write: true, delete: false },
    verificacion_muestras: { read: true, write: true, delete: false },
    compresion: { read: true, write: true, delete: false },
    programacion: { read: true, write: true, delete: false },
    laboratorio: { read: true, write: true, delete: false },
    configuracion: { read: true, write: false, delete: false },
  };

  console.log('New Permissions:', JSON.stringify(newPermissions, null, 2));

  // Update DB
  const { error: updateError } = await supabase
    .from('role_definitions')
    .update({
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
