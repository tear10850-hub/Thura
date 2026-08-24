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
  if (!ctx.chat || ctx.chat.type === 'private') return false;
  try {
    const member = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
    return ['administrator', 'creator'].includes(member.status);
  } catch (err) {
    return false;
  }
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
  if (currentIndex > 0) keyboard.text("⬅️ ရှေ့သို့", `apf_page_${currentIndex - 1}`);
  if (currentIndex < totalPages - 1) keyboard.text("နောက်သို့ ➡️", `apf_page_${currentIndex + 1}`);
  keyboard.row().text("❌ ပိတ်မည် ❌", "delete_admin_msg");

  let caption = "";
  let mediaId = null;
  let mediaType = null;

  if (currentIndex === humanAdmins.length) {
    const botName = botProfile?.botCustomName || "မသတ်မှတ်ရသေးပါ";
    const botId = botProfile?.botCustomId || "မသတ်မှတ်ရသေးပါ";
    const botUsername = botProfile?.botCustomUsername || "မသတ်မှတ်ရသေးပါ";
    const botBio = botProfile?.botCustomBio || "မသတ်မှတ်ရသေးပါ";

    caption = `👑 **ADMIN PROFILE (${currentIndex + 1}/${totalPages})**\n\n🤖 **ရာထူး:** Bot Admin\n🗣 **အမည်:** ${botName}\n🆔 **User ID:** \`${botId}\`\n🌐 **Username:** ${botUsername}\n📝 **Bio:** ${botBio}`;
    mediaId = botProfile?.botPfMediaId;
    mediaType = botProfile?.botPfMediaType;
  } else {
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

    caption = `👑 **ADMIN PROFILE (${currentIndex + 1}/${totalPages})**\n\nရာထူး: ${roleText}\n👤 အမည်: ${name}\n🆔 User ID: \`${u.id}\`\n🌐 Username: ${username}\n📝 Bio: ${bio}`;
    
    try {
      const userPhotos = await ctx.api.getUserProfilePhotos(u.id, { limit: 1 });
      if (userPhotos.total_count > 0) {
        mediaId = userPhotos.photos[0][0].file_id;
        mediaType = 'photo';
      }
    } catch (e) {}
  }

  if (isEdit) {
    try {
      if (mediaId) {
        await ctx.editMessageMedia({
          type: mediaType === 'video' ? 'video' : 'photo',
          media: mediaId,
          caption: caption,
          parse_mode: 'Markdown'
        }, { reply_markup: keyboard });
      } else {
        await ctx.editMessageCaption({ caption, parse_mode: 'Markdown', reply_markup: keyboard });
      }
    } catch (e) {
      if (mediaId && mediaType === 'video') await ctx.replyWithVideo(mediaId, { caption, parse_mode: 'Markdown', reply_markup: keyboard });
      else if (mediaId) await ctx.replyWithPhoto(mediaId, { caption, parse_mode: 'Markdown', reply_markup: keyboard });
      else await ctx.reply(caption, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  } else {
    if (mediaId && mediaType === 'video') await ctx.replyWithVideo(mediaId, { caption, parse_mode: 'Markdown', reply_markup: keyboard });
    else if (mediaId) await ctx.replyWithPhoto(mediaId, { caption, parse_mode: 'Markdown', reply_markup: keyboard });
    else await ctx.reply(caption, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

async function unmuteUser(ctx, targetUserId, targetUserMention) {
  try {
    await ctx.api.restrictChatMember(ctx.chat.id, targetUserId, {
      permissions: {
        can_send_messages: true, can_send_audios: true, can_send_documents: true,
        can_send_photos: true, can_send_videos: true, can_send_video_notes: true,
        can_send_voice_notes: true, can_send_polls: true, can_send_other_messages: true,
        can_add_web_page_previews: true, can_change_info: true, can_invite_users: true,
        can_pin_messages: true
      }
    });
    await ctx.reply(`✅ Admin ကြီး ${targetUserMention} ၏ Mute ကို အချိုလေးနဲ့ ချက်ချင်း ဖြေပေးလိုက်ပါပြီနော် 😘✨`, { parse_mode: "HTML" });
  } catch (err) {
    await ctx.reply(`⚠️ Mute ဖြေပေးရာတွင် အဆင်မပြေပါ။`);
  }
}

function setupAdminToolsModule(bot) {

  // Global Message Handler
  bot.use(async (ctx, next) => {
    if (ctx.chat && ['group', 'supergroup'].includes(ctx.chat.type)) {
      
      // 1. Anti-Bot System
      if (ctx.message && ctx.message.new_chat_members && ctx.message.new_chat_members.length > 0) {
        const addedBots = ctx.message.new_chat_members.filter(m => m.is_bot);
        if (addedBots.length > 0) {
          const adderId = ctx.from.id;
          const adderIsAdmin = await isAdminOrOwner(ctx);

          if (!adderIsAdmin) {
            for (const botUser of addedBots) {
              try {
                await ctx.api.banChatMember(ctx.chat.id, botUser.id);
                await ctx.api.unbanChatMember(ctx.chat.id, botUser.id);
              } catch (e) {}
            }

            const untilDate = Math.floor(Date.now() / 1000) + (5 * 60);
            try {
              await ctx.api.restrictChatMember(ctx.chat.id, adderId, {
                permissions: {
                  can_send_messages: false, can_send_audios: false, can_send_documents: false,
                  can_send_photos: false, can_send_videos: false, can_send_video_notes: false,
                  can_send_voice_notes: false, can_send_polls: false, can_send_other_messages: false,
                  can_add_web_page_previews: false
                },
                until_date: untilDate
              });

              const adderName = ctx.from.first_name || "User";
              const adderMention = `<a href="tg://user?id=${adderId}">${adderName}</a>`;
              await ctx.reply(
                `⚠️ <b>Anti-Bot Warning! စည်းကမ်းချက် 🚨</b>\n\nဒီ Group ထဲမှာ Admin ခွင့်ပြုချက်မရှိဘဲ Bot တွေ လာထည့်ခွင့် လုံးဝမရှိပါဘူးရှင် 🚷\n${adderMention} ကို စည်းကမ်းဖောက်ဖျက်လို့ <b>(၅) မိနစ် Mute</b> ပိတ်ထားလိုက်ပါပြီ 😌✌️`,
                { parse_mode: "HTML" }
              );
            } catch (e) {}
            return;
          }
        }
      }

      // 2. Unmute Trigger via /tbot or @username reply
      if (ctx.message && ctx.message.text) {
        const isSenderAdmin = await isAdminOrOwner(ctx);
        if (isSenderAdmin && ctx.message.reply_to_message) {
          let shouldUnmute = false;
          let targetUser = ctx.message.reply_to_message.from;
          const text = ctx.message.text.trim();

          if (text.startsWith("/tbot")) {
            shouldUnmute = true;
          } else if (targetUser && targetUser.username && text.includes(`@${targetUser.username}`)) {
            shouldUnmute = true;
          }

          if (shouldUnmute && targetUser) {
            const name = targetUser.first_name || "User";
            const mention = `<a href="tg://user?id=${targetUser.id}">${name}</a>`;
            await unmuteUser(ctx, targetUser.id, mention);
          }
        }
      }

      // 3. Bad Words & Reactions
      if (ctx.message && ctx.message.text) {
        const text = ctx.message.text.trim();
        const hasBadWord = BAD_WORDS.some(word => text.includes(word));

        if (text.startsWith('/') || hasBadWord) {
          ctx.state = ctx.state || {};
          ctx.state.shouldSaveMemory = false;
        }

        if (hasBadWord) {
          try { await ctx.deleteMessage(); } catch (e) {}
          return await next();
        }

        try {
          const randomEmoji = REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
          await ctx.react([{ type: "emoji", emoji: randomEmoji }]);
        } catch (err) {}
      }
    }
    return await next();
  });

  // Bot Profile Owner Commands
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

  bot.command('setbotpfvideo', async (ctx) => {
    if (!isOwner(ctx)) return ctx.reply("❌ ဤ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။");
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) return ctx.reply("ကျေးဇူးပြု၍ Video ကို Reply ထောက်ပြီး `/setbotpfvideo` ဟု ရိုက်ပေးပါ။");
    
    const botProfile = await GlobalBotProfile.findOne({ key: "global_bot_profile" });
    if (botProfile && botProfile.botPfMediaId) {
      return ctx.reply("⚠️ ရှေ့က Bot Profile Media ရှိနှင့်ပြီးသားပါ။ အသစ်မထည့်ခင် ပထမဆုံး `/delbotpfmedia` ဖြင့် အရင်ဖျက်ပေးပါ။");
    }

    await GlobalBotProfile.findOneAndUpdate({ key: "global_bot_profile" }, { botPfMediaId: replyMsg.video.file_id, botPfMediaType: 'video' }, { upsert: true });
    await ctx.reply("✅ Bot Profile Video ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။");
  });

  bot.command('setbotpfphoto', async (ctx) => {
    if (!isOwner(ctx)) return ctx.reply("❌ ဤ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။");
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.photo || replyMsg.photo.length === 0) return ctx.reply("ကျေးဇူးပြု၍ Photo ကို Reply ထောက်ပြီး `/setbotpfphoto` ဟု ရိုက်ပေးပါ။");
    
    const botProfile = await GlobalBotProfile.findOne({ key: "global_bot_profile" });
    if (botProfile && botProfile.botPfMediaId) {
      return ctx.reply("⚠️ ရှေ့က Bot Profile Media ရှိနှင့်ပြီးသားပါ။ အသစ်မထည့်ခင် ပထမဆုံး `/delbotpfmedia` ဖြင့် အရင်ဖျက်ပေးပါ။");
    }

    const photo = replyMsg.photo[replyMsg.photo.length - 1];
    await GlobalBotProfile.findOneAndUpdate({ key: "global_bot_profile" }, { botPfMediaId: photo.file_id, botPfMediaType: 'photo' }, { upsert: true });
    await ctx.reply("✅ Bot Profile Photo ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။");
  });

  bot.command('delbotpfmedia', async (ctx) => {
    if (!isOwner(ctx)) return ctx.reply("❌ ဤ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။");
    await GlobalBotProfile.findOneAndUpdate({ key: "global_bot_profile" }, { $unset: { botPfMediaId: 1, botPfMediaType: 1 } });
    await ctx.reply("🗑 Bot Profile Media (Video/Photo) ကို အောင်မြင်စွာ ဖျက်လိုက်ပါပြီ။");
  });

  bot.command('delallbotinfo', async (ctx) => {
    if (!isOwner(ctx)) return ctx.reply("❌ ဤ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။");
    await GlobalBotProfile.findOneAndDelete({ key: "global_bot_profile" });
    await ctx.reply("🗑 Bot ၏ အချက်အလက်များနှင့် မီဒီယာအားလုံးကို အောင်မြင်စွာ အပြီးအပိုင် ရှင်းလင်းဖျက်ဆီးလိုက်ပါပြီ။");
  });

  // /adminpf (Anyone can use in Group)
  bot.command('adminpf', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("ဤ Command ကို Group ထဲတွင်သာ သုံးနိုင်ပါသည်။");
    await renderAdminProfilePage(ctx, 0, false);
  });

  bot.callbackQuery(/^apf_page_(\d+)$/, async (ctx) => {
    const pageIndex = parseInt(ctx.match[1], 10);
    await ctx.answerCallbackQuery().catch(() => {});
    await renderAdminProfilePage(ctx, pageIndex, true);
  });

  // Group Admin Commands (Must be in Group/Supergroup)
  bot.command(['promote', 'Promote'], async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg) return ctx.reply("ကျေးဇူးပြု၍ Admin ခန့်လိုသော မန်ဘာ၏ Message ကို Reply ထောက်၍ /promote ဟု ရိုက်ပေးပါ။");

    try {
      await ctx.promoteChatMember(replyMsg.from.id, {
        can_change_info: true, can_delete_messages: true, can_invite_users: true,
        can_restrict_members: true, can_pin_messages: true, can_manage_video_chats: true
      });

      const captionText = `👑✨ ${getUserMention(replyMsg.from)} လေးကို Gp ရဲ့ Admin အသစ်အဖြစ် ခန့်အပ်လိုက်ပါပြီရှင် တကယ့်ကို ဂုဏ်ယူပါတယ်နော် 🥳🎉`;
      const keyboard = new InlineKeyboard().text("❌ ပိတ်မည် ❌", "delete_admin_msg");
      const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });

      if (config && config.promoteVideoId) {
        try {
          await ctx.replyWithVideo(config.promoteVideoId, { caption: captionText, reply_markup: keyboard, parse_mode: 'Markdown' });
          return;
        } catch (e) {}
      }
      await ctx.reply(captionText, { reply_markup: keyboard, parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply("❌ Admin ခန့်ရန် မအောင်မြင်ပါ။");
    }
  });

  bot.command(['demote', 'Demote'], async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg) return ctx.reply("ကျေးဇူးပြု၍ Admin ဖြုတ်လိုသော မန်ဘာ၏ Message ကို Reply ထောက်၍ /demote ဟု ရိုက်ပေးပါ။");

    try {
      await ctx.promoteChatMember(replyMsg.from.id, {
        can_change_info: false, can_post_messages: false, can_edit_messages: false,
        can_delete_messages: false, can_invite_users: false, can_restrict_members: false,
        can_pin_messages: false, can_promote_members: false, can_manage_video_chats: false
      });

      const captionText = `⚠️ စိတ်မကောင်းပေမယ့် ${getUserMention(replyMsg.from)} ရဲ့ Admin ရာထူးကို ပြန်လည်သိမ်းဆည်းလိုက်ပါပြီနော် 🌪️`;
      const keyboard = new InlineKeyboard().text("❌ ပိတ်မည် ❌", "delete_admin_msg");
      const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });

      if (config && config.demoteVideoId) {
        try {
          await ctx.replyWithVideo(config.demoteVideoId, { caption: captionText, reply_markup: keyboard, parse_mode: 'Markdown' });
          return;
        } catch (e) {}
      }
      await ctx.reply(captionText, { reply_markup: keyboard, parse_mode: 'Markdown' });
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
      const statusText = isPromoted ? "👑 Admin အသစ် ခန့်အပ်ခြင်းခံရပါပြီ 🥳" : "❌ Admin ရာထူးမှ ဖယ်ရှားခြင်းခံရပါပြီ 🌪️";
      const keyboard = new InlineKeyboard().text("❌ ပိတ်မည် ❌", "delete_admin_msg");

      const message = 
`📢 **Admin အပြောင်းအလဲ သတင်းပါရှင် ✨**

📌 **အခြေအနေ:** ${statusText}

👤 **သက်ဆိုင်သူ အချက်အလက်:**
• **အမည်:** ${targetUser.first_name} ${targetUser.last_name || ''}
• **ID:** \`${targetUser.id}\`
• **Username:** ${targetUser.username ? `@${targetUser.username}` : 'မရှိပါ'}

🛠 **ဆောင်ရွက်ပေးသော Admin/Owner:**
• **အမည်:** ${actorUser.first_name} ${actorUser.last_name || ''}
• **ID:** \`${actorUser.id}\`
• **Username:** ${actorUser.username ? `@${actorUser.username}` : 'မရှိပါ'}`;

      await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: keyboard });
    }
  });

  // Ban, Mute, Unmute Commands
  bot.command(['ban', 'Ban'], async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg) return ctx.reply("ကျေးဇူးပြု၍ Ban လိုသော သူ၏ Message ကို Reply ထောက်၍ /ban ဟု ပို့ပါ။");

    try {
      await ctx.banChatMember(replyMsg.from.id);
      const captionText = 
`🚨-- 𝑩𝑨𝑵 𝑺𝒀𝑺𝑻𝑬𝑴 --🚨
ဒီ Group ရဲ့ စည်းကမ်းတွေကို ဖောက်ဖျက်လို့ ထာဝရ နှင်ထုတ်လိုက်ပါပြီရှင် 🍃😌

🚫 **နှင်ထုတ်ခံရသူ** - ${getUserMention(replyMsg.from)}
👮‍♂️ **ဆောင်ရွက်သူ** - ${getUserMention(ctx.from)}`;

      const keyboard = new InlineKeyboard().text("❌ ပိတ်မည် ❌", "delete_admin_msg");
      const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });

      if (config && config.banVideoId) {
        try {
          await ctx.replyWithVideo(config.banVideoId, { caption: captionText, reply_markup: keyboard, parse_mode: 'Markdown' });
          return;
        } catch (e) {}
      }
      await ctx.reply(captionText, { reply_markup: keyboard, parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply("❌ မန်ဘာအား Ban ရာတွင် အဆင်မပြေပါ။");
    }
  });

  bot.command(['mute', 'Mute'], async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg) return ctx.reply("ကျေးဇူးပြု၍ Mute လိုသော သူ၏ Message ကို Reply ထောက်၍ /mute ဟု ပို့ပါ။");

    try {
      await ctx.restrictChatMember(replyMsg.from.id, { can_send_messages: false });
      const captionText = 
`🚨-- 𝑴𝑼𝑻𝑬 𝑺𝒀𝑺𝑻𝑬𝑴 --🚨
စကားအလွန်များပြီး အမြင်ကပ်လာလို့ ပါးစပ်ခဏပိတ်ထားခိုင်းလိုက်ပါပြီနော် 🤭🤭🤫

🤐 **ငြိမ်နေရမည့်သူ** - ${getUserMention(replyMsg.from)}
🔕 **ပိတ်ခိုင်းသူ** - ${getUserMention(ctx.from)}`;

      const keyboard = new InlineKeyboard().text("❌ ပိတ်မည် ❌", "delete_admin_msg");
      const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });

      if (config && config.muteVideoId) {
        try {
          await ctx.replyWithVideo(config.muteVideoId, { caption: captionText, reply_markup: keyboard, parse_mode: 'Markdown' });
          return;
        } catch (e) {}
      }
      await ctx.reply(captionText, { reply_markup: keyboard, parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply("❌ မန်ဘာအား Mute ရာတွင် အဆင်မပြေပါ။");
    }
  });

  bot.command(['umute', 'Umute', 'UMute'], async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg) return ctx.reply("ကျေးဇူးပြု၍ Unmute လိုသော သူ၏ Message ကို Reply ထောက်၍ /umute ဟု ပို့ပါ။");

    try {
      await ctx.restrictChatMember(replyMsg.from.id, {
        can_send_messages: true, can_send_media_messages: true,
        can_send_other_messages: true, can_add_web_page_previews: true
      });
      const captionText = 
`🚨-- 𝑼𝑵𝑴𝑼𝑻𝑬 𝑺𝒀𝑺𝑻𝑬𝑴 --🚨
မျက်နှာချိုပြီး ချွဲလို့ စာပို့ခွင့် ပြန်လွှတ်ပေးလိုက်ပါရှင် 🙂😜✨

🔓 **ပြန်လွတ်လာသူ** - ${getUserMention(replyMsg.from)} 🤭🤭
🎉 **လွှတ်ပေးသူ** - ${getUserMention(ctx.from)} 🤓`;

      const keyboard = new InlineKeyboard().text("❌ ပိတ်မည် ❌", "delete_admin_msg");
      const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });

      if (config && config.unmuteVideoId) {
        try {
          await ctx.replyWithVideo(config.unmuteVideoId, { caption: captionText, reply_markup: keyboard, parse_mode: 'Markdown' });
          return;
        } catch (e) {}
      }
      await ctx.reply(captionText, { reply_markup: keyboard, parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply("❌ မန်ဘာအား Unmute ရာတွင် အဆင်မပြေပါ။");
    }
  });

  bot.command('tbot', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    if (!ctx.message.reply_to_message) return ctx.reply("💡 Mute ဖြစ်နေသူ၏ Message ကို Reply ထောက်၍ `/tbot` ဟု ရိုက်ပေးပါ။");
    const targetUser = ctx.message.reply_to_message.from;
    const mention = `<a href="tg://user?id=${targetUser.id}">${targetUser.first_name || "User"}</a>`;
    await unmuteUser(ctx, targetUser.id, mention);
  });

  // Video Setter Commands
  bot.command('bvideo', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) return ctx.reply("ကျေးဇူးပြု၍ Video ကို Reply ထောက်ပြီး `/bvideo` ဟု ပို့ပါ။");

    const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });
    if (config && config.banVideoId) {
      return ctx.reply("⚠️ Ban ဗီဒီယို ရှိနှင့်ပြီးသားပါ။ အသစ်မထည့်ခင် ပထမဆုံး `/delbvideo` ဖြင့် အရင်ဖျက်ပေးပါ။");
    }

    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { banVideoId: replyMsg.video.file_id }, { upsert: true });
    await ctx.reply("✅ Ban Video ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။");
  });

  bot.command('mvideo', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) return ctx.reply("ကျေးဇူးပြု၍ Video ကို Reply ထောက်ပြီး `/mvideo` ဟု ပို့ပါ။");

    const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });
    if (config && config.muteVideoId) {
      return ctx.reply("⚠️ Mute ဗီဒီယို ရှိနှင့်ပြီးသားပါ။ အသစ်မထည့်ခင် ပထမဆုံး `/delmvideo` ဖြင့် အရင်ဖျက်ပေးပါ။");
    }

    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { muteVideoId: replyMsg.video.file_id }, { upsert: true });
    await ctx.reply("✅ Mute Video ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။");
  });

  bot.command('uvideo', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) return ctx.reply("ကျေးဇူးပြု၍ Video ကို Reply ထောက်ပြီး `/uvideo` ဟု ပို့ပါ။");

    const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });
    if (config && config.unmuteVideoId) {
      return ctx.reply("⚠️ Unmute ဗီဒီယို ရှိနှင့်ပြီးသားပါ။ အသစ်မထည့်ခင် ပထမဆုံး `/deluvideo` ဖြင့် အရင်ဖျက်ပေးပါ။");
    }

    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { unmuteVideoId: replyMsg.video.file_id }, { upsert: true });
    await ctx.reply("✅ Unmute Video ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။");
  });

  bot.command('pvideo', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) return ctx.reply("ကျေးဇူးပြု၍ Video ကို Reply ထောက်ပြီး `/pvideo` ဟု ပို့ပါ။");

    const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });
    if (config && config.promoteVideoId) {
      return ctx.reply("⚠️ Promote ဗီဒီယို ရှိနှင့်ပြီးသားပါ။ အသစ်မထည့်ခင် ပထမဆုံး `/delpvideo` ဖြင့် အရင်ဖျက်ပေးပါ။");
    }

    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { promoteVideoId: replyMsg.video.file_id }, { upsert: true });
    await ctx.reply("✅ Promote Video ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။");
  });

  bot.command('dvideo', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) return ctx.reply("ကျေးဇူးပြု၍ Video ကို Reply ထောက်ပြီး `/dvideo` ဟု ပို့ပါ။");

    const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });
    if (config && config.demoteVideoId) {
      return ctx.reply("⚠️ Demote ဗီဒီယို ရှိနှင့်ပြီးသားပါ။ အသစ်မထည့်ခင် ပထမဆုံး `/deldvideo` ဖြင့် အရင်ဖျက်ပေးပါ။");
    }

    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { demoteVideoId: replyMsg.video.file_id }, { upsert: true });
    await ctx.reply("✅ Demote Video ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။");
  });

  // Video Show Commands
  bot.command('showbvideo', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });
    if (!config || !config.banVideoId) return ctx.reply("❌ Ban Video သတ်မှတ်ထားခြင်း မရှိသေးပါ။");
    await ctx.replyWithVideo(config.banVideoId, { caption: "🎬 လက်ရှိသတ်မှတ်ထားသော Ban Video ပါ။" });
  });

  bot.command('showmvideo', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });
    if (!config || !config.muteVideoId) return ctx.reply("❌ Mute Video သတ်မှတ်ထားခြင်း မရှိသေးပါ။");
    await ctx.replyWithVideo(config.muteVideoId, { caption: "🎬 လက်ရှိသတ်မှတ်ထားသော Mute Video ပါ။" });
  });

  bot.command('showuvideo', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });
    if (!config || !config.unmuteVideoId) return ctx.reply("❌ Unmute Video သတ်မှတ်ထားခြင်း မရှိသေးပါ။");
    await ctx.replyWithVideo(config.unmuteVideoId, { caption: "🎬 လက်ရှိသတ်မှတ်ထားသော Unmute Video ပါ။" });
  });

  bot.command('showpvideo', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });
    if (!config || !config.promoteVideoId) return ctx.reply("❌ Promote Video သတ်မှတ်ထားခြင်း မရှိသေးပါ။");
    await ctx.replyWithVideo(config.promoteVideoId, { caption: "🎬 လက်ရှိသတ်မှတ်ထားသော Promote Video ပါ။" });
  });

  bot.command('showdvideo', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    const config = await AdminToolsConfig.findOne({ chatId: ctx.chat.id });
    if (!config || !config.demoteVideoId) return ctx.reply("❌ Demote Video သတ်မှတ်ထားခြင်း မရှိသေးပါ။");
    await ctx.replyWithVideo(config.demoteVideoId, { caption: "🎬 လက်ရှိသတ်မှတ်ထားသော Demote Video ပါ။" });
  });

  // Video Deletion Commands
  bot.command('delbvideo', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { $unset: { banVideoId: 1 } });
    await ctx.reply("🗑 Ban Video ကို ဖျက်လိုက်ပါပြီ။");
  });

  bot.command('delmvideo', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { $unset: { muteVideoId: 1 } });
    await ctx.reply("🗑 Mute Video ကို ဖျက်လိုက်ပါပြီ။");
  });

  bot.command('deluvideo', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { $unset: { unmuteVideoId: 1 } });
    await ctx.reply("🗑 Unmute Video ကို ဖျက်လိုက်ပါပြီ။");
  });

  bot.command('delpvideo', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { $unset: { promoteVideoId: 1 } });
    await ctx.reply("🗑 Promote Video ကို ဖျက်လိုက်ပါပြီ။");
  });

  bot.command('deldvideo', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply("❌ ဤ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    if (!(await isAdminOrOwner(ctx))) return;
    await AdminToolsConfig.findOneAndUpdate({ chatId: ctx.chat.id }, { $unset: { demoteVideoId: 1 } });
    await ctx.reply("🗑 Demote Video ကို ဖျက်လိုက်ပါပြီ။");
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
