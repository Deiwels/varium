// Test email script — run with: RESEND_API_KEY=re_xxx node test-email.js
const https = require('https');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO = process.argv[2] || 'nazarii_1403@icloud.com';

if (!RESEND_API_KEY) {
  console.error('Error: RESEND_API_KEY env variable is required');
  console.error('Usage: RESEND_API_KEY=re_xxx node test-email.js');
  process.exit(1);
}

const payload = JSON.stringify({
  from: 'VuriumBook <noreply@vurium.com>',
  to: [TO],
  subject: 'Test Email from VuriumBook',
  html: `<!DOCTYPE html><html><body style="background:#010101;color:#e8e8ed;font-family:Arial,sans-serif;padding:40px;">
    <h2>Test email</h2>
    <p>If you see this — Resend is configured correctly and emails are working.</p>
    <p style="color:rgba(255,255,255,.4);font-size:12px;">Sent at: ${new Date().toISOString()}</p>
  </body></html>`,
});

console.log(`Sending test email to: ${TO}`);

const req = https.request({
  hostname: 'api.resend.com',
  path: '/emails',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${RESEND_API_KEY}`,
    'Content-Length': Buffer.byteLength(payload),
  },
}, (resp) => {
  let data = '';
  resp.on('data', c => data += c);
  resp.on('end', () => {
    console.log(`Status: ${resp.statusCode}`);
    try {
      const json = JSON.parse(data);
      if (resp.statusCode === 200 || resp.statusCode === 201) {
        console.log('Success! Email sent. ID:', json.id);
      } else {
        console.error('Failed:', JSON.stringify(json, null, 2));
        if (json.message?.includes('domain')) {
          console.error('\nHint: The domain "vurium.com" may not be verified in Resend.');
          console.error('Go to https://resend.com/domains and verify the domain.');
        }
        if (resp.statusCode === 401) {
          console.error('\nHint: Invalid API key. Check RESEND_API_KEY.');
        }
      }
    } catch {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', e => console.error('Request error:', e.message));
req.write(payload);
req.end();
