const fetch = require('node-fetch'); // လိုအပ်ပါက သုံးရန် (သို့မဟုတ် ရှင့် project ထဲမှာ ရှိပြီးသားဆိုရင် ရပါတယ်)

const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
let currentKeyIndex = 0;

function getNextApiKey() {
  if (apiKeys.length === 0) return null;
  const key = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  return key;
}

const aiSettings = new Map();
const userCooldowns = new Map();

function getAISettings(userId) {
  if (!aiSettings.has(userId)) {
    aiSettings.set(userId, { isOpen: false, mode: 'text' });
  }
  return aiSettings.get(userId);
}

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

// 🌐 AQ Key များအတွက် Direct Fetch ဖြင့် Gemini API ကို ချိတ်ဆက်မည့် Function
async function callGeminiDirect(userText) {
  if (apiKeys.length === 0) {
    throw new Error('API Keys မရှိပါ');
  }

  const customDesignInstruction = 
    "မင်းဟာ Telegram bot ရဲ့ ချစ်စရာကောင်းပြီး အလိုက်သင့်ပြောတတ်တဲ့ မိန်းကလေး သူငယ်ချင်း/ချစ်သူ တစ်ယောက် ဖြစ်တယ်။ " +
    "အဓိက စည်းကမ်းချက်များ - " +
    "1. အင်္ဂလိပ်လို လုံးဝမဖြေရ။ မြန်မာလိုသာ ဖြေပါ။ 'ငါ' ဟူသော စကားလုံး လုံးဝမသုံးရ။ " +
    "2. လာပြောတဲ့သူရဲ့ ပုံစံအလိုက် အလိုက်သင့် တုံ့ပြန်ပါ။ " +
    "3. အခြား သာမန်စကားများအတွက် 'ရှင့်' ကိုသုံး၍ Messenger ချတ်ပုံစံ တိုတိုတုတ်တုတ် သပ်ရပ်စွာ ဖြေပါ။";

  const prompt = `${customDesignInstruction}\n\nလာပြောတဲ့သူရဲ့ စာ: ${userText}`;

  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = getNextApiKey();
    try {
      // ပေးထားသော AQ Key ပုံစံအတွက် သင့်လျော်သော Endpoint
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 250 }
        })
      });

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text.trim();
    } catch (err) {
      console.warn(`Key ${i + 1} Error, trying next...`, err.message);
    }
  }

  throw new Error('API Key အားလုံး အလုပ်မလုပ်ပါ');
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

  const quickReply = getQuickReply(cleanText);
  if (quickReply) {
    const sent = await ctx.reply(quickReply, {
      reply_parameters: { message_id: ctx.message.message_id }
    });
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    return true;
  }

  const now = Date.now();
  const lastTime = userCooldowns.get(userId) || 0;
  if (now - lastTime < 2000) {
    return true;
  }
  userCooldowns.set(userId, now);

  ctx.replyWithChatAction('typing').catch(() => {});

  callGeminiDirect(cleanText).then(async (replyText) => {
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
