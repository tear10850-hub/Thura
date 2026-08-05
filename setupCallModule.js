const emojis = ["😘", "😊", "🤭", "😻", "🔥", "✨", "🌸", "⭐", "🎉", "💖", "💫", "🌟", "🎈", "❤️"];

// Telegram Standard Reactions များ (လှပပြီး စုံလင်သော Emoji စာရင်း)
const reactionEmojis = [
  "👍", "❤️", "🔥", "🥰", "👏", "🎉", "🤩", "✨", "💯", "😍", 
  "💘", "💖", "💗", "💓", "💞", "💕", "💌", "❣️", "🥳", "😇", 
  "⚡", "🌈", "⭐", "🌟", "🤗", "🥹", "🤝", "🙌", "👑", "🍀"
];

// Admin Profile စာရင်းများကို မန်မိုရီထဲ ခဏသိမ်းထားရန် Cache Map
const adminProfilesCache = new Map();

function getUserMention(userId, emojiIndex) {
  const emoji = emojis[emojiIndex % emojis.length];
  return `<a href="tg://user?id=${userId}">${emoji}</a>`;
}

// Admin Card စာသားနှင့် ခလုပ်များထုတ်ပေးသည့် Helper Function
async function generateAdminCard(ctx, admins, index) {
  const total = admins.length;
  const admin = admins[index];
  const user = admin.user;

  // Bio ရယူခြင်း
  let bio = "မရှိပါ";
  try {
    const fullUser = await ctx.api.getChat(user.id);
    if (fullUser.bio) {
      bio = fullUser.bio;
    }
  } catch (e) {
    // Bio ရယူ၍မရပါက "မရှိပါ" အဖြစ်ထားမည်
  }

  // Profile Picture ရယူခြင်း
  let photoFileId = null;
  try {
    const userPhotos = await ctx.api.getUserProfilePhotos(user.id, { limit: 1 });
    if (userPhotos.total_count > 0) {
      photoFileId = userPhotos.photos[0][0].file_id;
    }
  } catch (e) {
    // ပုံရယူ၍ မရပါက သို့မဟုတ် ပုံမရှိပါက null ဖြစ်မည်
  }

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

  // Next / Back Pagination Buttons
  const buttons = [];
  const navRow = [];

  if (index > 0) {
    navRow.push({ text: "⬅️ မူလ/ရှေ့", callback_data: `adminpf_page_${index - 1}` });
  }
  if (index < total - 1) {
    navRow.push({ text: "နောက်သို့ ➡️", callback_data: `adminpf_page_${index + 1}` });
  }

  if (navRow.length > 0) {
    buttons.push(navRow);
  }

  buttons.push([{ text: "❌ ပိတ်မည် ❌", callback_data: "delete_this_msg" }]);

  return {
    caption,
    photoFileId,
    keyboard: { inline_keyboard: buttons }
  };
}

function setupCallModule(bot, OWNER_ID) {

  // Auto Reaction (စာ/မီဒီယာ ဝင်လာတိုင်း လှပသော Emojis များဖြင့် တုံ့ပြန်ပေးမည်)
  bot.on('message', async (ctx, next) => {
    if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
      try {
        const randomEmoji = reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];
        await ctx.react(randomEmoji);
      } catch (e) {
        console.error("[Auto Reaction Error]:", e.message);
      }
    }
    return next();
  });

  // /admin Command (Admin များအားလုံးကို တဂ်ခေါ်ရန်)
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
      console.error("[Admin Error] Fetch Error:", err);
      return ctx.reply("❌ Admin စာရင်းဆွဲယူရာတွင် အမှားအယွင်းရှိနေပါသည်။");
    }

    const realAdmins = administrators.filter(admin => !admin.user.is_bot);

    if (realAdmins.length === 0) {
      return ctx.reply("❌ ဒီ Group ထဲတွင် Admin မရှိပါ။");
    }

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
      } catch (e) {
        console.error("[Admin Error] Tag Send Error:", e);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const keyboard = {
      inline_keyboard: [[{ text: "❌Dcall❌", callback_data: "delete_this_msg" }]]
    };

    const summaryText = `ခေါ်ဆိုမှုပီးသွားပါပီရှင့်⌛\nစုစုပေါင်းခေါ်ဆိုသည့် Admin ဦးရေ(${calledCount})📭\nခေါ်ဆိုသူ😙--${callerMention}\nBy Tear......📮`;
    await ctx.reply(summaryText, { parse_mode: 'HTML', reply_markup: keyboard });
  });

  // /adminpf သို့မဟုတ် /adminprofile Command
  bot.command(['adminpf', 'adminprofile'], async (ctx) => {
    if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
      return ctx.reply("❌ ဒီ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    }

    try {
      const administrators = await ctx.getChatAdministrators();
      const realAdmins = administrators.filter(admin => !admin.user.is_bot);

      // Owner (Creator) ကို ထိပ်ဆုံးပို့ပြီး ကျန် Admin များကို စီစဉ်ခြင်း
      realAdmins.sort((a, b) => {
        if (a.status === 'creator') return -1;
        if (b.status === 'creator') return 1;
        return 0;
      });

      if (realAdmins.length === 0) {
        return ctx.reply("❌ Group ထဲတွင် Admin မရှိပါ။");
      }

      // စာရင်းကို Cache ထဲ သိမ်းဆည်းခြင်း
      adminProfilesCache.set(ctx.chat.id, realAdmins);

      // ပထမဆုံး Admin (Owner) ၏ Profile Card ကို ထုတ်ယူမည်
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
      console.error("[Admin Profile Error]:", e);
      await ctx.reply("❌ Admin Profile များ ဆွဲယူရာတွင် အမှားအယွင်း ရှိနေပါသည်။");
    }
  });

  // Inline Button Handling (Pagination & Delete)
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;
    const chatId = ctx.chat?.id;

    // ရှေ့/နောက် စာမျက်နှာ ပြောင်းသည့် ခလုပ်
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
          // Photo ရှိပါက Photo ဖြင့် ပြောင်းလဲပေးမည်
          await ctx.editMessageMedia({
            type: 'photo',
            media: card.photoFileId,
            caption: card.caption,
            parse_mode: 'HTML'
          }, {
            reply_markup: card.keyboard
          });
        } else {
          // Photo မရှိပါက Text ဖြင့် ပြင်ပေးမည်
          await ctx.editMessageText(card.caption, {
            parse_mode: 'HTML',
            reply_markup: card.keyboard
          });
        }
      } catch (err) {
        // Media ရိုးရိုး ပြောင်းမရပါက Message အသစ် ပြန်ဖျက်/ပြန်ပို့မည်
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

    // စာဖျက်သည့် ခလုပ်
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
      } catch (e) {
        ctx.answerCallbackQuery({ text: "စာဖျက်၍ မရပါ။" });
      }
    }
  });
}

module.exports = setupCallModule;
