const axios = require('axios');

// TikTok Link Regex
const tiktokRegex = /(https?:\/\/)?(www\.|v|vm|vt\.)?tiktok\.com\/[^\s]+/;

// Music URL များကို ခဏတာ သိမ်းဆည်းရန် Cache
const musicCache = new Map();

async function fetchTikTokData(url) {
  try {
    const response = await axios.post('https://www.tikwm.com/api/', null, {
      params: { url: url }
    });

    if (response.data && response.data.code === 0) {
      return response.data.data;
    }
    return null;
  } catch (error) {
    console.error("TikTok Fetch Error:", error.message);
    return null;
  }
}

function setupTikTokModule(bot) {

  // ၁။ မက်ဆေ့ခ်ျများကို စစ်ဆေးသည့် စနစ်
  bot.on('message:text', async (ctx, next) => {
    const text = ctx.message.text.trim();
    const isPrivate = ctx.chat.type === 'private';
    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';

    let videoUrl = null;

    // A. Bot Chat (PM) တွင် တိုက်ရိုက် Link ပို့ပါက
    if (isPrivate && tiktokRegex.test(text)) {
      const match = text.match(tiktokRegex);
      videoUrl = match[0];
    } 
    // B. Group ထဲတွင် /tiktok <link> သို့မဟုတ် /tt <link> ဟု ရိုက်ပါက
    else if (isGroup && (text.startsWith('/tiktok') || text.startsWith('/tt'))) {
      const match = text.match(tiktokRegex);
      if (match) {
        videoUrl = match[0];
      } else {
        return ctx.reply("⚠️ ကျေးဇူးပြု၍ Command နောက်တွင် TikTok Link ထည့်ပေးပါ။\nဥပမာ - <code>/tiktok https://vt.tiktok.com/...</code>", { parse_mode: 'HTML' });
      }
    }

    // TikTok Link စစ်ဆေးတွေ့ရှိမှသာ ဒေါင်းလုဒ်ဆွဲမည်
    if (videoUrl) {
      const loadingMsg = await ctx.reply("⏳ TikTok Video ဒေါင်းလုဒ်ဆွဲနေပါသည်... ခေတ္တစောင့်ပေးပါ။");

      try {
        const data = await fetchTikTokData(videoUrl);

        if (!data) {
          await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);
          return ctx.reply("❌ TikTok ဒေတာများကို ဆွဲယူ၍ မရရှိပါ သို့မဟုတ် Link မှားယွင်းနေပါသည်။");
        }

        const title = data.title || "TikTok Video";
        const playUrl = data.play; // Logo မပါသော Video
        const musicUrl = data.music; // Audio
        const author = data.author?.nickname || "TikTok User";

        const caption = `🎵 <b>${title}</b>\n\n👤 <b>Creator:</b> ${author}`;

        // Inline Buttons ခလုတ်များ
        const keyboard = {
          inline_keyboard: [
            [
              { text: "🎵 Music 🎵", callback_data: `tt_music_${data.id}` },
              { text: "❌ Dtiktok ❌", callback_data: "tt_delete_msg" }
            ]
          ]
        };

        // Cache ထဲတွင် Music URL ကို သိမ်းဆည်းထားမည်
        if (musicUrl) {
          musicCache.set(data.id, { musicUrl, title, author });
        }

        // Video စတင်ပို့ပေးမည်
        await ctx.replyWithVideo(playUrl, {
          caption: caption,
          parse_mode: 'HTML',
          reply_markup: keyboard
        });

        // Loading စာသားကို ပြန်ဖျက်မည်
        await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);

      } catch (err) {
        console.error("TikTok Download Error:", err.message);
        try {
          await ctx.api.deleteMessage(ctx.chat.id, loadingMsg.message_id);
        } catch (e) {}
        await ctx.reply("❌ ဗီဒီယို ဒေါင်းလုဒ်ဆွဲစဉ် အမှားအယွင်း ဖြစ်ပေါ်ခဲ့ပါသည်။");
      }

      return; // TikTok Command / Link ဖြစ်ပါက ဒီနေရာတွင် ရပ်မည်
    }

    return next();
  });

  // ၂။ Inline Buttons (Music & Delete) နှိပ်သည့်အခါ လုပ်ဆောင်ချက်များ
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;

    // 🎵 Music ခလုတ်နှိပ်ပါက Video ဖျက်ပြီး Audio သို့ ပြောင်းပေးမည်
    if (data.startsWith('tt_music_')) {
      const mediaId = data.replace('tt_music_', '');
      const cached = musicCache.get(mediaId);

      await ctx.answerCallbackQuery({ text: "🎵 Music အဖြစ် ပြောင်းလဲနေပါသည်..." });

      if (cached && cached.musicUrl) {
        try {
          // မူရင်း Video မက်ဆေ့ခ်ျကို ဖျက်မည်
          await ctx.deleteMessage();

          // Music ကို ထပ်မံ ပို့ပေးမည် (❌ Dtiktok ❌ ခလုတ်ပါဝင်မည်)
          await ctx.replyWithAudio(cached.musicUrl, {
            title: cached.title,
            performer: cached.author,
            reply_markup: {
              inline_keyboard: [
                [{ text: "❌ Dtiktok ❌", callback_data: "tt_delete_msg" }]
              ]
            }
          });
        } catch (e) {
          console.error("Music Switch Error:", e.message);
        }
      } else {
        await ctx.answerCallbackQuery({ text: "⚠️ Music ဖိုင် သက်တမ်းကုန်သွားပါပြီ။ ပြန်လည် ဒေါင်းလုဒ်ဆွဲပါ။", show_alert: true });
      }
      return;
    }

    // ❌ Dtiktok ❌ ခလုတ်နှိပ်ပါက မက်ဆေ့ခ်ျတစ်ခုလုံး ဖျက်မည်
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
