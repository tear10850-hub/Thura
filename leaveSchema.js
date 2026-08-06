const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  leaveVideoId: { type: String, default: null },
  leaveText: { type: String, default: null }, // /setltouch ဖြင့် ပြောင်းထားသော စာသား သိမ်းရန်
  customButtons: [
    {
      text: String, // ခလုတ်အမည်
      url: String   // Link URL
    }
  ], // /addlbutton ဖြင့် ထည့်ထားသော Dynamic Buttons များ သိမ်းရန်
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Leave', LeaveSchema);
