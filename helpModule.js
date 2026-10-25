const { InlineKeyboard } = require('grammy');
const HelpPage = require('./helpSchema');

function isOwner(ctx, ownerId) {
  return ctx.from && Number(ctx.from.id) === Number(ownerId);
}

function setupHelpModule(bot, OWNER_ID) {

  // ============================================================
  // 1. /help သို့မဟုတ် /HELP ပို့သည့်အခါ လမ်းညွန်မေတ္တာရပ်ခံချက်ပြရန်
  // ============================================================
  bot.command(['help', 'HELP', 'Help'], async (ctx) => {
    const helpMainText = 
`🚨<b>HELP</b>🚨<b>အသုံးပြုပုံလမ်းညွန်</b>

မဂ်လာပါရှင့် Relpစနစ်မှကြိုဆိုပါတယ်ရှင့်🌷 
/mamberhelp / Gpchhelp (လူတိုင်မြင်နိုင်သည်)  
/ownerhelp (ownerအသုံးပြုပုံမှာownerမဟုရင်ကြည့်မရပါရှင့်)🍃🍂`;

    const keyboard = new InlineKeyboard()
      .text("👥 Member Help", "cmd_mamberhelp")
      .text("🛡 Gp & Ch Help", "cmd_gpchhelp")
      .row()
      .text("👑 Owner Help", "cmd_ownerhelp");

    await ctx.reply(helpMainText, { parse_mode: 'HTML', reply_markup: keyboard });
  });

  // ============================================================
  // 2. /mamberhelp Command (ပုံ/ဗီဒီယို ထည့်/ကြည့်/ဖျက် စနစ်အပါအဝင်)
  // ============================================================
  const memberHelpContent = 
`👥 <b>MEMBER HELP COMMANDS</b>

/id - Chat အချက်အလက်များနှင့် ID ကြည့်ရန်
/aiopen - AI စနစ် ဖွင့်ရန်
/aioff - AI စနစ် ပိတ်ရန်
/ai - AI နှင့် စတင်စကားပြောရန်
/cpost - Channel သို့ တိုက်ရိုက်ပို့ရန် (ဥပမာ: /cpost @channel | စာ)
/cschedule - Channel သို့ အချိန်ဆိုင်း၍ ပို့ရန် (ဥပမာ: /cschedule @channel | 30s | စာ)
/keyvideo - ဝယ်ယူထားသော Premium Key ကို Private Chat တွင် စစ်ဆေးရန်
/catch - Group ထဲတွင် ပေါ်လာသော Gacha ကတ်ကို လုယူကောက်ရန်
/checkkey - ဆုကြေးထုတ်ယူရန် Secret Key ကို Channel တွင် Join ပြီးနောက် စစ်ဆေးရန်
/gift - မိမိပိုင်ဆိုင်သော ကတ်ကို အခြားသူထံသို့ လက်ဆောင်ပေးရန်
/mycards - မိမိပိုင်ဆိုင်သော ကတ်အိတ်နှင့် 🪙 Coins လက်ကျန်များကို ကြည့်ရှုရန်
/admin - Group ထဲရှိ Admin များကို အလှည့်ကျ Mentions ခေါ်ဆိုရန်
/adminpf - Group ထဲရှိ Admin များနှင့် Bot Profile များကို Card ဖြင့် ကြည့်ရှုရန်
/adminprofile - Admin Profile ကို Card ဖြင့် ကြည့်ရှုရန်
/1mv - လက်ရှိ သတ်မှတ်ထားသော ပထမအကြိမ် သတိပေး Video ကို ကြည့်ရှုရန်
/2mv - လက်ရှိ သတ်မှတ်ထားသော ဒုတိယအကြိမ် သတိပေး Video ကို ကြည့်ရှုရန်
/3mv - လက်ရှိ သတ်မှတ်ထားသော တတိယအကြိမ် Mute Video ကို ကြည့်ရှုရန်
/help - အကူအညီ စာမျက်နှာကြည့်ရန်
/viewhelp - သတ်မှတ်ထားသော Help စာမျက်နှာ ကြည့်ရန်`;

  bot.command('mamberhelp', async (ctx) => {
    const page = await HelpPage.findOne({ pageNumber: 999 }); 
    const keyboard = new InlineKeyboard().text("❌ ပိတ်မည် ❌", "delete_this_msg");

    if (page && page.mediaId) {
      if (page.mediaType === 'photo') {
        return await ctx.replyWithPhoto(page.mediaId, { caption: memberHelpContent, parse_mode: 'HTML', reply_markup: keyboard });
      } else if (page.mediaType === 'video') {
        return await ctx.replyWithVideo(page.mediaId, { caption: memberHelpContent, parse_mode: 'HTML', reply_markup: keyboard });
      }
    }
    await ctx.reply(memberHelpContent, { parse_mode: 'HTML', reply_markup: keyboard });
  });

  bot.command('setmambermedia', async (ctx) => {
    if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် အသုံးပြုနိုင်ပါသည်။");
    const replyMsg = ctx.message.reply_to_message;
    if (!replyMsg || (!replyMsg.photo && !replyMsg.video)) {
      return ctx.reply("❌ ကျေးဇူးပြု၍ Photo သို့မဟုတ် Video ကို Reply ထောက်ပြီး /setmambermedia ဟု ရိုက်ပါ။");
    }
    const mediaType = replyMsg.photo ? 'photo' : 'video';
    const mediaId = replyMsg.photo ? replyMsg.photo[replyMsg.photo.length - 1].file_id : replyMsg.video.file_id;

    await HelpPage.findOneAndUpdate({ pageNumber: 999 }, { mediaType, mediaId }, { upsert: true });
    await ctx.reply(`✅ Member Help ၏ ${mediaType} ကို အောင်မြင်စွာ ထည့်သွင်း/သတ်မှတ်လိုက်ပါပြီ။`);
  });

  bot.command('delmambermedia', async (ctx) => {
    if (!isOwner(ctx, OWNER_ID)) return ctx.reply("❌ Owner သာလျှင် အသုံးပြုနိုင်ပါသည်။");
    await HelpPage.findOneAndUpdate({ pageNumber: 999 }, { mediaType: null, mediaId: null });
    await ctx.reply("🗑 Member Help တွင် သတ်မှတ်ထားသော မီဒီယာကို ဖျက်လိုက်ပါပြီ။");
  });

  // ============================================================
  // 3. /Gpchhelp Command (Welcome & Leave commands ပါ ထည့်သွင်းပြီး)
  // ============================================================
  const gpChHelpContent = 
`🛡 <b>GP & CH HELP COMMANDS</b>

/gpopen - Group အတွက် Bot စနစ်ကို ပြန်လည်ဖွင့်ရန်
/gpclose - Group အတွက် Bot စနစ်ကို ပိတ်ထားရန်
/people - Group ထဲတွင် စာမပြောမီ စောင့်ရမည့် လူဦးရေ သတ်မှတ်ရန်
/replymode - Reply ထောက်ပြောသည့်စနစ် ဖွင့်/ပိတ် ရန်
/botchat - Bot စကားပြောတုံ့ပြန်မှုစနစ် ဖွင့်/ပိတ် ရန်
/autodel - အလိုအလျောက် စာဖျက်မည့်အချိန် သတ်မှတ်ရန်
/1mutevideo - ပထမအကြိမ် သတိပေး Video သတ်မှတ်ရန်
/D1mutevideo - ပထမအကြိမ် သတိပေး Video ဖျက်ရန်
/2mutevideo - ဒုတိယအကြိမ် သတိပေး Video သတ်မှတ်ရန်
/D2mutevideo - ဒုတိယအကြိမ် သတိပေး Video ဖျက်ရန်
/3mutevideo - တတိယအကြိမ် Mute Video သတ်မှတ်ရန်
/D3mutevideo - တတိယအကြိမ် Mute Video ဖျက်ရန်
/activatevideo - Premium Key ဖြင့် မိမိ Group တွင် Video စနစ်ကို အသက်သွင်းရန်
/promote - Group မန်ဘာတစ်ဦးအား Admin ခန့်အပ်ရန် (Reply ထောက်၍)
/demote - Group Admin တစ်ဦးအား ရာထူးမှ ဖြုတ်ရန် (Reply ထောက်၍)
/ban - Group မှ မန်ဘာတစ်ဦးအား ထာဝရ Ban ရန် (Reply ထောက်၍)
/mute - Group မန်ဘာတစ်ဦးအား စာပို့ခွင့် ယာယီပိတ်ရန် (Reply ထောက်၍)
/umute - Group မန်ဘာတစ်ဦးအား စာပို့ခွင့် ပြန်လွှတ်ပေးရန် (Reply ထောက်၍)
/tbot - Mute ဖြစ်နေသူအား ချက်ချင်း Unmute လုပ်ရန် (Reply ထောက်၍)
/bvideo - Ban မက်ဆေ့ချ်တွင် ပြမည့် Video သတ်မှတ်ရန်
/mvideo - Mute မက်ဆေ့ချ်တွင် ပြမည့် Video သတ်မှတ်ရန်
/uvideo - Unmute မက်ဆေ့ချ်တွင် ပြမည့် Video သတ်မှတ်ရန်
/pvideo - Promote မက်ဆေ့ချ်တွင် ပြမည့် Video သတ်မှတ်ရန်
/dvideo - Demote မက်ဆေ့ချ်တွင် ပြမည့် Video သတ်မှတ်ရန်
/showbvideo - လက်ရှိ Ban Video ကို ကြည့်ရန်
/showmvideo - လက်ရှိ Mute Video ကို ကြည့်ရန်
/showuvideo - လက်ရှိ Unmute Video ကို ကြည့်ရန်
/showpvideo - လက်ရှိ Promote Video ကို ကြည့်ရန်
/showdvideo - လက်ရှိ Demote Video ကို ကြည့်ရန်
/delbvideo - Ban Video ကို ဖျက်ရန်
/delmvideo - Mute Video ကို ဖျက်ရန်
/deluvideo - Unmute Video ကို ဖျက်ရန်
/delpvideo - Promote Video ကို ဖျက်ရန်
/deldvideo - Demote Video ကို ဖျက်ရန်

✨ <b>Welcome & Leave Settings:</b>
/wevideo - Welcome Video သတ်မှတ်ရန်
/Dwevideo - Welcome Video ဖျက်ရန်
/wephoto - Welcome Photo သတ်မှတ်ရန်
/Dwephoto - Welcome Photo ဖျက်ရန်
/settouch - Welcome စာသား သတ်မှတ်ရန်
/deltouch - Welcome စာသား မူလအတိုင်း ပြန်ပြောင်းရန်
/addbutton - Welcome တွင် Button ထည့်ရန်
/delbuttons - Welcome Buttons များ ဖျက်ရန်
/Levideo - Leave Video သတ်မှတ်ရန်
/DLevideo - Leave Video ဖျက်ရန်
/Levideogp - Leave Video ကြည့်ရန်
/setltouch - Leave စာသား သတ်မှတ်ရန်
/addlbutton - Leave တွင် Button ထည့်ရန်
/dellbuttons - Leave Buttons များ ဖျက်ရန်`;

  bot.command('Gpchhelp', async (ctx) => {
    const keyboard = new InlineKeyboard().text("❌ ပိတ်မည် ❌", "delete_this_msg");
    await ctx.reply(gpChHelpContent, { parse_mode: 'HTML', reply_markup: keyboard });
  });

  // ============================================================
  // 4. /ownerhelp Command (Owner သီးသန့်စစ်ဆေးခြင်း - 100% Secure)
  // ============================================================
  const ownerHelpContent = 
`👑 <b>OWNER HELP COMMANDS</b>

/Teach - Premium Key အသစ် ထုတ်ယူရန်
/setbotname - Bot ၏ အမည်အသစ် သတ်မှတ်ရန်
/setbotid - Bot ၏ ID အသစ် သတ်မှတ်ရန်
/setbotusername - Bot ၏ Username အသစ် သတ်မှတ်ရန်
/setbotbio - Bot ၏ Bio စာသား သတ်မှတ်ရန်
/setbotpfvideo - Bot Profile အတွက် Video သတ်မှတ်ရန်
/setbotpfphoto - Bot Profile အတွက် Photo သတ်မှတ်ရန်
/delbotpfmedia - Bot Profile မီဒီယာကို ဖျက်ရန်
/delallbotinfo - Bot ၏ Profile အချက်အလက်အားလုံးကို အပြီးအပိုင်ဖျက်ရန်
/treply - Owner ၏ ကြော်ငြာစာကို User များထံ ပို့ရန်
/sendlink - Group လင့်ခ်ပါသော စာများကို ပို့ရန်
/open - Owner Media Mode ဖွင့်ရန်
/close - Owner Media Mode ပိတ်ရန်
/Tearopen - Tear Open Mode ဖွင့်ရန်
/Tear - Tear Mode ပိတ်ရန်
/clearbrain - Bot ၏ မှတ်ဉာဏ်များ အားလုံးဖျက်ရန်
/cleansymbols - Symbol ပါသော စာများကို ဖျက်ရန်
/cleanlong - စာအရှည်ကြီးများကို ရှင်းထုတ်ရန်
/clearstickers - စတစ်ကာအားလုံး ဖျက်ရန်
/clearmedia - မီဒီယာအားလုံး ဖျက်ရန်
/sendchannel - Channel ထဲသို့ တိုက်ရိုက်ပို့ရန်
/setstvideo / delstvideo / viewstvideo - Start Video စီမံရန်
/settoptext / deltoptext / viewtoptext - Start အပေါ်စာသား စီမံရန်
/setbottomtext / delbottomtext / viewbottomtext - Start အောက်စာသား စီမံရန်
/addstbutton / delstbuttons - Start Buttons စီမံရန်
/bcast / bcastopen / bcasttear - Broadcast စနစ်များ
/addcard / addprize / chk / usercards - Gacha Card စနစ်များ
/gplist / leave - Group စာရင်းနှင့် ထွက်ခွာခြင်း
/sethelptext / sethelpmedia / delhelptext / delhelpmedia - Help စာမျက်နှာများ သတ်မှတ်ရန်`;

  bot.command('ownerhelp', async (ctx) => {
    if (!isOwner(ctx, OWNER_ID)) {
      return ctx.reply("ownerမဟုပါသဖြင့်ကြည့်မရပါဘူးနော်🤭🤪");
    }
    const keyboard = new InlineKeyboard().text("❌ ပိတ်မည် ❌", "delete_this_msg");
    await ctx.reply(ownerHelpContent, { parse_mode: 'HTML', reply_markup: keyboard });
  });

  // ============================================================
  // 5. Callback Queries (Inline Buttons များကို နှိပ်သည့်အခါ)
  // ============================================================
  bot.callbackQuery('cmd_mamberhelp', async (ctx) => {
    await ctx.answerCallbackQuery();
    const page = await HelpPage.findOne({ pageNumber: 999 });
    const keyboard = new InlineKeyboard().text("❌ ပိတ်မည် ❌", "delete_this_msg");

    if (page && page.mediaId) {
      if (page.mediaType === 'photo') {
        return await ctx.replyWithPhoto(page.mediaId, { caption: memberHelpContent, parse_mode: 'HTML', reply_markup: keyboard });
      } else if (page.mediaType === 'video') {
        return await ctx.replyWithVideo(page.mediaId, { caption: memberHelpContent, parse_mode: 'HTML', reply_markup: keyboard });
      }
    }
    await ctx.reply(memberHelpContent, { parse_mode: 'HTML', reply_markup: keyboard });
  });

  bot.callbackQuery('cmd_gpchhelp', async (ctx) => {
    await ctx.answerCallbackQuery();
    const keyboard = new InlineKeyboard().text("❌ ပိတ်မည် ❌", "delete_this_msg");
    await ctx.reply(gpChHelpContent, { parse_mode: 'HTML', reply_markup: keyboard });
  });

  bot.callbackQuery('cmd_ownerhelp', async (ctx) => {
    if (!isOwner(ctx, OWNER_ID)) {
      return ctx.answerCallbackQuery({ text: "ownerမဟုပါသဖြင့်ကြည့်မရပါဘူးနော်🤭🤪", show_alert: true });
    }
    await ctx.answerCallbackQuery();
    const keyboard = new InlineKeyboard().text("❌ ပိတ်မည် ❌", "delete_this_msg");
    await ctx.reply(ownerHelpContent, { parse_mode: 'HTML', reply_markup: keyboard });
  });

  bot.callbackQuery('delete_this_msg', async (ctx) => {
    try {
      await ctx.deleteMessage();
      await ctx.answerCallbackQuery({ text: "ဖျက်လိုက်ပါပြီ။" });
    } catch (e) {
      await ctx.answerCallbackQuery();
    }
  });

}

module.exports = setupHelpModule;
