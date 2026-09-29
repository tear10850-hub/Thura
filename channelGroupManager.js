const { InlineKeyboard } = require('grammy');

// Group များတွင် Bot ပိတ်/ဖွင့် အခြေအနေကို သိမ်းဆည်းရန်
const disabledGroups = new Set();

// Special Characters များကို MarkdownV2 အတွက် Escape လုပ်ပေးသည့် Function
function escapeMarkdownV2(text) {
  if (!text) return '';
  return text.replace(/[_*[\]()~`>#+-=|{}.!]/g, '\\$&');
}

function setupChannelGroupModule(bot, OWNER_ID) {

  // ============================================================
  // 1. Group Bot အဖွင့်/အပိတ် Middleware (အပေါ်ဆုံးတွင် ရှိရပါမည်)
  // ============================================================
  bot.use(async (ctx, next) => {
    if (ctx.chat && ['group', 'supergroup'].includes(ctx.chat.type)) {
      if (disabledGroups.has(ctx.chat.id)) {
        if (ctx.message && ctx.message.text && ctx.message.text.trim().startsWith('/gpopen')) {
          return await next();
        }
        return; // Bot ပိတ်ထားပါက ကျန်သော Command မက်ဆေ့ခ်ျများကို မတုံ့ပြန်ပါ
      }
    }
    return await next();
  });

  // ============================================================
  // 2. Group Bot အဖွင့်/အပိတ် Commands
  // ============================================================
  bot.command('gpopen', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    if (ctx.chat.type === 'private') {
      return ctx.reply('⚠️ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။');
    }

    disabledGroups.delete(ctx.chat.id);
    const sent = await ctx.reply('🟢 ဤ Group အတွက် Bot စနစ်ကို ဖွင့်လိုက်ပါပြီရှင်။');
    setTimeout(() => ctx.api.deleteMessage(ctx.chat.id, sent.message_id).catch(() => {}), 4000);
  });

  bot.command('gpclose', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    if (ctx.chat.type === 'private') {
      return ctx.reply('⚠️ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။');
    }

    disabledGroups.add(ctx.chat.id);
    const sent = await ctx.reply('🔴 ဤ Group အတွက် Bot စနစ်ကို ပိတ်လိုက်ပါပြီရှင်။');
    setTimeout(() => ctx.api.deleteMessage(ctx.chat.id, sent.message_id).catch(() => {}), 4000);
  });

  // ============================================================
  // 3. Channel သို့ တိုက်ရိုက်ပို့ရန် Command (/cpost) - ဘောင်လေးဖြင့်
  // ============================================================
  bot.command('cpost', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) {
      return ctx.reply('⛔ ဤခိုင်းချက်ကို Owner သာ အသုံးပြုခွင့်ရှိပါသည်။');
    }

    const text = ctx.message.text || '';
    const args = text.replace(/^\/cpost(@\w+)?/, '').trim();
    const parts = args.split('|');
    
    const channelTarget = parts[0] ? parts[0].trim() : null;
    let rawText = parts[1] ? parts[1].trim() : null;

    const repliedMsg = ctx.message.reply_to_message;

    // Reply ထောက်ထားပါက စာသား/Caption ကို ယူမည်
    if (repliedMsg && !rawText) {
      rawText = repliedMsg.caption || repliedMsg.text || '';
    }

    if (!channelTarget) {
      return ctx.reply('⚠️ အသုံးပြုပုံ: `/cpost @channel_username | ပို့လိုသည့်စာသား` (သို့) Reply ထောက်၍ သုံးပါရှင်။');
    }

    // စာသားကို Code Block ဘောင်လေးထဲ ရောက်အောင် Format လုပ်ခြင်း
    const formattedText = rawText ? `\`\`\`\n${escapeMarkdownV2(rawText)}\n\`\`\`` : undefined;

    try {
      if (repliedMsg && repliedMsg.photo) {
        const photoId = repliedMsg.photo[repliedMsg.photo.length - 1].file_id;
        await ctx.api.sendPhoto(channelTarget, photoId, { 
          caption: formattedText, 
          parse_mode: formattedText ? 'MarkdownV2' : undefined 
        });
      } else if (repliedMsg && repliedMsg.video) {
        const videoId = repliedMsg.video.file_id;
        await ctx.api.sendVideo(channelTarget, videoId, { 
          caption: formattedText, 
          parse_mode: formattedText ? 'MarkdownV2' : undefined 
        });
      } else {
        if (!formattedText) return ctx.reply('⚠️ ပို့ရန် စာသား သို့မဟုတ် Media တွေ့ရှိခြင်း မရှိပါ။');
        await ctx.api.sendMessage(channelTarget, formattedText, { 
          parse_mode: 'MarkdownV2' 
        });
      }
      await ctx.reply('✅ Channel သို့ စာသားကို ဘောင်လေးခတ်၍ အောင်မြင်စွာ တင်လိုက်ပါပြီရှင်။');
    } catch (err) {
      await ctx.reply(`❌ အမှားအယွင်းရှိနေပါသည်: ${err.message}`);
    }
  });

  // ============================================================
  // 4. Channel သို့ အချိန်ဆိုင်း၍ ပို့ရန် Command (/cschedule) - ဘောင်လေးဖြင့်
  // ============================================================
  bot.command('cschedule', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) {
      return ctx.reply('⛔ ဤခိုင်းချက်ကို Owner သာ အသုံးပြုခွင့်ရှိပါသည်။');
    }

    const text = ctx.message.text || '';
    const args = text.replace(/^\/cschedule(@\w+)?/, '').trim();
    const parts = args.split('|');
    
    if (parts.length < 3) {
      return ctx.reply('⚠️ အသုံးပြုပုံ: `/cschedule @channel | စက္ကန့် | ပို့မည့်စာသား`');
    }

    const channelTarget = parts[0].trim();
    const delaySeconds = parseInt(parts[1].trim(), 10);
    const rawText = parts[2].trim();

    if (isNaN(delaySeconds) || delaySeconds <= 0) {
      return ctx.reply('⚠️ ကျေးဇူးပြု၍ မှန်ကန်သော အချိန် (စက္ကန့်) ထည့်ပါ။');
    }

    if (delaySeconds > 3600) {
      return ctx.reply('⚠️ စက္ကန့် ၃၆၀၀ (၁ နာရီ) ထက် ပို၍ ကြိုတင်ချိန်မှတ်၍ မရပါရှင်။');
    }

    const formattedText = `\`\`\`\n${escapeMarkdownV2(rawText)}\n\`\`\``;

    await ctx.reply(`⏱️ Channel (${channelTarget}) သို့ နောက်ထပ် (${delaySeconds} စက္ကန့်) ကြာလျှင် တင်ပေးပါမည်ရှင်။`);

    setTimeout(async () => {
      try {
        await bot.api.sendMessage(channelTarget, formattedText, { 
          parse_mode: 'MarkdownV2' 
        });
        console.log(`✅ Scheduled post successfully sent to ${channelTarget}`);
      } catch (err) {
        console.error('Scheduled Post Error:', err.message);
      }
    }, delaySeconds * 1000);
  });

}

module.exports = setupChannelGroupModule;
