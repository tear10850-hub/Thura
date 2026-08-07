const { InlineKeyboard } = require('grammy');
const HelpPage = require('./helpSchema');

function isOwner(ctx, ownerId) {
  return ctx.from && ctx.from.id === ownerId;
}

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

async function renderHelpPage(ctx, pageNum, isEdit = false) {
  let page = await HelpPage.findOne({ pageNumber: pageNum });
  const keyboard = getHelpKeyboard(pageNum);
  
  const textContent = (page && page.text) ? page.text : `📖 Help Page ${pageNum}\n\n(ဤစာမျက်နှာအတွက် စာသား သတ်မှတ်ထားခြင်း မရှိသေးပါ)`;

  try {
    if (isEdit) {
      await ctx.editMessageText(textContent, { reply_markup: keyboard }).catch(async () => {
        // ပုံပါနေလို့ editMessageText Error တက်ရင် မက်ဆေ့ခ်ျဟောင်းဖျက်ပြီး အသစ်ပို့မည်
        await ctx.deleteMessage().catch(() => {});
        if (page && page.mediaId && page.mediaId.length > 20 && !page.mediaId.startsWith('http')) {
          if (page.mediaType === 'photo') {
            await ctx.replyWithPhoto(page.mediaId, { caption: textContent, reply_markup: keyboard });
            return;
          } else if (page.mediaType === 'video') {
            await ctx.replyWithVideo(page.mediaId, { caption: textContent, reply_markup: keyboard });
            return;
          }
        }
        await ctx.reply(textContent, { reply_markup: keyboard });
      });
      return;
    }

    if (page && page.mediaId && page.mediaId.length > 20 && !page.mediaId.startsWith('http')) {
      if (page.mediaType === 'photo') {
        await ctx.replyWithPhoto(page.mediaId, { caption: textContent, reply_markup: keyboard });
        return;
      } else if (page.mediaType === 'video') {
        await ctx.replyWithVideo(page.mediaId, { caption: textContent, reply_markup: keyboard });
        return;
      }
    }
    
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
      return ctx.reply("❌ Page နံပါတ် မှားယွင်းနေပါသည်။ (၁ မှ ၂၅ အထိ ရေးပါ)\nဥပမာ: `/sethelptext 1`");
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
      return ctx.reply("❌ Page နံပါတ် မှားယွင်းနေပါသည်။ (၁ မှ ၂၅ အထိ ရေးပါ)\nဥပမာ: `/sethelpmedia 1`");
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
