const database = require("../index");
const { promisify } = require("util");
const notify = require("./send-notification");

const queryAsync = promisify(database.query).bind(database);

const sendChatNotification = async (req, res) => {
  const { sender, receiver } = req.body;

  if (!sender || !receiver) {
    return res.status(400).send({
      message: "Sender and receiver are required in the body.",
    });
  }

  try {
    // Queries with corresponding roles
    const queries = [
      {
        query: "SELECT notification_id FROM operators WHERE chat_id = ?",
        role: "operator",
      },
      {
        query: "SELECT notification_id FROM admins WHERE chat_id = ?",
        role: "admin",
      },
      {
        query: "SELECT notification_id FROM companies WHERE chat_id = ?",
        role: "company",
      },
    ];

    let result = null;
    let role = null;

    // Execute queries sequentially
    for (const { query, role: currentRole } of queries) {
      result = await queryAsync(query, [receiver]);
      if (result.length > 0) {
        role = currentRole; // Capture the role when a match is found
        break; // Exit loop once notification_id is found
      }
    }

    if (result && result.length > 0) {
      const sId = result[0].notification_id;

      // Construct the notification URL
      const notificationUrl = `/${role}/chat/${sender}`;

      // Send the notification
      await notify(sId, notificationUrl, "You have new unread messages");
      console.log(`Notification sent successfully to ${role} with ID: ${sId}`);

      res.status(200).send({
        message: "Notification sent successfully.",
      });
    } else {
      console.error(`No matching entry found for receiver=${receiver}.`);
      res.status(404).send({
        message: "Notification sending failed. No matching receiver found.",
      });
    }
  } catch (err) {
    // Error handling
    console.error("Error executing query: ", err);

    res.status(500).send({
      message: "Error occurred while sending notification.",
      error: err.message, // Include error details for debugging
    });
  }
};

module.exports = sendChatNotification;
