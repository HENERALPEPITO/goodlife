// Simple script to POST a test email to the local Next API
// Usage: node scripts/post_test_email.js

const url = 'http://localhost:3000/api/test/email';
const payload = { to: 'ignored@local', message: 'hello test po' };

async function waitForServer(retries = 10, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch (e) {
      // ignore
    }
    await new Promise((r) => setTimeout(r, delay));
  }
  return false;
}

async function run() {
  const up = await waitForServer(15, 1000);
  if (!up) {
    console.error('Server not reachable at', url);
    process.exit(2);
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response body:', text);
  } catch (err) {
    console.error('Error calling API:', err);
    process.exit(1);
  }
}

run();
