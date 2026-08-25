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

async function handleAIResponse(ctx, userText, replyOptions, OWNER_ID) {
  const userId = ctx.from.id;
  const settings = getAISettings(userId);

  if (!settings.isOpen || !ai) return false;

  let typingInterval = null;

  try {
    // /ai နဲ့ စတင်မှသာ အလုပ်လုပ်မည်
    if (!userText.startsWith('/ai')) return false;

    const cleanText = userText.replace('/ai', '').trim();
    if (!cleanText) {
      const sent = await ctx.reply("⚠️ မေးခွန်းတစ်ခုခု ရိုက်ပေးပါရှင့်။ (ဥပမာ: /ai မင်္ဂလာပါ)", replyOptions);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
      return true;
    }

    // Typing Action ပေါ်နေစေရန် (စာရိုက်နေစဉ်)
    await ctx.replyWithChatAction('typing').catch(() => {});
    typingInterval = setInterval(async () => {
      try {
        await ctx.replyWithChatAction('typing');
      } catch (e) {}
    }, 4000);

    // gemini-3.6-flash သုံး၍ မိန်းကလေးလေသံ လူတစ်ယောက်လို ပုံစံဖြင့် ဖြေကြားခြင်း
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: `မင်းဟာ Telegram bot ရဲ့ AI ဖြစ်ပြီး အပြင်မှာရှိတဲ့ အသက်ဝင်တဲ့ မိန်းကလေးလူသားတစ်ယောက်လို စကားပြောရမယ်။ စကားပြောတဲ့အခါ တိုတိုတုတ်တုတ်နဲ့ သပ်သပ်ရပ်ရပ်ဖြေပြီး 'ရှင့်'၊ 'ပါရှင့်' စတဲ့ အဆုံးသတ်လေးတွေနဲ့ သဘာဝကျကျ ရင်ခုန်စရာကောင်းအောင် ပြောဆိုပေးပါ။ အခုသူပြောတာက: ${cleanText}`
    });

    if (typingInterval) clearInterval(typingInterval); // စာရိုက်နေသည့် Action ကို ရပ်ခြင်း

    if (response && response.text) {
      const textReply = cleanTextForTG(response.text);
      
      // Copy ကူးရလွယ်သည့် Code Block ပုံစံ
      const formattedBox = `\`\`\`text\n${textReply}\n\`\`\``;
      const sentText = await ctx.reply(formattedBox, { parse_mode: 'Markdown', ...replyOptions });
      
      if (global.autoDeleteMessage) {
        global.autoDeleteMessage(ctx, sentText.message_id);
        global.autoDeleteMessage(ctx, ctx.message.message_id);
      }
      return true;
    }
  } catch (err) {
    // 🛑 Error တက်ပါက typing action ကို သေချာပေါက် ရပ်မည်
    if (typingInterval) clearInterval(typingInterval);

    console.error("AI Error:", err.message);

    // 👤 မေးတဲ့သူကို စာပြန်ပြရန်
    const sent = await ctx.reply("⚠️ AI အလုပ်လုပ်ရာတွင် အမှားအယွင်းရှိနေပါသည်ရှင့်။ Owner ဆီသို့ အကြောင်းကြားပြီးပါပြီ။", replyOptions);
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);

    // 👑 Owner ဆီသို့ Error အချက်အလက်များနှင့် မေးသူ၏အချက်အလက်များကို ပို့ပေးခြင်း
    if (OWNER_ID) {
      const userInfo = `🚨 <b>AI Error Alert!</b>\n\n` +
                       `👤 <b>အမည်:</b> ${ctx.from.first_name || 'Unknown'} ${ctx.from.last_name || ''}\n` +
                       `🔗 <b>Username:</b> @${ctx.from.username || 'None'}\n` +
                       `🆔 <b>User ID:</b> <code>${ctx.from.id}</code>\n` +
                       `💬 <b>မေးလိုက်သောစာ:</b> ${userText}\n` +
                       `❌ <b>Error အကြောင်းရင်း:</b> <code>${err.message}</code>`;
      try {
        await ctx.api.sendMessage(OWNER_ID, userInfo, { parse_mode: 'HTML' });
      } catch (e) {
        console.error("Failed to send error report to owner:", e.message);
      }
    }

    return true;
  } finally {
    // ထပ်မံလုံခြုံစေရန် typing interval ကို သေချာ ရှင်းလင်းခြင်း
    if (typingInterval) clearInterval(typingInterval);
  }
  return false;
}

module.exports = { getAISettings, handleAIResponse };
