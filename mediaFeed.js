const { InlineKeyboard } = require('grammy');
const { User, Video } = require('./models');

function setupMediaFeed(bot) {
  
  // ဗီဒီယိုပို့လျှင် သိမ်းရန်
  bot.on('message:video', async (ctx) => {
    const chatId = ctx.from.id.toString();
    const user = await User.findOne({ chatId });

    if (!user) {
      return ctx.reply('⚠️ ကျေးဇူးပြု၍ ပထမဆုံး /register ဖြင့် အကောင့်ဖွင့်ပါ။');
    }

    const video = ctx.message.video;
    const videoId = Date.now().toString();

    const newVideo = new Video({
      videoId: videoId,
      chatId: chatId,
      fileId: video.file_id,
      caption: ctx.message.caption || 'ခေါင်းစဉ် မပါရှိပါ',
      visibility: 'public',
      likes: [],
      comments: []
    });

    await newVideo.save();
    await ctx.reply('🎬 ဗီဒီယို အောင်မြင်စွာ တင်ပြီးပါပြီ! /watch ဖြင့် ကြည့်ရှုနိုင်ပါသည်။');
  });

  // 🎬 /watch Command
  bot.command('watch', async (ctx) => {
    const chatId = ctx.from.id.toString();
    const videos = await Video.find({ visibility: 'public' });

    if (videos.length === 0) {
      return ctx.reply('📭 လောလောဆယ် ဗီဒီယို မရှိသေးပါ။');
    }
    await sendVideoFeed(ctx, 0, videos, 'all');
  });

  // 🕹️ ခလုတ်များ အားလုံးအတွက် တိုက်ရိုက်ဖမ်းယူမည့် နေရာ
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.from.id.toString();

    // 1. Profile ကြည့်ရန်
    if (data.startsWith('profile_')) {
      const targetChatId = data.replace('profile_', '');
      const targetUser = await User.findOne({ chatId: targetChatId });

      if (!targetUser) {
        return ctx.answerCallbackQuery({ text: '⚠️ အသုံးပြုသူ မတွေ့ပါ။', show_alert: true });
      }

      const totalVideos = await Video.countDocuments({ chatId: targetChatId });
      await ctx.answerCallbackQuery();
      return ctx.reply(`👤 အမည်: ${targetUser.name}\n🎬 တင်ထားသော ဗီဒီယို: ${totalVideos} ခု`);
    }

    // 2. Like ပေးရန်
    if (data.startsWith('like_')) {
      const parts = data.split('_');
      const videoId = parts[1];
      const mode = parts[2];
      const index = parseInt(parts[3]);

      const vid = await Video.findOne({ videoId });
      if (vid) {
        if (!vid.likes.includes(chatId)) {
          vid.likes.push(chatId);
          await ctx.answerCallbackQuery({ text: '❤️ Like ပေးလိုက်ပါပြီ!' });
        } else {
          vid.likes = vid.likes.filter(id => id !== chatId);
          await ctx.answerCallbackQuery({ text: '🤍 Like ပြန်ဖြုတ်လိုက်ပါပြီ။' });
        }
        await vid.save();

        const videos = await Video.find({ visibility: 'public' });
        try { await ctx.deleteMessage(); } catch (err) {}
        await sendVideoFeed(ctx, index, videos, mode);
      }
      return;
    }

    // 3. Delete လုပ်ရန်
    if (data.startsWith('delete_')) {
      const videoId = data.replace('delete_', '');
      const vid = await Video.findOne({ videoId });

      if (vid && vid.chatId === chatId) {
        await Video.deleteOne({ videoId });
        await ctx.answerCallbackQuery({ text: '🗑️ ဗီဒီယို ဖျက်ပြီးပါပြီ' });
        try { await ctx.deleteMessage(); } catch (err) {}
        await ctx.reply('✅ ဗီဒီယို ဖျက်ပြီးပါပြီ။');
      } else {
        await ctx.answerCallbackQuery({ text: '⚠️ ဤဗီဒီယိုကို ဖျက်ရန် ခွင့်မပြုပါ။', show_alert: true });
      }
      return;
    }

    // 4. နောက်တစ်ပုဒ် (Next) သို့သွားရန်
    if (data.startsWith('next_')) {
      const parts = data.split('_');
      const mode = parts[1];
      const index = parseInt(parts[2]);

      const videos = await Video.find({ visibility: 'public' });
      try { await ctx.deleteMessage(); } catch (err) {}
      await sendVideoFeed(ctx, index, videos, mode);
      await ctx.answerCallbackQuery();
      return;
    }
  });

  async function sendVideoFeed(ctx, index, videos, mode) {
    if (index >= videos.length) index = 0;
    if (index < 0) index = videos.length - 1;

    const vid = videos[index];
    const chatId = ctx.from.id.toString();
    const author = await User.findOne({ chatId: vid.chatId });
    const authorName = author ? author.name : 'Unknown';
    const isMyVideo = vid.chatId === chatId;

    const keyboard = new InlineKeyboard()
      .text(`👤 ${authorName} (Profile)`, `profile_${vid.chatId}`)
      .row()
      .text(`❤️ (${vid.likes.length})`, `like_${vid.videoId}_${mode}_${index}`)
      .row();

    if (isMyVideo) {
      keyboard.text('🗑️ Delete', `delete_${vid.videoId}`).row();
    }

    keyboard.text('➡️ နောက်တစ်ပုဒ်', `next_${mode}_${index + 1}`);

    await ctx.replyWithVideo(vid.fileId, {
      caption: `🎬 ${vid.caption}`,
      reply_markup: keyboard
    });
  }
}

module.exports = setupMediaFeed;
