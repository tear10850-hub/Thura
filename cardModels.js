const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, required: true },
  rarity: { type: String, default: 'EPIC' }, // GOLD, Legendary, Legend, EPIC
  isPrizeCard: { type: Boolean, default: false },
  prizeType: { type: String, default: '' },
  bio: { type: String, default: 'No bio available' },
  ownerId: { type: Number, default: null }
});

const userInventorySchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true },
  userName: { type: String },
  coins: { type: Number, default: 0 },
  cards: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Card' }]
});

const keySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  userId: { type: Number, required: true },
  cardName: { type: String, required: true },
  prizeDetails: { type: String, default: '' }, // Owner သတ်မှတ်သည့် ဆုကြေးအသေးစိတ် (MLBB UC/Cash စသည်)
  isRedeemed: { type: Boolean, default: false },
  ownerGenerated: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const groupActivitySchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  charCount: { type: Number, default: 0 }
});

module.exports = {
  Card: mongoose.models.Card || mongoose.model('Card', cardSchema),
  UserInventory: mongoose.models.UserInventory || mongoose.model('UserInventory', userInventorySchema),
  KeyModel: mongoose.models.KeyModel || mongoose.model('KeyModel', keySchema),
  GroupActivity: mongoose.models.GroupActivity || mongoose.model('GroupActivity', groupActivitySchema)
};
