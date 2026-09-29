const { InlineKeyboard } = require('grammy');
const Leave = require('./leaveSchema');

// Admin ဟုတ်မဟုတ် စစ်ဆေးပေးသည့် Function
async function isAdmin(ctx) {
  if (!ctx.chat || ctx.chat.type === 'private') return true;
  try {
    const member = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
    return ['administrator', 'creator'].includes(member.status);
  } catch (err) {
    return false;
  }
}

// လင့်ခ် ပါမပါ စစ်ဆေးသည့် Regex pattern
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|t\.me\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i;

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

  // 1. /Levideo (Leave Video သတ်မှတ်ခြင်း)
  bot.command('Levideo', async (ctx) => {
    try {
      if (!(await isAdmin(ctx))) return ctx.reply(ADMIN_DENY_LEAVE);

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
    } catch (err) {
      console.error("Levideo error:", err);
    }
  });

  // 2. /DLevideo (Leave Video ဖျက်ခြင်း)
  bot.command('DLevideo', async (ctx) => {
    try {
      if (!(await isAdmin(ctx))) return ctx.reply(ADMIN_DENY_LEAVE);

      await Leave.findOneAndUpdate({ chatId: ctx.chat.id }, { leaveVideoId: null });
      await ctx.reply("Leave Video ကို ဖျက်လိုက်ပါပြီ။ ယခုမှစ၍ စာသားနှင့် အချက်အလက်များသာ ပြသပါမည်။");
    } catch (err) {
      console.error("DLevideo error:", err);
    }
  });

  // 3. /Levideogp (Leave Video ကြည့်ခြင်း)
  bot.command('Levideogp', async (ctx) => {
    try {
      if (!(await isAdmin(ctx))) return ctx.reply(ADMIN_DENY_LEAVE);

      const config = await Leave.findOne({ chatId: ctx.chat.id });
      if (config && config.leaveVideoId) {
        await ctx.replyWithVideo(config.leaveVideoId, { caption: "လက်ရှိ သတ်မှတ်ထားသော Leave Video ဖြစ်ပါတယ်။" });
      } else {
        await ctx.reply("ဒီ Group မှာ Leave Video သတ်မှတ်ထားခြင်း မရှိသေးပါ။");
      }
    } catch (err) {
      console.error("Levideogp error:", err);
    }
  });

  // 4. /setltouch - Leave စာသား ပြောင်းလဲခြင်း
  bot.command('setltouch', async (ctx) => {
    try {
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
    } catch (err) {
      console.error("setltouch error:", err);
    }
  });

  // 5. /deltouch - Custom Leave စာသား ဖျက်ခြင်း
  bot.command('deltouch', async (ctx) => {
    try {
      if (!(await isAdmin(ctx))) return ctx.reply(ADMIN_DENY_LEAVE);

      await Leave.findOneAndUpdate(
        { chatId: ctx.chat.id },
        { leaveText: null }
      );
      await ctx.reply("Leave စာသားကို မူလ ပုံသေ စာသားအတိုင်း ပြန်လည် ပြင်ဆင်လိုက်ပါပြီ။");
    } catch (err) {
      console.error("deltouch error:", err);
    }
  });

  // 6. /addlbutton - Custom Inline Button ထည့်ခြင်း
  bot.command('addlbutton', async (ctx) => {
    try {
      if (!(await isAdmin(ctx))) return ctx.reply(ADMIN_DENY_LEAVE);

      const text = ctx.message.text.replace('/addlbutton', '').trim();
      const lastSpaceIdx = text.lastIndexOf(' ');

      if (lastSpaceIdx === -1) {
        return ctx.reply("❌ ပုံစံ မှားယွင်းနေပါသည်။\n\nအသုံးပြုနည်း: `/addlbutton [ခလုတ်အမည်] [Link]`\nဥပမာ: `/addlbutton Join Channel https://t.me/BOTUAPTE`");
      }

      const btnText = text.substring(0, lastSpaceIdx).trim();
      const btnUrl = text.substring(lastSpaceIdx + 1).trim();

      if (!btnText || !btnUrl) {
        return ctx.reply("❌ ခလုတ်အမည် သို့မဟုတ် Link ထည့်ရန် ကျန်နေပါသည်။");
      }

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
    } catch (err) {
      console.error("addlbutton error:", err);
    }
  });

  // 7. /dellbuttons - Leave Button များ ဖျက်ခြင်း
  bot.command('dellbuttons', async (ctx) => {
    try {
      if (!(await isAdmin(ctx))) return ctx.reply(ADMIN_DENY_LEAVE);

      await Leave.findOneAndUpdate(
        { chatId: ctx.chat.id },
        { customButtons: [] }
      );
      await ctx.reply("သတ်မှတ်ထားသော Leave Custom Inline Buttons အားလုံးကို ဖျက်လိုက်ပါပြီ။");
    } catch (err) {
      console.error("dellbuttons error:", err);
    }
  });

  // 8. လူထွက်သွားပါက နှုတ်ဆက်ခြင်း စနစ်
  bot.on('message:left_chat_member', async (ctx) => {
    try {
      const member = ctx.message.left_chat_member;
      if (member.is_bot) return;

      const config = await Leave.findOne({ chatId: ctx.chat.id });
      const topText = (config && config.leaveText) ? config.leaveText : DEFAULT_LEAVE_TEXT;

      let rawBio = "";
      let hasLinkInBio = false;

      try {
        const fullUser = await ctx.api.getChat(member.id);
        if (fullUser && fullUser.bio) {
          rawBio = fullUser.bio;
          if (URL_REGEX.test(rawBio)) {
            hasLinkInBio = true;
          }
        }
      } catch (err) {
        rawBio = "";
      }

      // Bio ထဲ လင့်ခ်ပါပါက မပြဘဲ သတိပေးစာ ပြောင်းမည်
      let displayBio = "မရှိပါ";
      if (rawBio) {
        displayBio = hasLinkInBio ? "Bio တွင် လင့်ခ်ပါဝင်နေသဖြင့် မပြပါ" : rawBio;
      }

      const name = [member.first_name, member.last_name].filter(Boolean).join(" ");
      const username = member.username ? `@${member.username}` : "မရှိပါ";

      // Bio ထဲ လင့်ခ်ပါနေပါက သီးသန့် သတိပေးစာ ပို့ပြီး ၁ မိနစ်အကြာတွင် ဖျက်မည်
      if (hasLinkInBio) {
        const mentionUser = member.username ? `@${member.username}` : `[${name}](tg://user?id=${member.id})`;
        const warnMsgText = `⚠️ ${mentionUser} ရဲ့ Bio တွင် လင့်ခ်ပါဝင်နေပါသဖြင့် လင့်ခ် မချရပါနော်။`;
        
        ctx.reply(warnMsgText, { parse_mode: 'Markdown' }).then((warnSent) => {
          setTimeout(async () => {
            try {
              await ctx.api.deleteMessage(ctx.chat.id, warnSent.message_id);
            } catch (e) {}
          }, 60 * 1000); // ၁ မိနစ် (၆၀ စက္ကန့်)
        }).catch(() => {});
      }

      const leaveCaptionText =
`${topText}

🚨---ထွက်သွားသူအချက်အလက်---🚨
Name💔- ${name}
Id😰      - ${member.id}
@user😪- ${username}
Bio😭   - ${displayBio}`;

      const keyboard = new InlineKeyboard();

      // Custom Buttons ထည့်သွင်းခြင်း (အများဆုံး ၅ ခု)
      if (config && config.customButtons && config.customButtons.length > 0) {
        config.customButtons.slice(0, 5).forEach(btn => {
          keyboard.url(btn.text, btn.url).row();
        });
      }

      // ဖျက်သည့် ခလုတ်
      keyboard.text("❌Lvideo❌", "delete_leave_msg");

      let sentMsg;
      if (config && config.leaveVideoId) {
        sentMsg = await ctx.replyWithVideo(config.leaveVideoId, { caption: leaveCaptionText, reply_markup: keyboard });
      } else {
        sentMsg = await ctx.reply(leaveCaptionText, { reply_markup: keyboard });
      }

      // ၁ နာရီပြည့်လျှင် Leave Message အလိုအလျောက် ပျက်မည်
      if (sentMsg) {
        const ONE_HOUR = 60 * 60 * 1000;
        setTimeout(async () => {
          try {
            await ctx.api.deleteMessage(ctx.chat.id, sentMsg.message_id);
          } catch (delErr) {}
        }, ONE_HOUR);
      }

    } catch (sendErr) {
      console.error("Leave message send error:", sendErr.message);
    }
  });

  // 9. ❌Lvideo❌ ခလုတ်နှိပ်ပါက ဖျက်ပေးခြင်း
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
