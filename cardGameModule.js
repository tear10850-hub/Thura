const { InlineKeyboard } = require('grammy');
const { Card, UserInventory, KeyModel, GroupActivity } = require('./cardModels');

const activeCards = new Map();
const normalCardCounter = new Map();

function generateCustomKey(customText = '') {
  if (customText && customText.length === 10) return customText.toUpperCase();
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const REQUIRED_CHANNEL = 'https://t.me/Rei3808';
const CHANNEL_USERNAME = '@Rei3808';

function setupCardGameModule(bot, OWNER_ID) {

  // 1. ရိုးရိုးကတ်ထည့်ရန် (/addcard [နာမည်] [EPIC/Legend/Legendary/GOLD] [Bio])
  bot.command('addcard', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const replied = ctx.message.reply_to_message;
    if (!replied || !replied.photo) {
      return ctx.reply('⚠️ ကျေးဇူးပြု၍ ကတ်ပုံကို Reply ထောက်ပြီး /addcard [နာမည်] [EPIC/Legend/Legendary/GOLD] [Bio] ဟု ရိုက်ပါ။');
    }

    const fullText = ctx.message.text.replace('/addcard', '').trim();
    const args = fullText.split(' ');
    const cardName = args[0];
    const rarity = (args[1] || 'EPIC').toUpperCase();
    const bioText = args.slice(2).join(' ') || 'ရိုးရိုးကတ် စုဆောင်းမှု။';

    if (!cardName) return ctx.reply('⚠️ ကျေးဇူးပြု၍ ကတ်နာမည် ထည့်ပေးပါ။');

    const fileId = replied.photo[replied.photo.length - 1].file_id;

    try {
      await Card.create({ name: cardName, image: fileId, rarity, isPrizeCard: false, bio: bioText });
      const sent = await ctx.reply(`✅ ရိုးရိုးကတ်အသစ် **"${cardName}"** (${rarity}) ကို သိမ်းဆည်းပြီးပါပြီ။`);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    } catch (err) {
      ctx.reply(`❌ အမှားရှိသည်: ${err.message}`);
    }
  });

  // 2. ဆုကြေးကတ်ထည့်ရန် (/addprize [နာမည်] [ဆုကြေးအမျိုးအစား] [Bio])
  bot.command('addprize', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const replied = ctx.message.reply_to_message;
    if (!replied || !replied.photo) {
      return ctx.reply('⚠️ ကျေးဇူးပြု၍ ဆုကြေးကတ်ပုံကို Reply ထောက်ပြီး /addprize [နာမည်] [ဆုကြေးအမျိုးအစား] [Bio] ဟု ရိုက်ပါ။');
    }

    const fullText = ctx.message.text.replace('/addprize', '').trim();
    const args = fullText.split(' ');
    const cardName = args[0];
    const prizeType = args[1] || '500_MLBB_Diamonds';
    const bioText = args.slice(2).join(' ') || 'GOLD အဆင့် ဆုကြေးကတ်။';

    if (!cardName) return ctx.reply('⚠️ ကျေးဇူးပြု၍ ဆုကြေးကတ်နာမည် ထည့်ပေးပါ။');

    const fileId = replied.photo[replied.photo.length - 1].file_id;

    try {
      await Card.create({ name: cardName, image: fileId, rarity: 'GOLD', isPrizeCard: true, prizeType, bio: bioText });
      const sent = await ctx.reply(`🏆 GOLD ဆုကြေးကတ်အသစ် **"${cardName}"** (ဆုကြေး: ${prizeType}) ကို သိမ်းဆည်းပြီးပါပြီ။`);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    } catch (err) {
      ctx.reply(`❌ အမှားရှိသည်: ${err.message}`);
    }
  });

  // 3. Owner သီးသန့် Key ထုတ်ပေးခြင်း (/chk [၁၀ လုံးပါ Key] [ဆုကြေးအသေးစိတ်])
  bot.command('chk', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ ဤ Command ကို Owner သာ အသုံးပြုခွင့်ရှိသည်။');

    const args = ctx.message.text.split(' ').slice(1);
    let keyInput = args[0];
    let prizeDetails = args.slice(1).join(' ') || '1 Month TG Premium';

    if (!keyInput) {
      keyInput = generateCustomKey();
    } else if (keyInput.length !== 10) {
      return ctx.reply('⚠️ Key သည် အက္ခရာ/ဂဏန်း **၁၀ လုံး** အတိအကျ ဖြစ်ရပါမည်။');
    }

    try {
      await KeyModel.create({
        key: keyInput.toUpperCase(),
        userId: OWNER_ID,
        cardName: 'Owner Secret Gift',
        prizeDetails: prizeDetails,
        ownerGenerated: true
      });
      const sent = await ctx.reply(`🔑 **[Owner Secret Key Generated]**\n\nKey: \`${keyInput.toUpperCase()}\`\n🎁 ဆုကြေးအမျိုးအစား: **${prizeDetails}**`);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    } catch (err) {
      ctx.reply(`❌ အမှားရှိသည်: ${err.message}`);
    }
  });

  // 4. 👑 Owner အတွက် User တစ်ဦးချင်းစီ၏ Inventory စစ်ဆေးခြင်း (/usercards [User ID] သို့မဟုတ် Reply ဖြင့်)
  bot.command('usercards', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return ctx.reply('❌ ဤ Command ကို Owner သာ အသုံးပြုခွင့်ရှိသည်။');

    let targetUserId = null;
    const args = ctx.message.text.split(' ').slice(1);
    const repliedMsg = ctx.message.reply_to_message;

    if (args[0]) {
      targetUserId = Number(args[0]);
    } else if (repliedMsg && repliedMsg.from) {
      targetUserId = repliedMsg.from.id;
    }

    if (!targetUserId || isNaN(targetUserId)) {
      return ctx.reply('⚠️ အသုံးပြုပုံ: `/usercards [User ID]` (သို့မဟုတ်) User ၏ စာကို Reply ထောက်ပြီး `/usercards` ဟု ရိုက်ပါ။');
    }

    const inventory = await UserInventory.findOne({ userId: targetUserId }).populate('cards');
    if (!inventory || inventory.cards.length === 0) {
      return ctx.reply(`🔍 User ID (\`${targetUserId}\`) တွင် ကတ် မရှိသေးပါ (သို့မဟုတ်) Database တွင် မတွေ့ပါ။\n🪙 Coins လက်ကျန်: **${inventory ? inventory.coins : 0}**`);
    }

    let report = `👑 **[Owner Inspection Report]**\n👤 User ID: \`${targetUserId}\`\n👤 Name: ${inventory.userName || 'Unknown'}\n🪙 Coins: **${inventory.coins}**\n🎒 ပိုင်ဆိုင်သည့် ကတ်များ (${inventory.cards.length} ခု):\n\n`;
    inventory.cards.forEach((card, index) => {
      report += `${index + 1}. **${card.name}** (${card.rarity})${card.isPrizeCard ? ' 🏆 [Prize]' : ''}\n`;
    });

    await ctx.reply(report, { parse_mode: 'Markdown' });
  });

  // 5. Group အားလုံးထံ Broadcast ပို့ခြင်း
  async function notifyAllGroups(prizeCardName, originChatId) {
    try {
      const groups = await GroupActivity.find({});
      for (const group of groups) {
        if (group.chatId !== originChatId) {
          try {
            await bot.api.sendMessage(group.chatId, `📢 **[ALL GROUPS ANNOUNCEMENT]**\n\n🚨 **GOLD ဆုကြေးကတ် ပေါ်ထွက်လာပါပြီ!**\n🎯 ကတ်နာမည်: **${prizeCardName}**\n\nမြန်မြန်လုယူကြပါ! 🔥`);
          } catch (e) {}
        }
      }
    } catch (err) {}
  }

  // 6. Spawner Logic
  async function spawnCardToGroup(bot, chatId) {
    let currentCount = normalCardCounter.get(chatId) || 0;
    let cardToSpawn = null;

    if (currentCount >= 30) {
      cardToSpawn = await Card.findOne({ ownerId: null, isPrizeCard: true });
      if (cardToSpawn) normalCardCounter.set(chatId, 0);
    }

    if (!cardToSpawn) {
      const normalCount = await Card.countDocuments({ ownerId: null, isPrizeCard: false });
      if (normalCount === 0) return;

      const randomSkip = Math.floor(Math.random() * normalCount);
      cardToSpawn = await Card.findOne({ ownerId: null, isPrizeCard: false }).skip(randomSkip);
      if (cardToSpawn) normalCardCounter.set(chatId, currentCount + 1);
    }

    if (!cardToSpawn) return;

    let rarityEmoji = '🔵 [EPIC]';
    if (cardToSpawn.rarity === 'Legend') rarityEmoji = '🟣 [LEGEND]';
    if (cardToSpawn.rarity === 'Legendary') rarityEmoji = '🟡 [LEGENDARY]';
    if (cardToSpawn.rarity === 'GOLD') rarityEmoji = '🏆🔥 [GOLD PRIZE CARD]';

    const keyboard = new InlineKeyboard().text("🏃‍♂️ ကတ်ကို လုကောက်မည်!", `grab_card_${cardToSpawn._id}`);

    const sentMsg = await bot.api.sendPhoto(chatId, cardToSpawn.image, {
      caption: `✨ **[GACHA CARD SPAWNED]**\n\n🎯 Group ထဲသို့ ကတ်အသစ် ပေါ်လာပါပြီ!\n🏷️ အဆင့်: **${cardToSpawn.rarity} ${rarityEmoji}**\n\n👉 ကောက်ယူရန်: \`/catch ${cardToSpawn.name}\` ဟု ရိုက်ကောက်ပါ!`,
      reply_markup: keyboard
    });

    activeCards.set(chatId, {
      cardId: cardToSpawn._id,
      cardName: cardToSpawn.name.toLowerCase(),
      realName: cardToSpawn.name,
      rarity: cardToSpawn.rarity,
      isPrizeCard: cardToSpawn.isPrizeCard,
      prizeType: cardToSpawn.prizeType,
      bio: cardToSpawn.bio,
      messageId: sentMsg.message_id,
      isGrabbed: false
    });

    if (cardToSpawn.isPrizeCard) {
      await notifyAllGroups(cardToSpawn.name, chatId);
    }

    setTimeout(async () => {
      const currentActive = activeCards.get(chatId);
      if (currentActive && currentActive.cardId.toString() === cardToSpawn._id.toString() && !currentActive.isGrabbed) {
        activeCards.delete(chatId);
        try {
          await bot.api.editMessageCaption(chatId, sentMsg.message_id, {
            caption: `❌ **[Expired]**\n\nဒီကတ်ကို ၁၀ မိနစ်အတွင်း မည်သူမျှ မကောက်ယူနိုင်ခဲ့ပါသဖြင့် ပျောက်ကွယ်သွားပါပြီ။`,
            reply_markup: new InlineKeyboard()
          });
        } catch (e) {}
      }
    }, 10 * 60 * 1000);
  }

  // 7. Callback Query
  bot.callbackQuery(/^grab_card_(.+)$/, async (ctx) => {
    const chatId = ctx.chat.id;
    const cardId = ctx.match[1];
    const activeCard = activeCards.get(chatId);

    if (!activeCard || activeCard.cardId.toString() !== cardId || activeCard.isGrabbed) {
      return ctx.answerCallbackQuery({ text: "❌ ဒီကတ်ကို အခြားသူ ကောက်ယူသွားပြီ သို့မဟုတ် သက်တမ်းကုန်သွားပါပြီ။", show_alert: true });
    }

    await ctx.answerCallbackQuery({
      text: `⌨️ ကတ်ကိုကောက်ယူရန် /catch [ကတ်နာမည်] ကို Group ထဲတွင် ရိုက်ထည့်ပါ!`,
      show_alert: true
    });
  });

  // 8. /catch Command (ကတ်အလွယ်တကူ ကောက်ယူရန်)
  bot.command('catch', async (ctx) => {
    if (ctx.chat.type === 'private') return ctx.reply('⚠️ ဤ Command ကို Group တွင်သာ အသုံးပြုရပါမည်။');

    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const userName = ctx.from.first_name || 'User';
    const inputCardName = ctx.message.text.replace('/catch', '').trim().toLowerCase();

    if (!inputCardName) {
      return ctx.reply('⚠️ ကျေးဇူးပြု၍ /catch နှင့်အတူ ကတ်နာမည်ကို ထည့်ရေးပါ။ (ဥပမာ: `/catch Lu Bu`)', {
        reply_parameters: { message_id: ctx.message.message_id }
      });
    }

    const activeCard = activeCards.get(chatId);
    if (!activeCard || activeCard.isGrabbed) {
      return ctx.reply('❌ လက်ရှိ Group တွင် လုယူရန် ကတ်မရှိပါ (သို့မဟုတ်) သက်တမ်းကုန်သွားပါပြီ။', {
        reply_parameters: { message_id: ctx.message.message_id }
      });
    }

    if (inputCardName !== activeCard.cardName) {
      return ctx.reply('❌ ကတ်နာမည် မှားယွင်းနေပါသည်။ တရားဝင် ကတ်နာမည်ကို အတိအကျ ရိုက်ထည့်ပါရှင့်။', {
        reply_parameters: { message_id: ctx.message.message_id }
      });
    }

    // ကတ်ကို အောင်မြင်စွာ ကောက်ယူခြင်း
    activeCard.isGrabbed = true;
    activeCards.delete(chatId);

    let userInv = await UserInventory.findOne({ userId });
    if (!userInv) {
      userInv = await UserInventory.create({ userId, userName, cards: [], coins: 0 });
    }

    const isDuplicate = userInv.cards.includes(activeCard.cardId);

    if (isDuplicate) {
      const rewardCoins = 500;
      userInv.coins += rewardCoins;
      await userInv.save();

      await ctx.reply(`🪙 **[ထပ်နေသော ကတ်]**\n\n👤 **${userName}** ရေ၊ သင့်တွင် **"${activeCard.realName}"** ကတ် ရှိပြီးသားဖြစ်သဖြင့် မတ်ကြေးပိုက်ဆံ **${rewardCoins} Coins** ကို လဲလှယ်ပေးလိုက်ပါပြီ!`, {
        reply_parameters: { message_id: ctx.message.message_id }
      });
    } else {
      userInv.cards.push(activeCard.cardId);
      await userInv.save();
      await Card.findByIdAndUpdate(activeCard.cardId, { ownerId: userId });

      let extraMsg = `\n📝 **Bio:** ${activeCard.bio}`;

      if (activeCard.isPrizeCard) {
        const secretKey = generateCustomKey();
        await KeyModel.create({
          key: secretKey,
          userId,
          cardName: activeCard.realName,
          prizeDetails: activeCard.prizeType,
          ownerGenerated: false
        });

        extraMsg += `\n\n🏆 **[GOLD PRIZE WINNER!]**\n🎁 ဆုကြေး: **${activeCard.prizeType}**\n🔑 Secret Key: \`${secretKey}\`\n\n📢 ဆုကြေးထုတ်ယူရန် Channel သို့ Join ပြီး Private Chat တွင် /checkkey [Key] ရိုက်ပါ။`;
      }

      const keyboard = new InlineKeyboard().url("📢 Channel သို့ Join ရန် နှိပ်ပါ", REQUIRED_CHANNEL);

      await ctx.reply(`🎉 **[CARD GRABBED SUCCESSFULLY!]**\n\n👤 ကောက်ယူသူ: **${userName}**\n🃏 ကတ်နာမည်: **${activeCard.realName}**\n🏷️ အဆင့်: **${activeCard.rarity}**${extraMsg}`, {
        reply_parameters: { message_id: ctx.message.message_id },
        reply_markup: keyboard
      });

      try {
        await bot.api.deleteMessage(chatId, activeCard.messageId);
      } catch (e) {}
    }
  });

  // 9. Text Handler (Char Counter တွက်ရန်)
  bot.on('message:text', async (ctx, next) => {
    if (ctx.chat.type === 'private') return next();

    const chatId = ctx.chat.id;
    const text = ctx.message.text;

    // /catch ဖြင့် စတင်သော မက်ဆေ့ချ်မဟုတ်မှသာ charCount တွက်မည်
    if (!text.startsWith('/catch')) {
      let activity = await GroupActivity.findOne({ chatId });
      if (!activity) activity = await GroupActivity.create({ chatId, charCount: 0 });

      activity.charCount += text.length;
      if (activity.charCount >= 500) {
        activity.charCount = 0;
        await activity.save();
        await spawnCardToGroup(bot, chatId);
      } else {
        await activity.save();
      }
    }

    return next();
  });

  // 10. Key စစ်ဆေးခြင်း (/checkkey [Key])
  bot.command('checkkey', async (ctx) => {
    if (ctx.chat.type !== 'private') return ctx.reply('⚠️ ဤ Command ကို Private Chat တွင်သာ သုံးပါခင်ဗျာ။');

    const args = ctx.message.text.split(' ').slice(1);
    const inputKey = args[0];
    const userId = ctx.from.id;

    if (!inputKey) return ctx.reply('⚠️ ကျေးဇူးပြု၍ စစ်ဆေးလိုသော Key ထည့်ပေးပါ။ (ဥပမာ: /checkkey ABC123XYZ9)');

    try {
      const chatMember = await bot.api.getChatMember(CHANNEL_USERNAME, userId);
      const allowedStatuses = ['creator', 'administrator', 'member'];
      if (!allowedStatuses.includes(chatMember.status)) {
        return ctx.reply(`❌ **ဆုကြေးမရသေးပါ!**\n\nကျေးဇူးပြု၍ အောက်ပါ Channel သို့ Join ထားပေးပါ -\n📢 Channel: ${REQUIRED_CHANNEL}\n\nJoin ပြီးမှ /checkkey ကို ထပ်မံရိုက်ပါ။`);
      }
    } catch (err) {
      return ctx.reply(`⚠️ Channel စစ်ဆေးမရပါ။ Bot သည် ${CHANNEL_USERNAME} ၏ Admin ဖြစ်ရပါမည်။`);
    }

    const keyData = await KeyModel.findOne({ key: inputKey.toUpperCase() });

    if (!keyData) return ctx.reply('❌ သင့် Key မှားယွင်းနေပါသည်။');
    if (keyData.isRedeemed) return ctx.reply('⚠️ ဤ Key သည် ဆုကြေးထုတ်ယူပြီးသား ဖြစ်နေပါပြီ။');

    keyData.isRedeemed = true;
    await keyData.save();

    await ctx.reply(`✅ **[Verified Successfully - ဆုကြေးထုတ်ယူရန် အတည်ပြုပြီးပါပြီ!]**\n\n🎯 ကတ်/ဆုကြေးအမည်: **${keyData.cardName}**\n🎁 ဆုကြေးအသေးစိတ်: **${keyData.prizeDetails}**\n✨ Channel သို့ Join ထားသဖြင့် Owner ထံမှ ဆုကြေး ရရှိမည် ဖြစ်ပါသည်။`);

    try {
      await bot.api.sendMessage(OWNER_ID, `🎉 **[Prize Key Winner Verified!]**\n\n👤 User: ${ctx.from.first_name} (\`${userId}\`)\n🎯 Card: ${keyData.cardName}\n🎁 Prize: ${keyData.prizeDetails}\n🔑 Key: \`${inputKey}\`\n📢 Channel Join ထားသည်ကို အတည်ပြုပြီးပါပြီ။ ဆုကြေး ပေးအပ်နိုင်ပါပြီ။`);
    } catch (err) {}
  });

  // 11. ကတ် လက်ဆောင်ပေးခြင်း (/gift [ကတ်နာမည်])
  bot.command('gift', async (ctx) => {
    const repliedMsg = ctx.message.reply_to_message;
    if (!repliedMsg || !repliedMsg.from) {
      return ctx.reply('⚠️ ကျေးဇူးပြု၍ ကတ်ပေးလိုသူ၏ စာကို Reply ထောက်ပြီး /gift [ကတ်နာမည်] ဟု ရိုက်ပါ။');
    }

    const cardName = ctx.message.text.replace('/gift', '').trim().toLowerCase();
    if (!cardName) return ctx.reply('⚠️ ကျေးဇူးပြု၍ ပေးလိုသော ကတ်နာမည် ထည့်ပေးပါ။');

    const senderId = ctx.from.id;
    const receiverId = repliedMsg.from.id;
    const receiverName = repliedMsg.from.first_name || 'User';

    if (senderId === receiverId) return ctx.reply('❌ မိမိကိုယ်ကို ကတ်ပြန်ပေး၍ မရပါ။');

    const senderInv = await UserInventory.findOne({ userId: senderId }).populate('cards');
    if (!senderInv || senderInv.cards.length === 0) return ctx.reply('❌ သင့်တွင် လက်ဆောင်ပေးရန် ကတ်မရှိပါ။');

    const targetCard = senderInv.cards.find(c => c.name.toLowerCase() === cardName);
    if (!targetCard) return ctx.reply(`❌ သင့်တွင် **"${cardName}"** နာမည်ရှိသော ကတ်မရှိပါ။`);

    senderInv.cards = senderInv.cards.filter(c => c._id.toString() !== targetCard._id.toString());
    await senderInv.save();

    let receiverInv = await UserInventory.findOne({ userId: receiverId });
    if (!receiverInv) {
      receiverInv = await UserInventory.create({ userId: receiverId, userName: receiverName, cards: [] });
    }
    receiverInv.cards.push(targetCard._id);
    await receiverInv.save();

    await Card.findByIdAndUpdate(targetCard._id, { ownerId: receiverId });

    await ctx.reply(`🎁 **[Gift Successful]**\n${ctx.from.first_name} က **${receiverName}** ထံသို့ **"${targetCard.name}"** ကတ်ကို လက်ဆောင်ပေးလိုက်ပါပြီ!`);
  });

  // 12. ၁ နာရီတစ်ခါ Auto Spawner
  setInterval(async () => {
    try {
      const groups = await GroupActivity.find({});
      for (const group of groups) {
        await spawnCardToGroup(bot, group.chatId);
      }
    } catch (err) {}
  }, 60 * 60 * 1000);

  // 13. ကတ်ကြည့်ရန် (/mycards)
  bot.command('mycards', async (ctx) => {
    const userId = ctx.from.id;
    const inventory = await UserInventory.findOne({ userId }).populate('cards');

    if (!inventory || inventory.cards.length === 0) {
      return ctx.reply(`🎒 သင့်တွင် ကတ်မရှိသေးပါ။\n🪙 မတ်ကြေး လက်ကျန်: **${inventory ? inventory.coins : 0} Coins**`);
    }

    let listText = `🎒 **${ctx.from.first_name} ၏ Card Inventory**\n🪙 မတ်ကြေး လက်ကျန်: **${inventory.coins} Coins**\n\n`;
    inventory.cards.forEach((card, index) => {
      listText += `${index + 1}. **${card.name}** (${card.rarity})${card.isPrizeCard ? ' 🏆' : ''}\n`;
    });

    await ctx.reply(listText, { parse_mode: 'Markdown' });
  });
}

module.exports = { setupCardGameModule };
