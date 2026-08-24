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
    
    await ctx.answerCallbackQuery({ text: `✅ Model ကို ${selectedModel} သို့ ပြောင်းလိုက်ပါပြီရှင့်။` });
    const sent = await ctx.editMessageText(`🤖 <b>AI Model အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီရှင့်။</b>\n\n- လက်ရှိသုံးနေသော Model: <code>${selectedModel}</code>`, { parse_mode: 'HTML' });
    
    if (global.autoDeleteMessage) {
      global.autoDeleteMessage(ctx, sent.message_id, 5 * 60 * 1000);
    }
  });
}

// ၃။ AI ဖြင့် ဖြေကြားခြင်း (မိန်းကလေးလေသံဖြင့်၊ Copy ကူး၍ရရန်၊ ၅ မိနစ်ဖြင့် အလိုလိုပျက်ရန်)
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
        const sent = await ctx.reply("⚠️ မေးခွန်းလေး တစ်ခုခု ရိုက်ပေးပါဦးရှင့်။ (ဥပမာ: /ai မင်္ဂလာပါ)", replyOptions);
        if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id, 5 * 60 * 1000);
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

    // AI ကို မိန်းကလေးလေသံ (ရင်ခုန်စရာ၊ ယဉ်ကျေးပျူငှาသော စာသားများ) ဖြင့် ဖြေဆိုရန် System Instruction ပုံစံ ပေးပို့ခြင်း
    const girlPersonaPrompt = `မင်းဟာ Telegram bot ရဲ့ AI ဖြစ်ပြီး ချစ်စရာကောင်းပြီး ယဉ်ကျေးပျူငှาတဲ့ မိန်းကလေးတစ်ယောက်လို စကားပြောရမယ်။ စကားပြောတဲ့အခါ တိုတိုတုတ်တုတ်နဲ့ သပ်သပ်ရပ်ရပ်ဖြေပြီး 'ရှင့်'၊ 'ပါရှင့်' စတဲ့ အဆုံးသတ်လေးတွေနဲ့ ဖူဆယ်ကျီကျီ ပြောဆိုပေးပါ။ အခုသူပြောတာက: ${cleanText}`;

    try {
      response = await ai.models.generateContent({
        model: currentActiveModel,
        contents: girlPersonaPrompt
      });
    } catch (modelErr) {
      console.warn(`Model ${currentActiveModel} failed, switching to backup model...`);
      currentActiveModel = 'gemini-3.6-flash';
      response = await ai.models.generateContent({
        model: currentActiveModel,
        contents: girlPersonaPrompt
      });
    }

    if (typingInterval) clearInterval(typingInterval);

    if (response && response.text) {
      const aiReplyText = response.text.trim();
      
      // Copy ကူး၍ရသော ပုံမှန်စာသားဖြင့် ပို့မည်
      const sentText = await ctx.reply(aiReplyText, replyOptions);
      
      // ⏰ မေးခွန်းရော အဖြေပါ ၅ မိနစ်ပြည့်လျှင် အလိုလို ပျက်စေရန်
      if (global.autoDeleteMessage) {
        global.autoDeleteMessage(ctx, sentText.message_id, 5 * 60 * 1000);
        global.autoDeleteMessage(ctx, ctx.message.message_id, 5 * 60 * 1000);
      }
      return true;
    } else {
      if (typingInterval) clearInterval(typingInterval);
      const sent = await ctx.reply("⚠️ တောင်းပန်ပါတယ်ရှင့်၊ AI ဆီက အဖြေထုတ်လို့ မရသေးလို့ ခဏနေမှ ထပ်ကြိုးစားပေးပါနော်။", replyOptions);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id, 5 * 60 * 1000);
      return true;
    }

  } catch (err) {
    if (typingInterval) clearInterval(typingInterval);

    console.error("AI Error:", err.message);
    const sent = await ctx.reply("⚠️ အမှားအယွင်းလေး တစ်စုံတစ်ရာ ဖြစ်သွားလို့ပါရှင့်။ ခဏနေမှ ထပ်ကြိုးစားပေးပါနော်။", replyOptions);
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id, 5 * 60 * 1000);
  }
  return false;
}

module.exports = { getAISettings, handleAIResponse, getModelSelectionKeyboard, handleModelCallback };
