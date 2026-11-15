const { GoogleGenAI } = require('@google/genai');

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

// 💖 အမြဲတမ်း တိုတို၊ သပ်ရပ်ပြီး ချစ်စရာကောင်းသော မိန်းကလေးပုံစံဖြင့် အမြန်ဆုံး ဖြေကြားမည့် Function
async function callGemini(userText) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY ကို .env တွင် ထည့်သွင်းထားခြင်း မရှိပါ');
  }

  const cuteGirlInstruction = 
    "မင်းဟာ Telegram bot ရဲ့ ချစ်စရာကောင်းပြီး အဖော်ပြုတတ်တဲ့ မိန်းကလေး သူငယ်ချင်း/ချစ်သူ တစ်ယောက် ဖြစ်တယ်။ " +
    "စကားပြောတဲ့အခါ 'ငါ' ဆိုတဲ့ ကြမ်းတမ်းတဲ့ စကားလုံး လုံးဝမသုံးရဘူး။ " +
    "အမြဲတမ်း ချိုသာယဉ်ကျေးစွာနဲ့ 'ရှင့်'၊ 'ပါရှင့်' လို့ သုံးပြီး၊ နွဲ့နွဲ့နှောနှော၊ အားပေးတဲ့ အမူအရာလေးတွေ၊ ချစ်စရာ အီမိုဂျီလေးတွေနဲ့ **အလွန်တိုတိုတုတ်တုတ်၊ ရှင်းရှင်းလင်းလင်းနှင့် သပ်ရပ်စွာ** ဖြေပါ။";

  const modelName = 'gemini-3.6-flash';

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `${cuteGirlInstruction}\n\nသူ့ရဲ့ စာ: ${userText}`,
      config: {
        temperature: 0.7,
        maxOutputTokens: 300, // စာများများ မရှည်သွားစေရန် အတိုချုပ် သတ်မှတ်ထားသည်
      }
    });

    const text = extractTextFromResponse(response);
    if (!text) {
      throw new Error('AI မှ စာသားတုံ့ပြန်မှု မရရှိပါ');
    }
    return text;
  } catch (err) {
    try {
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `${cuteGirlInstruction}\n\nသူ့ရဲ့ စာ: ${userText}`
      });
      const text = extractTextFromResponse(fallbackResponse);
      if (text) return text;
    } catch (e) {}

    throw err;
  }
}

async function handleAIResponse(ctx, userText) {
  const userId = ctx.from.id;
  const settings = getAISettings(userId);

  const isPrivate = ctx.chat.type === 'private';

  if (isPrivate) {
    settings.isOpen = true; 
  } else {
    if (!userText || !userText.startsWith('/ai')) return false;
    userText = userText.replace(/^\/ai\s*/i, '').trim();
  }

  if (!settings.isOpen || !ai) return false;

  let typingInterval = null;

  try {
    const cleanText = isPrivate ? userText.trim() : userText;
    if (!cleanText) {
      const sent = await ctx.reply("ဟင့်.. ဘာတွေ တွေးနေလို့လဲရှင့်? ကိုယ့်ကို တစ်ခုခု ပြောပြလေနော်။ 😊💕");
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
      
      // Reply / Quote အကွက် မပါဘဲ သီးသန့်စာသားသပ်သပ် ပို့ပေးခြင်း
      const sentText = await ctx.reply(textReply);
      
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sentText.message_id);
      return true;
    }
  } catch (err) {
    if (typingInterval) {
      clearInterval(typingInterval);
      typingInterval = null;
    }
    console.error("AI Error:", err.message);
    await ctx.reply("ရုတ်တရက် အဆက်အသွယ်လေး ပြတ်သွားလို့ပါရှင့်.. ခဏနေမှ ထပ်ပြောပြနော်။ 💕");
  }
  return false;
}

module.exports = { getAISettings, handleAIResponse };
