const database = require("../../index");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { promisify } = require("util");
const notify = require("../../novu/send-notification"); // Adjust import path as needed
const generateUniqueUserId = require("../../utils/generateUniqueId");
const dotenv = require("dotenv");
const createNovuSubscriber = require("../../novu/create-subscriber");
const { sendResetEmail } = require("../../novu/send-verification-email");
const { sendInvoiceEmail } = require("../../novu/send-verification-email");
const  { generateInvoicePDF }  = require("../../utils/invoicePdfGenerator");
dotenv.config();

const {
  getCompanyNotificationId,
  getCompanyEmail,
} = require("../../utils/NotificationIds/getCompanyNotificationId");
const {
  getOperatorNotificationId,
  getOperatorEmail,
} = require("../../utils/NotificationIds/getOperatorNotificationID");

const bodyParser = require("body-parser");
const express = require("express");
const { default: axios } = require("axios");
const { platform } = require("os");
const { log } = require("console");
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
      message: "Email is required",
    });
  }

  try {
    const hash = await bcrypt.hash(req.body.password, 10);

    const admin = {
      name: req.body.name,
      email: req.body.email,
      password: hash,
      role: req.body.role,
      createdAt: new Date(), // Set the creation date
      updatedAt: new Date(), // Set the update date
    };

    // Call createNovuSubscriber to get subscriberId
    const subscriberId = await createNovuSubscriber(
      admin.name,
      admin.email,
      req.body.phone || "", // Assuming phone is part of req.body
      req.body.avatar ||
        "https://ik.imagekit.io/mja/pp-ph.png?updatedAt=1713673175390" // Assuming avatar is part of req.body
    );
    console.log(subscriberId);
    const insertQuery = `
      INSERT INTO admins (name, email, password, role, createdAt, updatedAt, notification_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `;

    console.log("Insert Query:", insertQuery);
    console.log("Values:", [
      admin.name,
      admin.email,
      admin.password,
      admin.role,
      admin.createdAt,
      admin.updatedAt,
      subscriberId, // Set the subscriberId as notification_id
    ]);

    const result = await queryAsync(insertQuery, [
      admin.name,
      admin.email,
      admin.password,
      admin.role,
      admin.createdAt,
      admin.updatedAt,
      subscriberId,
    ]);

    const adminId = result.insertId;
    const uid = generateUniqueUserId();

    console.log("profileUrl =", req.body.profileUrl); // Use req.body.profileUrl
    await createUserInCometChat(uid, admin.name + "admin", req.body.profileUrl);
    await queryAsync("UPDATE admins SET chat_id = ? WHERE id = ?", [
      uid,
      adminId,
    ]);

    res.status(200).send({
      data: { id: adminId, ...admin },
      chat_id: uid,
      notification_id: subscriberId,
    });
  } catch (err) {
    if (err.code && err.code === "ER_DUP_ENTRY") {
      return res.status(409).send({
        message: "Admin with this email already exists.",
      });
    }
    console.error("Error creating admin:", err.message);
    res.status(500).send({
      message: err.message || "Some error occurred when creating new admin",
    });
  }
};

exports.findAll = async (req, res) => {
  try {
    const query = `
      SELECT id, name, email, role, createdAt
      FROM admins 
      WHERE is_deleted IS NULL OR is_deleted = false
    `;
    const data = await queryAsync(query);

    res.status(200).send(data);
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some errors occurred while retrieving admins.",
    });
  }
};

exports.findAllCompanies = async (req, res) => {
  try {
    const query = `
      SELECT id, company_name as name, email, address, contact as phone, status, createdAt
      FROM companies 
      WHERE is_Active IS NULL OR is_Active = true
    `;

    // Execute the query and retrieve data
    const data = await queryAsync(query);

    // Check if data is empty
    if (data.length === 0) {
      return res.status(404).json({ message: "No active companies found." });
    }
    // Respond with the processed data
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching companies:", error); // Log the error for debugging
    res
      .status(500)
      .json({ message: "An error occurred while fetching the companies." });
  }
};

exports.findCompanyById = async (req, res) => {
  const id = req.params.id;

  try {
    const query = `
      SELECT id, company_name as name, email, status, createdAt
      FROM companies 
      WHERE id = ? AND (is_Active IS NULL OR is_Active = true)
    `;

    // Execute the query and retrieve data
    const data = await queryAsync(query, [id]);

    // Check if the company is found
    if (data.length > 0) {
      res.status(200).json(data[0]);
    } else {
      res.status(404).json({ message: `Cannot find company with id=${id}.` });
    }
  } catch (error) {
    console.error("Error retrieving company with id=" + id, error); // Log the error for debugging
    res
      .status(500)
      .json({ message: "An error occurred while retrieving the company." });
  }
};

exports.changeCompanyStatus = async (req, res) => {
  const id = req.params.id;
  const newStatus = req.query.status;

  console.log("Change company status:", id, newStatus);

  try {
    const updatedAt = new Date(); // Set the update date
    const query = `
      UPDATE companies 
      SET status = ?, updatedAt = ? 
      WHERE id = ? AND (is_Active IS NULL OR is_Active = true)
    `;

    const result = await queryAsync(query, [newStatus, updatedAt, id]);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: `Cannot find company with id=${id}.` });
    }

    const selectQuery = `
      SELECT id, name, email, status, createdAt 
      FROM companies 
      WHERE id = ? AND (is_Active IS NULL OR is_Active = true)
    `;
    const updatedCompany = await queryAsync(selectQuery, [id]);

    res.status(200).json(updatedCompany[0]);
  } catch (err) {
    console.error("Error updating company status:", err);
    res.status(500).json({ message: "Error updating company with id=" + id });
  }
};

exports.deleteCompany = async (req, res) => {
  const id = req.params.id;

  if (!id) {
    return res.status(400).json({ message: "Company ID is required." });
  }

  try {
    const updatedAt = new Date(); // Set the update date
    const query = `
      UPDATE companies 
      SET is_Active = false, updatedAt = ? 
      WHERE id = ? AND (is_Active IS NULL OR is_Active = true)
    `;
    const result = await queryAsync(query, [updatedAt, id]);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Company not found or already inactive." });
    }

    res
      .status(200)
      .json({ message: "Company marked as inactive successfully." });
  } catch (error) {
    console.error("Error marking company as inactive:", error);
    res.status(500).json({ message: "Error updating company with id=" + id });
  }
};

//Operators

exports.findAllOperators = async (req, res) => {
  try {
    const query = `
      SELECT id, name, email, status, address, contact as phone, createdAt 
      FROM operators 
      WHERE is_Active IS NULL OR is_Active = true
    `;
    const data = await queryAsync(query);

    // Check if data is empty
    if (data.length === 0) {
      return res.status(404).json({ message: "No active operators found." });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error("Error fetching operators:", err); // Log the error for debugging
    res.status(500).json({
      message: "An error occurred while retrieving active operators.",
    });
  }
};

exports.findOperatorById = async (req, res) => {
  const id = req.params.id;

  try {
    const query = `
      SELECT id, name, email, status, createdAt 
      FROM operators 
      WHERE id = ? AND (is_Active IS NULL OR is_Active = true)
    `;
    const result = await queryAsync(query, [id]);

    if (result.length > 0) {
      res.status(200).json(result[0]);
    } else {
      res.status(404).json({
        message: `Cannot find operator with id=${id}.`,
      });
    }
  } catch (err) {
    console.error("Error retrieving operator with id=" + id, err); // Log the error for debugging
    res.status(500).json({
      message: "An error occurred while retrieving the operator.",
    });
  }
};

exports.deleteOperator = async (req, res) => {
  const id = req.params.id;

  if (!id) {
    return res.status(400).json({
      message: "Operator ID is required.",
    });
  }

  try {
    const updatedAt = new Date(); // Set the update date
    const query = `
      UPDATE operators 
      SET is_Active = false, updatedAt = ? 
      WHERE id = ? AND (is_Active IS NULL OR is_Active = true)
    `;
    const result = await queryAsync(query, [updatedAt, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Operator not found or already inactive.",
      });
    }

    res.status(200).json({
      message: "Operator marked as inactive successfully.",
    });
  } catch (error) {
    console.error("Error marking operator as inactive:", error); // Log the error for debugging
    res.status(500).json({
      message: "An error occurred while updating the operator with id=" + id,
    });
  }
};

exports.changeOperatorStatus = async (req, res) => {
  const id = req.params.id;
  const newStatus = req.query.status;

  try {
    const query = `
      SELECT id, name, email, status, createdAt 
      FROM operators 
      WHERE id = ? AND (is_Active IS NULL OR is_Active = true)
    `;
    const result = await queryAsync(query, [id]);

    if (result.length === 0) {
      return res.status(404).json({
        message: `Cannot find operator with id=${id}.`,
      });
    }

    const updatedAt = new Date(); // Set the update date
    const updateQuery = `
      UPDATE operators 
      SET status = ?, updatedAt = ? 
      WHERE id = ? AND (is_Active IS NULL OR is_Active = true)
    `;
    await queryAsync(updateQuery, [newStatus, updatedAt, id]);

    const updatedOperator = await queryAsync(query, [id]);

    res.status(200).json(updatedOperator[0]);
  } catch (err) {
    console.error("Error updating operator status:", err); // Log the error for debugging
    res.status(500).json({
      message: "An error occurred while updating the operator with id=" + id,
    });
  }
};

exports.getDriverCompanies = async (req, res) => {
  try {
    const query = `
      SELECT id, name, total_drivers, inactive_drivers, rating, profileUrl
      FROM companies 
      WHERE total_drivers > 0
    `;

    // Execute the query and retrieve data
    const data = await queryAsync(query);

    // Check if data is empty
    if (data.length === 0) {
      return res
        .status(404)
        .json({ message: "No companies with drivers found." });
    }

    // Respond with the retrieved data directly
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching companies:", error); // Log the error for debugging
    res.status(500).json({
      message: "An error occurred while fetching the companies with drivers.",
    });
  }
};

exports.getDriversByCompanyID = async (req, res) => {
  const companyId = req.params.id; // Extract company ID from request parameters

  try {
    // SQL query to get selected fields from drivers by company ID
    const query = `
      SELECT id, company_id, name, email, age, rating, locations, date_joined
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
    // SQL query to get the driver's details by ID
    const query = `
      SELECT id, name, email, age, experienceYears, rating, date_joined, locations 
      FROM drivers 
      WHERE id = ?
    `;

    // Execute the query asynchronously
    const data = await queryAsync(query, [id]);

    // Check if the driver exists
    if (data.length === 0) {
      return res.status(404).json({ message: "Driver not found." });
    }

    // Send the selected fields directly
    const driver = data[0];
    if (driver.locations) {
      driver.locations = JSON.parse(driver.locations);
      // console.log(driver.locations);
    }
    res.status(200).json([...data]);
  } catch (error) {
    console.error("Error fetching driver by ID:", error); // Log the error for debugging
    res
      .status(500)
      .json({ message: "An error occurred while fetching the driver." });
  }
};

//Users
exports.getUserStats = async (req, res) => {
  try {
    // Query to get the total number of companies
    const companiesCountQuery = `
      SELECT COUNT(*) AS companies_count
      FROM companies;
    `;

    // Query to get the total number of operators
    const operatorsCountQuery = `
      SELECT COUNT(*) AS operators_count
      FROM operators;
    `;

    // Execute the queries
    const [companiesCountResult, operatorsCountResult] = await Promise.all([
      queryAsync(companiesCountQuery),
      queryAsync(operatorsCountQuery),
    ]);

    // Extract counts from the results
    const companiesCount = companiesCountResult[0].companies_count || 0;
    const operatorsCount = operatorsCountResult[0].operators_count || 0;

    // Format the response
    const response = {
      totalUsers: companiesCount + operatorsCount,
      companies: companiesCount,
      operators: operatorsCount,
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("Error fetching admin statistics: " + err.stack);
    res.status(500).send("Error fetching admin statistics");
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

exports.getDriveById = async (req, res) => {
  const id = req.params.id;
  console.log("Drive_id", id);

  try {
    // SQL query to get selected fields for the drive
    const query = `
      SELECT drive_id, driver_id, company_id, operator_id, start, end,  payment, price
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
    res.status(200).json(data[0]);
  } catch (error) {
    console.error("Error fetching drive by ID:", error); // Log the error for debugging
    res
      .status(500)
      .json({ message: "An error occurred while fetching the drive." });
  }
};

// Get Recent Drives
exports.getRecentDrives = async (req, res) => {
  const query = `
    SELECT 
      drive_id, start, end, status, price
    FROM 
      drives
    ORDER BY 
      drives.start DESC
    LIMIT 5;`;

  try {
    // Execute the query to get recent drives
    const recentDrives = await queryAsync(query);

    // Calculate total number of drives and total amount
    const totalNumber = recentDrives.length;
    const totalAmount = recentDrives.reduce(
      (sum, drive) => sum + drive.price,
      0
    );

    // Format the response
    const response = {
      recentDrives,
      totalNumber,
      totalAmount,
    };

    res.status(200).json(response);
  } catch (err) {
    console.error("Error executing query: " + err.stack);
    res.status(500).send("Error fetching recent drives");
  }
};

// Get Drive Statistics and Recent Drives
exports.getDriveStats = async (req, res) => {
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
        drives`;

    // Query to get recent drives' total price and count
    const recentDrivesQuery = `
      SELECT 
        COUNT(*) AS recent_drives_count,
        SUM(price) AS total_recent_drives_price
      FROM 
        drives
      ORDER BY 
        start DESC
      LIMIT 5;`;

    // Execute the queries
    const [totalAndStatusResult, recentDrivesResult] = await Promise.all([
      queryAsync(totalAndStatusQuery),
      queryAsync(recentDrivesQuery),
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
    res.status(500).send("Error fetching drive statistics and recent drives");
  }
};

exports.changePaymentStatusDrive = async (req, res) => {
  const { id } = req.params;
  const { payment } = req.body;

  // Validate input
  if (payment !== 0 && payment !== 1) {
    return res.status(400).json({ error: "Invalid payment status" });
  }

  try {
    // SQL query to update payment status
    const query = "UPDATE drives SET payment = ? WHERE drive_id = ?";
    const values = [payment, id];

    // Execute the query asynchronously
    const result = await queryAsync(query, values);

    // Check if any rows were affected (i.e., the drive was updated)
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Drive not found" });
    }

    res.status(200).json({ message: "Payment status updated successfully" });
  } catch (error) {
    console.error("Error executing query:", error); // Log the error for debugging
    res.status(500).json({ error: "Server error" });
  }
};

exports.getDrives = async (req, res) => {
  try {
    // SQL query to select all relevant fields from the drives table
    const query = `
      SELECT 
        drives.drive_id, 
        drives.driver_id, 
        companies.name AS company_name, 
        operators.name AS operator_name, 
        drives.operator_id, 
        drives.company_id, 
        drives.start, 
        drives.end,  
        drives.status, 
        drives.price, 
        drives.payment
      FROM drives
      JOIN companies ON drives.company_id = companies.id
      JOIN operators ON drives.operator_id = operators.id;
    `;
    // Execute the query asynchronously
    const data = await queryAsync(query);

    // Respond with the retrieved data
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching drives:", error); // Log the error for debugging
    res
      .status(500)
      .json({ message: "An error occurred while fetching the drives." });
  }
};

exports.getStatusDrives = async (req, res) => {
  const status = req.params.status;
  console.log("admin");
  console.log(status);

  if (!status) {
    return res.status(400).json({
      message: "Status must be provided in the request parameters.",
    });
  }

  try {
    // SQL query to select all relevant fields from the drives table where the status matches
    const query = `
      SELECT drive_id, driver_id, operator_id, company_id, start, end, status, price, payment
      FROM drives
      WHERE status = ?
    `;

    // Execute the query asynchronously with the status as a parameter
    const data = await queryAsync(query, [status]);

    // Respond with the retrieved data
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching drives:", error); // Log the error for debugging
    res
      .status(500)
      .json({ message: "An error occurred while fetching the drives." });
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

//Invoices

// Get All Invoices
exports.getAllInvoices = async (req, res) => {
  const query = `
    SELECT 
      invoices.id AS invoice_id,
      invoices.created_at,
      invoices.due_date,
      invoices.status AS invoice_status,
      invoices.amount,
      invoices.additional_cost,
      invoices.late_fine,
      invoices.tax,
      invoices.platform_charge,
      invoices.discount,
      companies.name AS company_name,
      companies.email AS company_email
    FROM invoices
    INNER JOIN drives ON invoices.drive_id = drives.drive_id
    INNER JOIN companies ON drives.company_id = companies.id
  `;

  try {
    const result = await queryAsync(query);
    res.status(200).json(result); // Directly return the query result without additional processing
  } catch (err) {
    console.error("Error executing query: " + err.stack);
    res.status(500).send("Error fetching invoices");
  }
};

exports.getMonthlyInvoiceStats = async (req, res) => {
  try {
    // SQL query to get the count and total amount of invoices grouped by weeks of the ongoing month using 'created_at'
    const weeklyInvoicesQuery = `
      SELECT 
        WEEK(created_at, 1) - WEEK(DATE_SUB(created_at, INTERVAL DAY(created_at)-1 DAY), 1) + 1 AS week_number,
        COUNT(*) AS invoice_count,
        SUM(amount) AS total_amount
      FROM 
        invoices
      WHERE 
        MONTH(created_at) = MONTH(CURDATE()) 
        AND YEAR(created_at) = YEAR(CURDATE())
      GROUP BY 
        week_number
      ORDER BY 
        week_number;
    `;

    // Execute the SQL query asynchronously using queryAsync
    const weeklyInvoicesResult = await queryAsync(weeklyInvoicesQuery);

    // Initialize an object for weekly stats with 0 for each week
    const weeklyStats = {
      week1: { count: 0, amount: 0 },
      week2: { count: 0, amount: 0 },
      week3: { count: 0, amount: 0 },
      week4: { count: 0, amount: 0 },
    };

    // Check if weeklyInvoicesResult is an array
    if (Array.isArray(weeklyInvoicesResult)) {
      // Populate the weeklyStats object with actual data
      weeklyInvoicesResult.forEach((row) => {
        switch (row.week_number) {
          case 1:
            weeklyStats.week1 = {
              count: row.invoice_count,
              amount: row.total_amount,
            };
            break;
          case 2:
            weeklyStats.week2 = {
              count: row.invoice_count,
              amount: row.total_amount,
            };
            break;
          case 3:
            weeklyStats.week3 = {
              count: row.invoice_count,
              amount: row.total_amount,
            };
            break;
          case 4:
            weeklyStats.week4 = {
              count: row.invoice_count,
              amount: row.total_amount,
            };
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
    console.error("Error fetching invoice stats by week:", error);
    res.status(500).json({ error: "Failed to fetch invoice stats" });
  }
};



exports.getInvoiceCredential = async (req, res) => {
  try {
    const query = `select * from invoice_credentials`;
    const result = await queryAsync(query);
    if (result.length > 0) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "No invoice credentials found." });
    }
  } catch (error) {
    console.error("Error fetching invoice stats by week:", error);
    res.status(500).json({ error: "Failed to fetch invoice stats" });
  }
}

// Get Invoice Stats
exports.getInvoiceStats = async (req, res) => {
  try {
    // Define queries
    // const totalInvoicesQuery = `SELECT COUNT(*) AS total_invoices, SUM(amount) AS total_amount, SUM(additional_cost) as total_additional, SUM(late_fine) as total_late_fine, SUM(tax) as total_tax, SUM(discount) as total_discount FROM invoices`;
    // const totalPaidQuery = `SELECT COUNT(*) AS total_paid, SUM(amount) AS total_paid_amount, SUM(additional_cost) as total_paid_additional, SUM(late_fine) as total_paid_late_fine, SUM(tax) as total_paid_tax, SUM(discount) as total_paid_discount FROM invoices WHERE status = 'paid'`;
    // const totalOverdueQuery = `SELECT COUNT(*) AS total_overdue, SUM(amount) AS total_overdue_amount FROM invoices WHERE status = 'overdue'`;
    // const totalPendingQuery = `SELECT COUNT(*) AS total_pending, SUM(amount) AS total_pending_amount FROM invoices WHERE status = 'pending'`;

    const allQuery = `SELECT 
            COUNT(*) AS total_invoices,
            SUM(amount) AS total_amount,
            SUM(additional_cost) AS total_additional,
            SUM(late_fine) AS total_late_fine,
            SUM((amount * tax) / 100) AS total_tax_amount,
            SUM((amount * discount) / 100) AS total_discount_amount,
            SUM((amount * platform_charge) / 100) AS total_platform_charge_amount,

            COUNT(CASE WHEN status = 'paid' THEN 1 END) AS total_paid,
            SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS total_paid_amount,
            SUM(CASE WHEN status = 'paid' THEN additional_cost ELSE 0 END) AS total_paid_additional,
            SUM(CASE WHEN status = 'paid' THEN late_fine ELSE 0 END) AS total_paid_late_fine,
            SUM(CASE WHEN status = 'paid' THEN (amount * tax) / 100 ELSE 0 END) AS total_paid_tax_amount,
            SUM(CASE WHEN status = 'paid' THEN (amount * discount) / 100 ELSE 0 END) AS total_paid_discount_amount,
            SUM(CASE WHEN status = 'paid' THEN (amount * platform_charge) / 100 ELSE 0 END) AS total_paid_platform_charge_amount,

            COUNT(CASE WHEN status = 'overdue' THEN 1 END) AS total_overdue,
            SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END) AS total_overdue_amount,
            SUM(CASE WHEN status = 'overdue' THEN additional_cost ELSE 0 END) AS total_overdue_additional,
            SUM(CASE WHEN status = 'overdue' THEN late_fine ELSE 0 END) AS total_overdue_late_fine,
            SUM(CASE WHEN status = 'overdue' THEN (amount * tax) / 100 ELSE 0 END) AS total_overdue_tax_amount,
            SUM(CASE WHEN status = 'overdue' THEN (amount * discount) / 100 ELSE 0 END) AS total_overdue_discount_amount,
            SUM(CASE WHEN status = 'overdue' THEN (amount * platform_charge) / 100 ELSE 0 END) AS total_overdue_platform_charge_amount,

            COUNT(CASE WHEN status = 'pending' THEN 1 END) AS total_pending,
            SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS total_pending_amount,
            SUM(CASE WHEN status = 'pending' THEN additional_cost ELSE 0 END) AS total_pending_additional,
            SUM(CASE WHEN status = 'pending' THEN late_fine ELSE 0 END) AS total_pending_late_fine,
            SUM(CASE WHEN status = 'pending' THEN (amount * tax) / 100 ELSE 0 END) AS total_pending_tax_amount,
            SUM(CASE WHEN status = 'pending' THEN (amount * discount) / 100 ELSE 0 END) AS total_pending_discount_amount,
            SUM(CASE WHEN status = 'pending' THEN (amount * platform_charge) / 100 ELSE 0 END) AS total_pending_platform_charge_amount

        FROM invoices
`;


    const queryResult = await queryAsync(allQuery);
    console.log(queryResult);
    // Structure the response
    const response = {
      total: {
        count: queryResult[0].total_invoices,
        amount: calculateTotal(
          queryResult[0].total_amount,
          queryResult[0].total_additional,
          queryResult[0].total_late_fine,
          queryResult[0].total_tax_amount,
          queryResult[0].total_discount_amount,
          queryResult[0].total_platform_charge_amount
        ),
      },
      paid: {
        count: queryResult[0].total_paid,
        amount: calculateTotal(
          queryResult[0].total_paid_amount,
          queryResult[0].total_paid_additional,
          queryResult[0].total_paid_late_fine,
          queryResult[0].total_paid_tax_amount,
          queryResult[0].total_paid_discount_amount,
          queryResult[0].total_paid_platform_charge_amount
        ),
      },
      overdue: {
        count: queryResult[0].total_overdue,
        amount: calculateTotal(
          queryResult[0].total_overdue_amount,
          queryResult[0].total_overdue_additional,
          queryResult[0].total_overdue_late_fine,
          queryResult[0].total_overdue_tax_amount,
          queryResult[0].total_overdue_discount_amount,
          queryResult[0].total_overdue_platform_charge_amount
        ),
      },
      pending: {
        count: queryResult[0].total_pending,
        amount: calculateTotal(
          queryResult[0].total_pending_amount,
          queryResult[0].total_pending_additional,
          queryResult[0].total_pending_late_fine,
          queryResult[0].total_pending_tax_amount,
          queryResult[0].total_pending_discount_amount,
          queryResult[0].total_pending_platform_charge_amount
        ),
      },
    };

    // ✅ Reusable function for amount calculation
    function calculateTotal(amount, additional, lateFine, tax, discount , platform_charge) {
      const subtotal = amount - discount + additional + lateFine;
      return (subtotal + tax + platform_charge).toFixed(2);
    }

    // Send the response
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching invoice stats" });
  }
};

// Get Recent Invoices
exports.getRecentInvoices = async (req, res) => {
  const query = `
    SELECT 
      invoices.id AS invoice_id,
      invoices.amount, 
      operators.name AS operator_name, 
      operators.profileUrl AS profileUrl,
    CASE
        WHEN TIMESTAMPDIFF(SECOND, invoices.created_at, NOW()) < 60 THEN CONCAT(TIMESTAMPDIFF(SECOND, invoices.created_at, NOW()), ' seconds ago')
        WHEN TIMESTAMPDIFF(MINUTE, invoices.created_at, NOW()) < 60 THEN CONCAT(TIMESTAMPDIFF(MINUTE, invoices.created_at, NOW()), ' minutes ago')
        WHEN TIMESTAMPDIFF(HOUR, invoices.created_at, NOW()) < 24 THEN CONCAT(TIMESTAMPDIFF(HOUR, invoices.created_at, NOW()), ' hours ago')
        WHEN TIMESTAMPDIFF(DAY, invoices.created_at, NOW()) < 30 THEN CONCAT(TIMESTAMPDIFF(DAY, invoices.created_at, NOW()), ' days ago')
        WHEN TIMESTAMPDIFF(MONTH, invoices.created_at, NOW()) < 12 THEN CONCAT(TIMESTAMPDIFF(MONTH, invoices.created_at, NOW()), ' months ago')
        ELSE CONCAT(TIMESTAMPDIFF(YEAR, invoices.created_at, NOW()), ' years ago')
    END AS time_ago
    FROM 
      invoices
    JOIN 
      operators ON invoices.operator_id = operators.id
    ORDER BY 
      invoices.created_at DESC
    LIMIT 5;`;

  try {
    const result = await queryAsync(query);
    res.status(200).json(result);
  } catch (err) {
    console.error("Error executing query: " + err.stack);
    res.status(500).send("Error fetching recent invoices");
  }
};

// Get Invoice By ID
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

// Delete Invoice
exports.deleteInvoice = async (req, res) => {
  const id = req.params.id;

  try {
    const result = await queryAsync(`DELETE FROM invoices WHERE id = ?`, [id]);
    if (result.affectedRows === 0) {
      res.status(404).send("Invoice not found");
      return;
    }
    res.status(200).json({ message: "Invoice deleted successfully" });
  } catch (err) {
    console.error("Error executing query: " + err.stack);
    res.status(500).send("Error deleting invoice");
  }
};

// Add Invoice
exports.addInvoice = async (req, res) => {
  const { created_at, updated_at, drive_id, company_id, operator_id, amount } =
    req.body;

  // Validate if necessary fields are provided in the request body
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

  // SQL query to insert the new invoice
  const insertQuery = `
    INSERT INTO invoices 
    (created_at, updated_at, drive_id, company_id, operator_id, amount) 
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const values = [
    created_at,
    updated_at,
    drive_id,
    company_id,
    operator_id,
    amount,
  ];

  try {
    const results = await queryAsync(insertQuery, values);
    // Send a success response with the newly created invoice ID (if needed)

    //Notify the admin

    //Notify the Operator about the invoice addition
    const body = `You have a new Invoice for drive ${drive_id}`;
    const OperatorSubscriberId = await getOperatorNotificationId(operator_id);
    const operator_email = await getOperatorEmail(operator_id);

    notify(OperatorSubscriberId, `/operator/payments/view-payment/${id}`, body);

    sendNotificationEmail(
      operator_email,
      "Invoice Recieved",
      body + ". Click View button below to learn more",
      `${process.env.REACT_APP_URL}/operator/payments/view-payment/${id}`,
      subscriberId
    );

    //Notify the Company about the invoice addition
    const CompanySubscriberId = await getCompanyNotificationId(company_id);
    const company_email = await getCompanyEmail(company_id);

    notify(CompanySubscriberId, `/company/payments/view-payment/${id}`, body);
    sendNotificationEmail(
      company_email,
      "Invoice sent to operator",
      "Payment Invoice is sent to opertator for the drive" +
        ". Click View button below to learn more",
      `${process.env.REACT_APP_URL}/company/payments/view-payment/${id}`,
      CompanySubscriberId
    );

    return res.status(200).json({
      message: "Invoice added successfully",
      invoiceId: results.insertId, // Assuming you want to return the ID of the created invoice
    });
  } catch (err) {
    console.error("Error executing query: " + err.stack);
    return res.status(500).json({ message: "Error adding invoice" });
  }
};

exports.insertInvoice = async (req, res)=> {
  try {

    const {discount, platform_charge, date, due_date, tax, status, cashierInfo, customerInfo, invoice_detail, notes, terms, driveId, additional_cost} = req.body;

    if (!date || !due_date || !status || !invoice_detail || !customerInfo || !cashierInfo || !platform_charge || !driveId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const input = date;
    const [month, day, year] = input.split('/');
    const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    const due_date_input = due_date;
    const [due_month, due_day, due_year] = due_date_input.split('/');
    const formattedDueDate = `${due_year}-${due_month.padStart(2, '0')}-${due_day.padStart(2, '0')}`;

    const query =  `INSERT INTO invoices (created_at, updated_at, due_date, label, status, drive_id, company_id, operator_id, notes, terms, amount, tax, platform_charge, discount, additional_cost) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    const values = [
      formattedDate,
      formattedDate, 
      formattedDueDate, 
      invoice_detail[0].name,
      status,
      driveId, 
      cashierInfo.id, 
      customerInfo.id,
      notes,
      terms,
      invoice_detail[0].price,
      tax || 19,
      platform_charge || 0,
      discount || 0,
      additional_cost || 0
    ]
    

    const result = await queryAsync(query, values);

    if (result) {

      const body = `You have a new Invoice for drive ${driveId}`;
      const OperatorSubscriberId = await getOperatorNotificationId(customerInfo.id);

      notify(OperatorSubscriberId, `/operator/invoices/detail-invoice/${result.insertId}`, body);

      // const invoicePdf = await generateInvoicePDF(values, result.insertId, cashierInfo, customerInfo)
      // console.log("Generated Invoice PDF:", invoicePdf);
      
      const emailData = {
        invoiceId: result.insertId,
        url: `${process.env.REACT_APP_URL}/operator/invoices/detail-invoice/${result.insertId}`,
        total:
          invoice_detail[0].price +
          (invoice_detail[0].price * tax) / 100 +
          additional_cost +
          (invoice_detail[0].price * platform_charge) / 100 -
          (invoice_detail[0].price * discount) / 100,
        dueDate: formattedDueDate,
      };

      await sendInvoiceEmail(customerInfo.email, emailData, customerInfo.name);

      const isSendedQuery = `UPDATE invoices SET is_delivered = 1 WHERE id = ?`

      await queryAsync(isSendedQuery, [result.insertId]);

      return res.status(200).json({
        message: "Invoice inserted successfully",
        invoiceId: result.insertId,
      });
    }

    console.log("Insert Invoice Request Body:", req.body);

  } catch (error) {
    console.error("Error executing query: " + error.stack);
    res.status(500).json({ error: "Error updating invoice and drive" });
  }
}

exports.sendInvoice = async (req, res) => {
  try {
    const data = req.body.invoice;
    const formattedDate = `${data.due_date}`.split('T')[0];
    const formatCreated = `${data.created_at}`.split('T')[0];
    console.log(formattedDate, formatCreated, data);
    
    const values = [
      formatCreated,
      formatCreated, 
      formattedDate, 
      data.label,
      data.status,
      data.drive_id,
      data.company_id, 
      data.operator_id,
      data.notes,
      data.terms,
      data.amount,
      data.tax || 19,
      data.platform_charge || 0,
      data.discount || 0,
      data.additional_cost || 0
    ]
    
    const cashierInfo = {
      name: data.company_name,
      email: data.company_email
    }

    const customerInfo = {
      name: data.operator_name,
      email: data.operator_email
    }

    const body = `You have a new Invoice for drive ${data.drive_id}`;
    const OperatorSubscriberId = await getOperatorNotificationId(data.operator_id);

    notify(OperatorSubscriberId, `/operator/invoices/detail-invoice/${data.id}`, body);

    const invoicePdf = await generateInvoicePDF(values, data.id, cashierInfo, customerInfo);

    const emailData = {
      invoiceId: data.id,
      pdfPath: invoicePdf,
      total:
        data.amount +
        (data.amount * (data.tax || 0)) / 100 +
        (data.additional_cost || 0) +
        (data.amount * (data.platform_charge || 0)) / 100 -
        (data.amount * (data.discount || 0)) / 100,
      dueDate: formattedDate,
    };

    await sendInvoiceEmail(customerInfo.email, emailData, customerInfo.name);
    const isSendedQuery = `UPDATE invoices SET is_delivered = 1 WHERE id = ?`;

    await queryAsync(isSendedQuery, [data.id]);

    return res.status(200).json({
        message: "Invoice send successfully",
        invoiceId: data.id,
    });
  } catch (error) {
      console.error("Error executing query: " + error.stack);
      return res.status(500).json({ message: "Error adding invoice" });
  }
}

// Update Invoice and Drive Payment
exports.updateInvoiceAndDrivePayment = async (req, res) => {
  const id = req.params.id;
  const {
    status,
    due_date,
    amount,
    tax,
    additional_cost,
    extra_cost_reason,
    drive_id,
    platform_charge,
    operator_payment_date,
    discount,
  } = req.body;

  // Check if essential fields are present
  if (!status || !due_date || amount === undefined || !drive_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Generate current timestamp for updated_at
  const currentTimestamp = new Date().toISOString();

  // Determine the payment field value based on invoice status
  const paymentField = status === "paid" ? 1 : 0;

  // Build the invoice update query dynamically
  let updateInvoiceQuery = `UPDATE invoices SET updated_at = ?`;
  const invoiceValues = [currentTimestamp];

  if (status) {
    updateInvoiceQuery += `, status = ?`;
    invoiceValues.push(status);
  }
  if (due_date) {
    updateInvoiceQuery += `, due_date = ?`;
    invoiceValues.push(due_date);
  }
  if (amount !== undefined) {
    updateInvoiceQuery += `, amount = ?`;
    invoiceValues.push(amount);
  }
  if (tax !== undefined) {
    updateInvoiceQuery += `, tax = ?`;
    invoiceValues.push(tax);
  }

  if (platform_charge !== undefined) {
    updateInvoiceQuery += `, platform_charge = ?`;
    invoiceValues.push(platform_charge);
  }

  if (discount !== undefined) {
    updateInvoiceQuery += `, discount = ?`;
    invoiceValues.push(discount);
  }

  if (additional_cost !== undefined) {
    updateInvoiceQuery += `, additional_cost = ?`;
    invoiceValues.push(additional_cost);
  }
  if (extra_cost_reason) {
    updateInvoiceQuery += `, extra_cost_reason = ?`;
    invoiceValues.push(extra_cost_reason);
  }
  if (operator_payment_date) {
    updateInvoiceQuery += `, operator_payment_date = ?`;
    invoiceValues.push(operator_payment_date);
  }

  updateInvoiceQuery += ` WHERE id = ?`;

  invoiceValues.push(id);

  console.log(updateInvoiceQuery , invoiceValues);
  
  // Build the drive update query dynamically
  let updateDriveQuery = `UPDATE drives SET payment = ? WHERE drive_id = ?`;
  const driveValues = [paymentField, drive_id];

  try {
    // Perform both updates in parallel
    await Promise.all([
      queryAsync(updateInvoiceQuery, invoiceValues),
      queryAsync(updateDriveQuery, driveValues),
    ]);

    res.status(200).json({ message: "Invoice and drive updated successfully" });
  } catch (err) {
    console.error("Error executing query: " + err.stack);
    res.status(500).json({ error: "Error updating invoice and drive" });
  }
};

// Filters

exports.getAllFilters = async (req, res) => {
  try {
    const results = await queryAsync("SELECT * FROM Filters");
    res.status(200).json(results);
  } catch (err) {
    console.error("Error executing query:", err.stack);
    res.status(500).send("Error fetching filters");
  }
};

exports.getFilterById = async (req, res) => {
  const id = req.params.id;
  console.log("Filter ID:", id);

  try {
    const results = await queryAsync("SELECT * FROM Filters WHERE id = ?", [
      id,
    ]);

    if (results.length === 0) {
      return res.status(404).send("Filter not found");
    }

    res.json(results[0]);
  } catch (err) {
    console.error("Error executing query:", err.stack);
    res.status(500).send("Error fetching filter");
  }
};

exports.addFilter = async (req, res) => {
  const { name, label, type, options } = req.body;

  if (!name || !label || !type) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const isValidColumnName = /^[a-zA-Z_][a-zA-Z0-9_ ]*$/.test(name);
  if (!isValidColumnName) {
    return res.status(400).json({ error: "Invalid column name" });
  }

  const escapedName = `\`${name}\``;

  try {
    await queryAsync("START TRANSACTION");

    const insertQuery =
      "INSERT INTO Filters (name, label, type, options) VALUES (?, ?, ?, ?)";
    const insertValues = [name, label, type, options];

    const insertResults = await queryAsync(insertQuery, insertValues);

    const alterCompaniesQuery = `ALTER TABLE companies ADD COLUMN ${escapedName} ${
      type === "NumberField"
        ? "BIGINT"
        : type === "DateTimePicker"
        ? "DATETIME"
        : "TEXT"
    } DEFAULT NULL`;

    await queryAsync(alterCompaniesQuery);

    const alterDriveRequestsQuery = `ALTER TABLE driveRequests ADD COLUMN ${escapedName} ${
      type === "NumberField"
        ? "BIGINT"
        : type === "DateTimePicker"
        ? "DATETIME"
        : "TEXT"
    } DEFAULT NULL`;

    await queryAsync(alterDriveRequestsQuery);

    const alterDrivesQuery = `ALTER TABLE drives ADD COLUMN ${escapedName} ${
      type === "NumberField"
        ? "BIGINT"
        : type === "DateTimePicker"
        ? "DATETIME"
        : "TEXT"
    } DEFAULT NULL`;

    await queryAsync(alterDrivesQuery);

    await queryAsync("COMMIT");

    res.json({
      message: "Filter added successfully",
      id: insertResults.insertId,
    });
  } catch (err) {
    console.error("Error during transaction:", err.stack);
    await queryAsync("ROLLBACK");
    res.status(500).json({ error: "Error adding filter" });
  }
};

exports.updateFilter = async (req, res) => {
  const { id } = req.params;
  const { name, label, type, options } = req.body;

  if (!name || !label || !type) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const optionsValue = options || null;

  try {
    await queryAsync("START TRANSACTION");

    const fetchFilterQuery = "SELECT * FROM Filters WHERE id = ?";
    const results = await queryAsync(fetchFilterQuery, [id]);

    const currentFilter = results[0];
    if (!currentFilter) {
      await queryAsync("ROLLBACK");
      return res.status(404).json({ error: "Filter not found" });
    }

    const currentName = currentFilter.name;
    const currentType = currentFilter.type;

    const updatedType =
      type === "NumberField"
        ? "BIGINT"
        : type === "DateTimePicker"
        ? "DATETIME"
        : "TEXT";

    const updateFilterQuery = `
      UPDATE Filters SET name = ?, label = ?, type = ?, options = ? WHERE id = ?`;
    await queryAsync(updateFilterQuery, [name, label, type, optionsValue, id]);

    if (name !== currentName || updatedType !== currentType) {
      const alterCompaniesQuery = `
        ALTER TABLE companies CHANGE COLUMN \`${currentName}\` \`${name}\` ${updatedType}`;
      await queryAsync(alterCompaniesQuery);

      const alterDriveRequestsQuery = `
        ALTER TABLE driveRequests CHANGE COLUMN \`${currentName}\` \`${name}\` ${updatedType}`;
      await queryAsync(alterDriveRequestsQuery);

      const alterDrivesQuery = `
        ALTER TABLE drives CHANGE COLUMN \`${currentName}\` \`${name}\` ${updatedType}`;
      await queryAsync(alterDrivesQuery);
    }

    await queryAsync("COMMIT");

    res.json({
      message: "Filter and related tables updated successfully",
    });
  } catch (err) {
    await queryAsync("ROLLBACK");
    console.error("Error updating filter and related tables:", err.stack);
    res.status(500).json({ error: "Error updating filter and related tables" });
  }
};

exports.deleteFilter = async (req, res) => {
  const { id } = req.params;

  try {
    await queryAsync("START TRANSACTION");

    const filterResults = await queryAsync(
      "SELECT name FROM Filters WHERE id = ?",
      [id]
    );

    if (filterResults.length === 0) {
      await queryAsync("ROLLBACK");
      return res.status(404).json({ error: "Filter not found" });
    }

    const filterName = filterResults[0].name;
    const escapedName = `\`${filterName}\``;

    const deleteResults = await queryAsync("DELETE FROM Filters WHERE id = ?", [
      id,
    ]);

    if (deleteResults.affectedRows === 0) {
      await queryAsync("ROLLBACK");
      return res.status(404).json({ error: "Filter not found" });
    }

    const alterCompaniesQuery = `ALTER TABLE companies DROP COLUMN ${escapedName}`;
    await queryAsync(alterCompaniesQuery);

    const alterDriveRequestsQuery = `ALTER TABLE driveRequests DROP COLUMN ${escapedName}`;
    await queryAsync(alterDriveRequestsQuery);

    const alterDrivesQuery = `ALTER TABLE drives DROP COLUMN ${escapedName}`;
    await queryAsync(alterDrivesQuery);

    await queryAsync("COMMIT");

    res.json({ message: "Filter deleted successfully" });
  } catch (err) {
    console.error("Error executing query:", err.stack);
    await queryAsync("ROLLBACK");
    res.status(500).json({ error: "Error deleting filter" });
  }
};

//Payment Credentials

// Get all credentials
exports.getAllCredentials = async (req, res) => {
  try {
    const results = await queryAsync("SELECT * FROM invoice_credentials");
    res.json(results);
  } catch (err) {
    console.error("Error executing query:", err.stack);
    res.status(500).send("Error fetching credentials");
  }
};

// Get a credential by ID
exports.getCredentialById = async (req, res) => {
  const id = req.params.id;
  console.log("Credential ID:", id);

  try {
    const results = await queryAsync(
      "SELECT * FROM invoice_credentials WHERE credential_id = ?",
      [id]
    );

    if (results.length === 0) {
      res.status(404).send("Credential not found");
      return;
    }

    res.json(results[0]);
  } catch (err) {
    console.error("Error executing query:", err.stack);
    res.status(500).send("Error fetching credential");
  }
};

// Add a new credential
exports.addCredential = async (req, res) => {
  const { name, type, label, value } = req.body;

  // Validate required fields
  if (!name || !type || !label || !value) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const query =
    "INSERT INTO invoice_credentials (name, type, label, value) VALUES (?, ?, ?, ?)";
  const values = [name, type, label, value];

  try {
    const results = await queryAsync(query, values);
    res.json({
      message: "Credential added successfully",
      id: results.insertId,
    });
  } catch (err) {
    console.error("Error executing query:", err.stack);
    res.status(500).send("Error adding credential");
  }
};

// Update an existing credential
exports.updateCredential = async (req, res) => {
  const { id } = req.params;
  const { name, type, label, value } = req.body;

  // Initialize query parts and values array
  let query = "UPDATE invoice_credentials SET ";
  const values = [];
  let fieldsToUpdate = [];

  // Dynamically build the query based on provided fields
  if (name) {
    fieldsToUpdate.push("name = ?");
    values.push(name);
  }
  if (type) {
    fieldsToUpdate.push("type = ?");
    values.push(type);
  }
  if (label) {
    fieldsToUpdate.push("label = ?");
    values.push(label);
  }
  if (value) {
    fieldsToUpdate.push("value = ?");
    values.push(value);
  }

  // If no fields to update, return an error
  if (fieldsToUpdate.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  // Add the WHERE clause
  query += fieldsToUpdate.join(", ") + " WHERE credential_id = ?";
  values.push(id);

  console.log(query, values);
  

  try {
    const results = await queryAsync(query, values);

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Credential not found" });
    }

    res.json({ message: "Credential updated successfully" });
  } catch (err) {
    console.error("Error executing query:", err.stack);
    res.status(500).json({ error: "Error updating credential" });
  }
};

// Delete a credential
exports.deleteCredential = async (req, res) => {
  const { id } = req.params;

  try {
    const results = await queryAsync(
      "DELETE FROM invoice_credentials WHERE credential_id = ?",
      [id]
    );

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Credential not found" });
    }

    res.json({ message: "Credential deleted successfully" });
  } catch (err) {
    console.error("Error executing query:", err.stack);
    res.status(500).json({ error: "Error deleting credential" });
  }
};

//FAQs

// Add a new FAQ
exports.addFaq = async (req, res) => {
  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const query = "INSERT INTO faq (question, answer) VALUES (?, ?)";
  const values = [question, answer];

  try {
    const results = await queryAsync(query, values);
    res.json({ message: "FAQ added successfully", faqId: results.insertId });
  } catch (err) {
    console.error("Error executing query:", err.stack);
    res.status(500).json({ error: "Error adding FAQ" });
  }
};

// Retrieve all FAQs
exports.getFaqs = async (req, res) => {
  try {
    const results = await queryAsync("SELECT * FROM faq");
    res.json(results);
  } catch (err) {
    console.error("Error executing query:", err.stack);
    res.status(500).json({ error: "Error fetching FAQs" });
  }
};

// Retrieve a single FAQ by ID
exports.getFaqById = async (req, res) => {
  const id = req.params.id;

  try {
    const results = await queryAsync("SELECT * FROM faq WHERE id = ?", [id]);

    if (results.length === 0) {
      return res.status(404).json({ error: "FAQ not found" });
    }

    res.json(results[0]);
  } catch (err) {
    console.error("Error executing query:", err.stack);
    res.status(500).json({ error: "Error fetching FAQ" });
  }
};

// Update an FAQ by ID
exports.updateFaq = async (req, res) => {
  const { id } = req.params;
  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const query = "UPDATE faq SET question = ?, answer = ? WHERE id = ?";
  const values = [question, answer, id];

  try {
    const results = await queryAsync(query, values);

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "FAQ not found" });
    }

    res.json({ message: "FAQ updated successfully" });
  } catch (err) {
    console.error("Error executing query:", err.stack);
    res.status(500).json({ error: "Error updating FAQ" });
  }
};

// Delete an FAQ by ID
exports.deleteFaq = async (req, res) => {
  const { id } = req.params;

  try {
    const results = await queryAsync("DELETE FROM faq WHERE id = ?", [id]);

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "FAQ not found" });
    }

    res.json({ message: "FAQ deleted successfully" });
  } catch (err) {
    console.error("Error executing query:", err.stack);
    res.status(500).json({ error: "Error deleting FAQ" });
  }
};

exports.loginUser = async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  try {
    const query = "SELECT * FROM admins WHERE email = ?";
    const data = await queryAsync(query, [email]);

    if (data.length > 0) {
      const admin = data[0];
      if (admin.is_deleted === 1) {
        res.status(400).send({ message: "User Not Found" });
        return;
      }
      const isMatch = await bcrypt.compare(password, admin.password);

      if (isMatch) {
        const token = jwt.sign(
          { email: admin.email, name: admin.name, role: "admin" },
          process.env.JWT_SECRET_KEY
        );

        res.status(200).send({
          id: admin.id,
          name: admin.name,
          role: "admin",
          token: token,
          chat_id: admin.chat_id,
          notification_id: admin.notification_id,
          profileUrl: admin.profileUrl,
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
      message: "Error retrieving Admin with email=" + email,
    });
  }
};

exports.findById = async (req, res) => {
  const id = req.params.id;

  try {
    const query = `
      SELECT id, name, email, role, createdAt
      FROM admins 
      WHERE id = ?
    `;
    const data = await queryAsync(query, [id]);

    if (data.length > 0) {
      // Optionally format the createdAt field
      const processedData = {
        id: data[0].id,
        name: data[0].name,
        email: data[0].email,
        role: data[0].role,
        createdAt: new Date(data[0].createdAt).toLocaleDateString(),
      };

      res.status(200).send(processedData);
    } else {
      res.status(404).send({
        message: "Admin Not Found",
      });
    }
  } catch (err) {
    res.status(500).send({
      message: "Error retrieving Admin with id=" + id,
    });
  }
};

exports.getUserByEmail = async (req, res) => {
  const email = req.body.email;

  try {
    const query = "SELECT * FROM admins WHERE email = ?";
    const data = await queryAsync(query, [email]);

    if (data.length > 0) {
      res.status(200).send(data[0]);
    } else {
      res.status(400).send({
        message: "User Not Found",
      });
    }
  } catch (err) {
    res.status(500).send({
      message: "Error retrieving Admin with email=" + email,
    });
  }
};

exports.verifyToken = async (req, res) => {
  const { email, token } = req.body;

  try {
    // Query the database to retrieve the token for the given email
    const query = `SELECT emailToken FROM admins WHERE email = ?`;
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

exports.updatePassword = async (req, res) => {
  const email = req.body.email;
  const id = req.body.id;
  const newPassword = req.body.password;
  const old = req.body.old; // New field to match the current password
  const token = req.body.token;

  try {
    const query = email
      ? `SELECT * FROM admins WHERE email ="${email}"`
      : `SELECT * FROM admins WHERE id=${id}`;
    const data = await queryAsync(query);

    if (data.length === 0) {
      res.status(400).send({
        message: "Admin Not Found.",
      });
      return;
    }

    const admin = data[0];

    // If `oldPass` is provided, validate it against the current password
    if (old) {
      const isOldPasswordValid = await bcrypt.compare(old, admin.password);
      if (!isOldPasswordValid) {
        res.status(400).send({
          message: "Current password is incorrect.",
        });
        return;
      }
    } else {
      // If `oldPass` is not provided, validate the token
      if (admin.emailToken != token) {
        res.status(400).send({
          message: "Reset link is broken. Try Again",
        });
        return;
      }
    }

    // Check if the new password is the same as the old password
    const isNewPasswordSame = await bcrypt.compare(newPassword, admin.password);
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
      "UPDATE admins SET password = ?, updatedAt = ? WHERE email = ?",
      [hash, updatedAt, admin.email]
    );

    res.send({ message: "Password updated successfully." });
  } catch (err) {
    console.log(err);
    res.status(500).send({
      message: "Error updating password for admin with email=" + email,
    });
  }
};

exports.resetPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const token = crypto.randomBytes(32).toString("hex");

    const query = `SELECT * FROM admins WHERE email = ?`;
    // Query the database to find the user by email
    const result = await queryAsync(query, [email]);

    if (result.length > 0) {
      const query = `UPDATE admins SET emailToken = ? WHERE email = ?`;
      await queryAsync(query, [token, result[0].email]);
      const resp = await queryAsync(
        `SELECT notification_id FROM admins WHERE email = ?`,
        [email]
      );
      const sId = resp[0].notification_id;
      sendResetEmail(
        email,
        `${process.env.REACT_APP_URL}/admin/reset-password/${email}?t=${token}`,
        sId
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

exports.editAdmin = async (req, res) => {
  const { id } = req.params;
  const { name, role, email } = req.body;

  console.log("name = ", name, "role = ", role, "email = ", email);
  console.log("id = ", id);

  if (!id || !name || !role || !email) {
    return res.status(400).json({
      message: "Please provide all required fields: id, name, role, email.",
    });
  }

  try {
    // Get the current date and time
    const updatedAt = new Date();

    const query = `
      UPDATE admins 
      SET name = ?, role = ?, email = ?, updatedAt = ? 
      WHERE id = ?
    `;
    const result = await queryAsync(query, [name, role, email, updatedAt, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Admin not found." });
    }

    const selectQuery = "SELECT * FROM admins WHERE id = ?";
    const updatedAdmin = await queryAsync(selectQuery, [id]);

    res.status(200).json(updatedAdmin[0]);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
    res.status(500).json({ message: "Server error", error });
  }
};

exports.getCompanyRequests = async (req, res) => {
  const status = req.params.status;

  if (!status) {
    return res.status(400).send({
      message: "request status is required",
    });
  }
  try {
    const query = "SELECT * FROM verificationRequest WHERE role=? AND status=?";
    const result = await queryAsync(query, ["company", status]);

    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({
      message: "Error retrieving requests for status = " + status,
    });
  }
};

exports.getOperatorRequests = async (req, res) => {
  const status = req.params.status;

  if (!status) {
    return res.status(400).send({
      message: "request status is required",
    });
  }
  try {
    const query = "SELECT * FROM verificationRequest WHERE role=? AND status=?";
    const result = await queryAsync(query, ["operator", status]);

    res.status(200).send(result);
  } catch (error) {
    res.status(500).send({
      message: "Error retrieving requests for status = " + status,
    });
  }
};

exports.deleteAdmin = async (req, res) => {
  const id = req.params.id;

  if (!id) {
    return res.status(400).send({
      message: "Admin ID is required",
    });
  }

  try {
    const query = "UPDATE admins SET is_deleted = true WHERE id = ?";
    const result = await queryAsync(query, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).send({
        message: "Admin not found or already deleted",
      });
    }

    res.status(200).send({
      message: "Admin marked as deleted successfully",
    });
  } catch (error) {
    res.status(500).send({
      message: "Error updating Admin with id=" + id,
    });
  }
};

// exports.editAdmin = async (req, res) => {
//   const { id } = req.params;  // Get the admin ID from the URL parameters
//   const { name, email, address, contact, profileUrl, role } = req.body;  // Get the values from the request body

//   if (!id) {
//     return res.status(400).json({ message: "Admin ID is required." });
//   }

//   // Prepare the updated fields object
//   const updatedFields = {};

//   if (name) updatedFields.name = name;
//   if (email) updatedFields.email = email;
//   if (address) updatedFields.address = address;
//   if (contact) updatedFields.contact = contact;
//   if (profileUrl) updatedFields.profileUrl = profileUrl;

//   try {
//     const [updatedRows] = await Admin.update(updatedFields, {
//       where: { id },
//       returning: true,
//     });

//     if (updatedRows === 0) {
//       return res.status(404).json({ message: "Admin not found." });
//     }

//     const updatedAdmin = await Admin.findByPk(id);

//     res.status(200).json(updatedAdmin);
//   } catch (error) {
//     console.error("Error updating admin:", error);  // Log the error for debugging
//     res.status(500).json({ message: "An error occurred while updating the admin." });
//   }
// };

exports.getCometChatId = async (req, res) => {
  const { id } = req.params;

  console.log("id = ", id);

  try {
    let query = `SELECT chat_id FROM admins WHERE id = ${id}`;
    let result = await queryAsync(query);

    if (!result || result.length === 0) {
      res.status(404).send("User not found");
      return;
    }

    let uid = result[0].chat_id;
    console.log("uid = ", uid);

    const response = await axios.get(
      `https://${process.env.COMETCHAT_APP_ID}.api-${process.env.COMETCHAT_REGION}.cometchat.io/v3/users/${uid}`,
      {
        headers: {
          accept: "application/json",
          apikey: process.env.COMETCHAT_API_KEY,
        },
      }
    );

    console.log("response = ", response.data);

    res.status(200).send(response.data);
  } catch (error) {
    console.error("Server error:", error);

    res.status(500).json({ message: "Server error", error });
  }
};
