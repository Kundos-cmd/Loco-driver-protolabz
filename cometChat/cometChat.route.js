const getChatId = require('./cometChat.getUser')
const sendChatNotification = require('../novu/send-chat-notification');

var router = require("express").Router();


router.post('/getChatId', getChatId);
router.post('/send-chat-notification', sendChatNotification);

module.exports = router;