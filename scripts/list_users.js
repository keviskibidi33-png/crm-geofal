const { createClient } = require("@supabase/supabase-js")

const supabaseUrl = "https://db.geofal.com.pe"
const supabaseKey =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2ODY2MDY4MCwiZXhwIjo0OTI0MzM0MjgwLCJyb2xlIjoiYW5vbiJ9.4z7Le-pgOQJXXkW51BxJ7-n-4rRZ64iTZmlWadXN2fE"

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data: perfiles, error } = await supabase
    .from("perfiles")
    .select("id, email, full_name, role")

  if (error) {
    console.error("Error fetching perfiles:", error)
    return
  }

  console.log(`Found ${perfiles.length} profiles in 'perfiles':`)
  perfiles.forEach((p) => {
    console.log(` - ${p.email} | Role: ${p.role} | Name: ${p.full_name}`)
  })
}

main()
