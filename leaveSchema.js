const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  leaveVideoId: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Leave', LeaveSchema);
