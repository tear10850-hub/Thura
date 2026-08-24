const { GoogleGenAI } = require('@google/genai');
const { InlineKeyboard } = require('grammy');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// အသုံးပြုသူတစ်ဦးချင်းစီ၏ ဆက်တင်များနှင့် Model ကို သိမ်းရန်
const aiSettings = new Map();

function getAISettings(userId) {
  if (!aiSettings.has(userId)) {
    aiSettings.set(userId, { 
      isOpen: false, 
      mode: 'aiopen', 
      model: 'gemini-3.7-flash' // မူလသုံးမည့် မော်ဒယ်
    });
  }
  return aiSettings.get(userId);
}

// Telegram အတွက် စာသားများကို သပ်ရပ်စေရန် ရှင်းလင်းခြင်း
function cleanTextForTG(text) {
  if (!text) return '';
  return text.replace(/[*_`\[\]]/g, '').trim();
}

// ၁။ /model လို့ ရိုက်လိုက်ရင် ခလုတ်ပေါ်လာစေရန် Function
function getModelSelectionKeyboard() {
  return new InlineKeyboard()
    .text("⚡ Gemini 3.7 Flash", "set_model_gemini-3.7-flash")
    .row()
    .text("🚀 Gemini 3.6 Flash", "set_model_gemini-3.6-flash")
    .row()
    .text("💡 Gemini 3.5 Flash-Lite", "set_model_gemini-3.5-flash-lite")
    .row()
    .text("🧠 Gemini 3.1 Pro", "set_model_gemini-3.1-pro-preview");
}

// ၂။ ခလုတ်နှိပ်လိုက်တာကို လက်ခံပြီး Model ပြောင်းပေးမည့် Handler
function handleModelCallback(bot) {
  bot.callbackQuery(/^set_model_(.+)$/, async (ctx) => {
    const selectedModel = ctx.match[1];
    const userId = ctx.from.id;
    const settings = getAISettings(userId);
    
    settings.model = selectedModel;
    
    await ctx.answerCallbackQuery({ text: `✅ Model ကို ${selectedModel} သို့ ပြောင်းလိုက်ပါပြီရှင်။` });
    await ctx.editMessageText(`🤖 <b>AI Model အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ။</b>\n\n- လက်ရှိသုံးနေသော Model: <code>${selectedModel}</code>`, { parse_mode: 'HTML' });
  });
}

// ၃။ AI ဖြင့် ဖြေကြားခြင်းနှင့် မော်ဒယ် အလိုအလျောက် လဲလှယ်စမ်းသပ်ခြင်း
async function handleAIResponse(ctx, userText, replyOptions, OWNER_ID) {
  const userId = ctx.from.id;
  const settings = getAISettings(userId);
  const isPrivate = ctx.chat.type === 'private';

  if (!settings.isOpen || !ai) return false;

  if (!isPrivate) {
    if (!userText.startsWith('/ai')) return false;
  } else {
    if (settings.mode === 'aiopen' && !userText.startsWith('/ai')) return false;
  }

  let typingInterval = null;

  try {
    const cleanText = userText.startsWith('/ai') ? userText.replace('/ai', '').trim() : userText.trim();
    if (!cleanText) {
      if (userText.startsWith('/ai')) {
        const sent = await ctx.reply("⚠️ မေးခွန်းတစ်ခုခု ရိုက်ပေးပါရှင်။ (ဥပမာ: /ai မင်္ဂလာပါ)", replyOptions);
        if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
        return true;
      }
      return false;
    }

    await ctx.replyWithChatAction('typing').catch(() => {});
    typingInterval = setInterval(async () => {
      try {
        await ctx.replyWithChatAction('typing');
      } catch (e) {}
    }, 4000);

    let response = null;
    let currentActiveModel = settings.model;

    try {
      response = await ai.models.generateContent({
        model: currentActiveModel,
        contents: `မင်းဟာ Telegram bot ရဲ့ AI ဖြစ်တယ်။ တိုတိုတုတ်တုတ်နဲ့ သပ်သပ်ရပ်ရပ် ဖြေပါ။ အခုသူပြောတာက: ${cleanText}`
      });
    } catch (modelErr) {
      console.warn(`Model ${currentActiveModel} failed, switching to backup model...`);
      currentActiveModel = 'gemini-3.6-flash'; // Backup Model
      response = await ai.models.generateContent({
        model: currentActiveModel,
        contents: `မင်းဟာ Telegram bot ရဲ့ AI ဖြစ်တယ်။ တိုတိုတုတ်တုတ်နဲ့ သပ်သပ်ရပ်ရပ် ဖြေပါ။ အခုသူပြောတာက: ${cleanText}`
      });
    }

    if (typingInterval) clearInterval(typingInterval);

    if (response && response.text) {
      const textReply = cleanTextForTG(response.text);
      const formattedBox = `\`\`\`text\n${textReply}\n\`\`\`\n📌 <i>Model: ${currentActiveModel}</i>`;
      
      const sentText = await ctx.reply(formattedBox, { parse_mode: 'HTML', ...replyOptions });
      
      if (global.autoDeleteMessage) {
        global.autoDeleteMessage(ctx, sentText.message_id);
      }
      return true;
    } else {
      if (typingInterval) clearInterval(typingInterval);
      await ctx.reply("⚠️ AI ထံမှ အဖြေထုတ်၍ မရပါ။ ခဏနေမှ ထပ်မံကြိုးစားပါ။", replyOptions);
      return true;
    }

  } catch (err) {
    if (typingInterval) clearInterval(typingInterval);

    console.error("AI Error:", err.message);
    await ctx.reply("⚠️ AI အလုပ်လုပ်ရာတွင် အမှားအယွင်းရှိနေပါသည်။ ခဏနေမှ ထပ်ကြိုးစားပေးပါရှင်။", replyOptions);

    if (OWNER_ID) {
      const cleanText = userText.startsWith('/ai') ? userText.replace('/ai', '').trim() : userText.trim();
      const userInfo = `👤 <b>အသုံးပြုသူ အချက်အလက်:</b>\n- ID: <code>${ctx.from.id}</code>\n🚨 <b>Error Message:</b> <code>${err.message}</code>`;
      await ctx.api.sendMessage(OWNER_ID, userInfo, { parse_mode: 'HTML' }).catch(() => {});
    }
  }
  return false;
}

module.exports = { getAISettings, handleAIResponse, getModelSelectionKeyboard, handleModelCallback };
