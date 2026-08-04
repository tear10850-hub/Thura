import logging
import os
import random
from datetime import datetime
from collections import Counter
from telegram import Update, ChatAction
from telegram.ext import Updater, CommandHandler, MessageHandler, Filters, CallbackContext
from pymongo import MongoClient

# Logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Environment Variables
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
MONGO_URI = os.getenv("MONGO_URI")

if not TELEGRAM_TOKEN:
    logger.error("TELEGRAM_TOKEN not found!")
if not MONGO_URI:
    logger.error("MONGO_URI not found!")

# Blocked content
BLOCKED_WORDS = ["အောက်", "လိင်", "sex", "fuck", "shit", "bitch", "ဒုစရိုက်"]
BLOCKED_EMOJIS = ["🍆", "🍑", "💦", "🔞", "👅", "🍌"]

# MongoDB Connection
try:
    client = MongoClient(MONGO_URI)
    db = client["smart_bot_db"]
    messages_collection = db["messages"]
    stats_collection = db["stats"]
    logger.info("MongoDB connected successfully!")
except Exception as e:
    logger.error(f"MongoDB connection error: {e}")

# ==================== COMMAND HANDLERS ====================

def start(update: Update, context: CallbackContext):
    """/start command"""
    welcome = """🤖 **Smart Bot မှ ကြိုဆိုပါတယ်!**

✨ **ကျွန်တော် ဘာတွေလုပ်ပေးနိုင်လဲ?**

📝 **စာသိမ်းခြင်း** - သင်ပြောသမျှ စာတွေကို မှတ်ထားမယ်
🧠 **စမတ်ကျတဲ့ အဖြေ** - အကြောင်းအရာအလိုက် သင့်တော်တဲ့ အဖြေကို ရွေးပေးမယ်
📊 **စာရင်းအင်း** - ဘယ်စာတွေ များများသုံးလဲ ပြပေးမယ်
🎯 **အကြံပြုချက်** - သင်ပြောချင်တဲ့ အကြောင်းအရာအလိုက် စာတွေ ပြန်ဖြေမယ်

🔧 **Command များ:**
/stats - စာရင်းအင်းကြည့်ရန်
/top - အသုံးအများဆုံး စာများ
/help - အကူအညီ
/about - ကျွန်တော်အကြောင်း

😊 **စကားပြောကြရအောင်!**"""
    update.message.reply_text(welcome, parse_mode='Markdown')

def stats(update: Update, context: CallbackContext):
    """/stats - Show statistics"""
    try:
        total_messages = messages_collection.count_documents({})
        
        # Get today's messages
        today = datetime.now().strftime("%Y-%m-%d")
        today_messages = messages_collection.count_documents({"date": today})
        
        # Get top users
        top_users = messages_collection.aggregate([
            {"$group": {"_id": "$user", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 5}
        ])
        
        stats_text = f"""📊 **စာရင်းအင်းများ**

📝 **စုစုပေါင်း စာရိုက်မှု:** {total_messages}
📅 **ယနေ့ ရိုက်မှု:** {today_messages}
👥 **အများဆုံး ရိုက်သူများ:**

"""
        for user in top_users:
            stats_text += f"• {user['_id']}: {user['count']} ကြိမ်\n"
            
        update.message.reply_text(stats_text, parse_mode='Markdown')
    except Exception as e:
        logger.error(f"Stats error: {e}")
        update.message.reply_text("❌ စာရင်းအင်း ယူလို့မရပါ။")

def top_messages(update: Update, context: CallbackContext):
    """/top - Show most used messages"""
    try:
        all_messages = list(messages_collection.find({}, {"_id": 0, "text": 1}))
        if not all_messages:
            update.message.reply_text("📭 စာတွေ မရှိသေးပါဘူး။")
            return
            
        # Count frequency
        texts = [msg['text'] for msg in all_messages]
        counter = Counter(texts)
        most_common = counter.most_common(10)
        
        top_text = "🏆 **အသုံးအများဆုံး စာများ**\n\n"
        for i, (text, count) in enumerate(most_common, 1):
            top_text += f"{i}. {text[:30]}... ({count} ကြိမ်)\n"
            
        update.message.reply_text(top_text, parse_mode='Markdown')
    except Exception as e:
        logger.error(f"Top messages error: {e}")
        update.message.reply_text("❌ ကြည့်လို့မရပါ။")

def about(update: Update, context: CallbackContext):
    """/about - Bot info"""
    about_text = """🤖 **Smart Bot v2.0**

🧠 **ကျွန်တော်က ဘယ်သူလဲ?**
ကျွန်တော်က အဆိုတီပုံစံ စမတ်ကျတဲ့ Bot ပါ။ လူတွေပြောတဲ့ စာတွေကို မှတ်ထားပြီး အခြေအနေအလိုက် သင့်တော်တဲ့ အဖြေကို ရွေးပေးတယ်။

🎯 **ကျွန်တော် ဘယ်လိုအလုပ်လုပ်လဲ?**
• စာတွေကို အကြောင်းအရာအလိုက် စုစည်းတယ်
• အသုံးအများဆုံး စာတွေကို ဦးစားပေးတယ်
• သင်နဲ့ ပိုသင့်တော်တဲ့ အဖြေကို ရွေးပေးတယ်

📅 **Update:** {datetime.now().strftime("%Y-%m-%d")}

💡 **အကြံပြုချက်:** များများပြောလေ ကျွန်တော် ပိုတော်လာလေ!"""
    update.message.reply_text(about_text, parse_mode='Markdown')

def help_command(update: Update, context: CallbackContext):
    """/help - Show help"""
    help_text = """❓ **အကူအညီ**

🔹 **ဘယ်လိုသုံးရမလဲ?**
သင်ပြောချင်တဲ့ စာကို ရိုက်လိုက်ရုံပါပဲ။ ကျွန်တော် သင့်တော်တဲ့ အဖြေကို ပြန်ပေးမယ်။

🔹 **ဘာတွေလုပ်ပေးနိုင်လဲ?**
• စကားပြော
• အကြံပြုချက်ပေး
• စာရင်းအင်းပြ
• အကြောင်းအရာအလိုက် ဖြေကြား

🔹 **Command များ:**
• /start - စတင်ရန်
• /stats - စာရင်းအင်းကြည့်
• /top - အသုံးများဆုံး စာများ
• /about - ကျွန်တော်အကြောင်း
• /help - ဒီအကူအညီ

😊 **ပျော်ရွှင်စွာ သုံးစွဲပါ!**"""
    update.message.reply_text(help_text, parse_mode='Markdown')

# ==================== MESSAGE HANDLER ====================

def smart_response(update: Update, context: CallbackContext):
    """Smart message handler"""
    try:
        message = update.message
        if not message:
            return
            
        user = message.from_user.username or message.from_user.first_name
        text = message.text if message.text else ""
        
        # ===== FILTERS =====
        # Block bad words
        if any(word in text.lower() for word in BLOCKED_WORDS):
            return
            
        # Block stickers
        if message.sticker:
            emoji = message.sticker.emoji if message.sticker.emoji else ""
            if any(e in emoji for e in BLOCKED_EMOJIS):
                return
            return
            
        # Skip photos
        if message.photo:
            return
            
        # Skip empty text
        if not text:
            return
            
        # ===== SAVE MESSAGE =====
        message_data = {
            "user": user,
            "text": text,
            "date": datetime.now().strftime("%Y-%m-%d"),
            "timestamp": datetime.now(),
            "word_count": len(text.split()),
            "char_count": len(text)
        }
        messages_collection.insert_one(message_data)
        
        # ===== FIND SMART REPLY =====
        # 1. Get all messages
        all_messages = list(messages_collection.find({}, {"_id": 0, "text": 1}))
        
        if not all_messages:
            await_typing(context.bot, message.chat_id)
            message.reply_text("📝 စတင်မှတ်သားနေပါပြီ... နောက်ထပ် စာတွေပြောပေးပါ။")
            return
            
        # 2. Check if text has question mark
        is_question = "?" in text or "?" in text or "လား" in text or "ရ" in text
        
        # 3. Smart selection based on keywords
        keywords = text.lower().split()
        related_messages = []
        
        for msg in all_messages:
            msg_text = msg['text'].lower()
            # Check if any keyword matches
            if any(keyword in msg_text for keyword in keywords[:3]):  # First 3 keywords
                related_messages.append(msg['text'])
        
        # 4. Choose reply
        if related_messages and len(related_messages) > 3:
            # Reply with related messages
            reply = random.choice(related_messages)
        elif is_question:
            # For questions, use most common answer
            common_replies = [
                "ကျွန်တော် အခုလေ့လာနေတယ်... နောက်မှ ပြန်ဖြေမယ်",
                "စိတ်ဝင်စားစရာပဲ! ဆက်ပြောပါဦး",
                "ဟုတ်ကဲ့... ကျွန်တော် နားလည်ပါတယ်",
                "ဒီအကြောင်း ပိုပြောပါဦး"
            ]
            reply = random.choice(common_replies)
        else:
            # Random reply from all messages
            reply = random.choice(all_messages)['text']
            
        # ===== SEND REPLY =====
        await_typing(context.bot, message.chat_id)
        
        # Add emoji based on mood
        emojis = ["😊", "🤔", "😄", "👍", "💪", "🔥"]
        if random.random() > 0.7:
            reply = f"{random.choice(emojis)} {reply}"
            
        message.reply_text(
            reply,
            reply_to_message_id=message.message_id
        )
        
        # ===== UPDATE STATS =====
        stats_collection.update_one(
            {"_id": "total"},
            {"$inc": {"messages": 1}},
            upsert=True
        )
        
        # Update user stats
        stats_collection.update_one(
            {"_id": f"user_{user}"},
            {"$inc": {"messages": 1}},
            upsert=True
        )
        
    except Exception as e:
        logger.error(f"Smart response error: {e}")
        message.reply_text("😅 နည်းနည်းတော့ ရှုပ်သွားတယ်... နောက်မှ ပြန်စမ်းပါ။")

def await_typing(bot, chat_id):
    """Send typing action"""
    try:
        bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
    except:
        pass

# ==================== MAIN ====================

def main():
    if not TELEGRAM_TOKEN or not MONGO_URI:
        print("❌ Bot cannot start. Check environment variables.")
        return

    updater = Updater(token=TELEGRAM_TOKEN, use_context=True)
    dp = updater.dispatcher

    # Add command handlers
    dp.add_handler(CommandHandler("start", start))
    dp.add_handler(CommandHandler("stats", stats))
    dp.add_handler(CommandHandler("top", top_messages))
    dp.add_handler(CommandHandler("about", about))
    dp.add_handler(CommandHandler("help", help_command))
    
    # Add message handler
    dp.add_handler(MessageHandler(
        Filters.text | Filters.sticker | Filters.photo, 
        smart_response
    ))

    logger.info("🤖 Smart Bot is starting...")
    updater.start_polling()
    updater.idle()

if __name__ == "__main__":
    main()
