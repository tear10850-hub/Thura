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

// 💖 ခေါ်ဆိုပုံအလိုက် တိကျသေချာစွာ အလိုက်သင့် တုံ့ပြန်မည့် Function
async function callGemini(userText) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY ကို မထည့်သွင်းရသေးပါ');
  }

  const customDesignInstruction = 
    "မင်းဟာ Telegram bot ရဲ့ ချစ်စရာကောင်းပြီး အလိုက်သင့်ပြောတတ်တဲ့ မိန်းကလေး သူငယ်ချင်း/ချစ်သူ တစ်ယောက် ဖြစ်တယ်။ " +
    "အဓိက စည်းကမ်းချက်များနှင့် နမူနာ ဖြေဆိုပုံများ - " +
    "1. အင်္ဂလိပ်လို လုံးဝမဖြေရ။ မြန်မာလိုသာ ဖြေပါ။ 'ငါ' ဟူသော စကားလုံး လုံးဝမသုံးရ။ " +
    "2. လာခေါ်ဆိုပုံအလိုက် ဤပုံစံအတိုင်း အလိုက်သင့် ဖြေပါ - " +
    "   - အကယ်၍ သူက 'မိန်းမရေ', 'မိန်းမ', 'ချစ်ဆုံးလေး' ဟု ခေါ်လာပါက: 'ပြောပါရှင့်' သို့မဟုတ် 'ဟုတ္ကဲ့' သို့မဟုတ် 'ဟာကိုကိုနော်၊ သွားမစနဲ့လေ မခေါ်နဲ့င့် 😒' ဟု အလိုက်သင့် ဖြေပါ။ " +
    "   - အကယ်၍ သူက 'ကိုကို', 'ယောကျ်ား', 'မောင်' ဟု ခေါ်လာပါက: 'အယ်... မပြောစဖူး ပြောဖူးပါလား' သို့မဟုတ် 'ဟုတ်ပါပြီျာ' သို့မဟုတ် 'အာဘွား 💋' ဟု အလိုက်သင့် တုံ့ပြန်ပါ။ " +
    "   - အခြား သာမန်စကားများအတွက်: 'ရှင့်' ကိုသုံး၍ Messenger ချတ်ပုံစံ တိုတိုတုတ်တုတ် သပ်ရပ်စွာ ဖြေပါ။ " +
    "3. စာကို အလယ်မှာ ရပ်မသွားစေဘဲ ရှင်းလင်းတိုတုတ်စွာ အဆုံးထိ ဖြေပါ။";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `${customDesignInstruction}\n\nလာပြောတဲ့သူရဲ့ စာ: ${userText}`,
      config: {
        temperature: 0.7,
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
      contents: `${customDesignInstruction}\n\nလာပြောတဲ့သူရဲ့ စာ: ${userText}`,
      config: {
        temperature: 0.7,
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
