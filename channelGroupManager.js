const { InlineKeyboard } = require('grammy');

// Group များတွင် Bot ပိတ်/ဖွင့် အခြေအနေကို သိမ်းဆည်းရန် (Memory သို့မဟုတ် Database သုံးနိုင်သည်)
const disabledGroups = new Set();

function setupChannelGroupModule(bot, OWNER_ID) {

  // ============================================================
  // 1. Channel သို့ တိုက်ရိုက်ပို့ရန် Command (/cpost)
  // ============================================================
  bot.command('cpost', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) {
      return ctx.reply('⛔ ဤခိုင်းချက်ကို Owner သာ အသုံးပြုခွင့်ရှိပါသည်။');
    }

    const args = ctx.message.text.replace('/cpost', '').trim();
    // ပုံစံ - /cpost @channel_username | ပို့လိုသည့်စာသား (သို့) Reply ထောက်၍လည်း ပို့နိုင်သည်
    const parts = args.split('|');
    const channelTarget = parts[0] ? parts[0].trim() : null;
    let postText = parts[1] ? parts[1].trim() : null;

    const repliedMsg = ctx.message.reply_to_message;
    if (repliedMsg && !postText) {
      postText = repliedMsg.text || repliedMsg.caption || '';
    }

    if (!channelTarget || !postText) {
      return ctx.reply('⚠️ အသုံးပြုပုံ: `/cpost @channel_username | ပို့လိုသည့်စာသား` (သို့) Channel တွင် ပို့မည့်စာကို Reply ထောက်၍ ပို့ပါ။');
    }

    try {
      if (repliedMsg && repliedMsg.photo) {
        const photoId = repliedMsg.photo[repliedMsg.photo.length - 1].file_id;
        await ctx.api.sendPhoto(channelTarget, photoId, { caption: postText });
      } else if (repliedMsg && repliedMsg.video) {
        const videoId = repliedMsg.video.file_id;
        await ctx.api.sendVideo(channelTarget, videoId, { caption: postText });
      } else {
        await ctx.api.sendMessage(channelTarget, postText);
      }
      await ctx.reply('✅ Channel သို့ အောင်မြင်စွာ တိုက်ရိုက်တင်လိုက်ပါပြီရှင်။');
    } catch (err) {
      await ctx.reply(`❌ အမှားအယွင်းရှိနေပါသည်: ${err.message}`);
    }
  });

  // ============================================================
  // 2. Channel သို့ အချိန်ဆိုင်း၍ ပို့ရန် Command (/cschedule)
  // ============================================================
  bot.command('cschedule', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) {
      return ctx.reply('⛔ ဤခိုင်းချက်ကို Owner သာ အသုံးပြုခွင့်ရှိပါသည်။');
    }

    // ပုံစံ - /cschedule @channel_username | 10 | မင်္ဂလာပါ
    // (၁၀ ဆိုသည်မှာ စက္ကန့်ပိုင်း (သို့) မိနစ်ပိုင်း သတ်မှတ်နိုင်သည်)
    const args = ctx.message.text.replace('/cschedule', '').trim();
    const parts = args.split('|');
    
    if (parts.length < 3) {
      return ctx.reply('⚠️ အသုံးပြုပုံ: `/cschedule @channel | စက္ကန့်အရေအတွက် | ပို့မည့်စာသား`');
    }

    const channelTarget = parts[0].trim();
    const delaySeconds = parseInt(parts[1].trim());
    const postText = parts[2].trim();

    if (isNaN(delaySeconds) || delaySeconds <= 0) {
      return ctx.reply('⚠️ ကျေးဇူးပြု၍ မှန်ကန်သော အချိန် (စက္ကန့်) ထည့်ပါ။');
    }

    await ctx.reply(`⏱️ Channel သို့ နောက်ထပ် (${delaySeconds} စက္ကန့်) ကြာလျှင် တင်ပေးပါမည်။`);

    setTimeout(async () => {
      try {
        await ctx.api.sendMessage(channelTarget, postText);
      } catch (err) {
        console.error('Scheduled Post Error:', err.message);
      }
    }, delaySeconds * 1000);
  });

  // ============================================================
  // 3. Group Bot အဖွင့်/အပိတ် (GPOpen / GPClose)
  // ============================================================
  bot.command('gpopen', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    if (ctx.chat.type === 'private') {
      return ctx.reply('⚠️ ဤ විධාန်ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။');
    }

    disabledGroups.delete(ctx.chat.id);
    const sent = await ctx.reply('🟢 ဤ Group အတွက် Bot စနစ်ကို ဖွင့်လိုက်ပါပြီရှင်။');
    setTimeout(() => ctx.api.deleteMessage(ctx.chat.id, sent.message_id).catch(() => {}), 4000);
  });

  bot.command('gpclose', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    if (ctx.chat.type === 'private') {
      return ctx.reply('⚠️ ဤ විධාန်ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။');
    }

    disabledGroups.add(ctx.chat.id);
    const sent = await ctx.reply('🔴 ဤ Group အတွက် Bot စနစ်ကို ပိတ်လိုက်ပါပြီရှင်။');
    setTimeout(() => ctx.api.deleteMessage(ctx.chat.id, sent.message_id).catch(() => {}), 4000);
  });

  // Group ထဲတွင် Bot ပိတ်ထားလျှင် မက်ဆေ့ခ်ျများကို αγνο (ignore) လုပ်ရန် Middleware
  bot.use(async (ctx, next) => {
    if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
      if (disabledGroups.has(ctx.chat.id)) {
        // Bot ပိတ်ထားချိန် Command တွေဖြစ်တဲ့ gpopen ကိုတော့ ခွင့်ပြုပေးရန်
        if (ctx.message && ctx.message.text && ctx.message.text.startsWith('/gpopen')) {
          return next();
        }
        return; // Bot ပိတ်ထားရင် ကျန်တာတွေကို လုံးဝမတုံ့ပြန်ပါ
      }
    }
    return next();
  });
}

module.exports = setupChannelGroupModule;
