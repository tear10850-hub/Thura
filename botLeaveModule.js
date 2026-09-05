function setupBotLeaveModule(bot, OWNER_ID) {
  // အသုံးပြုပုံ (Private သို့မဟုတ် Owner Chat ထဲတွင်): 
  // /leave Group_ID_သို့မဟုတ်_@groupusername
  bot.command('leave', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) {
      return ctx.reply('⛔ ဤခိုင်းချက်ကို Owner သာ အသုံးပြုခွင့်ရှိပါသည်။');
    }

    const targetChat = ctx.message.text.replace('/leave', '').trim();

    if (!targetChat) {
      return ctx.reply('⚠️ အသုံးပြုပုံ: `/leave Group_၏_ID_သို့မဟုတ်_@username`\n(ဥပမာ: `/leave -1001234567890` သို့မဟုတ် `/leave @mygroupchat`)');
    }

    try {
      // Telegram Bot API ဖြင့် သက်ဆိုင်ရာ Chat မှ ထွက်ခိုင်းခြင်း
      await ctx.api.leaveChat(targetChat);
      await ctx.reply(`✅ အောင်မြင်ပါပြီ Owner ဗျာ။ ဘော့တ်သည် Group (${targetChat}) မှ အောင်မြင်စွာ ထွက်လာခဲ့ပါပြီ။`);
    } catch (err) {
      await ctx.reply(`❌ အမှားအယွင်း ဖြစ်ပေါ်နေပါသည်: ${err.message}\n(သတိပြုရန်: Group ID မှန်ကန်မှုရှိမရှိနှင့် ဘော့တ် ထို Group ထဲတွင် ရှိနေသေးခြင်း ရှိမရှိ စစ်ဆေးပါ။)`);
    }
  });
}

module.exports = setupBotLeaveModule;
