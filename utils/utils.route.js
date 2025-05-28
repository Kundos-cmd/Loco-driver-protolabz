const decodeToken = require("./decodeToken");
const generateToken = require("./generateToken");


var router = require("express").Router();

router.post('/generate-token', generateToken);
router.post('/decode-token', decodeToken);

module.exports = router;