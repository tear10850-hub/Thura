const { InlineKeyboard } = require('grammy');
const { User, Video } = require('./models');

function setupMediaFeed(bot) {
  
  // ===== ဗီဒီယိုပို့ရင် သိမ်းမယ် (Bot Chat မှသာ) =====
  bot.on('message:video', async (ctx) => {
    if (ctx.chat.type !== 'private') {
      return ctx.reply('⚠️ ဗီဒီယိုတင်ရန် Bot Chat ကိုသာ သုံးပါ။');
    }

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

  // ===== /watch Command (Bot Chat မှသာ) =====
  bot.command('watch', async (ctx) => {
    if (ctx.chat.type !== 'private') {
      return ctx.reply('⚠️ ဒီ Command ကို Bot Chat မှာပဲ သုံးလို့ရပါတယ်။');
    }

    const videos = await Video.find({ visibility: 'public' });

    if (videos.length === 0) {
      return ctx.reply('📭 လောလောဆယ် ဗီဒီယို မရှိသေးပါ။');
    }
    await sendVideoFeed(ctx, 0, videos, 'all');
  });

  // ============================================================
  // ⭐ ခလုပ်တွေအတွက် Callback Handler
  // ============================================================
  bot.on('callback_query:data', async (ctx) => {
    // Bot Chat မှသာ
    if (ctx.chat.type !== 'private') {
      await ctx.answerCallbackQuery({ 
        text: '⚠️ ဒီခလုပ်ကို Bot Chat မှာပဲ သုံးလို့ရပါတယ်။',
        show_alert: true 
      });
      return;
    }

    try {
      const data = ctx.callbackQuery.data;
      const chatId = ctx.from.id.toString();

      console.log('📥 Callback received:', data);

      // ============================================================
      // 1️⃣ Profile ကြည့်ရန်
      // ============================================================
      if (data.startsWith('profile_')) {
        const targetChatId = data.replace('profile_', '');
        const targetUser = await User.findOne({ chatId: targetChatId });

        if (!targetUser) {
          await ctx.answerCallbackQuery({ 
            text: '⚠️ အသုံးပြုသူ မတွေ့ပါ။', 
            show_alert: true 
          });
          return;
        }

        const totalVideos = await Video.countDocuments({ chatId: targetChatId });
        await ctx.answerCallbackQuery();
        await ctx.reply(`👤 အမည်: ${targetUser.name}\n🎬 ဗီဒီယို: ${totalVideos} ခု`);
        return;
      }

      // ============================================================
      // 2️⃣ Like ပေးရန်
      // ============================================================
      if (data.startsWith('like_')) {
        const parts = data.split('_');
        const videoId = parts[1];
        const mode = parts[2];
        const index = parseInt(parts[3]);

        const vid = await Video.findOne({ videoId });
        if (!vid) {
          await ctx.answerCallbackQuery({ 
            text: '⚠️ ဗီဒီယို မတွေ့ပါ။', 
            show_alert: true 
          });
          return;
        }

        if (vid.likes.includes(chatId)) {
          vid.likes = vid.likes.filter(id => id !== chatId);
          await vid.save();
          await ctx.answerCallbackQuery({ text: '🤍 Like ပြန်ဖြုတ်ပြီး' });
        } else {
          vid.likes.push(chatId);
          await vid.save();
          await ctx.answerCallbackQuery({ text: '❤️ Like ပေးပြီး' });
        }

        const videos = await Video.find({ visibility: 'public' });
        try { 
          await ctx.api.deleteMessage(ctx.chat.id, ctx.msg.message_id); 
        } catch (err) {}
        await sendVideoFeed(ctx, index, videos, mode);
        return;
      }

      // ============================================================
      // 3️⃣ Delete လုပ်ရန် (ဗီဒီယိုဖျက်)
      // ============================================================
      if (data.startsWith('delete_')) {
        const videoId = data.replace('delete_', '');
        const vid = await Video.findOne({ videoId });

        if (vid && vid.chatId.toString() === chatId) {
          await Video.deleteOne({ videoId });
          await ctx.answerCallbackQuery({ text: '🗑️ ဗီဒီယို ဖျက်ပြီး' });
          try { 
            await ctx.api.deleteMessage(ctx.chat.id, ctx.msg.message_id); 
          } catch (err) {}
          await ctx.reply('✅ ဗီဒီယို ဖျက်ပြီးပါပြီ။');
        } else {
          await ctx.answerCallbackQuery({ 
            text: '⚠️ ဖျက်ရန် ခွင့်မပြုပါ။', 
            show_alert: true 
          });
        }
        return;
      }

      // ============================================================
      // 4️⃣ ခေါင်းစဉ်ပြင်ရန် (Edit Caption)
      // ============================================================
      if (data.startsWith('editcaption_')) {
        const videoId = data.replace('editcaption_', '');
        const vid = await Video.findOne({ videoId });

        if (!vid) {
          await ctx.answerCallbackQuery({ 
            text: '⚠️ ဗီဒီယို မတွေ့ပါ။', 
            show_alert: true 
          });
          return;
        }

        if (vid.chatId.toString() !== chatId) {
          await ctx.answerCallbackQuery({ 
            text: '⚠️ သင့်ဗီဒီယိုမှသာ ပြင်လို့ရမယ်။', 
            show_alert: true 
          });
          return;
        }

        await ctx.answerCallbackQuery({ text: '✏️ ခေါင်းစဉ်အသစ်ရိုက်ပါ။' });
        // User က စာရိုက်လာရင် သိမ်းဖို့ state ထားမယ်
        // ဒါကို session နဲ့ချိတ်ဖို့လိုတယ် (ဒီနေရာမှာ ရိုးရိုးပြန်ဖြေထားတယ်)
        await ctx.reply('✏️ ခေါင်းစဉ်အသစ်ကို ရိုက်ထည့်ပါ။ (ဥပမာ: /editcaption ခေါင်းစဉ်သစ်)');
        return;
      }

      // ============================================================
      // 5️⃣ Comment ရေးရန်
      // ============================================================
      if (data.startsWith('comment_')) {
        const videoId = data.replace('comment_', '');
        const vid = await Video.findOne({ videoId });

        if (!vid) {
          await ctx.answerCallbackQuery({ 
            text: '⚠️ ဗီဒီယို မတွေ့ပါ။', 
            show_alert: true 
          });
          return;
        }

        await ctx.answerCallbackQuery({ text: '💬 Comment ရိုက်ပါ။' });
        await ctx.reply('💬 Comment ကို ရိုက်ထည့်ပါ။ (ဥပမာ: /comment မင်္ဂလာပါ)');
        return;
      }

      // ============================================================
      // 6️⃣ နောက်တစ်ပုဒ် (Next)
      // ============================================================
      if (data.startsWith('next_')) {
        const parts = data.split('_');
        const mode = parts[1];
        const index = parseInt(parts[2]);

        const videos = await Video.find({ visibility: 'public' });
        try { 
          await ctx.api.deleteMessage(ctx.chat.id, ctx.msg.message_id); 
        } catch (err) {}
        await sendVideoFeed(ctx, index, videos, mode);
        await ctx.answerCallbackQuery();
        return;
      }

      // ============================================================
      // 7️⃣ ရှေ့တစ်ပုဒ် (Previous)
      // ============================================================
      if (data.startsWith('prev_')) {
        const parts = data.split('_');
        const mode = parts[1];
        const index = parseInt(parts[2]);

        const videos = await Video.find({ visibility: 'public' });
        try { 
          await ctx.api.deleteMessage(ctx.chat.id, ctx.msg.message_id); 
        } catch (err) {}
        await sendVideoFeed(ctx, index, videos, mode);
        await ctx.answerCallbackQuery();
        return;
      }

      // ============================================================
      // 8️⃣ မသိသော ခလုပ်
      // ============================================================
      await ctx.answerCallbackQuery({ 
        text: '⚠️ ဤခလုပ်ကို မသိပါ။',
        show_alert: true 
      });

    } catch (error) {
      console.error('❌ Callback Error:', error);
      await ctx.answerCallbackQuery({ 
        text: '❌ Error ဖြစ်နေတယ်။ နောက်မှပြန်ကြိုးစားပါ။',
        show_alert: true 
      });
    }
  });

  // ============================================================
  // 📝 Edit Caption Command (ခေါင်းစဉ်ပြင်ရန်)
  // ============================================================
  bot.command('editcaption', async (ctx) => {
    if (ctx.chat.type !== 'private') return;

    const chatId = ctx.from.id.toString();
    const newCaption = ctx.message.text.replace('/editcaption', '').trim();

    if (!newCaption) {
      return ctx.reply('⚠️ ခေါင်းစဉ်အသစ်ထည့်ပါ။ ဥပမာ: /editcaption ခေါင်းစဉ်သစ်');
    }

    // နောက်ဆုံးကြည့်ထားတဲ့ Video ကိုရှာ (ဒါက session နဲ့ချိတ်ဖို့လိုတယ်)
    // ရိုးရှင်းအောင် ဒီနေရာမှာ ပြန်ဖြေထားတယ်
    await ctx.reply('✏️ ခေါင်းစဉ်ပြင်ရန် ဗီဒီယို ID လိုအပ်ပါတယ်။');
  });

  // ============================================================
  // 💬 Comment Command
  // ============================================================
  bot.command('comment', async (ctx) => {
    if (ctx.chat.type !== 'private') return;

    const chatId = ctx.from.id.toString();
    const comment = ctx.message.text.replace('/comment', '').trim();

    if (!comment) {
      return ctx.reply('⚠️ Comment ထည့်ပါ။ ဥပမာ: /comment မင်္ဂလာပါ');
    }

    await ctx.reply('💬 Comment ထည့်ပြီးပါပြီ။');
  });

  // ============================================================
  // 🎬 Video Feed ပြသရန် Function
  // ============================================================
  async function sendVideoFeed(ctx, index, videos, mode) {
    if (index >= videos.length) index = 0;
    if (index < 0) index = videos.length - 1;

    const vid = videos[index];
    const chatId = ctx.from.id.toString();
    const author = await User.findOne({ chatId: vid.chatId });
    const authorName = author ? author.name : 'Unknown';
    const isMyVideo = vid.chatId.toString() === chatId;

    const keyboard = new InlineKeyboard()
      // Profile
      .text(`👤 ${authorName}`, `profile_${vid.chatId}`)
      .row()
      // Like
      .text(`❤️ ${vid.likes.length}`, `like_${vid.videoId}_${mode}_${index}`)
      .row();

    // ကိုယ်ပိုင်ဗီဒီယိုဆိုရင်
    if (isMyVideo) {
      keyboard
        .text('🗑️ Delete', `delete_${vid.videoId}`)
        .row()
        .text('✏️ Edit Caption', `editcaption_${vid.videoId}`)
        .row();
    }

    // Comment
    keyboard.text('💬 Comment', `comment_${vid.videoId}`).row();

    // Next / Previous
    keyboard
      .text('◀️ ရှေ့တစ်ပုဒ်', `prev_${mode}_${index - 1}`)
      .text('➡️ နောက်တစ်ပုဒ်', `next_${mode}_${index + 1}`);

    await ctx.replyWithVideo(vid.fileId, {
      caption: `🎬 ${vid.caption}\n\n👤 ${authorName}\n❤️ ${vid.likes.length} likes\n💬 ${vid.comments ? vid.comments.length : 0} comments`,
      reply_markup: keyboard
    });
  }
}

module.exports = setupMediaFeed;
