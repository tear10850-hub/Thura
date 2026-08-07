const { InlineKeyboard } = require('grammy');
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

  // 📝 Register စတင်ရန်
  bot.command('register', async (ctx) => {
    const chatId = ctx.from.id.toString();
    const existingUser = await User.findOne({ chatId });

    if (existingUser) {
      return ctx.reply('⚠️ သင်သည် အကောင့်ရှိပြီးသား ဖြစ်ပါသည်။ /watch ဖြင့် ဗီဒီယိုကြည့်နိုင်ပါသည်။');
    }

    tempAuth[chatId] = { step: 'waiting_name' };
    ctx.reply('🔐 **အကောင့်အသစ်ဖွင့်ခြင်း**\n\nကျေးဇူးပြု၍ သင့်ရဲ့ **အမည် (Name)** ကို ရိုက်ထည့်ပေးပါ -');
  });

  // 💬 အကောင့်ဖွင့်စဉ် နာမည်ရိုက်ထည့်လာမှုကို လက်ခံခြင်း
  bot.on('message:text', async (ctx, next) => {
    const chatId = ctx.from.id.toString();
    const authData = tempAuth[chatId];

    if (authData && authData.step === 'waiting_name') {
      const name = ctx.message.text.trim();

      if (!name || name.startsWith('/')) {
        return ctx.reply('⚠️ ကျေးဇူးပြု၍ မှန်ကန်သော အမည် (Name) ကို ထည့်သွင်းပေးပါ။');
      }

      try {
        const newUser = new User({ 
          chatId, 
          name, 
          following: [] 
        });
        await newUser.save();

        delete tempAuth[chatId];

        await ctx.reply(`✅ အကောင့်ဖွင့်ခြင်း အောင်မြင်ပါသည်။\n📛 အမည်: <b>${name}</b>\n\n🎬 ယခုအခါ /watch ဖြင့် ဗီဒီယိုများ စတင်ကြည့်ရှုနိုင်ပါပြီ။`, { parse_mode: 'HTML' });

        // Channel ဆီသို့ Log ပို့ရန်
        await sendRegisterLog(bot, name, chatId);

      } catch (err) {
        console.error('Register save error:', err);
        ctx.reply('❌ အကောင့်ဖွင့်ရာတွင် အမှားအယွင်း ရှိသွားပါသည်။ ထပ်မံကြိုးစားပါ။');
      }
    } else {
      return next();
    }
  });
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
