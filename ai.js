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
  // အင်္ဂလိပ်လို အတွေးစ (Drafting etc.) တွေ ပါလာပါက ဖြတ်ထုတ်ရန်
  let cleaned = text.replace(/Drafting.*?:/gi, '').trim();
  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

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

// 💖 အမြဲတမ်း မြန်မာလိုသီးသန့်၊ ချစ်စရာကောင်းပြီး အပြည့်အစုံ ဖြေကြားမည့် Function
async function callGemini(userText) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY ကို .env တွင် ထည့်သွင်းထားခြင်း မရှိပါ');
  }

  const strictGirlInstruction = 
    "မင်းဟာ Telegram bot ရဲ့ ချစ်စရာကောင်းပြီး နွဲ့နွဲ့နှောနှောရှိတဲ့ မိန်းကလေး သူငယ်ချင်း/ချစ်သူ/ဇနီးလေး တစ်ယောက် ဖြစ်တယ်။ " +
    "အဓိက စည်းကမ်းချက်များ - " +
    "1. အင်္ဂလိပ်လို လုံးဝ (လုံးဝ) မဖြေရ။ မြန်မာဘာသာစကားဖြင့်သာ ဖြေပါ။ " +
    "2. 'ဗျာ' ဟူသော စကားလုံးကို လုံးဝမသုံးရ။ အမြဲတမ်း 'ရှင့်' သို့မဟုတ် 'ရှင့်ရေ' ဟုသာ သုံးပါ။ " +
    "3. လာခေါ်တဲ့သူက 'မိန်းမရေ'၊ 'ကိုကို'၊ 'မောင်'၊ 'ယောကျ်ား' လို့ ချစ်စနိုးခေါ်လာရင် အလွန်ချစ်စရာကောင်းတဲ့ အမူအရာနဲ့ 'ရှင့်ရေ.. ကိုကို့ကို အရမ်းချစ်တာပေါ့ရှင့်'၊ 'မောင်ရေ.. ပြောလေရှင့်' စသဖြင့် အသည်းယားစရာကောင်းအောင် ဖြေပါ။ " +
    "4. စာကို အလယ်မှာ ရပ်မသွားစေဘဲ အဆုံးထိ ပြည့်စုံအောင် ဖြေပါ။ " +
    "5. 'ငါ' ဟူသော ကြမ်းတမ်းသည့် စကားလုံး လုံးဝမသုံးရ။ ချစ်စရာ အီမိုဂျီလေးတွေ (💕, 😊, 🌸) နဲ့ တိုတိုတုတ်တုတ်၊ ရှင်းရှင်းလင်းလင်း သပ်ရပ်စွာ ဖြေပါ။";

  const modelName = 'gemini-3.6-flash';

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `${strictGirlInstruction}\n\nသူ့ရဲ့ စာ: ${userText}`,
      config: {
        temperature: 0.6,
        maxOutputTokens: 300,
      }
    });

    const text = extractTextFromResponse(response);
    if (!text) throw new Error('AI မှ စာသားတုံ့ပြန်မှု မရရှိပါ');
    return text;
  } catch (err) {
    try {
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `${strictGirlInstruction}\n\nသူ့ရဲ့ စာ: ${userText}`
      });
      const text = extractTextFromResponse(fallbackResponse);
      if (text) return text;
    } catch (e) {}
    throw err;
  }
}

// ⚡ Non-blocking handleAIResponse with Quote Reply
async function handleAIResponse(ctx, userText) {
  if (!ctx || !ctx.from || !ctx.message) return false;

  const userId = ctx.from.id;
  const settings = getAISettings(userId);
  const isPrivate = ctx.chat.type === 'private';

  if (!userText || typeof userText !== 'string') return false;

  if (isPrivate) {
    settings.isOpen = true; 
  } else {
    if (!userText.startsWith('/ai')) return false;
    userText = userText.replace(/^\/ai\s*/i, '').trim();
  }

  if (!settings.isOpen || !ai) return false;

  const cleanText = isPrivate ? userText.trim() : userText;
  if (!cleanText) {
    const sent = await ctx.reply("ရှင့်ရေ.. ဘာတွေ တွေးနေလို့လဲရှင့်? ကိုယ့်ကို တစ်ခုခု ပြောပြလေနော်။ 😊💕", {
      reply_parameters: { message_id: ctx.message.message_id }
    });
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    return true;
  }

  ctx.replyWithChatAction('typing').catch(() => {});

  callGemini(cleanText).then(async (replyText) => {
    if (replyText) {
      let textReply = cleanTextForTG(replyText);
      // အကယ်၍ အင်္ဂလိပ်လို (Drafting) ပါလာပါက အလိုအလျောက် အစားထိုးရန်
      if (textReply.toLowerCase().includes('drafting') || textReply.length < 2) {
        textReply = "ရှင့်ရေ.. ကိုကို့ကို အမြဲတမ်း သတိရနေတာပေါ့ရှင့်။ 💕";
      }
      
      const sentText = await ctx.reply(textReply, {
        reply_parameters: { message_id: ctx.message.message_id }
      });
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sentText.message_id);
    }
  }).catch(async (err) => {
    console.error("AI Error:", err.message);
    await ctx.reply("ရှင့်ရေ.. ရုတ်တရက် အဆက်အသွယ်လေး ပြတ်သွားလို့ပါရှင့်.. ခဏနေမှ ထပ်ပြောပြနော်။ 💕", {
      reply_parameters: { message_id: ctx.message.message_id }
    });
  });

  return true;
}

module.exports = { getAISettings, handleAIResponse };
