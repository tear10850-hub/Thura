const { Bot, InlineKeyboard } = require('grammy');
const mongoose = require('mongoose');

// ==========================================
// 1. DATABASE MODELS
// ==========================================
const keySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  type: { type: String, enum: ['TEAR', 'BEAR'], default: 'TEAR' },
  durationDays: { type: Number, default: 0 },
  createdBy: { type: Number, required: true },
  isUsed: { type: Boolean, default: false },
  usedBy: { type: Number, default: null },
  usedAt: { type: Date, default: null }
});

const userSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true },
  freeUsed: { type: Boolean, default: false },
  paidQuota: { type: Number, default: 0 },
  bcastExpiresAt: { type: Date, default: null }
});

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
  startText: { type: String, default: "👋 <b>မင်္ဂလာပါ!</b>\n\nဤ Bot မှ ကြိုဆိုပါသည်... ✨" },
  startButtons: [{
    label: { type: String, required: true },
    url: { type: String, required: true }
  }],
  autoForward: { type: Boolean, default: false },
  subscribers: [{ type: Number }],
  updatedAt: { type: Date, default: Date.now }
});

const PremiumKey = mongoose.models.PremiumKey_Clone || mongoose.model('PremiumKey_Clone', keySchema);
const UserProfile = mongoose.models.UserProfile_Clone || mongoose.model('UserProfile_Clone', userSchema);
const BotCloneLog = mongoose.models.BotCloneLog || mongoose.model('BotCloneLog', cloneLogSchema);
const SubBotSetting = mongoose.models.SubBotSetting || mongoose.model('SubBotSetting', subBotSettingSchema);

const userSteps = new Map();
const activeSubBots = new Map();

async function getUserProfile(userId) {
  let profile = await UserProfile.findOne({ userId });
  if (!profile) profile = await UserProfile.create({ userId });
  return profile;
}

function generateRandomKey(prefix = 'BT Tear') {
  let digits = '';
  for (let i = 0; i < 12; i++) digits += Math.floor(Math.random() * 10);
  return `${prefix}${digits}`;
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
      setting = await SubBotSetting.create({ botUsername: cloneDoc.botUsername, ownerId: cloneDoc.ownerId });
    }

    // 📢 Sub-Owner Broadcast (/cbcast) - ၅ နာရီပြည့်မှ ဖျက်နိုင်သော Button ပါဝင်သည်
    subBot.command('cbcast', async (ctx) => {
      const userId = ctx.from.id;
      if (userId !== cloneDoc.ownerId) return;

      const profile = await getUserProfile(userId);
      const now = new Date();

      if (!profile.bcastExpiresAt || profile.bcastExpiresAt < now) {
        return ctx.reply("❌ သင်၏ Broadcast (ကြော်ငြာ) သက်တမ်း ကုန်ဆုံးသွားပါပြီ။ Main Owner ဆီမှ Bear Key ဝယ်ယူ၍ /key ဖြင့် သက်တမ်းတိုးပါ။");
      }

      const replyMsg = ctx.message.reply_to_message;
      const textMessage = ctx.message.text.trim().split(' ').slice(1).join(' ');

      if (!replyMsg && !textMessage) {
        return ctx.reply("⚠️ ကြော်ငြာစာသားအား `/cbcast စာသား` ဟုဖြစ်စေ သို့မဟုတ် Message/Media ကို Reply ထောက်၍ `/cbcast` ဟု ပို့ပေးပါ။", { parse_mode: 'Markdown' });
      }

      const currentSetting = await SubBotSetting.findOne({ botUsername: cloneDoc.botUsername });
      const users = currentSetting.subscribers || [];
      if (users.length === 0) return ctx.reply("⚠️ Bot တွင် User မရှိသေးပါ။");

      // ⏳ ပို့လိုက်သည့်အချိန် (Timestamp) ကို Button Data ထဲတွင် သိမ်းဆည်းခြင်း
      const sentTime = Date.now();
      const deleteKeyboard = new InlineKeyboard().text("❌ ကြော်ငြာဖျက်မည် ❌", `del_ad_${sentTime}`);

      let success = 0, failed = 0;
      await ctx.reply(`🚀 User (${users.length}) ယောက်ထံ ကြော်ငြာ စတင်ပို့နေပါသည်...`);

      for (const uId of users) {
        try {
          if (replyMsg) {
            await ctx.api.copyMessage(uId, ctx.chat.id, replyMsg.message_id, {
              reply_markup: deleteKeyboard
            });
          } else {
            await ctx.api.sendMessage(uId, textMessage, {
              parse_mode: 'HTML',
              reply_markup: deleteKeyboard
            });
          }
          success++;
        } catch (e) {
          failed++;
        }
      }

      const remainingHours = Math.ceil((profile.bcastExpiresAt - now) / (1000 * 60 * 60));
      ctx.reply(`✅ <b>Broadcast ပို့ပြီးပါပြီ!</b>\n\nအောင်မြင်: ${success}\nမအောင်မြင်: ${failed}\nသက်တမ်းကျန်ချိန်: ခန့်မှန်း ${remainingHours} နာရီ\n\n💡 <i>ကြော်ငြာအား ၅ နာရီပြည့်မှသာ User များ ဖျက်ခွင့်ရရှိပါမည်။</i>`, { parse_mode: 'HTML' });
    });

    // ❌ ကြော်ငြာ ဖျက်သည့် Inline Button Handler
    subBot.on('callback_query:data', async (ctx, next) => {
      const data = ctx.callback_query.data;

      if (data.startsWith('del_ad_')) {
        const sentTime = parseInt(data.replace('del_ad_', ''));
        const currentTime = Date.now();
        const fiveHoursMs = 5 * 60 * 60 * 1000; // ၅ နာရီ (Miliseconds)

        if (currentTime - sentTime < fiveHoursMs) {
          const remainingMinutes = Math.ceil((fiveHoursMs - (currentTime - sentTime)) / (1000 * 60));
          const hours = Math.floor(remainingMinutes / 60);
          const mins = remainingMinutes % 60;
          
          let timeString = hours > 0 ? `${hours} နာရီ ${mins} မိနစ်` : `${mins} မိနစ်`;
          
          return ctx.answerCallbackQuery({
            text: `⚠️ ကြော်ငြာ ဖျက်ရန် ${timeString} လိုပါသေးသည်။ (၅ နာရီပြည့်မှ ဖျက်နိုင်ပါမည်)`,
            show_alert: true
          });
        }

        // ၅ နာရီပြည့်သွားပါက ကြော်ငြာ Message ဖျက်ပေးခြင်း
        try {
          await ctx.deleteMessage();
          return ctx.answerCallbackQuery({ text: "✅ ကြော်ငြာ ဖျက်ပြီးပါပြီ။" });
        } catch (e) {
          return ctx.answerCallbackQuery({ text: "❌ စာသားမှာ ဟောင်းနွမ်နေသောကြောင့် မဖျက်နိုင်တော့ပါ။", show_alert: true });
        }
      }

      await next();
    });

    // Sub-Bot Settings Commands
    subBot.command('startcvideo', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      const replyMsg = ctx.message.reply_to_message;
      if (!replyMsg || !replyMsg.video) return ctx.reply("⚠️ Video တစ်ခုကို Reply ထောက်ပြီး /startcvideo ဟု ရိုက်ပေးပါ။");

      await SubBotSetting.updateOne({ botUsername: cloneDoc.botUsername }, { startVideoId: replyMsg.video.file_id });
      ctx.reply("✅ /start Video ကို သတ်မှတ်လိုက်ပါပြီ။");
    });

    subBot.command('cvideo', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      await SubBotSetting.updateOne({ botUsername: cloneDoc.botUsername }, { startVideoId: null });
      ctx.reply("🗑️ /start Video ကို ဖျက်လိုက်ပါပြီ။");
    });

    subBot.command('cvideosee', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      const current = await SubBotSetting.findOne({ botUsername: cloneDoc.botUsername });
      if (!current || !current.startVideoId) return ctx.reply("⚠️ Video သတ်မှတ်ထားခြင်း မရှိသေးပါ။");
      await ctx.replyWithVideo(current.startVideoId, { caption: "📹 လက်ရှိ သတ်မှတ်ထားသော /start Video" });
    });

    subBot.command('foward', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      await SubBotSetting.updateOne({ botUsername: cloneDoc.botUsername }, { autoForward: true });
      ctx.reply("✅ Auto Forward စနစ် ပွင့်သွားပါပြီ။");
    });

    subBot.command('nfoward', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      await SubBotSetting.updateOne({ botUsername: cloneDoc.botUsername }, { autoForward: false });
      ctx.reply("⛔ Auto Forward စနစ် ပိတ်လိုက်ပါပြီ။");
    });

    subBot.command('setstarttext', async (ctx) => {
      if (ctx.from.id !== cloneDoc.ownerId) return;
      const args = ctx.message.text.trim().split(' ').slice(1).join(' ');
      if (!args) return ctx.reply("⚠️ စာသား ရိုက်ပေးပါ။");
      await SubBotSetting.updateOne({ botUsername: cloneDoc.botUsername }, { startText: args });
      ctx.reply("✅ Start စာသား ပြောင်းလဲပြီးပါပြီ။");
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
      const user = ctx.from;
      
      await SubBotSetting.updateOne(
        { botUsername: cloneDoc.botUsername },
        { $addToSet: { subscribers: user.id } }
      );

      let bioText = "မရှိပါ";
      try {
        const fullUser = await ctx.api.getChat(user.id);
        if (fullUser.bio) bioText = fullUser.bio;
      } catch (e) {}

      const infoText = `Name🎋- ${user.first_name || ''} ${user.last_name || ''}\n` +
                       `Id🌾     - <code>${user.id}</code>\n` +
                       `@user🍃- ${user.username ? '@' + user.username : 'မရှိပါ'}\n` +
                       `Bio🌷 - ${bioText}`;

      await ctx.reply(infoText, { parse_mode: 'HTML' });

      try {
        await ctx.api.sendMessage(cloneDoc.ownerId, `🔔 <b>/start နှိပ်လိုက်သော User အချက်အလက်:</b>\n\n${infoText}`, { parse_mode: 'HTML' });
      } catch (e) {}

      const currentSetting = await SubBotSetting.findOne({ botUsername: cloneDoc.botUsername });
      const keyboard = new InlineKeyboard();

      if (currentSetting && currentSetting.startButtons) {
        currentSetting.startButtons.forEach(btn => keyboard.url(btn.label, btn.url).row());
      }

      const txt = currentSetting ? currentSetting.startText : "👋 မင်္ဂလာပါ!";

      if (currentSetting && currentSetting.startVideoId) {
        await ctx.replyWithVideo(currentSetting.startVideoId, { caption: txt, parse_mode: 'HTML', reply_markup: keyboard });
      } else {
        await ctx.reply(txt, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    });

    if (typeof registerMainBotFunctions === 'function') {
      registerMainBotFunctions(subBot);
    }

    subBot.on('message', async (ctx, next) => {
      if (ctx.message.text && ctx.message.text.startsWith('/')) return await next();

      const currentSetting = await SubBotSetting.findOne({ botUsername: cloneDoc.botUsername });

      if (currentSetting && currentSetting.autoForward && ctx.from.id !== cloneDoc.ownerId) {
        try {
          await ctx.forwardMessage(cloneDoc.ownerId);
        } catch (err) {}
      }

      try { await ctx.react("👍"); } catch (err) {}
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

// ==========================================
// 3. MAIN BOT CONTROLLER & ADMIN SECURITY
// ==========================================
function setupCloneModule(mainBot, MAIN_OWNER_ID, registerMainBotFunctions) {

  BotCloneLog.find({ isActive: true }).then(async (clones) => {
    for (const cloneDoc of clones) {
      await startSubBot(cloneDoc, registerMainBotFunctions);
    }
  });

  mainBot.use(async (ctx, next) => {
    if (!ctx.message || !ctx.message.text) return await next();

    const text = ctx.message.text.trim();
    const userId = ctx.from.id;

    // 🔒 Security Guard: Main Owner မဟုတ်ပါက Admin Commands များ လုံးဝ အလုပ်မလုပ်စေရန် ပိတ်ထားခြင်း
    const adminCmds = ['/genkey', '/genbearkey', '/globalbcast', '/botlogs'];
    if (adminCmds.some(cmd => text.startsWith(cmd)) && userId !== MAIN_OWNER_ID) {
      return; // Silent Ignore (ဘာမှ စာပြန်မပြပါ)
    }

    if (text === '/clonebot') {
      const profile = await getUserProfile(userId);
      if (!profile.freeUsed || profile.paidQuota > 0 || userId === MAIN_OWNER_ID) {
        return ctx.reply("Goodlucky✅✅\nပထမဆုံးBotဖန်တီခွင့်🎁(1)ကြိမ်ရရှိပါသည့်ရှင့်🥰\nဖန်တီးလို့ပါက /playbot ဟုရေးပေးပါရှင့်🔐");
      } else {
        return ctx.reply("⚠️ သင်၏ Free Bot ဖန်တီးခွင့် ကုန်ဆုံးသွားပါပြီ။\nKey ဝယ်ယူပြီး /key <Key_Code> ဟု ပို့ပေးပါ။");
      }
    }

    if (text === '/playbot') {
      userSteps.set(userId, { step: 'AWAITING_ID' });
      return ctx.reply("💬\nBotဖန်တီးရန်👉 /id[သင့်အကောင့်id] ဟုပို့ပေးပါရှင့်💖");
    }

    if (text.startsWith('/key')) {
      const keyInput = text.split(' ')[1];
      if (!keyInput) return ctx.reply("⚠️ Format: /key BT Tearxxxxxx သို့မဟုတ် /key BT Bearxxxxxx");

      const keyData = await PremiumKey.findOne({ key: keyInput });
      if (!keyData || keyData.isUsed) return ctx.reply("❌ Key မှားယွင်းနေပါသည် သို့မဟုတ် အသုံးပြုပြီးသားပါ။");

      keyData.isUsed = true;
      keyData.usedBy = userId;
      keyData.usedAt = new Date();
      await keyData.save();

      const profile = await getUserProfile(userId);

      if (keyData.type === 'BEAR') {
        const now = new Date();
        const currentExp = (profile.bcastExpiresAt && profile.bcastExpiresAt > now) ? profile.bcastExpiresAt : now;
        
        const addedMs = keyData.durationDays * 24 * 60 * 60 * 1000;
        profile.bcastExpiresAt = new Date(currentExp.getTime() + addedMs);
        await profile.save();

        const expFormatted = profile.bcastExpiresAt.toLocaleString('my-MM', { timeZone: 'Asia/Yangon' });
        return ctx.reply(`🎉 <b>Broadcast Key အောင်မြင်စွာ ဖြည့်ဆည်းပြီးပါပြီ!</b>\n\n📅 သက်တမ်းကုန်ဆုံးမည့်ရက်: <b>${expFormatted}</b>`, { parse_mode: 'HTML' });
      } else {
        profile.paidQuota += 1;
        await profile.save();
        return ctx.reply("✅ Bot Clone Key အသုံးပြုပြီးပါပြီ! /playbot ဟု နှိပ်၍ စတင်ပါ။");
      }
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
          
          return ctx.reply(`🎉 <b>Clone Bot စတင်မောင်းနှင်ပါပြီ!</b>\n\n👤 <b>ဖန်တီးသူ ID:</b> <code>${stepData.ownerId}</code>\n🤖 <b>Bot:</b> @${botInfo.username}\n\nကြည့်ရှုရန် /Helpcbot ဟု ပို့ပေးပါရှင့်🔐🔐`, { parse_mode: 'HTML' });

        } catch (e) {
          return ctx.reply("❌ Bot Token မှားယွင်းနေပါသည်။ ပြန်လည်စစ်ဆေးပါ။");
        }
      }
    }

    await next();
  });

  // 👑 Main Owner Secret Admin Commands
  mainBot.command('genbearkey', async (ctx) => {
    if (ctx.from.id !== MAIN_OWNER_ID) return;

    const keyboard = new InlineKeyboard()
      .text("⏱️ 24 နာရီ (1 ရက်)", "gen_bear_0.0416").row()
      .text("📅 7 ရက်", "gen_bear_7").row()
      .text("📅 15 ရက်", "gen_bear_15").row()
      .text("📅 30 ရက် (1 လ)", "gen_bear_30");

    ctx.reply("📢 <b>Broadcast Key ထုတ်ရန် သက်တမ်းရွေးချယ်ပါ-</b>", {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  });

  mainBot.on('callback_query:data', async (ctx, next) => {
    if (ctx.from.id !== MAIN_OWNER_ID) return await next();

    const data = ctx.callback_query.data;

    if (data.startsWith('gen_bear_')) {
      const days = parseFloat(data.replace('gen_bear_', ''));
      const k = generateRandomKey('BT Bear');

      await PremiumKey.create({
        key: k,
        type: 'BEAR',
        durationDays: days,
        createdBy: ctx.from.id
      });

      const label = days < 1 ? '24 နာရီ' : `${days} ရက်`;
      await ctx.editMessageText(`📢 <b>Broadcast Key (${label}):</b>\n<code>${k}</code>`, { parse_mode: 'HTML' });
      return;
    }

    await next();
  });

  mainBot.command('genkey', async (ctx) => {
    if (ctx.from.id !== MAIN_OWNER_ID) return;
    const k = generateRandomKey('BT Tear');
    await PremiumKey.create({ key: k, type: 'TEAR', createdBy: ctx.from.id });
    ctx.reply(`🔑 <b>Bot Clone Key:</b> <code>${k}</code>`, { parse_mode: 'HTML' });
  });

  mainBot.command('globalbcast', async (ctx) => {
    if (ctx.from.id !== MAIN_OWNER_ID) return;

    const replyMsg = ctx.message.reply_to_message;
    const textMessage = ctx.message.text.trim().split(' ').slice(1).join(' ');

    if (!replyMsg && !textMessage) {
      return ctx.reply("⚠️ `/globalbcast စာသား` သို့မဟုတ် Message ကို Reply ထောက်၍ ပို့ပေးပါ။", { parse_mode: 'Markdown' });
    }

    const allSubBots = await SubBotSetting.find();
    let totalBots = 0, totalUsers = 0;

    await ctx.reply("📡 Clone Bot များအားလုံးထံမှတစ်ဆင့် ကြော်ငြာများ စတင်ဖြန့်ဝေနေပါသည်...");

    for (const subSetting of allSubBots) {
      const token = (await BotCloneLog.findOne({ botUsername: subSetting.botUsername, isActive: true }))?.botToken;
      if (!token) continue;

      const botInstance = activeSubBots.get(token);
      if (!botInstance) continue;

      totalBots++;
      for (const uId of (subSetting.subscribers || [])) {
        try {
          if (replyMsg) {
            await botInstance.api.copyMessage(uId, ctx.chat.id, replyMsg.message_id);
          } else {
            await botInstance.api.sendMessage(uId, textMessage, { parse_mode: 'HTML' });
          }
          totalUsers++;
        } catch (e) {}
      }
    }

    ctx.reply(`✅ <b>Global Broadcast ဖြန့်ဝေပြီးပါပြီ!</b>\n\n🤖 အသုံးပြုခဲ့သော Clone Bots: ${totalBots} ခု\n👤 ကြော်ငြာရောက်ရှိသွားသော Users: ${totalUsers} ယောက်`, { parse_mode: 'HTML' });
  });

  mainBot.command('botlogs', async (ctx) => {
    if (ctx.from.id !== MAIN_OWNER_ID) return;
    const logs = await BotCloneLog.find().sort({ createdAt: -1 });
    if (logs.length === 0) return ctx.reply("📜 ဖန်တီးထားသော Clone Bot မရှိသေးပါ။");

    const keyboard = new InlineKeyboard();
    logs.forEach((l) => {
      keyboard.text(`@${l.botUsername} (${l.isActive ? '🟢' : '🔴'})`, `manage_bot_${l.botUsername}`).row();
    });

    ctx.reply("📜 <b>Clone Bots ထိန်းချုပ်ရေးစခန်း (Main Owner)</b>", { parse_mode: 'HTML', reply_markup: keyboard });
  });
}

module.exports = setupCloneModule;
