const mongoose = require('mongoose');
const User = require('./models/user');

const sessionSchema = new mongoose.Schema({
  _id: String,
  user: { name: String, email: String },
  expires: { type: Date, required: true, expires: 0 },
}, { versionKey: false });
const Session = mongoose.models.MonopolySession || mongoose.model('MonopolySession', sessionSchema);
const resetSchema = new mongoose.Schema({_id:String, email:{type:String,required:true}, expires:{type:Date,required:true,expires:0}}, {versionKey:false});
const Reset = mongoose.models.PasswordReset || mongoose.model('PasswordReset', resetSchema);
const stateSchema = new mongoose.Schema({_id:String, revision:{type:Number,default:0}, data:mongoose.Schema.Types.Mixed}, {versionKey:false});
const AccountState = mongoose.models.AccountState || mongoose.model('AccountState', stateSchema);
const users = {
  findByEmail(email) { const escaped = [...email].map(c => '.+*?^$()[]{}|\\'.includes(c) ? '\\' + c : c).join(''); return User.findOne({ email: { $regex: `^${escaped}$`, $options: 'i' } }).select('+password'); },
  create(data) { return User.create(data); },
  async updatePassword(user, password) { user.password = password; await user.save(); },
  async updateName(user, name) { user.name = name; await user.save(); },
};
const sessions = {
  async get(key) { return Session.findById(key).lean(); },
  async set(key, session) { await Session.updateOne({ _id: key }, { $set: session }, { upsert: true }); },
  async delete(key) { await Session.deleteOne({ _id: key }); },
  async deleteForUser(email) { await Session.deleteMany({'user.email':email}); },
  async updateName(email,name) { await Session.updateMany({'user.email':email},{$set:{'user.name':name}}); },
};
const resets = {
  async create(key,email,expires) { await Reset.create({_id:key,email,expires}); },
  async consume(key) { return Reset.findOneAndDelete({_id:key,expires:{$gt:new Date()}}).lean(); },
  async deleteForUser(email) { await Reset.deleteMany({email}); },
};
const states = {
  async get(email) { const state=await AccountState.findById(email).lean();return state ? {revision:state.revision,data:state.data} : {revision:0,data:null}; },
  async save(email,revision,data) {
    if(revision===0){try{await AccountState.create({_id:email,revision:1,data});return 1;}catch(error){if(error.code===11000)return null;throw error;}}
    const result=await AccountState.findOneAndUpdate({_id:email,revision},{$set:{data},$inc:{revision:1}},{new:true}).lean();return result?.revision || null;
  },
};
async function connect(uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/monopoly') {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await Promise.all([User.init(), Session.init(), Reset.init(), AccountState.init()]);
  return { users, sessions, resets, states };
}
module.exports = { connect, mongoose };
