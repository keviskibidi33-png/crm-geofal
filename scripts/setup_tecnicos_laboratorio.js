const { createClient } = require("@supabase/supabase-js")
require("dotenv").config({ path: ".env.local" })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ROLE_NAME = "tecnico"
const ROLE_LABEL = "Tecnico de Laboratorio"
const ROLE_DESCRIPTION = "Acceso tecnico a Proctor, CBR, Humedad y LLP"

const REQUIRED_MODULE_PERMISSIONS = {
  proctor: { read: true, write: true, delete: false },
  cbr: { read: true, write: true, delete: false },
  llp: { read: true, write: true, delete: false },
  humedad: { read: true, write: true, delete: false },
  cont_humedad: { read: true, write: true, delete: false },
}

const USERS = [
  {
    email: "tecnico1@geofal.com.pe",
    password: "TecLab1@2026!",
    full_name: "Tecnico Laboratorio 1",
  },
  {
    email: "tecnico2@geofal.com.pe",
    password: "TecLab2@2026!",
    full_name: "Tecnico Laboratorio 2",
  },
  {
    email: "tecnico3@geofal.com.pe",
    password: "TecLab3@2026!",
    full_name: "Tecnico Laboratorio 3",
  },
]

async function listAllAuthUsers() {
  const pageSize = 200
  let page = 1
  const users = []

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: pageSize })
    if (error) throw error

    const batch = data?.users || []
    users.push(...batch)

    if (batch.length < pageSize) break
    page += 1
  }

  return users
}

async function upsertRoleWithRequiredPermissions() {
  const { data: existingRole, error: readRoleError } = await supabase
    .from("role_definitions")
    .select("role_id,label,description,permissions")
    .eq("role_id", ROLE_NAME)
    .maybeSingle()

  if (readRoleError) {
    throw readRoleError
  }

  const { error: upsertRoleError } = await supabase.from("role_definitions").upsert(
    {
      role_id: ROLE_NAME,
      label: existingRole?.label || ROLE_LABEL,
      description: existingRole?.description || ROLE_DESCRIPTION,
      permissions: REQUIRED_MODULE_PERMISSIONS,
      is_system: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "role_id" }
  )

  if (upsertRoleError) {
    throw upsertRoleError
  }

  return REQUIRED_MODULE_PERMISSIONS
}

async function createOrUpdateAuthUser(existingUsersByEmail, account) {
  const existing = existingUsersByEmail.get(account.email)

  if (existing) {
    const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
      password: account.password,
      email_confirm: true,
      user_metadata: {
        role: ROLE_NAME,
        full_name: account.full_name,
      },
    })

    if (updateError) throw updateError
    return { id: existing.id, action: "updated" }
  }

  const { data: createdData, error: createError } = await supabase.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: {
      role: ROLE_NAME,
      full_name: account.full_name,
    },
  })

  if (createError) throw createError

  return { id: createdData.user.id, action: "created" }
}

async function upsertProfile(userId, account) {
  const { error: profileError } = await supabase.from("perfiles").upsert({
    id: userId,
    role: ROLE_NAME,
    email: account.email,
    full_name: account.full_name,
    updated_at: new Date().toISOString(),
  })

  if (profileError) throw profileError
}

async function main() {
  console.log("1) Reading current role and applying required module permissions...")
  const finalPermissions = await upsertRoleWithRequiredPermissions()
  console.log("Role updated:", ROLE_NAME)
  console.log("Enabled modules:", Object.keys(REQUIRED_MODULE_PERMISSIONS).join(", "))

  console.log("2) Reading auth users for upsert...")
  const existingUsers = await listAllAuthUsers()
  const existingUsersByEmail = new Map(existingUsers.map((u) => [String(u.email || "").toLowerCase(), u]))

  console.log("3) Creating/updating accounts and perfiles...")
  const results = []
  for (const account of USERS) {
    const normalizedEmail = account.email.toLowerCase()
    const authResult = await createOrUpdateAuthUser(existingUsersByEmail, { ...account, email: normalizedEmail })
    await upsertProfile(authResult.id, { ...account, email: normalizedEmail })
    results.push({
      email: normalizedEmail,
      full_name: account.full_name,
      role: ROLE_NAME,
      auth_action: authResult.action,
      user_id: authResult.id,
    })
  }

  console.log("4) Done.")
  console.log(
    JSON.stringify(
      {
        role: ROLE_NAME,
        role_enabled_modules: finalPermissions
          ? Object.keys(REQUIRED_MODULE_PERMISSIONS).reduce((acc, key) => {
              acc[key] = finalPermissions[key]
              return acc
            }, {})
          : {},
        accounts: results,
      },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error("Error in setup_tecnicos_laboratorio:", err)
  process.exit(1)
})
