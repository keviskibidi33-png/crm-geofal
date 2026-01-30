const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateQuote() {
    const quoteId = 'd71870a7-1af8-4b8f-b695-dd3ae3572ca3';

    // 1. Fetch current data
    const { data: quote, error } = await supabase
        .from('cotizaciones')
        .select('items_json, include_igv')
        .eq('id', quoteId)
        .single();

    if (error) {
        console.error('Error fetching quote:', error);
        return;
    }

    let items = quote.items_json || [];

    // 2. Add Movilidad Item
    const newItem = {
        codigo: "MOV01", // Generating a code
        descripcion: "Movilidad",
        cantidad: 1,
        costo_unitario: 50,
        acreditado: "NO",
        norma: ""
    };

    items.push(newItem);

    // 3. Recalculate Totals
    const subtotal = items.reduce((acc, item) => acc + (item.cantidad * item.costo_unitario), 0);
    const igvRate = 0.18;
    const igv = quote.include_igv ? subtotal * igvRate : 0; // Assuming IGV applies if include_igv is true
    const total = subtotal + igv;

    console.log('New Subtotal:', subtotal);
    console.log('New IGV:', igv);
    console.log('New Total:', total);

    // 4. Update Database
    const { error: updateError } = await supabase
        .from('cotizaciones')
        .update({
            items_json: items,
            subtotal: subtotal,
            igv: igv,
            total: total
        })
        .eq('id', quoteId);

    if (updateError) {
        console.error('Error updating quote:', updateError);
    } else {
        console.log('Quote updated successfully.');
    }
}

updateQuote();
