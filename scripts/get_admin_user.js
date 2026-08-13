const { createClient } = require("@supabase/supabase-js")

const SUPABASE_URL = "https://db.geofal.com.pe"
const SERVICE_ROLE_KEY =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3ODY4NzY4MCwiZXhwIjo0OTM0MzYxMjQwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.eH_lLQ_RF3_Py_bLzjOI2iPrWyxzmcATlxkBzmwbU9A"

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log("Setting password for admin@crm.com...")
  const { data, error } = await supabase.auth.admin.updateUserById("7818ac9d-f7c0-4540-bb52-ae0d7423585c", {
    password: "AdminGeofal2026!",
    email_confirm: true,
  })
  if (error) {
    console.error("Error:", error)
  } else {
    console.log("✅ Admin password updated for admin@crm.com")
  }
}

main()
