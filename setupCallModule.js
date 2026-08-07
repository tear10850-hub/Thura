const ChatStore = require('./models/ChatStore');

const emojis = ["😘", "😊", "🤭", "😻", "🔥", "✨", "🌸", "⭐", "🎉", "💖", "💫", "🌟", "🎈", "❤️"];
const reactionEmojis = [
  "👍", "❤️", "🔥", "🥰", "👏", "🎉", "🤩", "✨", "💯", "😍", 
  "💘", "💖", "💗", "💓", "💞", "💕", "💌", "❣️", "🥳", "😇", 
  "⚡", "🌈", "⭐", "🌟", "🤗", "🥹", "🤝", "🙌", "👑", "🍀"
];

const adminProfilesCache = new Map();

function getUserMention(userId, emojiIndex) {
  const emoji = emojis[emojiIndex % emojis.length];
  return `<a href="tg://user?id=${userId}">${emoji}</a>`;
}

// ၃ မိနစ် (၁၈၀ စက္ကန့်) ဖြင့် အလိုအလျောက် စာဖျက်ပေးမည့် Helper Function
function scheduleAutoDelete(ctx, messageId, chatId = null, delay = 3 * 60 * 1000) {
  setTimeout(async () => {
    try {
      const targetChatId = chatId || ctx.chat.id;
      await ctx.api.deleteMessage(targetChatId, messageId);
    } catch (e) {}
  }, delay);
}

// Admin Card Helper
async function generateAdminCard(ctx, admins, index) {
  const total = admins.length;
  const admin = admins[index];
  const user = admin.user;

  let bio = "မရှိပါ";
  try {
    const fullUser = await ctx.api.getChat(user.id);
    if (fullUser.bio) bio = fullUser.bio;
  } catch (e) {}

  let photoFileId = null;
  try {
    const userPhotos = await ctx.api.getUserProfilePhotos(user.id, { limit: 1 });
    if (userPhotos.total_count > 0) photoFileId = userPhotos.photos[0][0].file_id;
  } catch (e) {}

  const role = admin.status === 'creator' ? '👑 Owner (Group ဖန်တီးသူ)' : '🛡 Admin';
  const name = user.first_name + (user.last_name ? ` ${user.last_name}` : '');
  const username = user.username ? `@${user.username}` : 'မရှိပါ';
  const mention = `<a href="tg://user?id=${user.id}">${name}</a>`;
  const customTitle = admin.custom_title ? ` [${admin.custom_title}]` : '';

  const caption = 
`👑 <b>ADMIN PROFILE (${index + 1}/${total})</b>

<b>ရာထူး:</b> ${role}${customTitle}
👤 <b>အမည်:</b> ${mention}
🆔 <b>User ID:</b> <code>${user.id}</code>
🌐 <b>Username:</b> ${username}
📝 <b>Bio:</b> ${bio}`;

  const buttons = [];
  const navRow = [];

  if (index > 0) navRow.push({ text: "⬅️ မူလ/ရှေ့", callback_data: `adminpf_page_${index - 1}` });
  if (index < total - 1) navRow.push({ text: "နောက်သို့ ➡️", callback_data: `adminpf_page_${index + 1}` });

  if (navRow.length > 0) buttons.push(navRow);
  buttons.push([{ text: "❌ ပိတ်မည် ❌", callback_data: "delete_this_msg" }]);

  return { caption, photoFileId, keyboard: { inline_keyboard: buttons } };
}

function setupCallModule(bot, OWNER_ID) {

  // ၁။ Chat ID များ သိမ်းဆည်းခြင်း Middleware
  bot.on(['message', 'channel_post'], async (ctx, next) => {
    try {
      if (ctx.chat) {
        let type = ctx.chat.type;
        if (type === 'supergroup') type = 'group';

        await ChatStore.updateOne(
          { chatId: ctx.chat.id },
          { type: type },
          { upsert: true }
        );
      }
    } catch (err) {
      console.error("[ChatStore Save Error]:", err.message);
    }
    return next();
  });

  // ၂။ Auto Reaction
  bot.on('message', async (ctx, next) => {
    if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
      try {
        const randomEmoji = reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];
        await ctx.react(randomEmoji);
      } catch (e) {}
    }
    return next();
  });

  // 🟢 Bcast Control Commands (/Bcastopen & /Bcasttear)
  bot.command(['Bcastopen', 'bcastopen'], async (ctx) => {
    if (ctx.from.id !== Number(OWNER_ID)) return;
    global.isBcastAutoDelete = false; 
    const sent = await ctx.reply("🔓 Bcast Open Mode ဖွင့်လိုက်ပါပြီ။ Bcast ကြော်ငြာစာများကို မည်သည့်အခါမျှ အလိုအလျောက် ဖျက်မည်မဟုတ်ပါ။", { reply_parameters: { message_id: ctx.message.message_id } });
    scheduleAutoDelete(ctx, sent.message_id);
    scheduleAutoDelete(ctx, ctx.message.message_id);
  });

  bot.command(['Bcasttear', 'bcasttear'], async (ctx) => {
    if (ctx.from.id !== Number(OWNER_ID)) return;
    global.isBcastAutoDelete = true; 
    const sent = await ctx.reply("🔒 Bcast Tear Mode ဖွင့်လိုက်ပါပြီ။ Bcast ကြော်ငြာစာများကို ပို့ပြီး (၅) နာရီ (၃) မိနစ်အကြာတွင် အလိုအလျောက် ဖျက်ပေးပါမည်။", { reply_parameters: { message_id: ctx.message.message_id } });
    scheduleAutoDelete(ctx, sent.message_id);
    scheduleAutoDelete(ctx, ctx.message.message_id);
  });

  // ၃။ Owner သီးသန့် ကြော်ငြာ ပို့သည့် (/bcast) Command
  bot.command(['bcast', 'Bcast'], async (ctx) => {
    const senderId = ctx.from.id;

    if (senderId !== Number(OWNER_ID)) {
      const sent = await ctx.reply("❌ ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။");
      scheduleAutoDelete(ctx, sent.message_id);
      scheduleAutoDelete(ctx, ctx.message.message_id);
      return;
    }

    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg) {
      const sent = await ctx.reply("⚠️ ကြော်ငြာပို့လိုသော စာ/ဓာတ်ပုံ/Video ကို Reply ထောက်ပြီး /bcast ဟု ရိုက်နှိပ်ပါ။");
      scheduleAutoDelete(ctx, sent.message_id);
      scheduleAutoDelete(ctx, ctx.message.message_id);
      return;
    }

    const allChats = await ChatStore.find({});

    const groupChats = allChats.filter(c => c.type === 'group');
    const channelChats = allChats.filter(c => c.type === 'channel');
    const memberChats = allChats.filter(c => c.type === 'private');

    const infoSent = await ctx.reply(
`ကြောညာစတင်ပို့ဆောင်နေပါပီရှင့်⏳
Group(${groupChats.length})/Channel(${channelChats.length})/Mamber chat(${memberChats.length})သို့......`
    );
    scheduleAutoDelete(ctx, infoSent.message_id);
    scheduleAutoDelete(ctx, ctx.message.message_id);

    const sentTime = Math.floor(Date.now() / 1000);

    const deleteButtonKeyboard = {
      inline_keyboard: [[{ text: "❌ကြောညာ❌", callback_data: `delete_bcast_${sentTime}` }]]
    };

    try {
      const selfAd = await ctx.api.copyMessage(ctx.chat.id, ctx.chat.id, replyMsg.message_id, {
        reply_markup: deleteButtonKeyboard
      });
      if (global.isBcastAutoDelete) {
        const FIVE_HOURS_THREE_MINS = (5 * 60 + 3) * 60 * 1000;
        scheduleAutoDelete(ctx, selfAd.message_id, ctx.chat.id, FIVE_HOURS_THREE_MINS);
      }
    } catch (e) {}

    const success = { group: 0, channel: 0, member: 0 };
    const failed = { group: 0, channel: 0, member: 0 };

    for (const target of allChats) {
      try {
        const sentMsg = await ctx.api.copyMessage(target.chatId, ctx.chat.id, replyMsg.message_id, {
          reply_markup: deleteButtonKeyboard
        });
        
        if (target.type === 'group') success.group++;
        else if (target.type === 'channel') success.channel++;
        else if (target.type === 'private') success.member++;

        if (global.isBcastAutoDelete) {
          const FIVE_HOURS_THREE_MINS = (5 * 60 + 3) * 60 * 1000;
          scheduleAutoDelete(ctx, sentMsg.message_id, target.chatId, FIVE_HOURS_THREE_MINS);
        }

      } catch (err) {
        if (target.type === 'group') failed.group++;
        else if (target.type === 'channel') failed.channel++;
        else if (target.type === 'private') failed.member++;
      }

      await new Promise(r => setTimeout(r, 50));
    }

    const reportMessage = 
`အောင်မြင်သည့်⌛
Group(${success.group})/Channel(${success.channel})/Mamber chat(${success.member})သို့🍃🍂ရောက်ရှိသွားပါပီ။

ကျရူံး❌
Group(${failed.group})/Channel(${failed.channel})/Mamber chat(${failed.member})မရောက်ပါရှင့်💔😪`;

    const reportSent = await ctx.reply(reportMessage);
    scheduleAutoDelete(ctx, reportSent.message_id, ctx.chat.id, 3 * 60 * 1000);
  });

  // ၄။ /admin Command
  bot.command('admin', async (ctx) => {
    scheduleAutoDelete(ctx, ctx.message.message_id);

    if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
      const sent = await ctx.reply("❌ ဒီ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
      scheduleAutoDelete(ctx, sent.message_id);
      return;
    }

    const customText = ctx.match ? ctx.match.trim() : "";
    const callerMention = getUserMention(ctx.from.id, 0);

    let administrators = [];
    try {
      administrators = await ctx.getChatAdministrators();
    } catch (err) {
      const sent = await ctx.reply("❌ Admin စာရင်းဆွဲယူရာတွင် အမှားအယွင်းရှိနေပါသည်။");
      scheduleAutoDelete(ctx, sent.message_id);
      return;
    }

    const realAdmins = administrators.filter(admin => !admin.user.is_bot);
    if (realAdmins.length === 0) {
      const sent = await ctx.reply("❌ ဒီ Group ထဲတွင် Admin မရှိပါ။");
      scheduleAutoDelete(ctx, sent.message_id);
      return;
    }

    const infoSent = await ctx.reply(`အက်ဒမင်များကို စတင်ခေါ်ဆိုနေပါပီရှင့်⏳\n0.2sဖြင့်.....📪`);
    scheduleAutoDelete(ctx, infoSent.message_id);

    let calledCount = 0;
    let emojiCounter = 0;

    for (let i = 0; i < realAdmins.length; i += 4) {
      const chunk = realAdmins.slice(i, i + 4);
      let tagLine = "";

      chunk.forEach((adminObj, idx) => {
        const admin = adminObj.user;
        const emojiTag = getUserMention(admin.id, emojiCounter++);
        tagLine += `[${idx + 1}-(${emojiTag})]`;
      });

      const messageText = customText ? `${tagLine}\n${customText}` : tagLine;
      
      try {
        const rMsg = await ctx.reply(messageText, { parse_mode: 'HTML' });
        scheduleAutoDelete(ctx, rMsg.message_id);
        calledCount += chunk.length;
      } catch (e) {}

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const keyboard = {
      inline_keyboard: [[{ text: "❌Dcall❌", callback_data: "delete_this_msg" }]]
    };

    const summaryText = `ခေါ်ဆိုမှုပီးသွားပါပီရှင့်⌛\nစုစုပေါင်းခေါ်ဆိုသည့် Admin ဦးရေ(${calledCount})📭\nခေါ်ဆိုသူ😙--${callerMention}\nBy Tear......📮`;
    const summarySent = await ctx.reply(summaryText, { parse_mode: 'HTML', reply_markup: keyboard });
    scheduleAutoDelete(ctx, summarySent.message_id);
  });

  // ၅။ /adminpf Command
  bot.command(['adminpf', 'adminprofile'], async (ctx) => {
    scheduleAutoDelete(ctx, ctx.message.message_id);

    if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
      const sent = await ctx.reply("❌ ဒီ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
      scheduleAutoDelete(ctx, sent.message_id);
      return;
    }

    try {
      const administrators = await ctx.getChatAdministrators();
      const realAdmins = administrators.filter(admin => !admin.user.is_bot);

      realAdmins.sort((a, b) => {
        if (a.status === 'creator') return -1;
        if (b.status === 'creator') return 1;
        return 0;
      });

      if (realAdmins.length === 0) {
        const sent = await ctx.reply("❌ Group ထဲတွင် Admin မရှိပါ။");
        scheduleAutoDelete(ctx, sent.message_id);
        return;
      }

      adminProfilesCache.set(ctx.chat.id, realAdmins);
      const card = await generateAdminCard(ctx, realAdmins, 0);

      let sentMsg;
      if (card.photoFileId) {
        sentMsg = await ctx.replyWithPhoto(card.photoFileId, {
          caption: card.caption,
          parse_mode: 'HTML',
          reply_markup: card.keyboard
        });
      } else {
        sentMsg = await ctx.reply(card.caption, {
          parse_mode: 'HTML',
          reply_markup: card.keyboard
        });
      }
      scheduleAutoDelete(ctx, sentMsg.message_id);

    } catch (e) {
      const sent = await ctx.reply("❌ Admin Profile များ ဆွဲယူရာတွင် အမှားအယွင်း ရှိနေပါသည်။");
      scheduleAutoDelete(ctx, sent.message_id);
    }
  });

  // ၆။ Inline Buttons Handling
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;
    const chatId = ctx.chat?.id;

    if (data.startsWith("delete_bcast_")) {
      if (!global.isBcastAutoDelete) {
        const isOwner = userId === Number(OWNER_ID);
        let isAdmin = false;

        if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
          try {
            const memberInfo = await ctx.getChatMember(userId);
            isAdmin = ['administrator', 'creator'].includes(memberInfo.status);
          } catch (e) {}
        } else if (ctx.chat.type === 'private') {
          isAdmin = true;
        }

        if (!isOwner && !isAdmin) {
          return ctx.answerCallbackQuery({ text: "❌ Admin သို့မဟုတ် Owner သာ စာများကို ဖျက်နိုင်ပါသည်။", show_alert: true });
        }

        try {
          await ctx.deleteMessage();
        } catch (e) {
          ctx.answerCallbackQuery({ text: "စာဖျက်၍ မရပါ။" });
        }
        return;
      }

      const sentTime = parseInt(data.split('_')[2]);
      const currentTime = Math.floor(Date.now() / 1000);
      const targetDurationSeconds = (5 * 60 + 3) * 60; 

      const elapsedTime = currentTime - sentTime;
      if (elapsedTime < targetDurationSeconds) {
        const remainingSeconds = targetDurationSeconds - elapsedTime;
        const hoursLeft = Math.floor(remainingSeconds / 3600);
        const minutesLeft = Math.floor((remainingSeconds % 3600) / 60);

        return ctx.answerCallbackQuery({
          text: `⏳ ဒီကြော်ငြာကို ပို့ပြီး (၅) နာရီ (၃) မိနစ် ပြည့်မှသာ ဖျက်လို့ရပါမည်။\n(ကျန်ရှိချိန်: ${hoursLeft} နာရီ ${minutesLeft} မိနစ်)`,
          show_alert: true
        });
      }

      const isOwner = userId === Number(OWNER_ID);
      let isAdmin = false;

      if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
        try {
          const memberInfo = await ctx.getChatMember(userId);
          isAdmin = ['administrator', 'creator'].includes(memberInfo.status);
        } catch (e) {}
      } else if (ctx.chat.type === 'private') {
        isAdmin = true;
      }

      if (!isOwner && !isAdmin) {
        return ctx.answerCallbackQuery({ text: "❌ Admin သို့မဟုတ် Owner သာ စာများကို ဖျက်နိုင်ပါသည်။", show_alert: true });
      }

      try {
        await ctx.deleteMessage();
      } catch (e) {
        ctx.answerCallbackQuery({ text: "စာဖျက်၍ မရပါ။" });
      }
      return;
    }

    if (data.startsWith('adminpf_page_')) {
      const targetIndex = parseInt(data.split('_')[2]);
      const admins = adminProfilesCache.get(chatId);

      if (!admins || !admins[targetIndex]) {
        return ctx.answerCallbackQuery({ text: "⚠️ Profile အချက်အလက်များ သက်တမ်းကုန်သွားပါပြီ။ /adminpf ကို ပြန်လည်နှိပ်ပါ။", show_alert: true });
      }

      await ctx.answerCallbackQuery();
      const card = await generateAdminCard(ctx, admins, targetIndex);

      try {
        let editedMsg;
        if (card.photoFileId) {
          editedMsg = await ctx.editMessageMedia({
            type: 'photo',
            media: card.photoFileId,
            caption: card.caption,
            parse_mode: 'HTML'
          }, { reply_markup: card.keyboard });
        } else {
          editedMsg = await ctx.editMessageText(card.caption, {
            parse_mode: 'HTML',
            reply_markup: card.keyboard
          });
        }
        if (editedMsg && editedMsg.message_id) {
          scheduleAutoDelete(ctx, editedMsg.message_id);
        }
      } catch (err) {
        try {
          await ctx.deleteMessage();
          let rMsg;
          if (card.photoFileId) {
            rMsg = await ctx.replyWithPhoto(card.photoFileId, { caption: card.caption, parse_mode: 'HTML', reply_markup: card.keyboard });
          } else {
            rMsg = await ctx.reply(card.caption, { parse_mode: 'HTML', reply_markup: card.keyboard });
          }
          if (rMsg) scheduleAutoDelete(ctx, rMsg.message_id);
        } catch (e) {}
      }
      return;
    }

    if (data === "delete_this_msg") {
      const isOwner = userId === Number(OWNER_ID);
      let isAdmin = false;

      try {
        const memberInfo = await ctx.getChatMember(userId);
        isAdmin = ['administrator', 'creator'].includes(memberInfo.status);
      } catch (e) {}

      if (!isOwner && !isAdmin) {
        return ctx.answerCallbackQuery({ text: "❌ Admin သို့မဟုတ် Owner သာ စာများကို ဖျက်နိုင်ပါသည်။", show_alert: true });
      }

      try {
        await ctx.deleteMessage();
      } catch (e) {}
    }
  });
}

module.exports = setupCallModule;
