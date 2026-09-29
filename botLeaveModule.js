// Bot ရောက်ရှိနေသော Group များကို Memory ထဲမှတ်ထားရန် Store
const activeGroups = new Map();

function setupBotLeaveModule(bot, OWNER_ID) {

  // ============================================================
  // 1. Bot ကို Group ထဲ သို့ ထည့်ချိန် / ထုတ်ချိန် အလိုအလျောက် မှတ်သားသည့် စနစ်
  // ============================================================
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
  // 2. Bot ရှိနေသော Group များ စာရင်းနှင့် Link ကြည့်ရန် Command (/gplist)
  // ============================================================
  bot.command('gplist', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) {
      return ctx.reply('⛔ ဤခိုင်းချက်ကို Owner သာ အသုံးပြုခွင့်ရှိပါသည်။');
    }

    if (activeGroups.size === 0) {
      return ctx.reply('ℹ️ Bot သည် မည်သည့် Group တွင်မျှ ရှိမနေပါ သို့မဟုတ် Group စာရင်း မရှိသေးပါရှင်။');
    }

    await ctx.reply('⏳ Group စာရင်းနှင့် Link များကို စစ်ဆေးထုတ်ယူနေပါသည်...');

    let messageText = '📋 **Bot ရောက်ရှိနေသော Group များ စာရင်း:**\n\n';

    for (const [chatId, info] of activeGroups.entries()) {
      let groupLink = '';

      if (info.username) {
        groupLink = `https://t.me/${info.username.replace('@', '')}`;
      } else {
        try {
          const inviteLink = await ctx.api.exportChatInviteLink(chatId);
          groupLink = inviteLink;
        } catch (err) {
          groupLink = '⚠️ (Link ထုတ်မရပါ - Bot သည် Admin မဟုတ်ပါ)';
          try {
            const sentMsg = await ctx.api.sendMessage(chatId, '🔔 Owner check group status');
            await ctx.api.forwardMessage(OWNER_ID, chatId, sentMsg.message_id);
            await ctx.api.deleteMessage(chatId, sentMsg.message_id).catch(() => {});
          } catch (fwdErr) {
            console.error(`Forward failed for ${chatId}:`, fwdErr.message);
          }
        }
      }

      messageText += `🔹 **Group:** ${info.title}\n🆔 \`${chatId}\`\n🔗 **Link:** ${groupLink}\n\n`;
    }

    await ctx.reply(messageText, { parse_mode: 'Markdown' });
  });

  // ============================================================
  // 3. Group မှ ထွက်ရန် Command (/leave)
  // ============================================================
  bot.command('leave', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) {
      return ctx.reply('⛔ ဤခိုင်းချက်ကို Owner သာ အသုံးပြုခွင့်ရှိပါသည်။');
    }

    const text = ctx.message.text || '';
    const targetChat = text.replace(/^\/leave(@\w+)?/, '').trim();

    if (!targetChat) {
      return ctx.reply('⚠️ အသုံးပြုပုံ: `/leave Group_ID_သို့မဟုတ်_@username`\n(ဥပမာ: `/leave -1001234567890`)', { parse_mode: 'Markdown' });
    }

    try {
      await ctx.api.leaveChat(targetChat);
      
      const numericId = parseInt(targetChat, 10);
      if (!isNaN(numericId)) activeGroups.delete(numericId);

      await ctx.reply(`✅ အောင်မြင်ပါပြီ Owner ဗျာ။ ဘော့တ်သည် Group (${targetChat}) မှ အောင်မြင်စွာ ထွက်လာခဲ့ပါပြီရှင်။`);
    } catch (err) {
      await ctx.reply(`❌ အမှားအယွင်း ဖြစ်ပေါ်နေပါသည်: ${err.message}\n(သတိပြုရန်: Group ID မှန်မမှန် စစ်ဆေးပါရှင်။)`);
    }
  });

}

module.exports = setupBotLeaveModule;
