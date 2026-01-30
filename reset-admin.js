const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function resetAdmin() {
    const userId = '7818ac9d-f7c0-4540-bb32-e04d7423652c';

    console.log('1. Resetting Password...');
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
        password: 'admin123'
    });

    if (error) {
        console.error('Error updating password:', error);
    } else {
        console.log('Password updated to: admin123');
    }

    console.log('2. Clearing Active Sessions...');
    const { error: deleteError } = await supabase
        .from('active_sessions')
        .delete()
        .eq('user_id', userId);

    if (deleteError) {
        console.error('Error clearing sessions:', deleteError);
    } else {
        console.log('Active sessions cleared.');
    }
}

resetAdmin();
