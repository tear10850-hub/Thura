const { InlineKeyboard } = require('grammy');
const { User, Video } = require('./models');

const tempUpload = {};
const tempComment = {};
const bannedKeywords = ['18+', 'sex', 'porn', 'xxx', 'adult', 'nude', 'nsfw'];

function setupMediaFeed(bot) {
  
  // 1. ဗီဒီယိုဖိုင် ပို့လိုက်လျှင် Duration (၁ မိနစ်) နှင့် 18+ စစ်ဆေးခြင်း (message:video ဟု ပြင်ဆင်ထားသည်)
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

    // 🕒 ၁ မိနစ် (စက္ကန့် ၆၀) ထက် ကျော်လွန်ပါက လက်မခံရန်
    if (duration > 60) {
      return ctx.reply('⚠️ ဗီဒီယိုသည် အများဆုံး ၁ မိနစ် (စက္ကန့် ၆၀) ထက် ကျော်လွန်၍ မရပါ။ ကျေးဇူးပြု၍ အတို ပို့ပေးပါ။');
    }

    // 🚫 18+ မသင့်လျော်သော စာသားများ စစ်ဆေးခြင်း
    const lowerCaption = caption.toLowerCase();
    const is18Plus = bannedKeywords.some(keyword => lowerCaption.includes(keyword));

    if (is18Plus) {
      return ctx.reply('❌ **မသင့်လျော်သော (18+) ဗီဒီယို သို့မဟုတ် ခေါင်းစဉ်များ တင်ခွင့်မပြုပါ။**');
    }

    tempUpload[chatId] = { fileId: videoFileId, caption };

    const keyboard = new InlineKeyboard()
      .text('🌍 အများသုံး (Public)', 'privacy_public')
      .text('👥 သူငယ်ချင်းများသာ (Friends Only)', 'privacy_friends');

    await ctx.reply('🔒 ဤဗီဒီယိုကို မည်သူတွေ ကြည့်ခွင့်ရှိရမလဲ ရွေးချယ်ပါ -', { reply_markup: keyboard });
  });

  bot.callbackQuery(/privacy_(.+)/, async (ctx) => {
    const visibility = ctx.match[1];
    const chatId = ctx.from.id.toString();
    const uploadData = tempUpload[chatId];

    if (!uploadData) {
      return ctx.answerCallbackQuery({ text: '⚠️ အချက်အလက် မရှိတော့ပါ။ ဗီဒီယိုကို ထပ်တင်ပါ။', show_alert: true });
    }

    const newVideo = new Video({
      videoId: Date.now().toString(),
      chatId: chatId,
      fileId: uploadData.fileId,
      caption: uploadData.caption || 'ခေါင်းစဉ် မပါရှိပါ',
      visibility: visibility,
      likes: [],
      comments: []
    });

    await newVideo.save();
    delete tempUpload[chatId];

    await ctx.answerCallbackQuery({ text: '✅ ဗီဒီယို အောင်မြင်စွာ တင်ပြီးပါပြီ!' });
    try { await ctx.deleteMessage(); } catch (err) {}

    await ctx.reply('🎉 သင့်ဗီဒီယိုကို အောင်မြင်စွာ တင်ပြီးပါပြီ! 🎬 ဤတွင် ကြည့်ရှုနိုင်ပါသည် -');
    const videos = await Video.find({ $or: [{ visibility: 'public' }, { chatId: chatId }] });
    await sendVideoFeed(ctx, videos.length - 1, videos, 'all');
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
}

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

module.exports = setupMediaFeed;
