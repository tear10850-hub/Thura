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

// ⏱️ အချိန်ပုံစံများကို စက္ကန့်သို့ ပြောင်းပေးသည့် Helper Function (ဥပမာ: 30s = 30စက္ကန့်, 5m = 5မိနစ်, 1h = 1နာရီ)
function parseTimeString(timeStr) {
  if (!timeStr) return NaN;
  const str = timeStr.trim().toLowerCase();
  const match = str.match(/^(\d+)([smh])$/);
  
  if (!match) {
    const num = parseInt(str, 10);
    return isNaN(num) ? NaN : num;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (unit === 's') return value;
  if (unit === 'm') return value * 60;
  if (unit === 'h') return value * 3600;

  return NaN;
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
        return; 
      }
    }
    return await next();
  });

  // ============================================================
  // 2. Group Bot အဖွင့်/အပိတ် Commands (Owner သီးသန့်)
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
  // 3. Channel သို့ တိုက်ရိုက်ပို့ရန် Command (/cpost) - လူတိုင်းသုံးနိုင်သည်
  // ============================================================
  bot.command('cpost', async (ctx) => {
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

    const formattedText = rawText ? `<pre><code>${escapeHTML(rawText)}</code></pre>` : undefined;

    try {
      // 🔍 Channel ၏ အချက်အလက်များ (ID နဲ့ Name) ကို ယူခြင်း
      const chatInfo = await ctx.api.getChat(channelTarget);
      const channelId = chatInfo.id;
      const channelTitle = chatInfo.title || 'Unknown Channel';
      const channelUsername = chatInfo.username ? `@${chatInfo.username}` : channelTarget;

      // 👤 ပို့လိုက်သူ User ၏ အချက်အလက်များ
      const userId = ctx.from.id;
      const userName = ctx.from.first_name || 'Unknown';

      // မီဒီယာ သို့မဟုတ် စာ ပို့ခြင်း
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

      // ✅ အချက်အလက် အစုံအလင် ပြန်ထုတ်ပေးခြင်း
      const reportMsg = `✅ **Channel သို့ အောင်မြင်စွာ တင်ပြီးပါပြီ!**\n\n` +
                        `📢 **Channel အမည်:** ${channelTitle}\n` +
                        `🔗 **Channel Username:** ${channelUsername}\n` +
                        `🆔 **Channel ID:** \`${channelId}\`\n\n` +
                        `👤 **ပို့ပေးသူ အမည်:** ${userName}\n` +
                        `🆔 **ပို့ပေးသူ ID:** \`${userId}\``;

      await ctx.reply(reportMsg, { parse_mode: 'Markdown' });

    } catch (err) {
      await ctx.reply(`❌ အမှားအယွင်းရှိနေပါသည်: ${err.message}\n💡 (ဘော့တ်သည် သက်ဆိုင်ရာ Channel တွင် **Administrator** ဖြစ်နေရပါမည်။)`);
    }
  });

  // ============================================================
  // 4. Channel သို့ အချိန်ဆိုင်း၍ ပို့ရန် Command (/cschedule) - လူတိုင်းသုံးနိုင်သည်
  // ============================================================
  bot.command('cschedule', async (ctx) => {
    const text = ctx.message.text || '';
    const args = text.replace(/^\/cschedule(@\w+)?/, '').trim();
    const parts = args.split('|');

    const channelTarget = parts[0] ? parts[0].trim() : null;
    const timeInput = parts[1] ? parts[1].trim() : null;
    let rawText = parts[2] ? parts[2].trim() : null;

    const repliedMsg = ctx.message.reply_to_message;

    if (repliedMsg && !rawText) {
      rawText = repliedMsg.caption || repliedMsg.text || '';
    }

    if (!channelTarget || !timeInput) {
      return ctx.reply('⚠️ **အသုံးပြုပုံ:**\n1. `/cschedule @channel | 30s | ပို့မည့်စာသား` (စက္ကန့်)\n2. `/cschedule @channel | 5m | ပို့မည့်စာသား` (မိနစ်)\n3. `/cschedule @channel | 1h | ပို့မည့်စာသား` (နာရီ)\n(သို့မဟုတ် Reply ဖြင့်သုံးပါ)', { parse_mode: 'Markdown' });
    }

    const delaySeconds = parseTimeString(timeInput);

    if (isNaN(delaySeconds) || delaySeconds <= 0) {
      return ctx.reply('⚠️ ကျေးဇူးပြု၍ မှန်ကန်သော အချိန် ပုံစံထည့်ပါ။ (ဥပမာ: `30s`, `5m`, `1h`)');
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

    // 👤 ပို့လိုက်သူ User ရဲ့ အချက်အလက်များ သိမ်းဆည်းရန်
    const userId = ctx.from.id;
    const userName = ctx.from.first_name || 'Unknown';

    await ctx.reply(`⏱️ Channel (${channelTarget}) သို့ နောက်ထပ် (${timeInput}) ကြာလျှင် တင်ပေးပါမည်ရှင်။`);

    setTimeout(async () => {
      try {
        // Channel အချက်အလက်များကို အချိန်ပြည့်လို့ ပို့တဲ့အခါ ထပ်ဆွဲထုတ်မည်
        const chatInfo = await ctx.api.getChat(channelTarget);
        const channelId = chatInfo.id;
        const channelTitle = chatInfo.title || 'Unknown Channel';
        const channelUsername = chatInfo.username ? `@${chatInfo.username}` : channelTarget;

        if (mediaData) {
          if (mediaData.type === 'photo') await bot.api.sendPhoto(channelTarget, mediaData.id, { caption: formattedText, parse_mode: 'HTML' });
          else if (mediaData.type === 'video') await bot.api.sendVideo(channelTarget, mediaData.id, { caption: formattedText, parse_mode: 'HTML' });
          else if (mediaData.type === 'document') await bot.api.sendDocument(channelTarget, mediaData.id, { caption: formattedText, parse_mode: 'HTML' });
          else if (mediaData.type === 'audio') await bot.api.sendAudio(channelTarget, mediaData.id, { caption: formattedText, parse_mode: 'HTML' });
        } else {
          await bot.api.sendMessage(channelTarget, formattedText, { parse_mode: 'HTML' });
        }

        console.log(`✅ Scheduled post successfully sent to ${channelTarget} by User ${userId}`);

        // Owner သို့မဟုတ် ပို့ခဲ့တဲ့သူဆီ သို့မဟုတ် Group ထဲ အကြောင်းကြားချက် ပို့လိုက ပို့နိုင်သည်
      } catch (err) {
        console.error('Scheduled Post Error:', err.message);
      }
    }, delaySeconds * 1000);
  });

}

module.exports = setupChannelGroupModule;
