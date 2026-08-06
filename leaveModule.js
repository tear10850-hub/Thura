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

// မူလ ပုံသေ Leave စာသား
const DEFAULT_LEAVE_TEXT = 
`အချစ်ခံချင်ရုံပါ🥀🥀
အပစ်ခံရမယ်လို🥺
ဘယ်သူကထင်မှာလဲ😔
ချိုသာစွာလဲညာခဲ့ဖူးတယ်
ပြန်လာဖို့လဲမှာခဲ့ဖူးတယ်
ဒီလောက်ဆိုတော်ပီလေ
မုသားတွေလဲမချိုတော့ဘူး
လူကြားထဲလဲမငိုချင်တော့ဘူး😔💔`;

function setupLeaveModule(bot) {

  // 1. /Levideo (Leave Video သတ်မှတ်ခြင်း - လုံခြုံရေး စစ်ဆေးချက်ပါဝင်သည်)
  bot.command('Levideo', async (ctx) => {
    if (!(await isAdmin(ctx))) return ctx.reply(ADMIN_DENY_LEAVE);

    // Video ရှိပြီးသားလား စစ်ဆေးခြင်း
    const existingConfig = await Leave.findOne({ chatId: ctx.chat.id });
    if (existingConfig && existingConfig.leaveVideoId) {
      return ctx.reply("⚠️ **လုံခြုံရေး အသိပေးချက်** ⚠️\n\nLeave Video သတ်မှတ်ထားပြီးသား ဖြစ်ပါသည်။ Video အသစ် ထပ်မံ သတ်မှတ်လိုပါက အရင် `/DLevideo` ဖြင့် Video ဟောင်းကို ဖျက်ပေးပါရှင့်။");
    }

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

  // 4. /setltouch - Leave စာသားကို Reply ထောက်ပြီး ပြောင်းလဲခြင်း (Max: 2000 Chars)
  bot.command('setltouch', async (ctx) => {
    if (!(await isAdmin(ctx))) return ctx.reply(ADMIN_DENY_LEAVE);

    const replyMsg = ctx.message.reply_to_message;
    const targetText = replyMsg ? (replyMsg.text || replyMsg.caption) : null;

    if (!targetText) {
      return ctx.reply("❌ ကျေးဇူးပြု၍ Leave အဖြစ် သတ်မှတ်လိုသော စာသားကို Reply ထောက်ပြီး `/setltouch` ဟု ရိုက်ပေးပါ။");
    }

    if (targetText.length > 2000) {
      return ctx.reply(`❌ စာသားသည် စာလုံးရေ ၂၀၀၀ ထက် မကျော်ရပါ (လက်ရှိစာလုံးရေ: ${targetText.length})။`);
    }

    await Leave.findOneAndUpdate(
      { chatId: ctx.chat.id },
      { leaveText: targetText, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    await ctx.reply(`✅ Leave စာသားအသစ်ကို အောင်မြင်စွာ ပြောင်းလဲလိုက်ပါပြီ။\n(စာလုံးရေ: ${targetText.length}/2000)`);
  });

  // 5. /deltouch - Custom Leave စာသား ဖျက်ပြီး မူလ စာသားအတိုင်း ပြန်ထားခြင်း
  bot.command('deltouch', async (ctx) => {
    if (!(await isAdmin(ctx))) return ctx.reply(ADMIN_DENY_LEAVE);

    await Leave.findOneAndUpdate(
      { chatId: ctx.chat.id },
      { leaveText: null }
    );
    await ctx.reply("Leave စာသားကို မူလ ပုံသေ စာသားအတိုင်း ပြန်လည် ပြင်ဆင်လိုက်ပါပြီ။");
  });

  // 6. /addlbutton - Custom Inline Button အသစ်ထည့်ခြင်း (အများဆုံး ၅ ခု)
  bot.command('addlbutton', async (ctx) => {
    if (!(await isAdmin(ctx))) return ctx.reply(ADMIN_DENY_LEAVE);

    const args = ctx.message.text.split(" ").slice(1);
    if (args.length < 2) {
      return ctx.reply("❌ ပုံစံ မှားယွင်းနေပါသည်။\n\nအသုံးပြုနည်း: `/addlbutton [ခလုတ်အမည်] [Link]`\nဥပမာ: `/addlbutton Channel https://t.me/BOTUAPTE`");
    }

    const btnText = args[0];
    const btnUrl = args[1];

    if (!btnUrl.startsWith('http://') && !btnUrl.startsWith('https://')) {
      return ctx.reply("❌ Link သည် `http://` သို့မဟုတ် `https://` ဖြင့် စတင်ရပါမည်။");
    }

    let config = await Leave.findOne({ chatId: ctx.chat.id });
    if (!config) {
      config = new Leave({ chatId: ctx.chat.id, customButtons: [] });
    }

    if (config.customButtons && config.customButtons.length >= 5) {
      return ctx.reply("⚠️ Custom Button အများဆုံး ၅ ခုသာ ထည့်သွင်းခွင့် ရှိပါသည်။\nအသစ်ထည့်လိုပါက အရင် `/dellbuttons` ဖြင့် ဖျက်ပေးပါ။");
    }

    config.customButtons.push({ text: btnText, url: btnUrl });
    await config.save();

    await ctx.reply(`✅ Leave Inline Button ကို အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။\n**Name:** ${btnText}\n**URL:** ${btnUrl}`);
  });

  // 7. /dellbuttons - Leave Button များ ပြန်ဖျက်ခြင်း
  bot.command('dellbuttons', async (ctx) => {
    if (!(await isAdmin(ctx))) return ctx.reply(ADMIN_DENY_LEAVE);

    await Leave.findOneAndUpdate(
      { chatId: ctx.chat.id },
      { customButtons: [] }
    );
    await ctx.reply("သတ်မှတ်ထားသော Leave Custom Inline Buttons အားလုံးကို ဖျက်လိုက်ပါပြီ။");
  });

  // 8. လူထွက်သွားပါက နှုတ်ဆက်ခြင်း
  bot.on('message:left_chat_member', async (ctx) => {
    const member = ctx.message.left_chat_member;
    if (member.is_bot) return;

    const config = await Leave.findOne({ chatId: ctx.chat.id });
    const topText = (config && config.leaveText) ? config.leaveText : DEFAULT_LEAVE_TEXT;

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
`${topText}

🚨---ထွက်သွားသူအချက်အလက်---🚨
Name💔- ${name}
Id😰      - ${member.id}
@user😪- ${username}
Bio😭   - ${userBio}`;

    const keyboard = new InlineKeyboard();

    // Custom Buttons ထည့်သွင်းခြင်း (အများဆုံး ၅ ခု)
    if (config && config.customButtons && config.customButtons.length > 0) {
      config.customButtons.slice(0, 5).forEach(btn => {
        keyboard.url(btn.text, btn.url).row();
      });
    }

    // မူလဖျက်သည့် ခလုတ်
    keyboard.text("❌Lvideo❌", "delete_leave_msg");

    if (config && config.leaveVideoId) {
      await ctx.replyWithVideo(config.leaveVideoId, { caption: leaveCaptionText, reply_markup: keyboard });
    } else {
      await ctx.reply(leaveCaptionText, { reply_markup: keyboard });
    }
  });

  // 9. ❌Lvideo❌ ခလုပ်နှိပ်ပါက ဖျက်ပေးခြင်း
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
