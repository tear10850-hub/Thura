const { Bot, InlineKeyboard } = require('grammy');
const mongoose = require('mongoose');

// ==========================================
// 1. DATABASE SETUP
// ==========================================
const keySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  createdBy: { type: Number, required: true },
  isUsed: { type: Boolean, default: false },
  usedBy: { type: Number, default: null },
  usedAt: { type: Date, default: null }
});

const userSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true },
  freeUsed: { type: Boolean, default: false },
  paidQuota: { type: Number, default: 0 }
});

const PremiumKey = mongoose.models.PremiumKey || mongoose.model('PremiumKey', keySchema);
const UserProfile = mongoose.models.UserProfile || mongoose.model('UserProfile', userSchema);

// SECONDARY MONGO CONNECTION (Fallback to primary if not provided)
const secondMongoUri = process.env.SECOND_MONGO_URI || process.env.MONGO_URI;
const secondConn = mongoose.createConnection(secondMongoUri);

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
  startMediaId: { type: String, default: null },
  startMediaType: { type: String, enum: ['photo', 'video', 'none'], default: 'none' },
  startText: { type: String, default: "👋 <b>မင်္ဂလာပါ!</b>\n\nဤ Bot မှ ကြိုဆိုပါသည်... ✨" },
  startButtons: [{
    label: { type: String, required: true },
    url: { type: String, required: true }
  }],
  totalUsersCount: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});

const helpContentSchema = new mongoose.Schema({
  key: { type: String, default: 'helpcbot_content' },
  type: { type: String, enum: ['text', 'photo', 'video'], required: true },
  fileId: { type: String, default: null },
  text: { type: String, default: null }
});

const BotCloneLog = secondConn.model('BotCloneLog', cloneLogSchema);
const SubBotSetting = secondConn.model('SubBotSetting', subBotSettingSchema);
const HelpContent = secondConn.model('HelpContent', helpContentSchema);

const userSteps = new Map();
const activeSubBots = new Map();

async function getUserProfile(userId) {
  let profile = await UserProfile.findOne({ userId });
  if (!profile) profile = await UserProfile.create({ userId });
  return profile;
}

function generateRandomKey() {
  let digits = '';
  for (let i = 0; i < 12; i++) digits += Math.floor(Math.random() * 10);
  return `BT Tear${digits}`;
}

function getDeleteKeyboard() {
  return new InlineKeyboard().text("❌ Delete Message", "delete_msg");
}

// ==========================================
// 2. SUB-BOT ENGINE
// ==========================================
async function startSubBot(cloneDoc, registerMainBotFunctions) {
  const token = cloneDoc.botToken;
  if (activeSubBots.has(token)) return true;

  try {
    const subBot = new Bot(token);

    let setting = await SubBotSetting.findOne({ botUsername: cloneDoc.botUsername });
    if (!setting) {
      await SubBotSetting.create({ botUsername: cloneDoc.botUsername, ownerId: cloneDoc.ownerId });
    }

    subBot.command('setstarttext', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      const args = ctx.message.text.trim().split(' ').slice(1).join(' ');
      if (!args) return ctx.reply("⚠️ စာသား ရိုက်ပေးပါ။");
      await SubBotSetting.updateOne({ botUsername: cloneDoc.botUsername }, { startText: args });
      ctx.reply("✅ Start စာသား ပြောင်းလဲပြီးပါပြီ။", { reply_markup: getDeleteKeyboard() });
    });

    subBot.command('addbutton', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      const input = ctx.message.text.trim().split(' ').slice(1).join(' ');
      const parts = input.split('|');
      if (parts.length < 2) return ctx.reply("⚠️ Format: `/addbutton Name | https://link`");

      const current = await SubBotSetting.findOne({ botUsername: cloneDoc.botUsername });
      const btns = current.startButtons || [];
      btns.push({ label: parts[0].trim(), url: parts[1].trim() });

      await SubBotSetting.updateOne({ botUsername: cloneDoc.botUsername }, { startButtons: btns });
      ctx.reply("✅ Link Button ထည့်ပြီးပါပြီ။");
    });

    subBot.command('delbuttons', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      await SubBotSetting.updateOne({ botUsername: cloneDoc.botUsername }, { startButtons: [] });
      ctx.reply("🗑️ Inline Buttons များ ဖျက်ပြီးပါပြီ။");
    });

    subBot.command('start', async (ctx) => {
      const currentSetting = await SubBotSetting.findOne({ botUsername: cloneDoc.botUsername });
      const keyboard = new InlineKeyboard();

      if (currentSetting && currentSetting.startButtons) {
        currentSetting.startButtons.forEach(btn => keyboard.url(btn.label, btn.url).row());
      }

      const txt = currentSetting ? currentSetting.startText : "👋 မင်္ဂလာပါ!";
      await ctx.reply(txt, { parse_mode: 'HTML', reply_markup: keyboard });
    });

    if (typeof registerMainBotFunctions === 'function') {
      registerMainBotFunctions(subBot);
    }

    subBot.start();
    activeSubBots.set(token, subBot);
    return true;
  } catch (err) {
    console.error("SubBot Error:", err);
    return false;
  }
}

// ==========================================
// 3. MAIN BOT CLONE CONTROLLER
// ==========================================
function setupCloneModule(mainBot, MAIN_OWNER_ID, registerMainBotFunctions) {

  // DB#2 အဟောင်းမှ Clone Bot များ Auto Run
  BotCloneLog.find({ isActive: true }).then(async (clones) => {
    for (const cloneDoc of clones) {
      await startSubBot(cloneDoc, registerMainBotFunctions);
    }
  });

  // အလုပ်လုပ်အောင် တိုက်ရိုက် Middleware အနေဖြင့် စစ်ပေးခြင်း
  mainBot.use(async (ctx, next) => {
    if (!ctx.message || !ctx.message.text) return await next();

    const text = ctx.message.text.trim();
    const userId = ctx.from.id;

    // 1. /clonebot Command
    if (text === '/clonebot') {
      const profile = await getUserProfile(userId);
      if (!profile.freeUsed || profile.paidQuota > 0 || userId === MAIN_OWNER_ID) {
        return ctx.reply("Goodlucky✅✅\nပထမဆုံးBotဖန်တီခွင့်🎁(1)ကြိမ်ရရှိပါသည့်ရှင့်🥰\nဖန်တီးလို့ပါက /playbot ဟုရေးပေးပါရှင့်🔐");
      } else {
        return ctx.reply("⚠️ သင်၏ Free Bot ဖန်တီးခွင့် ကုန်ဆုံးသွားပါပြီ။\nKey ဝယ်ယူပြီး /key <Key_Code> ဟု ပို့ပေးပါ။");
      }
    }

    // 2. /playbot Command
    if (text === '/playbot') {
      userSteps.set(userId, { step: 'AWAITING_ID' });
      return ctx.reply("💬\nBotဖန်တီးရန်👉 /id[သင့်အကောင့်id] ဟုပို့ပေးပါရှင့်💖");
    }

    // 3. /key Command
    if (text.startsWith('/key')) {
      const keyInput = text.split(' ')[1];
      if (!keyInput) return ctx.reply("⚠️ Format: /key BT Tearxxxxxx");

      const keyData = await PremiumKey.findOne({ key: keyInput });
      if (!keyData || keyData.isUsed) return ctx.reply("❌ Key မှားယွင်းနေပါသည် သို့မဟုတ် အသုံးပြုပြီးသားပါ။");

      keyData.isUsed = true;
      keyData.usedBy = userId;
      keyData.usedAt = new Date();
      await keyData.save();

      const profile = await getUserProfile(userId);
      profile.paidQuota += 1;
      await profile.save();

      return ctx.reply("✅ Key အသုံးပြုပြီးပါပြီ! /playbot ဟု နှိပ်၍ စတင်ပါ။");
    }

    // 4. Step Process (/id, /Bot, /clone)
    const stepData = userSteps.get(userId);
    if (stepData) {
      if (stepData.step === 'AWAITING_ID' && text.startsWith('/id')) {
        const extractedId = parseInt(text.replace('/id', '').trim());
        if (isNaN(extractedId)) return ctx.reply("⚠️ ID မှားနေပါသည်။ ပြန်ပို့ပေးပါ။");

        userSteps.set(userId, { step: 'AWAITING_USERNAME', ownerId: extractedId });
        return ctx.reply("/Bot @uesr ကိုပို့ပေးပါရှင့်🔐");
      }

      if (stepData.step === 'AWAITING_USERNAME' && text.startsWith('/Bot')) {
        const botUsername = text.replace('/Bot', '').trim();
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

          await startSubBot(cloneDoc, registerMainBotFunctions);

          const profile = await getUserProfile(userId);
          if (!profile.freeUsed) profile.freeUsed = true;
          else if (profile.paidQuota > 0) profile.paidQuota -= 1;
          await profile.save();

          userSteps.delete(userId);
          return ctx.reply(`CloneBotစတင်နေပါပီရှင့်⏳\nဖန်တီးသူ--id=${stepData.ownerId}\nBot =@${botInfo.username}\nကြည့်ရန် /Helpcbot ဟုပို့ပေးပါရှင့်🔐🔐`);

        } catch (e) {
          return ctx.reply("❌ Bot Token မှားယွင်းနေပါသည်။ ပြန်လည်စစ်ဆေးပါ။");
        }
      }
    }

    await next();
  });

  // Owner Commands (/botlogs, /offclone, /onclone, /broadcast)
  mainBot.command('botlogs', async (ctx) => {
    if (ctx.from.id !== MAIN_OWNER_ID) return;
    const logs = await BotCloneLog.find().sort({ createdAt: -1 }).limit(10);
    let msg = `📜 <b>Clone Bot မှတ်တမ်းများ</b>\n\n`;
    logs.forEach((l, i) => {
      msg += `${i + 1}. @${l.botUsername} | Owner: <code>${l.ownerId}</code> | Status: ${l.isActive ? '🟢' : '🔴'}\n`;
    });
    ctx.reply(msg, { parse_mode: 'HTML' });
  });

  mainBot.command('offclone', async (ctx) => {
    if (ctx.from.id !== MAIN_OWNER_ID) return;
    const botName = ctx.message.text.split(' ')[1]?.replace('@', '');
    const doc = await BotCloneLog.findOne({ botUsername: botName });
    if (doc) {
      doc.isActive = false;
      await doc.save();
      if (activeSubBots.has(doc.botToken)) {
        await activeSubBots.get(doc.botToken).stop();
        activeSubBots.delete(doc.botToken);
      }
      ctx.reply(`⛔ @${botName} ကို ပိတ်လိုက်ပါပြီ။`);
    }
  });

  mainBot.command('genkey', async (ctx) => {
    if (ctx.from.id !== MAIN_OWNER_ID) return;
    const k = generateRandomKey();
    await PremiumKey.create({ key: k, createdBy: ctx.from.id });
    ctx.reply(`🔑 Key: <code>${k}</code>`, { parse_mode: 'HTML' });
  });
}

module.exports = setupCloneModule;
