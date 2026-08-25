const express = require('express');
const { Bot, InlineKeyboard, Keyboard } = require('grammy');
const mongoose = require('mongoose');
const { Media, TextReply, BotSetting } = require('./models');

// AI Module ကို ချိတ်ဆက်ခြင်း
const { getAISettings, handleAIResponse } = require('./ai');

// Modules
const setupWelcomeModule = require('./welcomeModule');
const setupLeaveModule = require('./leaveModule');
const setupAdminToolsModule = require('./adminToolsModule');
const setupAutoMuteModule = require('./autoMuteModule');
const setupCallModule = require('./setupCallModule');
const setupStartModule = require('./startModule');
const setupHelpModule = require('./helpModule');
const setupPremiumKeyModule = require('./premiumKeyModule');
const setupMediaManagerModule = require('./mediaManagerModule');

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
// ⏰ Auto Delete Bot Messages
// ============================================================
global.autoDeleteMessage = function(ctx, messageId, delayTime = 3 * 60 * 1000) {
  setTimeout(async () => {
    try {
      await ctx.api.deleteMessage(ctx.chat.id, messageId);
    } catch (err) {}
  }, delayTime);
};

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

bot.catch((err) => {
  console.error(`Error while handling update ${err.ctx.update.update_id}:`);
  console.error(err.error);
});

const urlRegex = /(https?:\/|www\.)[^\s]+/g;

const BAD_WORDS = [
  "စပ့", "စပ", "လီး", "ယီး", "ဖေလို", "ဖေလိုမ", "မသာ", "ထန်မယ်", "လိုးမယ်"
];

function containsBadWord(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return BAD_WORDS.some(word => lowerText.includes(word));
}

// ============================================================
// 🛡️ Admin သို့မဟုတ် Owner ဖြစ်မဖြစ် စစ်ဆေးသော Helper Function
// ============================================================
async function isAdminOrOwner(ctx) {
  if (ctx.from && ctx.from.id === OWNER_ID) return true;
  if (!ctx.chat || ctx.chat.type === 'private') return true; 
  
  try {
    const member = await ctx.getChatMember(ctx.from.id);
    return ['creator', 'administrator'].includes(member.status);
  } catch (e) {
    return false;
  }
}

// ============================================================
// ✨ "ဖီးလ်စာတို" အမြဲပါမည့် Reply Keyboard ဖန်တီးခြင်း
// ============================================================
function getPersistentKeyboard() {
  return new Keyboard().text("💌 ဖီးလ်စာတို").resized();
}

bot.command('start', async (ctx) => {
  if (ctx.chat.type === 'private') {
    const welcomeText = `✨ <b>မင်္ဂလာပါရှင့် Bot မှ ကြိုဆိုပါတယ်ရှင့်။</b> ✨\n\n` +
                        `🤖 အောက်ပါ <b>"💌 ဖီးလ်စာတို"</b> ခလုတ်ကို နှိပ်ပြီး Bot ကို Group/Channel များသို့ ထည့်သွင်းနိုင်ပါတယ်ရှင့်။`;
    
    await ctx.reply(welcomeText, { parse_mode: 'HTML', reply_markup: getPersistentKeyboard() });
  }
});

// ============================================================
// 💌 "ဖီးလ်စာတို" ခလုတ်ကို နှိပ်လိုက်သောအခါ Group ထည့်ရန် Link ပို့ပေးခြင်း
// ============================================================
bot.hears("💌 ဖီးလ်စာတို", async (ctx) => {
  if (ctx.chat.type === 'private') {
    const botInfo = await ctx.api.getMe();
    const inlineKeyboard = new InlineKeyboard()
      .url("➕ Bot ကို Group/Channel ထဲသို့ ထည့်ရန်", `https://t.me/${botInfo.username}?startgroup=true`);
    
    await ctx.reply("✨ Bot ကို အခြား Group (သို့) Channel များသို့ ထည့်သွင်းလိုပါက အောက်ပါခလုတ်ကို နှိပ်ပါရှင့် 👇", {
      reply_markup: inlineKeyboard
    });
  }
});

// ============================================================
// 📢 Channel Post တွင် အီမိုဂျီ (Reaction) အလိုအလျောက် ပေးခြင်း
// ============================================================
bot.on('channel_post', async (ctx) => {
  try {
    const emojis = ['👍', '❤️', '🔥', '🥰', '👏', '😁', '🤩', '🎉', '🙏'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    setTimeout(async () => {
      try {
        await ctx.react(randomEmoji);
      } catch (err) {}
    }, 1000);
  } catch (error) {
    console.error('Channel Post Reaction Error:', error.message);
  }
});

// ============================================================
// 📢 /channelpost (Channel Admin ဖြစ်လျှင် Reply ထောက်၍ Channel သို့ ပို့ရန်)
// ============================================================
bot.command('channelpost', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) {
    const sent = await ctx.reply('⛔ ဤခိုင်းချက်ကို Owner သာ အသုံးပြုခွင့်ရှိပါသည်။', { reply_parameters: { message_id: ctx.message.message_id } });
    return global.autoDeleteMessage(ctx, sent.message_id);
  }

  const repliedMsg = ctx.message.reply_to_message;
  if (!repliedMsg) {
    const sent = await ctx.reply('⚠️ ကျေးဇူးပြု၍ ပို့လိုသော စာ/ပုံ/ဗီဒီယိုကို Reply ထောက်ပြီး /channelpost @channelname ဟု ရိုက်ပါရှင်။', { reply_parameters: { message_id: ctx.message.message_id } });
    return global.autoDeleteMessage(ctx, sent.message_id);
  }

  const args = ctx.message.text.split(' ');
  const channelTarget = args[1];

  if (!channelTarget) {
    const sent = await ctx.reply('⚠️ Channel Username သို့မဟုတ် Link ထည့်ပေးပါ။ (ဥပမာ: /channelpost @mychannel သို့မဟုတ် https://t.me/mychannel)', { reply_parameters: { message_id: ctx.message.message_id } });
    return global.autoDeleteMessage(ctx, sent.message_id);
  }

  try {
    let targetChat = channelTarget;
    if (channelTarget.startsWith('https://t.me/')) {
      targetChat = '@' + channelTarget.replace('https://t.me/', '').trim();
    }

    await ctx.api.copyMessage(targetChat, ctx.chat.id, repliedMsg.message_id);
    
    const sent = await ctx.reply(`✅ Channel (${targetChat}) သို့ အောင်မြင်စွာ တင်ပြီးပါပြီရှင့်။`, { reply_parameters: { message_id: ctx.message.message_id } });
    global.autoDeleteMessage(ctx, sent.message_id);
  } catch (err) {
    console.error('Channel Post Error:', err.message);
    const sent = await ctx.reply(`❌ ပို့၍မရပါ။ Bot သည် ထို Channel တွင် Admin ဖြစ်ရန်နှင့် မှန်ကန်သော Channel Username ဖြစ်ရန် လိုအပ်ပါသည်။`, { reply_parameters: { message_id: ctx.message.message_id } });
    global.autoDeleteMessage(ctx, sent.message_id);
  }
});

// ============================================================
// ⏰ ရက်စွဲ၊ AM/PM အတိအကျဖြင့် Channel သို့ အလိုအလျောက် ပို့မည့်စနစ် (/timech & /dtimech)
// ============================================================
bot.command('timech', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) {
    const sent = await ctx.reply('⛔ Owner သာ အသုံးပြုခွင့်ရှိပါသည်။', { reply_parameters: { message_id: ctx.message.message_id } });
    return global.autoDeleteMessage(ctx, sent.message_id);
  }

  const repliedMsg = ctx.message.reply_to_message;
  if (!repliedMsg) {
    const sent = await ctx.reply('⚠️ ပို့လိုသောစာကို Reply ထောက်ပြီး /timech 2026-08-30 02:30 PM @channelname ဟု ရိုက်ပါရှင်။', { reply_parameters: { message_id: ctx.message.message_id } });
    return global.autoDeleteMessage(ctx, sent.message_id);
  }

  const textArgs = ctx.message.text.replace('/timech', '').trim();
  // ဥပမာ: 2026-08-30 02:30 PM @mychannel
  const parts = textArgs.split(' ');
  const dateStr = parts[0]; // 2026-08-30
  const timeStr = parts[1]; // 02:30
  const meridiem = parts[2] ? parts[2].toUpperCase() : ''; // PM
  const channelName = parts[3]; // @mychannel

  if (!dateStr || !timeStr || !meridiem || !channelName) {
    const sent = await ctx.reply('⚠️ ပုံစံမမှန်ပါ။ (ဥပမာ: /timech 2026-08-30 02:30 PM @mychannel)', { reply_parameters: { message_id: ctx.message.message_id } });
    return global.autoDeleteMessage(ctx, sent.message_id);
  }

  const fullDateTimeStr = `${dateStr} ${timeStr} ${meridiem}`; // "2026-08-30 02:30 PM"
  const targetDate = new Date(fullDateTimeStr);

  if (isNaN(targetDate.getTime())) {
    const sent = await ctx.reply('❌ ထည့်သွင်းထားသော ရက်စွဲ (သို့) အချိန် ပုံစံ မှားယွင်းနေပါသည်ရှင့်။', { reply_parameters: { message_id: ctx.message.message_id } });
    return global.autoDeleteMessage(ctx, sent.message_id);
  }

  await BotSetting.findOneAndUpdate(
    { chatId: OWNER_ID }, 
    { 
      scheduledFullDateTime: targetDate, 
      scheduledChannel: channelName, 
      scheduledMessageId: repliedMsg.message_id,
      scheduledFromChatId: ctx.chat.id 
    }, 
    { upsert: true, new: true }
  );

  const sent = await ctx.reply(`⏰ အောင်မြင်စွာ သတ်မှတ်ပြီးပါပြီရှင့်။\n📅 ရက်စွဲနှင့်အချိန်: ${fullDateTimeStr}\n📢 Channel: ${channelName}`, { reply_parameters: { message_id: ctx.message.message_id } });
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('dtimech', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) {
    const sent = await ctx.reply('⛔ Owner သာ အသုံးပြုခွင့်ရှိပါသည်။', { reply_parameters: { message_id: ctx.message.message_id } });
    return global.autoDeleteMessage(ctx, sent.message_id);
  }

  await BotSetting.findOneAndUpdate(
    { chatId: OWNER_ID }, 
    { $unset: { scheduledFullDateTime: "", scheduledChannel: "", scheduledMessageId: "", scheduledFromChatId: "" } }
  );

  const sent = await ctx.reply('🗑️ Channel အတွက် မှတ်ထားသော အချိန်သတ်မှတ်ချက်များကို ဖျက်လိုက်ပါပြီရှင့်။', { reply_parameters: { message_id: ctx.message.message_id } });
  global.autoDeleteMessage(ctx, sent.message_id);
});

// ရက်စွဲနှင့်အချိန် အတိအကျ စစ်ဆေးပေးမည့် Interval (တစ်မိနစ်တစ်ကြိမ်)
setInterval(async () => {
  try {
    const now = new Date();
    const settings = await BotSetting.find({ scheduledFullDateTime: { $exists: true, $ne: null } });
    
    for (const setting of settings) {
      if (setting.scheduledFullDateTime && now >= new Date(setting.scheduledFullDateTime)) {
        try {
          await bot.api.copyMessage(setting.scheduledChannel, setting.scheduledFromChatId || OWNER_ID, setting.scheduledMessageId);
          console.log(`[Scheduled DateTime Post]: Successfully sent to ${setting.scheduledChannel}`);
          
          // ပို့ပြီးပါက ထပ်မံမပို့မိစေရန် Schedule ကို ရှင်းလင်းမည်
          await BotSetting.findOneAndUpdate(
            { chatId: OWNER_ID }, 
            { $unset: { scheduledFullDateTime: "", scheduledChannel: "", scheduledMessageId: "", scheduledFromChatId: "" } }
          );
        } catch (err) {
          console.error(`[Scheduled DateTime Post Error]:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('Interval DateTime Check Error:', err);
  }
}, 60 * 1000);

// ============================================================
// AI Commands (/aiopen, /aioff, /ai)
// ============================================================
bot.command('aiopen', async (ctx) => {
  const settings = getAISettings(ctx.from.id);
  settings.isOpen = true;
  const sent = await ctx.reply("🟢 AI စနစ်ကို ဖွင့်လိုက်ပါပြီရှင်။", { reply_markup: getPersistentKeyboard() });
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('aioff', async (ctx) => {
  const settings = getAISettings(ctx.from.id);
  settings.isOpen = false;
  const sent = await ctx.reply("🔴 AI စနစ်ကို ပိတ်လိုက်ပါပြီရှင်။", { reply_markup: getPersistentKeyboard() });
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('ai', async (ctx) => {
  const settings = getAISettings(ctx.from.id);
  settings.isOpen = true; 
  const handled = await handleAIResponse(ctx, ctx.message.text, { reply_parameters: { message_id: ctx.message.message_id } }, OWNER_ID);
  if (!handled) {
    const sent = await ctx.reply("🤖 AI စနစ် အဆင်သင့် ဖြစ်ပါပြီရှင်။", { reply_markup: getPersistentKeyboard() });
    global.autoDeleteMessage(ctx, sent.message_id);
  }
});

// ============================================================
// 🟢 Unified Message Handler
// ============================================================
bot.on('message', async (ctx, next) => {
  if (ctx.message.new_chat_members || ctx.message.left_chat_member) {
    return next();
  }

  // "💌 ဖီးလ်စာတို" ခလုတ်နှိပ်ခြင်းကို ကျော်သွားရန်
  if (ctx.message.text === "💌 ဖီးလ်စာတို") return;

  try {
    const botSetting = await BotSetting.findOne({ chatId: ctx.chat.id });
    if (botSetting && botSetting.rtime) {
      const msgText = ctx.message.text || '';
      if (!msgText.startsWith('/')) {
        return; 
      }
    }

    const isOwner = ctx.from && ctx.from.id === OWNER_ID;
    const isPrivate = ctx.chat.type === 'private';
    const msg = ctx.message;
    const replyOptions = { reply_parameters: { message_id: msg.message_id } };

    const emojis = ['👍', '❤️', '🔥', '🥰', '👏', '😁'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    try {
      await ctx.react(randomEmoji);
    } catch (e) {}

    // 1. Owner Media Mode
    if (isOwner && isPrivate && isOwnerMediaMode) {
      let type = null;
      let fileId = null;

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
        await TextReply.create({ text: msg.text, fromUserId: ctx.from.id, chatId: ctx.chat.id });
      }

      if (!isCommand) {
        try {
          const aiHandled = await handleAIResponse(ctx, msg.text, replyOptions, OWNER_ID);
          if (aiHandled) return; 
        } catch (aiErr) {}

        if (!isTearOpen) {
          uniqueUsersCount.add(ctx.from.id);
          if (uniqueUsersCount.size < 3) return; 
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

    if (requestedType) {
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
  allowed_updates: ["message", "callback_query", "chat_member", "channel_post"]
});

console.log('🤖 Bot is running smoothly with Persistent "ဖီးလ်စာတို" Button & Date/Time Scheduling!');
