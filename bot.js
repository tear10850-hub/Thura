const express = require('express');
const { Bot } = require('grammy');
const mongoose = require('mongoose');
const { Media, TextReply } = require('./models');

// သီးသန့် ဖိုင်များ (Modules) ကို Import လုပ်ခြင်း
const setupWelcomeModule = require('./welcomeModule');
const setupLeaveModule = require('./leaveModule');
const setupAdminToolsModule = require('./adminToolsModule');
const setupAutoMuteModule = require('./autoMuteModule');
const setupCallModule = require('./setupCallModule');

// သီးသန့် ဖိုင်များ (Modules) ကို Import လုပ်သည့်နေရာတွင် ထည့်ပါ
const setupStartModule = require('./startModule');
const setupHelpModule = require('./helpModule');

// Environment Variables မှ တန်ဖိုးများ ရယူခြင်း
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const OWNER_ID = Number(process.env.OWNER_ID);
const PORT = process.env.PORT || 3000;
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;

if (!BOT_TOKEN || !MONGO_URI || !OWNER_ID) {
  console.error("FATAL ERROR: BOT_TOKEN, MONGO_URI, or OWNER_ID is not set in Environment Variables!");
  process.exit(1);
}

// စကားပြောသည့် အကြိမ်ရေ မှတ်ရန် Counter
let replyCounter = 0;

// ----------------------------------------------------
// ၁. Render Web Service & Uptime Keep-Alive (အိပ်မပျော်အောင် လုပ်ဆောင်ချက်)
// ----------------------------------------------------
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

// ----------------------------------------------------
// ၂. MongoDB Connection တည်ငြိမ်စွာ ချိတ်ဆက်ခြင်း
// ----------------------------------------------------
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

// ----------------------------------------------------
// ၃. Telegram Bot Setup
// ----------------------------------------------------
const bot = new Bot(BOT_TOKEN);

// သီးသန့် Module ဖိုင်များကို Bot ထဲသို့ ချိတ်ဆက် (Setup) လုပ်ခြင်း
setupAdminToolsModule(bot);
setupWelcomeModule(bot);
setupLeaveModule(bot);
setupAutoMuteModule(bot);
setupCallModule(bot, OWNER_ID);

// အခြား Module များ ချိတ်ဆက်ထားသည့်နေရာတွင် ထည့်ပေးပါ
setupStartModule(bot, OWNER_ID);

bot.catch((err) => {
  console.error(`Error while handling update ${err.ctx.update.update_id}:`);
  console.error(err.error);
});

const urlRegex = /(https?:\/\/[^\s]+)/g;

// Database ထဲ မသိမ်းစေချင်သော ရိုင်းစိုင်းစကားလုံးများ စာရင်း
const BAD_WORDS = [
  "စပ့", "စပ", "လီး", "ယီး", "ဖေလို", "ဖေလိုမ", "မသာ", "ထန်မယ်", "လိုးမယ်"
];

function containsBadWord(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return BAD_WORDS.some(word => lowerText.includes(word));
}

// ----------------------------------------------------
// ၄. Owner မီဒီယာများ သိမ်းဆည်းခြင်း Middleware (Bot Chat ထဲမှသာ မှတ်မည်)
// ----------------------------------------------------
bot.on('message', async (ctx, next) => {
  try {
    const isOwner = ctx.from && ctx.from.id === OWNER_ID;
    const isPrivate = ctx.chat.type === 'private';
    const msg = ctx.message;

    // Owner ဖြစ်ပြီး Bot နှင့် Chat (Private) ထဲတွင် ပို့မှသာ Memory/Database ထဲ သိမ်းမည်
    if (isOwner && isPrivate) {
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
        await ctx.reply(`Owner ၏ ${type} ကို စနစ်ထဲသို့ အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။`);
        return;
      }
    }
  } catch (error) {
    console.error('Error in Owner Media Handler:', error);
  }

  // Group ထဲတွင် ဖြစ်ပါက သို့မဟုတ် Owner မဟုတ်ပါက ပုံမှန် မန်ဘာများနည်းတူ ဆက်သွားမည်
  await next();
});

// ----------------------------------------------------
// ၅. မန်ဘာများ၏ Text/Emoji သိမ်းဆည်းခြင်း နှင့် ၈ ခါပြောလျှင် Sticker ၁ ခါ ပို့ခြင်း
// ----------------------------------------------------
bot.on('message', async (ctx) => {
  try {
    const msg = ctx.message;

    // A. စာသား ဖြစ်ပါက
    if (msg.text && !urlRegex.test(msg.text)) {
      const isCommand = msg.text.startsWith('/');
      const isBadWord = containsBadWord(msg.text);

      // Command မဟုတ်ပါက နှင့် ရိုင်းစိုင်းစကားလုံး မပါမှ DB ထဲ သိမ်းမည်
      if (!isCommand && !isBadWord) {
        await TextReply.create({
          text: msg.text,
          fromUserId: ctx.from.id,
          chatId: ctx.chat.id
        });
      }

      // စကားပြန်ပြောခြင်း
      if (!isCommand) {
        const count = await TextReply.countDocuments();
        if (count > 0) {
          await ctx.replyWithChatAction('typing');

          const randomDoc = await TextReply.findOne().skip(Math.floor(Math.random() * count));
          if (randomDoc) {
            await TextReply.updateOne({ _id: randomDoc._id }, { lastUsedAt: new Date() });
            await ctx.reply(randomDoc.text);
            
            // စကားပြန်ပြောသည့် အကြိမ် Count တိုးမည်
            replyCounter++;

            // စကား ၈ ခါ ပြန်ပြောပြီးပါက Sticker တစ်ခု Random ယူပြီး ပို့ပေးမည်
            if (replyCounter >= 8) {
              replyCounter = 0; // Counter ပြန်စမည်

              const stickerCount = await Media.countDocuments({ type: 'sticker' });
              if (stickerCount > 0) {
                const randomSticker = await Media.findOne({ type: 'sticker' }).skip(Math.floor(Math.random() * stickerCount));
                if (randomSticker) {
                  await ctx.replyWithSticker(randomSticker.fileId);
                }
              }
            }
          }
        }
      }
      return;
    }

    // B. မီဒီယာများ ရောက်လာပါက Owner မီဒီယာများထဲမှ Random ပြန်ပို့မည်
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
          if (requestedType === 'photo') {
            await ctx.replyWithChatAction('upload_photo');
            await ctx.replyWithPhoto(randomMedia.fileId);
          } else if (requestedType === 'video') {
            await ctx.replyWithChatAction('upload_video');
            await ctx.replyWithVideo(randomMedia.fileId);
          } else if (requestedType === 'sticker') {
            await ctx.replyWithChatAction('choose_sticker');
            await ctx.replyWithSticker(randomMedia.fileId);
          } else if (requestedType === 'music' || requestedType === 'audio') {
            await ctx.replyWithChatAction('upload_voice');
            await ctx.replyWithAudio(randomMedia.fileId);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in Member Message Handler:', error);
  }
});

// ----------------------------------------------------
// ၆. မသုံးတာ ၁ လကျော်သော စာများ အလိုအလျောက် Clean Up လုပ်ခြင်း
// ----------------------------------------------------
setInterval(async () => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await TextReply.deleteMany({ lastUsedAt: { $lt: thirtyDaysAgo } });
    if (result.deletedCount > 0) {
      console.log(`[Auto Clean]: မသုံးတာ ကြာသည့် စာသား ${result.deletedCount} ခုကို ဖျက်လိုက်ပါပြီ။`);
    }
  } catch (err) {
    console.error('Auto clean error:', err);
  }
}, 24 * 60 * 60 * 1000);

// ----------------------------------------------------
// ၇. Bot စတင်မောင်းနှင်ခြင်း
// ----------------------------------------------------
bot.start({
  drop_pending_updates: true,
  allowed_updates: ["message", "callback_query", "chat_member"]
});
