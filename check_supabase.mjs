import { createClient } from '@supabase/supabase-js'

const url = "https://db.geofal.com.pe"
const key = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2ODY2MDY4MCwiZXhwIjo0OTI0MzM0MjgwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.G5AeMkqPjsBktDw_TpKLMeTsRUpiRYY5l4jZebyU0o4"

const supabase = createClient(url, key)

async function test() {
    console.log("Querying clientes table using Supabase JS client...")
    const { data, error } = await supabase.from("clientes").select("id").limit(1)
    if (error) {
        console.error("Error querying database:", error)
    } else {
        console.log("Success! Data:", data)
    }
}

test()
