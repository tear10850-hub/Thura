const mongoose = require('mongoose');

// Help Page များ၏ Data ပုံစံ သတ်မှတ်ခြင်း (စာမျက်နှာ ၁ မှ ၂၅ အထိ)
const helpPageSchema = new mongoose.Schema({
  pageNumber: { 
    type: Number, 
    required: true, 
    unique: true 
  },
  mediaType: { 
    type: String, 
    enum: ['photo', 'video', null], 
    default: null 
  },
  mediaId: { 
    type: String, 
    default: null 
  },
  text: { 
    type: String, 
    default: null 
  }
}, {
  timestamps: true // ဖန်တီးသည့် အချိန်နှင့် ပြင်ဆင်သည့် အချိန်များကို မှတ်ထားရန်
});

module.exports = mongoose.model('HelpPage', helpPageSchema);
