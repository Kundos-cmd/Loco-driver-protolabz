const db = require("../index");
const dotenv = require("dotenv");
dotenv.config();

// Promisified database query function
const queryDatabase = (query, params) => {
  return new Promise((resolve, reject) => {
    db.query(query, params, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]); // Assuming you expect only one result
      }
    });
  });
};

const getChatId = async (req, res) => {
  const { id, role } = req.body;

  console.log("Received ID:", id);
  console.log("Received Role:", role);

  try {
    let query;
    if (role === "company") {
      query = `SELECT chat_id FROM companies WHERE id = ?`;
    } else if (role === "operator") {
      query = `SELECT chat_id FROM operators WHERE id = ?`;
    } else if (role === "admin") {
      query = `SELECT chat_id FROM admins WHERE id = ?`;
    } else {
      return res.status(400).json({ error: "Invalid role provided" });
    }

    const user = await queryDatabase(query, [id]);
    console.log("User:", user);

    if (!user || !user.chat_id) {
      return res.status(404).json({ error: "User or chat ID not found" });
    }

    res.status(200).json({ chat_id: user.chat_id });
  } catch (error) {
    console.error("Error fetching chat ID:", error.message);
    res.status(500).json({ error: "Failed to retrieve chat ID" });
  }
};

module.exports = getChatId;
