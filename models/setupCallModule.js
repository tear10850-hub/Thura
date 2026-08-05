const CallMember = require('./models/CallMember');

// အီမိုဂျီ လှည့်ပတ်သုံးရန် List (အပတ်စဉ် ပြန်စပါမည်)
const emojis = ["😘", "😊", "🤭", "😻", "🔥", "✨", "🌸", "⭐", "🎉", "💖", "💫", "🌟", "🎈", "❤️"];

// Active Call များကို ထိန်းချုပ်ရန် Variable
const activeCalls = new Map(); // groupId -> { isStopped: boolean, sentMessageIds: [] }

function getUserMention(userId, emojiIndex) {
  const emoji = emojis[emojiIndex % emojis.length];
  // Profile သို့ တိုက်ရိုက် ရောက်စေရန် HTML Hyperlink ပြုလုပ်ခြင်း
  return `<a href="tg://user?id=${userId}">${emoji}</a>`;
}

function setupCallModule(bot, OWNER_ID) {

  // Group ထဲ စာရေးသူများ၏ ID ကို MongoDB သို့ အလိုအလျောက် သိမ်းဆည်းခြင်း
  bot.on('message', async (ctx, next) => {
    if ((ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') && ctx.from && !ctx.from.is_bot) {
      try {
        await CallMember.updateOne(
          { groupId: ctx.chat.id, userId: ctx.from.id },
          { firstName: ctx.from.first_name },
          { upsert: true }
        );
      } catch (err) {
        console.error("Call Member Save Error:", err);
      }
    }
    return next();
  });

  // /call သို့မဟုတ် /all Command (Group Owner / Admin သာ သုံးခွင့်ရှိသည်)
  bot.command(['call', 'all'], async (ctx) => {
    if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') return;

    const senderId = ctx.from.id;
    const isOwner = senderId === OWNER_ID;
    const memberInfo = await ctx.getChatMember(senderId);
    const isAdmin = ['administrator', 'creator'].includes(memberInfo.status);

    if (!isOwner && !isAdmin) {
      return ctx.reply("❌ ဒီ Command ကို Admin သို့မဟုတ် Owner သာ အသုံးပြုနိုင်ပါသည်။");
    }

    const groupId = ctx.chat.id;
    if (activeCalls.has(groupId)) {
      return ctx.reply("⚠️ လက်ရှိမှာ ခေါ်ဆိုမှုတစ်ခု လုပ်ဆောင်နေဆဲဖြစ်ပါသည်။");
    }

    const customText = ctx.match || ""; // /call နောက်က ရေးထားသည့် စာသား
    const callerMention = getUserMention(senderId, 0);

    const members = await CallMember.find({ groupId });
    if (members.length === 0) {
      return ctx.reply("❌ Group ထဲတွင် မှတ်တမ်းတင်ထားသော အဖွဲ့ဝင် မရှိသေးပါ။");
    }

    activeCalls.set(groupId, { isStopped: false, sentMessageIds: [] });
    
    await ctx.reply(`စတင်ခေါ်ဆိုနေပါပီရှင့်⏳\n0.2sဖြင့်.....📪`);

    let calledCount = 0;
    let emojiCounter = 0;

    // ၁ ကြောင်းလျှင် ၄ ယောက်နှုန်း ခေါ်ဆိုခြင်း
    for (let i = 0; i < members.length; i += 4) {
      const callData = activeCalls.get(groupId);
      if (!callData || callData.isStopped) break;

      const chunk = members.slice(i, i + 4);
      let tagLine = "";

      chunk.forEach((m, idx) => {
        const emojiTag = getUserMention(m.userId, emojiCounter++);
        tagLine += `[${idx + 1}-(${emojiTag})]`;
      });

      const messageText = `${tagLine}\n${customText}`;
      
      try {
        const sentMsg = await ctx.reply(messageText, { parse_mode: 'HTML' });
        callData.sentMessageIds.push(sentMsg.message_id);
        calledCount += chunk.length;
      } catch (e) {
        console.error("Tag Send Error:", e);
      }

      await new Promise(resolve => setTimeout(resolve, 200)); // 0.2 စက္ကန့် ခြားခြင်း
    }

    const callData = activeCalls.get(groupId);
    const wasStopped = callData ? callData.isStopped : false;
    activeCalls.delete(groupId);

    if (!wasStopped) {
      const keyboard = {
        inline_keyboard: [[{ text: "❌Dcall❌", callback_data: "delete_call_messages" }]]
      };

      const summaryText = `ခေါ်ဆိုမှုပီးသွားပါပီရှင့်⌛\nစုစုပေါင်းခေါ်ဆိုသူဉီးရေ(${calledCount})📭\nလူအားလုံကိုခေါ်ဆိုသူ😙--${callerMention}\nBy Tear......📮`;
      await ctx.reply(summaryText, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  });

  // /stop Command (ခေါ်ဆိုမှု ရပ်တန့်ရန်)
  bot.command('stop', async (ctx) => {
    if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') return;

    const groupId = ctx.chat.id;
    const callData = activeCalls.get(groupId);

    if (!callData) {
      return ctx.reply("⚠️ လက်ရှိမှာ ဘာခေါ်ဆိုမှုမှ မရှိပါ။");
    }

    callData.isStopped = true;
    const stopperMention = getUserMention(ctx.from.id, 1);
    
    const calledSoFar = callData.sentMessageIds.length * 4; 

    const stopText = `ခေါ်ဆိုမှုကိုအရေးပေါ်ရပ်တန့်လိုက်ပါပီရှင့်⌛\nရပ်တန့်သူ🤓${stopperMention}\nမရပ်တန့်ခင်ခေါ်ဆိုနိုင်ဉီးရေ(${calledSoFar})🤔`;
    
    await ctx.reply(stopText, { parse_mode: 'HTML' });
    activeCalls.delete(groupId);
  });

  // /admin Command (Admin များကိုသာ ခေါ်ရန် - မည်သူမဆို သုံးနိုင်သည်)
  bot.command('admin', async (ctx) => {
    if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') return;

    try {
      const administrators = await ctx.getAuthoritativeChatAdministrators();
      let adminTags = "<b>Group Admins:</b>\n";
      let count = 0;
      
      administrators.forEach((admin, index) => {
        if (!admin.user.is_bot) {
          count++;
          const mention = getUserMention(admin.user.id, index);
          adminTags += `${count}. ${admin.user.first_name} -> ${mention}\n`;
        }
      });

      const keyboard = {
        inline_keyboard: [[{ text: "❌call❌", callback_data: "delete_this_msg" }]]
      };

      await ctx.reply(adminTags, { parse_mode: 'HTML', reply_markup: keyboard });
    } catch (e) {
      console.error(e);
      ctx.reply("Admin စာရင်း ရယူ၍ မရပါ။");
    }
  });

  // Inline Button နှိပ်မှုများ
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;

    // ❌call❌ Button (မည်သူမဆို နှိပ်၍ /admin စာကို ဖျက်နိုင်သည်)
    if (data === "delete_this_msg") {
      try {
        await ctx.deleteMessage();
      } catch (e) {
        ctx.answerCallbackQuery({ text: "စာဖျက်၍ မရပါ" });
      }
      return;
    }

    // ❌Dcall❌ Button (Group Admin သို့မဟုတ် Owner သာ ဖျက်ခွင့်ရှိသည်)
    if (data === "delete_call_messages") {
      const isOwner = userId === OWNER_ID;
      const memberInfo = await ctx.getChatMember(userId);
      const isAdmin = ['administrator', 'creator'].includes(memberInfo.status);

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
