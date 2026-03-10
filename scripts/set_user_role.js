const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Usage:
//   node scripts/set_user_role.js <email> <role> [--name "Full Name"] [--password "NewPass"] [--ensure-role]
//
// Examples:
//   node scripts/set_user_role.js asesorcomercial1@geofal.com.pe auxiliar_comercial --ensure-role --name "Asesor Comercial 1"
//   node scripts/set_user_role.js user@geofal.com.pe vendor --name "Vendedor"
//
// Notes:
// - Loads env vars from crm-geofal/.env.local by default.
// - Requires SUPABASE service role key. Do NOT use in the browser.

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in crm-geofal/.env.local",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const AUXILIAR_COMERCIAL_ROLE_ID = "auxiliar_comercial";
const AUXILIAR_COMERCIAL_PERMISSIONS = {
  clientes: { read: true, write: true, delete: false },
  proyectos: { read: true, write: true, delete: false },
  cotizadora: { read: true, write: true, delete: false },
  programacion: { read: true, write: false, delete: false },
  recepcion: { read: false, write: false, delete: false },
  verificacion_muestras: { read: false, write: false, delete: false },
  compresion: { read: false, write: false, delete: false },
  tracing: { read: false, write: false, delete: false },
  humedad: { read: false, write: false, delete: false },
  cont_humedad: { read: false, write: false, delete: false },
  planas: { read: false, write: false, delete: false },
  caras: { read: false, write: false, delete: false },
  cbr: { read: false, write: false, delete: false },
  proctor: { read: false, write: false, delete: false },
  llp: { read: false, write: false, delete: false },
  gran_suelo: { read: false, write: false, delete: false },
  gran_agregado: { read: false, write: false, delete: false },
  abra: { read: false, write: false, delete: false },
  abrass: { read: false, write: false, delete: false },
  peso_unitario: { read: false, write: false, delete: false },
  tamiz: { read: false, write: false, delete: false },
  equi_arena: { read: false, write: false, delete: false },
  ge_fino: { read: false, write: false, delete: false },
  ge_grueso: { read: false, write: false, delete: false },
  usuarios: { read: false, write: false, delete: false },
  auditoria: { read: false, write: false, delete: false },
  configuracion: { read: true, write: false, delete: false },
  laboratorio: { read: true, write: false, delete: false },
  comercial: { read: true, write: true, delete: false },
  administracion: { read: true, write: false, delete: false },
  permisos: { read: false, write: false, delete: false },
};

function printUsageAndExit() {
  console.error(
    'Usage: node scripts/set_user_role.js <email> <role> [--name "Full Name"] [--password "NewPass"] [--ensure-role]',
  );
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      positional.push(a);
      continue;
    }
    if (a === "--ensure-role") {
      flags.ensureRole = true;
      continue;
    }
    if (a === "--name") {
      flags.name = argv[i + 1];
      i++;
      continue;
    }
    if (a === "--password") {
      flags.password = argv[i + 1];
      i++;
      continue;
    }
    console.error(`Unknown flag: ${a}`);
    printUsageAndExit();
  }

  return { positional, flags };
}

async function findUserIdByEmail(email) {
  const emailLower = String(email || "").toLowerCase().trim();
  if (!emailLower) return null;

  // Prefer perfiles lookup (faster than iterating auth users)
  const { data: profile, error: profileError } = await supabase
    .from("perfiles")
    .select("id")
    .eq("email", emailLower)
    .maybeSingle();

  if (profileError) {
    console.warn("Warning: perfiles lookup failed:", profileError.message || profileError);
  }
  if (profile?.id) return profile.id;

  // Fallback: scan auth users (paginated)
  const perPage = 200;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = Array.isArray(data?.users) ? data.users : [];
    const found = users.find((u) => String(u.email || "").toLowerCase().trim() === emailLower);
    if (found?.id) return found.id;
    if (users.length < perPage) break;
  }

  return null;
}

async function ensureAuxiliarComercialRole() {
  const { error } = await supabase.from("role_definitions").upsert(
    {
      role_id: AUXILIAR_COMERCIAL_ROLE_ID,
      label: "Auxiliar Comercial",
      description: "Soporte comercial (edición de cotizaciones, clientes y proyectos)",
      permissions: AUXILIAR_COMERCIAL_PERMISSIONS,
      is_system: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "role_id" },
  );

  if (error) {
    throw new Error(`Failed to upsert role_definitions: ${error.message || String(error)}`);
  }
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  if (positional.length < 2) printUsageAndExit();

  const email = String(positional[0] || "").toLowerCase().trim();
  const role = String(positional[1] || "").trim();
  const fullName = flags.name ? String(flags.name).trim() : null;
  const password = flags.password ? String(flags.password) : null;
  const ensureRole = flags.ensureRole === true;

  if (!email || !email.includes("@")) {
    console.error(`Invalid email: ${positional[0]}`);
    process.exit(1);
  }
  if (!role) {
    console.error("Role is required.");
    process.exit(1);
  }

  if (ensureRole && role === AUXILIAR_COMERCIAL_ROLE_ID) {
    console.log(`Ensuring role_definitions for '${role}'...`);
    await ensureAuxiliarComercialRole();
  }

  console.log(`Looking up userId for ${email}...`);
  let userId = await findUserIdByEmail(email);

  if (!userId) {
    if (!password) {
      console.error(
        "User not found. Provide --password to create the user, or create it via the CRM Usuarios module and re-run.",
      );
      process.exit(1);
    }

    console.log("User not found. Creating user in Supabase Auth...");
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        ...(fullName ? { full_name: fullName } : {}),
        role,
      },
    });

    if (createError) {
      throw new Error(`Error creating user: ${createError.message || String(createError)}`);
    }
    if (!createData?.user?.id) {
      throw new Error("User created but no user ID returned.");
    }
    userId = createData.user.id;
    console.log(`User created. userId=${userId}`);
  }

  console.log(`Updating Auth metadata (role=${role})...`);
  const { data: userGetData, error: userGetError } = await supabase.auth.admin.getUserById(userId);
  if (userGetError) {
    console.warn("Warning: could not fetch existing Auth user metadata:", userGetError.message || userGetError);
  }
  const existingMetadata = userGetData?.user?.user_metadata || {};

  const nextMetadata = {
    ...existingMetadata,
    role,
    ...(fullName ? { full_name: fullName } : {}),
  };

  const authUpdatePayload = {
    user_metadata: nextMetadata,
    ...(password ? { password } : {}),
  };

  const { error: authUpdateError } = await supabase.auth.admin.updateUserById(userId, authUpdatePayload);
  if (authUpdateError) {
    throw new Error(`Error updating Auth user: ${authUpdateError.message || String(authUpdateError)}`);
  }

  console.log("Upserting perfiles record...");
  const perfilUpsert = {
    id: userId,
    email,
    role,
    updated_at: new Date().toISOString(),
    ...(fullName ? { full_name: fullName } : {}),
  };

  const { error: perfilError } = await supabase.from("perfiles").upsert(perfilUpsert, { onConflict: "id" });
  if (perfilError) {
    throw new Error(`Error upserting perfiles: ${perfilError.message || String(perfilError)}`);
  }

  console.log("OK");
  console.log(`- userId: ${userId}`);
  console.log(`- email: ${email}`);
  console.log(`- role: ${role}`);
}

main().catch((err) => {
  console.error("Fatal:", err?.message || err);
  process.exit(1);
});

