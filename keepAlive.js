const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

function keepAlive() {
  app.get('/', (req, res) => {
    res.status(200).send('🤖 Bot is Awake and Running 24/7!');
  });

  app.listen(PORT, () => {
    console.log(`🌐 Web Server running on port ${PORT} for UptimeRobot monitoring.`);
  });
}

module.exports = keepAlive;
