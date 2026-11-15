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

// 💬 Messenger ချတ်ပုံစံအတိုင်း အလိုက်သင့် ချစ်စရာကောင်းစွာ ဖြေကြားမည့် Function
async function callGemini(userText) {
  if (!ai) {
    throw new Error('GEMINI_API_KEY ကို မထည့်သွင်းရသေးပါ');
  }

  const messengerStyleInstruction = 
    "မင်းဟာ Messenger ချတ်မှာ စကားပြောနေတဲ့ ချစ်စရာကောင်းတဲ့ မိန်းကလေး သူငယ်ချင်း/ချစ်သူ တစ်ယောက် ဖြစ်တယ်။ " +
    "အဓိက စည်းကမ်းချက်များ - " +
    "1. အင်္ဂလိပ်လို လုံးဝမဖြေရ။ မြန်မာလိုသာ ဖြေပါ။ '18+ဆိုလျှင် လမ်းမှန်ရောက်အောင်ပြောပေး' နှင့် 'ရိုင်းဆိုင်ခြင်းသိပ်မပြောနဲ' လိုက်နာပါ။ အမြဲတမ်း 'ချစ်စရာပုံစံ'သာ သုံးပါ။ 'ငါ' ဟူသော ကြမ်းတမ်းသည့် စကားလုံး များကိုအလိုက်သင့်ပြောရမည်။ " +
    "2. Messenger မှာ စာပို့သလိုမျိုး သဘာဝကျကျ၊ အပြန်အလှန် ရင်းနှီးဖော်ရွေပြီး လာပြောတဲ့ပုံစံအလိုက် အလိုက်သင့် တုံ့ပြန်ရမည် - " +
    "   - ဥပမာ (ကိုကို လို့ခေါ်လာလျှင်): 'ဗျာ... (သို့မဟုတ်) ပြောလေခလေးရဲ့၊ ဘာလုပ်နေလဲင့်။' 💕 " +
    "   - ဥပမာ (စနောက်လာလျှင်): 'ရှင့်... (သို့မဟုတ်) မသာရီး😒 မစနဲ့နော်။' 😏 " +
    "   - ဥပမာ (သာမန်မေးခွန်းများအတွက်): 'ရှင့်... (သို့မဟုတ်) အဲ့ဒါကိုလေ အေးဆေးလုပ်လို့ရပါတယ်ရှင့်။' 🌸 " +
    "3. စာကို အလယ်မှာ ရပ်မသွားစေဘဲ အဆုံးထိ ရှင်းလင်းတိုတုတ်စွာ ဖြေပါ။";

  const modelName = 'gemini-3.6-flash';

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `${messengerStyleInstruction}\n\nလာပြောတဲ့သူရဲ့ စာ: ${userText}`,
      config: {
        temperature: 0.7,
        maxOutputTokens: 300,
      }
    });

    const text = extractTextFromResponse(response);
    if (!text) throw new Error('AI မှ စာသားတုံ့ပြန်မှု မရရှိပါ');
    return text;
  } catch (err) {
    try {
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `${messengerStyleInstruction}\n\nလာပြောတဲ့သူရဲ့ စာ: ${userText}`
      });
      const text = extractTextFromResponse(fallbackResponse);
      if (text) return text;
    } catch (e) {}
    throw err;
  }
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
        textReply = "ရှင့်... ကိုကို့ကို အမြဲတမ်း သတိရနေတာပေါ့ရှင့်။ 💕";
      }
      
      const sentText = await ctx.reply(textReply, {
        reply_parameters: { message_id: ctx.message.message_id }
      });
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sentText.message_id);
    }
  }).catch(async (err) => {
    console.error("AI Error:", err.message);
    await ctx.reply("ရှင့်... ရုတ်တရက် အဆက်အသွယ်လေး ပြတ်သွားလို့ပါရှင့်... ခဏနေမှ ထပ်ပြောပြနော်။ 💕", {
      reply_parameters: { message_id: ctx.message.message_id }
    });
  });

  return true;
}

module.exports = { getAISettings, handleAIResponse };
