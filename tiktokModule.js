const mongoose = require('mongoose');

// ၁။ MongoDB Connection အသစ် ချိတ်ဆက်ခြင်း
const tiktokMongoUri = process.env.TIKTOK_MONGO_URI;
let tiktokConn = null;
let TikTokLog = null;

if (tiktokMongoUri) {
  tiktokConn = mongoose.createConnection(tiktokMongoUri);
  
  // Database Schema သတ်မှတ်ခြင်း
  const tiktokLogSchema = new mongoose.Schema({
    userId: { type: Number, required: true },
    username: { type: String, default: 'None' },
    fullName: { type: String, required: true },
    chatType: { type: String, required: true }, // 'private' or 'group'
    chatTitle: { type: String, default: 'Private Chat' },
    videoUrl: { type: String, required: true },
    videoTitle: { type: String, default: 'Unknown Title' },
    downloadedAt: { type: Date, default: Date.now }
  });

  TikTokLog = tiktokConn.model('TikTokLog', tiktokLogSchema);
  console.log("✅ TikTok Mongo Database Connected Successfully!");
} else {
  console.error("⚠️ TIKTOK_MONGO_URI မတွေ့ပါသဖြင့် Log မသိမ်းနိုင်ပါ။");
}

const tiktokRegex = /(https?:\/\/)?(www\.|v|vm|vt\.)?tiktok\.com\/[^\s]+/;
const musicCache = new Map();

// TikTok API Fetch Function
async function fetchTikTokData(url) {
  try {
    const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
    const resData = await response.json();
    if (resData && resData.code === 0) return resData.data;
    return null;
  } catch (error) {
    console.error("TikTok Fetch Error:", error.message);
    return null;
  }
}

// Owner စစ်ဆေးပြီး Log ပြပေးသည့် Helper Function
async function sendLogsPage(ctx, page = 1) {
  if (!TikTokLog) return ctx.reply("❌ Database မရှိသေးပါ။");

  const limit = 5; // တစ်မျက်နှာလျှင် ၅ ခုပြမည်
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

  // Pagination Inline Buttons
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

  // ၁။ Owner သာ ကြည့်နိုင်မည့် /ttlogs Command
  bot.command('ttlogs', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) {
      return ctx.reply("❌ ဤ Command ကို Bot Owner တစ်ဦးတည်းသာ အသုံးပြုနိုင်ပါသည်။");
    }
    await sendLogsPage(ctx, 1);
  });

  // ၂။ TikTok Download စနစ်
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

        if (!data) {
          await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);
          return ctx.reply("❌ TikTok ဒေတာများကို ဆွဲယူ၍ မရရှိပါ သို့မဟုတ် Link မှားယွင်းနေပါသည်။");
        }

        const title = data.title || "TikTok Video";
        const playUrl = data.play;
        const musicUrl = data.music;
        const author = data.author?.nickname || "TikTok User";

        // 📝 MongoDB ထဲသို့ အချက်အလက်များ သေချာ မှတ်သားခြင်း
        if (TikTokLog) {
          await TikTokLog.create({
            userId: ctx.from.id,
            username: ctx.from.username || 'None',
            fullName: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim(),
            chatType: ctx.chat.type,
            chatTitle: ctx.chat.title || 'Private Chat',
            videoUrl: videoUrl,
            videoTitle: title
          });
        }

        const caption = `🎵 <b>${title}</b>\n\n👤 <b>Creator:</b> ${author}`;
        const keyboard = {
          inline_keyboard: [
            [
              { text: "🎵 Music 🎵", callback_data: `tt_music_${data.id}` },
              { text: "❌ Dtiktok ❌", callback_data: "tt_delete_msg" }
            ]
          ]
        };

        if (musicUrl) {
          musicCache.set(data.id, { musicUrl, title, author });
        }

        await ctx.replyWithVideo(playUrl, {
          caption: caption,
          parse_mode: 'HTML',
          reply_markup: keyboard
        });

        await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);

      } catch (err) {
        console.error("TikTok Download Error:", err.message);
        try { await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id); } catch (e) {}
        await ctx.reply("❌ ဗီဒီယို ဒေါင်းလုဒ်ဆွဲစဉ် အမှားအယွင်း ဖြစ်ပေါ်ခဲ့ပါသည်။");
      }
      return;
    }

    return next();
  });

  // ၃။ Callbacks (Buttons handling)
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;

    // Logs Page လှည့်ကြည့်သည့် ခလုတ်
    if (data.startsWith('ttlog_page_')) {
      if (ctx.from.id !== OWNER_ID) {
        return ctx.answerCallbackQuery({ text: "❌ Owner သာ ကြည့်ခွင့်ရှိပါသည်။", show_alert: true });
      }
      const page = parseInt(data.replace('ttlog_page_', ''));
      await sendLogsPage(ctx, page);
      return ctx.answerCallbackQuery();
    }

    // Music ပြောင်းသည့် ခလုတ်
    if (data.startsWith('tt_music_')) {
      const mediaId = data.replace('tt_music_', '');
      const cached = musicCache.get(mediaId);

      await ctx.answerCallbackQuery({ text: "🎵 Music အဖြစ် ပြောင်းလဲနေပါသည်..." });

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

    // Delete ခလုတ်
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
