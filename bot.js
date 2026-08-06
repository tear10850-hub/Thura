const express = require('express');
const { Bot } = require('grammy');
const mongoose = require('mongoose');
const { Media } = require('./models');

const setupWelcomeModule = require('./welcomeModule');
const setupLeaveModule = require('./leaveModule');
const setupAdminToolsModule = require('./adminToolsModule');
const setupAutoMuteModule = require('./autoMuteModule');
const setupCallModule = require('./setupCallModule');

// Environment Variables မှ တန်ဖိုးများ ရယူခြင်း
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const OWNER_ID = Number(process.env.OWNER_ID);
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;

function registerMainBotFunctions(botInstance) {
  setupWelcomeModule(botInstance);
  setupLeaveModule(botInstance);
  setupAdminToolsModule(botInstance);
  setupAutoMuteModule(botInstance);
  setupCallModule(botInstance, OWNER_ID);
}

if (!BOT_TOKEN || !MONGO_URI || !OWNER_ID) {
  console.error("FATAL ERROR: BOT_TOKEN, MONGO_URI, or OWNER_ID is not set in Environment Variables!");
  process.exit(1);
}

// ----------------------------------------------------
// ၁. Render Web Service & Uptime Keep-Alive (အိမ်မပျော်အောင် နိုးသည့်စနစ်)
// ----------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.status(200).send('Telegram Bot is alive and running smoothly!');
});

app.listen(PORT, () => {
  console.log(`Web Server is running on port ${PORT}`);
});

// Render Free Instance Sleep မဖြစ်စေရန် ၅ မိနစ်တစ်ကြိမ် Self-Ping လုပ်ပေးခြင်း
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
// ၃. Telegram Bot Setup နှင့် Global Error Handling
// ----------------------------------------------------
const bot = new Bot(BOT_TOKEN);
registerMainBotFunctions(bot);

bot.catch((err) => {
  console.error(`Error while handling update ${err.ctx.update.update_id}:`);
  console.error(err.error);
});

const urlRegex = /(https?:\/\/[^\s]+)/g;

// ----------------------------------------------------
// ၄. Main Bot သီးသန့် Auto Reaction (👍, ❤️, 🔥, 🎉, 🥰, 👏, 💯, ⚡)
// ----------------------------------------------------
const MAIN_BOT_REACTIONS = ["👍", "❤️", "🔥", "🎉", "🥰", "👏", "💯", "⚡"];

bot.on('message', async (ctx, next) => {
  try {
    const randomEmoji = MAIN_BOT_REACTIONS[Math.floor(Math.random() * MAIN_BOT_REACTIONS.length)];
    await ctx.react(randomEmoji);
  } catch (err) {}
  await next();
});

// ----------------------------------------------------
// ၅. Owner မီဒီယာများ သိမ်းဆည်းခြင်း Middleware
// ----------------------------------------------------
bot.on('message', async (ctx, next) => {
  try {
    const isOwner = ctx.from && ctx.from.id === OWNER_ID;
    const msg = ctx.message;

    if (isOwner) {
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

  await next();
});

// ----------------------------------------------------
// ၆. မန်ဘာများ၏ စာများ (Command မဟုတ်ပါက မမှတ်ပါ၊ ပြန်မပြောပါ)
// ----------------------------------------------------
bot.on('message', async (ctx, next) => {
  try {
    const msg = ctx.message;

    // Command မဟုတ်သော စာများကို မမှတ်ပါ၊ ပြန်မပြောပါ
    if (msg.text && !msg.text.startsWith('/')) {
      return;
    }

    // မီဒီယာများ ပို့လာပါက Random ပြန်ပို့ပေးမည်
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

  await next();
});

bot.start({ drop_pending_updates: true });
