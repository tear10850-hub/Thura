const express = require('express');
const { Bot, InlineKeyboard } = require('grammy');
const mongoose = require('mongoose');
const { Media, TextReply, User } = require('./models');
const HelpPage = require('./helpSchema');

// AI Module ချိတ်ဆက်ခြင်း
const { getAISettings, handleAIResponse } = require('./ai');

// Sub-Modules များ ချိတ်ဆက်ခြင်း
const setupWelcomeModule = require('./welcomeModule');
const setupLeaveModule = require('./leaveModule');
const setupAdminToolsModule = require('./adminToolsModule');
const setupAutoMuteModule = require('./autoMuteModule');
const setupCallModule = require('./setupCallModule');
const setupStartModule = require('./startModule');
const setupHelpModule = require('./helpModule');
const setupPremiumKeyModule = require('./premiumKeyModule');
const setupMediaManagerModule = require('./mediaManagerModule');
const setupChannelGroupModule = require('./channelGroupManager');
const setupBotLeaveModule = require('./botLeaveModule');
const { setupScriptModule } = require('./scriptModule');
const { setupCardGameModule } = require('./cardGameModule');

// Environment Variables စစ်ဆေးခြင်း
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const OWNER_ID = Number(process.env.OWNER_ID);
const PORT = process.env.PORT || 3000;
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;

if (!BOT_TOKEN || !MONGO_URI || !OWNER_ID || isNaN(OWNER_ID)) {
  console.error("FATAL ERROR: BOT_TOKEN, MONGO_URI, or OWNER_ID is missing/invalid in Environment Variables!");
  process.exit(1);
}

// Global Variables & State Variables
let replyCounter = 0;
let isOwnerMediaMode = false;
let isTearOpen = true; 
let uniqueUsersCount = new Set();
const groupSettings = new Map(); 

global.isBcastAutoDelete = true;

// ============================================================
// 🌐 Web Server & Server Uptime Ping
// ============================================================
const app = express();
app.get('/', (req, res) => {
  res.status(200).send('Telegram Bot is alive and running smoothly!');
});
app.listen(PORT, () => {
  console.log(`Web Server is running on port ${PORT}`);
});

if (RENDER_EXTERNAL_URL) {
  setInterval(async () => {
    try {
      if (typeof fetch !== 'undefined') {
        await fetch(RENDER_EXTERNAL_URL);
        console.log('[Uptime Keep-Alive]: Server self-pinged successfully!');
      }
    } catch (err) {
      console.error('[Uptime Keep-Alive Error]:', err.message);
    }
  }, 5 * 60 * 1000);
}

// ============================================================
// 💾 Database Connection
// ============================================================
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB Connected Successfully!');
  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    setTimeout(connectDB, 5000);
  }
};
connectDB();

const bot = new Bot(BOT_TOKEN);

// ============================================================
// ⏰ Helper Functions & Global Auto Delete
// ============================================================
global.autoDeleteMessage = function(ctx, messageId, customDelay = null) {
  if (!ctx || !ctx.chat || !messageId) return;

  let delayTime = customDelay;
  
  if (delayTime === null) {
    const config = getGroupConfig(ctx.chat.id);
    delayTime = config ? config.autoDelTime : (3 * 60 * 1000);
  }

  if (!delayTime || delayTime <= 0) return;

  setTimeout(async () => {
    try {
      await ctx.api.deleteMessage(ctx.chat.id, messageId);
    } catch (err) {}
  }, delayTime);
};

function getGroupConfig(chatId) {
  if (!groupSettings.has(chatId)) {
    groupSettings.set(chatId, { count: 3, replyMode: true, toggleOpen: true, autoDelTime: 3 * 60 * 1000 });
  }
  return groupSettings.get(chatId);
}

function isOwner(ctx, ownerId) {
  return ctx.from && Number(ctx.from.id) === Number(ownerId);
}

async function isAdmin(ctx) {
  if (!ctx || !ctx.chat) return false;
  if (ctx.chat.type === 'private') return true;
  try {
    const member = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
    return ['administrator', 'creator'].includes(member.status);
  } catch (err) {
    return false;
  }
}

const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
const BAD_WORDS = ["စပ့", "စပ", "လီး", "ယီး", "ဖေလို", "ဖေလိုမ", "မသာ", "ထန်မယ်", "လိုးမယ်"];

function containsBadWord(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return BAD_WORDS.some(word => lowerText.includes(word));
}

function containsForbiddenText(text) {
  if (!text) return false;
  const chineseRegex = /[\u4e00-\u9fa5]/;
  if (chineseRegex.test(text)) return true;
  return false;
}

// ============================================================
// 🟢 MODULES များကို ချိတ်ဆက်ခြင်း
// ============================================================
try {
  setupAutoMuteModule(bot);
  setupAdminToolsModule(bot);
  setupWelcomeModule(bot);
  setupLeaveModule(bot);
  setupCallModule(bot, OWNER_ID);
  setupStartModule(bot, OWNER_ID);
  setupHelpModule(bot, OWNER_ID);
  setupPremiumKeyModule(bot);
  setupMediaManagerModule(bot, OWNER_ID);
  setupChannelGroupModule(bot, OWNER_ID);
  setupBotLeaveModule(bot, OWNER_ID);
  setupScriptModule(bot, OWNER_ID);
  setupCardGameModule(bot, OWNER_ID);
} catch (modErr) {
  console.error("Module Initialization Error:", modErr.message);
}

bot.catch((err) => {
  console.error(`Error handling update ${err.ctx?.update?.update_id}:`, err.error);
});

// ============================================================
// 🔘 Help Buttons Callback Handlers (ခလုတ်များ အလုပ်လုပ်စေရန် သေချာချိတ်ဆက်ခြင်း)
// ============================================================
const memberHelpContentText = `👥 <b>MEMBER HELP COMMANDS</b>

/id - Chat အချက်အလက်များနှင့် ID ကြည့်ရန်
/aiopen - AI စနစ် ဖွင့်ရန်
/aioff - AI စနစ် ပိတ်ရန်
/ai - AI နှင့် စတင်စကားပြောရန်
/cpost - Channel သို့ တိုက်ရိုက်ပို့ရန်
/cschedule - Channel သို့ အချိန်ဆိုင်း၍ ပို့ရန်
/keyvideo - Premium Key စစ်ဆေးရန်
/catch - Gacha ကတ် လုယူရန်
/checkkey - Secret Key စစ်ဆေးရန်
/gift - ကတ် လက်ဆောင်ပေးရန်
/mycards - ကတ်အိတ်နှင့် Coins ကြည့်ရန်
/admin - Admin များကို Mentions ခေါ်ရန်
/adminpf - Admin နှင့် Bot Profile ကြည့်ရန်
/adminprofile - Admin Profile ကြည့်ရန်
/1mv, /2mv, /3mv - သတိပေး Video များ ကြည့်ရန်
/help - အကူအညီကြည့်ရန်
/viewhelp - Help စာမျက်နှာကြည့်ရန်
/wevideo / Dwevideo / wephoto / Dwephoto - Welcome ဆက်တင်များ
/settouch / deltouch / addbutton / delbuttons - Welcome စာသားနှင့်ခလုတ်များ
/Levideo / DLevideo / Levideogp / setltouch / addlbutton / dellbuttons - Leave ဆက်တင်များ`;

const gpChHelpContentText = `🛡 <b>GP & CH HELP COMMANDS</b>

/gpopen / /gpclose - Bot စနစ် ဖွင့်/ပိတ်
/people - လူဦးရေ သတ်မှတ်ရန်
/replymode - Reply စနစ် ဖွင့်/ပိတ်
/botchat - Bot စကားပြောစနစ် ဖွင့်/ပိတ်
/autodel - အလိုအလျောက် စာဖျက်ချိန် သတ်မှတ်ရန်
/1mutevideo / D1mutevideo - ပထမအကြိမ် သတိပေး Video
/2mutevideo / D2mutevideo - ဒုတိယအကြိမ် သတိပေး Video
/3mutevideo / D3mutevideo - တတိယအကြိမ် Mute Video
/activatevideo - Group တွင် Video စနစ် အသက်သွင်းရန်
/promote / /demote - Admin ခန့်/ဖြုတ်
/ban / /mute / /umute / /tbot - Member စီမံခန့်ခွဲမှုများ
/bvideo / /mvideo / /uvideo / /pvideo / /dvideo - Video များသတ်မှတ်ရန်
/showbvideo / /showmvideo / /showuvideo / /showpvideo / /showdvideo - ဗီဒီယိုများကြည့်ရန်
/delbvideo / /delmvideo / /deluvideo / /delpvideo / /deldvideo - ဗီဒီယိုများဖျက်ရန်`;

const ownerHelpContentText = `👑 <b>OWNER HELP COMMANDS</b>

/Teach - Premium Key အသစ် ထုတ်ယူရန်
/setbotname / /setbotid / /setbotusername / /setbotbio - Bot ပရိုဖိုင်ပြင်ရန်
/setbotpfvideo / /setbotpfphoto / /delbotpfmedia / /delallbotinfo - Profile မီဒီယာများ
/treply - ကြော်ငြာစာ ပို့ရန်
/sendlink - Group လင့်ခ်ပို့ရန်
/open / /close - Owner Media Mode ဖွင့်/ပိတ်
/Tearopen / /Tear - Tear Mode ဖွင့်/ပိတ်
/clearbrain / /cleansymbols / /cleanlong / /clearstickers / /clearmedia - ရှင်းလင်းရေးစနစ်များ
/sendchannel - Channel ထဲ တိုက်ရိုက်ပို့ရန်
/setstvideo / /settoptext / /setbottomtext / /addstbutton - Start စနစ်များ
/bcast / /bcastopen / /bcasttear - Broadcast စနစ်များ
/addcard / /addprize / /chk / /usercards - Gacha Card စနစ်များ
/gplist / /leave - Group စာရင်းနှင့် ထွက်ခွာခြင်း
/sethelptext / /sethelpmedia / /delhelptext / /delhelpmedia - Help စာမျက်နှာများ`;

bot.callbackQuery('cmd_mamberhelp', async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    const page = await HelpPage.findOne({ pageNumber: 999 });
    const keyboard = new InlineKeyboard().text("❌ ပိတ်မည် ❌", "delete_this_msg");

    if (page && page.mediaId) {
      if (page.mediaType === 'photo') {
        return await ctx.replyWithPhoto(page.mediaId, { caption: memberHelpContentText, parse_mode: 'HTML', reply_markup: keyboard });
      } else if (page.mediaType === 'video') {
        return await ctx.replyWithVideo(page.mediaId, { caption: memberHelpContentText, parse_mode: 'HTML', reply_markup: keyboard });
      }
    }
    await ctx.reply(memberHelpContentText, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (err) {
    console.error("cmd_mamberhelp error:", err);
  }
});

bot.callbackQuery('cmd_gpchhelp', async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    const keyboard = new InlineKeyboard().text("❌ ပိတ်မည် ❌", "delete_this_msg");
    await ctx.reply(gpChHelpContentText, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (err) {
    console.error("cmd_gpchhelp error:", err);
  }
});

bot.callbackQuery('cmd_ownerhelp', async (ctx) => {
  if (!isOwner(ctx, OWNER_ID)) {
    return await ctx.answerCallbackQuery({ text: "ownerမဟုပါသဖြင့်ကြည့်မရပါဘူးနော်🤭🤪", show_alert: true });
  }
  try {
    await ctx.answerCallbackQuery();
    const keyboard = new InlineKeyboard().text("❌ ပိတ်မည် ❌", "delete_this_msg");
    await ctx.reply(ownerHelpContentText, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (err) {
    console.error("cmd_ownerhelp error:", err);
  }
});

bot.callbackQuery('delete_this_msg', async (ctx) => {
  try {
    await ctx.deleteMessage();
    await ctx.answerCallbackQuery({ text: "ဖျက်လိုက်ပါပြီ။" });
  } catch (e) {
    await ctx.answerCallbackQuery();
  }
});

// ============================================================
// ⚙ Group Configuration & Utility Commands
// ============================================================

bot.command('id', async (ctx) => {
  const chatId = ctx.chat.id;
  const chatType = ctx.chat.type; 
  const chatTitle = ctx.chat.title || ctx.chat.first_name || 'Private Chat';

  let responseText = `🪧 **Chat Information:**\n`;
  responseText += `- Name: ${chatTitle}\n`;
  responseText += `- Chat Type: \`${chatType}\`\n`;
  responseText += `- Chat ID: \`${chatId}\``;

  await ctx.reply(responseText, { parse_mode: 'Markdown' });
});

bot.command('people', async (ctx) => {
  if (!(await isAdmin(ctx))) return ctx.reply("❌ ဤ Command ကို Admin များသာ အသုံးပြုနိုင်ပါသည်။");

  const args = ctx.message.text.split(' ').slice(1);
  const config = getGroupConfig(ctx.chat.id);

  if (args.length === 0) {
    let currentMin = Math.round(config.autoDelTime / 60000);
    return ctx.reply(`⚙️ လက်ရှိ Group ဆက်တင်များ:\n- လိုအပ်သော လူဦးရေ: ${config.count} ယောက်\n- Reply ထောက်ပြောရန်: ${config.replyMode ? 'ဖွင့်ထားသည်' : 'ပိတ်ထားသည်'}\n- Bot စကားပြောစနစ်: ${config.toggleOpen ? 'ဖွင့်ထားသည်' : 'ပိတ်ထားသည်'}\n- အလိုအလျောက်ဖျက်မည့်အချိန်: ${config.autoDelTime === 0 ? 'မပျက်စေရ (ပိတ်ထားသည်)' : currentMin + ' မိနစ်'}\n\nအသုံးပြုပုံ: /people [အရေအတွက်]`);
  }

  const num = parseInt(args[0]);
  if (isNaN(num) || num < 1 || num > 50) {
    return ctx.reply("❌ ကျေးဇူးပြု၍ ၁ မှ ၅၀ အတွင်း မှန်ကန်သော နံပါတ်ကို ထည့်ပေးပါ။");
  }

  config.count = num;
  await ctx.reply(`✅ ဤ Group အတွက် စာမပြောမီ စောင့်ရမည့် လူဦးရေကို **${num} ယောက်** သို့ ပြောင်းလဲလိုက်ပါပြီ။`);
});

bot.command('replymode', async (ctx) => {
  if (!(await isAdmin(ctx))) return ctx.reply("❌ Admin များသာ သုံးနိုင်ပါသည်။");
  const config = getGroupConfig(ctx.chat.id);
  config.replyMode = !config.replyMode;
  await ctx.reply(`✅ Reply ထောက်ပြောသည့်စနစ်ကို **${config.replyMode ? 'ဖွင့်လိုက်ပါပြီ (Reply ထောက်မည်)' : 'ပိတ်လိုက်ပါပြီ (စာသားသပ်သပ် ပို့မည်)'}**။`);
});

bot.command('botchat', async (ctx) => {
  if (!(await isAdmin(ctx))) return ctx.reply("❌ Admin များသာ သုံးနိုင်ပါသည်။");
  const config = getGroupConfig(ctx.chat.id);
  config.toggleOpen = !config.toggleOpen;
  await ctx.reply(`✅ ဤ Group ၏ Bot စကားပြောတုံ့ပြန်မှုစနစ်ကို **${config.toggleOpen ? 'ဖွင့်ထားသည်' : 'ပိတ်ထားသည်'}**။`);
});

bot.command('autodel', async (ctx) => {
  if (!(await isAdmin(ctx))) return ctx.reply("❌ ကျေးဇူးပြု၍ ဤ Command ကို Admin များသာ သုံးနိုင်ပါသည်။");
  
  const args = ctx.message.text.split(' ').slice(1);
  const config = getGroupConfig(ctx.chat.id);

  if (args.length === 0) {
    let currentMin = Math.round(config.autoDelTime / 60000);
    return ctx.reply(`⏱️ လက်ရှိ Auto-Delete အချိန်: **${config.autoDelTime === 0 ? 'လုံးဝမပျက်ပါ (ပိတ်ထားသည်)' : currentMin + ' မိနစ်'}**\n\nအသုံးပြုရန်ပုံစံ:\n- /autodel 5 (၅ မိနစ်မှ အလိုအလျောက် ပျက်ရန်)\n- /autodel 0 (စာများ လုံးဝမပျက်စေရန် အပြီးအပိုင် ပိတ်ရန်)`);
  }

  const minutes = parseInt(args[0]);
  if (isNaN(minutes) || minutes < 0) {
    return ctx.reply("❌ ကျေးဇူးပြု၍ မှန်ကန်သော မိနစ်အριθ (၀ သို့မဟုတ် ထို့ထက်ပိုသောဂဏန်း) ကို ထည့်ပါ။");
  }

  if (minutes === 0) {
    config.autoDelTime = 0;
    return ctx.reply("✅ ဤ Group တွင် ဘော့တလုံးဝ အလိုအလျောက် မပျက်တော့ပါ (Auto-Delete ပိတ်လိုက်ပါပြီ)။");
  }

  config.autoDelTime = minutes * 60 * 1000;
  await ctx.reply(`✅ ဤ Group ၏ Auto-Delete အချိန်ကို **${minutes} မိနစ်** သို့ အောင်မြင်စွာ ပြောင်းလဲလိုက်ပါပြီ။`);
});

// ============================================================
// AI Commands
// ============================================================
bot.command('aiopen', async (ctx) => {
  const settings = getAISettings(ctx.from.id);
  settings.isOpen = true;
  const sent = await ctx.reply("🟢 AI စနစ်ကို ဖွင့်လိုက်ပါပြီရှင်။");
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('aioff', async (ctx) => {
  const settings = getAISettings(ctx.from.id);
  settings.isOpen = false;
  const sent = await ctx.reply("🔴 AI စနစ်ကို ပိတ်လိုက်ပါပြီရှင်။");
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('aitxt', async (ctx) => {
  const settings = getAISettings(ctx.from.id);
  settings.mode = 'text';
  const sent = await ctx.reply("💬 စာသား Mode သို့ ပြောင်းလိုက်ပါပြီရှင်။");
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('aivoice', async (ctx) => {
  const settings = getAISettings(ctx.from.id);
  settings.mode = 'voice';
  const sent = await ctx.reply("🔊 အသံ Mode သို့ ပြောင်းလိုက်ပါပြီရှင်။");
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('ai', async (ctx) => {
  const settings = getAISettings(ctx.from.id);
  settings.isOpen = true; 
  const handled = await handleAIResponse(ctx, ctx.message.text, { reply_parameters: { message_id: ctx.message.message_id } }, OWNER_ID);
  if (!handled) {
    const sent = await ctx.reply("🤖 AI စနစ် အဆင်သင့် ဖြစ်ပါပြီရှင်။");
    global.autoDeleteMessage(ctx, sent.message_id);
  }
});

// ============================================================
// 📢 Owner Broadcast & Management Commands
// ============================================================
bot.command('treply', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  const repliedMsg = ctx.message.reply_to_message;
  if (!repliedMsg) return ctx.reply('⚠️ ကျေးဇူးပြု၍ ပို့လိုသော ကြော်ငြာစာကို Reply ထောက်ပြီး /treply ဟု ရိုက်ပါ။');

  const adText = repliedMsg.text || repliedMsg.caption || '';
  const adPhoto = repliedMsg.photo ? repliedMsg.photo[repliedMsg.photo.length - 1].file_id : null;
  const adVideo = repliedMsg.video ? repliedMsg.video.file_id : null;
  try { await ctx.deleteMessage(); } catch (err) {}

  let successCount = 0, failCount = 0;
  if (User) {
    const users = await User.find({});
    for (const user of users) {
      try {
        let sentMsg;
        if (adPhoto) sentMsg = await ctx.api.sendPhoto(user.chatId, adPhoto, { caption: adText });
        else if (adVideo) sentMsg = await ctx.api.sendVideo(user.chatId, adVideo, { caption: adText });
        else if (adText) sentMsg = await ctx.api.sendMessage(user.chatId, adText);

        if (sentMsg) {
          setTimeout(async () => {
            try { await ctx.api.deleteMessage(user.chatId, sentMsg.message_id); } catch (e) {}
          }, 3 * 60 * 1000);
          successCount++;
        }
      } catch (err) { failCount++; }
    }
  }
  const reportMsg = await ctx.reply(`✅ ကြော်ငြာ ပို့ပြီးသူ: ${successCount} ယောက် | ပို့မရသူ: ${failCount} ယောက်`);
  global.autoDeleteMessage(ctx, reportMsg.message_id, 3 * 60 * 1000);
});

bot.command('sendlink', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  const messageText = ctx.message.text.replace('/sendlink', '').trim();
  if (!messageText) return ctx.reply('⚠️ ကျေးဇူးပြု၍ ပို့လိုသော စာသားပါ ထည့်ရေးပေးပါ။');

  const groupLink = 'https://t.me/your_group_link'; 
  const fullMessage = `${messageText}\n\n🔗 ဝင်ရန်လင့်ခ်: ${groupLink}`;

  try { await ctx.deleteMessage(); } catch (err) {}

  let successCount = 0, failCount = 0;
  if (User) {
    const users = await User.find({});
    for (const user of users) {
      try {
        const sentMsg = await ctx.api.sendMessage(user.chatId, fullMessage);
        setTimeout(async () => {
          try { await ctx.api.deleteMessage(user.chatId, sentMsg.message_id); } catch (e) {}
        }, 5 * 60 * 60 * 1000);
        successCount++;
      } catch (err) { failCount++; }
    }
  }
  const reportMsg = await ctx.reply(`✅ ပို့ပြီးသူ: ${successCount} ယောက် | ပို့မရသူ: ${failCount} ယောက်`);
  global.autoDeleteMessage(ctx, reportMsg.message_id, 3 * 60 * 1000);
});

bot.command('open', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  isOwnerMediaMode = true;
  const sent = await ctx.reply("✅ Owner Media Mode ဖွင့်လိုက်ပါပြီ။");
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('close', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  isOwnerMediaMode = false;
  const sent = await ctx.reply("❌ Owner Media Mode ပိတ်လိုက်ပါပြီ။");
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('Tearopen', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  isTearOpen = true;
  uniqueUsersCount.clear();
  const sent = await ctx.reply("🔓 Tear Open Mode ဖွင့်လိုက်ပါပြီ။");
  global.autoDeleteMessage(ctx, sent.message_id);
});

bot.command('Tear', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  isTearOpen = false;
  uniqueUsersCount.clear();
  const sent = await ctx.reply("🔒 Tear Mode ဖွင့်လိုက်ပါပြီ။");
  global.autoDeleteMessage(ctx, sent.message_id);
});

// ============================================================
// 🗑️ Owner Clean & Media Deletion Commands
// ============================================================
bot.command('clearbrain', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  try {
    await TextReply.deleteMany({});
    await Media.deleteMany({});
    const sent = await ctx.reply("🗑️ Bot ၏ မှတ်ဉာဏ်များ အားလုံးကို ဖျက်ထုတ်လိုက်ပါပြီ။");
    global.autoDeleteMessage(ctx, sent.message_id);
  } catch (err) { console.error(err); }
});

bot.command('cleansymbols', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  try {
    const result = await TextReply.deleteMany({ $or: [{ text: /^[\/@]/ }, { text: {$regex: /@/ } }] });
    const sent = await ctx.reply(`🧹 Symbol ပါသော စာပေါင်း ${result.deletedCount} ခုကို ဖျက်ထုတ်လိုက်ပါပြီ။`);
    global.autoDeleteMessage(ctx, sent.message_id);
  } catch (err) { console.error(err); }
});

bot.command('cleanlong', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  try {
    const allReplies = await TextReply.find();
    let deleteIds = [];
    for (const doc of allReplies) {
      if (doc.text.length > 80 || /[a-zA-Z]{16,}/.test(doc.text)) deleteIds.push(doc._id);
    }
    if (deleteIds.length > 0) {
      await TextReply.deleteMany({ _id: { $in: deleteIds } });
      const sent = await ctx.reply(`🧹 စာအရှည်ကြီး ${deleteIds.length} ခုကို ရှင်းထုတ်လိုက်ပါပြီ။`);
      global.autoDeleteMessage(ctx, sent.message_id);
    } else {
      const sent = await ctx.reply("🧹 ဖျက်ရန် မရှိပါ။");
      global.autoDeleteMessage(ctx, sent.message_id);
    }
  } catch (err) { console.error(err); }
});

bot.command('clearstickers', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  try {
    const result = await Media.deleteMany({ type: 'sticker' });
    const sent = await ctx.reply(`🗑️ စတစ်ကာ (Stickers) အားလုံးပေါင်း ${result.deletedCount} ခုကို ဖျက်ထုတ်လိုက်ပါပြီ။`);
    global.autoDeleteMessage(ctx, sent.message_id);
  } catch (err) { console.error(err); }
});

bot.command('clearmedia', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  try {
    const result = await Media.deleteMany({ type: { $in: ['photo', 'video', 'audio', 'music'] } });
    const sent = await ctx.reply(`🗑️ မီဒီယာ (Photo/Video/Audio) အားလုံးပေါင်း ${result.deletedCount} ခုကို ဖျက်ထုတ်လိုက်ပါပြီ။`);
    global.autoDeleteMessage(ctx, sent.message_id);
  } catch (err) { console.error(err); }
});

// ============================================================
// 📤 Channel ထဲသို့ တိုက်ရိုက်ပို့ရန် ကွန်မန်း
// ============================================================
bot.command('sendchannel', async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return;
  const repliedMsg = ctx.message.reply_to_message;
  if (!repliedMsg) return ctx.reply('⚠️ ကျေးဇူးပြု၍ Channel ထဲ ပို့လိုသော စာ/မီဒီယာကို Reply ထောက်ပြီး /sendchannel [Channel Username] ဟု ရိုက်ပါ။');

  const args = ctx.message.text.split(' ').slice(1);
  const targetChannel = args[0];
  if (!targetChannel) return ctx.reply('⚠️ ကျေးဇူးပြု၍ ပို့ရမည့် Channel Username (ဥပမာ: @mychannel) ကို ထည့်ရေးပေးပါ။');

  try {
    await ctx.deleteMessage();
    let sent;
    if (repliedMsg.photo) {
      sent = await ctx.api.sendPhoto(targetChannel, repliedMsg.photo[repliedMsg.photo.length - 1].file_id, { caption: repliedMsg.caption || '' });
    } else if (repliedMsg.video) {
      sent = await ctx.api.sendVideo(targetChannel, repliedMsg.video.file_id, { caption: repliedMsg.caption || '' });
    } else if (repliedMsg.text) {
      sent = await ctx.api.sendMessage(targetChannel, repliedMsg.text);
    } else if (repliedMsg.sticker) {
      sent = await ctx.api.sendSticker(targetChannel, repliedMsg.sticker.file_id);
    }

    if (sent) {
      const report = await ctx.reply(`✅ Channel (${targetChannel}) သို့ အောင်မြင်စွာ ပို့ပြီးပါပြီ။`);
      global.autoDeleteMessage(ctx, report.message_id);
    }
  } catch (err) {
    ctx.reply(`❌ ပို့၍မရပါ: ${err.message}`);
  }
});

// ============================================================
// 🟢 Unified Message Handler (Non-blocking AI Execution)
// ============================================================
bot.on('message', async (ctx, next) => {
  try {
    const isOwnerUser = ctx.from && ctx.from.id === OWNER_ID;
    const isPrivate = ctx.chat.type === 'private';
    const msg = ctx.message;
    const currentGroupConfig = getGroupConfig(ctx.chat.id);

    const replyOptions = currentGroupConfig.replyMode 
      ? { reply_parameters: { message_id: msg.message_id } } 
      : {};

    if (!isOwnerUser && msg.text && containsForbiddenText(msg.text)) {
      try {
        await ctx.deleteMessage();
      } catch (e) {}
      return;
    }

    if (isPrivate && !isOwnerUser && OWNER_ID) {
      try {
        const userInfo = `👤 **User Info:**\n- Name: ${ctx.from.first_name || ''} ${ctx.from.last_name || ''}\n- Username: @${ctx.from.username || 'None'}\n- ID: \`${ctx.from.id}\``;
        await ctx.api.sendMessage(OWNER_ID, userInfo, { parse_mode: 'Markdown' });
        await ctx.api.forwardMessage(OWNER_ID, ctx.chat.id, msg.message_id);
      } catch (fwdErr) {
        console.error("Forward to owner error:", fwdErr.message);
      }
    }

    const emojis = ['👍', '❤️', '🔥', '🥰', '👏', '😁'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    try { await ctx.react(randomEmoji); } catch (e) {}

    // 1. Owner Media Mode
    if (isOwnerUser && isPrivate && isOwnerMediaMode) {
      let type = null, fileId = null;
      if (msg.audio || msg.voice) { type = msg.audio ? 'music' : 'audio'; fileId = (msg.audio || msg.voice).file_id; }
      else if (msg.video) { type = 'video'; fileId = msg.video.file_id; }
      else if (msg.photo) { type = 'photo'; fileId = msg.photo[msg.photo.length - 1].file_id; }
      else if (msg.sticker) { type = 'sticker'; fileId = msg.sticker.file_id; }
      else if (msg.text && urlRegex.test(msg.text)) { type = 'link'; fileId = msg.text.match(urlRegex)[0]; }

      if (type && fileId) {
        await ctx.replyWithChatAction('typing');
        await Media.create({ type, fileId, caption: msg.caption || '' });
        const sent = await ctx.reply(`✅ Owner ၏ ${type} ကို သိမ်းဆည်းပြီးပါပြီ။`, replyOptions);
        global.autoDeleteMessage(ctx, sent.message_id);
        return;
      }
    }

    // 2. Text Replies & AI Integration (Non-blocking Background AI)
    if (msg.text && !urlRegex.test(msg.text)) {
      const isCommand = msg.text.startsWith('/');
      const isBadWord = containsBadWord(msg.text);
      const hasMention = msg.text.includes('@');
      const isTooLong = msg.text.length > 80;
      const isEnglishLong = /[a-zA-Z]{16,}/.test(msg.text);

      if (!isCommand && !isBadWord && !hasMention && !isTooLong && !isEnglishLong) {
        try {
          await TextReply.updateOne(
            { text: msg.text },
            { $setOnInsert: { text: msg.text, fromUserId: ctx.from.id, chatId: ctx.chat.id, lastUsedAt: new Date() } },
            { upsert: true }
          );
        } catch (dbErr) {}
      }

      if (!isCommand) {
        if (!currentGroupConfig.toggleOpen) return; 

        handleAIResponse(ctx, msg.text, replyOptions, OWNER_ID).catch((aiErr) => {
          console.error("AI Background Processing Error:", aiErr.message);
        });

        if (!isTearOpen) {
          uniqueUsersCount.add(ctx.from.id);
          if (uniqueUsersCount.size < currentGroupConfig.count) return; 
          uniqueUsersCount.clear();
        }

        try { await ctx.replyWithChatAction('typing'); } catch (err) {}

        const randomDocs = await TextReply.aggregate([{ $sample: { size: 1 } }]);
        const randomDoc = randomDocs[0];

        if (randomDoc) {
          await TextReply.updateOne({ _id: randomDoc._id }, { lastUsedAt: new Date() });
          await new Promise(resolve => setTimeout(resolve, 800));

          const sentMsg = await ctx.reply(randomDoc.text, replyOptions);
          global.autoDeleteMessage(ctx, sentMsg.message_id);
          
          replyCounter++;
          if (replyCounter >= 8) {
            replyCounter = 0;
            const randomStickerArr = await Media.aggregate([
              { $match: { type: 'sticker' } },
              { $sample: { size: 1 } }
            ]);

            if (randomStickerArr && randomStickerArr.length > 0) {
              try {
                await ctx.replyWithChatAction('choose_sticker');
                await new Promise(resolve => setTimeout(resolve, 600));
              } catch (err) {}

              const sentSticker = await ctx.replyWithSticker(randomStickerArr[0].fileId, replyOptions);
              global.autoDeleteMessage(ctx, sentSticker.message_id);
            }
          }
        }
      }
      return;
    }

    // 3. Media Replies
    let requestedType = null;
    if (msg.audio || msg.voice) requestedType = msg.audio ? 'music' : 'audio';
    else if (msg.video) requestedType = 'video';
    else if (msg.photo) requestedType = 'photo';
    else if (msg.sticker) requestedType = 'sticker';

    if (requestedType && currentGroupConfig.toggleOpen) {
      const requestedMediaArr = await Media.aggregate([
        { $match: { type: requestedType } },
        { $sample: { size: 1 } }
      ]);

      if (requestedMediaArr && requestedMediaArr.length > 0) {
        const randomMedia = requestedMediaArr[0];
        let sentMedia;
        if (requestedType === 'photo') { await ctx.replyWithChatAction('upload_photo'); sentMedia = await ctx.replyWithPhoto(randomMedia.fileId, replyOptions); }
        else if (requestedType === 'video') { await ctx.replyWithChatAction('upload_video'); sentMedia = await ctx.replyWithVideo(randomMedia.fileId, replyOptions); }
        else if (requestedType === 'sticker') { await ctx.replyWithChatAction('choose_sticker'); sentMedia = await ctx.replyWithSticker(randomMedia.fileId, replyOptions); }
        else if (requestedType === 'music' || requestedType === 'audio') { await ctx.replyWithChatAction('upload_voice'); sentMedia = await ctx.replyWithAudio(randomMedia.fileId, replyOptions); }

        if (sentMedia) global.autoDeleteMessage(ctx, sentMedia.message_id);
      }
    }

  } catch (error) {
    console.error('Error in Unified Message Handler:', error);
  }
});

// Auto Clean Up Old Memory
setInterval(async () => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await TextReply.deleteMany({ lastUsedAt: { $lt: thirtyDaysAgo } });
  } catch (err) {}
}, 24 * 60 * 60 * 1000);

// Bot Start
bot.start({
  drop_pending_updates: true,
  allowed_updates: ["message", "callback_query", "chat_member", "my_chat_member"]
});

console.log('🤖 Bot is running smoothly with complete features and custom auto-delete!');
