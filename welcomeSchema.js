const mongoose = require('mongoose');

const WelcomeSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  welcomeVideoId: { type: String, default: null },
  welcomeText: { type: String, default: null }, // /settouch ဖြင့် ပြောင်းထားသော စာသား သိမ်းရန်
  customButtons: [
    {
      text: String, // ခလုတ်အမည်
      url: String   // Link URL
    }
  ], // /addbutton ဖြင့် ထည့်ထားသော Inline Buttons များ သိမ်းရန်
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Welcome', WelcomeSchema);
