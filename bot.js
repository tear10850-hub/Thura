const express = require('express');
const { Bot } = require('grammy');
const mongoose = require('mongoose');
const { Media, TextReply } = require('./models');

// AI Module ကို ချိတ်ဆက်ခြင်း
const { getAISettings, handleAIResponse } = require('./ai');

// Modules များကို ချိတ်ဆက်ခြင်း
const setupWelcomeModule = require('./welcomeModule');
const setupLeaveModule = require('./leaveModule');
const setupAdminToolsModule = require('./adminToolsModule');
const setupAutoMuteModule = require('./autoMuteModule');
const setupCallModule = require('./setupCallModule');
const setupStartModule = require('./startModule');
const setupHelpModule = require('./helpModule');
const setupPremiumKeyModule = require('./premiumKeyModule');
const setupMediaManagerModule = require('./mediaManagerModule');

const setupChannelGroupModule = require('./channelGroupManager');
const setupBotLeaveModule = require('./botLeaveModule');
const { setupScriptModule } = require('./scriptModule');

const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const OWNER_ID = Number(process.env.OWNER_ID);
const PORT = process.env.PORT || 3000;
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;

if (!BOT_TOKEN || !MONGO_URI || !OWNER_ID) {
  console.error("FATAL ERROR: BOT_TOKEN, MONGO_URI, or OWNER_ID is not set in Environment Variables!");
  process.exit(1);
}

let replyCounter = 0;
let isOwnerMediaMode = false;
let isTearOpen = true; 
let uniqueUsersCount = new Set();

// Group အလိုက် ဆက်တင်များ သိမ်းဆည်းရန် Map (Auto-Delete အချိန် စက္ကန့်ပိုင်းအထိ ထည့်သွင်းထားသည်)
const groupSettings = new Map(); 

global.isBcastAutoDelete = true;

const app = express();
app.get('/', (req, res) => {
  res.status(200).send('Telegram Bot is alive and running smoothly!');
});
app.listen(PORT, () => {
  console.log(`Web Server is running on port ${PORT}`);
});

if (RENDER_EXTERNAL_URL) {
  setInterval(() => {
    fetch(RENDER_EXTERNAL_URL)
      .then(() => console.log('[Uptime Keep-Alive]: Pinged server successfully!'))
      .catch((err) => console.error('[Uptime Keep-Alive Error]:', err.message));
  }, 5 * 60 * 1000);
}

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB Connected Successfully!');
  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    setTimeout(connectDB, 5000);
  }
};
connectDB();

const bot = new Bot(BOT_TOKEN);

// ============================================================
// ⏰ Dynamic Auto Delete Bot Messages (Admin တွေ စိတ်ကြိုက်ပြင်လို့ရသည်)
// ============================================================
global.autoDeleteMessage = function(ctx, messageId, customDelay = null) {
  let delayTime = customDelay;
  
  if (delayTime === null) {
    const chatId = ctx.chat.id;
    const config = groupSettings.get(chatId);
    delayTime = config ? config.autoDelTime : (3 * 60 * 1000); // မူလ သတ်မှတ်ချက် ၃ မိနစ်
  }

  // အကယ်၍ အချိန်ကို 0 သို့မဟုတ် ထို့ထက်နည်းအောင် (မပျက်စေရန်) ထားပါက ဖျက်မည့်စနစ်ကို ရပ်ဆိုင်းမည်
  if (delayTime <= 0) return;

  setTimeout(async () => {
    try {
      await ctx.api.deleteMessage(ctx.chat.id, messageId);
    } catch (err) {}
  }, delayTime);
};

// Admin စစ်ဆေးရန် Helper
async function isAdmin(ctx) {
  if (ctx.chat.type === 'private') return true;
  try {
    const member = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
    return ['administrator', 'creator'].includes(member.status);
  } catch (err) {
    return false;
  }
}

// ============================================================
// 🟢 MODULES များကို ချိတ်ဆက်ခြင်း
// ============================================================
setupAutoMuteModule(bot);
setupAdminToolsModule(bot);
setupWelcomeModule(bot);
setupLeaveModule(bot);
setupCallModule(bot, OWNER_ID);
setupStartModule(bot, OWNER_ID);
setupHelpModule(bot, OWNER_ID);
setupPremiumKeyModule(bot);
setupMediaManagerModule(bot, OWNER_ID);

setupChannelGroupModule(bot, OWNER_ID);
setupBotLeaveModule(bot, OWNER_ID);
setupScriptModule(bot, OWNER_ID);

bot.catch((err) => {
  console.error(`Error while handling update ${err.ctx.update.update_id}:`);
  console.error(err.error);
});

const urlRegex = /(https?:\/|www\.)[^\s]+/g;
const BAD_WORDS = ["စပ့", "စပ", "လီး", "ယီး", "ဖေလို", "ဖေလိုမ", "မသာ", "ထန်မယ်", "လိုးမယ်"];

function containsBadWord(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return BAD_WORDS.some(word => lowerText.includes(word));
}

// ============================================================
// ⚙️ Group Configuration Commands (/people, /replymode, /botchat, /autodel)
// ============================================================
bot.command('people', async (ctx) => {
  if (!(await isAdmin(ctx))) return ctx.reply("❌ ဤ Command ကို Admin များသာ အသုံးပြုနိုင်ပါသည်။");

  const args = ctx.message.text.split(' ').slice(1);
  const chatId = ctx.chat.id;

  if (!groupSettings.has(chatId)) {
    groupSettings.set(chatId, { count: 3, replyMode: true, toggleOpen: true, autoDelTime: 3 * 60 * 1000 });
  }
  const config = groupSettings.get(chatId);

  if (args.length === 0) {
    let currentMin = Math.round(config.autoDelTime / 60000);
    return ctx.reply(`⚙️ လက်ရှိ Group ဆက်တင်များ:\n- လိုအပ်သော လူဦးရေ: ${config.count} ယောက်\n- Reply ထောက်ပြောရန်: ${config.replyMode ? 'ဖွင့်ထားသည်' : 'ပိတ်ထားသည်'}\n- Bot စကားပြောစနစ်: ${config.toggleOpen ? 'ဖွင့်ထားသည်' : 'ပိတ်ထားသည်'}\n- အလိုအလျောက်ဖျက်မည့်အချိန်: ${config.autoDelTime === 0 ? 'မပျက်စေရ (ပိတ်ထားသည်)' : currentMin + ' မိနစ်'}\n\nအသုံးပြုပုံ: \`/people [အရေအတွက်]\``);
  }

  const num = parseInt(args[0]);
  if (isNaN(num) || num < 1 || num > 50) {
    return ctx.reply("❌ ကျေးဇူးပြု၍ ၁ မှ ၅၀ အတွင်း မှန်ကန်သော နံပါတ်ကို ထည့်ပေးပါ။");
  }

  config.count = num;
  groupSettings.set(chatId, config);
  await ctx.reply(`✅ ဤ Group အတွက် စာမပြောမီ စောင့်ရမည့် လူဦးရေကို **${num} ယောက်** သို့ ပြောင်းလဲလိုက်ပါပြီ။`);
});

bot.command('replymode', async (ctx) => {
  if (!(await isAdmin(ctx))) return ctx.reply("❌ Admin များသာ သုံးနိုင်ပါသည်။");
  const chatId = ctx.chat.id;
  if (!groupSettings.has(chatId)) groupSettings.set(chatId, { count: 3, replyMode: true, toggleOpen: true, autoDelTime: 3 * 60 * 1000 });
  const config = groupSettings.get(chatId);
  
  config.replyMode = !config.replyMode;
  groupSettings.set(chatId, config);
  await ctx.reply(`✅ Reply ထောက်ပြောသည့်စနစ်ကို **${config.replyMode ? 'ဖွင့်လိုက်ပါပြီ (Reply ထောက်မည်)' : 'ပိတ်လိုက်ပါပြီ (စာသားသပ်သပ် ပို့မည်)'}**။`);
});

bot.command('botchat', async (ctx) => {
  if (!(await isAdmin(ctx))) return ctx.reply("❌ Admin များသာ သုံးနိုင်ပါသည်။");
  const chatId = ctx.chat.id;
  if (!groupSettings.has(chatId)) groupSettings.set(chatId, { count: 3, replyMode: true, toggleOpen: true, autoDelTime: 3 * 60 * 1000 });
  const config = groupSettings.get(chatId);
  
  config.toggleOpen = !config.toggleOpen;
  groupSettings.set(chatId, config);
  await ctx.reply(`✅ ဤ Group ၏ Bot စကားပြောတုံ့ပြန်မှုစနစ်ကို **${config.toggleOpen ? 'ဖွင့်ထားသည်' : 'ပိတ်ထားသည်'}**။`);
});

// Admin တွေ စိတ်ကြိုက် အချိန်သတ်မှတ်ရန် သို့မဟုတ် မပျက်အောင် လုပ်ရန် ကွန်မန်း
bot.command('autodel', async (ctx) => {
  if (!(await isAdmin(ctx))) return ctx.reply("❌ Admin များသာ ဤ Command ကို သုံးနိုင်ပါသည်။");
  
  const args = ctx.message.text.split(' ').slice(1);
  const chatId = ctx.chat.id;
  
  if (!groupSettings.has(chatId)) {
    groupSettings.set(chatId, { count: 3, replyMode: true, toggleOpen: true, autoDelTime: 3 * 60 * 1000 });
  }
  const config = groupSettings.get(chatId);

  if (args.length === 0) {
    let currentMin = Math.round(config.autoDelTime / 60000);
    return ctx.reply(`⏱️ လက်ရှိ Auto-Delete အချိန်: **${config.autoDelTime === 0 ? 'လုံးဝမပျက်ပါ (ပိတ်ထားသည်)' : currentMin + ' မိနစ်'}**\n\nအသုံးပြုရန်ပုံစံ:\n- \`/autodel 5\` (၅ မိနစ်မှ အလိုအလျောက် ပျက်ရန်)\n- \`/autodel 0\` (စာများ လုံးဝမပျက်စေရန် အပြီးအပိုင် ပိတ်ရန်)`);
  }

  const minutes = parseInt(args[0]);
  if (isNaN(minutes) || minutes < 0) {
    return ctx.reply("❌ ကျေးဇူးပြု၍ မှန်ကန်သော မိနစ်အριθ (၀ သို့မဟုတ် ထို့ထက်ပိုသောဂဏန်း) ကို ထည့်ပါ။");
  }

  if (minutes === 0) {
    config.autoDelTime = 0;
    groupSettings.set(chatId, config);
    return ctx.reply("✅ ဤ Group တွင် ဘော့တ်ပို့သော စာများ **လုံးဝ အလိုအလျောက် မပျက်တော့ပါ** (Auto-Delete ပိတ်လိုက်ပါပြီ)။");
  }

  config.autoDelTime = minutes * 60 * 1000;
  groupSettings.set(chatId, config);
  await ctx.reply(`✅ ဤ Group ၏ Auto-Delete အချိန်ကို **${minutes} မိနစ်** သို့ အောင်မြင်စွာ ပြောင်းလဲလိုက်ပါပြီ။`);
});

// ============================================================
// AI Commands
// ============================================================
bot.command('aiopen', async (ctx) => {
  const settings = getAISettings(ctx.from.id);
  settings.isOpen = true;
  const sent = await ctx.reply("🟢 AI စနစ်ကို ဖွင့်လိုက်ပါပြီရှင်။");
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('aioff', async (ctx) => {
  const settings = getAISettings(ctx.from.id);
  settings.isOpen = false;
  const sent = await ctx.reply("🔴 AI စနစ်ကို ပိတ်လိုက်ပါပြီရှင်။");
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('aitxt', async (ctx) => {
  const settings = getAISettings(ctx.from.id);
  settings.mode = 'text';
  const sent = await ctx.reply("💬 စာသား Mode သို့ ပြောင်းလိုက်ပါပြီရှင်။");
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('aivoice', async (ctx) => {
  const settings = getAISettings(ctx.from.id);
  settings.mode = 'voice';
  const sent = await ctx.reply("🔊 အသံ Mode သို့ ပြောင်းလိုက်ပါပြီရှင်။");
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('ai', async (ctx) => {
  const settings = getAISettings(ctx.from.id);
  settings.isOpen = true; 
  const handled = await handleAIResponse(ctx, ctx.message.text, { reply_parameters: { message_id: ctx.message.message_id } }, OWNER_ID);
  if (!handled) {
    const sent = await ctx.reply("🤖 AI စနစ် အဆင်သင့် ဖြစ်ပါပြီရှင်။");
    global.autoDeleteMessage(ctx, sent.message_id);
  }
});

// ============================================================
// 📢 Owner Broadcast & Management Commands
// ============================================================
bot.command('treply', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  const repliedMsg = ctx.message.reply_to_message;
  if (!repliedMsg) return ctx.reply('⚠️ ကျေးဇူးပြု၍ ပို့လိုသော ကြော်ငြာစာကို Reply ထောက်ပြီး `/treply` ဟု ရိုက်ပါ။');

  const adText = repliedMsg.text || repliedMsg.caption || '';
  const adPhoto = repliedMsg.photo ? repliedMsg.photo[repliedMsg.photo.length - 1].file_id : null;
  const adVideo = repliedMsg.video ? repliedMsg.video.file_id : null;
  try { await ctx.deleteMessage(); } catch (err) {}

  const { User } = require('./models');
  let successCount = 0, failCount = 0;
  if (User) {
    const users = await User.find({});
    for (const user of users) {
      try {
        let sentMsg;
        if (adPhoto) sentMsg = await ctx.api.sendPhoto(user.chatId, adPhoto, { caption: adText });
        else if (adVideo) sentMsg = await ctx.api.sendVideo(user.chatId, adVideo, { caption: adText });
        else if (adText) sentMsg = await ctx.api.sendMessage(user.chatId, adText);

        if (sentMsg) {
          setTimeout(async () => {
            try { await ctx.api.deleteMessage(user.chatId, sentMsg.message_id); } catch (e) {}
          }, 3 * 60 * 1000);
          successCount++;
        }
      } catch (err) { failCount++; }
    }
  }
  const reportMsg = await ctx.reply(`✅ ကြော်ငြာ ပို့ပြီးသူ: ${successCount} ယောက် | ပို့မရသူ: ${failCount} ယောက်`);
  global.autoDeleteMessage(ctx, reportMsg.message_id, 3 * 60 * 1000);
});

bot.command('sendlink', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  const messageText = ctx.message.text.replace('/sendlink', '').trim();
  if (!messageText) return ctx.reply('⚠️ ကျေးဇူးပြု၍ ပို့လိုသော စာသားပါ ထည့်ရေးပေးပါ။');

  const groupLink = 'https://t.me/your_group_link'; 
  const fullMessage = `${messageText}\n\n🔗 ဝင်ရန်လင့်ခ်: ${groupLink}`;

  try { await ctx.deleteMessage(); } catch (err) {}

  const { User } = require('./models');
  let successCount = 0, failCount = 0;
  if (User) {
    const users = await User.find({});
    for (const user of users) {
      try {
        const sentMsg = await ctx.api.sendMessage(user.chatId, fullMessage);
        setTimeout(async () => {
          try { await ctx.api.deleteMessage(user.chatId, sentMsg.message_id); } catch (e) {}
        }, 5 * 60 * 60 * 1000);
        successCount++;
      } catch (err) { failCount++; }
    }
  }
  const reportMsg = await ctx.reply(`✅ ပို့ပြီးသူ: ${successCount} ယောက် | ပို့မရသူ: ${failCount} ယောက်`);
  global.autoDeleteMessage(ctx, reportMsg.message_id, 3 * 60 * 1000);
});

bot.command('open', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  isOwnerMediaMode = true;
  const sent = await ctx.reply("✅ Owner Media Mode ဖွင့်လိုက်ပါပြီ။");
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('close', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  isOwnerMediaMode = false;
  const sent = await ctx.reply("❌ Owner Media Mode ပိတ်လိုက်ပါပြီ။");
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('Tearopen', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  isTearOpen = true;
  uniqueUsersCount.clear();
  const sent = await ctx.reply("🔓 Tear Open Mode ဖွင့်လိုက်ပါပြီ။");
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('Tear', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  isTearOpen = false;
  uniqueUsersCount.clear();
  const sent = await ctx.reply("🔒 Tear Mode ဖွင့်လိုက်ပါပြီ။");
  global.autoDeleteMessage(ctx, sent.message_id);
});

// ============================================================
// 🗑️ Owner Clean & Media Deletion Commands
// ============================================================
bot.command('clearbrain', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  try {
    await TextReply.deleteMany({});
    await Media.deleteMany({});
    const sent = await ctx.reply("🗑️ Bot ၏ မှတ်ဉာဏ်များ အားလုံးကို ဖျက်ထုတ်လိုက်ပါပြီ။");
    global.autoDeleteMessage(ctx, sent.message_id);
  } catch (err) { console.error(err); }
});

bot.command('cleansymbols', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  try {
    const result = await TextReply.deleteMany({ $or: [{ text: /^[\/@]/ }, { text: { $regex: /@/ } }] });
    const sent = await ctx.reply(`🧹 Symbol ပါသော စာပေါင်း ${result.deletedCount} ခုကို ဖျက်ထုတ်လိုက်ပါပြီ။`);
    global.autoDeleteMessage(ctx, sent.message_id);
  } catch (err) { console.error(err); }
});

bot.command('cleanlong', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  try {
    const allReplies = await TextReply.find();
    let deleteIds = [];
    for (const doc of allReplies) {
      if (doc.text.length > 80 || /[a-zA-Z]{16,}/.test(doc.text)) deleteIds.push(doc._id);
    }
    if (deleteIds.length > 0) {
      await TextReply.deleteMany({ _id: { $in: deleteIds } });
      const sent = await ctx.reply(`🧹 စာအရှည်ကြီး ${deleteIds.length} ခုကို ရှင်းထုတ်လိုက်ပါပြီ။`);
      global.autoDeleteMessage(ctx, sent.message_id);
    } else {
      const sent = await ctx.reply("🧹 ဖျက်ရန် မရှိပါ။");
      global.autoDeleteMessage(ctx, sent.message_id);
    }
  } catch (err) { console.error(err); }
});

bot.command('clearstickers', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  try {
    const result = await Media.deleteMany({ type: 'sticker' });
    const sent = await ctx.reply(`🗑️ စတစ်ကာ (Stickers) အားလုံးပေါင်း ${result.deletedCount} ခုကို ဖျက်ထုတ်လိုက်ပါပြီ။`);
    global.autoDeleteMessage(ctx, sent.message_id);
  } catch (err) { console.error(err); }
});

bot.command('clearmedia', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  try {
    const result = await Media.deleteMany({ type: { $in: ['photo', 'video', 'audio', 'music'] } });
    const sent = await ctx.reply(`🗑️ မီဒီယာ (Photo/Video/Audio) အားလုံးပေါင်း ${result.deletedCount} ခုကို ဖျက်ထုတ်လိုက်ပါပြီ။`);
    global.autoDeleteMessage(ctx, sent.message_id);
  } catch (err) { console.error(err); }
});

// ============================================================
// 📤 Channel ထဲသို့ တိုက်ရိုက်ပို့ရန် ကွန်မန်း
// ============================================================
bot.command('sendchannel', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  const repliedMsg = ctx.message.reply_to_message;
  if (!repliedMsg) return ctx.reply('⚠️ ကျေးဇူးပြု၍ Channel ထဲ ပို့လိုသော စာ/မီဒီယာကို Reply ထောက်ပြီး `/sendchannel [Channel Username]` ဟု ရိုက်ပါ။');

  const args = ctx.message.text.split(' ').slice(1);
  const targetChannel = args[0];
  if (!targetChannel) return ctx.reply('⚠️ ကျေးဇူးပြု၍ ပို့ရမည့် Channel Username (ဥပမာ: `@mychannel`) ကို ထည့်ရေးပေးပါ။');

  try {
    await ctx.deleteMessage();
    let sent;
    if (repliedMsg.photo) {
      sent = await ctx.api.sendPhoto(targetChannel, repliedMsg.photo[repliedMsg.photo.length - 1].file_id, { caption: repliedMsg.caption || '' });
    } else if (repliedMsg.video) {
      sent = await ctx.api.sendVideo(targetChannel, repliedMsg.video.file_id, { caption: repliedMsg.caption || '' });
    } else if (repliedMsg.text) {
      sent = await ctx.api.sendMessage(targetChannel, repliedMsg.text);
    } else if (repliedMsg.sticker) {
      sent = await ctx.api.sendSticker(targetChannel, repliedMsg.sticker.file_id);
    }

    if (sent) {
      const report = await ctx.reply(`✅ Channel (${targetChannel}) သို့ အောင်မြင်စွာ ပို့ပြီးပါပြီ။`);
      global.autoDeleteMessage(ctx, report.message_id);
    }
  } catch (err) {
    ctx.reply(`❌ ပို့၍မရပါ: ${err.message}`);
  }
});

// ============================================================
// 🟢 Unified Message Handler
// ============================================================
bot.on('message', async (ctx, next) => {
  if (ctx.message.new_chat_members || ctx.message.left_chat_member) {
    return next();
  }

  try {
    const isOwner = ctx.from && ctx.from.id === OWNER_ID;
    const isPrivate = ctx.chat.type === 'private';
    const msg = ctx.message;
    const chatId = ctx.chat.id;

    if (!groupSettings.has(chatId)) {
      groupSettings.set(chatId, { count: 3, replyMode: true, toggleOpen: true, autoDelTime: 3 * 60 * 1000 });
    }
    const currentGroupConfig = groupSettings.get(chatId);

    const replyOptions = currentGroupConfig.replyMode 
      ? { reply_parameters: { message_id: msg.message_id } } 
      : {};

    const emojis = ['👍', '❤️', '🔥', '🥰', '👏', '😁'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    try { await ctx.react(randomEmoji); } catch (e) {}

    // 1. Owner Media Mode
    if (isOwner && isPrivate && isOwnerMediaMode) {
      let type = null, fileId = null;
      if (msg.audio || msg.voice) { type = msg.audio ? 'music' : 'audio'; fileId = (msg.audio || msg.voice).file_id; }
      else if (msg.video) { type = 'video'; fileId = msg.video.file_id; }
      else if (msg.photo) { type = 'photo'; fileId = msg.photo[msg.photo.length - 1].file_id; }
      else if (msg.sticker) { type = 'sticker'; fileId = msg.sticker.file_id; }
      else if (msg.text && urlRegex.test(msg.text)) { type = 'link'; fileId = msg.text.match(urlRegex)[0]; }

      if (type && fileId) {
        await ctx.replyWithChatAction('typing');
        await Media.create({ type, fileId, caption: msg.caption || '' });
        const sent = await ctx.reply(`✅ Owner ၏ ${type} ကို သိမ်းဆည်းပြီးပါပြီ။`, replyOptions);
        global.autoDeleteMessage(ctx, sent.message_id);
        return;
      }
    }

    // 2. Text Replies & AI Integration
    if (msg.text && !urlRegex.test(msg.text)) {
      const isCommand = msg.text.startsWith('/');
      const isBadWord = containsBadWord(msg.text);
      const hasMention = msg.text.includes('@');
      const isTooLong = msg.text.length > 80;
      const isEnglishLong = /[a-zA-Z]{16,}/.test(msg.text);

      if (!isCommand && !isBadWord && !hasMention && !isTooLong && !isEnglishLong) {
        await TextReply.create({ text: msg.text, fromUserId: ctx.from.id, chatId: chatId });
      }

      if (!isCommand) {
        if (!currentGroupConfig.toggleOpen) return; 

        try {
          const aiHandled = await handleAIResponse(ctx, msg.text, replyOptions, OWNER_ID);
          if (aiHandled) return; 
        } catch (aiErr) {}

        if (!isTearOpen) {
          uniqueUsersCount.add(ctx.from.id);
          if (uniqueUsersCount.size < currentGroupConfig.count) return; 
          uniqueUsersCount.clear();
        }

        const count = await TextReply.countDocuments();
        if (count > 0) {
          try { await ctx.replyWithChatAction('typing'); } catch (err) {}

          const randomDoc = await TextReply.findOne().skip(Math.floor(Math.random() * count));
          if (randomDoc) {
            await TextReply.updateOne({ _id: randomDoc._id }, { lastUsedAt: new Date() });
            await new Promise(resolve => setTimeout(resolve, 800));

            const sentMsg = await ctx.reply(randomDoc.text, replyOptions);
            global.autoDeleteMessage(ctx, sentMsg.message_id);
            
            replyCounter++;
            if (replyCounter >= 8) {
              replyCounter = 0;
              const stickerCount = await Media.countDocuments({ type: 'sticker' });
              if (stickerCount > 0) {
                try {
                  await ctx.replyWithChatAction('choose_sticker');
                  await new Promise(resolve => setTimeout(resolve, 600));
                } catch (err) {}

                const randomSticker = await Media.findOne({ type: 'sticker' }).skip(Math.floor(Math.random() * stickerCount));
                if (randomSticker) {
                  const sentSticker = await ctx.replyWithSticker(randomSticker.fileId, replyOptions);
                  global.autoDeleteMessage(ctx, sentSticker.message_id);
                }
              }
            }
          }
        }
      }
      return;
    }

    // 3. Media Replies
    let requestedType = null;
    if (msg.audio || msg.voice) requestedType = msg.audio ? 'music' : 'audio';
    else if (msg.video) requestedType = 'video';
    else if (msg.photo) requestedType = 'photo';
    else if (msg.sticker) requestedType = 'sticker';

    if (requestedType && currentGroupConfig.toggleOpen) {
      const mediaCount = await Media.countDocuments({ type: requestedType });
      if (mediaCount > 0) {
        const randomMedia = await Media.findOne({ type: requestedType }).skip(Math.floor(Math.random() * mediaCount));
        if (randomMedia) {
          let sentMedia;
          if (requestedType === 'photo') { await ctx.replyWithChatAction('upload_photo'); sentMedia = await ctx.replyWithPhoto(randomMedia.fileId, replyOptions); }
          else if (requestedType === 'video') { await ctx.replyWithChatAction('upload_video'); sentMedia = await ctx.replyWithVideo(randomMedia.fileId, replyOptions); }
          else if (requestedType === 'sticker') { await ctx.replyWithChatAction('choose_sticker'); sentMedia = await ctx.replyWithSticker(randomMedia.fileId, replyOptions); }
          else if (requestedType === 'music' || requestedType === 'audio') { await ctx.replyWithChatAction('upload_voice'); sentMedia = await ctx.replyWithAudio(randomMedia.fileId, replyOptions); }

          if (sentMedia) global.autoDeleteMessage(ctx, sentMedia.message_id);
        }
      }
    }

  } catch (error) {
    console.error('Error in Unified Message Handler:', error);
  }
});

// Auto Clean Up
setInterval(async () => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await TextReply.deleteMany({ lastUsedAt: { $lt: thirtyDaysAgo } });
  } catch (err) {}
}, 24 * 60 * 60 * 1000);

// Bot Start
bot.start({
  drop_pending_updates: true,
  allowed_updates: ["message", "callback_query", "chat_member"]
});

console.log('🤖 Bot is running smoothly with complete features and custom auto-delete!');
