const { Media } = require('./models');

function setupMediaManagerModule(bot, OWNER_ID) {

  // Helper Function: URL/Username/ID ကြိုက်တာရိုက်ရိုက် အမှန်ကန်ဆုံး ID ဖြစ်အောင် ပြောင်းပေးမည်
  const resolveChannel = (input) => {
    if (!input) return null;
    let val = input.trim();

    // 1. URL ဖြစ်နေလျှင် t.me/ နောက်က အပိုင်းကို ဖြတ်ထုတ်မည်
    if (val.includes('t.me/')) {
      const parts = val.split('t.me/');
      let id = parts[1];
      
      // Private Channel (c/) ဖြစ်နေလျှင် -100 ထည့်ပေးရမည်
      if (id.startsWith('c/')) {
        const idParts = id.split('/');
        return '-100' + idParts[1];
      }
      
      // ပုံမှန် Channel ဆိုလျှင် @ ထည့်ပေးမည်
      return '@' + id.replace(/\/$/, '');
    }

    // 2. @ သို့မဟုတ် ID မဟုတ်လျှင် @ ထည့်ပေးမည်
    if (!val.startsWith('@') && !val.startsWith('-100')) {
      return '@' + val;
    }

    return val;
  };

  // Helper Function for Rate-limit delay (0.8 စက္ကန့်ခြားမည်)
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // ==========================================
  // 1. STICKER MANAGEMENT
  // ==========================================

  // Count Stickers
  bot.command('countsticker', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    try {
      const count = await Media.countDocuments({ type: 'sticker' });
      const sent = await ctx.reply(`📊 Database ထဲမှာ လက်ရှိ Sticker စုစုပေါင်း ( ${count} ) ခု ရှိပါတယ်။`);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    } catch (err) {
      console.error("Count sticker error:", err);
    }
  });

  // Show Stickers to Channel
  bot.command('showstickers', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const targetChannel = resolveChannel(ctx.match);
    if (!targetChannel) return ctx.reply("⚠️ Channel Username သို့မဟုတ် Link ထည့်ပေးပါ။ (ဥပမာ - `/showstickers @mychannel` သို့မဟုတ် `/showstickers https://t.me/mychannel`)", { parse_mode: 'Markdown' });

    try {
      const stickers = await Media.find({ type: 'sticker' }).sort({ createdAt: 1 });
      if (stickers.length === 0) return ctx.reply("❌ Database ထဲမှာ စတစ်ကာ တစ်ခုမျှ မရှိပါ။");

      await ctx.reply(`📤 စတစ်ကာ စုစုပေါင်း (${stickers.length}) ခုကို ${targetChannel} သို့ စတင် ပို့ဆောင်ပေးနေပါပြီ...`);

      let index = 1;
      let successCount = 0;

      for (const stk of stickers) {
        try {
          await ctx.api.sendSticker(targetChannel, stk.fileId);
          await ctx.api.sendMessage(targetChannel, `📌 **Sticker No:** \`${index}\` \n🆔 ID: \`${stk._id}\``, { parse_mode: 'Markdown' });
          
          successCount++;
          index++;
          await delay(800);
        } catch (e) {
          console.error(`[Error] Failed to send sticker No ${index}:`, e.message);
          index++;
          await delay(1000);
        }
      }
      await ctx.reply(`✅ Sticker စုစုပေါင်း (${stickers.length}) ခုအနက် (${successCount}) ခုကို ${targetChannel} သို့ အောင်မြင်စွာ ပို့ဆောင်ပြီးပါပြီ။`);
    } catch (err) {
      console.error("Show stickers error:", err);
      await ctx.reply("❌ Channel သို့ ပို့ရာတွင် အမှားအယွင်း ရှိနေပါသည်။ (Bot ကို Channel Admin ပေးထားရန် လိုအပ်ပါသည်။)");
    }
  });

  // Delete Sticker by Index
  bot.command('delsticker', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const targetIndex = parseInt(ctx.match ? ctx.match.trim() : null);
    if (!targetIndex || isNaN(targetIndex) || targetIndex < 1) return ctx.reply("⚠️ ဖျက်ချင်သော Sticker ၏ နံပါတ်ကို ထည့်ပေးပါ။ (ဥပမာ - `/delsticker 45`)", { parse_mode: 'Markdown' });

    try {
      const stickers = await Media.find({ type: 'sticker' }).sort({ createdAt: 1 });
      if (targetIndex > stickers.length) return ctx.reply(`❌ နံပါတ် (${targetIndex}) မရှိပါ။ လက်ရှိ Sticker စုစုပေါင်း (${stickers.length}) ခုသာ ရှိပါသည်။`);

      const targetSticker = stickers[targetIndex - 1];
      await Media.deleteOne({ _id: targetSticker._id });

      const sent = await ctx.reply(`🗑️ Sticker No. **${targetIndex}** ကို Database ထဲမှ အောင်မြင်စွာ ဖျက်ထုတ်လိုက်ပါပြီ။`, { parse_mode: 'Markdown' });
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    } catch (err) {
      console.error("Delete sticker error:", err);
    }
  });


  // ==========================================
  // 2. PHOTO MANAGEMENT
  // ==========================================

  // Count Photos
  bot.command('countphoto', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    try {
      const count = await Media.countDocuments({ type: 'photo' });
      const sent = await ctx.reply(`🖼️ Database ထဲမှာ လက်ရှိ ဓာတ်ပုံ စုစုပေါင်း ( ${count} ) ပုံ ရှိပါတယ်။`);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    } catch (err) {
      console.error("Count photo error:", err);
    }
  });

  // Show Photos to Channel
  bot.command('showphotos', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const targetChannel = resolveChannel(ctx.match);
    if (!targetChannel) return ctx.reply("⚠️ Channel Username သို့မဟုတ် Link ထည့်ပေးပါ။ (ဥပမာ - `/showphotos https://t.me/mychannel`)", { parse_mode: 'Markdown' });

    try {
      const photos = await Media.find({ type: 'photo' }).sort({ createdAt: 1 });
      if (photos.length === 0) return ctx.reply("❌ Database ထဲမှာ ဓာတ်ပုံ တစ်ခုမျှ မရှိပါ။");

      await ctx.reply(`📤 ဓာတ်ပုံ စုစုပေါင်း (${photos.length}) ပုံကို ${targetChannel} သို့ စတင် ပို့ဆောင်ပေးနေပါပြီ...`);

      let index = 1;
      let successCount = 0;

      for (const item of photos) {
        try {
          await ctx.api.sendPhoto(targetChannel, item.fileId, {
            caption: `🖼️ **Photo No:** \`${index}\` \n🆔 ID: \`${item._id}\``,
            parse_mode: 'Markdown'
          });
          successCount++;
          index++;
          await delay(800);
        } catch (e) {
          console.error(`[Error] Failed to send photo No ${index}:`, e.message);
          index++;
          await delay(1000);
        }
      }
      await ctx.reply(`✅ ဓာတ်ပုံ စုစုပေါင်း (${photos.length}) ပုံအနက် (${successCount}) ပုံကို ${targetChannel} သို့ ပို့ဆောင်ပြီးပါပြီ။`);
    } catch (err) {
      console.error("Show photos error:", err);
      await ctx.reply("❌ Channel သို့ ပို့ရာတွင် အမှားအယွင်း ရှိနေပါသည်။");
    }
  });

  // Delete Photo by Index
  bot.command('delphoto', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const targetIndex = parseInt(ctx.match ? ctx.match.trim() : null);
    if (!targetIndex || isNaN(targetIndex) || targetIndex < 1) return ctx.reply("⚠️ ဖျက်ချင်သော Photo ၏ နံပါတ်ကို ထည့်ပေးပါ။ (ဥပမာ - `/delphoto 5`)", { parse_mode: 'Markdown' });

    try {
      const photos = await Media.find({ type: 'photo' }).sort({ createdAt: 1 });
      if (targetIndex > photos.length) return ctx.reply(`❌ နံပါတ် (${targetIndex}) မရှိပါ။ လက်ရှိ ဓာတ်ပုံ စုစုပေါင်း (${photos.length}) ပုံသာ ရှိပါသည်။`);

      const targetItem = photos[targetIndex - 1];
      await Media.deleteOne({ _id: targetItem._id });

      const sent = await ctx.reply(`🗑️ Photo No. **${targetIndex}** ကို Database ထဲမှ အောင်မြင်စွာ ဖျက်ထုတ်လိုက်ပါပြီ။`, { parse_mode: 'Markdown' });
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    } catch (err) {
      console.error("Delete photo error:", err);
    }
  });


  // ==========================================
  // 3. VIDEO MANAGEMENT
  // ==========================================

  // Count Videos
  bot.command('countvideo', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    try {
      const count = await Media.countDocuments({ type: 'video' });
      const sent = await ctx.reply(`🎥 Database ထဲမှာ လက်ရှိ ဗီဒီယို စုစုပေါင်း ( ${count} ) ခု ရှိပါတယ်။`);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    } catch (err) {
      console.error("Count video error:", err);
    }
  });

  // Show Videos to Channel
  bot.command('showvideos', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const targetChannel = resolveChannel(ctx.match);
    if (!targetChannel) return ctx.reply("⚠️ Channel Username သို့မဟုတ် Link ထည့်ပေးပါ။ (ဥပမာ - `/showvideos https://t.me/mychannel`)", { parse_mode: 'Markdown' });

    try {
      const videos = await Media.find({ type: 'video' }).sort({ createdAt: 1 });
      if (videos.length === 0) return ctx.reply("❌ Database ထဲမှာ ဗီဒီယို တစ်ခုမျှ မရှိပါ။");

      await ctx.reply(`📤 ဗီဒီယို စုစုပေါင်း (${videos.length}) ခုကို ${targetChannel} သို့ စတင် ပို့ဆောင်ပေးနေပါပြီ...`);

      let index = 1;
      let successCount = 0;

      for (const item of videos) {
        try {
          await ctx.api.sendVideo(targetChannel, item.fileId, {
            caption: `🎥 **Video No:** \`${index}\` \n🆔 ID: \`${item._id}\``,
            parse_mode: 'Markdown'
          });
          successCount++;
          index++;
          await delay(1200);
        } catch (e) {
          console.error(`[Error] Failed to send video No ${index}:`, e.message);
          index++;
          await delay(1500);
        }
      }
      await ctx.reply(`✅ ဗီဒီယို စုစုပေါင်း (${videos.length}) ခုအနက် (${successCount}) ခုကို ${targetChannel} သို့ ပို့ဆောင်ပြီးပါပြီ။`);
    } catch (err) {
      console.error("Show videos error:", err);
      await ctx.reply("❌ Channel သို့ ပို့ရာတွင် အမှားအယွင်း ရှိနေပါသည်။");
    }
  });

  // Delete Video by Index
  bot.command('delvideo', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const targetIndex = parseInt(ctx.match ? ctx.match.trim() : null);
    if (!targetIndex || isNaN(targetIndex) || targetIndex < 1) return ctx.reply("⚠️ ဖျက်ချင်သော Video ၏ နံပါတ်ကို ထည့်ပေးပါ။ (ဥပမာ - `/delvideo 3`)", { parse_mode: 'Markdown' });

    try {
      const videos = await Media.find({ type: 'video' }).sort({ createdAt: 1 });
      if (targetIndex > videos.length) return ctx.reply(`❌ နံပါတ် (${targetIndex}) မရှိပါ။ လက်ရှိ ဗီဒီယို စုစုပေါင်း (${videos.length}) ခုသာ ရှိပါသည်။`);

      const targetItem = videos[targetIndex - 1];
      await Media.deleteOne({ _id: targetItem._id });

      const sent = await ctx.reply(`🗑️ Video No. **${targetIndex}** ကို Database ထဲမှ အောင်မြင်စွာ ဖျက်ထုတ်လိုက်ပါပြီ။`, { parse_mode: 'Markdown' });
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    } catch (err) {
      console.error("Delete video error:", err);
    }
  });


  // ==========================================
  // 4. AUDIO / VOICE MANAGEMENT
  // ==========================================

  // Count Audios
  bot.command('countaudio', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    try {
      const count = await Media.countDocuments({ $or: [{ type: 'audio' }, { type: 'music' }] });
      const sent = await ctx.reply(`🎵 Database ထဲမှာ လက်ရှိ Audio/Voice စုစုပေါင်း ( ${count} ) ခု ရှိပါတယ်။`);
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    } catch (err) {
      console.error("Count audio error:", err);
    }
  });

  // Show Audios to Channel
  bot.command('showaudios', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const targetChannel = resolveChannel(ctx.match);
    if (!targetChannel) return ctx.reply("⚠️ Channel Username သို့မဟုတ် Link ထည့်ပေးပါ။ (ဥပမာ - `/showaudios https://t.me/mychannel`)", { parse_mode: 'Markdown' });

    try {
      const audios = await Media.find({ $or: [{ type: 'audio' }, { type: 'music' }] }).sort({ createdAt: 1 });
      if (audios.length === 0) return ctx.reply("❌ Database ထဲမှာ Audio/Voice တစ်ခုမျှ မရှိပါ။");

      await ctx.reply(`📤 Audio စုစုပေါင်း (${audios.length}) ခုကို ${targetChannel} သို့ စတင် ပို့ဆောင်ပေးနေပါပြီ...`);

      let index = 1;
      let successCount = 0;

      for (const item of audios) {
        try {
          await ctx.api.sendAudio(targetChannel, item.fileId, {
            caption: `🎵 **Audio No:** \`${index}\` \n🆔 ID: \`${item._id}\``,
            parse_mode: 'Markdown'
          });
          successCount++;
          index++;
          await delay(1000);
        } catch (e) {
          console.error(`[Error] Failed to send audio No ${index}:`, e.message);
          index++;
          await delay(1200);
        }
      }
      await ctx.reply(`✅ Audio စုစုပေါင်း (${audios.length}) ခုအနက် (${successCount}) ခုကို ${targetChannel} သို့ ပို့ဆောင်ပြီးပါပြီ။`);
    } catch (err) {
      console.error("Show audios error:", err);
      await ctx.reply("❌ Channel သို့ ပို့ရာတွင် အမှားအယွင်း ရှိနေပါသည်။");
    }
  });

  // Delete Audio by Index
  bot.command('delaudio', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const targetIndex = parseInt(ctx.match ? ctx.match.trim() : null);
    if (!targetIndex || isNaN(targetIndex) || targetIndex < 1) return ctx.reply("⚠️ ဖျက်ချင်သော Audio ၏ နံပါတ်ကို ထည့်ပေးပါ။ (ဥပမာ - `/delaudio 2`)", { parse_mode: 'Markdown' });

    try {
      const audios = await Media.find({ $or: [{ type: 'audio' }, { type: 'music' }] }).sort({ createdAt: 1 });
      if (targetIndex > audios.length) return ctx.reply(`❌ နံပါတ် (${targetIndex}) မရှိပါ။ လက်ရှိ Audio စုစုပေါင်း (${audios.length}) ခုသာ ရှိပါသည်။`);

      const targetItem = audios[targetIndex - 1];
      await Media.deleteOne({ _id: targetItem._id });

      const sent = await ctx.reply(`🗑️ Audio No. **${targetIndex}** ကို Database ထဲမှ အောင်မြင်စွာ ဖျက်ထုတ်လိုက်ပါပြီ။`, { parse_mode: 'Markdown' });
      if (global.autoDeleteMessage) global.autoDeleteMessage(ctx, sent.message_id);
    } catch (err) {
      console.error("Delete audio error:", err);
    }
  });

}

module.exports = setupMediaManagerModule;
