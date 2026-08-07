const { InlineKeyboard } = require('grammy');
const { User, Video } = require('./models');

const tempComment = {};
const bannedKeywords = ['18+', 'sex', 'porn', 'xxx', 'adult', 'nude', 'nsfw'];

function setupMediaFeed(bot) {
  
  // 1. ဗီဒီယိုဖိုင် ပို့လိုက်လျှင် Database ထဲသို့ ချက်ချင်း သိမ်းဆည်းခြင်း
  bot.on('message:video', async (ctx) => {
    const chatId = ctx.from.id.toString();
    const user = await User.findOne({ chatId });

    if (!user) {
      return ctx.reply('⚠️ ကျေးဇူးပြု၍ ပထမဆုံး /register ဖြင့် အကောင့်ဖွင့်ပါ။');
    }

    const video = ctx.message.video;
    const videoFileId = video.file_id;
    const caption = ctx.message.caption || '';
    const duration = video.duration || 0;

    if (duration > 60) {
      return ctx.reply('⚠️ ဗီဒီယိုသည် အများဆုံး ၁ မိနစ် (စက္ကန့် ၆၀) ထက် ကျော်လွန်၍ မရပါ။');
    }

    const lowerCaption = caption.toLowerCase();
    const is18Plus = bannedKeywords.some(keyword => lowerCaption.includes(keyword));

    if (is18Plus) {
      return ctx.reply('❌ **မသင့်လျော်သော (18+) အကြောင်းအရာများ တင်ခွင့်မပြုပါ။**');
    }

    const videoId = Date.now().toString();

    // Database ထဲသို့ Public visibility ဖြင့် ဦးစွာ သိမ်းဆည်းလိုက်သည်
    const newVideo = new Video({
      videoId: videoId,
      chatId: chatId,
      fileId: videoFileId,
      caption: caption || 'ခေါင်းစဉ် မပါရှိပါ',
      visibility: 'public',
      likes: [],
      comments: []
    });

    await newVideo.save();

    await ctx.reply(
      '🎬 ဗီဒီယိုကို အောင်မြင်စွာ တင်ပြီးပါပြီ!\n\n' +
      'ဤဗီဒီယိုကို မည်သူများ ကြည့်ခွင့်ရှိသည်ကို အောက်ပါ Command များဖြင့် ပြောင်းလဲနိုင်ပါသည် -\n' +
      '🌍 အများသုံးရန်: /public\n' +
      '👥 သူငယ်ချင်းများသာ ကြည့်ရန်: /friends_only'
    );
  });

  // 🌍 /public command ဖြင့် အများသုံးသို့ ပြောင်းရန်
  bot.command('public', async (ctx) => {
    const chatId = ctx.from.id.toString();
    const latestVideo = await Video.findOne({ chatId }).sort({ _id: -1 });

    if (!latestVideo) {
      return ctx.reply('⚠️ သင်တင်ထားသော ဗီဒီယို မရှိသေးပါ။');
    }

    latestVideo.visibility = 'public';
    await latestVideo.save();

    await ctx.reply('✅ ဗီဒီယိုကို **အများသုံး (Public)** သို့ ပြောင်းလဲပြီးပါပြီ!');
    const videos = await Video.find({ $or: [{ visibility: 'public' }, { chatId: chatId }] });
    await sendVideoFeed(ctx, videos.length - 1, videos, 'all');
  });

  // 👥 /friends_only command ဖြင့် သူငယ်ချင်းများသာ ကြည့်ရန် ပြောင်းရန်
  bot.command('friends_only', async (ctx) => {
    const chatId = ctx.from.id.toString();
    const latestVideo = await Video.findOne({ chatId }).sort({ _id: -1 });

    if (!latestVideo) {
      return ctx.reply('⚠️ သင်တင်ထားသော ဗီဒီယို မရှိသေးပါ။');
    }

    latestVideo.visibility = 'friends';
    await latestVideo.save();

    await ctx.reply('✅ ဗီဒီယိုကို **သူငယ်ချင်းများသာ (Friends Only)** သို့ ပြောင်းလဲပြီးပါပြီ!');
    const videos = await Video.find({ $or: [{ visibility: 'public' }, { chatId: chatId }] });
    await sendVideoFeed(ctx, videos.length - 1, videos, 'all');
  });

  // 💬 Comment စာသားကို လက်ခံခြင်း
  bot.on('message:text', async (ctx, next) => {
    const chatId = ctx.from.id.toString();
    const commentData = tempComment[chatId];

    if (commentData) {
      const { videoId, mode, index } = commentData;
      const commentText = ctx.message.text;
      const currentUser = await User.findOne({ chatId });
      const name = currentUser ? currentUser.name : ctx.from.first_name;

      await Video.updateOne(
        { videoId },
        { 
          $push: { 
            comments: { 
              chatId: chatId,
              name: name, 
              text: commentText 
            } 
          } 
        }
      );

      delete tempComment[chatId];
      await ctx.reply('✅ Comment ရေးသားမှု အောင်မြင်ပါသည်။');

      const user = await User.findOne({ chatId });
      const videos = mode === 'friends' 
        ? await Video.find({ chatId: { $in: user ? user.following : [] } })
        : await Video.find({ $or: [{ visibility: 'public' }, { chatId: chatId }] });

      await sendVideoFeed(ctx, index, videos, mode);
    } else {
      return next();
    }
  });

  bot.callbackQuery(/profile_(.+)/, async (ctx) => {
    const targetChatId = ctx.match[1];
    const targetUser = await User.findOne({ chatId: targetChatId });

    if (!targetUser) {
      return ctx.answerCallbackQuery({ text: '⚠️ အသုံးပြုသူ အချက်အလက် မတွေ့ရှိပါ။', show_alert: true });
    }

    const totalVideos = await Video.countDocuments({ chatId: targetChatId });
    const totalFollowers = await User.countDocuments({ following: targetChatId });

    const profileText = 
`👤 <b>User Profile</b>\n\n` +
`📛 အမည်: <b>${targetUser.name}</b>\n` +
`🎬 တင်ထားသော ဗီဒီယိုစုစုပေါင်း: ${totalVideos} ခု\n` +
`👥 Follower အရေအတွက်: ${totalFollowers} ယောက်`;

    await ctx.answerCallbackQuery();
    await ctx.reply(profileText, { parse_mode: 'HTML' });
  });

  bot.command('watch', async (ctx) => {
    const chatId = ctx.from.id.toString();
    const user = await User.findOne({ chatId });
    
    const videos = await Video.find({
      $or: [
        { visibility: 'public' },
        { chatId: chatId },
        { chatId: { $in: user ? user.following : [] } }
      ]
    });

    if (videos.length === 0) return ctx.reply('📭 လောလောဆယ် တင်ထားသော ဗီဒီယို မရှိပါ။');
    await sendVideoFeed(ctx, 0, videos, 'all');
  });

  bot.command('friends', async (ctx) => {
    const chatId = ctx.from.id.toString();
    const user = await User.findOne({ chatId });
    if (!user) return ctx.reply('⚠️ အရင်ဆုံး အကောင့်ဖွင့်ပါ။');

    const videos = await Video.find({ 
      chatId: { $in: user.following },
      $or: [{ visibility: 'public' }, { visibility: 'friends' }]
    });

    if (videos.length === 0) {
      return ctx.reply('📭 သူငယ်ချင်းများထံမှ ဗီဒီယို မရှိသေးပါ။');
    }
    await sendVideoFeed(ctx, 0, videos, 'friends');
  });

  bot.callbackQuery(/next_(.+)_(.+)/, async (ctx) => {
    const mode = ctx.match[1];
    const index = parseInt(ctx.match[2]);
    const chatId = ctx.from.id.toString();
    const user = await User.findOne({ chatId });
    
    let videos;
    if (mode === 'friends') {
      videos = await Video.find({ chatId: { $in: user ? user.following : [] } });
    } else {
      videos = await Video.find({ $or: [{ visibility: 'public' }, { chatId: chatId }] });
    }

    try { await ctx.deleteMessage(); } catch (err) {}
    await sendVideoFeed(ctx, index, videos, mode);
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/like_(.+)_(.+)_(.+)/, async (ctx) => {
    const videoId = ctx.match[1];
    const mode = ctx.match[2];
    const index = parseInt(ctx.match[3]);
    const chatId = ctx.from.id.toString();
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
      
      const user = await User.findOne({ chatId });
      const videos = mode === 'friends' 
        ? await Video.find({ chatId: { $in: user ? user.following : [] } })
        : await Video.find({ $or: [{ visibility: 'public' }, { chatId: chatId }] });

      try { await ctx.deleteMessage(); } catch (err) {}
      await sendVideoFeed(ctx, index, videos, mode);
    }
  });

  bot.callbackQuery(/comment_(.+)_(.+)_(.+)/, async (ctx) => {
    const videoId = ctx.match[1];
    const mode = ctx.match[2];
    const index = parseInt(ctx.match[3]);
    const chatId = ctx.from.id.toString();

    tempComment[chatId] = { videoId, mode, index };
    await ctx.answerCallbackQuery();
    await ctx.reply('💬 ဤဗီဒီယိုအတွက် Comment ရေးရန် စာသားကို ပို့ပေးပါ -');
  });

  bot.callbackQuery(/follow_(.+)_(.+)_(.+)/, async (ctx) => {
    const targetChatId = ctx.match[1];
    const mode = ctx.match[2];
    const index = parseInt(ctx.match[3]);
    const chatId = ctx.from.id.toString();

    if (chatId === targetChatId) {
      return ctx.answerCallbackQuery({ text: '⚠️ ကိုယ့်ကိုကိုယ် Follow လုပ်၍ မရပါ။', show_alert: true });
    }

    const user = await User.findOne({ chatId });
    if (user) {
      if (!user.following.includes(targetChatId)) {
        user.following.push(targetChatId);
        await ctx.answerCallbackQuery({ text: '🤝 Friend အဖြစ် Follow လုပ်ပြီးပါပြီ!' });
      } else {
        user.following = user.following.filter(id => id !== targetChatId);
        await ctx.answerCallbackQuery({ text: '👋 Unfollow လုပ်လိုက်ပါပြီ။' });
      }
      await user.save();

      const videos = mode === 'friends' 
        ? await Video.find({ chatId: { $in: user.following } })
        : await Video.find({ $or: [{ visibility: 'public' }, { chatId: chatId }] });

      try { await ctx.deleteMessage(); } catch (err) {}
      await sendVideoFeed(ctx, index, videos, mode);
    }
  });

  bot.callbackQuery(/delete_(.+)/, async (ctx) => {
    const videoId = ctx.match[1];
    const chatId = ctx.from.id.toString();
    const vid = await Video.findOne({ videoId });

    if (vid && vid.chatId === chatId) {
      await Video.deleteOne({ videoId });
      await ctx.answerCallbackQuery({ text: '🗑️ ဗီဒီယို ဖျက်ပြီးပါပြီ' });
      try { await ctx.deleteMessage(); } catch (err) {}
      await ctx.reply('✅ သင့်ဗီဒီယိုကို ဖျက်လိုက်ပါပြီ။');
    }
  });

  async function sendVideoFeed(ctx, index, videos, mode) {
    if (index >= videos.length) index = 0;
    if (index < 0) index = videos.length - 1;

    const vid = videos[index];
    const chatId = ctx.from.id.toString();
    const author = await User.findOne({ chatId: vid.chatId });
    const authorName = author ? author.name : 'Unknown User';
    const isMyVideo = vid.chatId === chatId;
    const user = await User.findOne({ chatId });
    const isFollowing = user && user.following.includes(vid.chatId);

    let commentList = '';
    if (vid.comments && vid.comments.length > 0) {
      commentList = '\n\n💬 <b>Comments:</b>\n' + vid.comments.slice(-3).map(c => `• <b>${c.name}:</b> ${c.text}`).join('\n');
    }

    const keyboard = new InlineKeyboard()
      .text(`👤 ${authorName} (Profile)`, `profile_${vid.chatId}`)
      .row()
      .text(`❤️ (${vid.likes.length})`, `like_${vid.videoId}_${mode}_${index}`)
      .text(`💬 (${vid.comments.length})`, `comment_${vid.videoId}_${mode}_${index}`)
      .row();

    if (isMyVideo) {
      keyboard.text('🗑️ Delete', `delete_${vid.videoId}`).row();
    } else {
      const followText = isFollowing ? '✓ Following' : '➕ Follow';
      keyboard.text(followText, `follow_${vid.chatId}_${mode}_${index}`).row();
    }

    keyboard.text('➡️ နောက်တစ်ပုဒ်', `next_${mode}_${index + 1}`);

    await ctx.replyWithVideo(vid.fileId, {
      caption: `🎬 <i>${vid.caption}</i>${commentList}`,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  }
}

module.exports = setupMediaFeed;
