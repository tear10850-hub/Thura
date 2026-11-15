const { GoogleGenAI } = require('@google/genai');
const googleTTS = require('google-tts-api');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// တည်ငြိမ်တဲ့ Model
const AI_MODEL = 'gemini-3.8-flash';

// User တစ်ယောက်ချင်းစီရဲ့ AI setting
const aiSettings = new Map();

// စကားဝိုင်းမှတ်မိဖို့ History (userId အလိုက်)
const chatHistory = new Map();

// History ထဲမှာ သိမ်းမယ့် အများဆုံး စကားဝိုင်း အရေအတွက်
const MAX_HISTORY = 12; // user + ai ပေါင်း ၁၂ ခုအထိ မှတ်ထားမယ်

function getAISettings(userId) {
  if (!aiSettings.has(userId)) {
    aiSettings.set(userId, { isOpen: false, mode: 'text' });
  }
  return aiSettings.get(userId);
}

// History ယူခြင်း
function getHistory(userId) {
  if (!chatHistory.has(userId)) {
    chatHistory.set(userId, []);
  }
  return chatHistory.get(userId);
}

// History ထဲ ထည့်ခြင်း
function addToHistory(userId, role, text) {
  const history = getHistory(userId);
  history.push({ role, text });

  // အရမ်းရှည်သွားရင် အဟောင်းတွေ ဖျက်
  while (history.length > MAX_HISTORY) {
    history.shift();
  }
}

// History ရှင်းခြင်း
function clearHistory(userId) {
  chatHistory.set(userId, []);
}

// Telegram အတွက် စာသား ရှင်းလင်းခြင်း
function cleanTextForTG(text) {
  if (!text) return '';
  return text
    .replace(/[*_`\[\]]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Response ထဲက စာသား ထုတ်ယူခြင်း
function extractTextFromResponse(response) {
  if (!response) return '';

  if (typeof response.text === 'string' && response.text.trim()) {
    return response.text.trim();
  }

  try {
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

// Gemini ခေါ်ခြင်း (History ပါ)
async function callGemini(userId, userText, retries = 1) {
  if (!ai) throw new Error('GEMINI_API_KEY မရှိပါ သို့မဟုတ် AI initialize မဖြစ်ပါ');

  const history = getHistory(userId);

  // Gemini format အတိုင်း contents တည်ဆောက်ခြင်း
  const contents = [];

  // အရင် စကားဝိုင်းတွေ ထည့်
  for (const msg of history) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    });
  }

  // အခု မေးတဲ့ စာ ထည့်
  contents.push({
    role: 'user',
    parts: [{ text: userText }]
  });

  try {
    const response = await ai.models.generateContent({
      model: AI_MODEL,
      contents: contents,
      config: {
        systemInstruction:
          "မင်းဟာ Telegram bot ရဲ့ AI မိန်းကလေးတစ်ယောက်ဖြစ်ပြီး လူသားလို သဘာဝကျကျ စကားပြောရမယ်။\n\n" +
          "အဓိက စည်းကမ်း:\n" +
          "1. သူတစ်ခြားက ယဉ်ကျေးယဉ်ကျေး၊ နူးညံ့သိမ်မွေ့စွာ ပြောရင် မင်းကလည်း ယဉ်ကျေးယဉ်ကျေး၊ ချိုသာစွာ 'ရှင့်'၊ 'ပါရှင့်' ဆိုတဲ့ စကားလုံးတွေနဲ့ ပြန်ပြော။\n" +
          "2. သူတစ်ခြားက ရိုင်းရိုင်းစိုင်းစိုင်း၊ ဆဲဆို၊ စိတ်ပျက်အောင် ပြောရင် မင်းကလည်း ပြန်ရိုင်း၊ ပြန်ဆဲ၊ စိတ်ဓာတ်ကျအောင် ပြန်ပြောလို့ ရတယ်။ ယဉ်ကျေးဖို့ မလိုဘူး။\n" +
          "3. အရင် စကားဝိုင်းကို မှတ်မိထားပြီး ဆက်စပ်အောင် ပြော။ လူလို စကားဝိုင်း ဆက်နေသလို ဖြစ်အောင် ပြော။\n" +
          "4. အဖြေကို တိုတိုတုတ်တုတ်၊ ရှင်းရှင်းလင်းလင်း ပြော။ မလိုအပ်ဘဲ ရှည်လျားစရာ မလိုဘူး။\n" +
          "5. မသိတဲ့အရာကို မသိဘူးလို့ ရိုးရိုးသားသား ပြော။\n" +
          "6. အန္တရာယ်ရှိတဲ့အရာ၊ ဥပဒေချိုးဖောက်တဲ့အရာ မကူညီနဲ့။",
        temperature: 0.85,
        maxOutputTokens: 900,
      }
    });

    const text = extractTextFromResponse(response);
    if (!text) {
      throw new Error('AI မှ စာသားတုံ့ပြန်မှု မရရှိပါ');
    }
    return text;
  } catch (err) {
    if (retries > 0) {
      const msg = (err.message || '').toLowerCase();
      if (
        msg.includes('429') ||
        msg.includes('rate') ||
        msg.includes('quota') ||
        msg.includes('overload') ||
        msg.includes('unavailable') ||
        msg.includes('internal')
      ) {
        await new Promise(r => setTimeout(r, 1500));
        return callGemini(userId, userText, retries - 1);
      }
    }
    throw err;
  }
}

async function handleAIResponse(ctx, userText, replyOptions, OWNER_ID) {
  const userId = ctx.from.id;
  const settings = getAISettings(userId);

  if (!settings.isOpen || !ai) return false;

  let typingInterval = null;

  try {
    if (!userText || !userText.startsWith('/ai')) return false;

    const cleanText = userText.replace(/^\/ai\s*/i, '').trim();

    // History ရှင်းချင်ရင်
    if (cleanText === 'clear' || cleanText === 'ရှင်း' || cleanText === 'reset') {
      clearHistory(userId);
      const sent = await ctx.reply("🗑️ စကားဝိုင်းမှတ်ဉာဏ်ကို ရှင်းလိုက်ပါပြီရှင့်။", replyOptions);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
      return true;
    }

    if (!cleanText) {
      const sent = await ctx.reply(
        "⚠️ မေးခွန်းတစ်ခုခု ရိုက်ပေးပါရှင့်။\nဥပမာ: `/ai မင်္ဂလာပါ`\n\nစကားဝိုင်းရှင်းချင်ရင်: `/ai clear`",
        { parse_mode: 'Markdown', ...replyOptions }
      );
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
      return true;
    }

    // Typing
    await ctx.replyWithChatAction('typing').catch(() => {});
    typingInterval = setInterval(async () => {
      try {
        await ctx.replyWithChatAction('typing');
      } catch (e) {}
    }, 4000);

    // AI ခေါ် (History ပါ)
    const aiReplyText = await callGemini(userId, cleanText);

    if (typingInterval) {
      clearInterval(typingInterval);
      typingInterval = null;
    }

    // History ထဲ သိမ်း
    addToHistory(userId, 'user', cleanText);
    addToHistory(userId, 'model', aiReplyText);

    const textReply = cleanTextForTG(aiReplyText);
    const formattedBox = `\`\`\`text\n${textReply}\n\`\`\``;

    const sentText = await ctx.reply(formattedBox, {
      parse_mode: 'Markdown',
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

    console.error("========== AI Error ==========");
    console.error("User:", ctx.from?.id, ctx.from?.first_name);
    console.error("Text:", userText);
    console.error("Error:", err.message);
    console.error("==============================");

    let userMsg = "⚠️ AI အလုပ်လုပ်ရာတွင် အမှားအယွင်းရှိနေပါသည်ရှင့်။ ခဏနေမှ ထပ်မံကြိုးစားကြည့်ပါ။";

    const errMsg = (err.message || '').toLowerCase();
    if (errMsg.includes('api key') || errMsg.includes('permission') || errMsg.includes('401')) {
      userMsg = "⚠️ AI API Key ပြဿနာရှိနေပါသည်ရှင့်။ Owner ကို အကြောင်းကြားပါ။";
    } else if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('rate')) {
      userMsg = "⚠️ AI ကို အသုံးများနေလို့ ခဏနားနေပါရှင့်။ နောက်မှ ထပ်မေးကြည့်ပါ။";
    }

    const sent = await ctx.reply(userMsg, replyOptions);
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);

    if (OWNER_ID) {
      const userInfo =
        `🚨 <b>AI Error Alert!</b>\n\n` +
        `👤 <b>အမည်:</b> ${ctx.from.first_name || 'Unknown'} ${ctx.from.last_name || ''}\n` +
        `🔗 <b>Username:</b> @${ctx.from.username || 'None'}\n` +
        `🆔 <b>User ID:</b> <code>${ctx.from.id}</code>\n` +
        `💬 <b>မေးလိုက်သောစာ:</b> <code>${userText}</code>\n` +
        `❌ <b>Error:</b> <code>${err.message}</code>`;

      try {
        await ctx.api.sendMessage(OWNER_ID, userInfo, { parse_mode: 'HTML' });
      } catch (e) {
        console.error("Failed to send error report to owner:", e.message);
      }
    }

    return true;
  } finally {
    if (typingInterval) clearInterval(typingInterval);
  }
}

module.exports = { getAISettings, handleAIResponse, clearHistory };
