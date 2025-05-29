const database = require("../../index");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { promisify } = require("util");
const { default: axios } = require("axios");
const createNovuSubscriber = require("../../novu/create-subscriber");
const notify = require("../../novu/send-notification"); // Adjust import path as needed
const companies = require("../company/company.controller");
const generateUniqueUserId = require("../../utils/generateUniqueId");
const dotenv = require("dotenv");
dotenv.config();
const { sendVerificationEmail } = require("../../novu/send-verification-email");
const { sendResetEmail } = require("../../novu/send-verification-email");
const sendNotificationEmail = require("../../novu/send-notification-email");

const getAdminNotificationId = require("../../utils/NotificationIds/getAdminNotifiationId");
const {
  getCompanyNotificationId,
  getCompanyEmail,
} = require("../../utils/NotificationIds/getCompanyNotificationId");
const getOperatorNotificationId = require("../../utils/NotificationIds/getOperatorNotificationID");

const bodyParser = require("body-parser");
const express = require("express");
const app = express();

app.use(bodyParser.json());

// Promisify the query function
const queryAsync = promisify(database.query).bind(database);

const createUserInCometChat = async (userId, name, profileUrl) => {
  return await axios.post(
    `https://${process.env.COMETCHAT_APP_ID}.api-${process.env.COMETCHAT_REGION}.cometchat.io/v3/users`,
    {
      uid: userId,
      name: name,
      avatar: profileUrl,
      withAuthToken: true,
    },
    {
      headers: {
        "Content-Type": "application/json; charset=utf8",
        apikey: process.env.COMETCHAT_API_KEY,
      },
    }
  );
};
exports.createUser = async (req, res) => {
  if (!req.body.email) {
    return res.status(400).send({
      message: "Email is required.",
    });
  }

  const hash = await bcrypt.hash(req.body.password, 10);
  const token = crypto.randomBytes(32).toString("hex");

  const operator = {
    name: req.body.name,
    company_name: req.body.company_name,
    email: req.body.email,
    password: hash,
    emailToken: token,
    createdAt: new Date(), // Set the creation date
    updatedAt: new Date(), // Set the update date
  };

  try {
    // Create a subscriber and get the subscriberId
    const subscriberId = await createNovuSubscriber(
      operator.name,
      operator.email,
      req.body.phone || "", // Assuming phone is part of req.body
      req.body.avatar ||
        "https://ik.imagekit.io/mja/pp-ph.png?updatedAt=1713673175390" // Assuming avatar is part of req.body
    );

    // SQL query to insert a new operator into the database
    const insertQuery = `
      INSERT INTO operators (name, company_name,email, password, emailToken, createdAt, updatedAt, notification_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;

    // Execute the query
    const result = await queryAsync(insertQuery, [
      operator.name,
      operator.company_name,
      operator.email,
      operator.password,
      operator.emailToken,
      operator.createdAt,
      operator.updatedAt,
      subscriberId, // Set the subscriberId as notification_id
    ]);

    const operatorId = result.insertId;

    // Create a chat user in CometChat
    const uid = generateUniqueUserId();
    await createUserInCometChat(
      uid,
      operator.name + ",operator",
      req.body.profileUrl ||
        "https://ik.imagekit.io/mja/pp-ph.png?updatedAt=1713673175390" // Assuming profileUrl is part of req.body
    );

    // Update the operator with the chat_id
    await queryAsync("UPDATE operators SET chat_id = ? WHERE id = ?", [
      uid,
      operatorId,
    ]);

    const link = `${process.env.REACT_APP_URL}/operator/verify/${operator.email}?t=${operator.emailToken}`;
    console.log(subscriberId);
    await sendVerificationEmail(operator.email, link, subscriberId);

    res.status(200).send({
      data: { id: operatorId, ...operator },
      chat_id: uid,
      notification_id: subscriberId,
    });
  } catch (err) {
    console.error(err);
    if (err.code && err.code === "ER_DUP_ENTRY") {
      return res.status(409).send({
        message: "Operator with this email already exists.",
      });
    }
    res.status(500).send({
      message:
        err.message || "Some error occurred while creating the operator.",
    });
  }
};

exports.verifyToken = async (req, res) => {
  const { email, token } = req.body;

  try {
    // Query the database to retrieve the token for the given email
    const query = `SELECT emailToken FROM operators WHERE email = ?`;
    const result = await queryAsync(query, [email]);

    if (result.length === 0) {
      // No user found with this email
      return res.status(404).send({ message: "User not found" });
    }

    // Check if the token matches
    const savedToken = result[0].emailToken;
    if (savedToken === token) {
      // Token matches
      res.send({ message: "Token verified successfully" });
    } else {
      // Token does not match
      res.status(400).send({ message: "Invalid token" });
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
};

exports.resetPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const token = crypto.randomBytes(32).toString("hex");

    const query = `SELECT * FROM operators WHERE email = ?`;
    // Query the database to find the user by email
    const result = await queryAsync(query, [email]);

    if (result.length > 0) {
      const query = `UPDATE operators SET emailToken = ? WHERE email = ?`;
      await queryAsync(query, [token, result[0].email]);
      const resp = await queryAsync(
        `SELECT notification_id FROM operators WHERE email = ?`,
        [email]
      );
      const sId = resp[0].notification_id;
      sendResetEmail(
        email,
        `${process.env.REACT_APP_URL}/operator/reset-password/${email}?t=${token}`,
        result[0].name
      );
      console.log("email sent");
      res.send({ message: "Reset Email Sent Successfully" });
    } else {
      res.status(400).send({ message: "user not found" });
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
};

exports.findAll = async (req, res) => {
  try {
    const query = `
      SELECT * FROM operators 
      WHERE is_Active IS NULL OR is_Active = true
    `;
    const data = await queryAsync(query);

    res.send(data);
  } catch (err) {
    res.status(500).send({
      message:
        err.message ||
        "Some errors occurred while retrieving active operators.",
    });
  }
};

exports.findOperatorByChatID = async (req, res) => {
  try {
    // Get the chat_id from the request parameters
    const { chat_id } = req.params;

    // SQL query to fetch the operator based on chat_id
    const query = `
      SELECT * FROM operators 
      WHERE chat_id = ?
    `;

    // Execute the query using the provided chat_id
    const data = await queryAsync(query, [chat_id]);

    // If no operator is found, return a 404 response
    if (data.length === 0) {
      return res.status(404).send({
        message: `No operator found with chat_id: ${chat_id}`,
      });
    }

    // Return the operator details in the response
    res.send(data[0]);
  } catch (err) {
    // Send a 500 error if something goes wrong
    res.status(500).send({
      message:
        err.message || "Some error occurred while retrieving the operator.",
    });
  }
};

exports.findAllOfThem = async (req, res) => {
  try {
    const query = "SELECT * FROM operators";
    const data = await queryAsync(query);

    res.send(data);
  } catch (err) {
    res.status(500).send({
      message:
        err.message || "Some errors occurred while retrieving operators.",
    });
  }
};

exports.deleteOperator = async (req, res) => {
  const id = req.params.id;

  if (!id) {
    return res.status(400).send({
      message: "Operator ID is required",
    });
  }

  try {
    const updatedAt = new Date(); // Set the update date
    const result = await queryAsync(
      "UPDATE operators SET is_Active = false, updatedAt = ? WHERE id = ?",
      [updatedAt, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send({
        message: "Operator not found or already inactive",
      });
    }

    res.status(200).send({
      message: "Operator marked as inactive successfully",
    });
  } catch (error) {
    res.status(500).send({
      message: "Error updating Operator with id=" + id,
    });
  }
};

exports.findOperatorById = async (req, res) => {
  const id = req.params.id;

  try {
    const query = `
    SELECT operators.*, about_us.content as about_us_content
    FROM operators 
    LEFT JOIN about_us ON operators.id = about_us.role_id AND about_us.role = 'operator'
    WHERE operators.id = ?`;
    // const query = "SELECT * FROM operators WHERE id = ?";
    const result = await queryAsync(query, [id]);

    if (result.length > 0) {
      res.send(result[0]);
    } else {
      res.status(404).send({
        message: `Cannot find Operator with id=${id}.`,
      });
    }
  } catch (err) {
    res.status(500).send({
      message: "Error retrieving Operator with id=" + id,
    });
  }
};

exports.updateAvatar = async (req, res) => {
  const { id, avatarUrl } = req.body;

  // Check if required fields are provided
  if (!id || !avatarUrl) {
    return res.status(400).json({ message: "id and avatarUrl are required." });
  }

  try {
    // Update the user's avatar URL in the database
    const query = `
      UPDATE operators
      SET profileUrl = ?
      WHERE id = ?;
    `;

    const result = await queryAsync(query, [avatarUrl, id]);

    // Check if the update affected any rows
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    // Success response
    return res
      .status(200)
      .json({ message: "Avatar updated successfully.", avatarUrl });
  } catch (error) {
    console.error("Error updating avatar:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.loginUser = async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  try {
    const query = "SELECT * FROM operators WHERE email = ?";
    const result = await queryAsync(query, [email]);

    if (result.length > 0) {
      const operator = result[0];
      if (operator.verified === "false") {
        res.status(400).send({
          message: "Verify your email to login",
        });
        return;
      }

      const isMatch = await bcrypt.compare(password, operator.password);

      if (isMatch) {
        const token = jwt.sign(
          { email: operator.email, name: operator.name },
          process.env.JWT_SECRET_KEY
        );

        res.send({
          id: operator.id,
          name: operator.name,
          role: "operator",
          token: token,
          chat_id: operator.chat_id,
          notification_id: operator.notification_id,
          profileUrl: operator.profileUrl,
        });
      } else {
        res.status(400).send({
          message: "Invalid Password",
        });
      }
    } else {
      res.status(400).send({
        message: "User Not Found",
      });
    }
  } catch (err) {
    res.status(500).send({
      message: "Error retrieving Operator with email=" + email,
    });
  }
};

exports.getUserByEmail = async (req, res) => {
  const email = req.body.email;

  try {
    const query = "SELECT * FROM operators WHERE email = ?";
    const result = await queryAsync(query, [email]);

    if (result.length > 0) {
      res.status(200).send(result[0]);
    } else {
      res.status(400).send({
        message: "User Not Found",
      });
    }
  } catch (err) {
    res.status(500).send({
      message: "Error retrieving Operator with email=" + email,
    });
  }
};

exports.updatePassword = async (req, res) => {
  const email = req.body.email;
  const id = req.body.id;
  const newPassword = req.body.password;
  const old = req.body.old; // New field to match the current password
  const token = req.body.token;

  try {
    const query = email
      ? `SELECT * FROM operators WHERE email ="${email}"`
      : `SELECT * FROM operators WHERE id=${id}`;
    const data = await queryAsync(query);

    if (data.length === 0) {
      res.status(400).send({
        message: "Operator Not Found.",
      });
      return;
    }

    const operator = data[0];
    console.log(operator, operator.password);

    // If `oldPass` is provided, validate it against the current password
    if (old) {
      const isOldPasswordValid = await bcrypt.compare(old, operator.password);
      if (!isOldPasswordValid) {
        res.status(400).send({
          message: "Current password is incorrect.",
        });
        return;
      }
    } else {
      // If `oldPass` is not provided, validate the token
      if (operator.emailToken != token) {
        res.status(400).send({
          message: "Reset link is broken. Try Again",
        });
        return;
      }
    }

    // Check if the new password is the same as the old password
    const isNewPasswordSame = await bcrypt.compare(
      newPassword,
      operator.password
    );
    if (isNewPasswordSame) {
      res.status(400).send({
        message: "New Password cannot be the same as the old password.",
      });
      return;
    }

    // Hash the new password and update it in the database
    const hash = await bcrypt.hash(newPassword, 10);
    const updatedAt = new Date(); // Set the update date
    console.log("pass", newPassword);
    await queryAsync(
      "UPDATE operators SET password = ?, updatedAt = ? WHERE email = ?",
      [hash, updatedAt, operator.email]
    );

    res.send({ message: "Password updated successfully." });
  } catch (err) {
    console.log(err);
    res.status(500).send({
      message: "Error updating password for operator with email=" + email,
    });
  }
};

exports.changeOperatorStatus = async (req, res) => {
  const id = req.params.id;
  const newStatus = req.query.status;

  try {
    const query = "SELECT * FROM operators WHERE id = ?";
    const result = await queryAsync(query, [id]);

    if (result.length === 0) {
      return res.status(404).send({
        message: `Cannot find operator with id=${id}.`,
      });
    }

    const updatedAt = new Date(); // Set the update date
    await queryAsync(
      "UPDATE operators SET status = ?, updatedAt = ? WHERE id = ?",
      [newStatus, updatedAt, id]
    );
    const updatedOperator = await queryAsync(
      "SELECT * FROM operators WHERE id = ?",
      [id]
    );

    res.send(updatedOperator[0]);
  } catch (err) {
    res.status(500).send({
      message: "Error updating operator with id=" + id,
    });
  }
};

exports.editOperator = async (req, res) => {
  const { id } = req.params; // Get the operator ID from the URL parameters
  console.log(req.body);
  const { name, email, address, contact, profileURL, description } = req.body; // Get the fields to update from the request body

  if (!id) {
    return res.status(400).json({ message: "Operator ID is required." });
  }

  // Prepare the updated fields object
  const updatedFields = {};

  if (name) updatedFields.name = name;
  if (email) updatedFields.email = email;
  if (address) updatedFields.address = address;
  if (contact) updatedFields.contact = contact;
  if (profileURL) updatedFields.profileUrl = profileURL;
  if (description) updatedFields.description = description;

  // Convert the fields to SQL `SET` syntax for raw query
  const fieldsToUpdate = Object.keys(updatedFields)
    .map((field) => `${field} = ?`)
    .join(", ");

  const valuesToUpdate = Object.values(updatedFields);
  console.log(fieldsToUpdate, valuesToUpdate);

  try {
    // Run the update query using queryAsync, with proper handling for the result
    const result = await queryAsync(
      `UPDATE operators SET ${fieldsToUpdate} WHERE id = ?`,
      [...valuesToUpdate, id]
    );

    // Check if the update affected any rows
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Operator not found." });
    }

    // Retrieve the updated operator record
    const updatedOperator = await queryAsync(
      `SELECT * FROM operators WHERE id = ?`,
      [id]
    );

    // Send the updated operator as the response
    res.status(200).json(updatedOperator[0]);
  } catch (error) {
    console.error("Error updating operator:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

//Requests

/*
exports.addRequest = async (req, res) => {
  console.log("Inside the controller add request");

  const {
    operator_id,
    company_id,
    requested_at,
    request_message,
    status,
    filters,
  } = req.body;

  console.log("Filters:", filters);

  // Validate essential fields
  if (
    !operator_id ||
    !company_id ||
    !requested_at ||
    !request_message ||
    !status
  ) {
    return res.status(400).json({
      message:
        "Insufficient fields: operator_id, company_id, requested_at, request_message, and status are required.",
    });
  }

  // Start with core fields
  const coreFields = {
    operator_id,
    company_id,
    requested_at,
    request_message,
    status,
  };

  // Add dynamic filters if present
  const dynamicFields = filters || {};

  // Combine core fields with dynamic fields
  const combinedFields = { ...coreFields, ...dynamicFields };
  console.log("Combined Fields:", combinedFields);

  // Construct SQL query and parameters dynamically
  const columns = Object.keys(combinedFields)
    .map(
      (col) =>
        // Handle column names with spaces by enclosing them in backticks
        `\`${col}\``
    )
    .join(", ");
  const values = Object.values(combinedFields);
  const placeholders = values.map(() => "?").join(", ");

  const sqlQuery = `INSERT INTO driveRequests (${columns}) VALUES (${placeholders})`;
  console.log("SQL Query:", sqlQuery);
  console.log("Operator");


  try {
    // Execute the query using queryAsync
    const result = await queryAsync(sqlQuery, values);

    res.status(201).json({
      id: result.insertId,
      ...combinedFields,
    });
  } catch (error) {
    console.error("Error executing query:", error.message);
    res.status(500).json({ message: "Error adding request" });
  }
};
*/

exports.addRequest = async (req, res) => {
  console.log("Inside the controller add request");

  const {
    operator_id,
    company_id,
    requested_at,
    request_message,
    status,
    filters,
    destination,
    departure,
  } = req.body;

  console.log("Filters:", filters);

  // Validate essential fields
  if (
    !operator_id ||
    !company_id ||
    !requested_at ||
    !request_message ||
    !status
  ) {
    return res.status(400).json({
      message:
        // "Insufficient fields: operator_id, company_id, requested_at, request_message, departure, destination, and status are required.",
        "Insufficient fields: operator_id, company_id, requested_at, request_message,  and status are required.",
    });
  }

  // Start with core fields
  const coreFields = {
    operator_id,
    company_id,
    requested_at,
    request_message,
    destination,
    departure,
    status,
  };

  // Add dynamic filters if present
  const dynamicFields = filters || {};

  // Combine core fields with dynamic fields
  const combinedFields = { ...coreFields, ...dynamicFields };
  console.log("Combined Fields:", combinedFields);

  // Construct SQL query and parameters dynamically
  const columns = Object.keys(combinedFields)
    .map(
      (col) =>
        // Handle column names with spaces by enclosing them in backticks
        `\`${col}\``
    )
    .join(", ");
  const values = Object.values(combinedFields);
  const placeholders = values.map(() => "?").join(", ");

  const sqlQuery = `INSERT INTO driveRequests (${columns}) VALUES (${placeholders})`;
  console.log("SQL Query:", sqlQuery);

  try {
    // Execute the query using queryAsync
    const result = await queryAsync(sqlQuery, values);

    // Fetch the company's subscriber ID (assuming you have a function to get it)
    const subscriberId = await getCompanyNotificationId(company_id);
    const actionUrl = `/company/requests/view-request/${result.insertId}`;
    const body = `You have a new drive request`;
    const email = await getCompanyEmail(company_id);

    // Send the notification
    notify(subscriberId, actionUrl, body);
    sendNotificationEmail(
      email,
      "New Drive Request",
      "You recieved a new drive request from an operator. Click View button below to learn more",
      `${process.env.REACT_APP_URL}${actionUrl}`,
      subscriberId
    );

    res.status(201).json({
      id: result.insertId,
      ...combinedFields,
    });
  } catch (error) {
    console.error("Error executing query:", error.message);
    res.status(500).json({ message: "Error adding request" });
  }
};

// Get Drive Request Statistics by Operator ID
// Get Drive Request Statistics by Operator ID
exports.getDriveRequestStatsByOperatorId = async (req, res) => {
  const { operator_id } = req.params;

  try {
    // Query to get total number of requests and count by status
    const totalAndStatusQuery = `
      SELECT 
        COUNT(*) AS total_requests,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS submitted_count,
        SUM(CASE WHEN status = 'viewed' THEN 1 ELSE 0 END) AS viewed_count,
        SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) AS replied_count,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count
      FROM 
        driveRequests
      WHERE 
        operator_id = ?`;

    // Query to get recent requests' total count
    const recentRequestsQuery = `
      SELECT 
        COUNT(*) AS recent_requests_count
      FROM 
        driveRequests
      WHERE 
        operator_id = ?
      ORDER BY 
        requested_at DESC
      LIMIT 5;`;

    // Execute the queries
    const [totalAndStatusResult, recentRequestsResult] = await Promise.all([
      queryAsync(totalAndStatusQuery, [operator_id]),
      queryAsync(recentRequestsQuery, [operator_id]),
    ]);

    // Extract total requests and status counts
    const totalRequests = totalAndStatusResult[0].total_requests;
    const requestStatus = {
      submitted: {
        count: totalAndStatusResult[0].submitted_count,
      },
      viewed: {
        count: totalAndStatusResult[0].viewed_count,
      },
      replied: {
        count: totalAndStatusResult[0].replied_count,
      },
      rejected: {
        count: totalAndStatusResult[0].rejected_count,
      },
      completed: {
        count: totalAndStatusResult[0].completed_count,
      },
    };

    // Extract recent requests' total count
    const recentRequestsCount =
      recentRequestsResult[0].recent_requests_count || 0;

    // Format the response
    const response = {
      totalRequests,
      requestStatus,
      recentRequests: {
        count: recentRequestsCount,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("Error executing queries: " + err.stack);
    res.status(500).send("Error fetching operator drive request statistics");
  }
};

exports.getRequestByOperatorId = async (req, res) => {
  const { id } = req.params; // Extract operator ID from request parameters

  if (!id) {
    return res.status(400).json({ message: "Operator ID is required" });
  }

  try {
    // Define the query to select specific fields
    const query = `SELECT id, company_id, operator_id,  requested_at, request_message, status FROM driveRequests WHERE operator_id = ?`;

    // Execute the query using queryAsync
    const results = await queryAsync(query, [id]);

    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "No requests found for this operator" });
    }

    res.status(200).json(results); // Respond with the list of requests
  } catch (error) {
    console.error("Error executing query:", error.message); // Log any SQL errors
    res.status(500).json({ message: "Error fetching requests" }); // Respond with a 500 status code
  }
};

exports.getRequestByOperatorIdWithStatus = async (req, res) => {
  const { id, status } = req.params; // Extract operator ID and status from request parameters

  if (!id || !status) {
    return res.status(400).json({
      message: "Insufficient parameters provided",
    });
  }

  // Define valid statuses
  const validStatuses = ["answered", "pending", "rejected"];

  // Check if the provided status is valid
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status provided" });
  }

  let query = `SELECT id, company_id, operator_id, requested_at, request_message, status FROM driveRequests WHERE operator_id = ?`;
  const queryParams = [id];

  // Modify the query based on the provided status
  switch (status) {
    case "answered":
      query += " AND status IN ('replied', 'completed')";
      break;

    case "pending":
      query += " AND status IN ('submitted', 'viewed')";
      break;

    case "rejected":
      query += " AND status = 'rejected'";
      break;

    default:
      return res.status(400).json({
        message: "Invalid status provided",
      });
  }

  try {
    // Execute the query using queryAsync
    const results = await queryAsync(query, queryParams);

    if (results.length === 0) {
      return res.status(404).json({
        message:
          "No requests found for this operator with the specified status",
      });
    }

    res.status(200).json(results); // Respond with the list of requests
  } catch (error) {
    console.error("Error executing query:", error.message); // Log any SQL errors
    res.status(500).json({ message: "Error fetching requests" }); // Respond with a 500 status code
  }
};

exports.getRequestByIdWithFilters = async (req, res) => {
  const { id } = req.params;

  // SQL queries to fetch the drive request and filters
  const requestQuery = "SELECT * FROM driveRequests WHERE id = ?";
  const filterQuery = "SELECT * FROM Filters";

  try {
    // Execute both queries asynchronously
    const requestResults = await queryAsync(requestQuery, [id]);
    const filterResults = await queryAsync(filterQuery);

    // Check if drive request exists
    if (requestResults.length === 0) {
      return res.status(404).json({ message: "Drive request not found" });
    }

    const driveRequest = requestResults[0]; // Extract the drive request row

    // Build the response with filters and corresponding drive request column values
    const responseData = filterResults.map((filter) => {
      const filterName = filter.name;
      const selectedValue = driveRequest[filterName]; // Retrieve the value from the driveRequest

      return {
        filterName: filter.name,
        label: filter.label,
        type: filter.type,
        options: filter.type === "Select" ? filter.options : null,
        selectedValue: selectedValue || null, // Value from driveRequest
      };
    });

    // Send the final combined response
    res.status(200).json({
      driveRequestId: driveRequest.id,
      operatorId: driveRequest.operator_id,
      companyId: driveRequest.company_id,
      destination: driveRequest.destination,
      departure: driveRequest.departure,
      requestedAt: driveRequest.requested_at,
      requestMessage: driveRequest.request_message,
      status: driveRequest.status,
      filters: responseData, // Filter metadata and selected values
    });
  } catch (error) {
    console.error("Error fetching drive request or filters:", error.message);
    res
      .status(500)
      .json({ message: "Error fetching drive request or filters" });
  }
};

//Drives

exports.getDriveByIdWithFilters = async (req, res) => {
  const { id } = req.params;

  // Query to fetch the drive by its ID
  const driveQuery = "SELECT * FROM drives WHERE drive_id = ?";

  // Query to fetch all active filters
  const filterQuery = "SELECT * FROM Filters";

  try {
    // Execute the drive query
    const driveResults = await queryAsync(driveQuery, [id]);

    // Check if the drive exists
    if (driveResults.length === 0) {
      return res.status(404).json({ message: "Drive not found" });
    }

    const drive = driveResults[0]; // Extract the drive row

    // Execute the filter query
    const filterResults = await queryAsync(filterQuery);

    // Build the response with filters and corresponding drive column values
    const responseData = filterResults.map((filter) => {
      const filterName = filter.name;

      // Retrieve the value from the drive that corresponds to this filter's column
      const selectedValue = drive[filterName];

      // Prepare the response object for each filter
      return {
        filterName: filter.name,
        label: filter.label,
        type: filter.type,
        options: filter.type === "Select" ? filter.options : null,
        selectedValue: selectedValue || null, // Value from drive
      };
    });

    // Send the final combined response
    res.status(200).json({
      driveId: drive.drive_id,
      operatorId: drive.operator_id,
      companyId: drive.company_id,
      start: drive.start,
      end: drive.end,
      price: drive.price,
      destination: drive.destination,
      departure: drive.departure,
      driveDate: drive.drive_date,
      trainType: drive.train_type,
      status: drive.status,
      filters: responseData, // Filter metadata and selected values
    });
  } catch (error) {
    console.error("Error fetching data:", error.message);
    res.status(500).json({ message: "Error fetching data" });
  }
};

exports.getMonthlyDriveStatsByOperatorId = async (req, res) => {
  const { operator_id } = req.params;

  try {
    // SQL query to get the count of drives grouped by weeks of the ongoing month using 'start'
    const weeklyDrivesQuery = `
      SELECT 
        WEEK(start, 1) - WEEK(DATE_SUB(start, INTERVAL DAY(start)-1 DAY), 1) + 1 AS week_number,
        COUNT(*) AS drive_count
      FROM 
        drives
      WHERE 
        operator_id = ? 
        AND MONTH(start) = MONTH(CURDATE()) 
        AND YEAR(start) = YEAR(CURDATE())
      GROUP BY 
        week_number
      ORDER BY 
        week_number;
    `;

    // Execute the SQL query asynchronously using queryAsync
    const weeklyDrivesResult = await queryAsync(weeklyDrivesQuery, [
      operator_id,
    ]);

    // Initialize an object for weekly stats with 0 for each week
    const weeklyStats = {
      week1: 0,
      week2: 0,
      week3: 0,
      week4: 0,
    };

    // Check if weeklyDrivesResult is an array
    if (Array.isArray(weeklyDrivesResult)) {
      // Populate the weeklyStats object with actual data
      weeklyDrivesResult.forEach((row) => {
        switch (row.week_number) {
          case 1:
            weeklyStats.week1 = row.drive_count;
            break;
          case 2:
            weeklyStats.week2 = row.drive_count;
            break;
          case 3:
            weeklyStats.week3 = row.drive_count;
            break;
          case 4:
            weeklyStats.week4 = row.drive_count;
            break;
          default:
            // Optionally handle weeks beyond the 4th week if needed
            break;
        }
      });
    }

    // Send the response
    res.status(200).json(weeklyStats);
  } catch (error) {
    // Log error and send error response
    console.error("Error fetching drive stats by week for operator:", error);
    res.status(500).json({ error: "Failed to fetch drive stats for operator" });
  }
};

// Get Drive Statistics by Operator ID
// Get Drive Statistics by Operator ID
exports.getDriveStatsByOperatorId = async (req, res) => {
  const { operator_id } = req.params;

  try {
    // Query to get total number of drives, count by status, and total price for each status including "others"
    const totalAndStatusQuery = `
      SELECT 
        COUNT(*) AS total_drives,
        SUM(CASE WHEN status = 'ongoing' THEN 1 ELSE 0 END) AS ongoing_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
        SUM(CASE WHEN status NOT IN ('ongoing', 'completed', 'cancelled') THEN 1 ELSE 0 END) AS others_count,
        SUM(CASE WHEN status = 'ongoing' THEN price ELSE 0 END) AS ongoing_price_sum,
        SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END) AS completed_price_sum,
        SUM(CASE WHEN status = 'cancelled' THEN price ELSE 0 END) AS cancelled_price_sum,
        SUM(CASE WHEN status NOT IN ('ongoing', 'completed', 'cancelled') THEN price ELSE 0 END) AS others_price_sum
      FROM 
        drives
      WHERE 
        operator_id = ?`;

    // Query to get recent drives' total price and count
    const recentDrivesQuery = `
      SELECT 
        COUNT(*) AS recent_drives_count,
        SUM(price) AS total_recent_drives_price
      FROM 
        drives
      WHERE 
        operator_id = ?
      ORDER BY 
        start DESC
      LIMIT 5;`;

    // Execute the queries
    const [totalAndStatusResult, recentDrivesResult] = await Promise.all([
      queryAsync(totalAndStatusQuery, [operator_id]),
      queryAsync(recentDrivesQuery, [operator_id]),
    ]);

    // Extract total drives and status counts
    const totalDrives = totalAndStatusResult[0].total_drives;
    const driveStatus = {
      ongoing: {
        count: totalAndStatusResult[0].ongoing_count,
        price_sum: totalAndStatusResult[0].ongoing_price_sum,
      },
      completed: {
        count: totalAndStatusResult[0].completed_count,
        price_sum: totalAndStatusResult[0].completed_price_sum,
      },
      cancelled: {
        count: totalAndStatusResult[0].cancelled_count,
        price_sum: totalAndStatusResult[0].cancelled_price_sum,
      },
      others: {
        count: totalAndStatusResult[0].others_count,
        price_sum: totalAndStatusResult[0].others_price_sum,
      },
    };

    // Extract recent drives' total price and count
    const recentDrivesCount = recentDrivesResult[0].recent_drives_count || 0;
    const recentDrivesPrice =
      recentDrivesResult[0].total_recent_drives_price || 0;

    // Format the response
    const response = {
      totalDrives,
      driveStatus,
      recentDrives: {
        count: recentDrivesCount,
        totalPrice: recentDrivesPrice,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("Error executing queries: " + err.stack);
    res.status(500).send("Error fetching operator drive statistics");
  }
};

/*
exports.changeDriveStatus = async (req, res) => {
  const { id } = req.params;  // Extract drive ID from the request parameters
  const { status,companyID } = req.body;  // Extract the new status from the request body

  // Validate that both the ID and status are provided
  if (!id || !status) {
    return res.status(400).json({
      message: "Drive ID and status are required",
    });
  }

  // Define the allowed statuses (you can adjust these as needed)
  const validStatuses = ['ongoing', 'offer sent', 'offer declined', 'scheduled', 'cancelled', 'completed'];

  // Check if the provided status is valid
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      message: "Invalid status provided",
    });
  }

  // SQL query to update the drive status by drive ID
  const updateQuery = "UPDATE drives SET status = ? WHERE drive_id = ?";

  try {
    // Execute the update query using queryAsync
    const result = await queryAsync(updateQuery, [status, id]);

    // Check if any row was affected (i.e., if the drive ID exists)
    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Drive not found",
      });
    }

    // If the update was successful, send a success response
    res.status(200).json({
      message: `Drive status updated successfully to '${status}'`,
    });
  } catch (error) {
    console.error("Error updating drive status:", error.message);
    res.status(500).json({ message: "Error updating drive status" });
  }
};
*/

exports.changeDriveStatus = async (req, res) => {
  const { id } = req.params; // Extract drive ID from the request parameters
  const { status, companyID } = req.body; // Extract the new status and company ID from the request body

  // Validate that both the ID and status are provided
  if (!id || !status) {
    return res.status(400).json({
      message: "Drive ID and status are required",
    });
  }

  // Define the allowed statuses (you can adjust these as needed)
  const validStatuses = [
    "ongoing",
    "offer sent",
    "offer declined",
    "scheduled",
    "cancelled",
    "completed",
  ];

  // Check if the provided status is valid
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      message: "Invalid status provided",
    });
  }

  const statusMessages = {
    "offer sent": `You have an Offer for Drive`,
    "offer declined": `Offer has been declined for Drive`,
  };

  // SQL query to update the drive status by drive ID
  const updateQuery = "UPDATE drives SET status = ? WHERE drive_id = ?";

  try {
    // Execute the update query using queryAsync
    const result = await queryAsync(updateQuery, [status, id]);

    // Check if any row was affected (i.e., if the drive ID exists)
    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Drive not found",
      });
    }

    // Fetch the company's subscriber ID (assuming you have a function to get it)

    const subscriberId = await getCompanyNotificationId(companyID);
    const actionUrl = `/company/drives/view-drive/${id}`;
    const body = statusMessages[status] || `Drive has been ${status}`;
    const email = await getCompanyEmail(companyID);

    // Send the notification
    notify(subscriberId, actionUrl, body);
    sendNotificationEmail(
      email,
      "Drive Offer",
      body + "Click View button below to learn more",
      `${process.env.REACT_APP_URL}${actionUrl}`,
      subscriberId
    );

    // If the update was successful, send a success response
    res.status(200).json({
      message: `Drive status updated successfully to '${status}'`,
    });
  } catch (error) {
    console.error("Error updating drive status:", error.message);
    res.status(500).json({ message: "Error updating drive status" });
  }
};

// Retrieve the drives of an Operator
exports.getDrivesByOperatorId = async (req, res) => {
  const operatorId = req.params.operator_id; // Extract operator ID from request parameters

  if (!operatorId) {
    return res.status(400).json({ message: "Operator ID is required" });
  }

  console.log("operator_id:", operatorId);

  // Define the query to select specific fields
  const query = `
    SELECT 
      drive_id, 
      driver_id, 
      operator_id, 
      company_id, 
      start, 
      end,  
      status, 
      price, 
      payment 
    FROM drives 
    WHERE operator_id = ?`;

  try {
    // Execute the query using queryAsync
    const results = await queryAsync(query, [operatorId]);

    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "No drives found for this operator" });
    }

    res.status(200).json(results); // Directly return the selected data
  } catch (err) {
    console.error("Error executing query:", err.stack); // Log any SQL errors
    res.status(500).send("Error fetching drives"); // Respond with a 500 status code
  }
};

exports.getDriveById = async (req, res) => {
  const id = req.params.id;
  console.log("Drive_id", id);

  try {
    // SQL query to get selected fields for the drive
    const query = `
      SELECT drive_id, driver_id, company_id, operator_id, start, end,  payment,status, price,termination_message
      FROM drives
      WHERE drive_id = ?
    `;

    // Execute the query asynchronously
    const data = await queryAsync(query, [id]);

    // Check if data is found
    if (data.length === 0) {
      return res.status(404).json({ message: "Drive not found." });
    }

    // Respond with the selected fields
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching drive by ID:", error); // Log the error for debugging
    res
      .status(500)
      .json({ message: "An error occurred while fetching the drive." });
  }
};

exports.getNotificationId = async (id) => {
  if (!id) {
    return;
  }
  try {
    const query = "SELCT notification_id FROM operators WHERE id = ?";
    const results = await queryAsync(query, [id]);
    return results;
  } catch {
    console.error("error", err);
  }
};

exports.EndDrive = async (req, res) => {
  const { id } = req.params; // Extract the drive ID from the request parameters
  const { status, endMessage } = req.body; // Extract the status and end message from the request body

  // Validate the ID, status, and end message
  if (!id || !status || !endMessage) {
    return res.status(400).json({
      message: "Drive ID, status, and end message are required",
    });
  }

  console.log(req.body);

  // SQL query to update both status and end message
  const query =
    "UPDATE drives SET status = ?, termination_message = ? WHERE drive_id = ?";

  try {
    // Execute the query using queryAsync
    const results = await queryAsync(query, [status, endMessage, id]);

    // Check if any rows were affected
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Drive not found" });
    }

    const drive = await queryAsync(
      "SELECT company_id FROM drives WHERE drive_id = ?",
      [id]
    );
    if (!drive || !drive[0]) {
      return res.status(404).json({ message: "Drive not found" });
    }

    const companyId = drive[0].operator_id;

    // Fetch the company's subscriber ID (assuming you have a function to get it)
    const subscriberId = await getCompanyNotificationId(companyId);
    const body = `Operator has Ended the Drive `;
    const actionUrl = `/company/drives/view-drive/${id}`;
    const email = await getCompanyEmail(companyId);
    // Send the notification
    notify(subscriberId, actionUrl, body);
    sendNotificationEmail(
      email,
      "Drive Ended",
      "Drive has ended by operator confirmation. Click View button below to learn more",
      `${process.env.REACT_APP_URL}${actionUrl}`,
      subscriberId
    );

    // Send a success response
    res.status(200).json({
      message: `Drive ended with status '${status}' and message '${endMessage}'`,
    });
  } catch (error) {
    console.error("Error updating drive:", error.message);
    res.status(500).json({ message: "Error ending drive" });
  }
};

// Retrieve drives of a specific operator with a given status
exports.getOperatorStatusDrive = async (req, res) => {
  const operatorId = req.params.operatorId;
  const status = req.params.status;

  // Check if both operatorId and status are provided
  if (!operatorId || !status) {
    return res.status(400).json({
      message:
        "Both operatorId and status must be provided in the request parameters.",
    });
  }

  console.log("operatorId:", operatorId);
  console.log("status:", status);

  // Define the query to select specific fields
  const query = `
    SELECT 
      drive_id, 
      driver_id, 
      operator_id, 
      company_id, 
      start, 
      end, 
      status, 
      price, 
      payment 
    FROM drives 
    WHERE operator_id = ? AND status = ?`;

  try {
    // Execute the query using queryAsync
    const results = await queryAsync(query, [operatorId, status]);

    if (results.length === 0) {
      return res.status(404).json({
        message: "No drives found for this operator with the specified status",
      });
    }

    res.status(200).json(results); // Directly return the selected data
  } catch (err) {
    console.error("Error executing query:", err.stack); // Log any SQL errors
    res.status(500).send("Error fetching drives"); // Respond with a 500 status code
  }
};

exports.getDynamicDrives = async (req, res) => {
  const {
    operator_id,
    driver_id,
    company_id,
    payment,
    price_min,
    price_max,
    start,
    end,
  } = req.body;

  let query = `
    SELECT 
      drive_id, 
      driver_id, 
      operator_id, 
      company_id, 
      start, 
      end,  
      status, 
      price, 
      payment 
    FROM drives 
    WHERE 1=1
  `;
  let queryParams = [];

  // Add filters only if they are provided in the request body
  if (operator_id) {
    query += " AND operator_id = ?";
    queryParams.push(operator_id);
  }
  if (driver_id) {
    query += " AND driver_id = ?";
    queryParams.push(driver_id);
  }
  if (company_id) {
    query += " AND company_id = ?";
    queryParams.push(company_id);
  }
  if (payment !== undefined) {
    query += " AND payment = ?";
    queryParams.push(payment);
  }
  if (price_min !== undefined) {
    query += " AND price >= ?";
    queryParams.push(price_min);
  }
  if (price_max !== undefined) {
    query += " AND price <= ?";
    queryParams.push(price_max);
  }
  if (start) {
    query += " AND start >= ?";
    queryParams.push(start);
  }
  if (end) {
    query += " AND end <= ?";
    queryParams.push(end);
  }

  try {
    // Execute the query asynchronously
    const data = await queryAsync(query, queryParams);

    // Respond with the retrieved data directly
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching dynamic drives:", error); // Log the error for debugging
    res
      .status(500)
      .json({ message: "An error occurred while fetching the drives." });
  }
};

//Company
/*
exports.findCompanyById = async (req, res) => {
  const id = req.params.id;
  console.log("id:", id);

  try {
    // Query to select only the required fields
    const query = `
      SELECT 
      id,
        name, 
        email, 
        description, 
        createdAt, 
        profileUrl, 
        is_Active, 
        rating,
        verified, 
        verified, 
        hourly_rate,
        status 
      FROM companies 
      WHERE id = ?
    `;

    // Execute the query
    const result = await queryAsync(query, [id]);

    if (result.length > 0) {
      // Send the result with only the selected fields
      res.status(200).send(result[0]);
    } else {
      res.status(404).send({
        message: `Cannot find Company with id=${id}.`,
      });
    }
  } catch (err) {
    console.error("Error retrieving Company with id=" + id, err.stack);
    console.error(err.message);
    res.status(500).send({
      message: "Error retrieving Company with id=" + id,
    });
  }
};

*/
exports.findCompanyById = async (req, res) => {
  const companyId = req.params.id;
  const operatorId = req.params.operatorId; // Assuming operatorId is passed as a query parameter
  console.log("companyId:", companyId);
  console.log("operatorId:", operatorId);

  try {
    // Query to select company details
    const companyQuery = `
      SELECT 
        id,
        company_name as name, 
        email, 
        description, 
        createdAt, 
        profileUrl, 
        is_Active, 
        rating,
        verified, 
        hourly_rate,
        status 
      FROM companies 
      WHERE id = ?
    `;

    // Execute the company query
    const companyResult = await queryAsync(companyQuery, [companyId]);

    if (companyResult.length === 0) {
      return res.status(404).send({
        message: `Cannot find Company with id=${companyId}.`,
      });
    }

    let company = companyResult[0];

    // Check if operatorId is provided to determine like status
    if (operatorId) {
      // Query to get operator's saved companies
      const operatorQuery = `
        SELECT saved_companies 
        FROM operators 
        WHERE id = ?
      `;

      const [operator] = await queryAsync(operatorQuery, [operatorId]);

      if (operator) {
        try {
          // Parse saved_companies and check if company is liked
          const savedCompanies = operator.saved_companies
            ? JSON.parse(operator.saved_companies)
            : [];
          company.isLiked =
            Array.isArray(savedCompanies) &&
            savedCompanies.includes(Number(companyId));
        } catch (parseError) {
          console.error("Error parsing saved_companies:", parseError);
          company.isLiked = false;
        }
      } else {
        company.isLiked = false;
      }
    } else {
      company.isLiked = false;
    }

    // Send the response with company details and like status
    res.status(200).send(company);
  } catch (err) {
    console.error("Error retrieving Company with id=" + companyId, err.stack);
    console.error(err.message);
    res.status(500).send({
      message: "Error retrieving Company with id=" + companyId,
    });
  }
};

exports.findAllCompanies = async (req, res) => {
  const operatorId = req.params.operatorId; // Get operatorId from query parameters

  try {
    // First get operator's saved companies if operatorId is provided
    let savedCompanies = [];
    if (operatorId) {
      const [operator] = await queryAsync(
        "SELECT saved_companies FROM operators WHERE id = ?",
        [operatorId]
      );

      if (operator) {
        try {
          savedCompanies = operator.saved_companies
            ? JSON.parse(operator.saved_companies)
            : [];
          if (!Array.isArray(savedCompanies)) {
            savedCompanies = [];
          }
        } catch (parseError) {
          console.error("Error parsing saved_companies:", parseError);
          savedCompanies = [];
        }
      }
    }

    // Define the query to select specific fields
    const query = `
      SELECT 
        id,
        company_name AS name,
        total_drivers,
        total_drives,
        rating,
        description,
        hourly_rate,
        profileUrl 
      FROM companies 
      WHERE
       (is_active IS NULL OR is_active = 1)
        AND verified = 'true';
    `;

    // Execute the query using queryAsync
    const companies = await queryAsync(query);

    // Check if data is empty
    if (companies.length === 0) {
      return res.status(404).json({ message: "No active companies found." });
    }

    // Add isLiked field to each company
    const companiesWithLikeStatus = companies.map((company) => ({
      ...company,
      isLiked: savedCompanies.includes(Number(company.id)),
    }));

    // Respond with the enhanced data
    res.status(200).json(companiesWithLikeStatus);
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({
      message: "An error occurred while fetching the companies.",
      error: error.message,
    });
  }
};

exports.GetFilterCompaniesWithServices = async (req, res) => {
  try {
    const filters = req.body.filters; // Array of objects containing key-value pairs for filtering
    const operatorId = req.query.operatorId; // Get operatorId from query parameters
    const locationsFilter = req.body.locations; // Array of location names for filtering

    console.log(locationsFilter);

    if (
      (!filters && !locationsFilter) ||
      (filters.length === 0 && locationsFilter.length === 0)
    ) {
      return res.status(400).send({
        message: "No filter criteria provided.",
      });
    }

    // Build the SQL WHERE conditions dynamically based on the filters
    const queryConditions = filters.map((filter) => {
      let { key, value } = filter;

      if (key === "price_range") {
        console.log(key);
        // Handle price_range filter
        const rangeMatch = value.match(/\$([0-9]+)-\$([0-9]+)/);
        if (rangeMatch) {
          const minPrice = parseFloat(rangeMatch[1]);
          const maxPrice = parseFloat(rangeMatch[2]);
          return `(price_range LIKE '%${value}%' OR 
            hourly_rate BETWEEN ${minPrice} AND ${maxPrice})`;
        } else {
          throw new Error(`Invalid price_range format: ${value}`);
        }
      }

      // Escape the key to avoid SQL injection
      key = `\`${key}\``;

      if (typeof value === "string" && value.includes(",")) {
        const valuesArray = value.split(",").map((val) => val.trim());
        const likeConditions = valuesArray
          .map((val) => `${key} LIKE '%${val}%'`)
          .join(" AND ");
        return `(${likeConditions})`;
      } else {
        return `${key} LIKE '%${value}%'`;
      }
    });

    // Adding location filtering if locations are provided
    if (locationsFilter && locationsFilter.length > 0) {
      const locationConditions = locationsFilter
        .map((loc) => `JSON_CONTAINS(drivers.locations, '["${loc}"]')`)
        .join(" OR ");
      queryConditions.push(`(${locationConditions})`);
    }

    const whereClause = queryConditions.join(" AND ");

    // Construct the SQL query to join companies and drivers and filter based on location
    const sqlQuery = `
      SELECT DISTINCT companies.*
      FROM companies
      JOIN drivers ON companies.id = drivers.company_id
      WHERE ${whereClause}
    `;

    console.log(sqlQuery);
    // Execute the query using queryAsync
    const companies = await queryAsync(sqlQuery);

    // Return the filtered companies
    res.status(200).send(companies);
  } catch (err) {
    console.error("Error filtering companies:", err);
    res.status(500).send({
      message: `Error occurred while filtering companies: ${err.message}`,
    });
  }
};

//Prev filtering of the comapnies

// exports.GetFilterCompaniesWithServices = async (req, res) => {
//   try {
//     console.log("Request received with filters:", req.body.filters);
//     const filters = req.body.filters; // Array of objects containing key-value pairs for filtering
//     const operatorId = req.query.operatorId; // Get operatorId from query parameters

//     if (!filters || filters.length === 0) {
//       return res.status(400).send({
//         message: "No filter criteria provided.",
//       });
//     }

//     // Get operator's saved companies if operatorId is provided
//     let savedCompanies = [];
//     if (operatorId) {
//       const [operator] = await queryAsync(
//         "SELECT saved_companies FROM operators WHERE id = ?",
//         [operatorId]
//       );

//       if (operator) {
//         try {
//           savedCompanies = operator.saved_companies
//             ? JSON.parse(operator.saved_companies)
//             : [];
//           if (!Array.isArray(savedCompanies)) {
//             savedCompanies = [];
//           }
//         } catch (parseError) {
//           console.error("Error parsing saved_companies:", parseError);
//           savedCompanies = [];
//         }
//       }
//     }

//     // Build the SQL WHERE conditions dynamically based on the filters
//     const queryConditions = filters.map((filter) => {
//       // Destructure the key and value from the filter object
//       let { key, value } = filter;

//       // Wrap column names with backticks to handle spaces or special characters in the names
//       key = `\`${key}\``;

//       // If the value contains comma-separated values, split them into an array
//       if (typeof value === "string" && value.includes(",")) {
//         const valuesArray = value.split(",").map((val) => val.trim());
//         // Use AND condition to ensure all values must be present in the same column
//         const likeConditions = valuesArray
//           .map((val) => `${key} LIKE '%${val}%'`)
//           .join(" AND ");
//         return `(${likeConditions})`;
//       } else {
//         // For a single value, use LIKE for partial match
//         return `${key} LIKE '%${value}%'`;
//       }
//     });

//     // Combine all conditions using AND
//     const whereClause = queryConditions.join(" AND ");

//     // Construct the SQL query
//     const sqlQuery = `SELECT * FROM companies WHERE ${whereClause}`;

//     // Execute the query using queryAsync
//     const companies = await queryAsync(sqlQuery);

//     // Add isLiked field to each company
//     const companiesWithLikeStatus = companies.map((company) => ({
//       ...company,
//       isLiked: savedCompanies.includes(Number(company.id)),
//     }));

//     // Return the filtered companies with like status
//     res.status(200).send(companiesWithLikeStatus);
//   } catch (err) {
//     console.error("Error filtering companies:", err);
//     res.status(500).send({
//       message: "Error occurred while filtering companies.",
//     });
//   }
// };

exports.GetFilterCompaniesWithServicesCalender = async (req, res) => {
  try {
    console.log("Filteration chalo  ha...");
    const filters = req.body.filters; // Array of objects containing key-value pairs for filtering
    console.log(filters);
    if (!filters || filters.length === 0) {
      return res.status(400).send({
        message: "No filter criteria provided.",
      });
    }

    // Build the SQL WHERE conditions dynamically based on the filters
    const queryConditions = filters.map((filter) => {
      let { key, value } = filter;

      // Escape the column name using backticks
      key = `\`${key}\``;

      if (typeof value === "string" && value.includes(",")) {
        const valuesArray = value.split(",").map((val) => val.trim());
        const likeConditions = valuesArray
          .map((val) => `${key} LIKE '%${val}%'`)
          .join(" AND ");
        return `(${likeConditions})`;
      } else {
        return `${key} LIKE '%${value}%'`;
      }
    });

    // Combine all conditions using AND
    const whereClause = queryConditions.join(" AND ");

    // Check if there's a date or datetime filter in the request
    const dateFilters = filters.filter(
      (filter) =>
        filter.key.toLowerCase().includes("date") ||
        filter.key.toLowerCase().includes("datetime")
    );

    // If there are date filters, construct additional SQL to exclude companies based on driver schedules
    let additionalConditions = "";
    if (dateFilters.length > 0) {
      const dateConditions = dateFilters
        .map((filter) => {
          const { key, value } = filter;
          const dateValue = key.toLowerCase().includes("date")
            ? "DATE(start)"
            : "start"; // Adjust based on filter key

          return `
          id NOT IN (
            SELECT c.id
            FROM companies c
            JOIN drivers d ON c.id = d.company_id
            JOIN calenders cal ON d.id = cal.driver_id
            WHERE ${dateValue} = '${value}'
          )
        `;
        })
        .join(" AND ");

      additionalConditions = `AND (${dateConditions})`;
    }

    // Construct the final SQL query with additional conditions
    const sqlQuery = `SELECT * FROM companies WHERE ${whereClause} ${additionalConditions}`;
    console.log("Date query");
    console.log(sqlQuery);

    // Execute the query using queryAsync
    const result = await queryAsync(sqlQuery);

    // Return the filtered companies
    res.status(200).send(result);
  } catch (err) {
    console.error("Error filtering companies:", err);
    res.status(500).send({
      message: "Error occurred while filtering companies.",
    });
  }
};

//invoices
exports.getInvoiceByID = async (req, res) => {
  const id = req.params.id;

  const query = `
    SELECT 
      invoices.*,
      companies.name AS company_name,
      companies.email AS company_email,
      companies.address AS company_address,
      operators.name AS operator_name,
      operators.email AS operator_email,
      operators.address AS operator_address
    FROM invoices
    INNER JOIN companies ON invoices.company_id = companies.id
    INNER JOIN operators ON invoices.operator_id = operators.id
    WHERE invoices.id = ?
  `;

  try {
    const result = await queryAsync(query, [id]);
    if (result.length === 0) {
      res.status(404).send("Invoice not found");
      return;
    }
    res.status(200).json(result[0]);
  } catch (err) {
    console.error("Error executing query: " + err.stack);
    res.status(500).send("Error fetching invoice");
  }
};

// Get Invoice Stats by Operator ID
exports.getBillingStatsByOperatorId = async (req, res) => {
  const { operator_id } = req.params;

  try {
    // Define a single query to get the invoice statistics
    const query = `
      SELECT 
        COUNT(*) AS total_invoices,
        SUM(amount) AS total_amount,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) AS total_paid_count,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS total_paid_amount,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) AS total_overdue_count,
        SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END) AS total_overdue_amount,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) AS total_pending_count,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS total_pending_amount
      FROM invoices
      WHERE operator_id = ?`;

    // Execute the query
    const result = await queryAsync(query, [operator_id]);

    // Structure the response
    const response = {
      total: {
        count: result[0].total_invoices,
        amount: result[0].total_amount,
      },
      paid: {
        count: result[0].total_paid_count,
        amount: result[0].total_paid_amount,
      },
      overdue: {
        count: result[0].total_overdue_count,
        amount: result[0].total_overdue_amount,
      },
      pending: {
        count: result[0].total_pending_count,
        amount: result[0].total_pending_amount,
      },
    };

    // Send the response
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "An error occurred while fetching operator invoice stats",
    });
  }
};

exports.getInvoicesByOperatorId = async (req, res) => {
  const { operator_id } = req.params;

  const sqlQuery = `
    SELECT invoices.id, invoices.created_at, invoices.updated_at, invoices.due_date, 
           invoices.status, invoices.discount, invoices.tax, invoices.platform_charge, invoices.late_fine, invoices.additional_cost, invoices.drive_id, invoices.company_id, invoices.operator_id, invoices.amount, drives.price 
    FROM invoices 
    LEFT JOIN drives ON invoices.drive_id = drives.drive_id
    WHERE invoices.operator_id = ?
  `;

  try {
    const results = await queryAsync(sqlQuery, [operator_id]);

    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "No invoices found for the specified operator_id" });
    }

    res.status(200).json(results);
  } catch (error) {
    console.error("Error executing query:", error.message);
    return res.status(500).json({ message: "Error retrieving invoices" });
  }
};

exports.getInvoicesByOperatorIdWithStatus = async (req, res) => {
  const { operator_id, status } = req.params;

  const sqlQuery = `
    SELECT invoices.id, invoices.created_at, invoices.updated_at, invoices.due_date, 
           invoices.status, invoices.discount, invoices.tax, invoices.platform_charge, invoices.late_fine, invoices.additional_cost, invoices.drive_id, invoices.company_id, invoices.operator_id, invoices.amount, drives.price 
    FROM invoices 
    LEFT JOIN drives ON invoices.drive_id = drives.drive_id
    WHERE invoices.operator_id = ? AND invoices.status = ?
  `;

  try {
    const results = await queryAsync(sqlQuery, [operator_id, status]);

    // Return an empty array if no records found
    res.status(200).json(results);
  } catch (error) {
    console.error("Error executing query:", error.message);
    return res.status(500).json({ message: "Error retrieving invoices" });
  }
};

exports.getInvoicesByOperatorIdWithDuration = async (req, res) => {
  const { operator_id, duration } = req.params;

  const currentDate = new Date();
  let dateCondition;

  // Calculate date based on the duration parameter
  switch (duration) {
    case "weekly":
      dateCondition = new Date(currentDate.setDate(currentDate.getDate() - 7));
      break;
    case "monthly":
      dateCondition = new Date(
        currentDate.setMonth(currentDate.getMonth() - 1)
      );
      break;
    case "yearly":
      dateCondition = new Date(
        currentDate.setFullYear(currentDate.getFullYear() - 1)
      );
      break;
    default:
      return res.status(400).json({
        message:
          "Invalid duration provided. Use 'weekly', 'monthly', or 'yearly'.",
      });
  }

  // Format the dateCondition to match SQL datetime format
  dateCondition = dateCondition.toISOString().slice(0, 19).replace("T", " ");

  const sqlQuery = `
    SELECT invoices.id, invoices.created_at, invoices.updated_at, invoices.due_date, 
           invoices.status, invoices.discount, invoices.tax, invoices.platform_charge, invoices.late_fine, invoices.additional_cost, invoices.drive_id, invoices.company_id, invoices.operator_id, invoices.amount, drives.price 
    FROM invoices 
    LEFT JOIN drives ON invoices.drive_id = drives.drive_id
    WHERE invoices.operator_id = ? AND invoices.created_at >= ?
  `;

  try {
    const results = await queryAsync(sqlQuery, [operator_id, dateCondition]);

    // Return an empty array if no records are found
    res.status(200).json(results);
  } catch (error) {
    console.error("Error executing query:", error.message);
    return res.status(500).json({ message: "Error retrieving invoices" });
  }
};

exports.getInvoicesStatsByOperatorId = async (req, res) => {
  const { operator_id } = req.params;

  const now = new Date();

  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);

  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(now.getMonth() - 1);

  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  const oneWeekAgoFormatted = oneWeekAgo
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  const oneMonthAgoFormatted = oneMonthAgo
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  const oneYearAgoFormatted = oneYearAgo
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  try {
    const totalInvoicesQuery = `SELECT COUNT(*) AS total_invoices, SUM(amount) AS total_amount FROM invoices WHERE operator_id = ?`;
    const pendingInvoicesQuery = `SELECT COUNT(*) AS pending_invoices, SUM(amount) AS pending_amount FROM invoices WHERE operator_id = ? AND status = 'pending'`;
    const paidInvoicesQuery = `SELECT COUNT(*) AS unpaid_invoices, SUM(amount) AS unpaid_amount FROM invoices WHERE operator_id = ? AND status = 'paid'`;
    const weeklyInvoicesQuery = `SELECT COUNT(*) AS weekly_invoices, SUM(amount) AS weekly_amount FROM invoices WHERE operator_id = ? AND created_at >= ?`;
    const monthlyInvoicesQuery = `SELECT COUNT(*) AS monthly_invoices, SUM(amount) AS monthly_amount FROM invoices WHERE operator_id = ? AND created_at >= ?`;
    const yearlyInvoicesQuery = `SELECT COUNT(*) AS yearly_invoices, SUM(amount) AS yearly_amount FROM invoices WHERE operator_id = ? AND created_at >= ?`;

    const [
      totalInvoicesResult,
      pendingInvoicesResult,
      paidInvoicesResult,
      weeklyInvoicesResult,
      monthlyInvoicesResult,
      yearlyInvoicesResult,
    ] = await Promise.all([
      queryAsync(totalInvoicesQuery, [operator_id]),
      queryAsync(pendingInvoicesQuery, [operator_id]),
      queryAsync(paidInvoicesQuery, [operator_id]),
      queryAsync(weeklyInvoicesQuery, [operator_id, oneWeekAgoFormatted]),
      queryAsync(monthlyInvoicesQuery, [operator_id, oneMonthAgoFormatted]),
      queryAsync(yearlyInvoicesQuery, [operator_id, oneYearAgoFormatted]),
    ]);

    const response = {
      totalInvoices: totalInvoicesResult[0].total_invoices || 0,
      totalAmount: totalInvoicesResult[0].total_amount || 0,
      pendingInvoices: pendingInvoicesResult[0].pending_invoices || 0,
      pendingAmount: pendingInvoicesResult[0].pending_amount || 0,
      paidInvoices: paidInvoicesResult[0].unpaid_invoices || 0,
      paidAmount: paidInvoicesResult[0].unpaid_amount || 0,
      weeklyInvoices: weeklyInvoicesResult[0].weekly_invoices || 0,
      weeklyAmount: weeklyInvoicesResult[0].weekly_amount || 0,
      monthlyInvoices: monthlyInvoicesResult[0].monthly_invoices || 0,
      monthlyAmount: monthlyInvoicesResult[0].monthly_amount || 0,
      yearlyInvoices: yearlyInvoicesResult[0].yearly_invoices || 0,
      yearlyAmount: yearlyInvoicesResult[0].yearly_amount || 0,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error executing queries:", error.message);
    res.status(500).json({ message: "Error fetching invoice stats" });
  }
};

//Payment credentials
exports.getPaymentCredentials = async (req, res) => {
  const sqlQuery = `
    SELECT *
    FROM invoice_credentials
    WHERE 	credential_id  = ?
  `;

  try {
    // Execute the query to get the IBAN value
    const results = await queryAsync(sqlQuery, [1]);

    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "IBAN not found in invoice credentials" });
    }

    // Send the IBAN value in the response
    res.status(200).json(results);
  } catch (error) {
    console.error("Error executing query:", error.message);
    return res
      .status(500)
      .json({ message: "Error retrieving payment credentials" });
  }
};

//Filters
exports.getAllFilters = async (req, res) => {
  try {
    // Define the query to select all filters
    const query = "SELECT * FROM Filters";

    // Execute the query using queryAsync
    const results = await queryAsync(query);

    // Send the results as a JSON response
    res.status(200).json(results);
  } catch (err) {
    // Log any SQL errors
    console.error("Error executing query:", err.message);

    // Respond with a 500 status code
    res.status(500).send("Error fetching filters");
  }
};

exports.toggleSavedCompany = async (req, res) => {
  const { operatorId, companyId, likeStatus } = req.params;

  try {
    // Fetch the current saved_companies array
    const [operator] = await queryAsync(
      "SELECT saved_companies FROM operators WHERE id = ?",
      [operatorId]
    );

    if (!operator) {
      return res.status(404).json({ message: "Operator not found" });
    }

    // Parse the saved_companies field - initialize as empty array if it's an empty string or invalid JSON
    let savedCompanies = [];
    try {
      // Handle cases where saved_companies might be an empty string or invalid JSON
      savedCompanies = operator.saved_companies
        ? JSON.parse(operator.saved_companies)
        : [];
      // Ensure savedCompanies is always an array
      if (!Array.isArray(savedCompanies)) {
        savedCompanies = [];
      }
    } catch (parseError) {
      console.error("Error parsing saved_companies:", parseError);
      savedCompanies = [];
    }

    const companyIdNumber = Number(companyId);

    // Use likeStatus to determine whether to save or unsave
    if (likeStatus === "like") {
      // Save the company if it's not already saved
      if (!savedCompanies.includes(companyIdNumber)) {
        savedCompanies.push(companyIdNumber);
      }
    } else if (likeStatus === "unlike") {
      // Remove the company if it exists in the array
      savedCompanies = savedCompanies.filter((id) => id !== companyIdNumber);
    }

    // Update the saved_companies field in the database
    const savedCompaniesJson = JSON.stringify(savedCompanies);
    await queryAsync("UPDATE operators SET saved_companies = ? WHERE id = ?", [
      savedCompaniesJson,
      operatorId,
    ]);

    res.status(200).json({
      message: likeStatus === "like" ? "Company saved" : "Company unsaved",
      savedCompanies,
    });
  } catch (error) {
    console.error("Error updating saved companies:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};
