const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
  chatId: { 
    type: Number, 
    required: true, 
    unique: true, 
    index: true // Group အလိုက် Data မြန်မြန်ဆန်ဆန် ရှာဖွေနိုင်ရန် Index ထည့်သွင်းထားသည်
  },
  leaveVideoId: { 
    type: String, 
    default: null 
  },
  leaveText: { 
    type: String, 
    default: null 
  },
  customButtons: [
    {
      text: { type: String, required: true },
      url: { type: String, required: true }
    }
  ],
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Leave', LeaveSchema);
