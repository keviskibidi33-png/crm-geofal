import { createClient } from '@supabase/supabase-js'

const url = "https://db.geofal.com.pe"
const key = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2ODY2MDY4MCwiZXhwIjo0OTI0MzM0MjgwLCJyb2xlIjoiYW5vbiJ9.4z7Le-pgOQJXXkW51BxJ7-n-4rRZ64iTZmlWadXN2fE" // using public key

// Let's use the service role key from env.local
const serviceKey = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2ODY2MDY4MCwiZXhwIjo0OTI0MzM0MjgwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.G5AeMkqPjsBktDw_TpKLMeTsRUpiRYY5l4jZebyU0o4"

const supabase = createClient(url, serviceKey)

async function testInsert() {
    console.log("Attempting test insert into programacion_lab...")
    const payload = {
        recep_numero: "1189-2",
        ot: "1192-26",
        estado_trabajo: "PENDIENTE",
        codigo_muestra: "PRUEBA-MUESTRA",
        fecha_recepcion: "2026-06-04"
    }
    
    const { data, error } = await supabase
        .from("programacion_lab")
        .insert(payload)
        .select()
        
    if (error) {
        console.error("Insert failed! Error Details:")
        console.error(JSON.stringify(error, null, 2))
    } else {
        console.log("Insert succeeded! Data:", data)
        // Clean up immediately if it succeeded
        if (data && data[0]) {
            console.log("Cleaning up inserted row...")
            await supabase.from("programacion_lab").delete().eq("id", data[0].id)
        }
    }
}

testInsert()
