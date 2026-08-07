const { Media } = require('./models');

function setupMediaManagerModule(bot, OWNER_ID) {

  // Channel Link/Username နှင့် Start Index ကို ခွဲထုတ်ပေးသည့် Helper Function
  const parseCommandArgs = (text) => {
    if (!text) return { targetChannel: null, startIndex: 1 };
    
    const parts = text.trim().split(/\s+/);
    let rawChannel = parts[0];
    let startIndex = 1;

    // အနောက်မှာ စတင်ချင်သည့် နံပါတ်ပါရင် ယူမည် (ဥပမာ- 68)
    if (parts.length > 1 && !isNaN(parseInt(parts[1]))) {
      startIndex = parseInt(parts[1]);
    }

    // Link/Username သန့်စင်မည်
    let targetChannel = rawChannel;
    if (rawChannel.includes('t.me/')) {
      const p = rawChannel.split('t.me/')[1];
      if (p.startsWith('c/')) {
        targetChannel = '-100' + p.split('/')[1];
      } else {
        targetChannel = '@' + p.replace(/\/$/, '');
      }
    } else if (!rawChannel.startsWith('@') && !rawChannel.startsWith('-100')) {
      targetChannel = '@' + rawChannel;
    }

    return { targetChannel, startIndex };
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // ==========================================
  // 1. STICKER MANAGEMENT
  // ==========================================

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

  bot.command('showstickers', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;

    const { targetChannel, startIndex } = parseCommandArgs(ctx.match);
    if (!targetChannel) {
      return ctx.reply("⚠️ Channel Link နှင့် စတင်လိုသည့် နံပါတ် ထည့်ပေးပါ။ \n\nဥပမာ - `/showstickers @mychannel 68` (နံပါတ် ၆၈ မှစ၍ ပို့မည်)", { parse_mode: 'Markdown' });
    }

    try {
      const stickers = await Media.find({ type: 'sticker' }).sort({ createdAt: 1 });
      if (stickers.length === 0) return ctx.reply("❌ Database ထဲမှာ စတစ်ကာ တစ်ခုမျှ မရှိပါ။");

      if (startIndex > stickers.length) {
        return ctx.reply(`❌ ထည့်သွင်းလိုက်သော နံပါတ် (${startIndex}) သည် စုစုပေါင်း စတစ်ကာ အရေအတွက် (${stickers.length}) ထက် ပိုများနေပါသည်။`);
      }

      // စတင်လိုသည့် နံပါတ် (startIndex) မှစ၍ ဖြတ်ယူမည်
      const itemsToSend = stickers.slice(startIndex - 1);

      await ctx.reply(`📤 Sticker နံပါတ် (**${startIndex}**) မှစ၍ စုစုပေါင်း (**${itemsToSend.length}**) ခုကို ${targetChannel} သို့ စတင် ပို့ဆောင်ပေးနေပါပြီ...`, { parse_mode: 'Markdown' });

      let currentIndex = startIndex;
      let successCount = 0;

      for (const stk of itemsToSend) {
        try {
          await ctx.api.sendSticker(targetChannel, stk.fileId);
          await delay(500);

          await ctx.api.sendMessage(targetChannel, `📌 **Sticker No:** \`${currentIndex}\` \n🆔 ID: \`${stk._id}\``, { parse_mode: 'Markdown' });
          
          successCount++;
          currentIndex++;
          await delay(1500); // Flood Limit မမိစေရန် ၁.၅ စက္ကန့် စောင့်မည်
        } catch (e) {
          console.error(`[Error] Failed to send sticker No ${currentIndex}:`, e.message);
          currentIndex++;
          await delay(5000); // Error တက်လျှင် ၅ စက္ကန့် စောင့်မည်
        }
      }

      await ctx.reply(`✅ Sticker နံပါတ် (${startIndex}) မှစ၍ မပို့ရသေးသည့် စတစ်ကာ (${successCount}) ခုကို ${targetChannel} သို့ အောင်မြင်စွာ ပို့ဆောင်ပြီးပါပြီ။`);
    } catch (err) {
      console.error("Show stickers error:", err);
      await ctx.reply("❌ Channel သို့ ပို့ရာတွင် အမှားအယွင်း ရှိနေပါသည်။ (Bot ကို Channel Admin ပေးထားရန် လိုအပ်ပါသည်။)");
    }
  });

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

  bot.command('showphotos', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const { targetChannel, startIndex } = parseCommandArgs(ctx.match);
    if (!targetChannel) return ctx.reply("⚠️ Channel Link နှင့် စတင်လိုသည့် နံပါတ် ထည့်ပေးပါ။ (ဥပမာ - `/showphotos @mychannel 10`)");

    try {
      const photos = await Media.find({ type: 'photo' }).sort({ createdAt: 1 });
      if (photos.length === 0) return ctx.reply("❌ Database ထဲမှာ ဓာတ်ပုံ တစ်ခုမျှ မရှိပါ။");
      if (startIndex > photos.length) return ctx.reply(`❌ နံပါတ် (${startIndex}) သည် စုစုပေါင်း အရေအတွက် ထက် ပိုများနေပါသည်။`);

      const itemsToSend = photos.slice(startIndex - 1);
      await ctx.reply(`📤 Photo နံပါတ် (**${startIndex}**) မှစ၍ စုစုပေါင်း (**${itemsToSend.length}**) ပုံကို ${targetChannel} သို့ စတင် ပို့ဆောင်ပေးနေပါပြီ...`, { parse_mode: 'Markdown' });

      let currentIndex = startIndex;
      let successCount = 0;

      for (const item of itemsToSend) {
        try {
          await ctx.api.sendPhoto(targetChannel, item.fileId, {
            caption: `🖼️ **Photo No:** \`${currentIndex}\` \n🆔 ID: \`${item._id}\``,
            parse_mode: 'Markdown'
          });
          successCount++;
          currentIndex++;
          await delay(1500);
        } catch (e) {
          console.error(`[Error] Failed to send photo No ${currentIndex}:`, e.message);
          currentIndex++;
          await delay(4000);
        }
      }
      await ctx.reply(`✅ ဓာတ်ပုံ စုစုပေါင်း (${successCount}) ပုံကို ${targetChannel} သို့ ပို့ဆောင်ပြီးပါပြီ။`);
    } catch (err) {
      console.error("Show photos error:", err);
      await ctx.reply("❌ Channel သို့ ပို့ရာတွင် အမှားအယွင်း ရှိနေပါသည်။");
    }
  });

  bot.command('delphoto', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const targetIndex = parseInt(ctx.match ? ctx.match.trim() : null);
    if (!targetIndex || isNaN(targetIndex) || targetIndex < 1) return ctx.reply("⚠️ ဖျက်ချင်သော Photo ၏ နံပါတ်ကို ထည့်ပေးပါ။");

    try {
      const photos = await Media.find({ type: 'photo' }).sort({ createdAt: 1 });
      if (targetIndex > photos.length) return ctx.reply(`❌ နံပါတ် (${targetIndex}) မရှိပါ။`);

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

  bot.command('showvideos', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const { targetChannel, startIndex } = parseCommandArgs(ctx.match);
    if (!targetChannel) return ctx.reply("⚠️ Channel Link နှင့် စတင်လိုသည့် နံပါတ် ထည့်ပေးပါ။ (ဥပမာ - `/showvideos @mychannel 5`)");

    try {
      const videos = await Media.find({ type: 'video' }).sort({ createdAt: 1 });
      if (videos.length === 0) return ctx.reply("❌ Database ထဲမှာ ဗီဒီယို တစ်ခုမျှ မရှိပါ။");
      if (startIndex > videos.length) return ctx.reply(`❌ နံပါတ် (${startIndex}) သည် စုစုပေါင်း အရေအတွက် ထက် ပိုများနေပါသည်။`);

      const itemsToSend = videos.slice(startIndex - 1);
      await ctx.reply(`📤 Video နံပါတ် (**${startIndex}**) မှစ၍ စုစုပေါင်း (**${itemsToSend.length}**) ခုကို ${targetChannel} သို့ စတင် ပို့ဆောင်ပေးနေပါပြီ...`, { parse_mode: 'Markdown' });

      let currentIndex = startIndex;
      let successCount = 0;

      for (const item of itemsToSend) {
        try {
          await ctx.api.sendVideo(targetChannel, item.fileId, {
            caption: `🎥 **Video No:** \`${currentIndex}\` \n🆔 ID: \`${item._id}\``,
            parse_mode: 'Markdown'
          });
          successCount++;
          currentIndex++;
          await delay(2000);
        } catch (e) {
          console.error(`[Error] Failed to send video No ${currentIndex}:`, e.message);
          currentIndex++;
          await delay(4000);
        }
      }
      await ctx.reply(`✅ ဗီဒီယို စုစုပေါင်း (${successCount}) ခုကို ${targetChannel} သို့ ပို့ဆောင်ပြီးပါပြီ။`);
    } catch (err) {
      console.error("Show videos error:", err);
      await ctx.reply("❌ Channel သို့ ပို့ရာတွင် အမှားအယွင်း ရှိနေပါသည်။");
    }
  });

  bot.command('delvideo', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const targetIndex = parseInt(ctx.match ? ctx.match.trim() : null);
    if (!targetIndex || isNaN(targetIndex) || targetIndex < 1) return ctx.reply("⚠️ ဖျက်ချင်သော Video ၏ နံပါတ်ကို ထည့်ပေးပါ။");

    try {
      const videos = await Media.find({ type: 'video' }).sort({ createdAt: 1 });
      if (targetIndex > videos.length) return ctx.reply(`❌ နံပါတ် (${targetIndex}) မရှိပါ။`);

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

  bot.command('showaudios', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const { targetChannel, startIndex } = parseCommandArgs(ctx.match);
    if (!targetChannel) return ctx.reply("⚠️ Channel Link နှင့် စတင်လိုသည့် နံပါတ် ထည့်ပေးပါ။ (ဥပမာ - `/showaudios @mychannel 3`)");

    try {
      const audios = await Media.find({ $or: [{ type: 'audio' }, { type: 'music' }] }).sort({ createdAt: 1 });
      if (audios.length === 0) return ctx.reply("❌ Database ထဲမှာ Audio/Voice တစ်ခုမျှ မရှိပါ။");
      if (startIndex > audios.length) return ctx.reply(`❌ နံပါတ် (${startIndex}) သည် စုစုပေါင်း အရေအတွက် ထက် ပိုများနေပါသည်။`);

      const itemsToSend = audios.slice(startIndex - 1);
      await ctx.reply(`📤 Audio နံပါတ် (**${startIndex}**) မှစ၍ စုစုပေါင်း (**${itemsToSend.length}**) ခုကို ${targetChannel} သို့ စတင် ပို့ဆောင်ပေးနေပါပြီ...`, { parse_mode: 'Markdown' });

      let currentIndex = startIndex;
      let successCount = 0;

      for (const item of itemsToSend) {
        try {
          await ctx.api.sendAudio(targetChannel, item.fileId, {
            caption: `🎵 **Audio No:** \`${currentIndex}\` \n🆔 ID: \`${item._id}\``,
            parse_mode: 'Markdown'
          });
          successCount++;
          currentIndex++;
          await delay(1500);
        } catch (e) {
          console.error(`[Error] Failed to send audio No ${currentIndex}:`, e.message);
          currentIndex++;
          await delay(4000);
        }
      }
      await ctx.reply(`✅ Audio စုစုပေါင်း (${successCount}) ခုကို ${targetChannel} သို့ ပို့ဆောင်ပြီးပါပြီ။`);
    } catch (err) {
      console.error("Show audios error:", err);
      await ctx.reply("❌ Channel သို့ ပို့ရာတွင် အမှားအယွင်း ရှိနေပါသည်။");
    }
  });

  bot.command('delaudio', async (ctx) => {
    if (ctx.from.id !== OWNER_ID) return;
    const targetIndex = parseInt(ctx.match ? ctx.match.trim() : null);
    if (!targetIndex || isNaN(targetIndex) || targetIndex < 1) return ctx.reply("⚠️ ဖျက်ချင်သော Audio ၏ နံပါတ်ကို ထည့်ပေးပါ။");

    try {
      const audios = await Media.find({ $or: [{ type: 'audio' }, { type: 'music' }] }).sort({ createdAt: 1 });
      if (targetIndex > audios.length) return ctx.reply(`❌ နံပါတ် (${targetIndex}) မရှိပါ။`);

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
