const mongoose = require('mongoose');

// Render Environment Variables မှ CALL_MONGO_URI ကို ယူသုံးမည်
// အကယ်၍ CALL_MONGO_URI မရှိရင် ပုံမှန် MONGO_URI ကို သုံးပါမည်
const callMongoUri = process.env.CALL_MONGO_URI || process.env.MONGO_URI;
const callDbConnection = mongoose.createConnection(callMongoUri);

callDbConnection.on('connected', () => {
  console.log('Call System MongoDB Connected Successfully!');
});

callDbConnection.on('error', (err) => {
  console.error('Call System MongoDB Connection Error:', err);
});

const memberSchema = new mongoose.Schema({
  groupId: { type: Number, required: true },
  userId: { type: Number, required: true },
  firstName: { type: String, required: true }
});

memberSchema.index({ groupId: 1, userId: 1 }, { unique: true });

module.exports = callDbConnection.model('CallMember', memberSchema);
