const { promisify } = require("util");
const db = require("../index");
const crypto = require("crypto");

const queryAsync = promisify(db.query).bind(db);

const verifyToken = async (req, res) => {
  const token = req.body.token;
  const email = req.body.email;
  let user = req.body.role;

  switch (user) {
    case "operator":
      user = "operators";
      break;
    case "company":
      user = "companies";
      break;
    case "admin":
      user = "admins";
      break;
    default:
      user = "";
      break;
  }

  try {
    const query = `SELECT * FROM ${user} WHERE email = ?`;
    // Query the database to find the user by email
    const result = await queryAsync(query, [email]);

    if (result.length === 0) {
      return res.send({ message: "User Not Found" });
    }

    console.log(result[0]);
    // Check if the provided token matches the one in the database
    if (result[0].emailToken === token) {
      // Update user emailToken to empty and set verified to true
      await queryAsync(`UPDATE ${user} SET emailToken = '', WHERE email = ?`, [
        email,
      ]);
      return res.send({ message: "Link Verified" });
    } else {
      return res.send({ message: "Invalid Token" });
    }
  } catch (err) {
    console.error(err);
    return res.send({ message: "An error occurred during verification" });
  }
};
const verifyEmail = async (req, res) => {
  const token = req.body.token;
  const email = req.body.email;
  let user = req.body.role;

  switch (user) {
    case "operator":
      user = "operators";
      break;
    case "company":
      user = "companies";
      break;
    case "admin":
      user = "admins";
      break;
    default:
      user = "";
      break;
  }

  try {
    const query = `SELECT * FROM ${user} WHERE email = ?`;
    // Query the database to find the user by email
    const result = await queryAsync(query, [email]);

    if (result.length === 0) {
      return res.send({ message: "User Not Found" });
    }

    console.log(result[0]);

    // Check if the user's email is already verified
    if (result[0].verified === "true") {
      return res.send({ message: "Email Already Verified" });
    }

    // Check if the provided token matches the one in the database
    if (result[0].emailToken === token) {
      // Update user emailToken to empty and set verified to true
      await queryAsync(
        `UPDATE ${user} SET emailToken = '', verified = 'true' WHERE email = ?`,
        [email]
      );
      return res.send({ message: "Email Verified" });
    } else {
      return res.send({ message: "Invalid Token" });
    }
  } catch (err) {
    console.error(err);
    return res.send({ message: "An error occurred during verification" });
  }
};

const updateToken = async (req, res) => {
  const { email } = req.body;
  let { role } = req.body;

  switch (role) {
    case "company":
      role = "companies";
      break;
    case "operator":
      role = "operators";
      break;
    default:
      break;
  }

  try {
    const token = crypto.randomBytes(32).toString("hex");

    const query = `SELECT * FROM ${role} WHERE email = ?`;
    // Query the database to find the user by email
    const result = await queryAsync(query, [email]);

    if (result.length > 0) {
      const query = `UPDATE ${role} SET emailToken = ? WHERE email = ?`;
      await queryAsync(query, [token, result[0].email]);
      res.send({ token });
    } else {
      res.send({ message: "user not found" });
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
};

module.exports = { updateToken, verifyEmail, verifyToken };
