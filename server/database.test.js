const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const path = require('node:path');
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
    const base=`http://127.0.0.1:${second.address().port}`;
    const update=await fetch(base+'/profile',{method:'PATCH',headers:{'content-type':'application/json',cookie},body:JSON.stringify({name:'Updated Player'})});
    assert.equal(update.status,200);
    assert.equal((await (await fetch(base+'/session',{headers:{cookie}})).json()).user.name,'Updated Player');
    const data={game:null,results:[],players:['Updated Player']};
    assert.equal((await fetch(base+'/state')).status,401);
    const save=revision=>fetch(base+'/state',{method:'PUT',headers:{'content-type':'application/json',cookie},body:JSON.stringify({revision,data})});
    assert.equal((await save(0)).status,200);
    assert.equal((await save(0)).status,409);
    assert.deepEqual((await (await fetch(base+'/state',{headers:{cookie}})).json()).data,data);
    assert.equal((await save(1)).status,200);
    const generated=await promisify(execFile)(process.execPath,[path.join(__dirname,'create-reset-link.js'),email,'https://example.test:8443'],{env:{...process.env,MONGODB_URI:process.env.MONOPOLY_MONGO_TEST_URI}});
    const link=generated.stdout.match(/https:\/\/\S+/)[0],token=new URL(link).searchParams.get('token');
    assert.match(token,/^[a-f0-9]{64}$/);
    assert.equal((await post(second,'/reset-password',{token,password:'new-password-123'})).status,200);
    assert.equal((await post(second,'/reset-password',{token,password:'new-password-123'})).status,400);
    assert.equal((await fetch(base+'/session',{headers:{cookie}})).status,401);
    assert.equal((await post(second,'/login',{email,password:'test-password-123'})).status,401);
    const login=await post(second,'/login',{email,password:'new-password-123'});
    assert.equal(login.status,200);
    const updatedCookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await post(second,'/change-password',{currentPassword:'wrong',newPassword:'newer-password-123'},updatedCookie)).status,401);
    assert.equal((await post(second,'/change-password',{currentPassword:'new-password-123',newPassword:'newer-password-123'},updatedCookie)).status,200);
    assert.equal((await fetch(base+'/session',{headers:{cookie:updatedCookie}})).status,401);
    assert.equal((await post(second, '/register', {name:'Duplicate', email, password:'test-password-123'})).status, 409);
    assert.equal((await post(second, '/logout', {}, cookie)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${second.address().port}/session`, {headers:{cookie}})).status, 401);
  } finally {
    if (first) await new Promise(resolve => first.close(resolve));
    if (second) await new Promise(resolve => second.close(resolve));
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.collection('users').deleteOne({email});
      await mongoose.connection.collection('monopolysessions').deleteMany({'user.email':email});
      await mongoose.connection.collection('accountstates').deleteOne({_id:email});
      await mongoose.connection.collection('passwordresets').deleteMany({email});
    }
    await mongoose.disconnect();
  }
});
