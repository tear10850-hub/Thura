import logging
import os
import random
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
    exit()
if not MONGO_URI:
    logger.error("MONGO_URI not found!")
    exit()

# MongoDB Connection
try:
    client = MongoClient(MONGO_URI)
    db = client["telegram_bot_db"]
    collection = db["group_messages"]
    logger.info("✅ MongoDB connected successfully!")
except Exception as e:
    logger.error(f"MongoDB connection error: {e}")
    exit()

def start(update: Update, context: CallbackContext):
    update.message.reply_text("🤖 မင်္ဂလာပါ! Bot အလုပ်လုပ်နေပါပြီ။")

def handle_messages(update: Update, context: CallbackContext):
    try:
        message = update.message
        if not message or not message.text:
            return
            
        user_text = message.text.strip()
        
        # Save to MongoDB
        collection.insert_one({"user_text": user_text})
        logger.info(f"Saved: {user_text[:30]}...")
        
        # Get all messages
        all_messages = list(collection.find({}, {"_id": 0, "user_text": 1}))
        
        if all_messages:
            random_msg = random.choice(all_messages)["user_text"]
            
            # Show typing
            context.bot.send_chat_action(
                chat_id=message.chat_id,
                action=ChatAction.TYPING
            )
            
            # Reply
            message.reply_text(
                random_msg,
                reply_to_message_id=message.message_id
            )
            
    except Exception as e:
        logger.error(f"Error: {e}")

def main():
    updater = Updater(token=TELEGRAM_TOKEN, use_context=True)
    dp = updater.dispatcher

    dp.add_handler(CommandHandler("start", start))
    dp.add_handler(MessageHandler(Filters.text, handle_messages))

    logger.info("🤖 Bot is starting...")
    updater.start_polling()
    updater.idle()

if __name__ == "__main__":
    main()
