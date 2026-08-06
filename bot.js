require('dotenv').config();
const { Bot } = require('grammy');
const mongoose = require('mongoose');
const express = require('express');

// Express Server ဖန်တီးခြင်း (UptimeRobot အတွက်)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🤖 Bot is Alive and Running!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web Server running on port ${PORT} for UptimeRobot.`);
});

// Module များကို ခေါ်ယူခြင်း
const setupWelcomeModule = require('./welcomeModule');
const setupLeaveModule = require('./leaveModule');
const setupPremiumKeyModule = require('./premiumKeyModule');
const setupAdminToolsModule = require('./adminToolsModule');
const setupAutoMuteModule = require('./autoMuteModule');
const setupCloneModule = require('./cloneModule');
const setupCallModule = require('./setupCallModule');

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
setupWelcomeModule(bot);
setupLeaveModule(bot);
setupPremiumKeyModule(bot);
setupAdminToolsModule(bot);
setupAutoMuteModule(bot);

if (typeof setupCloneModule === 'function') {
  setupCloneModule(bot);
}

if (typeof setupCallModule === 'function') {
  setupCallModule(bot);
}

bot.catch((err) => {
  console.error("Bot တွင် Error တစ်ခု ဖြစ်ပေါ်ခဲ့ပါသည်:", err);
});

bot.start({
  onStart: (botInfo) => {
    console.log(`🤖 Bot (@${botInfo.username}) အောင်မြင်စွာ အလုပ်လုပ်နေပါပြီ...`);
  },
});
