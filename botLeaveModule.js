// Bot ရောက်ရှိနေသော Group များကို မှတ်ထားရန် Store
const activeGroups = new Map();

function setupBotLeaveModule(bot, OWNER_ID) {

  // ============================================================
  // 1. Group ထဲတွင် စာပို့သမျှကို ဖမ်းပြီး Active Group စာရင်းသွင်းပေးခြင်း
  // ============================================================
  bot.use(async (ctx, next) => {
    if (ctx.chat && ['group', 'supergroup'].includes(ctx.chat.type)) {
      if (!activeGroups.has(ctx.chat.id)) {
        activeGroups.set(ctx.chat.id, {
          title: ctx.chat.title || 'Unknown Group',
          username: ctx.chat.username ? `@${ctx.chat.username}` : null
        });
      }
    }
    return await next();
  });

  // Bot အား Group ထဲ ထည့်/ထုတ် စစ်ဆေးခြင်း
  bot.on('my_chat_member', async (ctx) => {
    const chat = ctx.chat;
    const newStatus = ctx.myChatMember.new_chat_member.status;

    if (['group', 'supergroup'].includes(chat.type)) {
      if (['member', 'administrator'].includes(newStatus)) {
        activeGroups.set(chat.id, {
          title: chat.title || 'Unknown Group',
          username: chat.username ? `@${chat.username}` : null
        });
      } else if (['left', 'kicked'].includes(newStatus)) {
        activeGroups.delete(chat.id);
      }
    }
  });

  // ============================================================
  // 2. Bot ရှိနေသော Group များ စာရင်းနှင့် Link ကြည့်ရန် (/gplist)
  // ============================================================
  bot.command('gplist', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) {
      return ctx.reply('⛔ ဤခိုင်းချက်ကို Owner သာ အသုံးပြုခွင့်ရှိပါသည်။');
    }

    if (activeGroups.size === 0) {
      return ctx.reply('ℹ️ Bot ရှိနေသော Group စာရင်း မရှိသေးပါရှင်။ (Group များတွင် စာတစ်ချက်စီ ရိုက်ပို့ပေးပါ)');
    }

    await ctx.reply('⏳ Group စာရင်းများကို စစ်ဆေးထုတ်ယူနေပါသည်...');

    let messageText = '📋 **Bot ရောက်ရှိနေသော Group များ စာရင်း:**\n\n';

    for (const [chatId, info] of activeGroups.entries()) {
      let groupLink = '⚠️ (Private Group - Bot သည် Admin မဟုတ်ပါ)';

      if (info.username) {
        groupLink = `https://t.me/${info.username.replace('@', '')}`;
      } else {
        try {
          const inviteLink = await ctx.api.exportChatInviteLink(chatId);
          groupLink = inviteLink;
        } catch (err) {
          // Invite Link ထုတ်မရပါက လျစ်လျူရှုမည်
        }
      }

      messageText += `🔹 **Group Name:** ${info.title}\n🆔 **Group ID:** \`${chatId}\`\n🔗 **Link:** ${groupLink}\n\n`;
    }

    await ctx.reply(messageText, { parse_mode: 'Markdown' });
  });

  // ============================================================
  // 3. Group မှ ထွက်ရန် Command (/leave) - စိတ်ဆိုးပြီး စာချန်ခဲ့မည့် စနစ်
  // ============================================================
  bot.command('leave', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) {
      return ctx.reply('⛔ ဤခိုင်းချက်ကို Owner သာ အသုံးပြုခွင့်ရှိပါသည်။');
    }

    const text = ctx.message.text || '';
    let input = text.replace(/^\/leave(@\w+)?/, '').trim();

    if (!input) {
      return ctx.reply('⚠️ **အသုံးပြုပုံ:**\n1. `/leave -1001234567890` (Group ID ဖြင့်)\n2. `/leave @mygroup` (Username ဖြင့်)\n3. `/leave https://t.me/mygroup` (Link ဖြင့်)', { parse_mode: 'Markdown' });
    }

    let targetChat = input;
    if (input.includes('t.me/')) {
      const parts = input.split('t.me/');
      const linkPath = parts[1].replace('/', '').trim();
      
      if (linkPath.startsWith('+') || linkPath.startsWith('joinchat')) {
        return ctx.reply('❌ Private Group Link ဖြင့် တိုက်ရိုက်ထွက်၍ မရပါရှင်။ `/gplist` တွင် တွေ့ရသော `Group ID` ကို အသုံးပြု၍ ထွက်ပေးပါရှင်။');
      }
      targetChat = `@${linkPath}`;
    }

    try {
      // 1. Group ထဲသို့ စိတ်ဆိုးသည့် စာတို အရင်ပို့မည်
      const leaveNotice = `😠 **စိတ်ဆိုးတယ်ဟာ... ဒါပဲနော်!**\n\n` +
                          `Owner က ထွက်ခိုင်းလိုက်လို့ ဒီ Group ထဲကနေ ထွက်သွားပါပြီ! 😤\n` +
                          `တာ့တာ... သွားပြီ! 🏃‍♀️💨`;

      await ctx.api.sendMessage(targetChat, leaveNotice, { parse_mode: 'Markdown' }).catch(() => {});

      // 2. Telegram API ဖြင့် Group ထဲမှ ထွက်မည်
      await ctx.api.leaveChat(targetChat);

      // 3. Memory Store ထဲမှ ဖျက်မည်
      for (const [chatId, info] of activeGroups.entries()) {
        if (chatId.toString() === targetChat || info.username === targetChat) {
          activeGroups.delete(chatId);
          break;
        }
      }

      await ctx.reply(`✅ အောင်မြင်ပါပြီ Owner ဗျာ။ ဘော့တ်သည် Group ထဲသို့ စာချန်ခဲ့ပြီး အောင်မြင်စွာ ထွက်လာခဲ့ပါပြီရှင်။`);
    } catch (err) {
      await ctx.reply(`❌ အမှားအယွင်း ဖြစ်ပေါ်နေပါသည်: ${err.message}\n\n💡 **အကြံပြုချက်:** `/gplist` ကို ရိုက်ပြီး ရလာတဲ့ **Group ID** (ဥပမာ- \`-1001234567890\`) ကို ကူးပြီး `/leave -1001234567890` ဟု ထွက်ပေးပါရှင်။`);
    }
  });

}

module.exports = setupBotLeaveModule;
