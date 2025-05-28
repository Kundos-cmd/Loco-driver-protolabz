const db = require('../../index');
const { promisify } = require("util");


const queryAsync = promisify(db.query).bind(db);
exports.SubmitRequest = async (req, res) => {
  const { role, user_id } = req.body;

  if (!role || !user_id) {
    return res.status(400).json({ message: "role and user_id are required" });
  }

  try {
    // Check if an entry with the same role and user_id exists
    const queryCheck = `
        SELECT * FROM verificationRequest WHERE role = ? AND user_id = ?;
      `;
    const existingRequest = await queryAsync(queryCheck, [role, user_id]);
    console.log(existingRequest);
    if (existingRequest.length > 0) {
      const request = existingRequest[0]; // Get the first (and likely only) entry

      // Check if the status is "reverted"
      if (request.status === "reverted") {
        // Update the entry to set req_date to the current date and status to "submitted"
        const queryUpdate = `
            UPDATE verificationRequest 
            SET req_date = ?, status = 'submitted'
            WHERE role = ? AND user_id = ?;
          `;
        await queryAsync(queryUpdate, [new Date(), role, user_id]);

        return res
          .status(200)
          .json({ message: "Verification request submitted successfully" });
      } else {
        // If the status is not "reverted", return conflict
        return res
          .status(409)
          .json({ message: "A request is already submitted" });
      }
    }

    // If no entry exists, insert a new verification request
    const queryInsert = `
        INSERT INTO verificationRequest (role, user_id, req_date, status) 
        VALUES (?, ?, ?, 'submitted');
      `;
    await queryAsync(queryInsert, [role, user_id, new Date()]);

    res
      .status(201)
      .json({ message: "Verification request submitted successfully" });
  } catch (error) {
    console.error("Error submitting verification request:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.checkRequest = async (req, res) => {
    const { role, user_id } = req.body;
  
    if (!role || !user_id) {
      return res.status(400).json({ message: "role and user_id are required" });
    }
  
    try {
      // Check if an entry with the same role and user_id exists
      const queryCheck = `
        SELECT * FROM verificationRequest WHERE role = ? AND user_id = ?;
      `;
      const existingRequest = await queryAsync(queryCheck, [role, user_id]);
  
      if (existingRequest.length > 0) {
        const request = existingRequest[0]; // Get the first matching entry
  
        // Check the status and return appropriate message
        if (request.status === 'submitted') {
          return res.status(200).json({
            message: "Verification request is submitted and is being reviewed.",
            status: 'submitted',
            exists: true,
            data: request, // Optional: Return the request data
          });
        } else if (request.status === 'completed') {
          return res.status(200).json({
            message: "Your documents are verified by Locoriver.",
            status: 'completed',
            exists: true,
            data: request, // Optional: Return the request data
          });
        } else {
          return res.status(200).json({
            message: `Request found with status: ${request.status}`,
            status: request.status,
            exists: true,
            data: request, // Optional: Return the request data
          });
        }
      } else {
        // No entry found, return not found
        return res.status(400).json({
          message: "No entry found with this role and user_id",
          exists: false,
        });
      }
    } catch (error) {
      console.error("Error checking verification request:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };
  
  