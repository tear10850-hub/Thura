const mongoose = require('mongoose');

const AdminToolsSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  banVideoId: { type: String, default: null },
  muteVideoId: { type: String, default: null },
  unmuteVideoId: { type: String, default: null },
  
  // Auto Mute Video IDs
  warn1VideoId: { type: String, default: null },
  warn2VideoId: { type: String, default: null },
  warn3VideoId: { type: String, default: null },

  isPremium: { type: Boolean, default: false },
  premiumOwnerId: { type: Number, default: null },
  updatedAt: { type: Date, default: Date.now }
});

const KeySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  isUsed: { type: Boolean, default: false },
  usedBy: { type: Number, default: null },
  usedInChat: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now }
});

// Link Warn Count များ သိမ်းဆည်းရန် Schema
const WarnSchema = new mongoose.Schema({
  chatId: { type: Number, required: true },
  userId: { type: Number, required: true },
  count: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

const AdminToolsConfig = mongoose.model('AdminToolsConfig', AdminToolsSchema);
const PremiumKey = mongoose.model('PremiumKey', KeySchema);
const UserWarn = mongoose.model('UserWarn', WarnSchema);

module.exports = { AdminToolsConfig, PremiumKey, UserWarn };


