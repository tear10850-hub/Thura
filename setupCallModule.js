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
    global.isBcastAutoDelete = false; // 🔓 ကြော်ငြာများကို မဖျက်တော့ပါ
    const sent = await ctx.reply("🔓 Bcast Open Mode ဖွင့်လိုက်ပါပြီ။ Bcast ကြော်ငြာစာများကို မည်သည့်အခါမျှ အလိုအလျောက် ဖျက်မည်မဟုတ်ပါ။", { reply_parameters: { message_id: ctx.message.message_id } });
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
  });

  bot.command(['Bcasttear', 'bcasttear'], async (ctx) => {
    if (ctx.from.id !== Number(OWNER_ID)) return;
    global.isBcastAutoDelete = true; // 🔒 ကြော်ငြာများကို ၅ နာရီ ၃ မိနစ်မှ ဖျက်မည်
    const sent = await ctx.reply("🔒 Bcast Tear Mode ဖွင့်လိုက်ပါပြီ။ Bcast ကြော်ငြာစာများကို ပို့ပြီး (၅) နာရီ (၃) မိနစ်အကြာတွင် အလိုအလျောက် ဖျက်ပေးပါမည်။", { reply_parameters: { message_id: ctx.message.message_id } });
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
  });

  // ၃။ Owner သီးသန့် ကြော်ငြာ ပို့သည့် (/bcast) Command
  bot.command(['bcast', 'Bcast'], async (ctx) => {
    const senderId = ctx.from.id;

    if (senderId !== Number(OWNER_ID)) {
      return ctx.reply("❌ ဒီ Command ကို Bot Owner သာ အသုံးပြုနိုင်ပါသည်။");
    }

    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg) {
      return ctx.reply("⚠️ ကြော်ငြာပို့လိုသော စာ/ဓာတ်ပုံ/Video ကို Reply ထောက်ပြီး /bcast ဟု ရိုက်နှိပ်ပါ။");
    }

    const allChats = await ChatStore.find({});

    const groupChats = allChats.filter(c => c.type === 'group');
    const channelChats = allChats.filter(c => c.type === 'channel');
    const memberChats = allChats.filter(c => c.type === 'private');

    await ctx.reply(
`ကြောညာစတင်ပို့ဆောင်နေပါပီရှင့်⏳
Group(${groupChats.length})/Channel(${channelChats.length})/Mamber chat(${memberChats.length})သို့......`
    );

    const sentTime = Math.floor(Date.now() / 1000);

    const deleteButtonKeyboard = {
      inline_keyboard: [[{ text: "❌ကြောညာ❌", callback_data: `delete_bcast_${sentTime}` }]]
    };

    // မူလ ပို့မည့် ကြော်ငြာကို ပြန်ပြခြင်း
    try {
      const selfAd = await ctx.api.copyMessage(ctx.chat.id, ctx.chat.id, replyMsg.message_id, {
        reply_markup: deleteButtonKeyboard
      });
      // Bcasttear ဖြစ်နေပါက မိမိ Chat ထဲရှိ ကြော်ငြာကိုပါ ၅ နာရီ ၃ မိနစ်မှ ဖျက်မည်
      if (global.isBcastAutoDelete && global.autoDeleteMessage) {
        const FIVE_HOURS_THREE_MINS = (5 * 60 + 3) * 60 * 1000;
        global.autoDeleteMessage(ctx, selfAd.message_id, FIVE_HOURS_THREE_MINS);
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

        // 🟢 Bcasttear Mode ဖြစ်ပါက ၅ နာရီ ၃ မိနစ် (၃၀၃ မိနစ်) ကြာလျှင် Automatic ဖျက်ခိုင်းခြင်း
        if (global.isBcastAutoDelete && global.autoDeleteMessage) {
          const FIVE_HOURS_THREE_MINS = (5 * 60 + 3) * 60 * 1000;
          setTimeout(async () => {
            try {
              await ctx.api.deleteMessage(target.chatId, sentMsg.message_id);
            } catch (err) {}
          }, FIVE_HOURS_THREE_MINS);
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
    if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, reportSent.message_id, 3 * 60 * 1000);
  });

  // ၄။ /admin Command
  bot.command('admin', async (ctx) => {
    if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
      return ctx.reply("❌ ဒီ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    }

    const customText = ctx.match ? ctx.match.trim() : "";
    const callerMention = getUserMention(ctx.from.id, 0);

    let administrators = [];
    try {
      administrators = await ctx.getChatAdministrators();
    } catch (err) {
      return ctx.reply("❌ Admin စာရင်းဆွဲယူရာတွင် အမှားအယွင်းရှိနေပါသည်။");
    }

    const realAdmins = administrators.filter(admin => !admin.user.is_bot);
    if (realAdmins.length === 0) return ctx.reply("❌ ဒီ Group ထဲတွင် Admin မရှိပါ။");

    await ctx.reply(`အက်ဒမင်များကို စတင်ခေါ်ဆိုနေပါပီရှင့်⏳\n0.2sဖြင့်.....📪`);

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
        await ctx.reply(messageText, { parse_mode: 'HTML' });
        calledCount += chunk.length;
      } catch (e) {}

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const keyboard = {
      inline_keyboard: [[{ text: "❌Dcall❌", callback_data: "delete_this_msg" }]]
    };

    const summaryText = `ခေါ်ဆိုမှုပီးသွားပါပီရှင့်⌛\nစုစုပေါင်းခေါ်ဆိုသည့် Admin ဦးရေ(${calledCount})📭\nခေါ်ဆိုသူ😙--${callerMention}\nBy Tear......📮`;
    await ctx.reply(summaryText, { parse_mode: 'HTML', reply_markup: keyboard });
  });

  // ၅။ /adminpf Command
  bot.command(['adminpf', 'adminprofile'], async (ctx) => {
    if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
      return ctx.reply("❌ ဒီ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    }

    try {
      const administrators = await ctx.getChatAdministrators();
      const realAdmins = administrators.filter(admin => !admin.user.is_bot);

      realAdmins.sort((a, b) => {
        if (a.status === 'creator') return -1;
        if (b.status === 'creator') return 1;
        return 0;
      });

      if (realAdmins.length === 0) return ctx.reply("❌ Group ထဲတွင် Admin မရှိပါ။");

      adminProfilesCache.set(ctx.chat.id, realAdmins);
      const card = await generateAdminCard(ctx, realAdmins, 0);

      if (card.photoFileId) {
        await ctx.replyWithPhoto(card.photoFileId, {
          caption: card.caption,
          parse_mode: 'HTML',
          reply_markup: card.keyboard
        });
      } else {
        await ctx.reply(card.caption, {
          parse_mode: 'HTML',
          reply_markup: card.keyboard
        });
      }

    } catch (e) {
      await ctx.reply("❌ Admin Profile များ ဆွဲယူရာတွင် အမှားအယွင်း ရှိနေပါသည်။");
    }
  });

  // ၆။ Inline Buttons Handling
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;
    const chatId = ctx.chat?.id;

    // ကြော်ငြာဖျက်သည့် "❌ကြောညာ❌" ခလုပ်နှိပ်ပါက
    if (data.startsWith("delete_bcast_")) {
      // 🟢 Bcastopen Mode ဖြစ်နေပါက ခလုတ်နှိပ်ပြီး ကိုယ်တိုင်ဖျက်ခွင့်ပြုခြင်း (မစောင့်ခိုင်းပါ)
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

      // 🟢 Bcasttear Mode ဖြစ်နေပါက ၅ နာရီ ၃ မိနစ် (၁၈၁၈၀ စက္ကန့်) ပြည့်မှသာ ခလုတ်နှိပ်၍ ဖျက်ခွင့်ပေးမည်
      const sentTime = parseInt(data.split('_')[2]);
      const currentTime = Math.floor(Date.now() / 1000);
      const targetDurationSeconds = (5 * 60 + 3) * 60; // ၅ နာရီ ၃ မိနစ် = ၁၈၁၈၀ စက္ကန့်

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

    // Admin Profile Page ပြောင်းသည့် ခလုပ်
    if (data.startsWith('adminpf_page_')) {
      const targetIndex = parseInt(data.split('_')[2]);
      const admins = adminProfilesCache.get(chatId);

      if (!admins || !admins[targetIndex]) {
        return ctx.answerCallbackQuery({ text: "⚠️ Profile အချက်အလက်များ သက်တမ်းကုန်သွားပါပြီ။ /adminpf ကို ပြန်လည်နှိပ်ပါ။", show_alert: true });
      }

      await ctx.answerCallbackQuery();
      const card = await generateAdminCard(ctx, admins, targetIndex);

      try {
        if (card.photoFileId) {
          await ctx.editMessageMedia({
            type: 'photo',
            media: card.photoFileId,
            caption: card.caption,
            parse_mode: 'HTML'
          }, { reply_markup: card.keyboard });
        } else {
          await ctx.editMessageText(card.caption, {
            parse_mode: 'HTML',
            reply_markup: card.keyboard
          });
        }
      } catch (err) {
        try {
          await ctx.deleteMessage();
          if (card.photoFileId) {
            await ctx.replyWithPhoto(card.photoFileId, { caption: card.caption, parse_mode: 'HTML', reply_markup: card.keyboard });
          } else {
            await ctx.reply(card.caption, { parse_mode: 'HTML', reply_markup: card.keyboard });
          }
        } catch (e) {}
      }
      return;
    }

    // ရိုးရိုး စာဖျက်သည့် ခလုပ်
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
