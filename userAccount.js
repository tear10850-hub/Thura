const { InlineKeyboard } = require('grammy');
const { User } = require('./models');

const tempAuth = {};

function setupUserAccount(bot, OWNER_ID) {
  
  bot.command('register', async (ctx) => {
    const chatId = ctx.from.id.toString();
    const existingUser = await User.findOne({ chatId });

    if (existingUser) {
      return ctx.reply('⚠️ သင်သည် အကောင့်ရှိပြီးသား ဖြစ်ပါသည်။ /watch ဖြင့် ဗီဒီယိုကြည့်နိုင်ပါသည်။');
    }

    tempAuth[chatId] = { step: 'waiting_name' };
    ctx.reply('🔐 **အကောင့်အသစ်ဖွင့်ခြင်း**\n\nကျေးဇူးပြု၍ သင့်ရဲ့ **အမည် (Name)** ကို ရိုက်ထည့်ပေးပါ -');
  });

  bot.on('message:text', async (ctx, next) => {
    const chatId = ctx.from.id.toString();
    const authData = tempAuth[chatId];

    if (authData && authData.step === 'waiting_name') {
      const name = ctx.message.text.trim();

      if (!name || name.startsWith('/')) {
        return ctx.reply('⚠️ ကျေးဇူးပြု၍ မှန်ကန်သော အမည် (Name) ကို ထည့်သွင်းပေးပါ။');
      }

      // Schema ထဲတွင် password လိုအပ်သဖြင့် default password တစ်ခု သို့မဟုတ် ယာယီထည့်ပေးခြင်း
      try {
        const newUser = new User({ 
          chatId, 
          name, 
          password: 'default_password', // Schema လိုအပ်ချက်အရ ထည့်သွင်းပေးခြင်း
          following: [],
          favorites: []
        });
        await newUser.save();

        delete tempAuth[chatId];
        await ctx.reply(`✅ အကောင့်ဖွင့်ခြင်း အောင်မြင်ပါသည်။\n📛 အမည်: <b>${name}</b>\n\n🎬 ယခုအခါ /watch ဖြင့် ဗီဒီယိုများ စတင်ကြည့်ရှုနိုင်ပါပြီ။`, { parse_mode: 'HTML' });
      } catch (err) {
        console.error('Register save error:', err);
        ctx.reply('❌ အကောင့်ဖွင့်ရာတွင် အမှားအယွင်း ရှိသွားပါသည်။ ထပ်မံကြိုးစားပါ။');
      }
    } else {
      return next();
    }
  });
}

module.exports = { setupUserAccount, tempAuth };
