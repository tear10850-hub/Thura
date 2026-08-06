const { InlineKeyboard } = require('grammy');
const Welcome = require('./welcomeSchema');

async function isAdmin(ctx) {
  if (ctx.chat.type === 'private') return true;
  try {
    const member = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
    return ['administrator', 'creator'].includes(member.status);
  } catch (err) {
    return false;
  }
}

// မူလ ပုံသေ စာသား
const DEFAULT_WELCOME_TEXT = 
`နွေကိုချစ်ရင်
ပူလောင်ရတယ်🍃
အချစ်စစ်ကိုရှာတော့🍁
အတုအယောင်နဲတိုးတယ်🎋
ဝင်လာခဲ့ တီမှာတော့အတုအယောင်🌾
မဟုတ်ပါဘူး🤪🤪`;

function setupWelcomeModule(bot) {
  // /wevideo - Video သတ်မှတ်ခြင်း
  bot.command('wevideo', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply("❌Sorry❌\nလုံလောက်သောခွင့်ပြုချက်မရှိပါသဖြင့် Group Admin ကို ဆက်သွယ်ပါရှင့်🎋🍃");
    }

    const existingConfig = await Welcome.findOne({ chatId: ctx.chat.id });
    if (existingConfig && existingConfig.welcomeVideoId) {
      return ctx.reply("⚠️ **လုံခြုံရေး အသိပေးချက်** ⚠️\n\nWelcome Video သတ်မှတ်ထားပြီးသား ဖြစ်ပါသည်။ Video အသစ် ထပ်မံ သတ်မှတ်လိုပါက အရင် `/Dwevideo` ဖြင့် Video ဟောင်းကို ဖျက်ပေးပါရှင့်။");
    }

    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) {
      return ctx.reply("ကျေးဇူးပြု၍ Welcome သတ်မှတ်လိုသော Video ကို Reply ထောက်ပြီး `/wevideo` ဟု ရိုက်ပေးပါ။");
    }

    const videoId = replyMsg.video.file_id;
    await Welcome.findOneAndUpdate(
      { chatId: ctx.chat.id },
      { welcomeVideoId: videoId, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    await ctx.reply("Welcome Video ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။");
  });

  // /Dwevideo - Video ဖျက်ခြင်း
  bot.command('Dwevideo', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply("❌Sorry❌\nလုံလောက်သောခွင့်ပြုချက်မရှိပါသဖြင့် Group Admin ကို ဆက်သွယ်ပါရှင့်🎋🍃");
    }

    await Welcome.findOneAndUpdate(
      { chatId: ctx.chat.id },
      { welcomeVideoId: null }
    );
    await ctx.reply("Welcome Video ကို ဖျက်လိုက်ပါပြီ။ ယခုမှစ၍ စာသားနှင့် အချက်အလက်များသာ ပြသပါမည်။");
  });

  // ----------------------------------------------------
  // /settouch - စာသားကို Reply ထောက်ပြီး ပြောင်းလဲခြင်း (Max: 2000 Chars)
  // ----------------------------------------------------
  bot.command('settouch', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply("❌Sorry❌\nလုံလောက်သောခွင့်ပြုချက်မရှိပါသဖြင့် Group Admin ကို ဆက်သွယ်ပါရှင့်🎋🍃");
    }

    const replyMsg = ctx.message.reply_to_message;
    
    // Reply ထောက်ထားသော စာသား သို့မဟုတ် Media Caption ကို ယူခြင်း
    const targetText = replyMsg ? (replyMsg.text || replyMsg.caption) : null;

    if (!targetText) {
      return ctx.reply("❌ ကျေးဇူးပြု၍ Welcome အဖြစ် သတ်မှတ်လိုသော စာသားကို Reply ထောက်ပြီး `/settouch` ဟု ရိုက်ပေးပါ။");
    }

    // စာလုံးရေ ၂၀၀၀ ထက် ကျော်လွန်ပါက တားဆီးခြင်း
    if (targetText.length > 2000) {
      return ctx.reply(`❌ စာသားသည် စာလုံးရေ ၂၀၀၀ ထက် မကျော်ရပါ (လက်ရှိစာလုံးရေ: ${targetText.length})။`);
    }

    await Welcome.findOneAndUpdate(
      { chatId: ctx.chat.id },
      { welcomeText: targetText, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    await ctx.reply(`✅ Welcome စာသားအသစ်ကို အောင်မြင်စွာ ပြောင်းလဲလိုက်ပါပြီ။\n(စာလုံးရေ: ${targetText.length}/2000)`);
  });

  // /deltouch - Custom စာသား ဖျက်ပြီး မူလ စာသားအတိုင်း ပြန်ထားခြင်း
  bot.command('deltouch', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply("❌Sorry❌\nလုံလောက်သောခွင့်ပြုချက်မရှိပါသဖြင့် Group Admin ကို ဆက်သွယ်ပါရှင့်🎋🍃");
    }

    await Welcome.findOneAndUpdate(
      { chatId: ctx.chat.id },
      { welcomeText: null }
    );
    await ctx.reply("Welcome စာသားကို မူလ ပုံသေ စာသားအတိုင်း ပြန်လည် ပြင်ဆင်လိုက်ပါပြီ။");
  });

  // /addbutton - Dynamic Inline Button အသစ်ထည့်ခြင်း (အများဆုံး ၅ ခု)
  bot.command('addbutton', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply("❌Sorry❌\nလုံလောက်သောခွင့်ပြုချက်မရှိပါသဖြင့် Group Admin ကို ဆက်သွယ်ပါရှင့်🎋🍃");
    }

    const args = ctx.message.text.split(" ").slice(1);
    if (args.length < 2) {
      return ctx.reply("❌ ပုံစံ မှားယွင်းနေပါသည်။\n\nအသုံးပြုနည်း: `/addbutton [ခလုတ်အမည်] [Link]`\nဥပမာ: `/addbutton Channel https://t.me/BOTUAPTE`");
    }

    const btnText = args[0];
    const btnUrl = args[1];

    if (!btnUrl.startsWith('http://') && !btnUrl.startsWith('https://')) {
      return ctx.reply("❌ Link သည် `http://` သို့မဟုတ် `https://` ဖြင့် စတင်ရပါမည်။");
    }

    let config = await Welcome.findOne({ chatId: ctx.chat.id });
    if (!config) {
      config = new Welcome({ chatId: ctx.chat.id, customButtons: [] });
    }

    if (config.customButtons && config.customButtons.length >= 5) {
      return ctx.reply("⚠️ Custom Button အများဆုံး ၅ ခုသာ ထည့်သွင်းခွင့် ရှိပါသည်။\nအသစ်ထည့်လိုပါက အရင် `/delbuttons` ဖြင့် ဖျက်ပေးပါ။");
    }

    config.customButtons.push({ text: btnText, url: btnUrl });
    await config.save();

    await ctx.reply(`✅ Inline Button ကို အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။\n**Name:** ${btnText}\n**URL:** ${btnUrl}`);
  });

  // /delbuttons - Button များ ပြန်ဖျက်ခြင်း
  bot.command('delbuttons', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply("❌Sorry❌\nလုံလောက်သောခွင့်ပြုချက်မရှိပါသဖြင့် Group Admin ကို ဆက်သွယ်ပါရှင့်🎋🍃");
    }

    await Welcome.findOneAndUpdate(
      { chatId: ctx.chat.id },
      { customButtons: [] }
    );
    await ctx.reply("သတ်မှတ်ထားသော Custom Inline Buttons အားလုံးကို ဖျက်လိုက်ပါပြီ။");
  });

  // new_chat_members - ကြိုဆိုခြင်း
  bot.on('message:new_chat_members', async (ctx) => {
    const newMembers = ctx.message.new_chat_members;
    const config = await Welcome.findOne({ chatId: ctx.chat.id });

    const topText = (config && config.welcomeText) ? config.welcomeText : DEFAULT_WELCOME_TEXT;

    for (const member of newMembers) {
      if (member.is_bot) continue;

      let userBio = "မရှိပါ";
      try {
        const fullUser = await ctx.api.getChat(member.id);
        if (fullUser.bio) userBio = fullUser.bio;
      } catch (err) {
        userBio = "မရှိပါ";
      }

      const name = [member.first_name, member.last_name].filter(Boolean).join(" ");
      const username = member.username ? `@${member.username}` : "မရှိပါ";

      const captionText = 
`${topText}

🚨---လူသစ်အချက်အလက်---🚨
Name🎋- ${name}
Id🌾     - ${member.id}
@user🍃- ${username}
Bio🌷 - ${userBio}`;

      const keyboard = new InlineKeyboard();

      if (config && config.customButtons && config.customButtons.length > 0) {
        config.customButtons.slice(0, 5).forEach(btn => {
          keyboard.url(btn.text, btn.url).row();
        });
      }

      keyboard.text("❌DTear❌", "delete_welcome_msg");

      if (config && config.welcomeVideoId) {
        await ctx.replyWithVideo(config.welcomeVideoId, {
          caption: captionText,
          reply_markup: keyboard
        });
      } else {
        await ctx.reply(captionText, {
          reply_markup: keyboard
        });
      }
    }
  });

  // Callback Query - Message Delete
  bot.callbackQuery('delete_welcome_msg', async (ctx) => {
    try {
      await ctx.deleteMessage();
      await ctx.answerCallbackQuery({ text: "ကြိုဆိုစာကို ဖျက်လိုက်ပါပြီ။" });
    } catch (err) {
      await ctx.answerCallbackQuery({ text: "ဖျက်၍ မရပါ (သို့မဟုတ်) စာသားဟောင်းနေပါပြီ။" });
    }
  });
}

module.exports = setupWelcomeModule;
