/**
 * Script: create_beatriz_user.js
 * Purpose: Creates a new user "Beatriz Parinango García" with role oficina_tecnica,
 *          mirroring the same access as Geraldine (officinatecnica2@geofal.com.pe).
 * Run from: crm-geofal root
 * Command: node scripts/create_beatriz_user.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ── New user configuration ──────────────────────────────────────────────────
const USER_EMAIL    = 'oficinatecnica6@geofal.com.pe';
const USER_PASSWORD = 'oficina@geofal2026-';
const ROLE_NAME     = 'oficina_tecnica';
const FULL_NAME     = 'Beatriz Parinango García';
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Creating user: ${FULL_NAME} <${USER_EMAIL}>`);
  console.log(`   Role: ${ROLE_NAME}\n`);

  // Step 1 – Create auth user
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email: USER_EMAIL,
    password: USER_PASSWORD,
    email_confirm: true,
    user_metadata: { role: ROLE_NAME },
  });

  let userId;

  if (createError) {
    if (createError.message.includes('already been registered')) {
      console.warn('⚠️  User already exists. Fetching existing ID...');
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        console.error('❌ Error listing users:', listError);
        process.exit(1);
      }
      const existing = listData.users.find((u) => u.email === USER_EMAIL);
      if (!existing) {
        console.error('❌ Could not find existing user by email.');
        process.exit(1);
      }
      userId = existing.id;

      // Update password + metadata in case they differ
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password: USER_PASSWORD,
        user_metadata: { role: ROLE_NAME },
      });
      if (updateError) {
        console.error('❌ Error updating user:', updateError);
        process.exit(1);
      }
      console.log('✅ Existing user updated. ID:', userId);
    } else {
      console.error('❌ Error creating user:', createError);
      process.exit(1);
    }
  } else {
    userId = userData.user.id;
    console.log('✅ Auth user created. ID:', userId);
  }

  // Step 2 – Upsert profile in perfiles table
  console.log('\n📝 Upserting perfiles record...');
  const { error: profileError } = await supabase.from('perfiles').upsert({
    id: userId,
    role: ROLE_NAME,
    email: USER_EMAIL,
    full_name: FULL_NAME,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    console.error('❌ Error upserting perfiles:', profileError);
    process.exit(1);
  }

  console.log('✅ Perfil guardado correctamente.\n');
  console.log('─────────────────────────────────────────');
  console.log('  Usuario creado exitosamente');
  console.log(`  Nombre : ${FULL_NAME}`);
  console.log(`  Email  : ${USER_EMAIL}`);
  console.log(`  Rol    : ${ROLE_NAME}`);
  console.log(`  Pass   : ${USER_PASSWORD}`);
  console.log('─────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error('❌ Unhandled error:', err);
  process.exit(1);
});
