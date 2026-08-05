const { PremiumKey, AdminToolsConfig } = require('./adminToolsSchema');

const OWNER_ID = Number(process.env.OWNER_ID);

function setupPremiumKeyModule(bot) {

  // 1. Owner Key ထုတ်ယူသည့် Command (/Teach [Tear12345678]) - ဂဏန်း ၈ လုံး
  bot.command('Teach', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;

    const text = ctx.message.text.trim();
    const match = text.match(/\/Teach\s+\[(Tear\d{8})\]/);

    if (!match) {
      return ctx.reply("❌ Format မှားယွင်းနေပါသည်။\nဥပမာ- `/Teach [Tear12345678]` (Tear နောက်တွင် ဂဏန်း ၈ လုံး ပါရမည်)");
    }

    const generatedKey = match[1];

    try {
      await PremiumKey.create({ key: generatedKey });
      await ctx.reply(`✅ Key ထုတ်ယူခြင်း အောင်မြင်ပါသည်။\n🔑 Key: \`${generatedKey}\``, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply("❌ ဤ Key သည် စနစ်ထဲတွင် ရှိပြီးသား ဖြစ်နေပါသည်။");
    }
  });

  // 2. Private Chat Activation
  bot.command('keyvideo', async (ctx) => {
    if (ctx.chat.type !== 'private') {
      return ctx.reply("ဤ Command ကို Bot ၏ Private Chat တွင်သာ အသုံးပြုပေးပါရှင့်။");
    }

    const args = ctx.message.text.split(' ');
    const inputKey = args[1];

    if (!inputKey) {
      return ctx.reply("❌ ကျေးဇူးပြု၍ Key ထည့်သွင်းပေးပါ။\nဥပမာ- `/keyvideo Tear12345678`");
    }

    await ctx.reply("⏳စစ်ဆေးနေပါသည့်ရှင့်🍃");

    const keyDoc = await PremiumKey.findOne({ key: inputKey });

    if (!keyDoc || keyDoc.isUsed) {
      return ctx.reply("ကျရူံး❌❌\nတောင်ပန်ပါတယ်ရှင့်keyအတုမရပါ။သုံးပီးသားမရပါရှင့်");
    }

    await ctx.reply(
`⏳စစ်ဆေးနေပါသည့်ရှင့်🍃
အောင်မြင်✅✅
သင်gpမှာယခုဆိုရင်
Ban/Mute/Umute/AutoMute တို့အတွက် videoထည့်နိုင်ပါသည်ရှင့်🤭(တစ်ခါဝယ်ထားရင်တစ်သက်စာပါရှင့်/သင်တစ်ဉီးသာဤGp၏ Video စနစ်ကိုထိမ်းချုပ်နိုင်ပါသည့်ရှင့်😊)

👉 မိမိ Premium ဖွင့်လိုသော Group ထဲသို့သွား၍ \`/activatevideo ${inputKey}\` ဟု ရိုက်ကူးပေးပါရှင့်။`, { parse_mode: 'Markdown' });
  });

  // 3. Group Activation
  bot.command('activatevideo', async (ctx) => {
    if (ctx.chat.type === 'private') return;

    const args = ctx.message.text.split(' ');
    const inputKey = args[1];

    if (!inputKey) return ctx.reply("❌ Key ထည့်သွင်းရန် လိုအပ်ပါသည်။");

    const keyDoc = await PremiumKey.findOne({ key: inputKey });

    if (!keyDoc || keyDoc.isUsed) {
      return ctx.reply("ကျရူံး❌❌\nတောင်ပန်ပါတယ်ရှင့်keyအတုမရပါ။သုံးပီးသားမရပါရှင့်");
    }

    keyDoc.isUsed = true;
    keyDoc.usedBy = ctx.from.id;
    keyDoc.usedInChat = ctx.chat.id;
    await keyDoc.save();

    await AdminToolsConfig.findOneAndUpdate(
      { chatId: ctx.chat.id },
      { isPremium: true, premiumOwnerId: ctx.from.id },
      { upsert: true, new: true }
    );

    await ctx.reply("🎉 ယခု Group သည် Video Customization စနစ်အတွက် Premium အောင်မြင်စွာ ရရှိသွားပါပြီရှင့်။");
  });
}

module.exports = setupPremiumKeyModule;

