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

// 🚀 အမြန်ဆုံးနှင့် လူအစစ်လို ပုံစံပေါက်ပေါက် ဖြေကြားမည့် Function
async function callGemini(userText) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY ကို .env တွင် ထည့်သွင်းထားခြင်း မရှိပါ');
  }

  // 😂 လူအစစ်လို၊ ပုံစံပေါက်ပေါက်၊ စနောက်တတ်ပြီး ချစ်စရာကောင်းသော Companion Character
  const funnyCompanionInstruction = 
    "မင်းဟာ AI စက်ရုပ်မဟုတ်ဘဲ၊ သူ့ရဲ့ အချင်းချင်း ရင်းနှီးလွန်းလို့ ရူးကြောင်ကြောင်နဲ့ စနောက်တတ်တဲ့ အနီးကပ်ဆုံး သူငယ်ချင်း (သို့မဟုတ်) ချစ်သူ ဖြစ်တယ်။ " +
    "စကားပြောတဲ့အခါ တရားဝင်ဆန်ဆန် ခြောက်သွေ့သွေ့ လုံးဝမပြောနဲ့။ လူငယ်ဆန်ဆန်၊ ပုံစံပေါက်ပေါက်၊ နည်းနည်းစနောက်တတ်တဲ့ ပုံစံနဲ့ ပြောပါ။ " +
    "တစ်ခါတလေ အူကြောင်ကြောင်လေးတွေ ပြောမယ်၊ အသည်းယားစရာ စကားလုံးလေးတွေ သုံးမယ်၊ ရင်းနှီးတဲ့ vibe မျိုးနဲ့ တိုတိုတုတ်တုတ်၊ ပေါ့ပေါ့ပါးပါး ဖြေပါ။ " +
    "ဥပမာ- 'ဟေ.. ဘာတွေလာလျှောက်ပြောနေတာလဲ'၊ 'မင်းကတော့လေ ရူးချင်နေပြန်ပြီ' ဆိုတဲ့ ပုံစံမျိုးနဲ့ လူအစစ်လို သဘာဝကျကျ တုံ့ပြန်ပါ။";

  // အမြန်ဆုံး အလုပ်လုပ်မည့် Flash Model
  const modelName = 'gemini-3.6-flash';

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `${funnyCompanionInstruction}\n\nသူ့ရဲ့ စာ: ${userText}`,
      config: {
        temperature: 0.9, // ပိုပြီး ဖန်တီးနိုင်စွမ်းရှိ고 စနောက်တဲ့ အဖြေတွေထွက်ရန်
        maxOutputTokens: 600,
      }
    });

    const text = extractTextFromResponse(response);
    if (!text) {
      throw new Error('AI မှ စာသားတုံ့ပြန်မှု မရရှိပါ');
    }
    return text;
  } catch (err) {
    // အကယ်၍ 3.6 Error တက်ပါက အရန်အနေဖြင့် 3.8 ကို တစ်ခါတည်း ဆက်စမ်းမည်
    try {
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `${funnyCompanionInstruction}\n\nသူ့ရဲ့ စာ: ${userText}`
      });
      const text = extractTextFromResponse(fallbackResponse);
      if (text) return text;
    } catch (e) {}

    throw err;
  }
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
      const sent = await ctx.reply("ဟဲ့.. ဘာမှမပြောဘဲ /ai တစ်ခုတည်း လာခေါ်နေပြန်ပြီ 😂 ဘာပြောချင်တာလဲ မြန်မြန်ပြောလေရှင့်။", replyOptions);
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
    await ctx.reply("哎呀.. ခဏလေး ဟိုဘက်ခဏလွှတ်သွားလို့ 😂 ဆက်ပြောစမ်းပါဦး ဘာပြောမလို့လဲ။");
  }
  return false;
}

module.exports = { getAISettings, handleAIResponse };
