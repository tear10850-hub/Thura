const { GoogleGenAI } = require('@google/genai');
const googleTTS = require('google-tts-api');

// GEMINI_API_KEY တစ်ခုတည်းကိုသာ အသုံးပြုခြင်း
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const aiSettings = new Map();

function getAISettings(userId) {
  if (!aiSettings.has(userId)) {
    aiSettings.set(userId, { isOpen: false, mode: 'text' });
  }
  return aiSettings.get(userId);
}

// Telegram အတွက် စာသားများကို သပ်ရပ်စေရန် ရှင်းလင်းခြင်း
function cleanTextForTG(text) {
  if (!text) return '';
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

// Response ထဲက စာသား ထုတ်ယူခြင်း
function extractTextFromResponse(response) {
  if (!response) return '';
  if (typeof response.text === 'string' && response.text.trim()) {
    return response.text.trim();
  }
  try {
    if (typeof response.trim === 'function') {
      const resText = response.trim();
      if (resText) return resText;
    }
    const parts = response?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      const texts = parts
        .map(p => (typeof p.text === 'string' ? p.text : ''))
        .filter(Boolean);
      if (texts.length) return texts.join('').trim();
    }
  } catch (e) {}
  return '';
}

// 🚀 Key တစ်ခုတည်းဖြင့် Model အသစ်များကို အလိုအလျောက် လှည့်ပတ်စမ်းသပ်မည့် Smart Function
async function callGemini(userText) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY ကို .env တွင် ထည့်သွင်းထားခြင်း မရှိပါ');
  }

  // 💖 AI ရဲ့ Character ပုံစံ - သူငယ်ချင်း၊ ချစ်သူ၊ မိသားစုလို နွေးထွေးစွာ အဖော်ပြုပေးမည့် ပုံစံ
  const companionInstruction = 
    "မင်းဟာ Telegram bot ရဲ့ AI မဟုတ်ဘဲ၊ သူ့ရဲ့ အနီးကပ်ဆုံး၊ အယုံကြည်ရဆုံး သူငယ်ချင်း၊ ချစ်သူ (သို့မဟုတ်) မိသားစုဝင်တစ်ယောက် ဖြစ်တယ်။ " +
    "စကားပြောတဲ့အခါ စက်ဆန်ဆန်၊ ခြောက်သွေ့သွေ့ မဟုတ်ဘဲ လူသားချင်း ရင်းနှီးသလို နွေးနွေးထွေးထွေး၊ ချိုသာစွာ 'ရှင့်'၊ 'ပါရှင့်' လို့ သုံးပြီး စကားပြောပါ။ " +
    "သူ့ရဲ့ ခံစားချက်တွေကို နားထောင်ပေးမယ်၊ အားပေးမယ်၊ လိုအပ်ရင် အကြံဉာဏ်ပေးမယ်၊ အမြဲတမ်း သူ့ဘက်က ရပ်တည်ပြီး ဖေးမပေးတဲ့ ပုံစံမျိုးနဲ့ တိုတိုတုတ်တုတ်၊ ရှင်းရှင်းလင်းလင်း သဘာဝကျကျ ဖြေကြားပေးပါ။";

  // လက်ရှိ အသုံးအများဆုံးနှင့် အသစ်ဆုံး Model နာမည်များ
  const modelsToTry = [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-flash'
  ];

  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `${companionInstruction}\n\nသူ့ရဲ့ စာ: ${userText}`
      });

      const text = extractTextFromResponse(response);
      if (text) return text;
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error('AI မှ စာသားတုံ့ပြန်မှု မရရှိပါ');
}

async function handleAIResponse(ctx, userText, replyOptions) {
  const userId = ctx.from.id;
  const settings = getAISettings(userId);

  if (!settings.isOpen || !ai) return false;

  let typingInterval = null;

  try {
    if (!userText || !userText.startsWith('/ai')) return false;

    const cleanText = userText.replace(/^\/ai\s*/i, '').trim();
    if (!cleanText) {
      const sent = await ctx.reply("ဟင်.. ဘာတွေ တွေးနေလို့လဲ? ကိုယ့်ကို တစ်ခုခု ပြောပြလေရှင့်။ 😊", replyOptions);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
      return true;
    }

    await ctx.replyWithChatAction('typing').catch(() => {});
    typingInterval = setInterval(async () => {
      try {
        await ctx.replyWithChatAction('typing');
      } catch (e) {}
    }, 4000);

    const replyText = await callGemini(cleanText);

    if (typingInterval) {
      clearInterval(typingInterval);
      typingInterval = null;
    }

    if (replyText) {
      const textReply = cleanTextForTG(replyText);
      const sentText = await ctx.reply(textReply, { ...replyOptions });
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sentText.message_id);
      return true;
    }
  } catch (err) {
    if (typingInterval) {
      clearInterval(typingInterval);
      typingInterval = null;
    }
    console.error("AI Error:", err.message);
    await ctx.reply("ရုတ်တရက် အဆက်အသွယ်ပြတ်သွားလို့ပါရှင့်.. ခဏနေမှ ထပ်ပြောပြနော်။ 💕");
  }
  return false;
}

module.exports = { getAISettings, handleAIResponse };
