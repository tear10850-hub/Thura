const mongoose = require('mongoose');

// 1. User Schema (အကောင့်များအတွက်)
const userSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  following: { type: [String], default: [] }
});

// 2. Video Schema (ဗီဒီယို Feed များအတွက်)
const videoSchema = new mongoose.Schema({
  videoId: { type: String, required: true, unique: true },
  chatId: { type: String, required: true },
  fileId: { type: String, required: true },
  caption: { type: String, default: '' },
  visibility: { type: String, enum: ['public', 'friends'], default: 'public' },
  likes: { type: [String], default: [] },
  comments: [{ name: String, text: String }]
});

// 3. Setting Schema (Log Channel ချိတ်ရန်)
const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true }
});

// 4. Owner မီဒီယာများ သိမ်းဆည်းရန် Schema
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

// 5. မန်ဘာများ၏ စာသား/Emoji များ သိမ်းဆည်းရန် Schema
const TextReplySchema = new mongoose.Schema({
  text: { type: String, required: true },
  fromUserId: { type: Number },
  chatId: { type: Number },
  lastUsedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Video = mongoose.model('Video', videoSchema);
const Setting = mongoose.model('Setting', settingSchema);
const Media = mongoose.model('Media', MediaSchema);
const TextReply = mongoose.model('TextReply', TextReplySchema);

module.exports = { User, Video, Setting, Media, TextReply };
