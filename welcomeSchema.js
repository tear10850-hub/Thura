const mongoose = require('mongoose');

const WelcomeSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  welcomeVideoId: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Welcome', WelcomeSchema);
