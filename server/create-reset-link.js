// The host verifies the player's identity before sharing this link privately.
const crypto = require('crypto');
const { connect, mongoose } = require('./database');

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  const base = process.argv[3] || process.env.MONOPOLY_PUBLIC_URL;
  if (!email || !base) throw Error('Usage: node server/create-reset-link.js player@example.com https://your-host:8443');
  const origin = new URL(base);
  if (!['https:', 'http:'].includes(origin.protocol) || (origin.protocol === 'http:' && !['localhost','127.0.0.1'].includes(origin.hostname))) throw Error('Use an HTTPS address (HTTP is only allowed on localhost).');
  const {users,resets} = await connect();
  const user = await users.findByEmail(email);
  if (!user) throw Error('No account has that email address.');
  const token=crypto.randomBytes(32).toString('hex');
  await resets.create(crypto.createHash('sha256').update(token).digest('hex'),user.email,new Date(Date.now()+30*60*1000));
  const link=new URL('/reset-password',origin);link.searchParams.set('token',token);
  console.log(`Share this one-time link privately; it expires in 30 minutes:\n${link}`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>mongoose.disconnect());
