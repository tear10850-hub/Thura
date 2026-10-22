const { InlineKeyboard } = require('grammy');
const Welcome = require('./welcomeSchema');

async function isAdmin(ctx) {
  if (!ctx.chat || ctx.chat.type === 'private') return true;
  try {
    const member = await ctx.api.getChatMember(ctx.chat.id, ctx.from.id);
    return ['administrator', 'creator'].includes(member.status);
  } catch (err) {
    return false;
  }
}

// Bio ထဲတွင် https ဖြင့်စသော လင့်ခ်ပါမပါ စစ်ဆေးသည့် Regex
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|t\.me\/[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i;

// မူလ ပုံသေ စာသား
const DEFAULT_WELCOME_TEXT = 
`နွေကိုချစ်ရင်
ပူလောင်ရတယ်🍃
အချစ်စစ်ကိုရှာတော့🍁
အတုအယောင်နဲတိုးတယ်🎋
ဝင်လာခဲ့ တီမှာတော့အတုအယောင်🌾
မဟုတ်ပါဘူး🤪🤪`;

function setupWelcomeModule(bot) {
  // /wevideo - Video သတ်မှတ်ခြင်း (ပုံရှိနေရင် ပုံကို အလိုအလျောက်ဖျက်မည်)
  bot.command('wevideo', async (ctx) => {
    try {
      if (!(await isAdmin(ctx))) {
        return ctx.reply("❌Sorry❌\nလုံလောက်သောခွင့်ပြုချက်မရှိပါသဖြင့် Group Admin ကို ဆက်သွယ်ပါရှင့်🎋🍃");
      }

      const replyMsg = ctx.message.reply_to_message;
      if (!replyMsg || !replyMsg.video) {
        return ctx.reply("ကျေးဇူးပြု၍ Welcome သတ်မှတ်လိုသော Video ကို Reply ထောက်ပြီး `/wevideo` ဟု ရိုက်ပေးပါ။");
      }

      const videoId = replyMsg.video.file_id;
      await Welcome.findOneAndUpdate(
        { chatId: ctx.chat.id },
        { welcomeVideoId: videoId, welcomePhotoId: null, updatedAt: new Date() },
        { upsert: true, new: true }
      );

      await ctx.reply("✅ Welcome Video ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။ (ပုံရှိပါက ဖျက်ပြီးပါပြီ)");
    } catch (err) {
      console.error("wevideo error:", err);
    }
  });

  // /Dwevideo - Video ဖျက်ခြင်း
  bot.command('Dwevideo', async (ctx) => {
    try {
      if (!(await isAdmin(ctx))) {
        return ctx.reply("❌Sorry❌\nလုံလောက်သောခွင့်ပြုချက်မရှိပါသဖြင့် Group Admin ကို ဆက်သွယ်ပါရှင့်🎋🍃");
      }

      await Welcome.findOneAndUpdate(
        { chatId: ctx.chat.id },
        { welcomeVideoId: null }
      );
      await ctx.reply("🗑️ Welcome Video ကို ဖျက်လိုက်ပါပြီ။");
    } catch (err) {
      console.error("Dwevideo error:", err);
    }
  });

  // /wephoto - ပုံ (Photo) သတ်မှတ်ခြင်း (ဗီဒီယိုရှိနေရင် ဗီဒီယိုကို အလိုအလျောက်ဖျက်မည်)
  bot.command('wephoto', async (ctx) => {
    try {
      if (!(await isAdmin(ctx))) {
        return ctx.reply("❌Sorry❌\nလုံလောက်သောခွင့်ပြုချက်မရှိပါသဖြင့် Group Admin ကို ဆက်သွယ်ပါရှင့်🎋🍃");
      }

      const replyMsg = ctx.message.reply_to_message;
      if (!replyMsg || !replyMsg.photo) {
        return ctx.reply("ကျေးဇူးပြု၍ Welcome သတ်မှတ်လိုသော ပုံ (Photo) ကို Reply ထောက်ပြီး `/wephoto` ဟု ရိုက်ပေးပါ။");
      }

      const photoId = replyMsg.photo[replyMsg.photo.length - 1].file_id;
      await Welcome.findOneAndUpdate(
        { chatId: ctx.chat.id },
        { welcomePhotoId: photoId, welcomeVideoId: null, updatedAt: new Date() },
        { upsert: true, new: true }
      );

      await ctx.reply("✅ Welcome Photo ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။ (ဗီဒီယိုရှိပါက ဖျက်ပြီးပါပြီ)");
    } catch (err) {
      console.error("wephoto error:", err);
    }
  });

  // /Dwephoto - ပုံ ဖျက်ခြင်း
  bot.command('Dwephoto', async (ctx) => {
    try {
      if (!(await isAdmin(ctx))) {
        return ctx.reply("❌Sorry❌\nလုံလောက်သောခွင့်ပြုချက်မရှိပါသဖြင့် Group Admin ကို ဆက်သွယ်ပါရှင့်🎋🍃");
      }

      await Welcome.findOneAndUpdate(
        { chatId: ctx.chat.id },
        { welcomePhotoId: null }
      );
      await ctx.reply("🗑️ Welcome Photo ကို ဖျက်လိုက်ပါပြီ။");
    } catch (err) {
      console.error("Dwephoto error:", err);
    }
  });

  // /settouch - Custom စာသား သတ်မှတ်ခြင်း
  bot.command('settouch', async (ctx) => {
    try {
      if (!(await isAdmin(ctx))) {
        return ctx.reply("❌Sorry❌\nလုံလောက်သောခွင့်ပြုချက်မရှိပါသဖြင့် Group Admin ကို ဆက်သွယ်ပါရှင့်🎋🍃");
      }

      const replyMsg = ctx.message.reply_to_message;
      const targetText = replyMsg ? (replyMsg.text || replyMsg.caption) : null;

      if (!targetText) {
        return ctx.reply("❌ ကျေးဇူးပြု၍ Welcome အဖြစ် သတ်မှတ်လိုသော စာသားကို Reply ထောက်ပြီး `/settouch` ဟု ရိုက်ပေးပါ။");
      }

      if (targetText.length > 2000) {
        return ctx.reply(`❌ စာသားသည် စာလုံးရေ ၂၀၀၀ ထက် မကျော်ရပါ (လက်ရှိစာလုံးရေ: ${targetText.length})။`);
      }

      await Welcome.findOneAndUpdate(
        { chatId: ctx.chat.id },
        { welcomeText: targetText, updatedAt: new Date() },
        { upsert: true, new: true }
      );

      await ctx.reply(`✅ Welcome စာသားအသစ်ကို အောင်မြင်စွာ ပြောင်းလဲလိုက်ပါပြီ။`);
    } catch (err) {
      console.error("settouch error:", err);
    }
  });

  // /deltouch - Custom စာသား ဖျက်ခြင်း
  bot.command('deltouch', async (ctx) => {
    try {
      if (!(await isAdmin(ctx))) {
        return ctx.reply("❌Sorry❌\nလုံလောက်သောခွင့်ပြုချက်မရှိပါသဖြင့် Group Admin ကို ဆက်သွယ်ပါရှင့်🎋🍃");
      }

      await Welcome.findOneAndUpdate(
        { chatId: ctx.chat.id },
        { welcomeText: null }
      );
      await ctx.reply("✅ Welcome စာသားကို မူလ ပုံသေ စာသားအတိုင်း ပြန်လည် ပြင်ဆင်လိုက်ပါပြီ။");
    } catch (err) {
      console.error("deltouch error:", err);
    }
  });

  // /addbutton - Custom Button ထည့်ခြင်း
  bot.command('addbutton', async (ctx) => {
    try {
      if (!(await isAdmin(ctx))) {
        return ctx.reply("❌Sorry❌\nလုံလောက်သောခွင့်ပြုချက်မရှိပါသဖြင့် Group Admin ကို ဆက်သွယ်ပါရှင့်🎋🍃");
      }

      const text = ctx.message.text.replace('/addbutton', '').trim();
      const lastSpaceIdx = text.lastIndexOf(' ');
      
      if (lastSpaceIdx === -1) {
        return ctx.reply("❌ ပုံစံ မှားယွင်းနေပါသည်။\n\nအသုံးပြုနည်း: `/addbutton [ခလုတ်အမည်] [Link]`");
      }

      const btnText = text.substring(0, lastSpaceIdx).trim();
      const btnUrl = text.substring(lastSpaceIdx + 1).trim();

      let config = await Welcome.findOne({ chatId: ctx.chat.id });
      if (!config) {
        config = new Welcome({ chatId: ctx.chat.id, customButtons: [] });
      }

      if (config.customButtons && config.customButtons.length >= 5) {
        return ctx.reply("⚠️ Custom Button အများဆုံး ၅ ခုသာ ထည့်သွင်းခွင့် ရှိပါသည်။");
      }

      config.customButtons.push({ text: btnText, url: btnUrl });
      await config.save();

      await ctx.reply(`✅ Inline Button ကို အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။`);
    } catch (err) {
      console.error("addbutton error:", err);
    }
  });

  // /delbuttons - Custom Button များ ဖျက်ခြင်း
  bot.command('delbuttons', async (ctx) => {
    try {
      if (!(await isAdmin(ctx))) {
        return ctx.reply("❌Sorry❌\nလုံလောက်သောခွင့်ပြုချက်မရှိပါသဖြင့် Group Admin ကို ဆက်သွယ်ပါရှင့်🎋🍃");
      }

      await Welcome.findOneAndUpdate(
        { chatId: ctx.chat.id },
        { customButtons: [] }
      );
      await ctx.reply("🗑️ Custom Inline Buttons အားလုံးကို ဖျက်လိုက်ပါပြီ။");
    } catch (err) {
      console.error("delbuttons error:", err);
    }
  });

  // new_chat_members - ကြိုဆိုခြင်း စနစ်
  bot.on('message:new_chat_members', async (ctx) => {
    try {
      const newMembers = ctx.message.new_chat_members;
      const config = await Welcome.findOne({ chatId: ctx.chat.id });

      const topText = (config && config.welcomeText) ? config.welcomeText : DEFAULT_WELCOME_TEXT;

      for (const member of newMembers) {
        if (member.is_bot) continue;

        let displayBio = "မရှိပါ";
        let hasLinkInBio = false;

        // 🛡️ Bio ဆွဲထုတ်ရာတွင် Error တက်ပါက (သို့မဟုတ်) Bio မရှိပါက ဆက်သွားရန် try...catch သီးသန့်ခံထားသည်
        try {
          const fullUser = await ctx.api.getChat(member.id);
          if (fullUser && fullUser.bio) {
            const rawBio = fullUser.bio;
            if (URL_REGEX.test(rawBio)) {
              hasLinkInBio = true;
              displayBio = "Bio တွင် လင့်ခ်ပါဝင်နေသဖြင့် မပြပါ";
            } else {
              displayBio = rawBio;
            }
          }
        } catch (err) {
          // Bio ရယူ၍မရပါက ကျော်သွားပြီး "မရှိပါ" ဟုသာ ပြမည် (Welcome ပို့ခြင်းကို မရပ်တန့်စေရန်)
          displayBio = "မရှိပါ";
        }

        const name = [member.first_name, member.last_name].filter(Boolean).join(" ");
        const username = member.username ? `@${member.username}` : "မရှိပါ";

        if (hasLinkInBio) {
          const mentionUser = member.username ? `@${member.username}` : `[${name}](tg://user?id=${member.id})`;
          const warnMsgText = `⚠️ ${mentionUser} ရဲ့ Bio တွင် လင့်ခ်ပါဝင်နေပါသဖြင့် လင့်ခ် မချရပါနော်။`;
          
          ctx.reply(warnMsgText, { parse_mode: 'Markdown' }).then((warnSent) => {
            setTimeout(async () => {
              try {
                await ctx.api.deleteMessage(ctx.chat.id, warnSent.message_id);
              } catch (e) {}
            }, 60 * 1000);
          }).catch(() => {});
        }

        const captionText = 
`${topText}

🚨---လူသစ်အချက်အလက်---🚨
Name🎋- ${name}
Id🌾     - ${member.id}
@user🍃- ${username}
Bio🌷 - ${displayBio}`;

        const keyboard = new InlineKeyboard();

        if (config && config.customButtons && config.customButtons.length > 0) {
          config.customButtons.slice(0, 5).forEach(btn => {
            keyboard.url(btn.text, btn.url).row();
          });
        }

        keyboard.text("👑 Admin Profile 👑", "apf_page_0").row();
        keyboard.text("❌DTear❌", "delete_welcome_msg");

        let sentMsg;
        // ဗီဒီယို ရှိလျှင် ဗီဒီယိုနှင့်တကွ ပို့မည်
        if (config && config.welcomeVideoId) {
          sentMsg = await ctx.replyWithVideo(config.welcomeVideoId, {
            caption: captionText,
            reply_markup: keyboard
          });
        } 
        // ပုံ ရှိလျှင် ပုံနှင့်တကွ ပို့မည် (ဗီဒီယိုမရှိမှသာ)
        else if (config && config.welcomePhotoId) {
          sentMsg = await ctx.replyWithPhoto(config.welcomePhotoId, {
            caption: captionText,
            reply_markup: keyboard
          });
        } 
        // နှစ်ခုစလုံး မရှိလျှင် စာသားသပ်သပ် ပို့မည်
        else {
          sentMsg = await ctx.reply(captionText, {
            reply_markup: keyboard
          });
        }

        if (sentMsg) {
          const ONE_HOUR = 60 * 60 * 1000;
          setTimeout(async () => {
            try {
              await ctx.api.deleteMessage(ctx.chat.id, sentMsg.message_id);
            } catch (delErr) {}
          }, ONE_HOUR);
        }
      }
    } catch (sendErr) {
      console.error("Welcome message send error:", sendErr.message);
    }
  });

  // Callback Query - DTear Message Delete
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
