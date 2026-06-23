// Seed script: Insert 15 test posts via the backend API
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
        resolve({ data: JSON.parse(raw), cookies });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // 1. Login to get auth cookie
  console.log('Logging in...');
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'arvind@admin.com',
    password: 'admin123',
  });
  const tokenCookie = loginRes.cookies?.find((c) => c.startsWith('token='));
  if (!tokenCookie) {
    console.error('Login failed:', loginRes.data);
    process.exit(1);
  }
  const cookie = tokenCookie.split(';')[0];
  console.log('Logged in successfully!\n');

  // 2. 15 diverse test posts
  const testPosts = [
    { text: "I can't take this anymore, no one ever listens to what is happening. Every single day I feel more hopeless and nobody seems to care at all.", source: "twitter" },
    { text: "Someone has been following me from the college gates every evening for the past week. I am really scared and don't know what to do.", source: "twitter" },
    { text: "There is a massive pothole on MG Road near the central market that has caused 3 accidents this week. The municipality is doing nothing about it.", source: "facebook" },
    { text: "A group of boys in my class keeps sending me threatening messages online and sharing my photos without consent. I feel humiliated every day.", source: "instagram" },
    { text: "The factory near our residential area is dumping toxic waste into the river. Children are falling sick and no authority is taking action.", source: "twitter" },
    { text: "I witnessed a hit and run accident near sector 22 today morning. The injured person was left bleeding on the road for 20 minutes before help arrived.", source: "twitter" },
    { text: "Feeling so overwhelmed with everything. Sometimes I wonder if anyone would even notice if I just disappeared from this world forever.", source: "reddit" },
    { text: "The streetlights in our colony have been broken for months. Women and elderly feel unsafe walking after dark. Multiple complaints ignored.", source: "facebook" },
    { text: "My neighbor has been physically abusing his wife and children. We can hear screams every night. Police complaint was filed but no action taken.", source: "manual_upload" },
    { text: "The water supply in our area has been contaminated. Multiple families have reported diarrhea and vomiting. Health department not responding.", source: "twitter" },
    { text: "A building under construction near the school collapsed partially today. Fortunately no casualties but debris is blocking the emergency exit route.", source: "facebook" },
    { text: "Students at Delhi University are protesting against unfair examination policies. The administration has called in security forces to disperse peaceful protestors.", source: "twitter" },
    { text: "My elderly father was scammed online and lost his entire pension savings. The cybercrime helpline keeps disconnecting our calls.", source: "manual_upload" },
    { text: "The garbage dump near the residential area has not been cleaned in 3 weeks. Stray dogs are becoming aggressive and rats are everywhere.", source: "facebook" },
    { text: "Life has become meaningless. I have been battling depression silently and the mental health resources in our city are practically nonexistent.", source: "reddit" },
  ];

  // 3. Send through analyze endpoint one by one (no auth needed for this route)
  console.log('Analyzing and inserting 15 test posts...\n');
  let success = 0;
  let fail = 0;

  for (let i = 0; i < testPosts.length; i++) {
    try {
      const res = await request('POST', '/api/posts/analyze', testPosts[i]);
      if (res.data.success) {
        const d = res.data.data;
        console.log(`[${i + 1}/15] ✅ ${d.severityLevel || 'N/A'} | ${d.primaryTopic || 'N/A'} | "${testPosts[i].text.slice(0, 50)}..."`);
        success++;
      } else {
        console.log(`[${i + 1}/15] ❌ Failed: ${res.data.message}`);
        fail++;
      }
    } catch (err) {
      console.log(`[${i + 1}/15] ❌ Error: ${err.message}`);
      fail++;
    }
    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n🎯 Done! Success: ${success}, Failed: ${fail}`);
  console.log('Refresh your dashboard to see the data!');
}

main().catch(console.error);
