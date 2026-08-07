const express = require('express');
const { Bot } = require('grammy');
const mongoose = require('mongoose');
const { Media, TextReply } = require('./models');

// သီးသန့် ဖိုင်များ (Modules)
const setupWelcomeModule = require('./welcomeModule');
const setupLeaveModule = require('./leaveModule');
const setupAdminToolsModule = require('./adminToolsModule');
const setupAutoMuteModule = require('./autoMuteModule');
const setupCallModule = require('./setupCallModule');
const setupStartModule = require('./startModule');
const setupHelpModule = require('./helpModule');
const setupPremiumKeyModule = require('./premiumKeyModule');
const setupMediaManagerModule = require('./mediaManagerModule');

// 🟢 User Account နှင့် Media Feed Modules များ
const { setupUserAccount } = require('./userAccount');
const setupMediaFeed = require('./mediaFeed');

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

// Global Auto Delete Function
global.autoDeleteMessage = function(ctx, messageId, delayTime = 3 * 60 * 1000) {
  setTimeout(async () => {
    try {
      await ctx.api.deleteMessage(ctx.chat.id, messageId);
    } catch (err) {
      console.error(`[Auto Delete Error] ID ${messageId}:`, err.message);
    }
  }, delayTime);
};

// 🟢 MODULES များကို ချိတ်ဆက်ခြင်း
setupAutoMuteModule(bot);
setupAdminToolsModule(bot);
setupWelcomeModule(bot);
setupLeaveModule(bot);
setupCallModule(bot, OWNER_ID);
setupStartModule(bot, OWNER_ID);
setupHelpModule(bot, OWNER_ID);
setupPremiumKeyModule(bot);
setupMediaManagerModule(bot, OWNER_ID);

// 🟢 အသစ်ထည့်သွင်းလိုက်သော Modules များ
setupUserAccount(bot, OWNER_ID);
setupMediaFeed(bot);  // ← ဒါက ခလုပ်တွေအတွက်

bot.catch((err) => {
  console.error(`Error while handling update ${err.ctx.update.update_id}:`);
  console.error(err.error);
});

const urlRegex = /(https?:\/\/[^\s]+)/g;

const BAD_WORDS = [
  "စပ့", "စပ", "လီး", "ယီး", "ဖေလို", "ဖေလိုမ", "မသာ", "ထန်မယ်", "လိုးမယ်"
];

function containsBadWord(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return BAD_WORDS.some(word => lowerText.includes(word));
}

// ----------------------------------------------------
// Commands
// ----------------------------------------------------

bot.command('open', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  isOwnerMediaMode = true;
  const sent = await ctx.reply("✅ Owner Media Mode ဖွင့်လိုက်ပါပြီ။", { reply_parameters: { message_id: ctx.message.message_id } });
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('close', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  isOwnerMediaMode = false;
  const sent = await ctx.reply("❌ Owner Media Mode ပိတ်လိုက်ပါပြီ။", { reply_parameters: { message_id: ctx.message.message_id } });
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('Tearopen', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  isTearOpen = true;
  uniqueUsersCount.clear();
  const sent = await ctx.reply("🔓 Tear Open Mode ဖွင့်လိုက်ပါပြီ။ စာများကို ပုံမှန်အတိုင်း Reply ထောက်ပြန်ပေးပါမည်။", { reply_parameters: { message_id: ctx.message.message_id } });
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('Tear', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  isTearOpen = false;
  uniqueUsersCount.clear();
  const sent = await ctx.reply("🔒 Tear Mode ဖွင့်လိုက်ပါပြီ။ စာများကို သိမ်းဆည်းမည်ဖြစ်ပြီး လူ (၃) ယောက် စကားပြောပြီးမှ တုံ့ပြန်ပါမည်။", { reply_parameters: { message_id: ctx.message.message_id } });
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('clearbrain', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  try {
    await TextReply.deleteMany({});
    await Media.deleteMany({});
    const sent = await ctx.reply("🗑️ Bot ၏ မှတ်ဉာဏ်များ အားလုံးကို အောင်မြင်စွာ ဖျက်ထုတ်လိုက်ပါပြီ။");
    global.autoDeleteMessage(ctx, sent.message_id);
  } catch (err) {
    console.error("Clear brain error:", err);
  }
});

bot.command('cleansymbols', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  try {
    const result = await TextReply.deleteMany({
      $or: [
        { text: /^[\/@]/ },
        { text: { $regex: /@/ } }
      ]
    });
    const sent = await ctx.reply(`🧹 Symbol ပါသော စာပေါင်း ${result.deletedCount} ခုကို DB ထဲမှ ဖျက်ထုတ်လိုက်ပါပြီ။`);
    global.autoDeleteMessage(ctx, sent.message_id);
  } catch (err) {
    console.error("Clean symbols error:", err);
  }
});

bot.command('cleanlong', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  try {
    const allReplies = await TextReply.find();
    let deleteIds = [];

    for (const doc of allReplies) {
      const text = doc.text;
      const isTooLong = text.length > 80;
      const isEnglishLong = /[a-zA-Z]{16,}/.test(text);

      if (isTooLong || isEnglishLong) {
        deleteIds.push(doc._id);
      }
    }

    if (deleteIds.length > 0) {
      await TextReply.deleteMany({ _id: { $in: deleteIds } });
      const sent = await ctx.reply(`🧹 စာအရှည်ကြီးများနှင့် အင်္ဂလိပ်စာ ၁၅ လုံးကျော် စာစုစုပေါင်း ${deleteIds.length} ခုကို DB ထဲမှ ရှင်းထုတ်လိုက်ပါပြီ။`);
      global.autoDeleteMessage(ctx, sent.message_id);
    } else {
      const sent = await ctx.reply("🧹 ဖျက်ရန် စာအရှည်ကြီးများ/အင်္ဂလိပ်စာများ မရှိပါ။");
      global.autoDeleteMessage(ctx, sent.message_id);
    }
  } catch (err) {
    console.error("Clean long error:", err);
  }
});

// ----------------------------------------------------
// 🟢 Unified Message Handler (ပြင်ဆင်ထားတယ်)
// ----------------------------------------------------
bot.on('message', async (ctx, next) => {
  // ဒီဟာက ခလုပ်တွေကို မပိတ်မိအောင်
  if (ctx.callbackQuery) {
    return next();
  }

  if (ctx.message.new_chat_members || ctx.message.left_chat_member) {
    return next();
  }

  try {
    const isOwner = ctx.from && ctx.from.id === OWNER_ID;
    const isPrivate = ctx.chat.type === 'private';
    const msg = ctx.message;

    const replyOptions = {
      reply_parameters: { message_id: msg.message_id }
    };

    // 1. Owner Media Mode
    if (isOwner && isPrivate && isOwnerMediaMode) {
      let type = null;
      let fileId = null;

      if (msg.audio || msg.voice) {
        type = msg.audio ? 'music' : 'audio';
        fileId = (msg.audio || msg.voice).file_id;
      } else if (msg.video) {
        type = 'video';
        fileId = msg.video.file_id;
      } else if (msg.photo) {
        type = 'photo';
        fileId = msg.photo[msg.photo.length - 1].file_id;
      } else if (msg.sticker) {
        type = 'sticker';
        fileId = msg.sticker.file_id;
      } else if (msg.text && urlRegex.test(msg.text)) {
        type = 'link';
        fileId = msg.text.match(urlRegex)[0];
      }

      if (type && fileId) {
        await ctx.replyWithChatAction('typing');
        await Media.create({ type, fileId, caption: msg.caption || '' });
        const sent = await ctx.reply(`✅ Owner ၏ ${type} ကို သိမ်းဆည်းပြီးပါပြီ။`, replyOptions);
        global.autoDeleteMessage(ctx, sent.message_id);
        return;
      }
    }

    // 2. Text Replies
    if (msg.text && !urlRegex.test(msg.text)) {
      const isCommand = msg.text.startsWith('/');
      const isBadWord = containsBadWord(msg.text);
      const hasMention = msg.text.includes('@');
      
      const isTooLong = msg.text.length > 80;
      const isEnglishLong = /[a-zA-Z]{16,}/.test(msg.text);

      if (!isCommand && !isBadWord && !hasMention && !isTooLong && !isEnglishLong) {
        await TextReply.create({
          text: msg.text,
          fromUserId: ctx.from.id,
          chatId: ctx.chat.id
        });
      }

      if (!isCommand) {
        if (!isTearOpen) {
          uniqueUsersCount.add(ctx.from.id);
          if (uniqueUsersCount.size < 3) return; 
          uniqueUsersCount.clear();
        }

        const count = await TextReply.countDocuments();
        if (count > 0) {
          await ctx.replyWithChatAction('typing');

          const randomDoc = await TextReply.findOne().skip(Math.floor(Math.random() * count));
          if (randomDoc) {
            await TextReply.updateOne({ _id: randomDoc._id }, { lastUsedAt: new Date() });
            
            const sentMsg = await ctx.reply(randomDoc.text, replyOptions);
            global.autoDeleteMessage(ctx, sentMsg.message_id);
            
            replyCounter++;

            if (replyCounter >= 8) {
              replyCounter = 0;
              const stickerCount = await Media.countDocuments({ type: 'sticker' });
              if (stickerCount > 0) {
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
          if (requestedType === 'photo') {
            await ctx.replyWithChatAction('upload_photo');
            sentMedia = await ctx.replyWithPhoto(randomMedia.fileId, replyOptions);
          } else if (requestedType === 'video') {
            await ctx.replyWithChatAction('upload_video');
            sentMedia = await ctx.replyWithVideo(randomMedia.fileId, replyOptions);
          } else if (requestedType === 'sticker') {
            await ctx.replyWithChatAction('choose_sticker');
            sentMedia = await ctx.replyWithSticker(randomMedia.fileId, replyOptions);
          } else if (requestedType === 'music' || requestedType === 'audio') {
            await ctx.replyWithChatAction('upload_voice');
            sentMedia = await ctx.replyWithAudio(randomMedia.fileId, replyOptions);
          }

          if (sentMedia) {
            global.autoDeleteMessage(ctx, sentMedia.message_id);
          }
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
    const result = await TextReply.deleteMany({ lastUsedAt: { $lt: thirtyDaysAgo } });
    if (result.deletedCount > 0) {
      console.log(`[Auto Clean]: ${result.deletedCount} items deleted.`);
    }
  } catch (err) {
    console.error('Auto clean error:', err);
  }
}, 24 * 60 * 60 * 1000);

// Bot Start
bot.start({
  drop_pending_updates: true,
  allowed_updates: ["message", "callback_query", "chat_member"]
});
