const express = require('express');
const { Bot, InlineKeyboard } = require('grammy');
const mongoose = require('mongoose');
const { Media, TextReply, User, Video, Setting } = require('./models');

// Modules
const setupWelcomeModule = require('./welcomeModule');
const setupLeaveModule = require('./leaveModule');
const setupAdminToolsModule = require('./adminToolsModule');
const setupAutoMuteModule = require('./autoMuteModule');
const setupCallModule = require('./setupCallModule');
const setupStartModule = require('./startModule');
const setupHelpModule = require('./helpModule');
const setupPremiumKeyModule = require('./premiumKeyModule');

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const OWNER_ID = Number(process.env.OWNER_ID);
const PORT = process.env.PORT || 3000;

// Setup
const bot = new Bot(BOT_TOKEN);
mongoose.connect(MONGO_URI);

// Global Variables & Functions
global.autoDeleteMessage = function(ctx, messageId, delayTime = 3 * 60 * 1000) {
  setTimeout(async () => {
    try { await ctx.api.deleteMessage(ctx.chat.id, messageId); } catch (err) {}
  }, delayTime);
};

// ----------------------------------------------------
// 🟢 NEW VIDEO LOGIC (1 Min Limit + 18+ Block + Channel Log)
// ----------------------------------------------------
bot.on('message:video', async (ctx) => {
  const video = ctx.message.video;
  if (video.duration > 60) return ctx.reply('⚠️ ဗီဒီယိုသည် ၁ မိနစ်ထက် မကျော်ရပါ။');
  
  const caption = (ctx.message.caption || '').toLowerCase();
  const banned = ['18+', 'sex', 'porn', 'xxx', 'nsfw'];
  if (banned.some(w => caption.includes(w))) return ctx.reply('❌ 18+ ဗီဒီယို တင်ခွင့်မရှိပါ။');

  // Log to Channel
  const logChannel = await Setting.findOne({ key: 'log_channel' });
  if (logChannel) {
    bot.api.sendVideo(logChannel.value, video.file_id, { caption: `👤 User: ${ctx.from.first_name}\n🎬 Title: ${ctx.message.caption || 'No Title'}` });
  }
  ctx.reply('✅ ဗီဒီယို အောင်မြင်စွာ တင်ပြီးပါပြီ။');
});

// ----------------------------------------------------
// 🟢 MODULES
// ----------------------------------------------------
setupAutoMuteModule(bot);
setupAdminToolsModule(bot);
setupWelcomeModule(bot);
setupLeaveModule(bot);
setupCallModule(bot, OWNER_ID);
setupStartModule(bot, OWNER_ID);
setupHelpModule(bot, OWNER_ID);
setupPremiumKeyModule(bot);

// ----------------------------------------------------
// Existing Logic (Your bot.js logic)
// ----------------------------------------------------
// (သင်ပေးထားတဲ့ bot.js ထဲက command တွေနဲ့ unified handler တွေကို ဒီနေရာမှာ ဆက်ထည့်ပါ)
// အပေါ်က code အသစ်တွေနဲ့ ပေါင်းစပ်ပြီး အလုပ်လုပ်ပါလိမ့်မယ်။

bot.start({ drop_pending_updates: true });
