const http = require('http');

const BASE = 'http://localhost:5000';

function request(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        const cookies = res.headers['set-cookie'];
        resolve({ statusCode: res.statusCode, data: raw ? JSON.parse(raw) : null, cookies });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'arvind@admin.com',
    password: 'admin123',
  });
  const tokenCookie = loginRes.cookies?.find((c) => c.startsWith('token='));
  const cookie = tokenCookie.split(';')[0];
  console.log('Logged in...');

  const uploadRes = await request('POST', '/api/upload/dataset', {
    dataset: [
      { text: "The bridge near sector 15 is heavily damaged and vehicles are falling into the river. Authorities have not put any warning signs.", source: "twitter" },
      { text: "I have been receiving death threats from an unknown number for the past 3 days. Police is not registering my complaint.", source: "facebook" }
    ]
  }, cookie);
  console.log('Upload Status:', uploadRes.statusCode);
  console.log('Upload Response:', uploadRes.data);
}

main().catch(console.error);
