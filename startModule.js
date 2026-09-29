const { InlineKeyboard } = require('grammy');
const StartConfig = require('./startSchema'); // သင့် Schema လမ်းကြောင်းအတိုင်း မှန်မမှန် စစ်ပါ

// Owner ID စစ်ဆေးရန် Helper
function isOwner(ctx, ownerId) {
  return ctx.from && Number(ctx.from.id) === Number(ownerId);
}

function setupStartModule(bot, OWNER_ID) {

  // ----------------------------------------------------
  // ၁. Admin / Owner Commands များ
  // ----------------------------------------------------

  // Video သတ်မှတ်ခြင်း / ဖျက်ခြင်း / ကြည့်ခြင်း
  bot.command('setstvideo', async (ctx) => {
    try {
      if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် ဤ Command ကို အသုံးပြုနိုင်ပါသည်။");
      
      const replyMsg = ctx.message.reply_to_message;
      if (!replyMsg || !replyMsg.video) {
        return ctx.reply("❌ ကျေးဇူးပြု၍ Start Video အဖြစ် သတ်မှတ်လိုသော Video ကို Reply ထောက်ပြီး `/setstvideo` ဟု ရိုက်ပေးပါ။");
      }

      await StartConfig.findOneAndUpdate({}, { videoId: replyMsg.video.file_id }, { upsert: true, new: true });
      await ctx.reply("✅ Start Video ကို အောင်မြင်စွာ သတ်မှတ်လိုက်ပါပြီ။");
    } catch (err) {
      console.error("setstvideo Error:", err);
      ctx.reply("❌ Video သတ်မှတ်ရာတွင် Error ဖြစ်ပေါ်ခဲ့ပါသည်။");
    }
  });

  bot.command('delstvideo', async (ctx) => {
    try {
      if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် ဤ Command ကို အသုံးပြုနိုင်ပါသည်။");
      await StartConfig.findOneAndUpdate({}, { videoId: null });
      await ctx.reply("✅ Start Video ကို ဖျက်လိုက်ပါပြီ။");
    } catch (err) {
      ctx.reply("❌ Video ဖျက်ရာတွင် Error ဖြစ်ပေါ်ခဲ့ပါသည်။");
    }
  });

  bot.command('viewstvideo', async (ctx) => {
    try {
      const config = await StartConfig.findOne();
      if (config && config.videoId) {
        await ctx.replyWithVideo(config.videoId, { caption: "🎬 လက်ရှိ သတ်မှတ်ထားသော Start Video ဖြစ်ပါသည်။" });
      } else {
        await ctx.reply("⚠️ Start Video သတ်မှတ်ထားခြင်း မရှိသေးပါ။");
      }
    } catch (err) {
      ctx.reply("❌ Video ကြည့်ရှုရာတွင် Error ဖြစ်ပေါ်ခဲ့ပါသည်။");
    }
  });

  // အပေါ်စာသား သတ်မှတ်ခြင်း / ဖျက်ခြင်း / ကြည့်ခြင်း
  bot.command('settoptext', async (ctx) => {
    try {
      if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် ဤ Command ကို အသုံးပြုနိုင်ပါသည်။");
      const replyMsg = ctx.message.reply_to_message;
      const text = replyMsg ? (replyMsg.text || replyMsg.caption) : null;

      if (!text) return ctx.reply("❌ စာသားကို Reply ထောက်ပြီး `/settoptext` ဟု ရိုက်ပေးပါ။");
      if (text.length > 2000) return ctx.reply(`❌ စာသားသည် စာလုံးရေ ၂၀၀၀ ထက် မကျော်ရပါ (လက်ရှိ: ${text.length})။`);

      await StartConfig.findOneAndUpdate({}, { topText: text }, { upsert: true, new: true });
      await ctx.reply(`✅ အပေါ်စာသားကို သတ်မှတ်လိုက်ပါပြီ။ (စာလုံးရေ: ${text.length}/2000)`);
    } catch (err) {
      ctx.reply("❌ အပေါ်စာသား သတ်မှတ်ရာတွင် Error ဖြစ်ပေါ်ခဲ့ပါသည်။");
    }
  });

  bot.command('deltoptext', async (ctx) => {
    try {
      if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် ဤ Command ကို အသုံးပြုနိုင်ပါသည်။");
      await StartConfig.findOneAndUpdate({}, { topText: null });
      await ctx.reply("✅ အပေါ်စာသားကို ဖျက်လိုက်ပါပြီ။");
    } catch (err) {
      ctx.reply("❌ အပေါ်စာသား ဖျက်ရာတွင် Error ဖြစ်ပေါ်ခဲ့ပါသည်။");
    }
  });

  bot.command('viewtoptext', async (ctx) => {
    try {
      const config = await StartConfig.findOne();
      if (config && config.topText) {
        await ctx.reply(`📝 လက်ရှိ အပေါ်စာသား:\n\n${config.topText}`);
      } else {
        await ctx.reply("⚠️ အပေါ်စာသား သတ်မှတ်ထားခြင်း မရှိသေးပါ။");
      }
    } catch (err) {
      ctx.reply("❌ အပေါ်စာသား ကြည့်ရှုရာတွင် Error ဖြစ်ပေါ်ခဲ့ပါသည်။");
    }
  });

  // အောက်စာသား သတ်မှတ်ခြင်း / ဖျက်ခြင်း / ကြည့်ခြင်း
  bot.command('setbottomtext', async (ctx) => {
    try {
      if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် ဤ Command ကို အသုံးပြုနိုင်ပါသည်။");
      const replyMsg = ctx.message.reply_to_message;
      const text = replyMsg ? (replyMsg.text || replyMsg.caption) : null;

      if (!text) return ctx.reply("❌ စာသားကို Reply ထောက်ပြီး `/setbottomtext` ဟု ရိုက်ပေးပါ။");
      if (text.length > 5000) return ctx.reply(`❌ စာသားသည် စာလုံးရေ ၅၀၀၀ ထက် မကျော်ရပါ (လက်ရှိ: ${text.length})။`);

      await StartConfig.findOneAndUpdate({}, { bottomText: text }, { upsert: true, new: true });
      await ctx.reply(`✅ အောက်စာသားကို သတ်မှတ်လိုက်ပါပြီ။ (စာလုံးရေ: ${text.length}/5000)`);
    } catch (err) {
      ctx.reply("❌ အောက်စာသား သတ်မှတ်ရာတွင် Error ဖြစ်ပေါ်ခဲ့ပါသည်။");
    }
  });

  bot.command('delbottomtext', async (ctx) => {
    try {
      if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် ဤ Command ကို အသုံးပြုနိုင်ပါသည်။");
      await StartConfig.findOneAndUpdate({}, { bottomText: null });
      await ctx.reply("✅ အောက်စာသားကို ဖျက်လိုက်ပါပြီ။");
    } catch (err) {
      ctx.reply("❌ အောက်စာသား ဖျက်ရာတွင် Error ဖြစ်ပေါ်ခဲ့ပါသည်။");
    }
  });

  bot.command('viewbottomtext', async (ctx) => {
    try {
      const config = await StartConfig.findOne();
      if (config && config.bottomText) {
        await ctx.reply(`📝 လက်ရှိ အောက်စာသား:\n\n${config.bottomText}`);
      } else {
        await ctx.reply("⚠️ အောက်စာသား သတ်မှတ်ထားခြင်း မရှိသေးပါ။");
      }
    } catch (err) {
      ctx.reply("❌ အောက်စာသား ကြည့်ရှုရာတွင် Error ဖြစ်ပေါ်ခဲ့ပါသည်။");
    }
  });

  // Buttons ထည့်ခြင်း / ဖျက်ခြင်း
  bot.command('addstbutton', async (ctx) => {
    try {
      if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် ဤ Command ကို အသုံးပြုနိုင်ပါသည်။");
      const args = ctx.message.text.split(" ").slice(1);
      if (args.length < 2) {
        return ctx.reply("❌ အသုံးပြုနည်း: `/addstbutton [ခလုတ်အမည်] [Link]`\nဥပမာ: `/addstbutton Channel https://t.me/xx`");
      }

      const btnText = args[0];
      const btnUrl = args[1];

      if (!btnUrl.startsWith('http://') && !btnUrl.startsWith('https://')) {
        return ctx.reply("❌ Link သည် `http://` သို့မဟုတ် `https://` ဖြင့် စတင်ရပါမည်။");
      }

      let config = await StartConfig.findOne();
      if (!config) config = new StartConfig();

      if (!config.buttons) config.buttons = [];
      if (config.buttons.length >= 20) {
        return ctx.reply("⚠️ Start Buttons အများဆုံး ၂၀ ခုသာ ထည့်သွင်းခွင့် ရှိပါသည်။");
      }

      config.buttons.push({ text: btnText, url: btnUrl });
      await config.save();
      await ctx.reply(`✅ Button ကို ထည့်သွင်းပြီးပါပြီ။ (${config.buttons.length}/20)`);
    } catch (err) {
      console.error("addstbutton Error:", err);
      ctx.reply("❌ Button ထည့်သွင်းရာတွင် Error ဖြစ်ပေါ်ခဲ့ပါသည်။");
    }
  });

  bot.command('delstbuttons', async (ctx) => {
    try {
      if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် ဤ Command ကို အသုံးပြုနိုင်ပါသည်။");
      await StartConfig.findOneAndUpdate({}, { buttons: [] });
      await ctx.reply("✅ Start Buttons အားလုံးကို ဖျက်လိုက်ပါပြီ။");
    } catch (err) {
      ctx.reply("❌ Buttons များ ဖျက်ရာတွင် Error ဖြစ်ပေါ်ခဲ့ပါသည်။");
    }
  });

  // ----------------------------------------------------
  // ၂. /start Command မောင်းနှင်သည့် အပိုင်း
  // ----------------------------------------------------
  bot.command('start', async (ctx) => {
    try {
      const config = await StartConfig.findOne();

      // သုံးစွဲသူ အချက်အလက်များ ရယူခြင်း
      const user = ctx.from;
      if (!user) return;

      const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
      const userId = user.id;
      const username = user.username ? `@${user.username}` : "မရှိပါ";
      
      let bio = "မရှိပါ";
      try {
        const fullChat = await ctx.api.getChat(userId);
        if (fullChat && fullChat.bio) bio = fullChat.bio;
      } catch (err) {
        // Bio ယူမရပါက လစ်လျူရှုမည်
      }

      // စာသား တည်ဆောက်ခြင်း
      let fullCaption = "";

      if (config && config.topText) {
        fullCaption += `${config.topText}\n\n`;
      }

      fullCaption += 
`🚨--- သုံးစွဲသူ အချက်အလက် ---🚨
👤 အမည် - ${name}
🆔 ID    - ${userId}
🌐 @user - ${username}
📝 Bio   - ${bio}\n\n`;

      if (config && config.bottomText) {
        fullCaption += `${config.bottomText}`;
      }

      // Inline Keyboards ပြင်ဆင်ခြင်း
      const keyboard = new InlineKeyboard();
      if (config && config.buttons && config.buttons.length > 0) {
        config.buttons.slice(0, 20).forEach((btn, index) => {
          keyboard.url(btn.text, btn.url);
          if ((index + 1) % 2 === 0) keyboard.row();
        });
      }

      // Video ရှိပါက Video ဖြင့် ပို့မည်၊ မရှိပါက စာသားသက်သက် ပို့မည်
      if (config && config.videoId) {
        await ctx.replyWithVideo(config.videoId, {
          caption: fullCaption,
          reply_markup: keyboard
        });
      } else {
        await ctx.reply(fullCaption, {
          reply_markup: keyboard
        });
      }

    } catch (err) {
      console.error("Error in /start command:", err);
      ctx.reply("❌ /start လုပ်ဆောင်ရာတွင် Error တစ်ခု ဖြစ်ပေါ်သွားပါသည်။");
    }
  });
}

module.exports = setupStartModule;
