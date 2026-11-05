const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./app');

test('accounts register, authenticate and sign out', async () => {
  const records = new Map();
  const users = {
    findByEmail: async email => records.get(email),
    create: async user => { records.set(user.email, user); return user; },
    updatePassword: async (user, password) => { user.password = password; },
  };
  const server = createApp({ users }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, data, cookie) => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(data),
  });
  try {
    const registration = await post('/register', { name: 'Alice', email: 'Alice@example.com', password: 'password123' });
    assert.equal(registration.status, 201);
    assert.equal((await registration.json()).user.email, 'alice@example.com');
    assert.match(records.get('alice@example.com').password, /^scrypt\$/);
    const cookie = registration.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(base + '/session', { headers: { cookie } })).status, 200);
    assert.equal((await post('/login', { email: 'alice@example.com', password: 'wrong' })).status, 401);
    assert.equal((await post('/logout', {}, cookie)).status, 200);
    assert.equal((await fetch(base + '/session', { headers: { cookie } })).status, 401);
    assert.equal((await post('/login', { email: 'ALICE@example.com', password: 'password123' })).status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
