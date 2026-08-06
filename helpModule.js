const { InlineKeyboard } = require('grammy');
const HelpPage = require('./helpSchema');

function isOwner(ctx, ownerId) {
  return ctx.from && ctx.from.id === ownerId;
}

// Help စာမျက်နှာ Keyboard ဖန်တီးပေးသည့် Helper Function
function getHelpKeyboard(currentPage) {
  const keyboard = new InlineKeyboard();

  if (currentPage > 1) {
    keyboard.text("⬅️ ရှေ့သို့", `helppage_${currentPage - 1}`);
  }

  keyboard.text(`${currentPage} / 25`, "ignore_click");

  if (currentPage < 25) {
    keyboard.text("နောက်သို့ ➡️", `helppage_${currentPage + 1}`);
  }

  return keyboard;
}

// စာမျက်နှာ ပို့ရန် သို့မဟုတ် Edit လုပ်ရန် Helper Function
async function renderHelpPage(ctx, pageNum, isEdit = false) {
  let page = await HelpPage.findOne({ pageNumber: pageNum });
  const keyboard = getHelpKeyboard(pageNum);
  
  const textContent = (page && page.text) ? page.text : `📖 Help Page ${pageNum}\n\n(ဤစာမျက်နှာအတွက် စာသား သတ်မှတ်ထားခြင်း မရှိသေးပါ)`;

  if (isEdit) {
    try {
      if (page && page.mediaId) {
        if (page.mediaType === 'photo') {
          await ctx.editMessageMedia({
            type: 'photo',
            media: page.mediaId,
            caption: textContent
          }, { reply_markup: keyboard });
        } else if (page.mediaType === 'video') {
          await ctx.editMessageMedia({
            type: 'video',
            media: page.mediaId,
            caption: textContent
          }, { reply_markup: keyboard });
        }
      } else {
        await ctx.editMessageText(textContent, { reply_markup: keyboard });
      }
    } catch (err) {
      await ctx.deleteMessage().catch(() => {});
      if (page && page.mediaId) {
        if (page.mediaType === 'photo') {
          await ctx.replyWithPhoto(page.mediaId, { caption: textContent, reply_markup: keyboard });
        } else {
          await ctx.replyWithVideo(page.mediaId, { caption: textContent, reply_markup: keyboard });
        }
      } else {
        await ctx.reply(textContent, { reply_markup: keyboard });
      }
    }
  } else {
    if (page && page.mediaId) {
      if (page.mediaType === 'photo') {
        await ctx.replyWithPhoto(page.mediaId, { caption: textContent, reply_markup: keyboard });
      } else {
        await ctx.replyWithVideo(page.mediaId, { caption: textContent, reply_markup: keyboard });
      }
    } else {
      await ctx.reply(textContent, { reply_markup: keyboard });
    }
  }
}

function setupHelpModule(bot, OWNER_ID) {

  // ----------------------------------------------------
  // ၁. Deep Link နှင့် /help /start help ဖတ်ရှုသည့် အပိုင်း
  // ----------------------------------------------------
  
  // /start သို့မဟုတ် /start help ဟု နှိပ်လိုက်ပါက စစ်ဆေးမည့် Middleware
  bot.command('start', async (ctx, next) => {
    const startPayload = ctx.match; // /start help ဟု ပါလာမပါ စစ်ဆေးခြင်း

    if (startPayload === 'help') {
      // /start help လာပါက မူလ /start ဆီ မသွားစေဘဲ Help Page 1 ကို တိုက်ရိုက် ပြပေးမည်
      return await renderHelpPage(ctx, 1, false);
    }
    
    // /start သက်သက်ဆိုပါက မူလ startModule.js ဆီ ဆက်သွားမည်
    await next();
  });

  // /help Command ရိုက်ပါက
  bot.command('help', async (ctx) => {
    await renderHelpPage(ctx, 1, false);
  });

  // ----------------------------------------------------
  // ၂. Admin / Owner Commands ( Help စာမျက်နှာ ပြင်ဆင်ရန် )
  // ----------------------------------------------------

  // 1. စာသား သတ်မှတ်ခြင်း (Max 10,000 Chars)
  bot.command('sethelptext', async (ctx) => {
    if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် အသုံးပြုနိုင်ပါသည်။");

    const args = ctx.message.text.split(" ").slice(1);
    const pageNum = parseInt(args[0]);

    if (!pageNum || pageNum < 1 || pageNum > 25) {
      return ctx.reply("❌ Page နံပါတ် မှားယွင်းနေပါသည်။ (၁ မှ ၂၅ အထိ ရေးပါ)\nဥပမာ: `/sethelptext 1` (စာသားအား Reply ထောက်၍ ရိုက်ပါ)");
    }

    const replyMsg = ctx.message.reply_to_message;
    const text = replyMsg ? (replyMsg.text || replyMsg.caption) : null;

    if (!text) return ctx.reply("❌ ကျေးဇူးပြု၍ ထည့်လိုသော စာသားကို Reply ထောက်ပေးပါ။");
    if (text.length > 10000) return ctx.reply(`❌ စာသားသည် စာလုံးရေ ၁၀၀၀၀ ထက် မကျော်ရပါ (လက်ရှိ: ${text.length})။`);

    await HelpPage.findOneAndUpdate(
      { pageNumber: pageNum },
      { text: text },
      { upsert: true }
    );

    await ctx.reply(`✅ Help Page ${pageNum} အတွက် စာသားကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။ (စာလုံးရေ: ${text.length}/10000)`);
  });

  // 2. Photo / Video သတ်မှတ်ခြင်း
  bot.command('sethelpmedia', async (ctx) => {
    if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် အသုံးပြုနိုင်ပါသည်။");

    const args = ctx.message.text.split(" ").slice(1);
    const pageNum = parseInt(args[0]);

    if (!pageNum || pageNum < 1 || pageNum > 25) {
      return ctx.reply("❌ Page နံပါတ် မှားယွင်းနေပါသည်။ (၁ မှ ၂၅ အထိ ရေးပါ)\nဥပမာ: `/sethelpmedia 1` (Photo/Video အား Reply ထောက်၍ ရိုက်ပါ)");
    }

    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || (!replyMsg.photo && !replyMsg.video)) {
      return ctx.reply("❌ ကျေးဇူးပြု၍ Photo သို့မဟုတ် Video ကို Reply ထောက်ပေးပါ။");
    }

    let mediaType = null;
    let mediaId = null;

    if (replyMsg.photo) {
      mediaType = 'photo';
      mediaId = replyMsg.photo[replyMsg.photo.length - 1].file_id;
    } else if (replyMsg.video) {
      mediaType = 'video';
      mediaId = replyMsg.video.file_id;
    }

    await HelpPage.findOneAndUpdate(
      { pageNumber: pageNum },
      { mediaType, mediaId },
      { upsert: true }
    );

    await ctx.reply(`✅ Help Page ${pageNum} အတွက် ${mediaType} ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။`);
  });

  // 3. စာသား သီးသန့် ဖျက်ခြင်း (/delhelptext Page)
  bot.command('delhelptext', async (ctx) => {
    if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် အသုံးပြုနိုင်ပါသည်။");

    const args = ctx.message.text.split(" ").slice(1);
    const pageNum = parseInt(args[0]);

    if (!pageNum || pageNum < 1 || pageNum > 25) {
      return ctx.reply("❌ Page နံပါတ် မှားယွင်းနေပါသည်။ (၁ မှ ၂၅ အထိ ရေးပါ)\nဥပမာ: `/delhelptext 1`");
    }

    await HelpPage.findOneAndUpdate(
      { pageNumber: pageNum },
      { text: null }
    );

    await ctx.reply(`✅ Help Page ${pageNum} ၏ စာသားကို ဖျက်လိုက်ပါပြီ။`);
  });

  // 4. Photo/Video (Media) သီးသန့် ဖျက်ခြင်း (/delhelpmedia Page)
  bot.command('delhelpmedia', async (ctx) => {
    if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် အသုံးပြုနိုင်ပါသည်။");

    const args = ctx.message.text.split(" ").slice(1);
    const pageNum = parseInt(args[0]);

    if (!pageNum || pageNum < 1 || pageNum > 25) {
      return ctx.reply("❌ Page နံပါတ် မှားယွင်းနေပါသည်။ (၁ မှ ၂၅ အထိ ရေးပါ)\nဥပမာ: `/delhelpmedia 1`");
    }

    await HelpPage.findOneAndUpdate(
      { pageNumber: pageNum },
      { mediaType: null, mediaId: null }
    );

    await ctx.reply(`✅ Help Page ${pageNum} ၏ Media (Photo/Video) ကို ဖျက်လိုက်ပါပြီ။`);
  });

  // 5. သက်ဆိုင်ရာ စာမျက်နှာ ကြည့်ရှုခြင်း (/viewhelp Page)
  bot.command('viewhelp', async (ctx) => {
    const args = ctx.message.text.split(" ").slice(1);
    const pageNum = parseInt(args[0]) || 1;

    if (pageNum < 1 || pageNum > 25) {
      return ctx.reply("❌ Page နံပါတ် ၁ မှ ၂၅ အထိသာ ကြည့်နိုင်ပါသည်။");
    }

    await renderHelpPage(ctx, pageNum, false);
  });

  // ----------------------------------------------------
  // ၃. Callback Query ( ခလုတ် နှိပ်သည့်အခါ အလုပ်လုပ်မည့် အပိုင်း )
  // ----------------------------------------------------

  bot.callbackQuery(/^helppage_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const pageNum = parseInt(ctx.match[1]);
    await renderHelpPage(ctx, pageNum, true);
  });

  bot.callbackQuery('ignore_click', async (ctx) => {
    await ctx.answerCallbackQuery();
  });
}

module.exports = setupHelpModule;
