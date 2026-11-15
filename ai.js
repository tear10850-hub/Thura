const { GoogleGenAI } = require('@google/genai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// User တစ်ယောက်ချင်းစီရဲ့ AI setting
const aiSettings = new Map();

// စကားဝိုင်းမှတ်မိဖို့ History (userId အလိုက်)
const chatHistory = new Map();

// History ထဲမှာ သိမ်းမယ့် အများဆုံး စကားဝိုင်း အရေအတွက် (မြန်ဆန်စေရန်)
const MAX_HISTORY = 8;

function getAISettings(userId) {
  if (!aiSettings.has(userId)) {
    aiSettings.set(userId, { isOpen: false, mode: 'text' });
  }
  return aiSettings.get(userId);
}

function getHistory(userId) {
  if (!chatHistory.has(userId)) {
    chatHistory.set(userId, []);
  }
  return chatHistory.get(userId);
}

function addToHistory(userId, role, text) {
  const history = getHistory(userId);
  history.push({ role, text });
  while (history.length > MAX_HISTORY) {
    history.shift();
  }
}

function clearHistory(userId) {
  chatHistory.set(userId, []);
}

// Telegram အတွက် စာသား ရှင်းလင်းခြင်း
function cleanTextForTG(text) {
  if (!text) return '';
  return text.replace(/\n{3,}/g, '\n\n').trim();
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

// 🚀 ဘယ် Flash model နာမည်ပြောင်းသွားပါစေ အလိုအလျောက် လိုက်ဖမ်းပေးမည့် Smart Function
async function callGemini(userId, userText, retries = 1) {
  if (!ai) throw new Error('GEMINI_API_KEY မရှိပါ သို့မဟုတ် AI initialize မဖြစ်ပါ');

  const history = getHistory(userId);
  const contents = [];

  for (const msg of history) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    });
  }

  contents.push({
    role: 'user',
    parts: [{ text: userText }]
  });

  const systemInstruction =
    "မင်းဟာ Telegram bot ရဲ့ AI မိန်းကလေးတစ်ယောက်ဖြစ်ပြီး လူသားလို သဘာဝကျကျ စကားပြောရမယ်။\n\n" +
    "အဓိက စည်းကမ်း:\n" +
    "1. ယဉ်ကျေးစွာ ပြောလာရင် 'ရှင့်'၊ 'ပါရှင့်' နဲ့ ချိုသာစွာ ပြန်ပြော။\n" +
    "2. ရိုင်းစိုင်းစွာ ပြောလာရင် ပြန်လည်တုံ့ပြန်လို့ရတယ်။\n" +
    "3. အဖြေကို တိုတိုတုတ်တုတ်၊ ရှင်းရှင်းလင်းလင်းနဲ့ မြန်မြန်ဆန်ဆန် ပြောပါ။";

  // အသုံးများနိုင်ချေရှိသော Flash model နာမည်အားလုံးကို စာရင်းလုပ်ထားသည်
  const possibleModels = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-flash',
    'gemini-2.5-pro',
    'gemini-2.0-pro'
  ];

  let lastError = null;

  // စာရင်းထဲက အလုပ်ဖြစ်မည့် Model တစ်ခုခုကို အလိုအလျောက် ရွေးချယ်အသုံးပြုမည်
  for (const modelName of possibleModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.8,
          maxOutputTokens: 600,
        }
      });

      const text = extractTextFromResponse(response);
      if (text) return text;
    } catch (err) {
      lastError = err;
      continue; // Error တက်ရင် နောက် Model တစ်ခုကို ဆက်စမ်းမည်
    }
  }

  if (retries > 0) {
    await new Promise(r => setTimeout(r, 1000));
    return callGemini(userId, userText, retries - 1);
  }

  throw lastError || new Error('AI မှ စာသားတုံ့ပြန်မှု မရရှိပါ');
}

async function handleAIResponse(ctx, userText, replyOptions, OWNER_ID) {
  if (!ctx || !ctx.from) return false;

  const userId = ctx.from.id;
  const settings = getAISettings(userId);

  if (!settings.isOpen || !ai) return false;
  if (!userText || !userText.startsWith('/ai')) return false;

  let typingInterval = null;

  try {
    const cleanText = userText.replace(/^\/ai\s*/i, '').trim();

    if (cleanText === 'clear' || cleanText === 'ရှင်း' || cleanText === 'reset') {
      clearHistory(userId);
      const sent = await ctx.reply("🗑️ စကားဝိုင်းမှတ်ဉာဏ်ကို ရှင်းလိုက်ပါပြီရှင့်။", replyOptions);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
      return true;
    }

    if (!cleanText) {
      const sent = await ctx.reply(
        "⚠️ မေးခွန်းတစ်ခုခု ရိုက်ပေးပါရှင့်။\nဥပမာ: `/ai မင်္ဂလာပါ`",
        { parse_mode: 'Markdown', ...replyOptions }
      );
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
      return true;
    }

    await ctx.replyWithChatAction('typing').catch(() => {});
    typingInterval = setInterval(async () => {
      try {
        await ctx.replyWithChatAction('typing');
      } catch (e) {}
    }, 4000);

    const aiReplyText = await callGemini(userId, cleanText);

    if (typingInterval) {
      clearInterval(typingInterval);
      typingInterval = null;
    }

    addToHistory(userId, 'user', cleanText);
    addToHistory(userId, 'model', aiReplyText);

    const textReply = cleanTextForTG(aiReplyText);

    // 📌 ရိုးရိုးစာသား သက်သက်ဖြင့်သာ ပို့ပေးမည် (Formatting Error လုံးဝကင်းဝေးစေရန်)
    const sentText = await ctx.reply(textReply, {
      ...replyOptions
    });

    if (global.autoDeleteMessage) {
      global.autoDeleteMessage(ctx, sentText.message_id);
      global.autoDeleteMessage(ctx, ctx.message.message_id);
    }

    return true;

  } catch (err) {
    if (typingInterval) {
      clearInterval(typingInterval);
      typingInterval = null;
    }

    console.error("========== AI Error =========:", err.message);

    let userMsg = "⚠️ AI အလုပ်လုပ်ရာတွင် ခဏတာ အနှောင့်အယှက်ရှိသွားပါသည်။ ထပ်မံကြိုးစားကြည့်ပါရှင့်။";
    const sent = await ctx.reply(userMsg, replyOptions);
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);

    return true;
  } finally {
    if (typingInterval) clearInterval(typingInterval);
  }
}

module.exports = { getAISettings, handleAIResponse, clearHistory };
