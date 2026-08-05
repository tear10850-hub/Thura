const { InlineKeyboard } = require('grammy');
const { AdminToolsConfig } = require('./adminToolsSchema');

const OWNER_ID = Number(process.env.OWNER_ID);

// Admin သို့မဟုတ် Owner ဟုတ်မဟုတ် စစ်ဆေးခြင်း
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

// Premium ခွင့်ပြုချက် စစ်ဆေးခြင်း (Owner သို့မဟုတ် Premium Key ဝယ်ထားသူ သီးသန့်)
async function hasVideoPermission(ctx) {
  if (ctx.from.id === OWNER_ID) return true;
  const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });
  if (config && config.isPremium && config.premiumOwnerId === ctx.from.id) {
    return true;
  }
  return false;
}

// Mention link သို့မဟုတ် PF link ပြုလုပ်ပေးသည့် Function
function getUserMention(user) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  if (user.username) {
    return `@${user.username}`;
  } else {
    return `[${name}](tg://user?id=${user.id})`;
  }
}

function setupAdminToolsModule(bot) {

  // ====================================================
  // 1. BAN / MUTE / UNMUTE ACTIONS
  // ====================================================

  // BAN COMMAND
  bot.command('Ban', async (ctx) => {
    if (!(await isAdminOrOwner(ctx))) return;

    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg) return ctx.reply("ကျေးဇူးပြု၍ Ban လိုသော သူ၏ Message ကို Reply ထောက်၍ /Ban ဟု ပို့ပါ။");

    const targetUser = replyMsg.from;
    const operatorUser = ctx.from;

    try {
      await ctx.banChatMember(targetUser.id);

const targetText = getUserMention(targetUser);
      const operatorText = getUserMention(operatorUser);

      const captionText = 
`🚨--Ban--🚨
သုံစွဲသူတစ်ဉီးသည်Gpစည်းကမ်းချိုးဖောက်ပါဖြင့်
Gpမှနှင်ထုပ်လိုက်ပါပီရှင့်🍃😌
နှင်ထုပ်ခံရသူ - ${targetText}
နှင်ထုပ်သူAdmin😉 - ${operatorText}`;

const keyboard = new InlineKeyboard().text("❌Gp Tear❌", "delete_admin_msg");
      const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });

      if (config && config.banVideoId) {
        await ctx.replyWithVideo(config.banVideoId, { caption: captionText, reply_markup: keyboard, parse_mode: 'Markdown' });
      } else {
        await ctx.reply(captionText, { reply_markup: keyboard, parse_mode: 'Markdown' });
      }
    } catch (err) {
      await ctx.reply("❌ မန်ဘာအား Ban ရာတွင် အဆင်မပြေပါ (Bot တွင် Ban Permssion ရှိမရှိ စစ်ဆေးပါ)");
    }
  });

// MUTE COMMAND
  bot.command('Mute', async (ctx) => {
    if (!(await isAdminOrOwner(ctx))) return;

    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg) return ctx.reply("ကျေးဇူးပြု၍ Mute လိုသော သူ၏ Message ကို Reply ထောက်၍ /Mute ဟု ပို့ပါ။");

    const targetUser = replyMsg.from;
    const operatorUser = ctx.from;

    try {
      await ctx.restrictChatMember(targetUser.id, { can_send_messages: false });

      const targetText = getUserMention(targetUser);
      const operatorText = getUserMention(operatorUser);

      const captionText =
`🚨--Mute--🚨
ရှာရှည်လွန်းသဖြင့်😂အမြင်ကပ်ပုဏ်မှဖြင့်
${targetText} ပါစပ်ခနတိတ်နဲ့ပိတ်ထားတယ်နော်🤭🤭
တိတ်ပေးပီးပိတ်ခိုင်းသူ ${operatorText}`;

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

// UNMUTE COMMAND
  bot.command('UMute', async (ctx) => {
    if (!(await isAdminOrOwner(ctx))) return;

    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg) return ctx.reply("ကျေးဇူးပြု၍ Unmute လိုသော သူ၏ Message ကို Reply ထောက်၍ /UMute ဟု ပို့ပါ။");

    const targetUser = replyMsg.from;
    const operatorUser = ctx.from;

    try {
      await ctx.restrictChatMember(targetUser.id, {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true
      });

      const targetText = getUserMention(targetUser);
      const operatorText = getUserMention(operatorUser);
const captionText = 
`🚨--UMute--🚨
ရုပ်ရည်ချောလွန်းသောကြောင့်ပြန်လွှတ်ပေးလိုက်ပီ🙂😜
Umuteပြန်လွှတ်ခံရသူ - ${targetText}🤭🤭
Umutrလွှတ်ပေးသူ - ${operatorText}🤓`;

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
  // 2. VIDEO CUSTOMIZATION COMMANDS (PREMIUM)
  // ====================================================

  // BAN VIDEO
  bot.command('bvideo', async (ctx) => {
    if (!(await hasVideoPermission(ctx))) return ctx.reply("❌ ဤ စနစ်ကို အသုံးပြုရန် Premium Key လိုအပ်ပါသည်ရှင့်။");
    
