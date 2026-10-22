const mongoose = require('mongoose');

const WelcomeSchema = new mongoose.Schema({
  chatId: { 
    type: Number, 
    required: true, 
    unique: true, 
    index: true // Group အလိုက် Data မြန်မြန်ဆန်ဆန် ရှာဖွေနိုင်ရန် Index ထည့်သွင်းထားသည်
  },
  welcomeVideoId: { 
    type: String, 
    default: null 
  },
  welcomePhotoId: { 
    type: String, 
    default: null // 👈 ပုံ (Photo) သိမ်းဆည်းရန် ထည့်သွင်းပေးထားပါသည်
  },
  welcomeText: { 
    type: String, 
    default: null,
    maxlength: [2000, "Welcome စာသားသည် စာလုံးရေ ၂၀၀၀ ထက် မကျော်ရပါ"] // 🛡️ လုံခြုံရေးအတွက် စာလုံးရေ အကန့်အသတ်
  },
  customButtons: [
    {
      text: { 
        type: String, 
        required: true,
        maxlength: [100, "ခလုတ်အမည်သည် စာလုံးရေ ၁၀၀ ထက် မကျော်ရပါ"] // 🛡️ ခလုတ်စာသား အရှည်လွန်ကဲမှုကို ကာကွယ်ရန်
      },
      url: { 
        type: String, 
        required: true,
        validate: {
          validator: function(v) {
            // 🛡️ လုံခြုံရေး: http သို့မဟုတ် https ဖြင့် စတင်သော Link မှန်ကန်ကြောင်း စစ်ဆေးခြင်း
            return /^https?:\/\/.+/.test(v);
          },
          message: props => `${props.value} သည် မှန်ကန်သော URL လਿੰ်ခ် မဟုတ်ပါ (http သို့မဟုတ် https ဖြင့် စတင်ရပါမည်)။`
        }
      }
    }
  ],
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update လုပ်တိုင်း အချိန်အလိုအလျောက် မှတ်သားရန် Middleware
WelcomeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Welcome', WelcomeSchema);
