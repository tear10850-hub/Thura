require('dotenv').config();
const { Bot } = require('grammy');
const mongoose = require('mongoose');
const express = require('express');

// Express Server (UptimeRobot အတွက်)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🤖 Bot is Alive and Running!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web Server running on port ${PORT} for UptimeRobot.`);
});

// Safe Module Loading Function
function loadModule(path) {
  try {
    return require(path);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && err.message.includes(path)) {
      console.warn(`⚠️ Warning: Module "${path}" ကို ရှာမတွေ့ပါ။ ကျော်သွားပါမည်။`);
      return null;
    }
    throw err;
  }
}

// Module များကို ခေါ်ယူခြင်း (cloneModule ပါဝင်ခြင်း မရှိတော့ပါ)
const setupWelcomeModule = loadModule('./welcomeModule');
const setupLeaveModule = loadModule('./leaveModule');
const setupPremiumKeyModule = loadModule('./premiumKeyModule');
const setupAdminToolsModule = loadModule('./adminToolsModule');
const setupAutoMuteModule = loadModule('./autoMuteModule');
const setupCallModule = loadModule('./setupCallModule');

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;

if (!BOT_TOKEN || !MONGO_URI) {
  console.error("❌ BOT_TOKEN သို့မဟုတ် MONGO_URI ကို .env ဖိုင်ထဲတွင် ထည့်သွင်းပေးပါ။");
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

// Database ချိတ်ဆက်ခြင်း
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Database နှင့် အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ။"))
  .catch((err) => console.error("❌ MongoDB ချိတ်ဆက်မှု မအောင်မြင်ပါ:", err));

// Module များကို ချိတ်ဆက်ခြင်း
if (typeof setupWelcomeModule === 'function') setupWelcomeModule(bot);
if (typeof setupLeaveModule === 'function') setupLeaveModule(bot);
if (typeof setupPremiumKeyModule === 'function') setupPremiumKeyModule(bot);
if (typeof setupAdminToolsModule === 'function') setupAdminToolsModule(bot);
if (typeof setupAutoMuteModule === 'function') setupAutoMuteModule(bot);
if (typeof setupCallModule === 'function') setupCallModule(bot);

bot.catch((err) => {
  console.error("Bot တွင် Error တစ်ခု ဖြစ်ပေါ်ခဲ့ပါသည်:", err);
});

bot.start({
  onStart: (botInfo) => {
    console.log(`🤖 Bot (@${botInfo.username}) အောင်မြင်စွာ အလုပ်လုပ်နေပါပြီ...`);
  },
});
