const { PremiumKey, AdminToolsConfig } = require('./adminToolsSchema');

const OWNER_ID = Number(process.env.OWNER_ID);

function setupPremiumKeyModule(bot) {

  // 1. Owner သီးသန့် Key ထုတ်ယူသည့် Command (/Teach [Tear14567])
  bot.command('Teach', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;

    const text = ctx.message.text.trim();
    const match = text.match(/\/Teach\s+\[(Tear\d{5})\]/);

    if (!match) {
      return ctx.reply("❌ Format မှားယွင်းနေပါသည်။\nဥပမာ- `/Teach [Tear14567]` (Tear နောက်တွင် ဂဏန်း ၅ လုံး ပါရမည်)");
    }

    const generatedKey = match[1];

    try {
      await PremiumKey.create({ key: generatedKey });
      await ctx.reply(`✅ Key ထုတ်ယူခြင်း အောင်မြင်ပါသည်။\n🔑 Key: \`${generatedKey}\``, { parse_mode: 'Markdown' });
    } catch (err) {
      await ctx.reply("❌ ဤ Key သည် စနစ်ထဲတွင် ရှိပြီးသား ဖြစ်နေပါသည်။");
    }
  });

// 2. User မှ Bot Private Chat တွင် Key လာရောက် Activate ပြုလုပ်ခြင်း
  bot.command('keyvideo', async (ctx) => {
    if (ctx.chat.type !== 'private') {
      return ctx.reply("ဤ Command ကို Bot ၏ Private Chat တွင်သာ အသုံးပြုပေးပါရှင့်။");
    }

    const args = ctx.message.text.split(' ');
    const inputKey = args[1];

    if (!inputKey) {
      return ctx.reply("❌ ကျေးဇူးပြု၍ Key ထည့်သွင်းပေးပါ။\nဥပမာ- `/keyvideo Tear14567`");
    }

    await ctx.reply("⏳စစ်ဆေးနေပါသည့်ရှင့်🍃");

    const keyDoc = await PremiumKey.findOne({ key: inputKey });

    // Key မမှန်ပါက သို့မဟုတ် သုံးပြီးသားဖြစ်ပါက
    if (!keyDoc || keyDoc.isUsed) {
      return ctx.reply("ကျရူံး❌❌\nတောင်ပန်ပါတယ်ရှင့်keyအတုမရပါ။သုံးပီးသားမရပါရှင့်");
    }

// Key မှန်ကန်ပါက တည်ရှိနေသော Group တစ်ခုခုတွင် Activated အဖြစ် သတ်မှတ်ရန် အကြောင်းကြားခြင်း
    // အသုံးပြုသူသည် Group ထဲရောက်ပါက /activatevideo [Key] ဖြင့် Group အား Premium သတ်မှတ်နိုင်ပါသည်
    ctx.session = ctx.session || {};
    await ctx.reply(
`⏳စစ်ဆေးနေပါသည့်ရှင့်🍃
အောင်မြင်✅✅
သင်gpမှာယခုဆိုရင်
Ban/Mute/Umuteတို့အတွက်videoထည့်နိုင်ပါသည်ရှင့်🤭(တစ်ခါဝယ်ထားရင်တစ်သက်စာပါရှင့်/သင်တစ်ဉီးသာဤGp၏ Ban/Mute/UMute =videoစနစ်ကိုထိမ်းချုပ်နိုင်ပါသည့်ရှင့်😊)

👉 မိမိ Premium ဖွင့်လိုသော Group ထဲသို့သွား၍ \`/activatevideo ${inputKey}\` ဟု ရိုက်ကူးပေးပါရှင့်။`, { parse_mode: 'Markdown' });
  });

  // 3. Group ထဲတွင် Key ဖြင့် Premium ဖွင့်ခြင်း
  bot.command('activatevideo', async (ctx) => {
    if (ctx.chat.type === 'private') return;

    const args = ctx.message.text.split(' ');
    const inputKey = args[1];

    if (!inputKey) return ctx.reply("❌ Key ထည့်သွင်းရန် လိုအပ်ပါသည်။");

    const keyDoc = await PremiumKey.findOne({ key: inputKey });

    if (!keyDoc || keyDoc.isUsed) {
      return ctx.reply("ကျရူံး❌❌\nတောင်ပန်ပါတယ်ရှင့်keyအတုမရပါ။သုံးပီးသားမရပါရှင့်");
    }

// Key ကို သုံးပြီးကြောင်း မှတ်သားမည်
    keyDoc.isUsed = true;
    keyDoc.usedBy = ctx.from.id;
    keyDoc.usedInChat = ctx.chat.id;
    await keyDoc.save();

    // Group ကို Premium အဖြစ် သတ်မှတ်မည်
    await AdminToolsConfig.findOneAndUpdate(
      { chatId: ctx.chat.id },
      { isPremium: true, premiumOwnerId: ctx.from.id },
      { upsert: true, new: true }
    );

    await ctx.reply("🎉 ယခု Group သည် Ban/Mute/Unmute Video Customization စနစ်အတွက် Premium အောင်မြင်စွာ ရရှိသွားပါပြီရှင့်။");
  });
}

module.exports = setupPremiumKeyModule;


