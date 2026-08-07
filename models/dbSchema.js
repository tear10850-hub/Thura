const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  chatId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  following: [{ type: String }],
  favorites: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

const videoSchema = new mongoose.Schema({
  videoId: { type: String, required: true, unique: true },
  chatId: { type: String, required: true },
  fileId: { type: String, required: true },
  caption: { type: String, default: '' },
  visibility: { type: String, default: 'public' },
  likes: [{ type: String }],
  comments: [
    {
      chatId: String,
      name: String,
      text: String,
      createdAt: { type: Date, default: Date.now }
    }
  ]
});

const User = mongoose.model('User', userSchema);
const Video = mongoose.model('Video', videoSchema);

module.exports = { User, Video };
