const mongoose = require('mongoose');

const chatStoreSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  type: { type: String, required: true } // 'private', 'group', 'supergroup', 'channel'
});

module.exports = mongoose.model('ChatStore', chatStoreSchema);
