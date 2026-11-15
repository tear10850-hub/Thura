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

// 🚀 အမြန်ဆုံးနှင့် ဝင်လာသူ၏ ပုံစံအလိုက် ပြောင်းလဲဖြေကြားမည့် Function
async function callGemini(userText) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY ကို .env တွင် ထည့်သွင်းထားခြင်း မရှိပါ');
  }

  // 💖 Dynamic Persona Instruction (လာမေးသူ၏ ပုံစံ/နာမ်စားအလိုက် အလိုအလျောက် ပြောင်းလဲမည့် ပုံစံ)
  const smartCompanionInstruction = 
    "မင်းဟာ Telegram bot ရဲ့ အနီးကပ်ဆုံး၊ ဖော်ရွေဆုံး သူငယ်ချင်း/ချစ်သူ တစ်ယောက် ဖြစ်တယ်။ " +
    "စကားပြောတဲ့အခါ လာပြောတဲ့သူရဲ့ ပုံစံ၊ ရေချိန်နဲ့ နာမ်စားသုံးနှုန်းတွေကို အဓိက လိုက်ပြီး ပြောင်းလဲပြောဆိုရမယ် - " +
    "1. အကယ်၍ လာပြောတဲ့သူက ကိုကို၊ မောင်၊ သို့မဟုတ် ယောကျ်ားလေးဆန်ဆန် နာမ်စားတွေ သုံးပြီး စကားလာပြောမယ်ဆိုရင်၊ မင်းက ချစ်စရာကောင်းပြီး အނုအရွဖြစ်တဲ့ မိန်းကလေးပုံစံ (သို့မဟုတ်) ချစ်သူလို နွဲ့နွဲ့နှောနှောနဲ့ ဖော်ရွေစွာ တုံ့ပြန်ပါ။ " +
    "2. အကယ်၍ လာပြောတဲ့သူက မိန်းကလေးပုံစံ (မမ၊ ညီမ စသဖြင့်) ဖြစ်နေမယ်ဆိုရင်တော့ သင်းပျံ့ဖော်ရွေတဲ့ သူငယ်ချင်းမလေး တစ်ယောက်လို ရင်းနှီးပူဇော်စွာ ပြောပါ။ " +
    "3. ယေဘူယျအားဖြင့် ပုံစံပေါက်ပေါက်၊ အူကြောင်ကြောင်နဲ့ စနောက်တတ်တဲ့ လူအစစ် vibe မျိုးကို အမြဲ ထိန်းထားပါ။ " +
    "4. ခြောက်သွေ့တဲ့ စက်ရုပ်ဆန်ဆန် လုံးဝမပြောဘဲ တိုတိုတုတ်တုတ်၊ ပေါ့ပေါ့ပါးပါးနဲ့ အသက်ဝင်အောင် ဖြေပါ။";

  const modelName = 'gemini-3.6-flash';

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `${smartCompanionInstruction}\n\nလာပြောတဲ့သူရဲ့ စာ: ${userText}`,
      config: {
        temperature: 0.85,
        maxOutputTokens: 600,
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
        contents: `${smartCompanionInstruction}\n\nလာပြောတဲ့သူရဲ့ စာ: ${userText}`
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

  const isPrivate = ctx.chat.type === 'private';

  // Group ထဲတွင်ဆိုလျှင် /ai ပါမှသာ ဖြေမည်။ Private Chat တွင်မူ အမြဲတမ်း ဖြေမည်။
  if (isPrivate) {
    settings.isOpen = true; // Private တွင် အလိုအလျောက် ဖွင့်ပေးမည်
  } else {
    if (!userText || !userText.startsWith('/ai')) return false;
    userText = userText.replace(/^\/ai\s*/i, '').trim();
  }

  if (!settings.isOpen || !ai) return false;

  let typingInterval = null;

  try {
    const cleanText = isPrivate ? userText.trim() : userText;
    if (!cleanText) {
      const sent = await ctx.reply("ဟဲ့.. ဘာတွေ တွေးနေလို့လဲ? ကိုယ့်ကို တစ်ခုခု ပြောပြလေရှင့်။ 😊", replyOptions);
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
    await ctx.reply("ဟင့်.. ရုတ်တရက် အဆက်အသွယ်ပြတ်သွားလို့ပါရှင့်.. ခဏနေမှ ထပ်ပြောပြနော်။ 💕");
  }
  return false;
}

module.exports = { getAISettings, handleAIResponse };
