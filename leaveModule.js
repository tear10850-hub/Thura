const { InlineKeyboard } = require('grammy');
const Leave = require('./leaveSchema');

// Admin ဟုတ်မဟုတ် စစ်ဆေးပေးသည့် Function
async function isAdmin(ctx) {
  if (ctx.chat.type === 'private') return true;
  try {
    const member = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
    return ['administrator', 'creator'].includes(member.status);
  } catch (err) {
    return false;
  }
}

// Admin မဟုတ်ပါက ပြသပေးမည့် ပုံသေ စာသား
const ADMIN_DENY_LEAVE = 
`ဝေးသွားပြီးမှ    ဘယ်ချိန်ရွတ်
"အလွတ်မှတ်မိနေတဲ့..
ဖုန်းနံပါတ်လေးခုတော့အဝင် ..😓
callမရှိတော့ဘူး🥀🥀
    သင်သည့်ခွင့်ပြုချက်မရှိသဖြင့်Gp adminကိုဆက်သွယ်ပါရှင့်😅😅`;

function setupLeaveModule(bot) {

// 1. /Levideo (Leave Video သတ်မှတ်ခြင်း)
  bot.command('Levideo', async (ctx) => {
    if (!(await isAdmin(ctx))) return ctx.reply(ADMIN_DENY_LEAVE);

    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.video) {
      return ctx.reply("ကျေးဇူးပြု၍ Leave သတ်မှတ်လိုသော Video ကို Reply ထောက်ပြီး /Levideo ဟု ရိုက်ပေးပါ။");
    }

    await Leave.findOneAndUpdate(
      { chatId: ctx.chat.id },
      { leaveVideoId: replyMsg.video.file_id, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    await ctx.reply("Leave Video ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။");
  });

// 2. /DLevideo (Leave Video ဖျက်ခြင်း)
  bot.command('DLevideo', async (ctx) => {
    if (!(await isAdmin(ctx))) return ctx.reply(ADMIN_DENY_LEAVE);

    await Leave.findOneAndUpdate({ chatId: ctx.chat.id }, { leaveVideoId: null });
    await ctx.reply("Leave Video ကို ဖျက်လိုက်ပါပြီ။ ယခုမှစ၍ စာသားနှင့် အချက်အလက်များသာ ပြသပါမည်။");
  });

  // 3. /Levideogp (Leave Video ကြည့်ခြင်း)
  bot.command('Levideogp', async (ctx) => {
    if (!(await isAdmin(ctx))) return ctx.reply(ADMIN_DENY_LEAVE);

    const config = await Leave.findOne({ chatId: ctx.chat.id });
    if (config && config.leaveVideoId) {
      await ctx.replyWithVideo(config.leaveVideoId, { caption: "လက်ရှိ သတ်မှတ်ထားသော Leave Video ဖြစ်ပါတယ်။" });
    } else {
      await ctx.reply("ဒီ Group မှာ Leave Video သတ်မှတ်ထားခြင်း မရှိသေးပါ။");
    }
  });

// 4. လူထွက်သွားပါက နှုတ်ဆက်ခြင်း
  bot.on('message:left_chat_member', async (ctx) => {
    const member = ctx.message.left_chat_member;
    if (member.is_bot) return;

    const config = await Leave.findOne({ chatId: ctx.chat.id });

    let userBio = "မရှိပါ";
    try {
      const fullUser = await ctx.api.getChat(member.id);
      if (fullUser.bio) userBio = fullUser.bio;
    } catch (err) {
      userBio = "မရှိပါ";
    }

    const name = [member.first_name, member.last_name].filter(Boolean).join(" ");
    const username = member.username ? `@${member.username}` : "မရှိပါ";

    const leaveCaptionText =
`အချစ်ခံချင်ရုံပါ🥀🥀
အပစ်ခံရမယ်လို🥺
ဘယ်သူကထင်မှာလဲ😔
ချိုသာစွာလဲညာခဲ့ဖူးတယ်
ပြန်လာဖို့လဲမှာခဲ့ဖူးတယ်
ဒီလောက်ဆိုတော်ပီလေ
မုသားတွေလဲမချိုတော့ဘူး
လူကြားထဲလဲမငိုချင်တော့ဘူး😔💔

🚨---ထွက်သွားသူအချက်အလက်---🚨
Name💔- ${name}
Id😰      - ${member.id}
@user😪- ${username}
Bio😭   - ${userBio}`;

    const keyboard = new InlineKeyboard().text("❌Lvideo❌", "delete_leave_msg");

    if (config && config.leaveVideoId) {
      await ctx.replyWithVideo(config.leaveVideoId, { caption: leaveCaptionText, reply_markup: keyboard });
    } else {
      await ctx.reply(leaveCaptionText, { reply_markup: keyboard });
    }
  });

  // 5. ❌Lvideo❌ ခလုပ်နှိပ်ပါက ဖျက်ပေးခြင်း
  bot.callbackQuery('delete_leave_msg', async (ctx) => {
    try {
      await ctx.deleteMessage();
      await ctx.answerCallbackQuery({ text: "ဖျက်လိုက်ပါပြီ။" });
    } catch (err) {
      await ctx.answerCallbackQuery({ text: "ဖျက်၍ မရပါ (သို့မဟုတ်) စာသားဟောင်းနေပါပြီ။" });
    }
  });
}

module.exports = setupLeaveModule;
