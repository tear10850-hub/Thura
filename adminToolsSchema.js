const mongoose = require('mongoose');

// Group အလိုက် Ban/Mute/Unmute Video များ သိမ်းရန်
const AdminToolsSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  banVideoId: { type: String, default: null },
  muteVideoId: { type: String, default: null },
  unmuteVideoId: { type: String, default: null },
  isPremium: { type: Boolean, default: false },
  premiumOwnerId: { type: Number, default: null }, // Premium ဝယ်ထားသူ User ID
  updatedAt: { type: Date, default: Date.now }
});

// Owner ထုတ်ထားသော Keys များ သိမ်းရန်
const KeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  isUsed: { type: Boolean, default: false },
  usedBy: { type: Number, default: null },
  usedInChat: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now }
});

const AdminToolsConfig = mongoose.model('AdminToolsConfig', AdminToolsSchema);
const PremiumKey = mongoose.model('PremiumKey', KeySchema);

module.exports = { AdminToolsConfig, PremiumKey };


