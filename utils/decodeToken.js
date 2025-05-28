const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();


const decodeToken = ('/decodeToken', (req, res) => {
    const { token } = req.body;

    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY);
        console.log(decodedToken);
        res.status(200).send(decodedToken);
    } catch (error) {
        res.status(400).json({ error: 'Invalid token' });
    }
});
module.exports = decodeToken;