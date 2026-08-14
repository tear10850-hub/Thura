const { GoogleGenAI } = require('@google/genai');
const googleTTS = require('google-tts-api');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

const aiSettings = new Map(); // key: userId, value: { isOpen: boolean, mode: 'text' | 'voice', messageCount: number }

function getAISettings(userId) {
  if (!aiSettings.has(userId)) {
    aiSettings.set(userId, { isOpen: false, mode: 'text', messageCount: 0 });
  }
  return aiSettings.get(userId);
}

// AI ဖြင့် စာသား သို့မဟုတ် အသံထုတ်ပေးရန်
async function handleAIResponse(ctx, userText, replyOptions) {
  const userId = ctx.from.id;
  const settings = getAISettings(userId);

  if (!settings.isOpen || !ai) return false;

  try {
    const isDirectCommand = userText.startsWith('/ai');
    const cleanText = userText.replace('/ai', '').trim();

    settings.messageCount++;
    const shouldAIIntervene = (settings.messageCount % 4 === 0); // ၄ ကြိမ်တစ်ကြိမ် အလိုအလျောက် ဝင်ပြောမည်

    // တိုက်ရိုက် /ai ခိုင်းတာလည်း မဟုတ်၊ ပုံထုတ်ခိုင်းတာလည်း မဟုတ်၊ Auto ဝင်ပြောမယ့်အလှည့်လည်း မဟုတ်ရင် ကျော်သွားမည်
    const isImageRequest = cleanText.startsWith('ပုံထုတ်ပေး') || cleanText.startsWith('ပုံဆွဲ');
    if (!isDirectCommand && !isImageRequest && !shouldAIIntervene) {
      return false; 
    }

    const textToProcess = cleanText || userText;

    // ပုံထုတ်ခိုင်းခြင်း ဟုတ်မဟုတ် စစ်ဆေးရန်
    if (isImageRequest) {
      const imagePrompt = cleanText.replace(/^(ပုံထုတ်ပေးပါ|ပုံထုတ်ပေး|ပုံဆွဲပေးပါ|ပုံဆွဲပေး)/, '').trim();
      if (!imagePrompt) {
        const sent = await ctx.reply("⚠️ ကျေးဇူးပြု၍ ထုတ်လိုသည့် ပုံအကြောင်းအရာကို ဆက်ရေးပေးပါရှင်။ (ဥပမာ - `/ai ပပုံထုတ်ပေး နေဝင်ဆည်းဆာ`)", replyOptions);
        global.autoDeleteMessage(ctx, sent.message_id);
        return true;
      }

      await ctx.replyWithChatAction('upload_photo');
      const imageBuffer = await generateAIPicture(imagePrompt);

      if (imageBuffer) {
        const { InputFile } = require('grammy');
        const sentPhoto = await ctx.replyWithPhoto(new InputFile(imageBuffer), {
          caption: `🎨 "${imagePrompt}" အတွက် ထုတ်ပေးလိုက်သော ပုံပါရှင်။`,
          ...replyOptions
        });
        global.autoDeleteMessage(ctx, sentPhoto.message_id);
        return true;
      }
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `မင်းဟာ ဒီ Telegram bot ရဲ့ ချစ်စရာ မိန်းကလေး AI ဖြစ်တယ်။ စကားပြောတဲ့အခါ အရှည်ကြီး မပြောဘဲ အဓိပ္ပာယ်ရှိရှိ၊ တိုတိုတုတ်တုတ်နဲ့ ချိုသာစွာ ဖြေပါ။ အခုသူပြောတာက: ${textToProcess}`
    });

    if (response && response.text) {
      const textReply = response.text.trim();

      if (settings.mode === 'voice') {
        const audioUrl = googleTTS.getAudioUrl(textReply, {
          lang: 'en',
          slow: false,
          host: 'https://translate.google.com',
        });

        await ctx.replyWithChatAction('record_voice');
        const sentVoice = await ctx.replyWithAudio(audioUrl, {
          caption: `🎙️ "${textReply}"`,
          ...replyOptions
        });
        global.autoDeleteMessage(ctx, sentVoice.message_id);
      } else {
        await ctx.replyWithChatAction('typing');
        const sentText = await ctx.reply(textReply, replyOptions);
        global.autoDeleteMessage(ctx, sentText.message_id);
      }
      return true;
    }
  } catch (err) {
    console.error("AI Module Error:", err.message);
  }
  return false;
}

// ပုံထုတ်ပေးရန် (Imagen Model)
async function generateAIPicture(promptText) {
  if (!ai) return null;
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: promptText,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
      },
    });

    if (response && response.generatedImages && response.generatedImages.length > 0) {
      const base64Image = response.generatedImages[0].image.imageBytes;
      return Buffer.from(base64Image, 'base64');
    }
  } catch (err) {
    console.error("Image Generation Error:", err.message);
  }
  return null;
}

module.exports = { getAISettings, handleAIResponse };
