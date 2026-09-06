const { Bot } = require('grammy');
const { GoogleGenAI } = require('@google/genai');
const { Media } = require('./models');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// activeClones structure: token -> { username, script, ownerId, bot, cloneUsers (Set), status: 'active'/'paused' }
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

  // ၁.၁။ သိမ်းဆည်းထားသော ဗီဒီယိုစာရင်းများကို ပြန်ကြည့်ရန်
  mainBot.command('listvideos', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) {
      const sent = await ctx.reply('⛔ ဤခိုင်းချက်ကို Owner သာ အသုံးပြုခွင့်ရှိပါသည်။');
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
      return;
    }

    try {
      const categories = await Media.distinct('category', { type: 'video' });
      if (!categories || categories.length === 0) {
        const sent = await ctx.reply('📭 လောလောဆယ် သိမ်းဆည်းထားသော ဗီဒီယို လုံးဝ မရှိသေးပါ။');
        if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
        return;
      }

      let report = "📹 **သိမ်းဆည်းထားသော ဗီဒီယိုများစာရင်း:**\n\n";
      for (const cat of categories) {
        const count = await Media.countDocuments({ type: 'video', category: cat });
        report += `📂 အမျိုးအစား: \`${cat}\` (${count} ခု)\n`;
      }

      const sent = await ctx.reply(report, { parse_mode: 'Markdown' });
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    } catch (err) {
      console.error("List videos error:", err.message);
      const sent = await ctx.reply(`❌ အမှားရှိပါသည်: ${err.message}`);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    }
  });

  // ၂။ Broadcast ကြော်ငြာများ ပို့ခြင်း (Owner သို့မဟုတ် Bot ပိုင်ရှင်မှ ပို့နိုင်သည်)
  mainBot.command('broadcastclones', async (ctx) => {
    const userId = ctx.from.id;
    const repliedMsg = ctx.message.reply_to_message;

    if (!repliedMsg) {
      const sent = await ctx.reply('⚠️ ကျေးဇူးပြု၍ ပို့လိုသော ကြော်ငြာကို Reply ထောက်ပြီးမှ `/broadcastclones` ဟု ရိုက်ပါရှင့်။');
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
      return;
    }

    // Owner ဖြစ်ပါက Bot အားလုံး၏ User များဆီသို့ ပို့မည်၊ User ဖြစ်ပါက သူဖန်တီးထားသော Bot များဆီသို့သာ ပို့မည်
    let targetClones = [];
    for (let [token, data] of activeClones.entries()) {
      if (userId === OWNER_ID || data.ownerId === userId) {
        targetClones.push(data);
      }
    }

    if (targetClones.length === 0) {
      const sent = await ctx.reply('⚠️ လောလောဆယ် လွှင့်ထုတ်ရန် သင့်ပိုင် Clone Bot များ မရှိသေးပါ။');
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
      return;
    }

    const adText = repliedMsg.text || repliedMsg.caption || '';
    const adPhoto = repliedMsg.photo ? repliedMsg.photo[repliedMsg.photo.length - 1].file_id : null;
    const adVideo = repliedMsg.video ? repliedMsg.video.file_id : null;

    let totalSuccess = 0;

    for (const cloneData of targetClones) {
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

  // ၃။ Clone Bot အသုံးပြုပုံလမ်းညွှန်
  mainBot.command('clonehelp', async (ctx) => {
    const helpText = `🤖 **Clone Bot အသုံးပြုပုံ အဆင့်ဆင့်လမ်းညွှန်**

၁။ **Bot ဖန်တီးရန်:** @BotFather သို့သွားပြီး \`/newbot\` ဖြင့် Bot အသစ်ဆောက်ကာ Token ယူပါ။
၂။ **ချိတ်ဆက်ရန်:** Main Bot တွင် \`/clonebot\` ဟု ရိုက်ပါ။
၃။ **အချက်အလက်ပေးရန်:** Bot Token, Username (@username) နှင့် ဇာတ်ညွှန်း (Character) ကို အစဉ်အတိုင်း ပို့ပေးပါ။
၄။ **စီမံခန့်ခွဲရန်:** မိမိဖန်တီးထားသော Bot များကို \`/myclones\` ဖြင့် ကြည့်ရှုနိုင်ပြီး ပိတ်ခြင်း၊ ပြန်ဖွင့်ခြင်းနှင့် ဖျက်ခြင်းများ လုပ်ဆောင်နိုင်ပါသည်။`;

    const sent = await ctx.reply(helpText, { parse_mode: 'Markdown' });
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
  });

  // ၄။ Clone Bot အသစ်စတင်ချိတ်ဆက်ရန်
  mainBot.command('clonebot', async (ctx) => {
    userSetupState.set(ctx.from.id, { step: 'WAITING_FOR_TOKEN' });
    const sent = await ctx.reply("🤖 Clone Bot အသစ်စတင်ချိတ်ဆက်ပါမည်။\n\nကျေးဇူးပြု၍ Botfather ထံမှ ရယူလာသော **Bot Token** ကို ပို့ပေးပါရှင့်။");
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
  });

  // ၅။ ကိုယ်ပိုင် Bot များကြည့်ရှုခြင်းနှင့် စီမံခန့်ခွဲခြင်း (My Clones)
  mainBot.command('myclones', async (ctx) => {
    const userId = ctx.from.id;
    let userBots = [];

    for (let [token, data] of activeClones.entries()) {
      if (userId === OWNER_ID || data.ownerId === userId) {
        userBots.push({ token, ...data });
      }
    }

    if (userBots.length === 0) {
      const sent = await ctx.reply("📂 လောလောဆယ် သင်ဖန်တီးထားသော Clone Bot လုံးဝ မရှိသေးပါ။ `/clonebot` ဖြင့် အသစ်ဆောက်ပါ။");
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
      return;
    }

    let report = "📋 **သင့်ရဲ့ Clone Bot များစာရင်း:**\n\n";
    userBots.forEach((b, index) => {
      const statusText = b.status === 'paused' ? '⏸️ (ပိတ်ထားသည်)' : '🟢 (ဖွင့်ထားသည်)';
      report += `${index + 1}. **@${b.username}** ${statusText}\n`;
      report += `   - ဇာတ်ညွှန်း: ${b.script.substring(0, 30)}...\n`;
      report += `   - ပိတ်ရန်: \`/pausebot ${b.username}\` | ဖွင့်ရန်: \`/resumebot ${b.username}\`\n`;
      report += `   - ဖျက်ရန်: \`/deletebot ${b.username}\`\n\n`;
    });

    const sent = await ctx.reply(report, { parse_mode: 'Markdown' });
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
  });

  // ၅.၁။ Bot ကို ခေတ္တပိတ်ထားရန် (Pause Bot)
  mainBot.command('pausebot', async (ctx) => {
    const userId = ctx.from.id;
    const botName = ctx.message.text.replace('/pausebot', '').trim().replace('@', '');

    let found = false;
    for (let [token, data] of activeClones.entries()) {
      if ((userId === OWNER_ID || data.ownerId === userId) && data.username.toLowerCase() === botName.toLowerCase()) {
        data.status = 'paused';
        found = true;
        break;
      }
    }

    if (found) {
      const sent = await ctx.reply(`⏸️ Bot (@${botName}) ကို အောင်မြင်စွာ ခေတ္တပိတ်လိုက်ပါပြီ။`);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    } else {
      const sent = await ctx.reply(`❌ Bot (@${botName}) ကို ရှာမတွေ့ပါ သို့မဟုတ် ၎င်းကို စီမံပိုင်ခွင့် မရှိပါ။`);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    }
  });

  // ၅.၂။ Bot ကို ပြန်ဖွင့်ရန် (Resume Bot)
  mainBot.command('resumebot', async (ctx) => {
    const userId = ctx.from.id;
    const botName = ctx.message.text.replace('/resumebot', '').trim().replace('@', '');

    let found = false;
    for (let [token, data] of activeClones.entries()) {
      if ((userId === OWNER_ID || data.ownerId === userId) && data.username.toLowerCase() === botName.toLowerCase()) {
        data.status = 'active';
        found = true;
        break;
      }
    }

    if (found) {
      const sent = await ctx.reply(`🟢 Bot (@${botName}) ကို အောင်မြင်စွာ ပြန်လည်ဖွင့်လှစ်လိုက်ပါပြီ။`);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    } else {
      const sent = await ctx.reply(`❌ Bot (@${botName}) ကို ရှာမတွေ့ပါ။`);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    }
  });

  // ၅.၃။ Bot ကို လုံးဝဖျက်ပစ်ရန် (Delete Bot)
  mainBot.command('deletebot', async (ctx) => {
    const userId = ctx.from.id;
    const botName = ctx.message.text.replace('/deletebot', '').trim().replace('@', '');

    let targetToken = null;
    for (let [token, data] of activeClones.entries()) {
      if ((userId === OWNER_ID || data.ownerId === userId) && data.username.toLowerCase() === botName.toLowerCase()) {
        targetToken = token;
        break;
      }
    }

    if (targetToken) {
      try {
        const botData = activeClones.get(targetToken);
        // grammY bot instance ကို ရပ်တန့်ရန်
        if (botData.bot && typeof botData.bot.stop === 'function') {
          await botData.bot.stop();
        }
      } catch (e) {}

      activeClones.delete(targetToken);
      const sent = await ctx.reply(`🗑️ Bot (@${botName}) ကို အောင်မြင်စွာ ဖျက်သိမ်းလိုက်ပါပြီ။`);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    } else {
      const sent = await ctx.reply(`❌ Bot (@${botName}) ကို ရှာမတွေ့ပါ သို့မဟုတ် ဖျက်ပိုင်ခွင့် မရှိပါ။`);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    }
  });

  // ၆။ အဆင့်ဆင့် Setup လုပ်ခြင်း
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
      const sent = await ctx.reply(`✨ Username (@${username}) ကို မှတ်သားပြီးပါပြီ။\n\n🎬 နောက်ဆုံးအနေနဲ့ ဤ Bot အတွက် **ဇာတ်ညွှန်း (Character / စရိုက်)** ကို ပို့ပေးပါ။`);
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
          await cloneCtx.reply("✨ မင်္ဂလာပါရှင့်။ ကျွန်တော်/မတို့ စကားပြောကြရအောင်လေ။ 🥰");
        });

        // 💬 ဇာတ်ကြောင်း၊ ခံစားချက်နှင့် သင့်လျော်သော အီမိုဂျီ (Emoji) များပါ ထည့်သွင်းတုံ့ပြန်ခြင်း
        cloneBot.on('message:text', async (cloneCtx, nextStep) => {
          // Bot ကို ပိတ်ထားပါက (paused) စကားမပြောပါ
          const cloneDataInfo = activeClones.get(token);
          if (cloneDataInfo && cloneDataInfo.status === 'paused') return;

          if (cloneCtx.from) cloneUsers.add(cloneCtx.from.id);
          if (cloneCtx.message.text.startsWith('/')) return nextStep();

          const userText = cloneCtx.message.text;
          if (!ai) return;

          try {
            await cloneCtx.replyWithChatAction('typing');
            
            const prompt = `မင်းဟာ Telegram Bot (@${username}) ဖြစ်ပြီး ပေးထားတဲ့ ဇာတ်ညွှန်း/Character အတိုင်း သရုပ်ဆောင်ရမယ်။
အောက်ပါ User ရဲ့ စကားကို ခွဲခြမ်းစိတ်ဖြာပြီး JSON ပုံစံအတိုင်း တုံ့ပြန်ပေးပါ:
1. "reply": ဇာတ်ကောင်စရိုက်အတိုင်း၊ ပေးထားသော ဇာတ်ကြောင်းအတိုင်း ပြန်မယ့် စာသား (မြန်မာလို၊ သင့်လျော်သော အီမိုဂျီ/Emoji များ အပြည့်အစုံထည့်ပါ)
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

            // 🎥 Mood နှင့် ကိုက်ညီသော ဗီဒီယိုနှင့် Caption/Link များကို ပူးတွဲပို့မည်
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
          const cloneDataInfo = activeClones.get(token);
          if (cloneDataInfo && cloneDataInfo.status === 'paused') return;

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

        activeClones.set(token, { 
          username, 
          script: customScript, 
          ownerId: userId, 
          bot: cloneBot, 
          cloneUsers, 
          status: 'active' 
        });
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
