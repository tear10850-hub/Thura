const emojis = ["😘", "😊", "🤭", "😻", "🔥", "✨", "🌸", "⭐", "🎉", "💖", "💫", "🌟", "🎈", "❤️"];
// Auto Reaction ပေးရန် အီမိုဂျီများ
const reactionEmojis = ["👍", "❤️", "🔥", "🥰", "👏", "🎉", "🤩", "✨", "💯", "😍"];

function getUserMention(userId, emojiIndex) {
  const emoji = emojis[emojiIndex % emojis.length];
  return `<a href="tg://user?id=${userId}">${emoji}</a>`;
}

function setupCallModule(bot, OWNER_ID) {

  // Group ထဲတွင် လူများ စာ/မီဒီယာ ပို့တိုင်း အလိုအလျောက် Reaction (RC) ပေးသည့်အပိုင်း
  bot.on('message', async (ctx, next) => {
    if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
      try {
        // အီမိုဂျီများကို အလှည့်ကျ သို့မဟုတ် Random ရွေးချယ်ခြင်း
        const randomEmoji = reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];
        
        // Telegram Message ကို Reaction ပေးခြင်း
        await ctx.react(randomEmoji);
      } catch (e) {
        // Telegram Client ဘက်မှ Reaction မပေါ်သော အီမိုဂျီဖြစ်ပါက သို့မဟုတ် 권한 မရှိပါက Error မတက်စေရန်
        console.error("[Auto Reaction Error]:", e.message);
      }
    }
    return next();
  });

  // /admin Command ဖြင့် Admin အားလုံးကို တဂ်ခေါ်မည်
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

    // Bot များကို ဖယ်ပြီး လူ Admin များကိုသာ ယူမည်
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

  // Inline Button ဖြင့် စာဖျက်ရန်
  bot.on('callback_query:data', async (ctx) => {
    if (ctx.callbackQuery.data === "delete_this_msg") {
      const userId = ctx.from.id;
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
