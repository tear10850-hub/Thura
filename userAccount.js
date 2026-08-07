const { User, Setting } = require('./dbSchema');
const tempAuth = {};

// 👑 သင်၏ (Owner) Telegram Chat ID ကို ဤနေရာတွင် ထည့်ပါ (ဥပမာ - '123456789')
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || 'YOUR_OWNER_TELEGRAM_ID_HERE';

function setupUserAccount(bot) {
  
  // ⚙️ Owner က Bot Chat ထဲတွင် Channel ချိတ်ရန် Command (ဥပမာ: /setchannel @mychannel)
  bot.command('setchannel', async (ctx) => {
    const chatId = ctx.from.id.toString();

    // Owner ဟုတ်မဟုတ် စစ်ဆေးခြင်း
    if (chatId !== ADMIN_CHAT_ID) {
      return ctx.reply('⚠️ ဤခွင့်ပြုချက်သည် Bot ပိုင်ရှင် (Owner) အတွက်သာ ဖြစ်ပါသည်။');
    }

    const args = ctx.match; // ချိတ်မည့် Channel Username သို့မဟုတ် ID
    if (!args) {
      return ctx.reply('⚠️ ကျေးဇူးပြု၍ Channel ထည့်ပါ။\nပုံစံ: `/setchannel @channel_username` ဟု ရိုက်ပါ။', { parse_mode: 'Markdown' });
    }

    const channelTarget = args.trim();

    try {
      // Database ထဲတွင် Channel ကို သိမ်းဆည်းမည် (သို့မဟုတ် အသစ်လဲမည်)
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

  bot.on('text', async (ctx) => {
    const chatId = ctx.from.id.toString();
    const text = ctx.message.text;

    if (!tempAuth[chatId]) return;

    if (tempAuth[chatId].step === 'waiting_name') {
      tempAuth[chatId].name = text;
      tempAuth[chatId].step = 'waiting_password';
      ctx.reply('🔒 သင့်အကောင့်လုံခြုံရေးအတွက် **Password (စကားဝှက်)** တစ်ခု သတ်မှတ်ပေးပါ (အနည်းဆုံး ၆ လုံးအထက်) -');
    } 
    else if (tempAuth[chatId].step === 'waiting_password') {
      if (text.length < 6) {
        return ctx.reply('⚠️ စကားဝှက်သည် အနည်းဆုံး ၆ လုံး ရှိရပါမည်။ ထပ်ကြိုးစားပါ။');
      }

      try {
        const name = tempAuth[chatId].name;
        const newUser = new User({
          chatId: chatId,
          name: name,
          password: text,
          following: [],
          favorites: []
        });

        await newUser.save();
        delete tempAuth[chatId];

        ctx.reply('🎉 အကောင့် အောင်မြင်စွာ ဖွင့်ပြီးပါပြီ! 🔐\n\n🎬 ဗီဒီယိုတင်ရန် Bot ထဲသို့ ဗီဒီယိုဖိုင် တိုက်ရိုက် ပို့ပါ။\n📺 ဗီဒီယိုကြည့်ရန် /watch ဟု ရိုက်ပါ။');

        // 📢 Database ထဲမှ Channel ကို ရှာပြီး အကောင့်သစ်ဖွင့်ကြောင်း ပို့ပေးခြင်း
        const channelSetting = await Setting.findOne({ key: 'log_channel' });
        if (channelSetting && channelSetting.value) {
          const logMessage = 
            `🔔 <b>အကောင့်အသစ် ဖွင့်လှစ်မှုအသစ်!</b>\n\n` +
            `👤 အမည်: <b>${name}</b>\n` +
            `🆔 Chat ID: <code>${chatId}</code>\n` +
            `📅 အချိန်: ${new Date().toLocaleString()}`;

          await bot.api.sendMessage(channelSetting.value, logMessage, { parse_mode: 'HTML' }).catch(err => {
            console.error('Channel သို့ ပို့ရာတွင် အမှားရှိသည်:', err);
          });
        }

      } catch (err) {
        ctx.reply('❌ အကောင့်ဖွင့်ရာတွင် အမှားအယွင်းရှိသွားပါသည်။ ထပ်ကြိုးစားပါ။');
      }
    }
  });
}

module.exports = setupUserAccount;
