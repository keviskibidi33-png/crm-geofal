
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://db.geofal.com.pe';
const supabaseServiceKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2ODY2MDY4MCwiZXhwIjo0OTI0MzM0MjgwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.G5AeMkqPjsBktDw_TpKLMeTsRUpiRYY5l4jZebyU0o4';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function cleanProgramacionData() {
    console.log("--- STARTING PROGRAMACION CLEANUP ---");

    // Order is important due to FK constraints (Extensions first)
    const tables = [
        'programacion_comercial',
        'programacion_administracion',
        'programacion_lab',
        'programacion_servicios_historial',
        'programacion_servicios'
    ];

    for (const table of tables) {
        console.log(`Cleaning table: ${table}...`);

        // Supabase delete() requires a filter. 
        // We use .neq('id', '00000000-0000-0000-0000-000000000000') or similar broad filter.
        // Actually .not('id', 'is', null) is more generic for UUIDs.

        const { count, error } = await supabase
            .from(table)
            .delete({ count: 'exact' })
            .not('id', 'is', null);

        if (error) {
            console.error(`[ERROR] Failed to clean ${table}:`, error.message);
        } else {
            console.log(`[SUCCESS] Cleaned ${table}. Rows deleted: ${count}`);
        }
    }

    console.log("--- CLEANUP COMPLETE ---");
}

cleanProgramacionData().catch(console.error);
