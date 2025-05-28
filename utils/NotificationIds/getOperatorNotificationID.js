const database = require("../../index");
const { promisify } = require("util");
const queryAsync = promisify(database.query).bind(database);


async function getOperatorNotificationId(operatorId) {
    try {
      const query = "SELECT notification_id FROM operators WHERE id = ?";
      const result = await queryAsync(query, [operatorId]);
  
      if (!result || result.length === 0) {
        throw new Error("Operator not found.");
      }
  
      return result[0].notification_id;
    } catch (err) {
      // Re-throw the error to handle it in the calling function
      throw new Error(err.message || "Error fetching operator's notification_id.");
    }
  }

  const getOperatorEmail = async(id) =>{
    if(!id){
      throw new Error('Id is required to fetch email');
    }
    try {
      const query = "SELECT email FROM operators WHERE id = ?";
      const result = await queryAsync(query, [id]);
  
      if (!result || result.length === 0) {
        throw new Error("Operator not found.");
      }
  
      return result[0].email;
    } catch (err) {
      // Re-throw the error to handle it in the calling function
      throw new Error(err.message || "Error fetching operator's email");
    }
  }
  
  module.exports = {getOperatorNotificationId, getOperatorEmail};

