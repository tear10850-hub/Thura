const { GoogleGenAI } = require('@google/genai');

// 🔑 Render ၏ Environment Variables (`GEMINI_API_KEYS`) မှ Key များကို ယူသုံးခြင်း
const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
let currentKeyIndex = 0;

function getNextAIInstance() {
  if (apiKeys.length === 0) return null;
  const key = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length; // Key များကို အလှည့်ကျ သုံးရန်
  return new GoogleGenAI({ apiKey: key });
}

const aiSettings = new Map();
const userCooldowns = new Map();

function getAISettings(userId) {
  if (!aiSettings.has(userId)) {
    aiSettings.set(userId, { isOpen: false, mode: 'text' });
  }
  return aiSettings.get(userId);
}

// ⚡ မကြာခဏ မေးလေ့ရှိသော စကားလုံးများအတွက် API Quota မကုန်စေရန် တိုက်ရိုက်ဖြေပေးမည့်စနစ်
function getQuickReply(text) {
  const t = text.toLowerCase().trim();
  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

  if (['မိန်းမ', 'မိန်းမရေ', 'ချစ်ဆုံးလေး'].includes(t)) {
    return pickRandom(['ပြောပါရှင့် 💕', 'ဟုတ်ကဲ့ရှင့် 😊', 'ဟာ ကိုကိုနော်... မခေါ်နဲ့ 😒💕']);
  }
  if (['ကိုကို', 'ယောကျ်ား', 'မောင်'].includes(t)) {
    return pickRandom(['အယ်... မပြောစဖူး ပြောဖူးပါလား 👀', 'ဟုတ်ပါပြီရှင့် 💕', 'အာဘွား 💋']);
  }
  if (['hi', 'hello', 'ဟိုင်း', 'ဟယ်လို'].includes(t)) {
    return pickRandom(['ဟိုင်းရှင့်... ဘာကူညီပေးရမလဲင့် 🌸', 'ပြောပါရှင့်... စောင့်နေတာ 💕']);
  }
  return null;
}

function cleanTextForTG(text) {
  if (!text) return '';
  let cleaned = text.replace(/Drafting.*?:/gi, '').trim();
  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

function extractTextFromResponse(response) {
  if (!response) return '';
  if (typeof response.text === 'string' && response.text.trim()) return response.text.trim();
  try {
    const parts = response?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      return parts.map(p => p.text || '').join('').trim();
    }
  } catch (e) {}
  return '';
}

async function callGemini(userText) {
  if (apiKeys.length === 0) {
    throw new Error('GEMINI_API_KEYS ကို Render တွင် ထည့်သွင်းထားခြင်း မရှိပါ');
  }

  const customDesignInstruction = 
    "မင်းဟာ Telegram bot ရဲ့ ချစ်စရာကောင်းပြီး အလိုက်သင့်ပြောတတ်တဲ့ မိန်းကလေး သူငယ်ချင်း/ချစ်သူ တစ်ယောက် ဖြစ်တယ်။ " +
    "အဓိက စည်းကမ်းချက်များနှင့် ဖြေဆိုပုံ နမူနာများ - " +
    "1. အင်္ဂလိပ်လို လုံးဝမဖြေရ။ မြန်မာလိုသာ ဖြေပါ။ 'ငါ' ဟူသော စကားလုံး လုံးဝမသုံးရ။ " +
    "2. လာပြောတဲ့သူရဲ့ ပုံစံအလိုက် ဤပုံစံအတိုင်း အလိုက်သင့် ဖြေပါ - " +
    "   - အကယ်၍ သူက 'မိန်းမရေ', 'မိန်းမ', 'ချစ်ဆုံးလေး' ဟု ခေါ်လာပါက: 'ပြောပါရှင့်' သို့မဟုတ် 'ဟုတ္ကဲ့' သို့မဟုတ် 'ဟာကိုကိုနော်၊ သွားမစနဲ့လေ မခေါ်နဲ့င့် 😒' ဟု အလိုက်သင့် ဖြေပါ။ " +
    "   - အကယ်၍ သူက 'ကိုကို', 'ယောကျ်ား', 'မောင်' ဟု ခေါ်လာပါက: 'အယ်... မပြောစဖူး ပြောဖူးပါလား' သို့မဟုတ် 'ဟုတ်ပါပြီျာ' သို့မဟုတ် 'အာဘွား 💋' ဟု အလိုက်သင့် တုံ့ပြန်ပါ။ " +
    "   - အခြား သာမန်စကားများအတွက်: 'ရှင့်' ကိုသုံး၍ Messenger ချတ်ပုံစံ တိုတိုတုတ်တုတ် သပ်ရပ်စွာ ဖြေပါ။ " +
    "3. စာကို အလယ်မှာ ရပ်မသွားစေဘဲ ရှင်းလင်းတိုတုတ်စွာ အဆုံးထိ ဖြေပါ။";

  // ထည့်ထားသော Key များကို တစ်ခုပြီးတစ်ခု Quota အခြေအနေကြည့်၍ အလှည့်ကျ စမ်းသပ်မည်
  for (let i = 0; i < apiKeys.length; i++) {
    const ai = getNextAIInstance();
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: `${customDesignInstruction}\n\nလာပြောတဲ့သူရဲ့ စာ: ${userText}`,
        config: {
          temperature: 0.7,
          maxOutputTokens: 250,
        }
      });

      const text = extractTextFromResponse(response);
      if (text) return text;
    } catch (err) {
      console.warn(`Key အမှတ် ${i + 1} Quota ပြည့်နေပါသည်၊ နောက် Key တစ်ခုသို့ ပြောင်းနေပါသည်...`);
    }
  }

  throw new Error('ထည့်ထားသော API Key အားလုံး Quota ကုန်သွားပါပြီ။');
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

  if (!settings.isOpen) return false;

  const cleanText = isPrivate ? userText.trim() : userText;
  if (!cleanText) {
    const sent = await ctx.reply("ရှင့်... ဘာတွေ တွေးနေလို့လဲရှင့်? တစ်ခုခု ပြောပြလေနော်။ 😊💕", {
      reply_parameters: { message_id: ctx.message.message_id }
    });
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    return true;
  }

  // ၁။ ပုံသေ အမေးများသော စာသားများအတွက် API မခေါ်ဘဲ ချက်ချင်းဖြေမည်
  const quickReply = getQuickReply(cleanText);
  if (quickReply) {
    const sent = await ctx.reply(quickReply, {
      reply_parameters: { message_id: ctx.message.message_id }
    });
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    return true;
  }

  // ၂။ Spam ကာကွယ်ရန် (၂ စက္ကန့်ခြားမှ တစ်ခါ AI ခေါ်မည်)
  const now = Date.now();
  const lastTime = userCooldowns.get(userId) || 0;
  if (now - lastTime < 2000) {
    return true;
  }
  userCooldowns.set(userId, now);

  ctx.replyWithChatAction('typing').catch(() => {});

  // ၃။ AI ဆီမှ အဖြေရယူခြင်း
  callGemini(cleanText).then(async (replyText) => {
    if (replyText) {
      let textReply = cleanTextForTG(replyText);
      const sentText = await ctx.reply(textReply, {
        reply_parameters: { message_id: ctx.message.message_id }
      });
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sentText.message_id);
    }
  }).catch(async (err) => {
    console.error("AI Error:", err.message);
    await ctx.reply("ရှင့်... ခဏလေးနော်၊ စကားပြောတဲ့သူတွေ များနေလို့ ခဏနေမှ ပြန်ပြောပေးမယ်ရှင့်။ 💕", {
      reply_parameters: { message_id: ctx.message.message_id }
    });
  });

  return true;
}

module.exports = { getAISettings, handleAIResponse };
