const database = require("../../index");
const { promisify } = require("util");

const queryAsync = promisify(database.query).bind(database);


async function getAdminNotificationId(adminId) {
    try {
      const query = "SELECT notification_id FROM admins WHERE id = ?";
      const result = await queryAsync(query, [adminId]);
  
      if (!result || result.length === 0) {
        throw new Error("Admin not found.");
      }
  
      return result[0].notification_id;
    } catch (err) {
      // Re-throw the error to handle it in the calling function
      throw new Error(err.message || "Error fetching admin's notification_id.");
    }
  }
  
  module.exports = getAdminNotificationId;
