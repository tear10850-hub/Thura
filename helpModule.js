const { InlineKeyboard } = require('grammy');
const HelpPage = require('./helpSchema');

function isOwner(ctx, ownerId) {
  return ctx.from && ctx.from.id === ownerId;
}

function getHelpKeyboard(currentPage) {
  const keyboard = new InlineKeyboard();

  if (currentPage > 1) {
    keyboard.text("⬅️ ရှေ့သို့", `help_page_${currentPage - 1}`);
  }

  keyboard.text(`${currentPage} / 25`, "ignore_click");

  if (currentPage < 25) {
    keyboard.text("နောက်သို့ ➡️", `help_page_${currentPage + 1}`);
  }

  return keyboard;
}

async function renderHelpPage(ctx, pageNum, isEdit = false) {
  let page = await HelpPage.findOne({ pageNumber: pageNum });
  const keyboard = getHelpKeyboard(pageNum);
  
  const textContent = (page && page.text) ? page.text : `📖 Help Page ${pageNum}\n\n(ဤစာမျက်နှာအတွက် စာသား သတ်မှတ်ထားခြင်း မရှိသေးပါ)`;

  try {
    // ခလုတ်နှိပ်၍ စာမျက်နှာ ပြောင်းပါက မက်ဆေ့ခ်ျအဟောင်းကို အရင်ဖျက်ပေးမည်
    if (isEdit) {
      await ctx.deleteMessage().catch(() => {});
    }

    // ပုံ သို့မဟုတ် ဗီဒီယို ရှိမရှိ စစ်ဆေးပြီး ပို့မည်
    if (page && page.mediaId && page.mediaId.length > 20 && !page.mediaId.startsWith('http')) {
      if (page.mediaType === 'photo') {
        await ctx.replyWithPhoto(page.mediaId, { caption: textContent, reply_markup: keyboard });
        return;
      } else if (page.mediaType === 'video') {
        await ctx.replyWithVideo(page.mediaId, { caption: textContent, reply_markup: keyboard });
        return;
      }
    }
    
    // မီဒီယာမရှိပါက စာသားသက်သက် ပို့မည်
    await ctx.reply(textContent, { reply_markup: keyboard });

  } catch (error) {
    console.error("Render Help Page Error:", error.message);
    await ctx.reply(textContent, { reply_markup: keyboard }).catch(() => {});
  }
}

function setupHelpModule(bot, OWNER_ID) {
  bot.command('help', async (ctx) => {
    await renderHelpPage(ctx, 1, false);
  });

  bot.command('sethelptext', async (ctx) => {
    if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် အသုံးပြုနိုင်ပါသည်။");
    const args = ctx.message.text.split(" ").slice(1);
    const pageNum = parseInt(args[0]);

    if (!pageNum || pageNum < 1 || pageNum > 25) {
      return ctx.reply("❌ Page နံပါတ် မှားယွင်းနေပါသည်။ (၁ မှ ၂၅ အထိ ရေးပါ)\nဥပမာ: `/sethelptext 1`", { parse_mode: 'Markdown' });
    }

    const replyMsg = ctx.message.reply_to_message;
    const text = replyMsg ? (replyMsg.text || replyMsg.caption) : null;

    if (!text) return ctx.reply("❌ ကျေးဇူးပြု၍ ထည့်လိုသော စာသားကို Reply ထောက်ပေးပါ။");
    await HelpPage.findOneAndUpdate({ pageNumber: pageNum }, { text: text }, { upsert: true });
    await ctx.reply(`✅ Help Page ${pageNum} ၏ စာသားကို သတ်မှတ်ပြီးပါပြီ။`);
  });

  bot.command('sethelpmedia', async (ctx) => {
    if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် အသုံးပြုနိုင်ပါသည်။");
    const args = ctx.message.text.split(" ").slice(1);
    const pageNum = parseInt(args[0]);

    if (!pageNum || pageNum < 1 || pageNum > 25) {
      return ctx.reply("❌ Page နံပါတ် မှားယွင်းနေပါသည်။ (၁ မှ ၂၅ အထိ ရေးပါ)\nဥပမာ: `/sethelpmedia 1`", { parse_mode: 'Markdown' });
    }

    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || (!replyMsg.photo && !replyMsg.video)) {
      return ctx.reply("❌ ကျေးဇူးပြု၍ Photo သို့မဟုတ် Video ကို Reply ထောက်ပေးပါ။");
    }

    let mediaType = replyMsg.photo ? 'photo' : 'video';
    let mediaId = replyMsg.photo ? replyMsg.photo[replyMsg.photo.length - 1].file_id : replyMsg.video.file_id;

    await HelpPage.findOneAndUpdate({ pageNumber: pageNum }, { mediaType, mediaId }, { upsert: true });
    await ctx.reply(`✅ Help Page ${pageNum} ၏ ${mediaType} ကို သတ်မှတ်ပြီးပါပြီ။`);
  });

  bot.command('delhelptext', async (ctx) => {
    if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် အသုံးပြုနိုင်ပါသည်။");
    const args = ctx.message.text.split(" ").slice(1);
    const pageNum = parseInt(args[0]);
    if (!pageNum || pageNum < 1 || pageNum > 25) return ctx.reply("❌ Page နံပါတ် (၁-၂၅) ထည့်ပါ။");

    await HelpPage.findOneAndUpdate({ pageNumber: pageNum }, { text: null });
    await ctx.reply(`✅ Help Page ${pageNum} ၏ စာသားကို ဖျက်လိုက်ပါပြီ။`);
  });

  bot.command('delhelpmedia', async (ctx) => {
    if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် အသုံးပြုနိုင်ပါသည်။");
    const args = ctx.message.text.split(" ").slice(1);
    const pageNum = parseInt(args[0]);
    if (!pageNum || pageNum < 1 || pageNum > 25) return ctx.reply("❌ Page နံပါတ် (၁-၂၅) ထည့်ပါ။");

    await HelpPage.findOneAndUpdate({ pageNumber: pageNum }, { mediaType: null, mediaId: null });
    await ctx.reply(`✅ Help Page ${pageNum} ၏ Media ကို ဖျက်လိုက်ပါပြီ။`);
  });

  bot.command('viewhelp', async (ctx) => {
    const args = ctx.message.text.split(" ").slice(1);
    const pageNum = parseInt(args[0]) || 1;
    if (pageNum < 1 || pageNum > 25) return ctx.reply("❌ Page နံပါတ် ၁ မှ ၂၅ အထိသာ ကြည့်နိုင်ပါသည်။");
    await renderHelpPage(ctx, pageNum, false);
  });

  // ============================================================
  // Callback Query စစ်ဆေးသည့် အပိုင်း ပြင်ဆင်ချက်
  // ============================================================
  bot.on('callback_query:data', async (ctx, next) => {
    const data = ctx.callbackQuery.data;

    if (data.startsWith('help_page_')) {
      try {
        await ctx.answerCallbackQuery();
      } catch (e) {}

      const pageNum = parseInt(data.replace('help_page_', ''), 10);
      if (!isNaN(pageNum)) {
        await renderHelpPage(ctx, pageNum, true);
      }
      return;
    }

    if (data === 'ignore_click') {
      try {
        await ctx.answerCallbackQuery();
      } catch (e) {}
      return;
    }

    return await next();
  });
}

module.exports = setupHelpModule;
