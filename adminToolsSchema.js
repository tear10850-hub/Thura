const mongoose = require('mongoose');

const AdminToolsSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  banVideoId: { type: String, default: null },
  muteVideoId: { type: String, default: null },
  unmuteVideoId: { type: String, default: null },
  
  // Promote & Demote Video IDs 
  promoteVideoId: { type: String, default: null },
  demoteVideoId: { type: String, default: null },
  
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

// Bot Owner သတ်မှတ်ထားသော Bot Profile အချက်အလက်များ Group အားလုံးအတွက် သိမ်းဆည်းရန် Schema
const GlobalBotProfileSchema = new mongoose.Schema({
  key: { type: String, default: "global_bot_profile", unique: true },
  botPfMediaId: { type: String, default: null },     // Photo သို့မဟုတ် Video ရဲ့ file_id
  botPfMediaType: { type: String, default: null },   // 'video' သို့မဟုတ် 'photo'
  botCustomName: { type: String, default: "မသတ်မှတ်ရသေးပါ" },
  botCustomId: { type: String, default: "မသတ်မှတ်ရသေးပါ" },
  botCustomUsername: { type: String, default: "မသတ်မှတ်ရသေးပါ" },
  botCustomBio: { type: String, default: "မသတ်မှတ်ရသေးပါ" }
});

const AdminToolsConfig = mongoose.model('AdminToolsConfig', AdminToolsSchema);
const PremiumKey = mongoose.model('PremiumKey', KeySchema);
const UserWarn = mongoose.model('UserWarn', WarnSchema);
const GlobalBotProfile = mongoose.model('GlobalBotProfile', GlobalBotProfileSchema);

module.exports = { AdminToolsConfig, PremiumKey, UserWarn, GlobalBotProfile };
