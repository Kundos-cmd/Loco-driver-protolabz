const {sendVerificationEmail} = require('../services/email.send');
const {sendResetEmail} = require('../services/email.send');
const generateToken = require('../utils/generateToken');
const {verifyEmail} = require('../services/email.verify');
const {updateToken} = require('../services/email.verify');
const verifyToken = require('../middleware/auth');

var router = require("express").Router();


router.post("/verify-email/", verifyEmail);
// router.post('/send-email', sendVerificationEmail);
// router.post('/send-reset-email', sendResetEmail);
router.post('/verify-token', verifyToken);
router.post('/generate-token', generateToken);
router.post('/update-token',updateToken );

module.exports = router;