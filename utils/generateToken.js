// make a route to generate token from data sent in request body

const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const generateToken = (req,res) => {
    const email = req.body.email;
    const token = jwt.sign({email: email}, process.env.JWT_SECRET_KEY, {expiresIn: '30m'});
    res.send({token: token});
} 

module.exports = generateToken;