const mongoose = require('mongoose');
const User = require('./models/user');

const sessionSchema = new mongoose.Schema({
  _id: String,
  user: { name: String, email: String },
  expires: { type: Date, required: true, expires: 0 },
}, { versionKey: false });
const Session = mongoose.models.MonopolySession || mongoose.model('MonopolySession', sessionSchema);
const users = {
  findByEmail(email) { const escaped = [...email].map(c => '.+*?^$()[]{}|\\'.includes(c) ? '\\' + c : c).join(''); return User.findOne({ email: { $regex: `^${escaped}$`, $options: 'i' } }).select('+password'); },
  create(data) { return User.create(data); },
  async updatePassword(user, password) { user.password = password; await user.save(); },
};
const sessions = {
  async get(key) { return Session.findById(key).lean(); },
  async set(key, session) { await Session.updateOne({ _id: key }, { $set: session }, { upsert: true }); },
  async delete(key) { await Session.deleteOne({ _id: key }); },
};
async function connect(uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/monopoly') {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await Promise.all([User.init(), Session.init()]);
  return { users, sessions };
}
module.exports = { connect, mongoose };
