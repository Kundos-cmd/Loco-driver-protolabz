const database = require("../../index");
const { promisify } = require("util");

const queryAsync = promisify(database.query).bind(database);


async function getCompanyNotificationId(companyId) {
    try {
      const query = "SELECT notification_id FROM companies WHERE id = ?";
      const result = await queryAsync(query, [companyId]);
  
      if (!result || result.length === 0) {
        throw new Error("Company not found.");
      }
  
      return result[0].notification_id;
    } catch (err) {
      // Re-throw the error to handle it in the calling function
      throw new Error(err.message || "Error fetching company's notification_id.");
    }
  }
  
  const getCompanyEmail = async(id) =>{
    if(!id){
      throw new Error('Id is required to fetch email');
    }
    try {
      const query = "SELECT email FROM companies WHERE id = ?";
      const result = await queryAsync(query, [id]);
  
      if (!result || result.length === 0) {
        throw new Error("Company not found.");
      }
  
      return result[0].email;
    } catch (err) {
      // Re-throw the error to handle it in the calling function
      throw new Error(err.message || "Error fetching company's email");
    }
  }
  module.exports = {getCompanyNotificationId, getCompanyEmail};
