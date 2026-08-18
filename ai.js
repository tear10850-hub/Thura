const { GoogleGenAI } = require('@google/genai');
const googleTTS = require('google-tts-api');

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
  return text.replace(/[*_`\[\]]/g, '').trim();
}

async function handleAIResponse(ctx, userText, replyOptions) {
  const userId = ctx.from.id;
  const settings = getAISettings(userId);

  if (!settings.isOpen || !ai) return false;

  try {
    // /ai နဲ့ စတင်မှသာ အလုပ်လုပ်မည်
    if (!userText.startsWith('/ai')) return false;

    const cleanText = userText.replace('/ai', '').trim();
    if (!cleanText) {
      const sent = await ctx.reply("⚠️ မေးခွန်းတစ်ခုခု ရိုက်ပေးပါရှင်။ (ဥပမာ: /ai မင်္ဂလာပါ)", replyOptions);
      global.autoDeleteMessage(ctx, sent.message_id);
      return true;
    }

    // Typing Action ပေါ်နေစေရန် (စာရိုက်နေစဉ်)
    await ctx.replyWithChatAction('typing');
    const typingInterval = setInterval(async () => {
      await ctx.replyWithChatAction('typing');
    }, 4000);

    // Gemini 3.6 Flash သုံး၍ ဖြေကြားခြင်း
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `မင်းဟာ Telegram bot ရဲ့ AI ဖြစ်တယ်။ တိုတိုတုတ်တုတ်နဲ့ သပ်သပ်ရပ်ရပ် ဖြေပါ။ အခုသူပြောတာက: ${cleanText}`
    });

    clearInterval(typingInterval); // စာရိုက်နေသည့် Action ကို ရပ်ခြင်း

    if (response && response.text) {
      const textReply = cleanTextForTG(response.text);
      
      // Copy ကူးရလွယ်သည့် Code Block ပုံစံ
      const formattedBox = `\`\`\`text\n${textReply}\n\`\`\``;
      const sentText = await ctx.reply(formattedBox, { parse_mode: 'Markdown', ...replyOptions });
      global.autoDeleteMessage(ctx, sentText.message_id);
      return true;
    }
  } catch (err) {
    console.error("AI Error:", err.message);
    await ctx.reply("⚠️ AI အလုပ်လုပ်ရာတွင် အမှားအယွင်းရှိနေပါသည်။");
  }
  return false;
}

module.exports = { getAISettings, handleAIResponse };
