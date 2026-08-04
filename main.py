import logging
import os
import random
from telegram import Update  # ✅ ChatAction ကို သီးခြားထုတ်မယ်
from telegram.constants import ChatAction  # ✅ ဒီလိုထည့်ပါ
from telegram.ext import ApplicationBuilder, MessageHandler, CommandHandler, ContextTypes, filters
from pymongo import MongoClient

# Logging သတ်မှတ်ခြင်း
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# Render Environment Variables
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
MONGO_URI = os.getenv("MONGO_URI")

if not TELEGRAM_TOKEN:
    logger.error("TELEGRAM_TOKEN ကို Environment Variable ထဲတွင် မတွေ့ရပါ။")
if not MONGO_URI:
    logger.error("MONGO_URI ကို Environment Variable ထဲတွင် မတွေ့ရပါ။")

BLOCKED_EMOJIS = ["🍆", "🍑", "💦", "🔞"]

# MongoDB Connection
try:
    client = MongoClient(MONGO_URI)
    db = client["telegram_bot_db"]
    collection = db["group_messages"]
    client.admin.command('ping')
    logger.info("MongoDB သို့ အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ။")
except Exception as e:
    logger.error(f"MongoDB ချိတ်ဆက်ရာတွင် အမှားဖြစ်ပွားသည်: {e}")

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    welcome_text = "🤖 မင်္ဂလာပါ! ကျွန်တော် Bot စတင် အလုပ်လုပ်နေပါပြီခင်ဗျာ။"
    await update.message.reply_text(welcome_text)

async def handle_group_messages(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        message = update.message
        if not message:
            return

        if message.sticker:
            emoji = message.sticker.emoji if message.sticker.emoji else ""
            if any(e in emoji for e in BLOCKED_EMOJIS):
                return
            return

        if message.photo:
            return

        if message.text:
            user_text = message.text.strip()
            collection.insert_one({"user_text": user_text})

            all_messages = list(collection.find({}, {"_id": 0, "user_text": 1}))

            if all_messages:
                random_msg = random.choice(all_messages)["user_text"]
                
                await context.bot.send_chat_action(
                    chat_id=message.chat_id, 
                    action=ChatAction.TYPING
                )
                
                await message.reply_text(
                    random_msg, 
                    reply_to_message_id=message.message_id
                )
    except Exception as e:
        logger.error(f"Message ကိုင်တွယ်ရာတွင် Error ဖြစ်သည်: {e}")

def main():
    if not TELEGRAM_TOKEN or not MONGO_URI:
        print("❌ Bot ကို စတင်၍ မရပါ။ Environment Variables များကို စစ်ဆေးပါ။")
        return

    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()
    
    app.add_handler(CommandHandler("start", start_command))
    
    chat_filter = filters.TEXT | filters.Sticker.ALL | filters.PHOTO
    app.add_handler(MessageHandler(chat_filter, handle_group_messages))

    logger.info("🤖 Bot သည် Render ပေါ်တွင် တည်ငြိမ်စွာ စတင်အလုပ်လုပ်နေပါပြီ...")
    app.run_polling()

if __name__ == "__main__":
    main()
