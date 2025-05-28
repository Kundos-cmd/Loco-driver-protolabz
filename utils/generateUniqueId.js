const crypto = require("crypto");

const generateUniqueUserId = () => {
  const timestamp = Date.now().toString(); // Get current timestamp in milliseconds
  const hash = crypto.createHash("sha256").update(timestamp).digest("hex"); // Apply SHA-256 hash
  return hash.substring(0, 16); // Trim to the desired length
};

module.exports = generateUniqueUserId;
