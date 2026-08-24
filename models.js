const mongoose = require('mongoose');

// Owner မီဒီယာများ သိမ်းဆည်းရန် Schema
const MediaSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['music', 'video', 'photo', 'sticker', 'audio', 'link'], 
    required: true 
  },
  fileId: { type: String, required: true },
  caption: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

// မန်ဘာများ၏ စာသား/Emoji များ သိမ်းဆည်းရန် Schema
const TextReplySchema = new mongoose.Schema({
  text: { type: String, required: true },
  fromUserId: { type: Number },
  chatId: { type: Number },
  lastUsedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// ⏰ Group သို့မဟုတ် Chat အလိုက် အချိန်သတ်မှတ်ချက်များ သိမ်းဆည်းရန် Schema (အသစ်ထည့်သွင်းခြင်း)
const BotSettingSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  rtime: { type: String, default: null },   // ယာယီ စာမပြန်ရန် အချိန်
  ntime: { type: String, default: null },   // ယာယီ စာပြန်ရန် အချိန်
  artime: { type: String, default: null },  // နေ့စဉ် စာမပြန်ရန် အချိန်
  antime: { type: String, default: null },  // နေ့စဉ် စာပြန်ရန် အချိန်
  updatedAt: { type: Date, default: Date.now }
});

const Media = mongoose.model('Media', MediaSchema);
const TextReply = mongoose.model('TextReply', TextReplySchema);
const BotSetting = mongoose.model('BotSetting', BotSettingSchema);

module.exports = { Media, TextReply, BotSetting };
