import assert from 'node:assert/strict';

const origin = 'http://127.0.0.1:8080';
const health = await fetch(`${origin}/api/health`);
assert.equal(health.status, 200);
const login = await fetch(`${origin}/api/auth/login`, {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@college.test', password: process.env.SEED_PASSWORD }),
});
assert.equal(login.status, 200);
const session = await login.json();
const profile = await fetch(`${origin}/api/me`, {
  headers: { Authorization: `Bearer ${session.data.accessToken}` },
});
assert.equal(profile.status, 200);
assert.equal((await profile.json()).data.role, 'admin');
const logout = await fetch(`${origin}/api/auth/logout`, {
  method: 'POST',
  headers: { Origin: origin, Cookie: login.headers.get('set-cookie').split(';')[0] },
});
assert.equal(logout.status, 204);
const revoked = await fetch(`${origin}/api/me`, {
  headers: { Authorization: `Bearer ${session.data.accessToken}` },
});
assert.equal(revoked.status, 401);
console.log('Compose smoke passed: database readiness, proxied login, profile and logout');
