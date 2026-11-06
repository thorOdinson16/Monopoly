const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const {spawn} = require('node:child_process');
const mongoose = require('../server/node_modules/mongoose');

test('hosted accounts link seats, retain analytics and rejoin on another device', {skip:!process.env.MONOPOLY_MONGO_TEST_URI,timeout:20000}, async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'monopoly-hosted-'));
  const email=`hosted-${crypto.randomBytes(12).toString('hex')}@example.test`;
  const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
  const server=spawn(process.execPath,['serve-public.cjs'],{cwd:__dirname,env:{...process.env,PORT:String(port),MONGODB_URI:process.env.MONOPOLY_MONGO_TEST_URI,MONOPOLY_ROOM_FILE:path.join(dir,'rooms.json')},stdio:['ignore','pipe','pipe']});
  let errors='';server.stderr.on('data',data=>{errors+=data;});
  const base=`http://127.0.0.1:${port}`;
  try {
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(`Server did not start: ${errors}`)),10000);server.stdout.on('data',data=>{if(String(data).includes('Local game available')){clearTimeout(timer);resolve();}});server.once('exit',()=>{clearTimeout(timer);reject(Error(`Server exited: ${errors}`));});});
    const post=async(route,body,cookie,token)=>{const response=await fetch(base+route,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{}),...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});const data=await response.json();assert.ok(response.ok,JSON.stringify(data));return {response,data};};
    const registration=await post('/api/account/register',{name:'Alice',email,password:'test-password-123'});
    const cookie=registration.response.headers.get('set-cookie').split(';')[0];
    const created=await post('/api/rooms',{name:'Alice'},cookie);
    const {code,token}=created.data;
    await post(`/api/rooms/${code}/join`,{name:'Bob'});
    await post(`/api/rooms/${code}/decide`,{seat:1,approve:true},cookie,token);
    await post(`/api/rooms/${code}/start`,{},cookie,token);
    const stats=await (await fetch(base+'/api/rooms/mine',{headers:{cookie}})).json();
    assert.equal(stats.active,1);
    assert.equal(stats.games[0].code,code);
    const recovered=await post(`/api/rooms/${code}/rejoin`,{},cookie);
    assert.equal(recovered.data.seat,0);
    assert.notEqual(recovered.data.token,token);
    assert.equal((await fetch(base+`/api/rooms/${code}`,{headers:{authorization:`Bearer ${recovered.data.token}`}})).status,200);
    assert.equal((await fetch(base+'/api/rooms/mine')).status,400);
    await post('/api/account/change-password',{currentPassword:'test-password-123',newPassword:'new-password-123'},cookie);
    assert.equal((await fetch(base+`/api/rooms/${code}`,{headers:{authorization:`Bearer ${token}`}})).status,400);
    assert.equal((await fetch(base+`/api/rooms/${code}`,{headers:{authorization:`Bearer ${recovered.data.token}`}})).status,400);
    const login=await post('/api/account/login',{email,password:'new-password-123'});
    const freshCookie=login.response.headers.get('set-cookie').split(';')[0];
    assert.equal((await post(`/api/rooms/${code}/rejoin`,{},freshCookie)).data.seat,0);
  } finally {
    if(server.exitCode===null){server.kill();await new Promise(resolve=>server.once('exit',resolve));}
    await mongoose.connect(process.env.MONOPOLY_MONGO_TEST_URI);
    await mongoose.connection.collection('users').deleteOne({email});
    await mongoose.connection.collection('monopolysessions').deleteMany({'user.email':email});
    await mongoose.disconnect();
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
