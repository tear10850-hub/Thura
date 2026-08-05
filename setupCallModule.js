const CallMember = require('./models/CallMember');

const emojis = ["😘", "😊", "🤭", "😻", "🔥", "✨", "🌸", "⭐", "🎉", "💖", "💫", "🌟", "🎈", "❤️"];
const activeCalls = new Map();

function getUserMention(userId, emojiIndex) {
  const emoji = emojis[emojiIndex % emojis.length];
  return `<a href="tg://user?id=${userId}">${emoji}</a>`;
}

function setupCallModule(bot, OWNER_ID) {

  // ၁။ စာရေးသူများ၏ ID ကို DB ထဲ သိမ်းဆည်းသည့်အပိုင်း
  bot.on('message', async (ctx, next) => {
    if ((ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') && ctx.from && !ctx.from.is_bot) {
      try {
        const res = await CallMember.updateOne(
          { groupId: ctx.chat.id, userId: ctx.from.id },
          { firstName: ctx.from.first_name || "User" },
          { upsert: true }
        );
        console.log(`[Call DB] Saved User: ${ctx.from.first_name} (${ctx.from.id}) in Chat: ${ctx.chat.id}`);
      } catch (err) {
        console.error("[Call DB Error] Member Save Error:", err);
      }
    }
    return next();
  });

  // DB ထဲ အဖွဲ့ဝင် မည်မျှသိမ်းဆည်းထားမိသည်ကို စစ်ဆေးရန် Command
  bot.command('callcount', async (ctx) => {
    if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') return;
    try {
      const count = await CallMember.countDocuments({ groupId: ctx.chat.id });
      await ctx.reply(`📊 လက်ရှိ DB ထဲတွင် မှတ်တမ်းဝင်ထားသူ စုစုပေါင်း: ${count} ယောက် ရှိပါသည်။`);
    } catch (e) {
      await ctx.reply(`❌ DB စစ်ဆေးရာတွင် Error တက်နေပါသည်: ${e.message}`);
    }
  });

  // /call သို့မဟုတ် /all Command
  bot.command(['call', 'all'], async (ctx) => {
    if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
      return ctx.reply("❌ ဒီ Command ကို Group ထဲတွင်သာ အသုံးပြုနိုင်ပါသည်။");
    }

    const senderId = ctx.from.id;
    const isOwner = senderId === Number(OWNER_ID);

    let isAdmin = false;
    try {
      const memberInfo = await ctx.getChatMember(senderId);
      isAdmin = ['administrator', 'creator'].includes(memberInfo.status);
    } catch (e) {
      console.error("[Call Error] Admin Check Error:", e);
    }

    if (!isOwner && !isAdmin) {
      return ctx.reply("❌ ဒီ Command ကို Admin သို့မဟုတ် Owner သာ အသုံးပြုနိုင်ပါသည်။");
    }

    const groupId = ctx.chat.id;
    if (activeCalls.has(groupId)) {
      return ctx.reply("⚠️ လက်ရှိမှာ ခေါ်ဆိုမှုတစ်ခု လုပ်ဆောင်နေဆဲဖြစ်ပါသည်။");
    }

    const customText = ctx.match ? ctx.match.trim() : "";
    const callerMention = getUserMention(senderId, 0);

    let members = [];
    try {
      members = await CallMember.find({ groupId });
    } catch (err) {
      console.error("[Call Error] DB Fetch Error:", err);
      return ctx.reply("❌ Database မှ စာရင်းဆွဲယူရာတွင် အမှားအယွင်းရှိနေပါသည်။ (Render Env တွင် CALL_MONGO_URI ကို စစ်ပါ)");
    }

    if (members.length === 0) {
      return ctx.reply("❌ Group ထဲတွင် မှတ်တမ်းတင်ထားသော အဖွဲ့ဝင် မရှိသေးပါ။ (Group ထဲတွင် စာအနည်းငယ် အရင်ရေးပေးပါ)");
    }

    activeCalls.set(groupId, { isStopped: false, sentMessageIds: [] });
    
    await ctx.reply(`စတင်ခေါ်ဆိုနေပါပီရှင့်⏳\n0.2sဖြင့်.....📪`);

    let calledCount = 0;
    let emojiCounter = 0;

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
        console.error("[Call Error] Tag Send Error:", e);
      }

      await new Promise(resolve => setTimeout(resolve, 200));
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

  // /stop Command
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

  // /admin Command
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
      console.error("[Call Error] Admin Fetch Error:", e);
      ctx.reply("Admin စာရင်း ရယူ၍ မရပါ။");
    }
  });

  // Inline Button Handling
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;

    if (data === "delete_this_msg") {
      try {
        await ctx.deleteMessage();
      } catch (e) {
        ctx.answerCallbackQuery({ text: "စာဖျက်၍ မရပါ" });
      }
      return;
    }

    if (data === "delete_call_messages") {
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
