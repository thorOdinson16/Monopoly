const mongoose=require('mongoose');
const User=require('./models/employee');
const {createApp}=require('./app');
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const users={
  findByEmail(email){return User.findOne({email:{$regex:`^${escapeRegex(email)}$`,$options:'i'}}).select('+password');},
  create(data){return User.create(data);},
  async updatePassword(user,password){user.password=password;await user.save();}
};
async function start(){
  const mongoUri=process.env.MONGODB_URI||'mongodb://127.0.0.1:27017/employee';
  try {await mongoose.connect(mongoUri,{serverSelectionTimeoutMS:5000});await User.init();const app=createApp({users,allowedOrigins:process.env.ALLOWED_ORIGINS,secureCookies:process.env.NODE_ENV==='production'});const port=Number(process.env.PORT)||3001;app.listen(port,()=>console.log(`Account server listening on ${port}`));}
  catch(error){console.error(`Account server could not start: ${error.message}`);process.exitCode=1;}
}
if(require.main===module)start();
module.exports={start};
