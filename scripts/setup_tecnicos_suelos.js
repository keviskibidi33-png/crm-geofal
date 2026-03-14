require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const {
  TECNICO_SUELOS_ROLE_NAME,
  TECNICO_SUELOS_ROLE_LABEL,
  TECNICO_SUELOS_ROLE_DESCRIPTION,
  TECNICO_SUELOS_ROLE_PERMISSIONS,
} = require('./tecnico_suelos_role_config')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const USERS = [
  'tecnico2@geofal.com.pe',
  'tecnico3@geofal.com.pe',
]

async function upsertRole() {
  const { error } = await supabase.from('role_definitions').upsert(
    {
      role_id: TECNICO_SUELOS_ROLE_NAME,
      label: TECNICO_SUELOS_ROLE_LABEL,
      description: TECNICO_SUELOS_ROLE_DESCRIPTION,
      permissions: TECNICO_SUELOS_ROLE_PERMISSIONS,
      is_system: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'role_id' }
  )

  if (error) throw error
}

async function assignUsers() {
  const { data: profiles, error } = await supabase
    .from('perfiles')
    .select('id,email,full_name,role')
    .in('email', USERS)

  if (error) throw error

  for (const profile of profiles || []) {
    const { error: updateProfileError } = await supabase
      .from('perfiles')
      .update({ role: TECNICO_SUELOS_ROLE_NAME })
      .eq('id', profile.id)

    if (updateProfileError) throw updateProfileError

    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(profile.id, {
      user_metadata: {
        role: TECNICO_SUELOS_ROLE_NAME,
        full_name: profile.full_name,
      },
    })

    if (updateAuthError) throw updateAuthError

    console.log(`Asignado rol ${TECNICO_SUELOS_ROLE_NAME} a ${profile.email}`)
  }
}

async function main() {
  await upsertRole()
  await assignUsers()
  console.log('Rol tecnico_suelos creado/actualizado y usuarios reasignados.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
