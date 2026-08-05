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

function setupWelcomeModule(bot) {
  // /wevideo - Video Reply ထောက်ပြီး သတ်မှတ်ခြင်း
  bot.command('wevideo', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply("❌Sorry❌\nလုံလောက်သော်ခွင့်ပြုချက်လေးမရှိပါသဖြင့်။Gp adminကိုဆက်သွယ်ပါရှင့်🎋🍃");
    }

    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) {
      return ctx.reply("ကျေးဇူးပြု၍ Welcome သတ်မှတ်လိုသော Video ကို Reply ထောက်ပြီး /wevideo ဟု ရိုက်ပေးပါ။");
    }
const videoId = replyMsg.video.file_id;
    await Welcome.findOneAndUpdate(
      { chatId: ctx.chat.id },
      { welcomeVideoId: videoId, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    await ctx.reply("Welcome Video ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။");
  });

  // /Dwevideo - Welcome Video ဖျက်ခြင်း
  bot.command('Dwevideo', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply("❌Sorry❌\nလုံလောက်သော်ခွင့်ပြုချက်လေးမရှိပါသဖြင့်။Gp adminကိုဆက်သွယ်ပါရှင့်🎋🍃");
    }

    await Welcome.findOneAndUpdate(
      { chatId: ctx.chat.id },
      { welcomeVideoId: null }
    );
await ctx.reply("Welcome Video ကို ဖျက်လိုက်ပါပြီ။ ယခုမှစ၍ စာသားနှင့် အချက်အလက်များသာ ပြသပါမည်။");
  });

  // /wevideogp - လက်ရှိ Video စစ်ဆေးခြင်း
  bot.command('wevideogp', async (ctx) => {
    if (!(await isAdmin(ctx))) {
      return ctx.reply("❌Sorry❌\nလုံလောက်သော်ခွင့်ပြုချက်လေးမရှိပါသဖြင့်။Gp adminကိုဆက်သွယ်ပါရှင့်🎋🍃");
    }

    const config = await Welcome.findOne({ chatId: ctx.chat.id });
    if (config && config.welcomeVideoId) {
      await ctx.replyWithVideo(config.welcomeVideoId, {
        caption: "လက်ရှိ သတ်မှတ်ထားသော Welcome Video ဖြစ်ပါတယ်။"
      });
    } else {
      await ctx.reply("ဒီ Group မှာ Welcome Video သတ်မှတ်ထားခြင်း မရှိသေးပါ။");
    }
  });
// လူဝင်လာပါက ကြိုဆိုခြင်း
  bot.on('message:new_chat_members', async (ctx) => {
    const newMembers = ctx.message.new_chat_members;
    const config = await Welcome.findOne({ chatId: ctx.chat.id });

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
`နွေကိုချစ်ရင်
ပူလောင်ရတယ်🍃
အချစ်စစ်ကိုရှာတော့🍁
အတုအယောင်နဲတိုးတယ်🎋
ဝင်လာခဲ့ တီမှာတော့အတုအယောင်🌾
မဟုတ်ပါဘူး🤪🤪

🚨---လူသစ်အချက်အလက်---🚨
Name🎋- ${name}
Id🌾     - ${member.id}
@user🍃- ${username}
Bio🌷 - ${userBio}`;

      const keyboard = new InlineKeyboard().text("❌DTear❌", "delete_welcome_msg");
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

  // ❌DTear❌ ခလုပ်နှိပ်ပါက ဖျက်ခြင်း
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
