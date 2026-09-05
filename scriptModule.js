const { Bot } = require('grammy');
const { GoogleGenAI } = require('@google/genai');
const { Media } = require('./models');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const activeClones = new Map();
const userSetupState = new Map();

function setupScriptModule(mainBot, OWNER_ID) {

  // ၁။ Owner မှ ဗီဒီယိုနှင့် စာသား/လင့်ခ်များကို အမျိုးအစားအလိုက် သိမ်းဆည်းရန်
  mainBot.command('addvideo', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) {
      const sent = await ctx.reply('⛔ ဤခိုင်းချက်ကို Owner သာ အသုံးပြုခွင့်ရှိပါသည်။');
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
      return;
    }

    const repliedMsg = ctx.message.reply_to_message;
    if (!repliedMsg || !repliedMsg.video) {
      const sent = await ctx.reply('⚠️ ကျေးဇူးပြု၍ သိမ်းလိုသော ဗီဒီယိုကို Reply ထောက်ပြီး `/addvideo [category]` ဟု ရိုက်ပါရှင့်။\n(ဥပမာ: `/addvideo sad`, `/addvideo happy`, `/addvideo love`, `/addvideo depressed`)');
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
      return;
    }

    const args = ctx.message.text.replace('/addvideo', '').trim().toLowerCase();
    const category = args || 'other';
    const videoFileId = repliedMsg.video.file_id;
    const videoCaption = repliedMsg.caption || '';

    try {
      await Media.create({
        type: 'video',
        category: category,
        fileId: videoFileId,
        caption: videoCaption
      });

      const sent = await ctx.reply(`✅ ဗီဒီယိုနှင့် စာသား/လင့်ခ်များကို "${category}" အမျိုးအစားအလိုက် MongoDB ထဲသို့ အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီရှင့်။`);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    } catch (err) {
      console.error("Add video error:", err.message);
      const sent = await ctx.reply(`❌ ဗီဒီယိုသိမ်းဆည်းရာတွင် အမှားအယွင်းရှိပါသည်: ${err.message}`);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    }
  });

  // ၂။ Main Bot မှ ကြော်ငြာများကို Clone Bot များနှင့် User များဆီသို့ ပို့ပေးခြင်း
  mainBot.command('broadcastclones', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) {
      const sent = await ctx.reply('⛔ ဤခိုင်းချက်ကို Owner သာ အသုံးပြုခွင့်ရှိပါသည်။');
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
      return;
    }

    if (activeClones.size === 0) {
      const sent = await ctx.reply('⚠️ လောလောဆယ် ချိတ်ဆက်ထားသော Clone Bot လုံးဝ မရှိသေးပါ။');
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
      return;
    }

    const repliedMsg = ctx.message.reply_to_message;
    if (!repliedMsg) {
      const sent = await ctx.reply('⚠️ ကျေးဇူးပြု၍ Clone Bot များဆီသို့ ပို့လိုသော ကြော်ငြာကို Reply ထောက်ပြီးမှ `/broadcastclones` ဟု ရိုက်ပါရှင့်။');
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
      return;
    }

    const adText = repliedMsg.text || repliedMsg.caption || '';
    const adPhoto = repliedMsg.photo ? repliedMsg.photo[repliedMsg.photo.length - 1].file_id : null;
    const adVideo = repliedMsg.video ? repliedMsg.video.file_id : null;

    let totalSuccess = 0;

    for (let [token, cloneData] of activeClones.entries()) {
      const cloneUsers = cloneData.cloneUsers || new Set();
      const cloneApi = cloneData.bot.api;

      for (const chatId of cloneUsers) {
        try {
          if (adPhoto) {
            await cloneApi.sendPhoto(chatId, adPhoto, { caption: adText });
          } else if (adVideo) {
            await cloneApi.sendVideo(chatId, adVideo, { caption: adText });
          } else if (adText) {
            await cloneApi.sendMessage(chatId, adText);
          }
          totalSuccess++;
        } catch (e) {}
      }
    }

    const sent = await ctx.reply(`✅ Broadcast အောင်မြင်ပါသည်! စုစုပေါင်း User (${totalSuccess}) ယောက်ထံသို့ ပေးပို့ပြီးပါပြီ။`);
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
  });

  // ၃။ Clone Bot ချိတ်ဆက်ရန် အသုံးပြုပုံလမ်းညွှန် (`/clonehelp`)
  mainBot.command('clonehelp', async (ctx) => {
    const helpText = `🤖 **Clone Bot အသုံးပြုပုံ အဆင့်ဆင့်လမ်းညွှန်**

၁။ **Bot တစ်ခု ဖန်တီးရန်:** Telegram တွင် @BotFather သို့သွားပြီး \`/newbot\` ဖြင့် Bot အသစ်တစ်ခု တည်ဆောက်ပါ။ ရလာမည့် **Bot Token** ကို ကူးယူပါ။
၂။ **ချိတ်ဆက်ရန် စတင်ခြင်း:** Main Bot တွင် \`/clonebot\` ဟု ရိုက်ထည့်ပါ။
၃။ **Token ပို့ရန်:** BotFather ဆီက ရလာတဲ့ **Bot Token** ကို Bot ထံ ပြန်ပို့ပေးပါ။
၄။ **Username ထည့်ရန်:** တည်ဆောက်ထားသော Bot ၏ ယူဆာနိတ် (ဥပမာ: \`@your_bot\`) ကို ဆက်ထည့်ပါ။
၅။ **ဇာတ်ညွှန်းသတ်မှတ်ရန်:** ဤ Bot က ဘယ်လိုပုံစံ စကားပြောရမလဲဆိုတဲ့ **Character / ဇာတ်ညွှန်း** ကို ပို့ပေးလိုက်ပါ။ 

✨ ဒါဆိုရင် သင့်ရဲ့ ကိုယ်ပိုင် AI Clone Bot လေး အသင့်ဖြစ်ပါပြီ။ User တွေနဲ့ စကားပြောတဲ့အခါ Mood အလိုက် ဗီဒီယိုနဲ့ စာသား/လင့်ခ်တွေ အလိုအလျောက် တွဲပို့ပေးပါလိမ့်မယ်။`;

    const sent = await ctx.reply(helpText, { parse_mode: 'Markdown' });
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
  });

  // ၄။ Clone Bot စတင်ချိတ်ဆက်ရန်
  mainBot.command('clonebot', async (ctx) => {
    userSetupState.set(ctx.from.id, { step: 'WAITING_FOR_TOKEN' });
    const sent = await ctx.reply("🤖 Clone Bot အသစ်စတင်ချိတ်ဆက်ပါမည်။\n\nကျေးဇူးပြု၍ Botfather ထံမှ ရယူလာသော **Bot Token** ကို ပို့ပေးပါရှင့်။\n(အသေးစိတ်ကြည့်ရန်: `/clonehelp` ကိုနှိပ်ပါ)");
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
  });

  // ၅။ ချိတ်ထားသမျှ Bot များကြည့်ရန်
  mainBot.command('myclones', async (ctx) => {
    if (activeClones.size === 0) {
      const sent = await ctx.reply("📂 လောလောဆယ် ချိတ်ဆက်ထားသော Clone Bot လုံးဝ မရှိသေးပါ။");
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
      return;
    }

    let report = "📋 **ချိတ်ဆက်ထားသော Clone Bot များစာရင်း:**\n\n";
    let index = 1;
    for (let [token, data] of activeClones.entries()) {
      report += `${index}. Bot Username: @${data.username}\n   - ဇာတ်ညွှန်း: ${data.script.substring(0, 30)}...\n\n`;
      index++;
    }

    const sent = await ctx.reply(report, { parse_mode: 'Markdown' });
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
  });

  // ၆။ အဆင့်ဆင့် Setup လုပ်ခြင်း (Token စစ်ဆေးခြင်း၊ Username နှင့် ဇာတ်ညွှန်းတောင်းခြင်း)
  mainBot.on('message:text', async (ctx, next) => {
    const userId = ctx.from.id;
    const state = userSetupState.get(userId);

    if (!state || ctx.message.text.startsWith('/')) {
      return next();
    }

    const text = ctx.message.text.trim();

    if (state.step === 'WAITING_FOR_TOKEN') {
      const testBot = new Bot(text);
      try {
        const botInfo = await testBot.api.getMe();
        userSetupState.set(userId, { step: 'WAITING_FOR_USERNAME', token: text, botInfo });
        const sent = await ctx.reply(`✅ Token မှန်ကန်ပါသည်!\n🤖 Bot အမည်: @${botInfo.username}\n\nကျေးဇူးပြု၍ ဤ Bot ၏ **Username (@username)** ကို ဆက်ထည့်ပေးပါရှင့်။`);
        if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
        return;
      } catch (err) {
        userSetupState.delete(userId);
        const sent = await ctx.reply("❌ Bot Token အလုပ်မလုပ်ပါ။ `/clonebot` မှစ၍ အသစ်ပြန်ကြိုးစားပါ။");
        if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
        return;
      }
    }

    if (state.step === 'WAITING_FOR_USERNAME') {
      const username = text.replace('@', '');
      userSetupState.set(userId, { step: 'WAITING_FOR_SCRIPT', token: state.token, username });
      const sent = await ctx.reply(`✨ Username (@${username}) ကို မှတ်သားပြီးပါပြီ။\n\n🎬 နောက်ဆုံးအနေနဲ့ ဤ Bot အတွက် **ဇာတ်ညွှန်း (သို့မဟုတ်) ဝတ္ထု ဇာတ်အိမ် / Character** ကို ပို့ပေးပါ။`);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
      return;
    }

    if (state.step === 'WAITING_FOR_SCRIPT') {
      const customScript = text;
      const { token, username } = state;

      try {
        const cloneBot = new Bot(token);
        const cloneUsers = new Set();

        cloneBot.command('start', async (cloneCtx) => {
          if (cloneCtx.from) cloneUsers.add(cloneCtx.from.id);
          await cloneCtx.reply("✨ မင်္ဂလာပါရှင့်။ ကျွန်တော်/မ တို စကားပြောကြရအောင်လေ။ 🥰");
        });

        // 💬 Gemini 3.6 Flash ဖြင့် စကားပြောဆိုခြင်းနှင့် Mood အလိုက် ဗီဒီယို/စာသား ပို့ခြင်း
        cloneBot.on('message:text', async (cloneCtx, nextStep) => {
          if (cloneCtx.from) cloneUsers.add(cloneCtx.from.id);
          if (cloneCtx.message.text.startsWith('/')) return nextStep();

          const userText = cloneCtx.message.text;
          if (!ai) return;

          try {
            await cloneCtx.replyWithChatAction('typing');
            
            const prompt = `မင်းဟာ Telegram Bot (@${username}) ဖြစ်ပြီး ပေးထားတဲ့ ဇာတ်ညွှန်း/Character အတိုင်း သရုပ်ဆောင်ရမယ်။
အောက်ပါ User ရဲ့ စကားကို ခွဲခြမ်းစိတ်ဖြာပြီး JSON ပုံစံအတိုင်း တုံ့ပြန်ပေးပါ:
1. "reply": ဇာတ်ကောင်စရိုက်အတိုင်း ပြန်မယ့် စာသား (မြန်မာလို)
2. "mood": user ရဲ့ ခံစားချက်အမျိုးအစား (sad, happy, love, depressed, suicidal, other ထဲက တစ်ခုခုကို ရွေးပါ)

🎬 ဇာတ်ညွှန်း / Character:\n${customScript}\n\nUser ပြောတာက: ${userText}

JSON Format သီးသန့်ထုတ်ပေးပါ (ဥပမာ: {"reply": "...", "mood": "sad"})`;

            const response = await ai.models.generateContent({
              model: 'gemini-3.6-flash',
              contents: prompt
            });

            let rawText = "";
            if (response && response.text) {
              rawText = typeof response.text === 'function' ? await response.text() : response.text;
            } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
              rawText = response.candidates[0].content.parts[0].text;
            }

            let aiResponse = { reply: "...", mood: "other" };
            try {
              const cleanedJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
              aiResponse = JSON.parse(cleanedJson);
            } catch (jsonErr) {
              aiResponse.reply = rawText.replace(/[`*]/g, '').trim();
            }

            if (aiResponse.reply) {
              await cloneCtx.reply(aiResponse.reply);
            }

            // 🎥 MongoDB ထဲမှ Mood နှင့် ကိုက်ညီသော ဗီဒီယိုနှင့် Caption/Link များကို ပူးတွဲပို့မည်
            const matchedMood = aiResponse.mood || 'other';
            const videoCount = await Media.countDocuments({ type: 'video', category: matchedMood });
            
            if (videoCount > 0) {
              const randomVideo = await Media.findOne({ type: 'video', category: matchedMood }).skip(Math.floor(Math.random() * videoCount));
              if (randomVideo) {
                await cloneCtx.replyWithVideo(randomVideo.fileId, {
                  caption: randomVideo.caption || ''
                });
              }
            }

          } catch (e) {
            console.error("Clone Bot AI Error:", e.message);
          }
        });

        // 🎨 စတစ်ကာ ပို့လာပါက MongoDB မှ ကျပန်းယူပြရန်
        cloneBot.on('message:sticker', async (cloneCtx) => {
          if (cloneCtx.from) cloneUsers.add(cloneCtx.from.id);
          try {
            const stickerCount = await Media.countDocuments({ type: 'sticker' });
            if (stickerCount > 0) {
              const randomSticker = await Media.findOne({ type: 'sticker' }).skip(Math.floor(Math.random() * stickerCount));
              if (randomSticker) {
                await cloneCtx.replyWithSticker(randomSticker.fileId);
              }
            }
          } catch (err) {
            console.error("Sticker error:", err.message);
          }
        });

        cloneBot.start().catch(err => console.error("Clone bot error:", err.message));

        activeClones.set(token, { username, script: customScript, ownerId: userId, bot: cloneBot, cloneUsers });
        userSetupState.delete(userId);

        const sent = await ctx.reply(`🎉 **အောင်မြင်ပါသည်!**\n\nBot အသစ် (@${username}) ကို ဇာတ်ညွှန်းနှင့်တကွ အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီရှင့်။`);
        if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
        return;

      } catch (err) {
        userSetupState.delete(userId);
        const sent = await ctx.reply(`❌ အမှားအယွင်းရှိပါသည်: ${err.message}`);
        if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
        return;
      }
    }

    return next();
  });
}

module.exports = { setupScriptModule };
