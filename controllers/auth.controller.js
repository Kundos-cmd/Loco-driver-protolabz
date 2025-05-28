const express = require("express");
const pool = require("../config/db.config");
const { hash } = require("bcrypt");

const router = express.Router();

// POST /signup
router.post("/signup", (req, res) => {
  // Get the user data from the request body
  const { username, email, password } = req.body;

  // TODO: Implement user signup logic here
  // Return a success message
  res.json({ message: "User signup successful" });
});

module.exports = router;
