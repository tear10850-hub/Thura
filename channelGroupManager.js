const { InlineKeyboard } = require('grammy');

// Group များတွင် Bot ပိတ်/ဖွင့် အခြေအနေကို သိမ်းဆည်းရန်
const disabledGroups = new Set();

// HTML အတွက် Special Characters များကို Escape လုပ်ပေးသည့် Function
function escapeHTML(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function setupChannelGroupModule(bot, OWNER_ID) {

  // ============================================================
  // 1. Group Bot အဖွင့်/အပိတ် Middleware
  // ============================================================
  bot.use(async (ctx, next) => {
    if (ctx.chat && ['group', 'supergroup'].includes(ctx.chat.type)) {
      if (disabledGroups.has(ctx.chat.id)) {
        if (ctx.message && ctx.message.text && ctx.message.text.trim().startsWith('/gpopen')) {
          return await next();
        }
        return; // Bot ပိတ်ထားပါက မတုံ့ပြန်ပါ
      }
    }
    return await next();
  });

  // ============================================================
  // 2. Group Bot အဖွင့်/အပိတ် Commands
  // ============================================================
  bot.command('gpopen', async (ctx) => {
    if (Number(ctx.from.id) !== Number(OWNER_ID)) return;
    if (ctx.chat.type === 'private') {
      return ctx.reply('⚠️ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။');
    }

    disabledGroups.delete(ctx.chat.id);
    const sent = await ctx.reply('🟢 ဤ Group အတွက် Bot စနစ်ကို ဖွင့်လိုက်ပါပြီရှင်။');
    setTimeout(() => ctx.api.deleteMessage(ctx.chat.id, sent.message_id).catch(() => {}), 4000);
  });

  bot.command('gpclose', async (ctx) => {
    if (Number(ctx.from.id) !== Number(OWNER_ID)) return;
    if (ctx.chat.type === 'private') {
      return ctx.reply('⚠️ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။');
    }

    disabledGroups.add(ctx.chat.id);
    const sent = await ctx.reply('🔴 ဤ Group အတွက် Bot စနစ်ကို ပိတ်လိုက်ပါပြီရှင်။');
    setTimeout(() => ctx.api.deleteMessage(ctx.chat.id, sent.message_id).catch(() => {}), 4000);
  });

  // ============================================================
  // 3. Channel သို့ တိုက်ရိုက်ပို့ရန် Command (/cpost)
  // ============================================================
  bot.command('cpost', async (ctx) => {
    if (Number(ctx.from.id) !== Number(OWNER_ID)) {
      return ctx.reply('⛔ ဤခိုင်းချက်ကို Owner သာ အသုံးပြုခွင့်ရှိပါသည်။');
    }

    const text = ctx.message.text || '';
    const args = text.replace(/^\/cpost(@\w+)?/, '').trim();
    const parts = args.split('|');
    
    const channelTarget = parts[0] ? parts[0].trim() : null;
    let rawText = parts[1] ? parts[1].trim() : null;

    const repliedMsg = ctx.message.reply_to_message;

    if (repliedMsg && !rawText) {
      rawText = repliedMsg.caption || repliedMsg.text || '';
    }

    if (!channelTarget) {
      return ctx.reply('⚠️ အသုံးပြုပုံ: `/cpost @channel_username | ပို့လိုသည့်စာသား` (သို့) Reply ထောက်၍ သုံးပါရှင်။');
    }

    // စာသားကို HTML <pre><code> ဖြင့် ဘောင်ခတ်ခြင်း
    const formattedText = rawText ? `<pre><code>${escapeHTML(rawText)}</code></pre>` : undefined;

    try {
      if (repliedMsg && repliedMsg.photo) {
        const photoId = repliedMsg.photo[repliedMsg.photo.length - 1].file_id;
        await ctx.api.sendPhoto(channelTarget, photoId, { caption: formattedText, parse_mode: 'HTML' });
      } else if (repliedMsg && repliedMsg.video) {
        const videoId = repliedMsg.video.file_id;
        await ctx.api.sendVideo(channelTarget, videoId, { caption: formattedText, parse_mode: 'HTML' });
      } else if (repliedMsg && repliedMsg.document) {
        const docId = repliedMsg.document.file_id;
        await ctx.api.sendDocument(channelTarget, docId, { caption: formattedText, parse_mode: 'HTML' });
      } else if (repliedMsg && repliedMsg.audio) {
        const audioId = repliedMsg.audio.file_id;
        await ctx.api.sendAudio(channelTarget, audioId, { caption: formattedText, parse_mode: 'HTML' });
      } else {
        if (!formattedText) return ctx.reply('⚠️ ပို့ရန် စာသား သို့မဟုတ် Media တွေ့ရှိခြင်း မရှိပါ။');
        await ctx.api.sendMessage(channelTarget, formattedText, { parse_mode: 'HTML' });
      }
      await ctx.reply('✅ Channel သို့ အောင်မြင်စွာ တင်လိုက်ပါပြီရှင်။');
    } catch (err) {
      await ctx.reply(`❌ အမှားအယွင်းရှိနေပါသည်: ${err.message}`);
    }
  });

  // ============================================================
  // 4. Channel သို့ အချိန်ဆိုင်း၍ ပို့ရန် Command (/cschedule)
  // ============================================================
  bot.command('cschedule', async (ctx) => {
    if (Number(ctx.from.id) !== Number(OWNER_ID)) {
      return ctx.reply('⛔ ဤခိုင်းချက်ကို Owner သာ အသုံးပြုခွင့်ရှိပါသည်။');
    }

    const text = ctx.message.text || '';
    const args = text.replace(/^\/cschedule(@\w+)?/, '').trim();
    const parts = args.split('|');

    const channelTarget = parts[0] ? parts[0].trim() : null;
    const delaySeconds = parts[1] ? parseInt(parts[1].trim(), 10) : NaN;
    let rawText = parts[2] ? parts[2].trim() : null;

    const repliedMsg = ctx.message.reply_to_message;

    if (repliedMsg && !rawText) {
      rawText = repliedMsg.caption || repliedMsg.text || '';
    }

    if (!channelTarget || isNaN(delaySeconds)) {
      return ctx.reply('⚠️ **အသုံးပြုပုံ:**\n1. `/cschedule @channel | စက္ကန့် | ပို့မည့်စာသား`\n2. Reply ဖြင့်: `/cschedule @channel | စက္ကန့်`', { parse_mode: 'Markdown' });
    }

    if (delaySeconds <= 0) {
      return ctx.reply('⚠️ ကျေးဇူးပြု၍ မှန်ကန်သော အချိန် (စက္ကန့်) ထည့်ပါ။');
    }

    const formattedText = rawText ? `<pre><code>${escapeHTML(rawText)}</code></pre>` : undefined;

    let mediaData = null;
    if (repliedMsg) {
      if (repliedMsg.photo) mediaData = { type: 'photo', id: repliedMsg.photo[repliedMsg.photo.length - 1].file_id };
      else if (repliedMsg.video) mediaData = { type: 'video', id: repliedMsg.video.file_id };
      else if (repliedMsg.document) mediaData = { type: 'document', id: repliedMsg.document.file_id };
      else if (repliedMsg.audio) mediaData = { type: 'audio', id: repliedMsg.audio.file_id };
    }

    if (!mediaData && !formattedText) {
      return ctx.reply('⚠️ ပို့ရန် စာသား သို့မဟုတ် Media တွေ့ရှိခြင်း မရှိပါ။');
    }

    await ctx.reply(`⏱️ Channel (${channelTarget}) သို့ နောက်ထပ် (${delaySeconds} စက္ကန့်) ကြာလျှင် တင်ပေးပါမည်ရှင်။`);

    setTimeout(async () => {
      try {
        if (mediaData) {
          if (mediaData.type === 'photo') await bot.api.sendPhoto(channelTarget, mediaData.id, { caption: formattedText, parse_mode: 'HTML' });
          else if (mediaData.type === 'video') await bot.api.sendVideo(channelTarget, mediaData.id, { caption: formattedText, parse_mode: 'HTML' });
          else if (mediaData.type === 'document') await bot.api.sendDocument(channelTarget, mediaData.id, { caption: formattedText, parse_mode: 'HTML' });
          else if (mediaData.type === 'audio') await bot.api.sendAudio(channelTarget, mediaData.id, { caption: formattedText, parse_mode: 'HTML' });
        } else {
          await bot.api.sendMessage(channelTarget, formattedText, { parse_mode: 'HTML' });
        }
        console.log(`✅ Scheduled post sent to ${channelTarget}`);
      } catch (err) {
        console.error('Scheduled Post Error:', err.message);
        try {
          await ctx.reply(`❌ Channel သို့ ပို့ရာတွင် Error တက်ပါသည်: ${err.message}`);
        } catch (e) {}
      }
    }, delaySeconds * 1000);
  });

}

module.exports = setupChannelGroupModule;
