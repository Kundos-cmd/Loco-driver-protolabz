const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();
const verifyToken = (req, res, next) => {
    // Get the token from the request headers
    let token = req.headers.authorization;

    
    if (token && token.startsWith('"') && token.endsWith('"')) {
        // Remove double quotation marks
        token = token.slice(1, -1);
    }
    
    // Check if token exists
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        console.log(process.env.JWT_SECRET_KEY);
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

        if(!decoded || decoded.role !== "admin") {
            return res.status(401).json({ message: 'Not Authorized' });
        }

        // Attach the decoded token to the request object
        req.user = decoded;

        // Call the next middleware or route handler
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = verifyToken;