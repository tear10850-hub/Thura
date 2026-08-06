const mongoose = require('mongoose');

const startConfigSchema = new mongoose.Schema({
  videoId: { type: String, default: null },
  topText: { type: String, default: null },
  bottomText: { type: String, default: null },
  buttons: [{
    text: String,
    url: String
  }]
});

module.exports = mongoose.model('StartConfig', startConfigSchema);
