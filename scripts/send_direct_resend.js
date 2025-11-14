#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function parseEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const result = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
    return result;
  } catch (e) {
    return {};
  }
}

(async () => {
  try {
    const envPath = path.resolve(__dirname, '..', '.env.local');
    const env = parseEnvFile(envPath);
    const RESEND_API_KEY = process.env.RESEND_API_KEY || env.RESEND_API_KEY;

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not found in environment or .env.local');
      process.exit(2);
    }

    const { Resend } = require('resend');
    const resend = new Resend(RESEND_API_KEY);

    const to = 'yupihaymabuhay@gmail.com';
    const message = 'hello test po';
    const from = process.env.EMAIL_FROM || env.EMAIL_FROM || 'Good Life Music Portal <noreply@goodlife-publishing.com>';

    console.log('Sending test email to', to, '...');
    const res = await resend.emails.send({
      from,
      to,
      subject: 'Test Email',
      html: `<p>${message}</p>`,
    });

    console.log('Full resend response:', res);
  } catch (err) {
    console.error('Error sending test email:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
