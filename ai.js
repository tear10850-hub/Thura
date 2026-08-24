const { GoogleGenAI } = require('@google/genai');
const googleTTS = require('google-tts-api');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const aiSettings = new Map();

function getAISettings(userId) {
  if (!aiSettings.has(userId)) {
    aiSettings.set(userId, { isOpen: false, mode: 'aiopen' }); // Default အနေဖြင့် aiopen ကို သုံးမည်
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
  const isPrivate = ctx.chat.type === 'private';

  if (!settings.isOpen || !ai) return false;

  // ၁။ Group ထဲတွင်ဆိုလျှင် /ai ပါမှသာ အလုပ်လုပ်မည်
  if (!isPrivate) {
    if (!userText.startsWith('/ai')) return false;
  } 
  // ၂။ Bot Chat (Private) ထဲတွင်ဆိုလျှင်
  else {
    // /aiopen ဖြစ်နေလျှင် /ai ပါမှ ဖြေမည် (မပါရင် false ပြန်ပေးပြီး ကျပန်းစာပြန်ခွင့်ပေးမည်)
    if (settings.mode === 'aiopen' && !userText.startsWith('/ai')) return false;
    // /aino ဖြစ်နေလျှင် /ai မပါလည်း ဖြေပေးမည်
  }

  let typingInterval = null;

  try {
    const cleanText = userText.startsWith('/ai') ? userText.replace('/ai', '').trim() : userText.trim();
    if (!cleanText) {
      if (userText.startsWith('/ai')) {
        const sent = await ctx.reply("⚠️ မေးခွန်းတစ်ခုခု ရိုက်ပေးပါရှင်။ (ဥပမာ: /ai မင်္ဂလာပါ)", replyOptions);
        if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
        return true;
      }
      return false;
    }

    // Typing Action ပေါ်နေစေရန် (စာရိုက်နေစဉ်)
    await ctx.replyWithChatAction('typing').catch(() => {});
    typingInterval = setInterval(async () => {
      try {
        await ctx.replyWithChatAction('typing');
      } catch (e) {}
    }, 4000);

    // Gemini မော်ဒယ်ဖြင့် ဖြေကြားခြင်း (model နာမည်ကို လိုသလို ချိန်နိုင်သည်)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `မင်းဟာ Telegram bot ရဲ့ AI ဖြစ်တယ်။ တိုတိုတုတ်တုတ်နဲ့ သပ်သပ်ရပ်ရပ် ဖြေပါ။ အခုသူပြောတာက: ${cleanText}`
    });

    if (typingInterval) clearInterval(typingInterval); // စာရိုက်နေသည့် Action ကို ရပ်ခြင်း

    if (response && response.text) {
      const textReply = cleanTextForTG(response.text);
      
      // Copy ကူးရလွယ်သည့် Code Block ပုံစံ
      const formattedBox = `\`\`\`text\n${textReply}\n\`\`\``;
      const sentText = await ctx.reply(formattedBox, { parse_mode: 'Markdown', ...replyOptions });
      
      if (global.autoDeleteMessage) {
        global.autoDeleteMessage(ctx, sentText.message_id);
      }
      return true;
    } else {
      // အဖြေမထွက်လာခဲ့လျှင် Typing ရပ်ပြီး Owner ဆီ Report ပို့မည်
      if (typingInterval) clearInterval(typingInterval);
      await ctx.reply("⚠️ AI ထံမှ အဖြေထုတ်၍ မရပါ။ ခဏနေမှ ထပ်မံကြိုးစားပါ။", replyOptions);

      if (OWNER_ID) {
        const userInfo = `👤 <b>အသုံးပြုသူ အချက်အလက်:</b>\n- နာမည်: ${ctx.from.first_name || ''}\n- Username: @${ctx.from.username || 'မရှိ'}\n- ID: <code>${ctx.from.id}</code>\n\n❓ <b>မေးခွန်း:</b> ${cleanText}\n\n❌ <b>အကြောင်းရင်း:</b> AI Response Text မထွက်လာပါ။`;
        await ctx.api.sendMessage(OWNER_ID, userInfo, { parse_mode: 'HTML' }).catch(() => {});
      }
      return true;
    }
  } catch (err) {
    // Error တက်ပါက Typing ဆက်မနေစေရန် ချက်ချင်းရပ်မည်
    if (typingInterval) clearInterval(typingInterval);

    console.error("AI Error:", err.message);
    await ctx.reply("⚠️ AI အလုပ်လုပ်ရာတွင် အမှားအယွင်းရှိနေပါသည်။", replyOptions);

    // Error ဖြစ်ကြောင်း Owner ဆီသို့ အချက်အလက်များနှင့်တကွ ပို့မည်
    if (OWNER_ID) {
      const cleanText = userText.startsWith('/ai') ? userText.replace('/ai', '').trim() : userText.trim();
      const userInfo = `👤 <b>အသုံးပြုသူ အချက်အလက်:</b>\n- နာမည်: ${ctx.from.first_name || ''}\n- Username: @${ctx.from.username || 'မရှိ'}\n- ID: <code>${ctx.from.id}</code>\n\n❓ <b>မေးခွန်း:</b> ${cleanText || userText}\n\n🚨 <b>Error Message:</b> <code>${err.message}</code>`;
      await ctx.api.sendMessage(OWNER_ID, userInfo, { parse_mode: 'HTML' }).catch(() => {});
    }
  }
  return false;
}

module.exports = { getAISettings, handleAIResponse };
