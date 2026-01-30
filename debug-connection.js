const https = require('https');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Testing Connection to:", SUPABASE_URL);
console.log("Key Length:", SUPABASE_KEY ? SUPABASE_KEY.length : "MISSING");

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing credentials");
    process.exit(1);
}

// Mimic the middleware query
// We'll search for ANY active session just to test syntax, or an empty one
const queryUrl = `${SUPABASE_URL}/rest/v1/active_sessions?select=user_id&limit=1`;

const options = {
    method: 'GET',
    headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
    }
};

const req = https.request(queryUrl, options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);

    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Response:', data);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
