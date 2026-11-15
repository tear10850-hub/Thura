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

function cleanTextForTG(text) {
  if (!text) return '';
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

// 💬 လူပုံစံအတိုင်း အလိုက်သင့်၊ ဆဲဆိုလျှင်လည်း အနေအထားအလိုက် ပြန်လည်တုံ့ပြန်မည့် Function
async function callGemini(userText) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY ကို မထည့်သွင်းရသေးပါ');
  }

  const humanLikeInstruction = 
    "မင်းဟာ Messenger မှာ စကားပြောနေတဲ့ သဘာဝလူသားတစ်ယောက်လို အလိုက်သင့် နေထိုင်ပြောဆိုတဲ့ AI ဖြစ်တယ်။ " +
    "အဓိက စည်းကမ်းချက်များ - " +
    "1. အင်္ဂလိပ်လို လုံးဝမဖြေရ။ မြန်မာလိုသာ ဖြေပါ။ 'ဗျာ' နှင့် 'ရေ' ဟူသော စကားလုံးများကို လုံးဝမသုံးရ။ အမြဲတမ်း 'ရှင့်' ဟုသာ သုံးပါ။ 'ငါ' ဟူသော စကားလုံး လုံးဝမသုံးရ။ " +
    "2. လာပြောတဲ့သူရဲ့ ပုံစံ (သာမန်မေးတာ၊ ချစ်စနိုးပြောတာ၊ သို့မဟုတ် ဆဲဆိုစနောက်တာမျိုးတွေ) အပေါ်မူတည်ပြီး အလိုက်သင့်၊ တူညီတဲ့ပုံစံမျိုးနဲ့ ပြန်လည် တုံ့ပြန်ရမည်။ " +
    "   - ဥပမာ (ချစ်စနိုးခေါ်လျှင်): 'ရှင့်... ကိုကို့ကို အရမ်းချစ်တာပေါ့ရှင့်။' 💕 " +
    "   - ဥပမာ (ဆဲဆိုစနောက်လာလျှင်): 'ရှင့်... ဘာလာပြောတာလဲ၊ လူဆိုးကြီး၊ ပြန်ပြောရမလားင့်။' 😤 " +
    "3. စာကို အလယ်မှာ ရပ်မသွားစေဘဲ ရှင်းလင်းတိုတုတ်စွာ အဆုံးထိ ဖြေပါ။";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `${humanLikeInstruction}\n\nလာပြောတဲ့သူရဲ့ စာ: ${userText}`,
      config: {
        temperature: 0.8, // အလိုက်သင့် ပိုမိုသဘာဝကျစေရန် temperature မြှင့်ထားသည်
        maxOutputTokens: 300,
      }
    });

    const text = extractTextFromResponse(response);
    if (text) return text;
  } catch (err) {
    console.warn("Model flash error, trying fallback...", err.message);
  }

  try {
    const fallbackResponse = await ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: `${humanLikeInstruction}\n\nလာပြောတဲ့သူရဲ့ စာ: ${userText}`,
      config: {
        temperature: 0.8,
        maxOutputTokens: 300,
      }
    });
    const text = extractTextFromResponse(fallbackResponse);
    if (text) return text;
  } catch (err) {
    console.warn("Fallback model error:", err.message);
  }

  throw new Error('API Quota ကုန်သွားပါပြီ။ ကျေးဇူးပြု၍ API Key အသစ် လဲလှယ်ပေးပါ။');
}

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
    const sent = await ctx.reply("ရှင့်... ဘာတွေ တွေးနေလို့လဲရှင့်? တစ်ခုခု ပြောပြလေနော်။ 😊💕", {
      reply_parameters: { message_id: ctx.message.message_id }
    });
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    return true;
  }

  ctx.replyWithChatAction('typing').catch(() => {});

  callGemini(cleanText).then(async (replyText) => {
    if (replyText) {
      let textReply = cleanTextForTG(replyText);
      if (textReply.toLowerCase().includes('drafting') || textReply.length < 2) {
        textReply = "ရှင့်... ဘာပြောချင်လို့လဲရှင့်။ 💕";
      }
      
      const sentText = await ctx.reply(textReply, {
        reply_parameters: { message_id: ctx.message.message_id }
      });
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sentText.message_id);
    }
  }).catch(async (err) => {
    console.error("AI Error:", err.message);
    const errorMsg = err.message.includes('Quota') 
      ? "ရှင့်... API Quota ခဏကုန်သွားလို့ပါရှင့်။ Key အသစ်လေး ပြန်စစ်ပေးပါနော်။ 🛠️" 
      : "ရှင့်... ရုတ်တရက် အဆက်အသွယ်လေး ပြတ်သွားလို့ပါရှင့်... ခဏနေမှ ထပ်ပြောပြနော်။ 💕";
      
    await ctx.reply(errorMsg, {
      reply_parameters: { message_id: ctx.message.message_id }
    });
  });

  return true;
}

module.exports = { getAISettings, handleAIResponse };
