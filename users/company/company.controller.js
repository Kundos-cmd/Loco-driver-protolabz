const database = require("../../index");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { promisify } = require("util");
const createNovuSubscriber = require("../../novu/create-subscriber");
const notify = require("../../novu/send-notification"); // Adjust import path as needed
const sendNotificationEmail = require("../../novu/send-notification-email");
const dotenv = require("dotenv");
const dbModelLess = require("../../index"); // Make sure this points to your actual database connection file
const { sendVerificationEmail } = require("../../novu/send-verification-email");
const { sendResetEmail } = require("../../novu/send-verification-email");

const db = require('../../models');
const Company = db.companies;


dotenv.config();

const {
  getOperatorNotificationId,
  getOperatorEmail,
} = require("../../utils/NotificationIds/getOperatorNotificationID");

const bodyParser = require("body-parser");
const express = require("express");
const generateUniqueUserId = require("../../utils/generateUniqueId");
const { default: axios } = require("axios");
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

  console.log("Incoming Request", req.body);

  const hash = await bcrypt.hash(req.body.password, 10);
  const token = crypto.randomBytes(32).toString("hex");

  const company = {
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
      company.name,
      company.email,
      req.body.phone || "", // Assuming phone is part of req.body
      req.body.avatar ||
        "https://ik.imagekit.io/mja/pp-ph.png?updatedAt=1713673175390" // Assuming avatar is part of req.body
    );

    // SQL query to insert a new company into the database
    const insertQuery = `
      INSERT INTO companies (name, company_name,email, password, emailToken, createdAt, updatedAt, notification_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;

    // Execute the query
    const result = await queryAsync(insertQuery, [
      company.name,
      company.company_name,
      company.email,
      company.password,
      company.emailToken,
      company.createdAt,
      company.updatedAt,
      subscriberId, // Set the subscriberId as notification_id
    ]);

    const companyId = result.insertId;

    // Create a chat user in CometChat
    const uid = generateUniqueUserId();
    await createUserInCometChat(
      uid,
      company.name + ",company",
      req.body.profileUrl ||
        "https://ik.imagekit.io/mja/pp-ph.png?updatedAt=1713673175390" // Assuming profileUrl is part of req.body
    );

    // Update the company with the chat_id
    await queryAsync("UPDATE companies SET chat_id = ? WHERE id = ?", [
      uid,
      companyId,
    ]);

    // Send verification email to the company
    const link = `${process.env.REACT_APP_URL}/company/verify/${company.email}?t=${company.emailToken}`;
    console.log(subscriberId);
    await sendVerificationEmail(company.email, link, company.name);

    res.status(200).send({
      data: { id: companyId, ...company },
      chat_id: uid,
      notification_id: subscriberId,
    });
  } catch (err) {
    console.error(err);
    if (err.code && err.code == "ER_DUP_ENTRY") {
      return res.status(409).send({
        message: "Company with this email already exists.",
      });
    }
    res.status(500).send({
      message: err.message || "Some error occurred while creating the company.",
    });
  }
};

/*
      exports.createUser = async (req, res) => {
        if (!req.body.email) {
          return res.status(400).send({
            message: "Email is required.",
          });
        }

        const hash = await bcrypt.hash(req.body.password, 10);
        const token = crypto.randomBytes(32).toString("hex");

        const company = {
          name: req.body.name,
          email: req.body.email,
          password: hash,
          emailToken: token,
          createdAt: new Date(), // Set the creation date
          updatedAt: new Date(), // Set the update date
        };

        try {
          // Create a subscriber and get the subscriberId
          const subscriberId = await createNovuSubscriber(
            company.name,
            company.email,
            req.body.phone || "", // Assuming phone is part of req.body
            req.body.avatar ||
              "https://ik.imagekit.io/mja/pp-ph.png?updatedAt=1713673175390" // Assuming avatar is part of req.body
          );

          // SQL query to insert a new company into the database
          const insertQuery = `
            INSERT INTO companies (name, email, password, emailToken, createdAt, updatedAt, notification_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?);
          `;

          // Execute the query
          const result = await queryAsync(insertQuery, [
            company.name,
            company.email,
            company.password,
            company.emailToken,
            company.createdAt,
            company.updatedAt,
            subscriberId, // Set the subscriberId as notification_id
          ]);

          const companyId = result.insertId;

          // Create a chat user in CometChat
          const uid = generateUniqueUserId();
          await createUserInCometChat(
            uid,
            company.name + ",company",
            req.body.profileUrl ||
              "https://ik.imagekit.io/mja/pp-ph.png?updatedAt=1713673175390" // Assuming profileUrl is part of req.body
          );

          // Update the company with the chat_id
          await queryAsync("UPDATE companies SET chat_id = ? WHERE id = ?", [
            uid,
            companyId,
          ]);

          res.status(200).send({
            data: { id: companyId, ...company },
            chat_id: uid,
            notification_id: subscriberId,
          });
        } catch (err) {
          console.error(err);
          if (err.code && err.code == "ER_DUP_ENTRY") {
            return res.status(409).send({
              message: "Company with this email already exists.",
            });
          }
          res.status(500).send({
            message: err.message || "Some error occurred while creating the company.",
          });
        }
      };
*/
exports.findAll = async (req, res) => {
  try {
    const query = `
      SELECT * FROM companies 
      WHERE is_Active IS NULL OR is_Active = true
    `;

    // Execute the query and retrieve data
    const data = await queryAsync(query);

    // Check if data is empty
    if (data.length === 0) {
      return res.status(404).json({ message: "No active companies found." });
    }

    // Respond with the retrieved data
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching companies:", error); // Log the error for debugging
    res
      .status(500)
      .json({ message: "An error occurred while fetching the companies." });
  }
};

exports.findAllOfThem = (req, res) => {
  Company.findAll()
    .then((data) => {
      res.status(200).send(data); // Respond with the data and HTTP 200 status
    })
    .catch((err) => {
      res.status(500).send({
        message:
          err.message || "Some error occurred while retrieving companies.",
      }); // Respond with the error message and HTTP 500 status
    });
};

exports.getDriversByCompanyID = async (req, res) => {
  const companyId = req.params.id; // Extract company ID from request parameters

  try {
    // SQL query to get selected fields from drivers by company ID
    const query = `
      SELECT id, company_id, name, email, locations,rating, date_joined,experienceYears
      FROM drivers 
      WHERE company_id = ?
    `;

    // Execute the query asynchronously
    const data = await queryAsync(query, [companyId]);

    // Check if data is empty
    if (data.length === 0) {
      return res
        .status(404)
        .json({ message: "No drivers found for the specified company ID." });
    }

    // Send the retrieved data back in the response
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching drivers by company ID:", error); // Log the error for debugging
    res
      .status(500)
      .json({ message: "An error occurred while fetching the drivers." });
  }
};

exports.getDriverByID = async (req, res) => {
  const id = req.params.id;

  try {
    // SQL query to get the driver's details by ID, including the locations field
    const query = `
      SELECT 
        id, 
        name, 
        email, 
        age, 
        experienceYears, 
        rating, 
        date_joined, 
        locations 
      FROM drivers 
      WHERE id = ?
    `;

    // Execute the query asynchronously
    const data = await queryAsync(query, [id]);

    // Check if the driver exists
    if (data.length === 0) {
      return res.status(404).json({ message: "Driver not found." });
    }

    // Parse the JSON `locations` field if necessary
    const driver = data[0];
    if (driver.locations) {
      driver.locations = JSON.parse(driver.locations);
      // console.log(driver.locations);
    }

    // Send the selected fields including the parsed `locations`
    res.status(200).json([...data]);
  } catch (error) {
    console.error("Error fetching driver by ID:", error); // Log the error for debugging
    res
      .status(500)
      .json({ message: "An error occurred while fetching the driver." });
  }
};

exports.updateDriver = async (req, res) => {
  const driverId = req.params.driverId; // Extract driver ID from params
  console.log(driverId);
  console.log(req.body);
  const { name, email, age, rating, experienceYears, locations, company_id } =
    req.body;

  // Validate locations as an array
  if (!Array.isArray(locations)) {
    return res.status(400).json({ message: "Locations must be an array" });
  }

  // SQL query to update driver details
  const query = `
    UPDATE drivers 
    SET 
      name = ?, 
      email = ?, 
      age = ?, 
      rating = ?, 
      experienceYears = ?, 
      locations = ? 
    WHERE id = ? AND company_id = ?
  `;

  const values = [
    name,
    email,
    age,
    rating,
    experienceYears,
    JSON.stringify(locations),
    driverId,
    company_id,
  ];

  try {
    // console.log(query);
    // Execute the query asynchronously

    const result = await queryAsync(query, values);

    // Check if the update was successful
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.status(200).json({ message: "Driver updated successfully" });
  } catch (error) {
    console.error("Error updating driver:", error); // Log the error for debugging
    res
      .status(500)
      .json({ message: "An error occurred while updating the driver." });
  }
};

//Drives

exports.getDrivesByDriverID = async (req, res) => {
  const id = req.params.id;

  try {
    // SQL query to get selected fields for the driver's drives
    const query = `
      SELECT drive_id, driver_id, operator_id, company_id, start, end,  status, price, payment
      FROM drives
      WHERE driver_id = ?
    `;

    // Execute the query asynchronously
    const data = await queryAsync(query, [id]);

    // Send the selected fields directly
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching drives by driver ID:", error); // Log the error for debugging
    res
      .status(500)
      .json({ message: "An error occurred while fetching the drives." });
  }
};

exports.getMonthlyDriveStatsByCompanyId = async (req, res) => {
  const { company_id } = req.params;

  try {
    // SQL query to get the count of drives grouped by weeks of the ongoing month using 'start'
    const weeklyDrivesQuery = `
      SELECT 
        WEEK(start, 1) - WEEK(DATE_SUB(start, INTERVAL DAY(start)-1 DAY), 1) + 1 AS week_number,
        COUNT(*) AS drive_count
      FROM 
        drives
      WHERE 
        company_id = ? 
        AND MONTH(start) = MONTH(CURDATE()) 
        AND YEAR(start) = YEAR(CURDATE())
      GROUP BY 
        week_number
      ORDER BY 
        week_number;
    `;

    // Execute the SQL query asynchronously using queryAsync
    const weeklyDrivesResult = await queryAsync(weeklyDrivesQuery, [
      company_id,
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
    console.error("Error fetching drive stats by week:", error);
    res.status(500).json({ error: "Failed to fetch drive stats" });
  }
};

// Get Drive Statistics by Company ID
exports.getDriveStatsByCompanyId = async (req, res) => {
  const { company_id } = req.params;

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
        company_id = ?`;

    // Query to get recent drives' total price and count
    const recentDrivesQuery = `
      SELECT 
        COUNT(*) AS recent_drives_count,
        SUM(price) AS total_recent_drives_price
      FROM 
        drives
      WHERE 
        company_id = ?
      ORDER BY 
        start DESC
      LIMIT 5;`;

    // Execute the queries
    const [totalAndStatusResult, recentDrivesResult] = await Promise.all([
      queryAsync(totalAndStatusQuery, [company_id]),
      queryAsync(recentDrivesQuery, [company_id]),
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
    res.status(500).send("Error fetching company drive statistics");
  }
};

exports.changeDriveStatus = async (req, res) => {
  const { id } = req.params; // Extract drive ID from the request parameters
  const { status } = req.body; // Extract the new status and company ID from the request body

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
    "end requested",
  ];

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

    // Fetch the operator's subscriber ID (assuming you have a function to get it)
    const drive = await queryAsync(
      "SELECT operator_id FROM drives WHERE drive_id = ?",
      [id]
    );
    if (!drive || !drive[0]) {
      return res.status(404).json({ message: "Drive not found" });
    }

    const statusMessages = {
      "offer sent": `You have an Offer for Drive`,
      "offer declined": `Offer has been declined for Drive`,
      "end requested": `End has been requested for Drive`,
    };

    const operatorId = drive[0].operator_id;

    const subscriberId = await getOperatorNotificationId(operatorId);
    const actionUrl = `/operator/drives/view-drive/${id}`;
    const body = statusMessages[status] || `Drive has been ${status}`;

    const emailBody = `The company has updated the status of the drive with ID ${id} to '${status}'.`;

    // Send the notification to the operator
    notify(subscriberId, actionUrl, body);

    const email = await getOperatorEmail(operatorId);

    sendNotificationEmail(
      email,
      "Drive Status Updated",
      emailBody + ". Click View button below to learn more",
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

/*
exports.changeDriveStatus = async (req, res) => {
  const { id } = req.params;  // Extract drive ID from the request parameters
  const { status } = req.body;  // Extract the new status from the request body

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

exports.editDrive = async (req, res) => {
  const { id } = req.params;
  const {
    start,
    end,
    // shift,
    price,
    status,
    operator_id,
    driver_id,
    company_id,
  } = req.body;

  console.log("Edit Drive");
  console.log(id);

  // Check if at least one field is present in the body and the id is present
  if (!id || Object.keys(req.body).length === 0) {
    return res
      .status(400)
      .json({ error: "Missing required fields or body is empty" });
  }

  // Initialize the base query
  let query = `UPDATE drives SET `;
  const values = [];

  // Dynamically build query based on fields present in req.body
  if (start) {
    query += `start = ?, `;
    values.push(start);
  }
  if (end) {
    query += `end = ?, `;
    values.push(end);
  }
  // if (shift) {
  //   query += `shift = ?, `;
  //   values.push(shift);
  // }
  if (price) {
    query += `price = ?, `;
    values.push(price);
  }
  if (status) {
    query += `status = ?, `;
    values.push(status);
  }
  if (operator_id) {
    query += `operator_id = ?, `;
    values.push(operator_id);
  }
  if (driver_id) {
    query += `driver_id = ?, `;
    values.push(driver_id);
  }
  if (company_id) {
    query += `company_id = ?, `;
    values.push(company_id);
  }

  // Remove the trailing comma and space from the query
  query = query.slice(0, -2);

  // Add the WHERE clause to the query
  query += ` WHERE drive_id = ?`;
  values.push(id);

  try {
    // Use queryAsync for querying the database
    const results = await queryAsync(query, values);

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Drive not found" });
    }

    const drive = await queryAsync(
      "SELECT operator_id FROM drives WHERE drive_id = ?",
      [id]
    );
    if (!drive || !drive[0]) {
      return res.status(404).json({ message: "Drive not found" });
    }

    const operatorId = drive[0].operator_id;

    const subscriberId = await getOperatorNotificationId(operatorId);
    const actionUrl = `/operator/drives/view-drive/${id}`;
    const body = `Drive has been updated`;
    const emailBody = `The company has updated the status of the drive with ID ${id} to '${status}'.`;

    // Send the notification to the operator
    notify(subscriberId, actionUrl, body);

    const email = await getOperatorEmail(operatorId);

    sendNotificationEmail(
      email,
      "Drive Status Updated",
      emailBody + ". Click View button below to learn more",
      `${process.env.REACT_APP_URL}${actionUrl}`,
      subscriberId
    );

    return res.json({ message: "Drive updated successfully" });
  } catch (error) {
    console.error("Error executing query:", error.message);
    res.status(500).json({ error: "Error updating drive" });
  }
};

//Company Drives
// Retrieve the drives of a company
exports.getDrivesByCompanyId = async (req, res) => {
  const companyId = req.params.companyId;

  console.log("companyId:", companyId);

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
    WHERE company_id = ?`;

  try {
    const results = await queryAsync(query, [companyId]);
    res.json(results); // Directly return the selected data
  } catch (err) {
    console.error("Error executing query: " + err.stack);
    res.status(500).send("Error fetching drives");
  }
};

// Retrieve drives of a specific company with a given status
exports.getCompanyStatusDrive = async (req, res) => {
  const companyId = req.params.companyId;
  const status = req.params.status;

  if (!companyId || !status) {
    return res.status(400).json({
      message:
        "Both companyId and status must be provided in the request parameters.",
    });
  }

  console.log("companyId:", companyId);
  console.log("status:", status);

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
    WHERE company_id = ? AND status = ?`;

  try {
    const results = await queryAsync(query, [companyId, status]);
    res.json(results); // Directly return the selected data
  } catch (err) {
    console.error("Error executing query: " + err.stack);
    res.status(500).send("Error fetching drives");
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
    query += " AND DATE(start) >= ?";
    queryParams.push(start);
  }
  if (end) {
    query += " AND DATE(end) <= ?";
    queryParams.push(end);
  }
  console.log(query, queryParams);
  
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
      driverId: drive.driver_id,
      operatorId: drive.operator_id,
      companyId: drive.company_id,
      start: drive.start,
      end: drive.end,
      destination: drive.destination,
      departure: drive.departure,
      price: drive.price,
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
      "SELECT operator_id FROM drives WHERE drive_id = ?",
      [id]
    );
    if (!drive || !drive[0]) {
      return res.status(404).json({ message: "Drive not found" });
    }

    const operatorId = drive[0].operator_id;

    const subscriberId = await getOperatorNotificationId(operatorId);
    const actionUrl = `/operator/drives/view-offer-end-drive/${id}`;
    const body = `Company requested to end the Drive`;
    notify(subscriberId, actionUrl, body);

    const email = await getOperatorEmail(operatorId);

    sendNotificationEmail(
      email,
      "Drive End Request",
      body + ". Click View button below to learn more",
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

exports.cancelDrive = async (req, res) => {
  const { id } = req.params; // Extract the drive ID from the request parameters
  const { status, endMessage } = req.body; // Extract the status and end message from the request body

  // Validate the ID, status, and end message
  if (!id || !status || !endMessage) {
    return res.status(400).json({
      message: "Drive ID, status, and cancellation message are required",
    });
  }

  // SQL query to update both status and cancellation message
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
      "SELECT operator_id FROM drives WHERE drive_id = ?",
      [id]
    );
    if (!drive || !drive[0]) {
      return res.status(404).json({ message: "Drive not found" });
    }

    const operatorId = drive[0].operator_id;

    const subscriberId = await getOperatorNotificationId(operatorId);
    const actionUrl = `/operator/drives/view-drive/${id}`;
    const body = `Company has cancelled the Drive`;
    notify(subscriberId, actionUrl, body);

    const email = await getOperatorEmail(operatorId);

    sendNotificationEmail(
      email,
      "Drive Cancelled",
      body + ". Click View button below to learn more",
      `${process.env.REACT_APP_URL}${actionUrl}`,
      subscriberId
    );

    // Send a success response
    res.status(200).json({
      message: `Drive canceled with status '${status}' and message '${endMessage}'`,
    });
  } catch (error) {
    console.error("Error canceling drive:", error.message);
    res.status(500).json({ message: "Error canceling drive" });
  }
};

/*
exports.addDrive = async (req, res) => {
  console.log("Inside the controller add drive");

  const {
    price,
    start,
    end,
    status,
    driver_id,
    company_id,
    operator_id,
    driveRequest_id,
    filters,
  } = req.body;

  console.log("Filters:", filters);

  // Validate essential fields
  if (
    !price ||
    !start ||
    !end ||
    !status ||
    !driver_id ||
    !company_id ||
    !operator_id ||
    !driveRequest_id
  ) {
    return res.status(400).json({
      message:
        "Insufficient fields: price, start, end, status, driver_id, company_id, operator_id, and driveRequest_id are required.",
    });
  }

  // Check if a drive already exists with the given driveRequest_id
  const checkQuery = `
    SELECT * FROM drives
    WHERE driveRequest_id = ?
  `;

  try {
    const existingDrive = await queryAsync(checkQuery, [driveRequest_id]);

    if (existingDrive.length > 0) {
      return res.status(400).json({
        message: "Drive already created for this request.",
      });
    }

    // Start with core fields
    const coreFields = {
      price,
      start,
      end,
      status,
      driver_id,
      company_id,
      operator_id,
      driveRequest_id,
    };

    // Add dynamic filters if present
    const dynamicFields = filters || {};

    // Combine core fields with dynamic fields
    const combinedFields = { ...coreFields, ...dynamicFields };
    console.log("Combined Fields:", combinedFields);

    // Construct SQL query and parameters dynamically
    const columns = Object.keys(combinedFields)
      .map((col) => `\`${col}\``) // Handle column names with spaces or reserved words
      .join(", ");
    const values = Object.values(combinedFields);
    const placeholders = values.map(() => "?").join(", ");

    const sqlQuery = `INSERT INTO drives (${columns}) VALUES (${placeholders})`;
    console.log("SQL Query:", sqlQuery);

    // Execute the SQL query using queryAsync
    const result = await queryAsync(sqlQuery, values);
    res.status(200).json({
      id: result.insertId,
      message: "Drive added and offer sent successfully",
    });
  } catch (error) {
    console.error("Error executing query:", error.message);
    res.status(500).json({ message: "Error adding drive" });
  }
};
*/
exports.addDrive = async (req, res) => {
  console.log("Inside the controller add drive");

  const {
    price,
    start,
    end,
    status,
    driver_id,
    company_id,
    operator_id,
    driveRequest_id,
    destination,
    departure,
    filters,
  } = req.body;

  console.log("Filters:", filters);

  // Validate essential fields
  if (
    !price ||
    !start ||
    !end ||
    !status ||
    !driver_id ||
    !company_id ||
    !operator_id ||
    !driveRequest_id ||
    !destination ||
    !departure
  ) {
    return res.status(400).json({
      message:
        "Insufficient fields: price, start, end, status, driver_id, company_id, operator_id, destination, departure,and driveRequest_id are required.",
    });
  }

  // Check if a drive already exists with the given driveRequest_id
  const checkQuery = `
    SELECT * FROM drives
    WHERE driveRequest_id = ?
  `;

  try {
    const existingDrive = await queryAsync(checkQuery, [driveRequest_id]);

    if (existingDrive.length > 0) {
      return res.status(400).json({
        message: "Drive already created for this request.",
      });
    }

    // Start with core fields
    const coreFields = {
      price,
      start,
      end,
      status,
      driver_id,
      company_id,
      operator_id,
      driveRequest_id,
      destination,
      departure,
    };

    // Add dynamic filters if present
    const dynamicFields = filters || {};

    // Combine core fields with dynamic fields
    const combinedFields = { ...coreFields, ...dynamicFields };
    console.log("Combined Fields:", combinedFields);

    // Construct SQL query and parameters dynamically
    const columns = Object.keys(combinedFields)
      .map((col) => `\`${col}\``) // Handle column names with spaces or reserved words
      .join(", ");
    const values = Object.values(combinedFields);
    const placeholders = values.map(() => "?").join(", ");

    const sqlQuery = `INSERT INTO drives (${columns}) VALUES (${placeholders})`;
    console.log("SQL Query:", sqlQuery);

    // Execute the SQL query using queryAsync
    const result = await queryAsync(sqlQuery, values);

    const subscriberId = await getOperatorNotificationId(operator_id);
    const actionUrl = `/operator/drives/view-drive/${result.insertId}`;
    const body = `You have a new Drive Offer`;
    const emailBody = "Company has offered to start initiate the drive";
    console.log("passing");
    console.log(subscriberId);
    // Send the notification
    notify(subscriberId, actionUrl, body);

    const email = await getOperatorEmail(operator_id);

    sendNotificationEmail(
      email,
      "Drive Offer",
      emailBody + ". Click View button below to learn more",
      `${process.env.REACT_APP_URL}${actionUrl}`,
      subscriberId
    );

    res.status(200).json({
      id: result.insertId,
      message: "Drive added and offer sent successfully",
    });
  } catch (error) {
    console.error("Error executing query:", error.message);
    res.status(500).json({ message: "Error adding drive" });
  }
};
exports.getDriveById = async (req, res) => {
  const id = req.params.id;
  console.log("Drive_id", id);

  try {
    // SQL query to get selected fields for the drive
    const query = `
      SELECT drive_id, driver_id, company_id, operator_id, start, end, payment,status, price
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

//requests
exports.getRequestByCompanyId = async (req, res) => {
  const { id } = req.params; // Extract company ID from request parameters

  // SQL query to select only the required fields
  const query = `
    SELECT 
      id, 
      operator_id, 
      company_id, 
      requested_at, 
      request_message, 
      status 
    FROM driveRequests 
    WHERE company_id = ?
  `;

  try {
    // Execute the query using queryAsync
    const results = await queryAsync(query, [id]);

    // Check if any requests were found
    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "No requests found for this company" });
    }

    // Send the results as the response
    res.status(200).json(results);
  } catch (error) {
    console.error("Error executing query:", error.message);
    res.status(500).json({ message: "Error fetching requests" });
  }
};

// Get Drive Request Statistics by Company ID
// Get Drive Request Statistics by Company ID
exports.getDriveRequestStatsByCompanyId = async (req, res) => {
  const { company_id } = req.params;

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
        company_id = ?`;

    // Query to get recent requests' total count
    const recentRequestsQuery = `
      SELECT 
        COUNT(*) AS recent_requests_count
      FROM 
        driveRequests
      WHERE 
        company_id = ?
      ORDER BY 
        requested_at DESC
      LIMIT 5;`;

    // Execute the queries
    const [totalAndStatusResult, recentRequestsResult] = await Promise.all([
      queryAsync(totalAndStatusQuery, [company_id]),
      queryAsync(recentRequestsQuery, [company_id]),
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
    res.status(500).send("Error fetching company drive request statistics");
  }
};

// Get Drive Request Stats by Company ID Grouped by Weeks of the Ongoing Month
exports.getMonthlyDriveRequestStatsByCompanyId = async (req, res) => {
  const { company_id } = req.params;

  try {
    // SQL query to get the count of requests grouped by weeks of the ongoing month
    const weeklyRequestsQuery = `
      SELECT 
        WEEK(requested_at, 1) - WEEK(DATE_SUB(requested_at, INTERVAL DAY(requested_at)-1 DAY), 1) + 1 AS week_number,
        COUNT(*) AS request_count
      FROM 
        driveRequests
      WHERE 
        company_id = ? 
        AND MONTH(requested_at) = MONTH(CURDATE()) 
        AND YEAR(requested_at) = YEAR(CURDATE())
      GROUP BY 
        week_number
      ORDER BY 
        week_number;
    `;

    // Execute the SQL query asynchronously using queryAsync
    const weeklyRequestsResult = await queryAsync(weeklyRequestsQuery, [
      company_id,
    ]);

    // Initialize an object for weekly stats with 0 for each week
    const weeklyStats = {
      week1: 0,
      week2: 0,
      week3: 0,
      week4: 0,
    };

    // Check if weeklyRequestsResult is an array
    if (Array.isArray(weeklyRequestsResult)) {
      // Populate the weeklyStats object with actual data
      weeklyRequestsResult.forEach((row) => {
        switch (row.week_number) {
          case 1:
            weeklyStats.week1 = row.request_count;
            break;
          case 2:
            weeklyStats.week2 = row.request_count;
            break;
          case 3:
            weeklyStats.week3 = row.request_count;
            break;
          case 4:
            weeklyStats.week4 = row.request_count;
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
    console.error("Error fetching drive request stats by week:", error);
    res.status(500).json({ error: "Failed to fetch drive request stats" });
  }
};

exports.getDriveRequestsByCompanyWithOperator = async (req, res) => {
  const { company_id, operator_id } = req.params; // Extract company ID and operator ID from request parameters

  // Check if both company_id and operator_id are provided
  if (!company_id || !operator_id) {
    return res.status(400).json({
      message:
        "Both company_id and operator_id must be provided in the request parameters.",
    });
  }

  // SQL query to find requests by both company ID and operator ID, selecting specific fields
  const query = `
    SELECT id, request_message, operator_id, requested_at 
    FROM driveRequests 
    WHERE company_id = ? AND operator_id = ?
  `;

  try {
    // Execute the query with the provided company_id and operator_id using queryAsync
    const results = await queryAsync(query, [company_id, operator_id]);

    // Handle case where no results are found
    if (results.length === 0) {
      return res.status(404).json({
        message: "No requests found for this company and operator.",
      });
    }

    // Respond with the list of requests
    res.status(200).json(results);
  } catch (error) {
    console.error("Error executing query:", error.message); // Log SQL errors
    res.status(500).json({ message: "Error fetching requests" }); // Respond with a 500 status
  }
};

exports.getDriveInitiationRequestsByCompanyWithOperator = async (req, res) => {
  const { company_id, operator_id } = req.params; // Extract company ID and operator ID from request parameters

  // Check if both company_id and operator_id are provided
  if (!company_id || !operator_id) {
    return res.status(400).json({
      message:
        "Both company_id and operator_id must be provided in the request parameters.",
    });
  }

  // SQL query to find requests by company ID and operator ID with specific status conditions, selecting specific fields
  const query = `
    SELECT id, request_message, operator_id, requested_at 
    FROM driveRequests 
    WHERE company_id = ? 
    AND operator_id = ?
    AND status IN ('submitted', 'viewed', 'replied')
  `;

  try {
    // Execute the query with the provided company_id and operator_id using queryAsync
    const results = await queryAsync(query, [company_id, operator_id]);

    console.log(results);

    // Respond with the list of requests
    res.status(200).json(results);
  } catch (error) {
    console.error("Error executing query:", error.message); // Log SQL errors
    res.status(500).json({ message: "Error fetching requests" }); // Respond with a 500 status
  }
};

exports.getRequestStatsByCompanyId = async (req, res) => {
  const { id } = req.params; // Extract company ID from request parameters

  try {
    // Define queries for each status
    const totalRequestsQuery = `SELECT COUNT(*) AS total_requests FROM driveRequests WHERE company_id = ?`;
    const viewedRequestsQuery = `SELECT COUNT(*) AS viewed_requests FROM driveRequests WHERE company_id = ? AND status != 'submitted'`;
    const repliedRequestsQuery = `SELECT COUNT(*) AS replied_requests FROM driveRequests WHERE company_id = ? AND (status = 'replied' OR status = 'completed')`;
    const pendingRequestsQuery = `SELECT COUNT(*) AS pending_requests FROM driveRequests WHERE company_id = ? AND status = 'submitted'`;
    const unansweredRequestsQuery = `SELECT COUNT(*) AS unanswered_requests FROM driveRequests WHERE company_id = ? AND status = 'viewed'`;
    const rejectedRequestsQuery = `SELECT COUNT(*) AS rejected_requests FROM driveRequests WHERE company_id = ? AND status = 'rejected'`;

    // Run all queries in parallel
    const [
      totalRequestsResult,
      viewedRequestsResult,
      repliedRequestsResult,
      pendingRequestsResult,
      unansweredRequestsResult,
      rejectedRequestsResult,
    ] = await Promise.all([
      queryAsync(totalRequestsQuery, [id]),
      queryAsync(viewedRequestsQuery, [id]),
      queryAsync(repliedRequestsQuery, [id]),
      queryAsync(pendingRequestsQuery, [id]),
      queryAsync(unansweredRequestsQuery, [id]),
      queryAsync(rejectedRequestsQuery, [id]),
    ]);

    // Structure the response
    const response = {
      totalRequests: totalRequestsResult[0].total_requests,
      viewedRequests: viewedRequestsResult[0].viewed_requests,
      repliedRequests: repliedRequestsResult[0].replied_requests,
      pendingRequests: pendingRequestsResult[0].pending_requests,
      unansweredRequests: unansweredRequestsResult[0].unanswered_requests,
      rejectedRequests: rejectedRequestsResult[0].rejected_requests,
    };

    // Send the response
    res.status(200).json(response);
  } catch (error) {
    console.error("Error executing queries:", error.message);
    res.status(500).json({ message: "Error fetching request stats" });
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
    console.log(driveRequest);
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
      requestedAt: driveRequest.requested_at,
      destination: driveRequest.destination,
      departure: driveRequest.departure,
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

/*
exports.ChangeStatusByID = async (req, res) => {
  try {
    const { id, status } = req.params;
    console.log(status);

    // Validate parameters
    if (!id || !status) {
      return res.status(400).send({
        message: "Invalid parameters. Please provide request ID and status.",
      });
    }

    // Validate status
    const validStatuses = [
      "submitted",
      "viewed",
      "replied",
      "rejected",
      "completed",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).send({
        message: `Invalid status. Accepted values are ${validStatuses.join(
          ", "
        )}.`,
      });
    }

    // Construct the query to update status
    const sqlQuery = `
      UPDATE driveRequests
      SET status = ?
      WHERE id = ?
    `;

    // Execute the query asynchronously
    const result = await queryAsync(sqlQuery, [status, id]);

    // Check if any rows were affected
    if (result.affectedRows === 0) {
      return res.status(404).send({ message: "Request not found." });
    }

    res.status(200).send({ message: "Status updated successfully." });
  } catch (err) {
    console.error("Error updating status by request ID:", err.message);
    res.status(500).send({
      message: "Error occurred while updating the status.",
    });
  }
};

exports.RejectRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_message, rejection_reason } = req.body;

    // Validate parameters and body
    if (!id) {
      return res.status(400).send({
        message: "Request ID is required.",
      });
    }
    if (!rejection_message || !rejection_reason) {
      return res.status(400).send({
        message: "Rejection message and reason are required.",
      });
    }

    // Construct the SQL query to update the request
    const sqlQuery = `
      UPDATE driveRequests
      SET 
          status = 'rejected',
          rejection_message = ?,
          rejection_reason = ?
      WHERE id = ?
    `;

    // Execute the update query using async/await with queryAsync
    const result = await queryAsync(sqlQuery, [
      rejection_message,
      rejection_reason,
      id,
    ]);

    // Check if any rows were affected
    if (result.affectedRows === 0) {
      return res.status(404).send({
        message: "Request not found.",
      });
    }

    res.status(200).send({
      message: "Request rejected successfully.",
    });
  } catch (err) {
    console.error("Error rejecting request by ID:", err);
    res.status(500).send({
      message: "Error occurred while rejecting the request.",
    });
  }
};
*/

exports.ChangeStatusByID = async (req, res) => {
  try {
    const { id, status } = req.params;
    console.log(status);

    // Validate parameters
    if (!id || !status) {
      return res.status(400).send({
        message: "Invalid parameters. Please provide request ID and status.",
      });
    }

    // Validate status
    const validStatuses = [
      "submitted",
      "viewed",
      "replied",
      "rejected",
      "completed",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).send({
        message: `Invalid status. Accepted values are ${validStatuses.join(
          ", "
        )}.`,
      });
    }

    // Construct the query to update status
    const sqlQuery = `
      UPDATE driveRequests
      SET status = ?
      WHERE id = ?
    `;

    // Execute the query asynchronously
    const result = await queryAsync(sqlQuery, [status, id]);

    // Check if any rows were affected
    if (result.affectedRows === 0) {
      return res.status(404).send({ message: "Request not found." });
    }

    // Fetch the operator's subscriber ID (assuming you have a function to get it)
    const request = await queryAsync(
      "SELECT operator_id FROM driveRequests WHERE id = ?",
      [id]
    );
    if (!request || !request[0]) {
      return res.status(404).send({ message: "Request not found." });
    }

    const operatorId = request[0].operator_id;
    const subscriberId = await getOperatorNotificationId(operatorId);
    const actionUrl = `/operator/requests/view-drive-request/${id}`;
    const emailBody = `The status of your request with ID ${id} has been updated to '${status}' by the company.`;
    const body = `Drive Request has been ${status}`;

    // Send the notification to the operator
    notify(subscriberId, actionUrl, body);

    const email = await getOperatorEmail(operatorId);

    sendNotificationEmail(
      email,
      "Request Status Updated",
      emailBody + ". Click View button below to learn more",
      `${process.env.REACT_APP_URL}${actionUrl}`,
      subscriberId
    );

    res.status(200).send({ message: "Status updated successfully." });
  } catch (err) {
    console.error("Error updating status by request ID:", err.message);
    res.status(500).send({
      message: "Error occurred while updating the status.",
    });
  }
};

exports.RejectRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_message, rejection_reason } = req.body;

    // Validate parameters and body
    if (!id) {
      return res.status(400).send({
        message: "Request ID is required.",
      });
    }
    if (!rejection_message || !rejection_reason) {
      return res.status(400).send({
        message: "Rejection message and reason are required.",
      });
    }

    // Construct the SQL query to update the request
    const sqlQuery = ` UPDATE driveRequests
      SET 
          status = 'rejected',
          rejection_message = ?,
          rejection_reason = ?
      WHERE id = ?`;
    // Execute the update query using async/await with queryAsync
    const result = await queryAsync(sqlQuery, [
      rejection_message,
      rejection_reason,
      id,
    ]);

    // Check if any rows were affected
    if (result.affectedRows === 0) {
      const driveRequest = await queryAsync(
        "SELECT operator_id FROM driveRequests WHERE drive_id = ?",
        [id]
      );
      if (!driveRequest || !driveRequest[0]) {
        return res.status(404).json({ message: "Drive not found" });
      }

      const operatorId = driveRequest[0].operator_id;
      const subscriberId = await getOperatorNotificationId(operatorId);
      const actionUrl = `/operator/requests/view-drive-request/${id}`;
      const body = "Company has rejected your Drive Request";
      notify(subscriberId, actionUrl, body);

      return res.status(404).send({
        message: "Request not found.",
      });
    }

    // Fetch the operator's subscriber ID (assuming you have a function to get it)
    const request = await queryAsync(
      `SELECT operator_id FROM driveRequests WHERE id = ?`,
      [id]
    );
    if (!request || !request[0]) {
      return res.status(404).send({ message: "Request not found." });
    }

    const operatorId = request[0].operator_id;

    const subscriberId = await getOperatorNotificationId(operatorId);
    const actionUrl = `/operator/requests/view-request/${id}`;
    const body = "Drive request  has been rejected.";
    const emailBody = `Your request with ID ${id} has been rejected by the company. Reason: ${rejection_reason}. Message: ${rejection_message}`;

    // Send the notification to the operator
    notify(subscriberId, actionUrl, body);

    const email = await getOperatorEmail(operatorId);

    sendNotificationEmail(
      email,
      "Drive Request Rejected",
      emailBody + ". Click View button below to learn more",
      `${process.env.REACT_APP_URL}${actionUrl}`,
      subscriberId
    );

    res.status(200).send({
      message: "Request rejected successfully.",
    });
  } catch (err) {
    console.error("Error rejecting request by ID:", err);
    res.status(500).send({
      message: "Error occurred while rejecting the request.",
    });
  }
};

exports.getRequestByCompanyIdWithStatus = async (req, res) => {
  try {
    const { id, status } = req.params; // Extract company ID and status from request parameters

    if (!id || !status) {
      return res
        .status(400)
        .json({ message: "Insufficient parameters provided" });
    }

    // Define valid statuses
    const validStatuses = [
      "pending",
      "unanswered",
      "viewed",
      "rejected",
      "replied",
      "completed",
    ];

    // Check if the provided status is valid
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status provided" });
    }

    let query = `SELECT id, operator_id, company_id, requested_at, request_message, status FROM driveRequests WHERE company_id = ?`;
    const queryParams = [id];

    switch (status) {
      case "pending":
        query += " AND status = 'submitted'";
        break;

      case "replied":
        query += " AND status IN ('replied', 'completed')";
        break;

      case "viewed":
        query += " AND status != 'submitted'";
        break;

      case "unanswered":
        query += " AND status = 'viewed'";
        break;

      case "rejected":
        query += " AND status = 'rejected'";
        break;

      default:
        return res.status(400).json({ message: "Invalid status provided" });
    }

    // Query to fetch requests based on the specified status
    const results = await queryAsync(query, queryParams);

    if (results.length === 0) {
      return res.status(404).json({
        message: "No requests found for this company with the specified status",
      });
    }

    res.status(200).json(results);
  } catch (error) {
    console.error("Error executing query:", error.message);
    res.status(500).json({ message: "Error fetching requests" });
  }
};

//Operators
// Operators
exports.findOperatorById = async (req, res) => {
  const id = req.params.id;

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
        status 
      FROM operators 
      WHERE id = ?
    `;

    // Execute the query
    const result = await queryAsync(query, [id]);

    if (result.length > 0) {
      // Send the result with only the selected fields
      res.status(200).send(result[0]);
    } else {
      res.status(404).send({
        message: `Cannot find Operator with id=${id}.`,
      });
    }
  } catch (err) {
    // Improved error handling with more information
    console.error("Error executing query: ", err); // Log error to server console

    res.status(500).send({
      message: "Error retrieving Operator with id=" + id,
      error: err.message, // Include the error message for debugging
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

// Get Invoice Stats by Company ID
exports.getPaymentStatsByCompanyId = async (req, res) => {
  const { company_id } = req.params;

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
      WHERE company_id = ?`;

    // Execute the query
    const result = await queryAsync(query, [company_id]);

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
      error: "An error occurred while fetching company invoice stats",
    });
  }
};

exports.checkInvoiceByDriveId = async (req, res) => {
  const { drive_id } = req.params;

  // Check if drive_id is missing
  if (!drive_id) {
    return res.status(400).json({ message: "Missing drive ID" });
  }

  // SQL query to check for invoice
  const selectQuery = `
    SELECT *
    FROM invoices
    WHERE drive_id = ${drive_id};
  `;

  try {
    // Execute the query
    const results = await queryAsync(selectQuery);

    console.log(results);
    // Check if results exist
    if (results && results.length > 0) {
      return res.status(200).json({ message: true });
    }

    return res.status(200).json({ message: false });
  } catch (err) {
    console.error("Error executing query: ", err.stack);
    return res
      .status(500)
      .json({ message: `Error checking invoice: ${err.message}` });
  }
};

exports.addInvoice = async (req, res) => {
  const { created_at, updated_at, drive_id, company_id, operator_id, amount } =
    req.body;

  if (
    !created_at ||
    !updated_at ||
    !drive_id ||
    !company_id ||
    !operator_id ||
    !amount
  ) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const invoiceCredentialQuery = `SELECT value FROM invoice_credentials WHERE name = ?`;

  const invoiceCredentialResult = await queryAsync(invoiceCredentialQuery, ["tax"]);
  const platform_charge =  invoiceCredentialResult[0].value;
  
  // SQL query to check if an invoice exists with the given drive_id
  const checkQuery = `
    SELECT * 
    FROM invoices 
    WHERE drive_id = ?
  `;

  try {
    const existingInvoice = await queryAsync(checkQuery, [drive_id]);

    if (existingInvoice.length > 0) {
      // If the invoice exists, update its amount and updated_at fields
      const updateQuery = `
        UPDATE invoices 
        SET amount = ?, updated_at = ?, platform_charge = ?
        WHERE drive_id = ?
      `;
      const updateValues = [amount, updated_at, platform_charge, drive_id];

      await queryAsync(updateQuery, updateValues);
      return res.status(200).json({
        message: "Invoice updated successfully",
        updatedInvoiceId: existingInvoice[0].id, // Return the ID of the updated invoice
      });
    } else {
      // If the invoice doesn't exist, create a new one
      const insertQuery = `
        INSERT INTO invoices 
        (created_at, updated_at, drive_id, company_id, operator_id, amount, platform_charge) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const insertValues = [
        created_at,
        updated_at,
        drive_id,
        company_id,
        operator_id,
        amount,
        platform_charge,
      ];

      const results = await queryAsync(insertQuery, insertValues);
      return res.status(200).json({
        message: "Invoice added successfully",
        invoiceId: results.insertId, // Return the ID of the newly created invoice
      });
    }
  } catch (err) {
    console.error("Error executing query: " + err.stack);
    return res.status(500).json({
      message: `Error adding or updating invoice: ${err.message}`,
    });
  }
};

exports.getInvoicesByCompanyId = async (req, res) => {
  const { company_id } = req.params;

  const sqlQuery = `
      SELECT invoices.id, invoices.created_at, invoices.updated_at, invoices.due_date, 
             invoices.status, invoices.discount, invoices.tax, invoices.platform_charge, invoices.late_fine, invoices.additional_cost, invoices.drive_id, invoices.company_id, invoices.operator_id, invoices.amount 
      FROM invoices 
      LEFT JOIN drives ON invoices.drive_id = drives.drive_id
      WHERE invoices.company_id = ?
    `;

  try {
    const results = await queryAsync(sqlQuery, [company_id]);

    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "No invoices found for the specified company_id" });
    }

    res.status(200).json(results);
  } catch (error) {
    console.error("Error executing query:", error.message);
    return res.status(500).json({ message: "Error retrieving invoices" });
  }
};

exports.getInvoicesByCompanyIdWithStatus = async (req, res) => {
  const { company_id, status } = req.params;

  const sqlQuery = `
    SELECT invoices.id, invoices.created_at, invoices.updated_at, invoices.due_date, 
           invoices.status, invoices.discount, invoices.tax, invoices.platform_charge, invoices.late_fine, invoices.additional_cost, invoices.drive_id, invoices.company_id, invoices.operator_id, invoices.amount 
    FROM invoices 
    LEFT JOIN drives ON invoices.drive_id = drives.drive_id
    WHERE invoices.company_id = ? AND invoices.status = ?
  `;

  try {
    const results = await queryAsync(sqlQuery, [company_id, status]);

    // Return an empty array if no records found
    res.status(200).json(results);
  } catch (error) {
    console.error("Error executing query:", error.message);
    return res.status(500).json({ message: "Error retrieving invoices" });
  }
};

exports.getInvoicesByCompanyIdWithDuration = async (req, res) => {
  const { company_id, duration } = req.params;

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
           invoices.status, invoices.drive_id, invoices.company_id, invoices.operator_id, invoices.amount 
    FROM invoices 
    LEFT JOIN drives ON invoices.drive_id = drives.drive_id
    WHERE invoices.company_id = ? AND invoices.created_at >= ?
  `;

  try {
    const results = await queryAsync(sqlQuery, [company_id, dateCondition]);

    // Return an empty array if no records are found
    res.status(200).json(results);
  } catch (error) {
    console.error("Error executing query:", error.message);
    return res.status(500).json({ message: "Error retrieving invoices" });
  }
};

exports.getInvoicesStatsByCompanyId = async (req, res) => {
  const { company_id } = req.params; // Extract company ID from request parameters

  // Get current date
  const now = new Date();

  // Calculate date ranges for weekly, monthly, and yearly durations
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(now.getDate() - 7);

  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(now.getMonth() - 1);

  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  // Format dates to match SQL datetime format
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
    // Define SQL queries for each invoice category and duration
    const totalInvoicesQuery = `SELECT COUNT(*) AS total_invoices, SUM(amount) AS total_amount FROM invoices WHERE company_id = ?`;
    const pendingInvoicesQuery = `SELECT COUNT(*) AS pending_invoices, SUM(amount) AS pending_amount FROM invoices WHERE company_id = ? AND status = 'pending'`;
    const unpaidInvoicesQuery = `SELECT COUNT(*) AS unpaid_invoices, SUM(amount) AS unpaid_amount FROM invoices WHERE company_id = ? AND status = 'unpaid'`;
    const weeklyInvoicesQuery = `SELECT COUNT(*) AS weekly_invoices, SUM(amount) AS weekly_amount FROM invoices WHERE company_id = ? AND created_at >= ?`;
    const monthlyInvoicesQuery = `SELECT COUNT(*) AS monthly_invoices, SUM(amount) AS monthly_amount FROM invoices WHERE company_id = ? AND created_at >= ?`;
    const yearlyInvoicesQuery = `SELECT COUNT(*) AS yearly_invoices, SUM(amount) AS yearly_amount FROM invoices WHERE company_id = ? AND created_at >= ?`;

    // Run all queries in parallel
    const [
      totalInvoicesResult,
      pendingInvoicesResult,
      unpaidInvoicesResult,
      weeklyInvoicesResult,
      monthlyInvoicesResult,
      yearlyInvoicesResult,
    ] = await Promise.all([
      queryAsync(totalInvoicesQuery, [company_id]),
      queryAsync(pendingInvoicesQuery, [company_id]),
      queryAsync(unpaidInvoicesQuery, [company_id]),
      queryAsync(weeklyInvoicesQuery, [company_id, oneWeekAgoFormatted]),
      queryAsync(monthlyInvoicesQuery, [company_id, oneMonthAgoFormatted]),
      queryAsync(yearlyInvoicesQuery, [company_id, oneYearAgoFormatted]),
    ]);

    // Structure the response object with the results
    const response = {
      totalInvoices: totalInvoicesResult[0].total_invoices || 0,
      totalAmount: totalInvoicesResult[0].total_amount || 0,
      pendingInvoices: pendingInvoicesResult[0].pending_invoices || 0,
      pendingAmount: pendingInvoicesResult[0].pending_amount || 0,
      unpaidInvoices: unpaidInvoicesResult[0].unpaid_invoices || 0,
      unpaidAmount: unpaidInvoicesResult[0].unpaid_amount || 0,
      weeklyInvoices: weeklyInvoicesResult[0].weekly_invoices || 0,
      weeklyAmount: weeklyInvoicesResult[0].weekly_amount || 0,
      monthlyInvoices: monthlyInvoicesResult[0].monthly_invoices || 0,
      monthlyAmount: monthlyInvoicesResult[0].monthly_amount || 0,
      yearlyInvoices: yearlyInvoicesResult[0].yearly_invoices || 0,
      yearlyAmount: yearlyInvoicesResult[0].yearly_amount || 0,
    };

    // Send the response
    res.status(200).json(response);
  } catch (error) {
    console.error("Error executing queries:", error.message);
    res.status(500).json({ message: "Error fetching invoice stats" });
  }
};

exports.findAllOfThem = async (req, res) => {
  try {
    const query = "SELECT * FROM companies";
    const data = await queryAsync(query);

    res.send(data);
  } catch (err) {
    res.status(500).send({
      message:
        err.message || "Some errors occurred while retrieving companies.",
    });
  }
};

exports.deleteCompany = async (req, res) => {
  const id = req.params.id;

  if (!id) {
    return res.status(400).send({
      message: "Company ID is required.",
    });
  }

  try {
    const updatedAt = new Date(); // Set the update date
    const query =
      "UPDATE companies SET is_Active = false, updatedAt = ? WHERE id = ?";
    const result = await queryAsync(query, [updatedAt, id]);

    if (result.affectedRows === 0) {
      return res.status(404).send({
        message: "Company not found or already inactive.",
      });
    }

    res.status(200).send({
      message: "Company marked as inactive successfully.",
    });
  } catch (error) {
    res.status(500).send({
      message: "Error updating company with id=" + id,
    });
  }
};

exports.findCompanyById = async (req, res) => {
  const id = req.params.id;

  try {
    const query = `
    SELECT companies.*, about_us.content as about_us_content
    FROM companies 
    LEFT JOIN about_us ON companies.id = about_us.role_id AND about_us.role = 'company'
    WHERE companies.id = ?
`;
    const data = await queryAsync(query, [id]);
    // console.log(data);
    if (data.length > 0) {
      res.status(200).send(data[0]);
    } else {
      res.status(404).send({
        message: `Cannot find company with id=${id}.`,
      });
    }
  } catch (err) {
    res.status(500).send({
      message: "Error retrieving company with id=" + id,
    });
  }
};

exports.verifyToken = async (req, res) => {
  const { email, token } = req.body;

  try {
    // Query the database to retrieve the token for the given email
    const query = `SELECT emailToken FROM companies WHERE email = ?`;
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

  console.log("request recieved from : ", email);

  try {
    const token = crypto.randomBytes(32).toString("hex");

    const query = `SELECT * FROM companies WHERE email = ?`;
    // Query the database to find the user by email
    const result = await queryAsync(query, [email]);

    if (result.length > 0) {
      const query = `UPDATE companies SET emailToken = ? WHERE email = ?`;
      await queryAsync(query, [token, result[0].email]);
      const resp = await queryAsync(
        `SELECT notification_id FROM companies WHERE email = ?`,
        [email]
      );
      const sId = resp[0].notification_id;
      sendResetEmail(
        email,
        `${process.env.REACT_APP_URL}/company/reset-password/${email}?t=${token}`,
        result[0].name,
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

exports.findCompanyByChatID = async (req, res) => {
  try {
    // Get the chat_id from the request parameters
    const { chat_id } = req.params;

    // SQL query to fetch the operator based on chat_id
    const query = `
      SELECT * FROM companies 
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

exports.changeCompanyStatus = async (req, res) => {
  const id = req.params.id;
  const newStatus = req.query.status;

  console.log("Change company status");
  console.log(id);
  console.log(newStatus);
  try {
    const updatedAt = new Date(); // Set the update date
    const query = "UPDATE companies SET status = ?, updatedAt = ? WHERE id = ?";
    const result = await queryAsync(query, [newStatus, updatedAt, id]);
    console.log(result);
    if (result.affectedRows === 0) {
      return res.status(404).send({
        message: `Cannot find company with id=${id}.`,
      });
    }

    const selectQuery = "SELECT * FROM companies WHERE id = ?";
    const updatedCompany = await queryAsync(selectQuery, [id]);

    res.send(updatedCompany[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send({
      message: "Error updating company with id=" + id,
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
      UPDATE companies
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
  console.log("incoming login request:", req.body);

  try {
    const query = "SELECT * FROM companies WHERE email = ?";
    const data = await queryAsync(query, [email]);

    if (data.length > 0) {
      const company = data[0];

      if (company.verified === "false") {
        res.status(400).send({
          message: "Verify your email to login.",
        });
        return;
      }

      const isMatch = await bcrypt.compare(password, company.password);

      if (isMatch) {
        const token = jwt.sign(
          { email: company.email, name: company.name, role: "company" },
          process.env.JWT_SECRET_KEY
        );

        console.log("company.notification_id");
        console.log(company.notification_id);
        res.send({
          id: company.id,
          name: company.name,
          role: "company",
          token: token,
          chat_id: company.chat_id,
          notification_id: company.notification_id,
          profileUrl: company.profileUrl,
        });
      } else {
        res.status(400).send({
          message: "Invalid Password.",
        });
      }
    } else {
      res.status(400).send({
        message: "User Not Found.",
      });
    }
  } catch (err) {
    res.status(500).send({
      message: "Error retrieving company with email=" + email,
    });
  }
};

exports.getUserByEmail = async (req, res) => {
  const email = req.body.email;

  try {
    const query = "SELECT * FROM companies WHERE email = ?";
    const data = await queryAsync(query, [email]);

    if (data.length > 0) {
      res.status(200).send(data[0]);
    } else {
      res.status(400).send({
        message: "Company Not Found.",
      });
    }
  } catch (err) {
    res.status(500).send({
      message: "Error retrieving company with email=" + email,
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
      ? `SELECT * FROM companies WHERE email ="${email}"`
      : `SELECT * FROM companies WHERE id=${id}`;
    const data = await queryAsync(query);

    if (data.length === 0) {
      res.status(400).send({
        message: "Company Not Found.",
      });
      return;
    }

    const company = data[0];
    console.log("company", company);

    // If `oldPass` is provided, validate it against the current password
    if (old) {
      const isOldPasswordValid = await bcrypt.compare(old, company.password);
      if (!isOldPasswordValid) {
        res.status(400).send({
          message: "Current password is incorrect.",
        });
        return;
      }
    } else {
      // If `oldPass` is not provided, validate the token
      if (company.emailToken != token) {
        res.status(400).send({
          message: "Reset link is broken. Try Again",
        });
        return;
      }
    }

    // Check if the new password is the same as the old password
    const isNewPasswordSame = await bcrypt.compare(
      newPassword,
      company.password
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
      "UPDATE companies SET password = ?, updatedAt = ? WHERE email = ?",
      [hash, updatedAt, company.email]
    );

    res.send({ message: "Password updated successfully." });
  } catch (err) {
    console.log(err);
    res.status(500).send({
      message: "Error updating password for company with email=" + email,
    });
  }
};

exports.getCompanies = async (req, res) => {
  console.log("Get companies");
  try {
    const query = "SELECT * FROM companies";
    const data = await queryAsync(query);

    res.status(200).send(data);
  } catch (err) {
    res.status(500).send({
      message: "Error retrieving companies",
    });
  }
};
//Drivers
exports.getDrivers = async (req, res) => {
  const id = req.params.id;

  if (!id) {
    return res.status(400).json({ message: "ID is required." });
  }

  try {
    // Use raw SQL query to fetch drivers based on the provided ID
    const drivers = await queryAsync(
      `SELECT * FROM drivers WHERE company_id = ${id}`
    );

    if (drivers.length === 0) {
      return res
        .status(404)
        .json({ message: "No drivers found for the given ID." });
    }
    res.status(200).json(drivers);
  } catch (error) {
    console.error("Error fetching drivers:", error); // Log the error for debugging
    res
      .status(500)
      .json({ message: "An error occurred while fetching the drivers." });
  }
};

exports.getDriverStatsByCompanyID = async (req, res) => {
  const { id: companyId } = req.params;

  try {
    // SQL query to get the count of freshers, experienced drivers, and total drivers for a specific company
    const driverStatsQuery = `
      SELECT 
        SUM(CASE WHEN experienceYears < 5 THEN 1 ELSE 0 END) AS fresherDrivers,
        SUM(CASE WHEN experienceYears >= 5 THEN 1 ELSE 0 END) AS experiencedDrivers,
        COUNT(*) AS totalDrivers
      FROM drivers
      WHERE company_id = ?;
    `;

    // Execute the SQL query asynchronously using queryAsync
    const [driverStatsResult] = await queryAsync(driverStatsQuery, [companyId]);

    // If no results found, return 404
    if (!driverStatsResult) {
      return res
        .status(404)
        .json({ message: "No data found for the provided company ID." });
    }

    // Extract fresher, experienced driver counts, and total drivers
    const driverStats = {
      fresherDrivers: driverStatsResult.fresherDrivers || 0,
      experiencedDrivers: driverStatsResult.experiencedDrivers || 0,
      totalDrivers: driverStatsResult.totalDrivers || 0,
    };

    // Send the response
    res.status(200).json(driverStats);
  } catch (error) {
    // Log error and send error response
    console.error("Error fetching driver stats:", error);
    res.status(500).json({ error: "Failed to fetch driver stats" });
  }
};

exports.GetCompanyByIdWithServices = (req, res) => {
  const { company_id } = req.params;

  if (!company_id) {
    return res.status(400).json({ message: "company_id is required" });
  }

  const sqlQuery = `
    SELECT * 
    FROM companies 
    WHERE id = ?
  `;

  dbModelLess.query(sqlQuery, [company_id], (error, results) => {
    if (error) {
      console.error("Error executing query:", error.message);
      return res.status(500).json({ message: "Error retrieving company" });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "No company found for the specified company_id" });
    }

    res.status(200).json(results[0]); // Return the first (and likely only) result as an object instead of an array
  });
};

exports.filterModelLessCompanies = async (req, res) => {
  try {
    const query = "SELECT * FROM drivers WHERE company_id = ?";
    const data = await queryAsync(query, [id]);

    res.status(200).send(data);
  } catch (err) {
    res.status(500).send({
      message: "Error fetching drivers for company with id=" + id,
    });
  }
};
exports.GetFilterCompaniesWithServices = async (req, res) => {
  try {
    const filters = req.body.filters; // Array of objects containing key-value pairs for filtering
    if (!filters || filters.length === 0) {
      return res.status(400).send({
        message: "No filter criteria provided.",
      });
    }

    // Build the SQL WHERE conditions dynamically based on the filters
    const queryConditions = filters.map((filter) => {
      // Destructure the key and value from the filter object
      let { key, value } = filter;

      // Wrap column names with backticks to handle spaces or special characters in the names
      key = `\`${key}\``;

      // If the value contains comma-separated values, split them into an array
      if (typeof value === "string" && value.includes(",")) {
        const valuesArray = value.split(",").map((val) => val.trim());
        // Use AND condition to ensure all values must be present in the same column
        const likeConditions = valuesArray
          .map((val) => `${key} LIKE '%${val}%'`)
          .join(" AND ");
        return `(${likeConditions})`;
      } else {
        // For single value, use LIKE for partial match
        return `${key} LIKE '%${value}%'`;
      }
    });

    // Combine all conditions using AND
    const whereClause = queryConditions.join(" AND ");

    // Construct the SQL query
    const sqlQuery = `SELECT * FROM companies WHERE ${whereClause}`;

    // Execute the query directly on the database
    dbModelLess.query(sqlQuery, (err, result) => {
      if (err) {
        console.error("Error executing query:", err);
        return res.status(500).send({
          message: "Error occurred while filtering companies.",
        });
      }
      // Return the filtered companies
      res.status(200).send(result);
    });
  } catch (err) {
    console.error("Error filtering companies:", err);
    res.status(500).send({
      message: "Error occurred while filtering companies.",
    });
  }
};

exports.GetFilterCompaniesWithServicesCalender = async (req, res) => {
  try {
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

    // Execute the query directly on the database
    database.query(sqlQuery, (err, result) => {
      if (err) {
        console.error("Error executing query:", err);
        return res.status(500).send({
          message: "Error occurred while filtering companies.",
        });
      }
      console.log(result);
      res.status(200).send(result);
    });
  } catch (err) {
    console.error("Error filtering companies:", err);
    res.status(500).send({
      message: "Error occurred while filtering companies.",
    });
  }
};

exports.editCompany = async (req, res) => {
  const { id } = req.params; // Get the company ID from the URL parameters
  const {
    name,
    company_name,
    address,
    contact,
    email,
    profileUrl,
    description,
  } = req.body; // Get the potential fields to update from the request body

  

  if (!id) {
    return res.status(400).json({ message: "Company ID is required." });
  }

  // Prepare the updated fields object
  const updatedFields = {};

  if (name) updatedFields.name = name;
  if (email) updatedFields.email = email;
  if (address) updatedFields.address = address;
  if (contact) updatedFields.contact = contact;
  if (profileUrl) updatedFields.profileUrl = profileUrl;
  if (description) updatedFields.description = description;
  if (company_name) updatedFields.company_name = company_name;

  console.log(updatedFields);
  

  try {
    const [updatedRows] = await Company.update(updatedFields, {
      where: { id },
      returning: true,
    });


    console.log("Updated rows:", updatedRows);
    

    if (updatedRows === 0) {
      return res.status(404).json({ message: "Company not found." });
    }

    const updatedCompany = await Company.findByPk(id);

    res.status(200).json(updatedCompany);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
    console.error("Error updating company:", error);
  }
};

//get Role

exports.getRole = async (req, res) => {
  const { chat_id } = req.params;

  // Check if chat_id is provided
  if (!chat_id) {
    return res.status(400).json({ error: "chat_id is required" });
  }

  try {
    let query;
    let role;
    let user;

    // Check if chat_id is in the companies table
    query = `SELECT id FROM companies WHERE chat_id = ?`;
    user = await queryAsync(query, [chat_id]);

    if (user.length > 0) {
      role = "company";
    } else {
      // Check if chat_id is in the operators table
      query = `SELECT id FROM operators WHERE chat_id = ?`;
      user = await queryAsync(query, [chat_id]);

      if (user.length > 0) {
        role = "operator";
      } else {
        // Check if chat_id is in the admins table
        query = `SELECT id FROM admins WHERE chat_id = ?`;
        user = await queryAsync(query, [chat_id]);

        if (user.length > 0) {
          role = "admin";
        }
      }
    }

    // If no role was found, return 404
    if (!user) {
      return res
        .status(404)
        .json({ error: "User with provided chat ID not found" });
    }

    // Return the found role and id
    res.status(200).json({ role, user });
  } catch (error) {
    console.error("Error fetching role by chat ID:", error.message);
    res.status(500).json({ error: "Failed to retrieve role" });
  }
};

//Company setup
exports.setupCompanyInfo = async (req, res) => {
  try {
    // Get company data from request body
    const companyData = {
      ...req.body,
      name: req.body.companyName, // Map companyName to name field
      // Extract filter fields to top level and sanitize keys
      ...(req.body.filters && {
        price_range: req.body.filters.price_range,
        train_type: req.body.filters.trainType, // Changed to snake_case
        train_color: req.body.filters["train Color"], // Changed to snake_case
        train_composition: req.body.filters.trainComposition, // Changed to snake_case
        drive_date: req.body.filters.driveDate, // Changed to snake_case
      }),
      // Map hourlyRate to hourly_rate
      hourly_rate: req.body.hourlyRate,
      // Map numeric fields
      total_drivers: req.body.totalDrivers,
      inactive_drivers: req.body.inactiveDrivers,
      total_drives: req.body.totalDrives,
    };

    // Define fields that should be set during login/auth, not during profile setup
    const postLoginFields = [
      "notification_id",
      "chat_id",
      "emailToken",
      "password",
    ];

    // Define basic required fields for initial setup
    const requiredFields = ["name"];

    const executeQuery = (query, params = []) => {
      return new Promise((resolve, reject) => {
        dbModelLess.query(query, params, (error, results) => {
          if (error) reject(error);
          else resolve(results);
        });
      });
    };

    // Get table structure
    const tableColumns = await executeQuery("DESCRIBE companies");
    const existingColumns = tableColumns.map((col) => col.Field);

    // Validate only the basic required fields
    for (const field of requiredFields) {
      if (!companyData.hasOwnProperty(field)) {
        return res.status(400).json({
          success: false,
          message: `Missing required field: ${field}`,
        });
      }
    }

    // Prepare data for update
    const validData = {};
    const invalidFields = [];
    const skippedPostLoginFields = [];

    // Process all incoming fields
    for (const [key, value] of Object.entries(companyData)) {
      // Skip post-login fields and null/undefined values
      if (postLoginFields.includes(key)) {
        skippedPostLoginFields.push(key);
        continue;
      }

      // Convert camelCase to snake_case and check if column exists
      const snakeCaseKey = key.replace(
        /[A-Z]/g,
        (letter) => `_${letter.toLowerCase()}`
      );
      if (
        existingColumns.includes(snakeCaseKey) &&
        value !== null &&
        value !== undefined
      ) {
        validData[snakeCaseKey] = value;
      } else if (value !== null && value !== undefined) {
        invalidFields.push(key);
      }
    }

    // Add automatic fields
    validData.updatedAt = new Date();

    // Set default values only if they don't exist
    const defaults = {
      profileUrl:
        "https://ik.imagekit.io/mja/pp-ph.png?updatedAt=1713673175390",
      status: "pending",
      verified: "false",
      is_active: 1,
    };

    for (const [key, value] of Object.entries(defaults)) {
      if (!validData.hasOwnProperty(key)) {
        validData[key] = value;
      }
    }

    // Convert numeric fields
    if (validData.total_drivers)
      validData.total_drivers = parseInt(validData.total_drivers);
    if (validData.inactive_drivers)
      validData.inactive_drivers = parseInt(validData.inactive_drivers);
    if (validData.total_drives)
      validData.total_drives = parseInt(validData.total_drives);
    if (validData.hourly_rate)
      validData.hourly_rate = parseFloat(validData.hourly_rate);

    // Prepare UPDATE query
    const setClause = Object.keys(validData)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = Object.values(validData);

    // Add WHERE clause based on company identification (assuming company_id is available)
    const companyId = req.params.companyId;
    let updateQuery;
    if (companyId) {
      updateQuery = `
        UPDATE companies 
        SET ${setClause}
        WHERE id = ?
      `;
      values.push(companyId);
    } else {
      // If no company ID, create new record
      const columns = Object.keys(validData);
      const placeholders = Array(values.length).fill("?").join(",");
      updateQuery = `
        INSERT INTO companies (${columns.join(",")})
        VALUES (${placeholders})
      `;
      validData.created_at = new Date();
    }

    // Execute update/insert query
    const result = await executeQuery(updateQuery, values);

    // Prepare response
    const response = {
      success: true,
      message: companyId
        ? "Company information updated successfully"
        : "Company information saved successfully",
      companyId: companyId || result.insertId,
      data: validData,
    };

    // Include warnings about invalid and post-login fields
    if (invalidFields.length > 0 || skippedPostLoginFields.length > 0) {
      response.warnings = {
        message: "Some fields were not processed",
        details: {},
      };

      if (invalidFields.length > 0) {
        response.warnings.details.invalidFields = {
          message: "These fields do not exist in the database",
          fields: invalidFields,
        };
      }

      if (skippedPostLoginFields.length > 0) {
        response.warnings.details.postLoginFields = {
          message: "These fields will be set during login/authentication",
          fields: skippedPostLoginFields,
        };
      }
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error in setupCompanyInfo:", error);

    // Handle specific SQL errors
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A company with this information already exists",
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error setting up company information",
      error: error.message,
    });
  }
};
//About us
