const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return {valid:false, legacy:false};
  if (!stored.startsWith('scrypt$')) {
    const a=Buffer.from(password), b=Buffer.from(stored);
    return {valid:a.length===b.length && crypto.timingSafeEqual(a,b), legacy:true};
  }
  const parts=stored.split('$');
  if(parts.length!==3 || !/^[0-9a-f]{32}$/i.test(parts[1]) || !/^[0-9a-f]{128}$/i.test(parts[2]))return {valid:false,legacy:false};
  const expected=Buffer.from(parts[2],'hex'), actual=await scrypt(password,parts[1],64);
  return {valid:crypto.timingSafeEqual(actual,expected),legacy:false};
}
module.exports={hashPassword,verifyPassword};
