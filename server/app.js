const express=require('express');
const cors=require('cors');
const crypto=require('crypto');
const {hashPassword,verifyPassword}=require('./auth');

const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const tokenKey=token=>crypto.createHash('sha256').update(token).digest('hex');
function createApp({users,allowedOrigins,secureCookies=false,sessions:sessionStore,sameOrigin=false}) {
  const app=express(),memory=new Map(),attempts=new Map();
  const sessions=sessionStore || {get:async key=>memory.get(key),set:async (key,session)=>memory.set(key,session),delete:async key=>memory.delete(key)};
  const origins=(allowedOrigins||'').split(',').map(x=>x.trim()).filter(Boolean);
  app.disable('x-powered-by');
  if(sameOrigin) app.use((req,res,next)=>{const origin=req.headers.origin;if(origin){try {if(new URL(origin).host!==req.headers.host)return res.status(403).json({error:'Invalid request origin.'});}catch{return res.status(403).json({error:'Invalid request origin.'});}}next();});
  app.use(cors({credentials:true,origin(origin,cb){if(!origin)return cb(null,true);if(origins.length?origins.includes(origin):/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))return cb(null,true);return cb(null,false);}}));
  app.use(express.json({limit:'16kb'}));
  const cookie=(token,maxAge,req)=>`monopoly_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${(secureCookies===true || (secureCookies==='proxy' && req.headers['x-forwarded-proto']==='https'))?'; Secure':''}`;
  const readToken=req=>{const pair=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('monopoly_session='));return pair?pair.slice('monopoly_session='.length):'';};
  const current=async req=>{const raw=readToken(req);if(!/^[0-9a-f]{64}$/.test(raw))return null;const key=tokenKey(raw),session=await sessions.get(key);if(!session||new Date(session.expires).getTime()<=Date.now()){await sessions.delete(key);return null;}return session;};
  const startSession=async(req,res,user)=>{const previous=readToken(req);if(previous)await sessions.delete(tokenKey(previous));const token=crypto.randomBytes(32).toString('hex');await sessions.set(tokenKey(token),{user:{name:user.name,email:user.email},expires:new Date(Date.now()+86400000)});res.setHeader('Set-Cookie',cookie(token,86400,req));return {name:user.name,email:user.email};};
  const limit=(req,res,next)=>{const now=Date.now(),key=req.ip;let state=attempts.get(key);if(!state||now-state.start>900000)state={start:now,count:0};state.count++;attempts.set(key,state);if(state.count>30)return res.status(429).json({error:'Too many attempts. Try again later.'});next();};
  app.get('/session',async(req,res)=>{try{const session=await current(req);if(!session)return res.status(401).json({error:'Not signed in.'});res.json({user:session.user});}catch{return res.status(503).json({error:'Account service is unavailable.'});}});
  app.post('/logout',async(req,res)=>{try{const token=readToken(req);if(token)await sessions.delete(tokenKey(token));res.setHeader('Set-Cookie',cookie('',0,req));res.json({ok:true});}catch{return res.status(503).json({error:'Account service is unavailable.'});}});
  app.post('/register',limit,async(req,res)=>{try{
    const {name,email,password}=req.body||{};
    if(typeof name!=='string'||name.trim().length<1||name.trim().length>80||typeof email!=='string'||email.length>254||!EMAIL.test(email.trim())||typeof password!=='string'||password.length<8||password.length>128)return res.status(400).json({error:'Enter a name, valid email, and password of 8–128 characters.'});
    const normalized=email.trim().toLowerCase();if(await users.findByEmail(normalized))return res.status(409).json({error:'An account with that email already exists.'});
    const user=await users.create({name:name.trim(),email:normalized,password:await hashPassword(password)});
    return res.status(201).json({user:await startSession(req,res,user)});
  }catch(error){if(error?.code===11000)return res.status(409).json({error:'An account with that email already exists.'});return res.status(503).json({error:'Account service is unavailable. Please try again.'});}});
  app.post('/login',limit,async(req,res)=>{try{
    const {email,password}=req.body||{};if(typeof email!=='string'||typeof password!=='string'||email.length>254||password.length>128)return res.status(400).json({error:'Enter your email and password.'});
    const user=await users.findByEmail(email.trim().toLowerCase());if(!user)return res.status(401).json({error:'Email or password is incorrect.'});
    const result=await verifyPassword(password,user.password);if(!result.valid)return res.status(401).json({error:'Email or password is incorrect.'});
    if(result.legacy)await users.updatePassword(user,await hashPassword(password));
    return res.json({user:await startSession(req,res,user)});
  }catch{return res.status(503).json({error:'Account service is unavailable. Please try again.'});}});
  return app;
}
module.exports={createApp};
