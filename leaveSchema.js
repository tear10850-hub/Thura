const mongoose = require('mongoose');

const LeaveSchema = new mongoose.Schema({
  chatId: { 
    type: Number, 
    required: true, 
    unique: true, 
    index: true
  },
  leaveVideoId: { 
    type: String, 
    default: null 
  },
  leaveText: { 
    type: String, 
    default: null,
    maxlength: [2000, "Leave စာသားသည် စာလုံးရေ ၂၀၀၀ ထက် မကျော်ရပါ"]
  },
  customButtons: {
    type: [
      {
        text: { 
          type: String, 
          required: true,
          maxlength: [100, "ခလုတ်အမည်သည် စာလုံးရေ ၁၀၀ ထက် မကျော်ရပါ"]
        },
        url: { 
          type: String, 
          required: true,
          validate: {
            validator: function(v) {
              return /^https?:\/\/.+/.test(v);
            },
            message: props => `${props.value} သည် မှန်ကန်သော URL လင့်ခ် မဟုတ်ပါ (http သို့မဟုတ် https ဖြင့် စတင်ရပါမည်)။`
          }
        }
      }
    ],
    default: []
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// save လုပ်တိုင်း updatedAt ကို အလိုအလျောက် ပြင်ဆင်မယ်
LeaveSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// findOneAndUpdate လုပ်တဲ့အခါ updatedAt ကိုလည်း ပြင်ဆင်မယ်
LeaveSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

module.exports = mongoose.model('Leave', LeaveSchema);
