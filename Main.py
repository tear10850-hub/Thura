const { Bot, InlineKeyboard } = require('grammy');
const mongoose = require('mongoose');

// ==========================================
// 1. PRIMARY & SECONDARY DATABASE SETUP
// ==========================================

// Primary Database Schemas (Primary DB#1)
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

const PremiumKey = mongoose.model('PremiumKey', keySchema);
const UserProfile = mongoose.model('UserProfile', userSchema);


// Secondary Database Connection (DB#2) - ALL SUB-BOT DATA & HELPCBOT HERE
const secondMongoUri = process.env.SECOND_MONGO_URI;
let secondConn = null;
let BotCloneLog = null;
let SubBotSetting = null;
let HelpContent = null;

if (secondMongoUri) {
  secondConn = mongoose.createConnection(secondMongoUri);

  // Clone Logs & Info (DB#2)
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

  // Sub-Bot Settings (Video, Photo, Buttons & Start Text) - (DB#2)
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

  // Helpcbot Content Storage (DB#2)
  const helpContentSchema = new mongoose.Schema({
    key: { type: String, default: 'helpcbot_content' },
    type: { type: String, enum: ['text', 'photo', 'video'], required: true },
    fileId: { type: String, default: null },
    text: { type: String, default: null }
  });

  BotCloneLog = secondConn.model('BotCloneLog', cloneLogSchema);
  SubBotSetting = secondConn.model('SubBotSetting', subBotSettingSchema);
  HelpContent = secondConn.model('HelpContent', helpContentSchema);
}

// Memory Cache & Steps Storage
const userSteps = new Map();
const activeSubBots = new Map();

// Helper Functions
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
// 2. SUB-BOT ENGINE (CLONE BOT WORKFLOW)
// ==========================================
async function startSubBot(cloneDoc, registerMainBotFunctions) {
  const token = cloneDoc.botToken;
  if (activeSubBots.has(token)) return true;

  try {
    const subBot = new Bot(token);

    // DB#2 Customization Verification
    if (SubBotSetting) {
      let setting = await SubBotSetting.findOne({ botUsername: cloneDoc.botUsername });
      if (!setting) {
        await SubBotSetting.create({
          botUsername: cloneDoc.botUsername,
          ownerId: cloneDoc.ownerId
        });
      }
    }

    // -------------------------------------------------------------
    // SUB-BOT OWNER CUSTOMIZATIONS (Set, View & Delete Commands - DB#2)
    // -------------------------------------------------------------

    // ၁။ Start Text (Set / View / Delete)
    subBot.command('setstarttext', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return ctx.reply("❌ သင်သည် ဤ Bot ၏ Owner မဟုတ်ပါ။");
      const args = ctx.message.text.trim().split(' ').slice(1).join(' ');
      if (!args) return ctx.reply("⚠️ ပြောင်းလဲလိုသော စာသားကို ရိုက်ပေးပါ။", { reply_markup: getDeleteKeyboard() });

      if (SubBotSetting) {
        await SubBotSetting.updateOne({ botUsername: cloneDoc.botUsername }, { startText: args, updatedAt: new Date() });
      }
      ctx.reply("✅ <b>[DB#2] Start စာသား ပြောင်းလဲပြီးပါပြီ။</b>", { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });
    });

    subBot.command('viewstarttext', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      const setting = SubBotSetting ? await SubBotSetting.findOne({ botUsername: cloneDoc.botUsername }) : null;
      const text = setting ? setting.startText : "သတ်မှတ်ထားသော စာသားမရှိပါ။";
      ctx.reply(`📄 <b>လက်ရှိ Start စာသား:</b>\n\n${text}`, { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });
    });

    subBot.command('delstarttext', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      const defaultText = "👋 <b>မင်္ဂလာပါ!</b>\n\nဤ Bot မှ ကြိုဆိုပါသည်... ✨";
      if (SubBotSetting) {
        await SubBotSetting.updateOne({ botUsername: cloneDoc.botUsername }, { startText: defaultText, updatedAt: new Date() });
      }
      ctx.reply("🗑️ <b>Start စာသားကို Default မူလအတိုင်း ပြန်ပြောင်းလိုက်ပါပြီ။</b>", { reply_markup: getDeleteKeyboard() });
    });

    // ၂။ Start Media (Set / View / Delete)
    subBot.command('setstartmedia', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return ctx.reply("❌ Owner သာ ပြင်ဆင်နိုင်ပါသည်။");
      ctx.reply("📹 Video သို့မဟုတ် Photo ပို့ပြီး Caption တွင် <code>/setstartmedia</code> ဟု ရိုက်ပေးပါ။", { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });
    });

    subBot.on(['message:video', 'message:photo'], async (ctx, next) => {
      if (ctx.from.id === cloneDoc.ownerId && ctx.message.caption && ctx.message.caption.startsWith('/setstartmedia')) {
        let mediaType = 'photo';
        let fileId = null;

        if (ctx.message.photo) {
          fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        } else if (ctx.message.video) {
          mediaType = 'video';
          fileId = ctx.message.video.file_id;
        }

        if (SubBotSetting) {
          await SubBotSetting.updateOne(
            { botUsername: cloneDoc.botUsername },
            { startMediaId: fileId, startMediaType: mediaType, updatedAt: new Date() }
          );
        }
        return ctx.reply("✅ <b>[DB#2] Start Media (Photo/Video) သိမ်းဆည်းပြီးပါပြီ။</b>", { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });
      }
      await next();
    });

    subBot.command('viewstartmedia', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      const setting = SubBotSetting ? await SubBotSetting.findOne({ botUsername: cloneDoc.botUsername }) : null;

      if (!setting || setting.startMediaType === 'none' || !setting.startMediaId) {
        return ctx.reply("⚠️ Start Media (Photo/Video) သတ်မှတ်ထားခြင်း မရှိပါ။", { reply_markup: getDeleteKeyboard() });
      }

      if (setting.startMediaType === 'photo') {
        await ctx.replyWithPhoto(setting.startMediaId, { caption: "🖼️ လက်ရှိ သတ်မှတ်ထားသော Start Photo ဖြစ်ပါသည်။", reply_markup: getDeleteKeyboard() });
      } else if (setting.startMediaType === 'video') {
        await ctx.replyWithVideo(setting.startMediaId, { caption: "📹 လက်ရှိ သတ်မှတ်ထားသော Start Video ဖြစ်ပါသည်။", reply_markup: getDeleteKeyboard() });
      }
    });

    subBot.command('delstartmedia', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      if (SubBotSetting) {
        await SubBotSetting.updateOne(
          { botUsername: cloneDoc.botUsername },
          { startMediaId: null, startMediaType: 'none', updatedAt: new Date() }
        );
      }
      ctx.reply("🗑️ <b>Start Media (Photo/Video) ကို အောင်မြင်စွာ ဖျက်လိုက်ပါပြီ။</b>", { reply_markup: getDeleteKeyboard() });
    });

    // ၃။ Inline Link Buttons (Add / View / Delete)
    subBot.command('addbutton', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      const setting = SubBotSetting ? await SubBotSetting.findOne({ botUsername: cloneDoc.botUsername }) : null;
      const currentButtons = setting ? setting.startButtons : [];

      if (currentButtons.length >= 5) return ctx.reply("⚠️ Buttons အများဆုံး (၅) ခုထိသာ ထည့်နိုင်ပါသည်။", { reply_markup: getDeleteKeyboard() });

      const input = ctx.message.text.trim().split(' ').slice(1).join(' ');
      const parts = input.split('|');
      if (parts.length < 2) return ctx.reply("⚠️ Format: <code>/addbutton Channel | https://t.me/xxx</code>", { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });

      const updatedBtns = [...currentButtons, { label: parts[0].trim(), url: parts[1].trim() }];
      if (SubBotSetting) {
        await SubBotSetting.updateOne({ botUsername: cloneDoc.botUsername }, { startButtons: updatedBtns, updatedAt: new Date() });
      }
      ctx.reply(`✅ <b>Link Button ထည့်သွင်းပြီးပါပြီ:</b> ${parts[0].trim()}`, { reply_markup: getDeleteKeyboard() });
    });

    subBot.command('viewbuttons', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      const setting = SubBotSetting ? await SubBotSetting.findOne({ botUsername: cloneDoc.botUsername }) : null;

      if (!setting || !setting.startButtons || setting.startButtons.length === 0) {
        return ctx.reply("⚠️ ထည့်သွင်းထားသော Inline Buttons မရှိပါ။", { reply_markup: getDeleteKeyboard() });
      }

      let msg = "🔘 <b>လက်ရှိ ထည့်သွင်းထားသော Buttons များ:</b>\n\n";
      setting.startButtons.forEach((btn, i) => {
        msg += `${i + 1}. <b>${btn.label}</b> -> ${btn.url}\n`;
      });

      ctx.reply(msg, { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });
    });

    subBot.command('delbuttons', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      if (SubBotSetting) {
        await SubBotSetting.updateOne({ botUsername: cloneDoc.botUsername }, { startButtons: [], updatedAt: new Date() });
      }
      ctx.reply("🗑️ <b>Inline Link Buttons များ အားလုံး ဖျက်ပြီးပါပြီ။</b>", { reply_markup: getDeleteKeyboard() });
    });

    // -------------------------------------------------------------
    // SUB-BOT START MESSAGE & OWNER LOG ALERT
    // -------------------------------------------------------------
    subBot.command('start', async (ctx, next) => {
      const user = ctx.from;

      if (SubBotSetting) {
        await SubBotSetting.updateOne({ botUsername: cloneDoc.botUsername }, { $inc: { totalUsersCount: 1 } });
      }

      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      const logToOwner = `
📥 <b>User အသစ် သင့် Bot (@${cloneDoc.botUsername}) ကို Start လုပ်သည်!</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Name:</b> ${fullName}
🆔 <b>ID:</b> <code>${user.id}</code>
🔗 <b>Username:</b> ${user.username ? `@${user.username}` : 'မရှိပါ'}
⏰ <b>Time:</b> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Yangon' })}
━━━━━━━━━━━━━━━━━━━━`;

      try {
        const photos = await subBot.api.getUserProfilePhotos(user.id, { limit: 1 });
        if (photos.total_count > 0) {
          await subBot.api.sendPhoto(cloneDoc.ownerId, photos.photos[0][0].file_id, { caption: logToOwner, parse_mode: 'HTML' });
        } else {
          await subBot.api.sendMessage(cloneDoc.ownerId, logToOwner, { parse_mode: 'HTML' });
        }
      } catch (e) {}

      const setting = SubBotSetting ? await SubBotSetting.findOne({ botUsername: cloneDoc.botUsername }) : null;
      const keyboard = new InlineKeyboard();

      if (setting && setting.startButtons && setting.startButtons.length > 0) {
        setting.startButtons.forEach(btn => keyboard.url(btn.label, btn.url).row());
      }

      const startText = setting ? setting.startText : "👋 <b>မင်္ဂလာပါ!</b>";

      if (setting && setting.startMediaType === 'video' && setting.startMediaId) {
        await ctx.replyWithVideo(setting.startMediaId, { caption: startText, parse_mode: 'HTML', reply_markup: keyboard });
      } else if (setting && setting.startMediaType === 'photo' && setting.startMediaId) {
        await ctx.replyWithPhoto(setting.startMediaId, { caption: startText, parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(startText, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    });

    if (typeof registerMainBotFunctions === 'function') {
      registerMainBotFunctions(subBot);
    }

    subBot.start({ onStart: (info) => console.log(`🤖 Sub-Bot Active: @${info.username}`) });
    activeSubBots.set(token, subBot);
    return true;

  } catch (err) {
    console.error(`Sub-Bot Launch Failed (${token}):`, err.message);
    return false;
  }
}

// ==========================================
// 3. MAIN BOT & MAIN OWNER CONTROL SYSTEM
// ==========================================
function setupCloneModule(mainBot, MAIN_OWNER_ID, registerMainBotFunctions) {

  if (BotCloneLog) {
    BotCloneLog.find({ isActive: true }).then(async (clones) => {
      for (const cloneDoc of clones) {
        await startSubBot(cloneDoc, registerMainBotFunctions);
      }
    });
  }

  // STEP-BY-STEP CLONE CREATION FLOW
  mainBot.command('clonebot', async (ctx) => {
    const profile = await getUserProfile(ctx.from.id);

    if (!profile.freeUsed || profile.paidQuota > 0 || ctx.from.id === MAIN_OWNER_ID) {
      const msg = `Goodlucky✅✅\nပထမဆုံးBotဖန်တီခွင့်🎁(1)ကြိမ်ရရှိပါသည့်ရှင့်🥰\nဖန်တီးလို့ပါက /playbot ဟုရေးပေးပါရှင့်🔐`;
      return ctx.reply(msg, { reply_markup: getDeleteKeyboard() });
    } else {
      const msg = `⚠️ <b>သင်၏ Free Bot ဖန်တီးခွင့် ကုန်ဆုံးသွားပါပြီ။</b>\n\nBot ထပ်မံထုတ်ယူလိုပါက Key ဝယ်ယူ၍ <code>/key <Key_Code></code> ဟု ပို့ပေးပါရှင့်🔐`;
      return ctx.reply(msg, { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });
    }
  });

  mainBot.command('playbot', async (ctx) => {
    const profile = await getUserProfile(ctx.from.id);

    if (profile.freeUsed && profile.paidQuota <= 0 && ctx.from.id !== MAIN_OWNER_ID) {
      return ctx.reply("⚠️ Bot ထပ်မံထုတ်ယူရန်အတွက် Key ဝယ်ယူပြီး <code>/key <Key_Code></code> ဟု ပို့ပေးပါရှင့်🔐", { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });
    }

    userSteps.set(ctx.from.id, { step: 'AWAITING_ID' });
    const msg = `💬\nBotဖန်တီးရန်👉  /id[သင့်အကောင့်id] ဟုပို့ပေးပါရှင့်💖`;
    return ctx.reply(msg, { reply_markup: getDeleteKeyboard() });
  });

  mainBot.on('message:text', async (ctx, next) => {
    const text = ctx.message.text.trim();
    const userId = ctx.from.id;
    const userStep = userSteps.get(userId);

    if (text.startsWith('/key')) {
      const args = text.split(' ');
      const keyInput = args[1] ? args[1].trim() : '';

      if (!keyInput) return ctx.reply("⚠️ Format မှားနေပါသည်။ <code>/key BT Tearxxxxxx</code>", { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });

      const keyData = await PremiumKey.findOne({ key: keyInput });
      if (!keyData || keyData.isUsed) return ctx.reply("❌ Key မှားနေပါသည် သို့မဟုတ် အသုံးပြုပြီးသား ဖြစ်နေပါသည်။", { reply_markup: getDeleteKeyboard() });

      keyData.isUsed = true;
      keyData.usedBy = userId;
      keyData.usedAt = new Date();
      await keyData.save();

      const profile = await getUserProfile(userId);
      profile.paidQuota += 1;
      await profile.save();

      return ctx.reply("✅ <b>Key အောင်မြင်စွာ အသုံးပြုပြီးပါပြီ!</b>\n/playbot ဟု နှိပ်၍ Bot စတင် ဖန်တီးနိုင်ပါပြီရှင့်🔐", { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });
    }

    if (!userStep) return await next();

    if (userStep.step === 'AWAITING_ID') {
      if (!text.startsWith('/id')) return ctx.reply("⚠️ ကျေးဇူးပြု၍ <code>/id[သင့်အကောင့်id]</code> ဟု ပို့ပေးပါရှင့်💖", { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });

      const extractedId = parseInt(text.replace('/id', '').trim());
      if (isNaN(extractedId)) return ctx.reply("⚠️ ID ဂဏန်း မှားယွင်းနေပါသည်။ ပြန်ပို့ပေးပါရှင့်💖", { reply_markup: getDeleteKeyboard() });

      userSteps.set(userId, { step: 'AWAITING_USERNAME', ownerId: extractedId });
      return ctx.reply("/Bot @uesr  ကိုပို့ပေးပါရှင့်🔐", { reply_markup: getDeleteKeyboard() });
    }

    if (userStep.step === 'AWAITING_USERNAME') {
      if (!text.startsWith('/Bot') || !text.includes('@')) return ctx.reply("⚠️ <code>/Bot @username</code> ပုံစံအတိုင်း ပို့ပေးပါရှင့်🔐", { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });

      const botUsername = text.replace('/Bot', '').trim();
      userSteps.set(userId, { step: 'AWAITING_TOKEN', ownerId: userStep.ownerId, botUsername });
      return ctx.reply("အောင်မြင်ပါသည့်✅✅\n/clone [သင့်botfatherဆီကရတဲtokenကိုထည့်ပေးပါရှင့်]", { reply_markup: getDeleteKeyboard() });
    }

    if (userStep.step === 'AWAITING_TOKEN') {
      if (!text.startsWith('/clone')) return ctx.reply("⚠️ <code>/clone [Token]</code> ဟု ပို့ပေးပါရှင့်🔐", { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });

      const tokenInput = text.replace('/clone', '').trim();

      try {
        const tempBot = new Bot(tokenInput);
        const botInfo = await tempBot.api.getMe();

        if (BotCloneLog) {
          const existing = await BotCloneLog.findOne({ botToken: tokenInput });
          if (existing) return ctx.reply("⚠️ ဤ Bot Token သည် Clone လုပ်ပြီးသား ဖြစ်နေပါသည်။", { reply_markup: getDeleteKeyboard() });

          const cloneDoc = await BotCloneLog.create({
            ownerId: userStep.ownerId,
            ownerUsername: ctx.from.username || 'None',
            ownerFullName: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim(),
            creatorId: userId,
            botToken: tokenInput,
            botUsername: botInfo.username
          });

          const success = await startSubBot(cloneDoc, registerMainBotFunctions);

          if (success) {
            const profile = await getUserProfile(userId);
            if (!profile.freeUsed) profile.freeUsed = true;
            else if (profile.paidQuota > 0) profile.paidQuota -= 1;
            await profile.save();

            userSteps.delete(userId);

            const successMsg = `CloneBotစတင်နေပါပီရှင့်⏳\nဖန်တီးသူ--id=${userStep.ownerId}\nBot @🍃    =@${botInfo.username}\nBot token🎋=${tokenInput}\nBotရဲလုပ်ဆောင်ချက်ဖန်ရှင်များ\nကြည့်ရန်/Helpcbot ဟုပို့ပေးပါရှင့်🔐🔐`;
            return ctx.reply(successMsg, { reply_markup: getDeleteKeyboard() });
          }
        }
      } catch (err) {
        return ctx.reply("❌ Bot Token မှားယွင်းနေပါသည်။ BotFather ထံမှ Token ကို ပြန်လည် စစ်ဆေးပေးပါရှင့်🔐", { reply_markup: getDeleteKeyboard() });
      }
    }

    await next();
  });

  // MAIN OWNER MANAGEMENT
  mainBot.command('botlogs', async (ctx) => {
    if (ctx.from.id !== MAIN_OWNER_ID) return;
    if (!BotCloneLog) return ctx.reply("❌ DB#2 မချိတ်ဆက်ရသေးပါ။");

    const logs = await BotCloneLog.find().sort({ createdAt: -1 }).limit(15);
    if (logs.length === 0) return ctx.reply("📄 Clone Bot မှတ်တမ်းများ မရှိသေးပါ။", { reply_markup: getDeleteKeyboard() });

    let msg = `📜 <b>[DB#2] Clone Bot ထုတ်ယူထားမှု မှတ်တမ်းများ</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
    logs.forEach((log, index) => {
      const dateStr = new Date(log.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Yangon' });
      const status = log.isActive ? '🟢 Active' : '🔴 Off';
      msg += `<b>${index + 1}. Bot:</b> @${log.botUsername}\n👤 <b>Owner ID:</b> <code>${log.ownerId}</code>\n⏰ <b>Date/Time:</b> <code>${dateStr}</code>\n⚡ <b>Status:</b> ${status}\n────────────────────\n`;
    });

    ctx.reply(msg, { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });
  });

  mainBot.command('offclone', async (ctx) => {
    if (ctx.from.id !== MAIN_OWNER_ID) return;
    const args = ctx.message.text.trim().split(' ').slice(1).join(' ').replace('@', '');

    if (!args) return ctx.reply("⚠️ Format: <code>/offclone bot_username</code>", { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });

    if (BotCloneLog) {
      const cloneDoc = await BotCloneLog.findOne({ botUsername: args });
      if (!cloneDoc) return ctx.reply("❌ ထို Clone Bot ကို ရှာမတွေ့ပါ။", { reply_markup: getDeleteKeyboard() });

      cloneDoc.isActive = false;
      await cloneDoc.save();

      if (activeSubBots.has(cloneDoc.botToken)) {
        const subBot = activeSubBots.get(cloneDoc.botToken);
        await subBot.stop();
        activeSubBots.delete(cloneDoc.botToken);
      }

      ctx.reply(`⛔ <b>@${args} ကို အောင်မြင်စွာ ရပ်ဆိုင်း/ပိတ်လိုက်ပါပြီ။</b>`, { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });
    }
  });

  mainBot.command('onclone', async (ctx) => {
    if (ctx.from.id !== MAIN_OWNER_ID) return;
    const args = ctx.message.text.trim().split(' ').slice(1).join(' ').replace('@', '');

    if (!args) return ctx.reply("⚠️ Format: <code>/onclone bot_username</code>", { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });

    if (BotCloneLog) {
      const cloneDoc = await BotCloneLog.findOne({ botUsername: args });
      if (!cloneDoc) return ctx.reply("❌ ထို Clone Bot ကို ရှာမတွေ့ပါ။", { reply_markup: getDeleteKeyboard() });

      cloneDoc.isActive = true;
      await cloneDoc.save();

      await startSubBot(cloneDoc, registerMainBotFunctions);

      ctx.reply(`🟢 <b>@${args} ကို ပြန်လည် စတင်ပေးလိုက်ပါပြီ။</b>`, { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });
    }
  });

  mainBot.command('broadcast', async (ctx) => {
    if (ctx.from.id !== MAIN_OWNER_ID) return;
    const msgToBroadcast = ctx.message.text.trim().split(' ').slice(1).join(' ');

    if (!msgToBroadcast && !ctx.message.reply_to_message) {
      return ctx.reply("⚠️ Broadcast ပေးပို့လိုသော စာသား ရိုက်ပါ သို့မဟုတ် Reply ထောက်၍ <code>/broadcast</code> ရိုက်ပါ။", { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });
    }

    if (!BotCloneLog) return;
    const owners = await BotCloneLog.distinct('ownerId');
    let successCount = 0;

    for (const ownerId of owners) {
      try {
        if (ctx.message.reply_to_message) {
          await ctx.api.copyMessage(ownerId, ctx.chat.id, ctx.message.reply_to_message.message_id);
        } else {
          await mainBot.api.sendMessage(ownerId, `📢 <b>Main Owner ထံမှ အသိပေးချက်:</b>\n\n${msgToBroadcast}`, { parse_mode: 'HTML' });
        }
        successCount++;
      } catch (e) {}
    }

    ctx.reply(`✅ <b>Bot Owner (${successCount}) ဦးထံသို့ ကြော်ငြာ ပေးပို့ပြီးပါပြီ။</b>`, { reply_markup: getDeleteKeyboard() });
  });

  // HELPCBOT SYSTEM (DB#2 STATUS)
  mainBot.hears('/Helpcbot', async (ctx, next) => {
    if (ctx.message.reply_to_message && ctx.from.id === MAIN_OWNER_ID) {
      const replyMsg = ctx.message.reply_to_message;
      let contentType = 'text';
      let fileId = null;
      let textContent = replyMsg.text || replyMsg.caption || '';

      if (replyMsg.photo) {
        contentType = 'photo';
        fileId = replyMsg.photo[replyMsg.photo.length - 1].file_id;
      } else if (replyMsg.video) {
        contentType = 'video';
        fileId = replyMsg.video.file_id;
      }

      if (HelpContent) {
        await HelpContent.updateOne(
          { key: 'helpcbot_content' },
          { type: contentType, fileId, text: textContent },
          { upsert: true }
        );
      }

      return ctx.reply("✅ <b>[DB#2] /Helpcbot အချက်အလက်များ သိမ်းဆည်းပြီးပါပြီ။</b>", { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });
    }

    const savedHelp = HelpContent ? await HelpContent.findOne({ key: 'helpcbot_content' }) : null;

    if (!savedHelp) {
      return ctx.reply("⚠️ /Helpcbot အတွက် အချက်အလက် သိမ်းဆည်းထားခြင်း မရှိသေးပါရှင့်။", { reply_markup: getDeleteKeyboard() });
    }

    if (savedHelp.type === 'photo') {
      return ctx.replyWithPhoto(savedHelp.fileId, { caption: savedHelp.text, reply_markup: getDeleteKeyboard() });
    } else if (savedHelp.type === 'video') {
      return ctx.replyWithVideo(savedHelp.fileId, { caption: savedHelp.text, reply_markup: getDeleteKeyboard() });
    } else {
      return ctx.reply(savedHelp.text, { reply_markup: getDeleteKeyboard() });
    }
  });

  mainBot.command('genkey', async (ctx) => {
    if (ctx.from.id !== MAIN_OWNER_ID) return;

    const keyString = generateRandomKey();
    await PremiumKey.create({ key: keyString, createdBy: ctx.from.id });

    const msg = `🔑 <b>VIP Clone Key ထုတ်ပြီးပါပြီ</b>\n<code>${keyString}</code>\n\nအသုံးပြုရန်: <code>/key ${keyString}</code>`;
    ctx.reply(msg, { parse_mode: 'HTML', reply_markup: getDeleteKeyboard() });
  });

  mainBot.on('callback_query:data', async (ctx) => {
    if (ctx.callbackQuery.data === 'delete_msg') {
      try { await ctx.deleteMessage(); } catch (err) {}
    }
  });
}

module.exports = setupCloneModule;
