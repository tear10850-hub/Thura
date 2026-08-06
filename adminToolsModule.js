const { InlineKeyboard } = require('grammy');
const { AdminToolsConfig, GlobalBotProfile } = require('./adminToolsSchema');

const OWNER_ID = Number(process.env.OWNER_ID);

const BAD_WORDS = [
  "စပ့", "စပ", "စ", "လီး", "ယီး", "ဖေလိုမ", "မသာ", "စည်ရိုင်းဆိုင်း"
];

const REACTION_EMOJIS = [
  "👍", "👎", "❤", "🔥", "🥰", "👏", "😁", "🤔", "🤯", "😱", 
  "🤬", "😢", "🎉", "🤩", "🤮", "💩", "🙏", "👌", "🕊", "🤡", 
  "🥱", "🥴", "😍", "🐳", "❤️‍🔥", "🌚", "🌭", "💯", "🤣", "⚡", 
  "🍌", "🏆", "💔", "🤨", "😐", "🍓", "🍾", "💋", "🖕", "😈", 
  "😴", "😭", "🤓", "👻", "👨‍💻", "👀", "🎃", "🙈", "😇", "😨", 
  "🤝", "✍", "🤗", "🫡", "🎅", "🎄", "☃", "💅", "🤪", "🗿", 
  "🆒", "💘", "🦄", "😘", "💊", "🙊", "😎", "👾", "🤷‍♂️", "🤷‍♀️", "🤷"
];

function isOwner(ctx) {
  return ctx.from && ctx.from.id === OWNER_ID;
}

async function isAdminOrOwner(ctx) {
  if (isOwner(ctx)) return true;
  if (ctx.chat && ctx.chat.type === 'private') return false;
  try {
    const member = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
    return ['administrator', 'creator'].includes(member.status);
  } catch (err) {
    return false;
  }
}

async function hasVideoPermission(ctx) {
  if (isOwner(ctx)) return true;
  const isAdm = await isAdminOrOwner(ctx);
  if (!isAdm) return false;

  const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });
  return !!(config && config.isPremium && config.premiumOwnerId === ctx.from.id);
}

function getUserMention(user) {
  if (!user) return "User";
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return user.username ? `@${user.username}` : `[${name}](tg://user?id=${user.id})`;
}

async function renderAdminProfilePage(ctx, pageIndex, isEdit = false) {
  const chatId = ctx.chat.id;

  const administrators = await ctx.api.getChatAdministrators(chatId);
  const humanAdmins = administrators.filter(a => !a.user.is_bot);
  
  const botProfile = await GlobalBotProfile.findOne({ key: "global_bot_profile" });

  const totalPages = humanAdmins.length + 1;
  let currentIndex = Math.max(0, Math.min(pageIndex, totalPages - 1));

  const keyboard = new InlineKeyboard();
  if (currentIndex > 0) {
    keyboard.text("⬅️ ရှေ့သို့", `apf_page_${currentIndex - 1}`);
  }
  if (currentIndex < totalPages - 1) {
    keyboard.text("နောက်သို့ ➡️", `apf_page_${currentIndex + 1}`);
  }
  keyboard.row().text("❌ ပိတ်မည် ❌", "delete_admin_msg");

  if (currentIndex === humanAdmins.length) {
    const botName = botProfile?.botCustomName || "မသတ်မှတ်ရသေးပါ";
    const botId = botProfile?.botCustomId || "မသတ်မှတ်ရသေးပါ";
    const botUsername = botProfile?.botCustomUsername || "မသတ်မှတ်ရသေးပါ";
    const botBio = botProfile?.botCustomBio || "မသတ်မှတ်ရသေးပါ";

    const caption = 
`👑 **ADMIN PROFILE (${currentIndex + 1}/${totalPages})**

🤖 **ရာထူး:** Bot Admin
🗣 **အမည်:** ${botName}
🆔 **User ID:** \`${botId}\`
🌐 **Username:** ${botUsername}
📝 **Bio:** ${botBio}`;

    const videoId = botProfile?.botCustomVideoId;

    if (isEdit) {
      try {
        await ctx.deleteMessage();
      } catch (e) {}

      if (videoId) {
        await ctx.replyWithVideo(videoId, { caption, parse_mode: 'Markdown', reply_markup: keyboard });
      } else {
        await ctx.reply(caption, { parse_mode: 'Markdown', reply_markup: keyboard });
      }
    } else {
      if (videoId) {
        await ctx.replyWithVideo(videoId, { caption, parse_mode: 'Markdown', reply_markup: keyboard });
      } else {
        await ctx.reply(caption, { parse_mode: 'Markdown', reply_markup: keyboard });
      }
    }
    return;
  }

  const adminMember = humanAdmins[currentIndex];
  const u = adminMember.user;
  const roleText = adminMember.status === 'creator' ? "👑 Owner (Group ဖန်တီးသူ)" : "🛡 Admin";
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
  const username = u.username ? `@${u.username}` : "မရှိပါ";

  let bio = "မရှိပါ";
  try {
    const chatMemberFull = await ctx.api.getChat(u.id);
    if (chatMemberFull.bio) bio = chatMemberFull.bio;
  } catch (e) {}

  const caption = 
`👑 **ADMIN PROFILE (${currentIndex + 1}/${totalPages})**

ရာထူး: ${roleText}
👤 အမည်: ${name}
🆔 User ID: \`${u.id}\`
🌐 Username: ${username}
📝 Bio: ${bio}`;

  let photoId = null;
  try {
    const userPhotos = await ctx.api.getUserProfilePhotos(u.id, { limit: 1 });
    if (userPhotos.total_count > 0) {
      photoId = userPhotos.photos[0][0].file_id;
    }
  } catch (e) {}

  if (isEdit) {
    try {
      await ctx.deleteMessage();
    } catch (e) {}

    if (photoId) {
      await ctx.replyWithPhoto(photoId, { caption, parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(caption, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  } else {
    if (photoId) {
      await ctx.replyWithPhoto(photoId, { caption, parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply(caption, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  }
}

function setupAdminToolsModule(bot) {

  bot.use(async (ctx, next) => {
    if (ctx.message && ctx.message.text) {
      const text = ctx.message.text.trim();
      const hasBadWord = BAD_WORDS.some(word => text.includes(word));

      if (text.startsWith('/') || hasBadWord) {
        ctx.state = ctx.state || {};
        ctx.state.shouldSaveMemory = false;
      }

      try {
        const randomEmoji = REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
        await ctx.react([{ type: "emoji", emoji: randomEmoji }]);
      } catch (err) {}
    }
    return await next();
  });

  bot.command('setbotname', async (ctx) => {
    if (!isOwner(ctx)) return ctx.reply("❌ ဤ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။");
    const nameText = ctx.message.text.split(" ").slice(1).join(" ");
    if (!nameText) return ctx.reply("❌ အသုံးပြုနည်း: `/setbotname [Bot အမည်]`");

    await GlobalBotProfile.findOneAndUpdate({ key: "global_bot_profile" }, { botCustomName: nameText }, { upsert: true });
    await ctx.reply(`✅ Bot ၏ Name ကို **${nameText}** အဖြစ် သတ်မှတ်လိုက်ပါပြီ။`);
  });

  bot.command('setbotid', async (ctx) => {
    if (!isOwner(ctx)) return ctx.reply("❌ ဤ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။");
    const idText = ctx.message.text.split(" ")[1];
    if (!idText) return ctx.reply("❌ အသုံးပြုနည်း: `/setbotid [Bot ID]`");

    await GlobalBotProfile.findOneAndUpdate({ key: "global_bot_profile" }, { botCustomId: idText }, { upsert: true });
    await ctx.reply(`✅ Bot ၏ ID ကို \`${idText}\` အဖြစ် သတ်မှတ်လိုက်ပါပြီ။`);
  });

  bot.command('setbotusername', async (ctx) => {
    if (!isOwner(ctx)) return ctx.reply("❌ ဤ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။");
    const usernameText = ctx.message.text.split(" ")[1];
    if (!usernameText) return ctx.reply("❌ အသုံးပြုနည်း: `/setbotusername [@username]`");

    await GlobalBotProfile.findOneAndUpdate({ key: "global_bot_profile" }, { botCustomUsername: usernameText }, { upsert: true });
    await ctx.reply(`✅ Bot ၏ Username ကို **${usernameText}** အဖြစ် သတ်မှတ်လိုက်ပါပြီ။`);
  });

  bot.command('setbotbio', async (ctx) => {
    if (!isOwner(ctx)) return ctx.reply("❌ ဤ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။");
    const bioText = ctx.message.text.split(" ").slice(1).join(" ");
    if (!bioText) return ctx.reply("❌ အသုံးပြုနည်း: `/setbotbio [Bot Bio စာသား]`");

    await GlobalBotProfile.findOneAndUpdate({ key: "global_bot_profile" }, { botCustomBio: bioText }, { upsert: true });
    await ctx.reply(`✅ Bot ၏ Bio ကို သတ်မှတ်လိုက်ပါပြီ။`);
  });

  bot.command('setbotvideo', async (ctx) => {
    if (!isOwner(ctx)) return ctx.reply("❌ ဤ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။");
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) return ctx.reply("ကျေးဇူးပြု၍ Video ကို Reply ထောက်ပြီး `/setbotvideo` ဟု ရိုက်ပေးပါ။");

    await GlobalBotProfile.findOneAndUpdate({ key: "global_bot_profile" }, { botCustomVideoId: replyMsg.video.file_id }, { upsert: true });
    await ctx.reply("✅ Bot Profile Video ကို သတ်မှတ်လိုက်ပါပြီ။");
  });

  bot.command('adminpf', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("ဤ Command ကို Group ထဲတွင်သာ သုံးနိုင်ပါသည်။");
    await renderAdminProfilePage(ctx, 0, false);
  });

  bot.callbackQuery(/^apf_page_(\d+)$/, async (ctx) => {
    const pageIndex = parseInt(ctx.match[1], 10);
    await ctx.answerCallbackQuery();
    await renderAdminProfilePage(ctx, pageIndex, true);
  });

  bot.command(['promote', 'Promote'], async (ctx) => {
    if (!(await isAdminOrOwner(ctx))) return;
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg) return ctx.reply("ကျေးဇူးပြု၍ Admin ခန့်လိုသော မန်ဘာ၏ Message ကို Reply ထောက်၍ /promote ဟု ရိုက်ပေးပါ။");

    try {
      await ctx.promoteChatMember(replyMsg.from.id, {
        can_change_info: true,
        can_delete_messages: true,
        can_invite_users: true,
        can_restrict_members: true,
        can_pin_messages: true,
        can_manage_video_chats: true
      });
      await ctx.reply(`✅ ${getUserMention(replyMsg.from)} အား Admin အဖြစ် အောင်မြင်စွာ ခန့်အပ်လိုက်ပါပြီ။`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply("❌ Admin ခန့်ရန် မအောင်မြင်ပါ။");
    }
  });

  bot.command(['demote', 'Demote'], async (ctx) => {
    if (!(await isAdminOrOwner(ctx))) return;
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg) return ctx.reply("ကျေးဇူးပြု၍ Admin ဖြုတ်လိုသော မန်ဘာ၏ Message ကို Reply ထောက်၍ /demote ဟု ရိုက်ပေးပါ။");

    try {
      await ctx.promoteChatMember(replyMsg.from.id, {
        can_change_info: false,
        can_post_messages: false,
        can_edit_messages: false,
        can_delete_messages: false,
        can_invite_users: false,
        can_restrict_members: false,
        can_pin_messages: false,
        can_promote_members: false,
        can_manage_video_chats: false
      });
      await ctx.reply(`⚠️ ${getUserMention(replyMsg.from)} အား Admin ရာထူးမှ အောင်မြင်စွာ ဖြုတ်လိုက်ပါပြီ။`, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply("❌ Admin ရာထူးမှ ဖြုတ်ရန် မအောင်မြင်ပါ။");
    }
  });

  bot.on('chat_member', async (ctx) => {
    const update = ctx.chatMember;
    if (!update) return;

    const oldStatus = update.old_chat_member.status;
    const newStatus = update.new_chat_member.status;
    const targetUser = update.new_chat_member.user;
    const actorUser = update.from;

    const isPromoted = ['member', 'restricted'].includes(oldStatus) && newStatus === 'administrator';
    const isDemoted = oldStatus === 'administrator' && ['member', 'restricted', 'kicked', 'left'].includes(newStatus);

    if (isPromoted || isDemoted) {
      const statusText = isPromoted ? "👑 Admin အဖြစ် ခန့်အပ်ခံရခြင်း" : "❌ Admin ရာထူးမှ ဖြုတ်ချခံရခြင်း";
      const keyboard = new InlineKeyboard().text("❌ Delete ❌", "delete_admin_msg");

      const message = 
`📢 **Admin အပြောင်းအလဲ အသိပေးချက်**

📌 **အခြေအနေ:** ${statusText}

👤 **သက်ဆိုင်သူ အချက်အလက်:**
• **Name:** ${targetUser.first_name} ${targetUser.last_name || ''}
• **ID:** \`${targetUser.id}\`
• **Username:** ${targetUser.username ? `@${targetUser.username}` : 'မရှိပါ'}

🛠 **ဆောင်ရွက်သူ (Admin/Owner):**
• **Name:** ${actorUser.first_name} ${actorUser.last_name || ''}
• **ID:** \`${actorUser.id}\`
• **Username:** ${actorUser.username ? `@${actorUser.username}` : 'မရှိပါ'}`;

      await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  });

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

  bot.command('bvideo', async (ctx) => {
    if (!(await hasVideoPermission(ctx))) return ctx.reply("❌ Premium Key လိုအပ်ပါသည်။");
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) return ctx.reply("ကျေးဇူးပြု၍ Video ကို Reply ထောက်ပြီး /bvideo ဟု ပို့ပါ။");

    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { banVideoId: replyMsg.video.file_id }, { upsert: true });
    await ctx.reply("Ban Video ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။");
  });

  bot.command('mvideo', async (ctx) => {
    if (!(await hasVideoPermission(ctx))) return ctx.reply("❌ Premium Key လိုအပ်ပါသည်။");
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) return ctx.reply("ကျေးဇူးပြု၍ Video ကို Reply ထောက်ပြီး /mvideo ဟု ပို့ပါ။");

    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { muteVideoId: replyMsg.video.file_id }, { upsert: true });
    await ctx.reply("Mute Video ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။");
  });

  bot.command('uvideo', async (ctx) => {
    if (!(await hasVideoPermission(ctx))) return ctx.reply("❌ Premium Key လိုအပ်ပါသည်။");
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) return ctx.reply("ကျေးဇူးပြု၍ Video ကို Reply ထောက်ပြီး /uvideo ဟု ပို့ပါ။");

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
