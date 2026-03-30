/**
 * Script: setup_beatriz_role.js
 * Purpose: Creates a custom role "oficina_tecnica_beatriz" in role_definitions with all
 *          base oficina_tecnica permissions PLUS the additional lab modules requested for
 *          Beatriz Parinango García (oficinatecnica6@geofal.com.pe).
 *          Also updates her perfiles.role to this new role so it takes effect immediately
 *          without requiring a Docker rebuild.
 *
 * Run from: crm-geofal root
 * Command : node scripts/setup_beatriz_role.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USER_EMAIL  = 'oficinatecnica6@geofal.com.pe';
const ROLE_ID     = 'oficina_tecnica_beatriz';
const ROLE_LABEL  = 'Oficina Técnica – Laboratorio';

// Full permission matrix: base oficina_tecnica + extra lab modules
const PERMISSIONS = {
  // ── Base oficina_tecnica ──────────────────────────────────────────
  tracing:              { read: true,  write: false, delete: false },
  clientes:             { read: true,  write: false, delete: false },
  proyectos:            { read: true,  write: false, delete: false },
  programacion:         { read: true,  write: false, delete: false },
  laboratorio:          { read: true,  write: false, delete: false },
  recepcion:            { read: true,  write: true,  delete: false },
  verificacion:         { read: true,  write: true,  delete: false },
  verificacion_muestras:{ read: true,  write: true,  delete: false },
  compresion:           { read: true,  write: true,  delete: false },
  humedad:              { read: true,  write: true,  delete: false },
  cont_humedad:         { read: true,  write: true,  delete: false },
  planas:               { read: true,  write: true,  delete: false },
  caras:                { read: true,  write: true,  delete: false },
  equi_arena:           { read: true,  write: true,  delete: false },
  configuracion:        { read: true,  write: false, delete: false },

  // ── Extra módulos solicitados ─────────────────────────────────────
  gran_suelo:              { read: true, write: true, delete: false }, // Granulometría Fino
  gran_agregado:           { read: true, write: true, delete: false }, // Granulometría Grueso
  ge_fino:                 { read: true, write: true, delete: false }, // GE Fino
  ge_grueso:               { read: true, write: true, delete: false }, // GE Grueso
  cloro_soluble:           { read: true, write: true, delete: false }, // Cloruros
  sulfatos_solubles:       { read: true, write: true, delete: false }, // Sulfatos
  ph:                      { read: true, write: true, delete: false }, // PH Suelo
  cd:                      { read: true, write: true, delete: false }, // Corte Directo
  compresion_no_confinada: { read: true, write: true, delete: false }, // Confinado (Comp. No Confinada)
  tamiz:                   { read: true, write: true, delete: false }, // Malla 200
  sales_solubles:          { read: true, write: true, delete: false }, // Sales Solubles

  // ── Accesos bloqueados explícitamente ────────────────────────────
  comercial:      { read: false, write: false, delete: false },
  administracion: { read: false, write: false, delete: false },
  usuarios:       { read: false, write: false, delete: false },
  auditoria:      { read: false, write: false, delete: false },
  permisos:       { read: false, write: false, delete: false },
};

async function main() {
  console.log(`\n🚀 Setting up custom role for: ${USER_EMAIL}`);
  console.log(`   Role ID: ${ROLE_ID}\n`);

  // 1 – Upsert custom role in role_definitions
  console.log('📋 Upserting role definition...');
  const { error: roleError } = await supabase
    .from('role_definitions')
    .upsert({
      role_id:     ROLE_ID,
      label:       ROLE_LABEL,
      description: 'Oficina Técnica con acceso extendido a módulos de laboratorio de suelos y agregados.',
      permissions: PERMISSIONS,
      is_system:   false,
      updated_at:  new Date().toISOString(),
    }, { onConflict: 'role_id' });

  if (roleError) {
    console.error('❌ Error upserting role:', roleError);
    process.exit(1);
  }
  console.log('✅ Role definition upserted.');

  // 2 – Update perfiles.role for Beatriz
  console.log('\n👤 Updating perfiles.role for Beatriz...');
  const { error: profileError } = await supabase
    .from('perfiles')
    .update({ role: ROLE_ID, updated_at: new Date().toISOString() })
    .eq('email', USER_EMAIL);

  if (profileError) {
    console.error('❌ Error updating perfiles:', profileError);
    process.exit(1);
  }
  console.log('✅ Profile role updated.');

  // 3 – Update auth user_metadata.role
  console.log('\n🔐 Updating auth user metadata...');
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('❌ Error listing auth users:', listError);
    process.exit(1);
  }
  const authUser = listData.users.find(u => u.email === USER_EMAIL);
  if (!authUser) {
    console.error('❌ Auth user not found for email:', USER_EMAIL);
    process.exit(1);
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
    user_metadata: { role: ROLE_ID },
  });
  if (updateError) {
    console.error('❌ Error updating auth metadata:', updateError);
    process.exit(1);
  }
  console.log('✅ Auth metadata updated.');

  console.log('\n─────────────────────────────────────────────────────');
  console.log('  ✅ Beatriz configurada correctamente');
  console.log(`  Rol  : ${ROLE_ID} (${ROLE_LABEL})`);
  console.log(`  Email: ${USER_EMAIL}`);
  console.log('  Los cambios toman efecto en el próximo login.');
  console.log('─────────────────────────────────────────────────────\n');
}

main().catch(err => {
  console.error('❌ Unhandled error:', err);
  process.exit(1);
});
