const { Bot, InlineKeyboard } = require('grammy');
const mongoose = require('mongoose');

// Schemas
const cloneLogSchema = new mongoose.Schema({
  ownerId: { type: Number, required: true },
  ownerUsername: { type: String, default: 'None' },
  ownerFullName: { type: String, required: true },
  creatorId: { type: Number, required: true },
  botToken: { type: String, required: true, unique: true },
  botUsername: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const subBotSettingSchema = new mongoose.Schema({
  botUsername: { type: String, required: true, unique: true },
  ownerId: { type: Number, required: true },
  startVideoId: { type: String, default: null },
  customText: { type: String, default: null },
  buttonName: { type: String, default: null },
  buttonUrl: { type: String, default: null },
  subscribers: [{ type: Number }],
  updatedAt: { type: Date, default: Date.now }
});

const cloneMemorySchema = new mongoose.Schema({
  botUsername: { type: String, required: true },
  text: { type: String, required: true }
});

const BotCloneLog = mongoose.models.BotCloneLog || mongoose.model('BotCloneLog', cloneLogSchema);
const SubBotSetting = mongoose.models.SubBotSetting || mongoose.model('SubBotSetting', subBotSettingSchema);

const userSteps = new Map();
const activeSubBots = new Map();

// Clone Bot သီးသန့် Auto Reaction Emoji များ
const CLONE_BOT_REACTIONS = ["🤣", "🤩", "🗿", "🫡", "👻", "🎃", "👾", "🏆"];

function containsLink(text) {
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(t\.me\/[^\s]+)|(@[a-zA-Z0-9_]+)/g;
  return urlRegex.test(text);
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;  
  }
}

async function startSubBot(cloneDoc, CloneMemoryModel) {
  const token = cloneDoc.botToken;
  if (activeSubBots.has(token)) return true;

  try {
    const subBot = new Bot(token);

    let setting = await SubBotSetting.findOne({ botUsername: cloneDoc.botUsername });
    if (!setting) {
      setting = await SubBotSetting.create({ botUsername: cloneDoc.botUsername, ownerId: cloneDoc.ownerId });
    }

    // /start Command
    subBot.command('start', async (ctx) => {
      const user = ctx.from;
      await SubBotSetting.updateOne({ botUsername: cloneDoc.botUsername }, { $addToSet: { subscribers: user.id } });

      let bioText = "မရှိပါ";
      try {
        const fullUser = await ctx.api.getChat(user.id);
        if (fullUser.bio) bioText = fullUser.bio;
      } catch (e) {}

      const infoText = `Name😘- ${user.first_name || ''} ${user.last_name || ''}\n` +
                       `Id🤭          - <code>${user.id}</code>\n` +
                       `@user🤪- ${user.username ? '@' + user.username : 'မရှိပါ'}\n` +
                       `Bio🥴   - ${bioText}`;

      const currentSetting = await SubBotSetting.findOne({ botUsername: cloneDoc.botUsername });
      const keyboard = new InlineKeyboard();

      if (currentSetting && currentSetting.buttonName && currentSetting.buttonUrl) {
        keyboard.url(currentSetting.buttonName, currentSetting.buttonUrl);
      }

      const captionText = currentSetting?.customText ? `${infoText}\n\n${currentSetting.customText}` : infoText;

      if (currentSetting && currentSetting.startVideoId) {
        await ctx.replyWithVideo(currentSetting.startVideoId, {
          caption: captionText,
          parse_mode: 'HTML',
          reply_markup: keyboard
        });
      } else {
        await ctx.reply(captionText, {
          parse_mode: 'HTML',
          reply_markup: keyboard
        });
      }
    });

    // Start Video Setting Commands (/Csvideo, /cv, /dcv)
    subBot.command('Csvideo', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      const replyMsg = ctx.message.reply_to_message;
      if (replyMsg && replyMsg.video) {
        await SubBotSetting.updateOne({ botUsername: cloneDoc.botUsername }, { startVideoId: replyMsg.video.file_id });
        ctx.reply("✅ Start Video ကို မှတ်သားလိုက်ပါပြီ။");
      } else {
        ctx.reply("⚠️ Video ကို Reply ထောက်ပြီး /Csvideo ဟု ပို့ပေးပါ။");
      }
    });

    subBot.command('cv', async (ctx) => {
      const currentSetting = await SubBotSetting.findOne({ botUsername: cloneDoc.botUsername });
      if (currentSetting && currentSetting.startVideoId) {
        await ctx.replyWithVideo(currentSetting.startVideoId, { caption: "📹 သတ်မှတ်ထားသော Start Video" });
      } else {
        ctx.reply("⚠️ Start Video မရှိသေးပါ။");
      }
    });

    subBot.command('dcv', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      await SubBotSetting.updateOne({ botUsername: cloneDoc.botUsername }, { startVideoId: null });
      ctx.reply("✅ Start Video ကို ဖျက်လိုက်ပါပြီ။");
    });

    // Start Text Setting (/Ctxet)
    subBot.command('Ctxet', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      const replyMsg = ctx.message.reply_to_message;
      if (replyMsg && replyMsg.text) {
        await SubBotSetting.updateOne({ botUsername: cloneDoc.botUsername }, { customText: replyMsg.text });
        ctx.reply("✅ Custom စာသားကို မှတ်သားလိုက်ပါပြီရှင့်။");
      } else {
        ctx.reply("⚠️ စာသားကို Reply ထောက်ပြီး /Ctxet ဟု ပို့ပေးပါရှင့်။");
      }
    });

    // Button Setup (/button)
    subBot.command('button', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      userSteps.set(ctx.from.id, { step: 'WAIT_BTN_NAME' });
      ctx.reply("📌Button Nameရေးပေးပါရှင့်\n(ဉပမာ- Mamahone😁(စတာပါကြိုက်တာရေးပေးပါ)");
    });

    // Broadcast (/CB, /CBT)
    subBot.command('CB', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      ctx.reply("ကြောညာစနစ်အသက်ဝင်ပါပီရှင့်။📊📊\nကြောညာလို့သည့် (txet/video/photo/poll/stickerအစရှိသည်ကို(replyထောက်ပီး/CBTလို့ပို့ပေးပါရှင့်🤪🤪)");
    });

    subBot.command('CBT', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      const replyMsg = ctx.message.reply_to_message;
      if (!replyMsg) return ctx.reply("⚠️ Reply ထောက်ပြီး /CBT လို့ ပို့ပေးပါရှင့်။");

      const currentSetting = await SubBotSetting.findOne({ botUsername: cloneDoc.botUsername });
      const users = currentSetting.subscribers || [];

      await ctx.reply(`⏳ကြောညာစတင်ပို့ဆောင်နေပါပီရှင့်📌📌\n📊📊\nGroup(0)\nMamber chat(${users.length})\nChannel(0)\n📡📡`);

      let success = 0, failed = 0;
      for (const uId of users) {
        try {
          await ctx.api.copyMessage(uId, ctx.chat.id, replyMsg.message_id);
          success++;
        } catch (e) {
          failed++;
        }
      }

      ctx.reply(`⌛ကြောညာပို့ဆောင်မူပီးဆုံး📊📊\n\nGroup(0)\nMamber chat(${success})\nChannel(0)ရောက်ရှိ🔗🔗\nမရောက်😓🚨\nGroup(0)\nMamber chat(${failed})\nChannel(0)\nThank you⌛⌛`);
    });

    // Message Handlers (Auto Reaction + Button Logic + MongoDB 2 Learning)
    subBot.on('message', async (ctx, next) => {
      const userId = ctx.from.id;
      const text = ctx.message.text;

      // 1. Auto Reaction (Clone Bot သီးသန့် Emoji)
      try {
        const randomEmoji = CLONE_BOT_REACTIONS[Math.floor(Math.random() * CLONE_BOT_REACTIONS.length)];
        await ctx.react(randomEmoji);
      } catch (err) {}

      // 2. Button Flow Step Logic
      if (userId === cloneDoc.ownerId && userSteps.has(userId)) {
        const userStep = userSteps.get(userId);

        if (userStep.step === 'WAIT_BTN_NAME' && text) {
          userSteps.set(userId, { step: 'WAIT_BTN_LINK', name: text });
          return ctx.reply("🔗🔗UPI Linkရေးပေးပါရှင့်\n(ဉပမာ- https://t.me/BOTUAPTE   🍃🍃)");
        }

        if (userStep.step === 'WAIT_BTN_LINK' && text) {
          const cleanUrl = text.trim();
          if (!isValidUrl(cleanUrl)) {
            return ctx.reply("🔗🔗မှားနေရင် UPI Linkkမှားနေပါသည်ရှင့်\nဉပမာအတိုင်းရေးပေးပါရှင့်📍📍");
          }

          await SubBotSetting.updateOne(
            { botUsername: cloneDoc.botUsername },
            { buttonName: userStep.name, buttonUrl: cleanUrl }
          );

          userSteps.delete(userId);
          return ctx.reply(`📍ခလုပ်အမည်။\n    ${userStep.name}\n📍UPI link\n   ${cleanUrl}`);
        }
      }

      // 3. Read & Learn Chat to MongoDB 2 (Link မပါသော စာများ)
      if (text && !text.startsWith('/') && !containsLink(text)) {
        await CloneMemoryModel.create({ botUsername: cloneDoc.botUsername, text });

        // Random Reply (35% Chance)
        if (Math.random() < 0.35) {
          const memories = await CloneMemoryModel.find({ botUsername: cloneDoc.botUsername });
          if (memories.length > 0) {
            const randomMsg = memories[Math.floor(Math.random() * memories.length)].text;
            await ctx.reply(randomMsg);
          }
        }
      }

      await next();
    });

    subBot.start();
    activeSubBots.set(token, subBot);
    return true;
  } catch (err) {
    console.error("SubBot Error:", err);
    return false;
  }
}

function setupCloneModule(mainBot, MAIN_OWNER_ID, SECOND_MONGO_URI) {
  // MongoDB 2 Connection ချိတ်ဆက်ခြင်း
  const secondDb = mongoose.createConnection(SECOND_MONGO_URI);
  const CloneMemoryModel = secondDb.model('CloneMemory', cloneMemorySchema);

  BotCloneLog.find({ isActive: true }).then(async (clones) => {
    for (const cloneDoc of clones) {
      await startSubBot(cloneDoc, CloneMemoryModel);
    }
  });

  mainBot.use(async (ctx, next) => {
    if (!ctx.message || !ctx.message.text) return await next();

    const text = ctx.message.text.trim();
    const userId = ctx.from.id;

    if (text === '/clonebot') {
      return ctx.reply("Goodlucky✅✅\nBotဖန်တီခွင့်🎁ရရှိပါသည့်ရှင့်🥰\nဖန်တီးလို့ပါက /playbot ဟုရေးပေးပါရှင့်🔐");
    }

    if (text === '/playbot') {
      userSteps.set(userId, { step: 'AWAITING_ID' });
      return ctx.reply("💬\nBotဖန်တီးရန်👉 /id[သင့်အကောင့်id] ဟုပို့ပေးပါရှင့်💖");
    }

    const stepData = userSteps.get(userId);
    if (stepData) {
      if (stepData.step === 'AWAITING_ID' && text.startsWith('/id')) {
        const extractedId = parseInt(text.replace('/id', '').trim());
        if (isNaN(extractedId)) return ctx.reply("⚠️ ID မှားနေပါသည်။ ပြန်ပို့ပေးပါ။");

        userSteps.set(userId, { step: 'AWAITING_USERNAME', ownerId: extractedId });
        return ctx.reply("/Bot @uesr ကိုပို့ပေးပါရှင့်🔐");
      }

      if (stepData.step === 'AWAITING_USERNAME' && text.startsWith('/Bot')) {
        const botUsername = text.replace('/Bot', '').trim().replace('@', '');
        userSteps.set(userId, { step: 'AWAITING_TOKEN', ownerId: stepData.ownerId, botUsername });
        return ctx.reply("အောင်မြင်ပါသည့်✅✅\n/clone [သင့်botfatherဆီကရတဲtokenကိုထည့်ပေးပါရှင့်]");
      }

      if (stepData.step === 'AWAITING_TOKEN' && text.startsWith('/clone')) {
        const tokenInput = text.replace('/clone', '').trim();

        try {
          const tempBot = new Bot(tokenInput);
          const botInfo = await tempBot.api.getMe();

          const cloneDoc = await BotCloneLog.create({
            ownerId: stepData.ownerId,
            ownerUsername: ctx.from.username || 'None',
            ownerFullName: `${ctx.from.first_name || ''}`,
            creatorId: userId,
            botToken: tokenInput,
            botUsername: botInfo.username
          });

          await startSubBot(cloneDoc, CloneMemoryModel);
          userSteps.delete(userId);

          return ctx.reply(`🎉 <b>Clone Bot စတင်မောင်းနှင်ပါပြီ!</b>\n\n👤 <b>Owner ID:</b> <code>${stepData.ownerId}</code>\n🤖 <b>Bot:</b> @${botInfo.username}`, { parse_mode: 'HTML' });

        } catch (e) {
          return ctx.reply("❌ Bot Token မှားယွင်းနေပါသည်။ ပြန်လည်စစ်ဆေးပါ။");
        }
      }
    }

    await next();
  });
}

module.exports = setupCloneModule;
