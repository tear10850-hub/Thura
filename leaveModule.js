// နည်း ၁ - message:left_chat_member
bot.on('message:left_chat_member', async (ctx) => {
  console.log("======= LEFT_CHAT_MEMBER RECEIVED =======");
  console.log("Chat ID:", ctx.chat.id);
  console.log("User left:", ctx.message.left_chat_member?.first_name);
  console.log("=========================================");
  
  try {
    const member = ctx.message.left_chat_member;
    await sendLeaveMessage(ctx, member);
  } catch (err) {
    console.error("left_chat_member error:", err);
  }
});

// နည်း ၂ - chat_member
bot.on('chat_member', async (ctx) => {
  const oldStatus = ctx.chatMember.old_chat_member.status;
  const newStatus = ctx.chatMember.new_chat_member.status;
  const user = ctx.chatMember.new_chat_member.user;

  console.log("======= CHAT_MEMBER UPDATE =======");
  console.log("Chat ID:", ctx.chat.id);
  console.log("Old Status:", oldStatus);
  console.log("New Status:", newStatus);
  console.log("User:", user?.first_name);
  console.log("==================================");

  try {
    if (
      ['member', 'restricted', 'administrator'].includes(oldStatus) &&
      ['left', 'kicked'].includes(newStatus)
    ) {
      await sendLeaveMessage(ctx, user);
    }
  } catch (err) {
    console.error("chat_member leave error:", err);
  }
});
