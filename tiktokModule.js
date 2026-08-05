const mongoose = require('mongoose');

// ၁။ MongoDB Connection
const tiktokMongoUri = process.env.TIKTOK_MONGO_URI;
let tiktokConn = null;
let TikTokLog = null;

if (tiktokMongoUri) {
  tiktokConn = mongoose.createConnection(tiktokMongoUri);
  
  const tiktokLogSchema = new mongoose.Schema({
    userId: { type: Number, required: true },
    username: { type: String, default: 'None' },
    fullName: { type: String, required: true },
    chatType: { type: String, required: true },
    chatTitle: { type: String, default: 'Private Chat' },
    videoUrl: { type: String, required: true },
    videoTitle: { type: String, default: 'Unknown Title' },
    downloadedAt: { type: Date, default: Date.now }
  });

  TikTokLog = tiktokConn.model('TikTokLog', tiktokLogSchema);
  console.log("✅ TikTok Mongo Database Connected Successfully!");
}

const tiktokRegex = /(https?:\/\/)?(www\.|v|vm|vt\.)?tiktok\.com\/[^\s]+/;
const musicCache = new Map();

// API မှ Video/Audio Data များ ဆွဲယူခြင်း
async function fetchTikTokData(url) {
  try {
    const apiRes = await fetch(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`);
    const resData = await apiRes.json();

    if (resData && resData.video) {
      return {
        id: resData.id || Date.now().toString(),
        title: resData.title || "TikTok Video",
        play: resData.video.noWatermark || resData.video.watermark,
        music: resData.music?.play_url || resData.music?.url,
        author: resData.author?.name || "TikTok User"
      };
    }

    // Backup API (TikWM)
    const backupRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
    const backupData = await backupRes.json();
    if (backupData && backupData.code === 0) {
      return {
        id: backupData.data.id,
        title: backupData.data.title || "TikTok Video",
        play: backupData.data.play,
        music: backupData.data.music,
        author: backupData.data.author?.nickname || "TikTok User"
      };
    }

    return null;
  } catch (error) {
    console.error("TikTok Fetch Error:", error.message);
    return null;
  }
}

// Logs ပြပေးသည့် စနစ်
async function sendLogsPage(ctx, page = 1) {
  if (!TikTokLog) return ctx.reply("❌ Database ချိတ်ဆက်မထားပါ။");

  const limit = 5;
  const skip = (page - 1) * limit;

  const totalLogs = await TikTokLog.countDocuments();
  const totalPages = Math.ceil(totalLogs / limit) || 1;
  const logs = await TikTokLog.find().sort({ downloadedAt: -1 }).skip(skip).limit(limit);

  if (logs.length === 0) {
    return ctx.reply("📂 ယခုအချိန်အထိ TikTok Download Log မရှိသေးပါ။");
  }

  let text = `📊 <b>TikTok Download Logs (Page ${page}/${totalPages})</b>\n\n`;

  logs.forEach((log, i) => {
    const timeStr = new Date(log.downloadedAt).toLocaleString('en-US', { timeZone: 'Asia/Yangon' });
    text += `<b>${skip + i + 1}. ${log.fullName}</b> (@${log.username})\n`;
    text += `🆔 <b>User ID:</b> <code>${log.userId}</code>\n`;
    text += `📍 <b>Place:</b> ${log.chatType} (${log.chatTitle})\n`;
    text += `🎵 <b>Title:</b> ${log.videoTitle}\n`;
    text += `🔗 <b>Link:</b> <a href="${log.videoUrl}">Click to View</a>\n`;
    text += `⏰ <b>Time:</b> ${timeStr}\n`;
    text += `------------------------------------\n`;
  });

  const buttons = [];
  if (page > 1) buttons.push({ text: "⬅️ Prev", callback_data: `ttlog_page_${page - 1}` });
  if (page < totalPages) buttons.push({ text: "Next ➡️", callback_data: `ttlog_page_${page + 1}` });
  buttons.push({ text: "❌ Close", callback_data: "tt_delete_msg" });

  const keyboard = { inline_keyboard: [buttons] };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard, disable_web_page_preview: true });
  } else {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard, disable_web_page_preview: true });
  }
}

function setupTikTokModule(bot, OWNER_ID) {

  // Owner command
  bot.command('ttlogs', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) {
      return ctx.reply("❌ ဤ Command ကို Bot Owner တစ်ဦးတည်းသာ အသုံးပြုနိုင်ပါသည်။");
    }
    await sendLogsPage(ctx, 1);
  });

  // Message Handler
  bot.on('message:text', async (ctx, next) => {
    const text = ctx.message.text.trim();
    const isPrivate = ctx.chat.type === 'private';
    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';

    let videoUrl = null;

    if (isPrivate && tiktokRegex.test(text)) {
      videoUrl = text.match(tiktokRegex)[0];
    } else if (isGroup && (text.startsWith('/tiktok') || text.startsWith('/tt'))) {
      const match = text.match(tiktokRegex);
      if (match) videoUrl = match[0];
      else return ctx.reply("⚠️ TikTok Link ထည့်ပေးပါ။ ဥပမာ - <code>/tiktok https://vt.tiktok.com/...</code>", { parse_mode: 'HTML' });
    }

    if (videoUrl) {
      const loadingMsg = await ctx.reply("⏳ TikTok Video ဒေါင်းလုဒ်ဆွဲနေပါသည်...");

      try {
        const data = await fetchTikTokData(videoUrl);

        if (!data || !data.play) {
          await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);
          return ctx.reply("❌ TikTok Video ဒေတာများ ဆွဲယူ၍ မရပါ။ လင့်ခ် မှားယွင်းနေခြင်း သို့မဟုတ် Private Video ဖြစ်နိုင်ပါသည်။");
        }

        // MongoDB Log သိမ်းခြင်း
        if (TikTokLog) {
          await TikTokLog.create({
            userId: ctx.from.id,
            username: ctx.from.username || 'None',
            fullName: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim(),
            chatType: ctx.chat.type,
            chatTitle: ctx.chat.title || 'Private Chat',
            videoUrl: videoUrl,
            videoTitle: data.title
          });
        }

        const caption = `🎵 <b>${data.title}</b>\n\n👤 <b>Creator:</b> ${data.author}`;
        const keyboard = {
          inline_keyboard: [
            [
              { text: "🎵 Music 🎵", callback_data: `tt_music_${data.id}` },
              { text: "❌ Dtiktok ❌", callback_data: "tt_delete_msg" }
            ]
          ]
        };

        if (data.music) {
          musicCache.set(data.id, { musicUrl: data.music, title: data.title, author: data.author });
        }

        // Video ကို Telegram ဆီ တိုက်ရိုက် ပို့ပေးခြင်း
        await ctx.replyWithVideo(data.play, {
          caption: caption,
          parse_mode: 'HTML',
          reply_markup: keyboard
        });

        await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);

      } catch (err) {
        console.error("TikTok Download Error:", err.message);
        try { await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id); } catch (e) {}
        await ctx.reply("❌ ဗီဒီယို ပို့ပေးစဉ် အမှားအယွင်း ဖြစ်ပေါ်ခဲ့ပါသည်။ (Video ဖိုင် အရမ်းကြီးနေခြင်း သို့မဟုတ် Server ခေတ္တကျနေခြင်း ဖြစ်နိုင်ပါသည်။)");
      }
      return;
    }

    return next();
  });

  // Callbacks
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data.startsWith('ttlog_page_')) {
      if (ctx.from.id !== OWNER_ID) {
        return ctx.answerCallbackQuery({ text: "❌ Owner သာ ကြည့်ခွင့်ရှိပါသည်။", show_alert: true });
      }
      const page = parseInt(data.replace('ttlog_page_', ''));
      await sendLogsPage(ctx, page);
      return ctx.answerCallbackQuery();
    }

    if (data.startsWith('tt_music_')) {
      const mediaId = data.replace('tt_music_', '');
      const cached = musicCache.get(mediaId);

      await ctx.answerCallbackQuery({ text: "🎵 Music ပြောင်းလဲနေပါသည်..." });

      if (cached && cached.musicUrl) {
        try {
          await ctx.deleteMessage();
          await ctx.replyWithAudio(cached.musicUrl, {
            title: cached.title,
            performer: cached.author,
            reply_markup: {
              inline_keyboard: [[{ text: "❌ Dtiktok ❌", callback_data: "tt_delete_msg" }]]
            }
          });
        } catch (e) {
          console.error("Music Switch Error:", e.message);
        }
      } else {
        await ctx.answerCallbackQuery({ text: "⚠️ Music ဖိုင် သက်တမ်းကုန်သွားပါပြီ။", show_alert: true });
      }
      return;
    }

    if (data === "tt_delete_msg") {
      try {
        await ctx.deleteMessage();
        await ctx.answerCallbackQuery({ text: "ဖျက်ပြီးပါပြီ။" });
      } catch (e) {
        await ctx.answerCallbackQuery({ text: "မက်ဆေ့ခ်ျ ဖျက်၍ မရပါ။", show_alert: true });
      }
      return;
    }
  });
}

module.exports = setupTikTokModule;
