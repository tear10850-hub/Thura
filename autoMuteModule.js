const { InlineKeyboard } = require('grammy');
const { AdminToolsConfig, UserWarn } = require('./adminToolsSchema');

const OWNER_ID = Number(process.env.OWNER_ID);

async function isAdminOrOwner(ctx) {
  if (ctx.from.id === OWNER_ID) return true;
  if (ctx.chat.type === 'private') return false;
  try {
    const member = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
    return ['administrator', 'creator'].includes(member.status);
  } catch (err) {
    return false;
  }
}

async function hasVideoPermission(ctx) {
  if (ctx.from.id === OWNER_ID) return true;
  const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });
  if (config && config.isPremium && config.premiumOwnerId === ctx.from.id) {
    return true;
  }
  return false;
}

function getUserMention(user) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  if (user.username) {
    return `@${user.username}`;
  } else {
    return `[${name}](tg://user?id=${user.id})`;
  }
}

function setupAutoMuteModule(bot) {

  // ====================================================
  // 1. LINK / FORWARD DETECTION & AUTO MUTE
  // ====================================================

  bot.on('message', async (ctx, next) => {
    if (ctx.chat.type === 'private') return next();

    // Admin မဟုတ်မှသာ စစ်ဆေးမည်
    if (await isAdminOrOwner(ctx)) return next();

    const msg = ctx.message;
    const hasLink = (msg.entities || msg.caption_entities || []).some(
      e => e.type === 'url' || e.type === 'text_link'
    );
    const isForward = Boolean(msg.forward_date || msg.forward_from || msg.forward_from_chat);

    if (hasLink || isForward) {
      // ၁. စည်းကမ်းဖောက်ဖျက်သော Message ကို ဖျက်မည်
      try {
        await ctx.deleteMessage();
      } catch (err) {}

      // ၂. အကြိမ်ရေ ရေတွက်မည်
      let warn = await UserWarn.findOne({ chatId: ctx.chat.id, userId: ctx.from.id });
      if (!warn) {
        warn = new UserWarn({ chatId: ctx.chat.id, userId: ctx.from.id, count: 1 });
      } else {
        warn.count += 1;
      }
      await warn.save();

      const userText = getUserMention(ctx.from);
      const keyboard = new InlineKeyboard().text("❌Dautomute❌", "delete_automute_msg");
      const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });

      // အကြိမ်ပေါ်မူတည်၍ အရေးယူမှုပြုလုပ်မည်
      if (warn.count === 1) {
        const text = 
`⏳(1/3).......
link(သို့မဟုတ်)fowardပို့နေပါသည်ရှင့်🙄
မပို့ရဘူးနော်အသစ်လေးစည်းကမ်းရှိပါရှင့်🍃🎋
Link/fowardချသူ--- ${userText}`;

        if (config && config.warn1VideoId) {
          await ctx.replyWithVideo(config.warn1VideoId, { caption: text, reply_markup: keyboard, parse_mode: 'Markdown' });
        } else {
          await ctx.reply(text, { reply_markup: keyboard, parse_mode: 'Markdown' });
        }

      } else if (warn.count === 2) {
        const text = 
`⏳(2/3).......
link(သို့မဟုတ်)fowardပို့နေပါသည်ရှင့်😏
မပို့ရဘူးနော်၊နောက်တစ်ခါဆိုနင်muteခံရပီ😒
Link/fowardချသူ--- ${userText}`;

        if (config && config.warn2VideoId) {
          await ctx.replyWithVideo(config.warn2VideoId, { caption: text, reply_markup: keyboard, parse_mode: 'Markdown' });
        } else {
          await ctx.reply(text, { reply_markup: keyboard, parse_mode: 'Markdown' });
        }

      } else if (warn.count >= 3) {
        // ၅ မိနစ် Mute လုပ်မည်
        const untilDate = Math.floor(Date.now() / 1000) + (5 * 60);
        try {
          await ctx.restrictChatMember(ctx.from.id, { can_send_messages: false }, { until_date: untilDate });
        } catch (e) {}

        const text = 
`⌛(3/3).......
Link(သို့မဟုတ်)fowardပို့နေတာmuteလိုက်ပါပီရှင့်🤫🤫
(5မိနစ်မြူလိုက်ပီ)နောက်ပိုင်းမှစကားပြန်ပြောပါ။
Link/fowardချလို့muteခံရသူ--- ${userText}`;

        if (config && config.warn3VideoId) {
          await ctx.replyWithVideo(config.warn3VideoId, { caption: text, reply_markup: keyboard, parse_mode: 'Markdown' });
        } else {
          await ctx.reply(text, { reply_markup: keyboard, parse_mode: 'Markdown' });
        }

        // Warn Count ကို ပြန်လည် Reset လုပ်မည်
        await UserWarn.deleteOne({ _id: warn._id });
      }

      return; // Next middleware မသွားစေရန်
    }

    return next();
  });

  // ====================================================
  // 2. VIDEO CUSTOMIZATION COMMANDS
  // ====================================================

  // --- 1st Warn Video ---
  bot.command('1mutevideo', async (ctx) => {
    if (!(await hasVideoPermission(ctx))) return ctx.reply("❌ ဤ စနစ်ကို အသုံးပြုရန် Premium Key လိုအပ်ပါသည်ရှင့်။");
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) return ctx.reply("ကျေးဇူးပြု၍ Video ကို Reply ထောက်ပြီး /1mutevideo ဟု ပို့ပါ။");

    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { warn1VideoId: replyMsg.video.file_id }, { upsert: true });
    await ctx.reply("ပထမအကြိမ် သတိပေး Video အား သတ်မှတ်လိုက်ပါပြီ။");
  });

  bot.command('D1mutevideo', async (ctx) => {
    if (!(await hasVideoPermission(ctx))) return ctx.reply("❌ ဤ စနစ်ကို အသုံးပြုရန် Premium Key လိုအပ်ပါသည်ရှင့်။");
    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { warn1VideoId: null });
    await ctx.reply("ပထမအကြိမ် သတိပေး Video အား ဖျက်လိုက်ပါပြီ။");
  });

  bot.command('1mv', async (ctx) => {
    const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });
    if (config && config.warn1VideoId) {
      await ctx.replyWithVideo(config.warn1VideoId, { caption: "ပထမအကြိမ် သတိပေး Video ဖြစ်ပါသည်။" });
    } else {
      await ctx.reply("ပထမအကြိမ် Video သတ်မှတ်ထားခြင်း မရှိသေးပါ။");
    }
  });

  // --- 2nd Warn Video ---
  bot.command('2mutevideo', async (ctx) => {
    if (!(await hasVideoPermission(ctx))) return ctx.reply("❌ ဤ စနစ်ကို အသုံးပြုရန် Premium Key လိုအပ်ပါသည်ရှင့်။");
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) return ctx.reply("ကျေးဇူးပြု၍ Video ကို Reply ထောက်ပြီး /2mutevideo ဟု ပို့ပါ။");

    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { warn2VideoId: replyMsg.video.file_id }, { upsert: true });
    await ctx.reply("ဒုတိယအကြိမ် သတိပေး Video အား သတ်မှတ်လိုက်ပါပြီ။");
  });

  bot.command('D2mutevideo', async (ctx) => {
    if (!(await hasVideoPermission(ctx))) return ctx.reply("❌ ဤ စနစ်ကို အသုံးပြုရန် Premium Key လိုအပ်ပါသည်ရှင့်။");
    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { warn2VideoId: null });
    await ctx.reply("ဒုတိယအကြိမ် သတိပေး Video အား ဖျက်လိုက်ပါပြီ။");
  });

  bot.command('2mv', async (ctx) => {
    const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });
    if (config && config.warn2VideoId) {
      await ctx.replyWithVideo(config.warn2VideoId, { caption: "ဒုတိယအကြိမ် သတိပေး Video ဖြစ်ပါသည်။" });
    } else {
      await ctx.reply("ဒုတိယအကြိမ် Video သတ်မှတ်ထားခြင်း မရှိသေးပါ။");
    }
  });

  // --- 3rd Warn (Mute) Video ---
  bot.command('3mutevideo', async (ctx) => {
    if (!(await hasVideoPermission(ctx))) return ctx.reply("❌ ဤ စနစ်ကို အသုံးပြုရန် Premium Key လိုအပ်ပါသည်ရှင့်။");
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) return ctx.reply("ကျေးဇူးပြု၍ Video ကို Reply ထောက်ပြီး /3mutevideo ဟု ပို့ပါ။");

    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { warn3VideoId: replyMsg.video.file_id }, { upsert: true });
    await ctx.reply("တတိယအကြိမ် Mute Video အား သတ်မှတ်လိုက်ပါပြီ။");
  });

  bot.command('D3mutevideo', async (ctx) => {
    if (!(await hasVideoPermission(ctx))) return ctx.reply("❌ ဤ စနစ်ကို အသုံးပြုရန် Premium Key လိုအပ်ပါသည်ရှင့်။");
    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { warn3VideoId: null });
    await ctx.reply("တတိယအကြိမ် Mute Video အား ဖျက်လိုက်ပါပြီ။");
  });

  bot.command('3mv', async (ctx) => {
    const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });
    if (config && config.warn3VideoId) {
      await ctx.replyWithVideo(config.warn3VideoId, { caption: "တတိယအကြိမ် Mute Video ဖြစ်ပါသည်။" });
    } else {
      await ctx.reply("တတိယအကြိမ် Video သတ်မှတ်ထားခြင်း မရှိသေးပါ။");
    }
  });

  // ====================================================
  // 3. INLINE BUTTON HANDLER (❌Dautomute❌)
  // ====================================================
  bot.callbackQuery('delete_automute_msg', async (ctx) => {
    try {
      await ctx.deleteMessage();
      await ctx.answerCallbackQuery({ text: "ဖျက်လိုက်ပါပြီ။" });
    } catch (err) {
      await ctx.answerCallbackQuery({ text: "ဖျက်၍ မရပါ သို့မဟုတ် စာသားဟောင်းနေပါပြီ။" });
    }
  });
}

module.exports = setupAutoMuteModule;
