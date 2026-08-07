const { User, Setting } = require('./models');
const tempAuth = {};

function setupUserAccount(bot, OWNER_ID) {
  
  // ⚙️ Owner က Bot Chat ထဲတွင် Channel ချိတ်ရန် Command
  bot.command('setchannel', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) {
      return ctx.reply('⚠️ ဤခွင့်ပြုချက်သည် Bot ပိုင်ရှင် (Owner) အတွက်သာ ဖြစ်ပါသည်။');
    }

    const args = ctx.match;
    if (!args) {
      return ctx.reply('⚠️ ကျေးဇူးပြု၍ Channel ထည့်ပါ။\nပုံစံ: `/setchannel @channel_username` ဟု ရိုက်ပါ။', { parse_mode: 'Markdown' });
    }

    const channelTarget = args.trim();

    try {
      await Setting.findOneAndUpdate(
        { key: 'log_channel' },
        { value: channelTarget },
        { upsert: true, new: true }
      );

      await ctx.reply(`✅ အောင်မြင်ပါသည်! Log ပို့မည့် Channel ကို <b>${channelTarget}</b> သို့ ချိတ်ဆက်ပြီးပါပြီ။`, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('Channel ချိတ်ရာတွင် အမှားရှိသည်:', err);
      ctx.reply('❌ Channel ချိတ်ရာတွင် အမှားအယွင်း ရှိသွားပါသည်။');
    }
  });

  bot.command('register', async (ctx) => {
    const chatId = ctx.from.id.toString();
    const existingUser = await User.findOne({ chatId });

    if (existingUser) {
      return ctx.reply('⚠️ သင်သည် အကောင့်ရှိပြီးသား ဖြစ်ပါသည်။ /watch ဖြင့် ဗီဒီယိုကြည့်နိုင်ပါသည်။');
    }

    tempAuth[chatId] = { step: 'waiting_name' };
    ctx.reply('🔐 **အကောင့်အသစ်ဖွင့်ခြင်း**\n\nကျေးဇူးပြု၍ သင့်ရဲ့ **အမည် (Name)** ကို ရိုက်ထည့်ပေးပါ -');
  });

  // ⚠️ မှတ်ချက်: text handler ကို bot.js ထဲမှာ သုံးထားရင် register လုပ်စဉ် text ဖမ်းဖို့ ဒီဟာလေး လိုပါမယ်။ 
  // သို့သော် bot.js ရဲ့ message handler က အကုန်ဖမ်းနေရင် ဒီဟာကို bot.js ထဲမှာ ပေါင်းထည့်ပေးရပါမယ်။ 
  // လောလောဆယ် သီးသန့် register လုပ်စဉ် text စစ်ဖို့အတွက် -
}

// Register ပြီးသွားရင် Channel ဆီ Log ပို့ပေးဖို့ Helper Function
async function sendRegisterLog(bot, name, chatId) {
  try {
    const channelSetting = await Setting.findOne({ key: 'log_channel' });
    if (channelSetting && channelSetting.value) {
      const logMessage = 
        `🔔 <b>အကောင့်အသစ် ဖွင့်လှစ်မှုအသစ်!</b>\n\n` +
        `👤 အမည်: <b>${name}</b>\n` +
        `🆔 Chat ID: <code>${chatId}</code>\n` +
        `📅 အချိန်: ${new Date().toLocaleString()}`;

      await bot.api.sendMessage(channelSetting.value, logMessage, { parse_mode: 'HTML' });
    }
  } catch (err) {
    console.error('Channel သို့ Log ပို့ရာတွင် အမှားရှိသည်:', err);
  }
}

module.exports = { setupUserAccount, sendRegisterLog, tempAuth };
