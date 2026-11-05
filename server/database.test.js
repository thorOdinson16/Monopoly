const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { connect, mongoose } = require('./database');
const { createApp } = require('./app');

test('MongoDB accounts and sessions survive app recreation', { skip: !process.env.MONOPOLY_MONGO_TEST_URI }, async () => {
  const email = `test-${crypto.randomBytes(12).toString('hex')}@example.test`;
  let first, second;
  try {
    const stores = await connect(process.env.MONOPOLY_MONGO_TEST_URI);
    const listen = async () => { const server = createApp(stores).listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); return server; };
    const post = (server, route, data, cookie) => fetch(`http://127.0.0.1:${server.address().port}${route}`, {method:'POST', headers:{'content-type':'application/json', ...(cookie ? {cookie} : {})}, body:JSON.stringify(data)});
    first = await listen();
    const registration = await post(first, '/register', {name:'Test Player', email, password:'test-password-123'});
    assert.equal(registration.status, 201);
    const cookie = registration.headers.get('set-cookie').split(';')[0];
    const user = await stores.users.findByEmail(email);
    assert.match(user.password, /^scrypt\$/);
    second = await listen();
    const session = await fetch(`http://127.0.0.1:${second.address().port}/session`, {headers:{cookie}});
    assert.equal(session.status, 200);
    assert.equal((await session.json()).user.email, email);
    assert.equal((await post(second, '/login', {email, password:'test-password-123'})).status, 200);
    assert.equal((await post(second, '/register', {name:'Duplicate', email, password:'test-password-123'})).status, 409);
    assert.equal((await post(second, '/logout', {}, cookie)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${second.address().port}/session`, {headers:{cookie}})).status, 401);
  } finally {
    if (first) await new Promise(resolve => first.close(resolve));
    if (second) await new Promise(resolve => second.close(resolve));
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.collection('users').deleteOne({email});
      await mongoose.connection.collection('monopolysessions').deleteMany({'user.email':email});
    }
    await mongoose.disconnect();
  }
});
