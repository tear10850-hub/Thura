const { InlineKeyboard } = require('grammy');
const { AdminToolsConfig } = require('./adminToolsSchema');

const OWNER_ID = Number(process.env.OWNER_ID);

// ၁။ ရိုင်းစိုင်းသည့် စာသားများ စာရင်း
const BAD_WORDS = [
  "စပ့", "စပ", "စ", "လီး", "ယီး", "ဖေလိုမ", "မသာ", "စည်ရိုင်းဆိုင်း"
];

// ၂။ Telegram Bot API မှ ခွင့်ပြုထားသော Emojis စာရင်း (အမျိုးအစားအလိုက် စနစ်တကျ စီထားပါသည်)
const REACTION_EMOJIS = [
  // 😃 အပြုံး & ခံစားချက် Emojis
  "👍", "👎", "❤", "🔥", "🥰", "👏", "😁", "🤔", "🤯", "😱", 
  "🤬", "😢", "🎉", "🤩", "🤮", "💩", "🙏", "👌", "🕊", "🤡", 
  "🥱", "🥴", "😍", "🐳", "❤️‍🔥", "🌚", "🌭", "💯", "🤣", "⚡", 
  "🍌", "🏆", "💔", "🤨", "😐", "🍓", "🍾", "💋", "🖕", "😈", 

  // 😴 အမူအရာ & စိတ်ခံစားမှု Emojis
  "😴", "😭", "🤓", "👻", "👨‍💻", "👀", "🎃", "🙈", "😇", "😨", 
  "🤝", "✍", "🤗", "🫡", "🎅", "🎄", "☃", "💅", "🤪", "🗿", 

  // 🆒 အခြား Emojis
  "🆒", "💘", "", "🦄", "😘", "💊", "🙊", "😎", "👾", "🤷‍♂️", 
  "🤷‍♀️", "🤷", "💔"
];

function isInvalidCaption(text) {
  if (!text) return false;
  if (text.includes('/')) return true;
  return BAD_WORDS.some(word => text.includes(word));
}

async function isAdminOrOwner(ctx) {
  if (ctx.from && ctx.from.id === OWNER_ID) return true;
  if (ctx.chat && ctx.chat.type === 'private') return false;
  try {
    const member = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
    return ['administrator', 'creator'].includes(member.status);
  } catch (err) {
    return false;
  }
}

async function hasVideoPermission(ctx) {
  if (ctx.from && ctx.from.id === OWNER_ID) return true;
  const isAdm = await isAdminOrOwner(ctx);
  if (!isAdm) return false;

  const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });
  if (config && config.isPremium && config.premiumOwnerId === ctx.from.id) {
    return true;
  }
  return false;
}

function getUserMention(user) {
  if (!user) return "User";
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return user.username ? `@${user.username}` : `[${name}](tg://user?id=${user.id})`;
}

function setupAdminToolsModule(bot) {

  // ====================================================
  // MAIN MIDDLEWARE: / ခံထားတာမမှတ်ခြင်း + Emoji Reaction ပေးခြင်း
  // ====================================================
  bot.use(async (ctx, next) => {
    if (ctx.message && ctx.message.text) {
      const text = ctx.message.text.trim();
      const hasBadWord = BAD_WORDS.some(word => text.includes(word));

      // ၁။ / ခံထားလျှင် သို့မဟုတ် ရိုင်းစိုင်းစာ ပါပါက Bot Memory ထဲ မမှတ်ပါ
      if (text.startsWith('/') || hasBadWord) {
        ctx.state = ctx.state || {};
        ctx.state.shouldSaveMemory = false;
      }

      // ၂။ မန်ဘာများ စာရိုက်တိုင်း Emoji Reaction (RC) ပေးခြင်း
      try {
        // Random Emoji တစ်ခု ရွေးချယ်ခြင်း
        const randomEmoji = REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
        
        await ctx.react([
          {
            type: "emoji",
            emoji: randomEmoji
          }
        ]);
      } catch (err) {
        // Chat ထဲတွင် Reaction ပေးခွင့် ပိတ်ထားပါက Error မတက်အောင် ကျော်သွားမည်
      }
    }
    return await next();
  });

  // ====================================================
  // BAN / MUTE / UNMUTE COMMANDS
  // ====================================================
  bot.command(['ban', 'Ban'], async (ctx) => {
    if (!(await isAdminOrOwner(ctx))) return;
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg) return ctx.reply("ကျေးဇူးပြု၍ Ban လိုသော သူ၏ Message ကို Reply ထောက်၍ /ban ဟု ပို့ပါ။");

    try {
      await ctx.banChatMember(replyMsg.from.id);
      const captionText = 
`🚨--Ban--🚨
သုံစွဲသူတစ်ဉီးသည်Gpစည်းကမ်းချိုးဖောက်ပါဖြင့်
Gpမှနှင်ထုပ်လိုက်ပါပီရှင့်🍃😌
နှင်ထုပ်ခံရသူ - ${getUserMention(replyMsg.from)}
နှင်ထုပ်သူAdmin😉 - ${getUserMention(ctx.from)}`;

      const keyboard = new InlineKeyboard().text("❌Gp Tear❌", "delete_admin_msg");
      const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });

      if (config && config.banVideoId) {
        await ctx.replyWithVideo(config.banVideoId, { caption: captionText, reply_markup: keyboard, parse_mode: 'Markdown' });
      } else {
        await ctx.reply(captionText, { reply_markup: keyboard, parse_mode: 'Markdown' });
      }
    } catch (err) {
      await ctx.reply("❌ မန်ဘာအား Ban ရာတွင် အဆင်မပြေပါ");
    }
  });

  bot.command(['mute', 'Mute'], async (ctx) => {
    if (!(await isAdminOrOwner(ctx))) return;
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg) return ctx.reply("ကျေးဇူးပြု၍ Mute လိုသော သူ၏ Message ကို Reply ထောက်၍ /mute ဟု ပို့ပါ။");

    try {
      await ctx.restrictChatMember(replyMsg.from.id, { can_send_messages: false });
      const captionText = 
`🚨--Mute--🚨
ရှာရှည်လွန်းသဖြင့်😂အမြင်ကပ်ပုဏ်မှဖြင့်
${getUserMention(replyMsg.from)} ပါစပ်ခနတိတ်နဲ့ပိတ်ထားတယ်နော်🤭🤭
တိတ်ပေးပီးပိတ်ခိုင်းသူ ${getUserMention(ctx.from)}`;

      const keyboard = new InlineKeyboard().text("❌Gp Tear❌", "delete_admin_msg");
      const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });

      if (config && config.muteVideoId) {
        await ctx.replyWithVideo(config.muteVideoId, { caption: captionText, reply_markup: keyboard, parse_mode: 'Markdown' });
      } else {
        await ctx.reply(captionText, { reply_markup: keyboard, parse_mode: 'Markdown' });
      }
    } catch (err) {
      await ctx.reply("❌ မန်ဘာအား Mute ရာတွင် အဆင်မပြေပါ");
    }
  });

  bot.command(['umute', 'Umute', 'UMute'], async (ctx) => {
    if (!(await isAdminOrOwner(ctx))) return;
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg) return ctx.reply("ကျေးဇူးပြု၍ Unmute လိုသော သူ၏ Message ကို Reply ထောက်၍ /umute ဟု ပို့ပါ။");

    try {
      await ctx.restrictChatMember(replyMsg.from.id, {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true
      });
      const captionText = 
`🚨--UMute--🚨
ရုပ်ရည်ချောလွန်းသောကြောင့်ပြန်လွှတ်ပေးလိုက်ပီ🙂😜
Umuteပြန်လွှတ်ခံရသူ - ${getUserMention(replyMsg.from)}🤭🤭
Umutrလွှတ်ပေးသူ - ${getUserMention(ctx.from)}🤓`;

      const keyboard = new InlineKeyboard().text("❌Gp Tear❌", "delete_admin_msg");
      const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });

      if (config && config.unmuteVideoId) {
        await ctx.replyWithVideo(config.unmuteVideoId, { caption: captionText, reply_markup: keyboard, parse_mode: 'Markdown' });
      } else {
        await ctx.reply(captionText, { reply_markup: keyboard, parse_mode: 'Markdown' });
      }
    } catch (err) {
      await ctx.reply("❌ မန်ဘာအား Unmute ရာတွင် အဆင်မပြေပါ");
    }
  });

  // ====================================================
  // VIDEO CUSTOMIZATION COMMANDS
  // ====================================================
  bot.command('bvideo', async (ctx) => {
    if (!(await hasVideoPermission(ctx))) return ctx.reply("❌ Premium Key လိုအပ်ပါသည်။");
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) return ctx.reply("ကျေးဇူးပြု၍ Video ကို Reply ထောက်ပြီး /bvideo ဟု ပို့ပါ။");
    if (isInvalidCaption(replyMsg.caption)) return ctx.reply("❌ Caption မမှန်ပါ။");

    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { banVideoId: replyMsg.video.file_id }, { upsert: true });
    await ctx.reply("Ban Video ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။");
  });

  bot.command('mvideo', async (ctx) => {
    if (!(await hasVideoPermission(ctx))) return ctx.reply("❌ Premium Key လိုအပ်ပါသည်။");
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) return ctx.reply("ကျေးဇူးပြု၍ Video ကို Reply ထောက်ပြီး /mvideo ဟု ပို့ပါ။");
    if (isInvalidCaption(replyMsg.caption)) return ctx.reply("❌ Caption မမှန်ပါ။");

    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { muteVideoId: replyMsg.video.file_id }, { upsert: true });
    await ctx.reply("Mute Video ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။");
  });

  bot.command('uvideo', async (ctx) => {
    if (!(await hasVideoPermission(ctx))) return ctx.reply("❌ Premium Key လိုအပ်ပါသည်။");
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) return ctx.reply("ကျေးဇူးပြု၍ Video ကို Reply ထောက်ပြီး /uvideo ဟု ပို့ပါ။");
    if (isInvalidCaption(replyMsg.caption)) return ctx.reply("❌ Caption မမှန်ပါ။");

    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { unmuteVideoId: replyMsg.video.file_id }, { upsert: true });
    await ctx.reply("Unmute Video ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။");
  });

  bot.callbackQuery('delete_admin_msg', async (ctx) => {
    try {
      await ctx.deleteMessage();
      await ctx.answerCallbackQuery({ text: "ဖျက်လိုက်ပါပြီ။" });
    } catch (err) {
      await ctx.answerCallbackQuery({ text: "ဖျက်၍ မရပါ။" });
    }
  });
}

module.exports = setupAdminToolsModule;
