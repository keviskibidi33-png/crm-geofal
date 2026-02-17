
const { createClient } = require('@supabase/supabase-js');

// Load environment variables manually or use dotenv if available
// Assuming we run this from crm-geofal root where .env.local exists
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
const ROLE_LABEL = 'Técnico de Laboratorio';
const USER_EMAIL = 'tecnico1@geofal.com.pe';
const USER_PASSWORD = 'tecnico@geofal2026-';

const PERMISSIONS = {
  // Core modules requested
  recepcion: { read: true, write: true, delete: false },
  verificacion_muestras: { read: true, write: true, delete: false },
  compresion: { read: true, write: true, delete: false },
  
  // Tracking/Scheduling
  programacion: { read: true, write: true, delete: false },
  laboratorio: { read: true, write: true, delete: false }, // General lab access
  
  // Basic access
  configuracion: { read: true, write: false, delete: false },
  
  // Others (default false)
  clientes: { read: true, write: false, delete: false }, // Technicians might need to see clients
  proyectos: { read: true, write: false, delete: false }, // Technicians might need to see projects
  cotizadora: { read: false, write: false, delete: false },
  comercial: { read: false, write: false, delete: false },
  administracion: { read: false, write: false, delete: false },
  usuarios: { read: false, write: false, delete: false },
  auditoria: { read: false, write: false, delete: false },
  permisos: { read: false, write: false, delete: false }
};

async function main() {
  console.log(`Starting setup for role '${ROLE_NAME}' and user '${USER_EMAIL}'...`);

  // 1. Upsert Role Definition
  console.log('Upserting role definition...');
  const { error: roleError } = await supabase
    .from('role_definitions')
    .upsert({
      role_id: ROLE_NAME,
      label: ROLE_LABEL,
      description: 'Acceso a Recepción, Verificación, Compresión y Tracking',
      permissions: PERMISSIONS,
      is_system: false,
      updated_at: new Date().toISOString()
    }, { onConflict: 'role_id' });

  if (roleError) {
    console.error('Error upserting role:', roleError);
    // Don't exit, try to continue user creation might work if role exists
  } else {
    console.log('Role definition upserted successfully.');
  }

  // 2. Create or Update User
  console.log('Checking if user exists...');
  // We can't list users easily by email with admin api? Yes we can.
  // But createUser with existing email will return error/existing user.
  
  // Try to create user
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email: USER_EMAIL,
    password: USER_PASSWORD,
    email_confirm: true,
    user_metadata: {
        role: ROLE_NAME
    }
  });

  let userId;

  if (createError) {
    console.log('User creation result:', createError.message);
    if (createError.message.includes('already been registered')) {
        // User exists, get ID to update password/role
        // We need to list users or just update by email? 
        // admin.listUsers() is available.
        console.log('User already exists. Updating password and metadata...');
        
        // Find user by email
        const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) {
             console.error('Error listing users:', listError);
             process.exit(1);
        }
        
        const existingUser = listData.users.find(u => u.email === USER_EMAIL);
        if (!existingUser) {
            console.error('Could not find existing user even though create failed with existing message.');
            process.exit(1);
        }
        userId = existingUser.id;

        // Update user
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            userId,
            {
                password: USER_PASSWORD,
                user_metadata: { role: ROLE_NAME }
            }
        );
        
        if (updateError) {
            console.error('Error updating user:', updateError);
            process.exit(1);
        }
        console.log('User updated successfully.');
    } else {
        console.error('Error creating user:', createError);
        process.exit(1);
    }
  } else {
    userId = userData.user.id;
    console.log('User created successfully. ID:', userId);
  }

  // 3. Update 'perfiles' table
  // The trigger might handle this, but let's be sure.
  console.log('Updating perfiles table...');
  
  // Check if profile exists
  const { data: profile, error: profileGetError } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileGetError && profileGetError.code !== 'PGRST116') { // PGRST116 is no rows
      console.error('Error checking profile:', profileGetError);
  }

  const profileData = {
      id: userId,
      role: ROLE_NAME,
      email: USER_EMAIL,
      full_name: 'Técnico Laboratorio 1',
      updated_at: new Date().toISOString()
  };

  const { error: profileError } = await supabase
    .from('perfiles')
    .upsert(profileData);

  if (profileError) {
    console.error('Error updating perfiles:', profileError);
  } else {
    console.log('Perfiles table updated successfully.');
  }

  console.log('Setup complete.');
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
