const express = require("express");
const cors = require("cors");
const mysql = require("mysql");
const dotenv = require("dotenv");
const schedule = require("node-schedule");
const path = require('path');
dotenv.config();

// Create an Express app
const app = express();
const port = 8000;

const bodyParser = require("body-parser");

app.use(bodyParser.json());
app.use(cors());
app.use(express.json());

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

console.log("path",path.join(__dirname, 'public'));


// Create a MySQL connection pool
const db = mysql.createPool({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DB,
  connectionLimit: 10, // Adjust this limit based on your needs
});

// Test the database connection
db.getConnection((err, connection) => {
  if (err) {
    console.error("Error connecting to MySQL: " + err.stack);
    return;
  }
  console.log("Connected to MySQL as ID " + connection.threadId);
  connection.release(); // Release the connection back to the pool
});

// Export the database pool for use in other modules
module.exports = db;

// Define a simple route
app.get("/", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.send("Hello World");
});

const notify = require("./novu/send-notification");
const request = require("./utils/verification-request/requestApis");
// const createUser = require("./novu/create-subscriber")

// createUser('junaid amir', 'junaidamir227@gmail.com', '+92308-4109453', 'https://ik.imagekit.io/mja/pp-ph.png?updatedAt=1713673175390').then((id)=>{
//   console.log(id);
// }).catch((err)=>{
//   console.log(err)
// })

// console.log(id);
// notify('1d02ec255dabeb46', 'http://localhost:3000/admin/chat', 'You have new REQUEST.')

// app.post("/submit-verification-request", request.SubmitRequest);
// app.post("/check-verification-request",request.checkRequest);

app.use("/operator", require("./users/operator/operator.route"));
app.use("/admin", require("./users/admin/admin.route"));
app.use("/company", require("./users/company/company.route"));
app.use("/email", require("./services/email.route"));
app.use("/utils", require("./utils/utils.route"));
app.use("/drives", require("./drives/drives.route"));
app.use("/calendars", require("./calendars/calendars.route"));
app.use("/drivers", require("./users/drivers/driver.route"));
app.use("/faqs", require("./faqs/faq.route"));
app.use("/filters", require("./filters/filter.route"));
app.use("/driveRequests", require("./driveRequest/driveRequest.route"));
app.use("/invoices", require("./invoices/invoice.route"));
app.use("/cometchat", require("./cometChat/cometChat.route"));
// const request = require('./utils/verification-request/requestApis');
app.post("/submit-verification-request", request.SubmitRequest);
app.post("/check-verification-request", request.checkRequest);
app.use(
  "/invoice-credentials",
  require("./InvoiceCredentials/invoiceCredentials.route")
);

const updateDrivesToCompleted = async () => {
  console.log("Checking for drives with 'end requested' status...");
  try {
    const query = `
      UPDATE drives
      SET status = 'completed'
      WHERE status = 'end requested'
        AND TIMESTAMPDIFF(HOUR, last_status_change, NOW()) >= 72
    `;
    db.query(query, (error, results) => {
      if (error) {
        console.error("Error updating drives:", error.message);
        return;
      }
      console.log(
        `Updated ${results.affectedRows} drives to 'completed' status.`
      );
    });
  } catch (error) {
    console.error(
      "Unexpected error in updateDrivesToCompleted:",
      error.message
    );
  }
};

// Function to update drives from 'scheduled' to 'ongoing' or 'ongoing' to 'end requested'
const manageDriveStatuses = async () => {
  console.log("Checking drives for 'scheduled' or 'ongoing' status...");
  try {
    // Update drives from 'scheduled' to 'ongoing'
    const updateToOngoingQuery = `
      UPDATE drives
      SET status = 'ongoing'
      WHERE status = 'scheduled'
        AND start <= NOW()
    `;
    db.query(updateToOngoingQuery, (error, results) => {
      if (error) {
        console.error("Error updating drives to 'ongoing':", error.message);
        return;
      }
      console.log(
        `Updated ${results.affectedRows} drives to 'ongoing' status.`
      );
    });

    // Update drives from 'ongoing' to 'end requested'
    const updateToEndRequestedQuery = `
      UPDATE drives
      SET status = 'end requested',
        termination_message = 'completed'
      WHERE status = 'ongoing'
        AND end <= NOW()
    `;
    db.query(updateToEndRequestedQuery, (error, results) => {
      if (error) {
        console.error(
          "Error updating drives to 'end requested':",
          error.message
        );
        return;
      }
      console.log(
        `Updated ${results.affectedRows} drives to 'end requested' status.`
      );
    });
  } catch (error) {
    console.error("Unexpected error in manageDriveStatuses:", error.message);
  }
};

const updateDrivesStatus = async () => {
  console.log("Checking for drives with 'end requested' status...");

  try {
    // Query to update status if last_status_change is older than 15 seconds
    const query = `
      UPDATE drives
      SET status = 'completed'
      WHERE status = 'end requested'
        AND TIMESTAMPDIFF(SECOND, last_status_change, NOW()) >= 15
    `;

    db.query(query, (error, results) => {
      if (error) {
        console.error("Error updating drives:", error.message);
        return;
      }
      console.log(
        `Updated ${results.affectedRows} drives to 'completed' status.`
      );
    });
  } catch (error) {
    console.error("Unexpected error in updateDrivesStatus:", error.message);
  }
};

schedule.scheduleJob("*/30 * * * *", async () => {
  await updateDrivesStatus();
  await manageDriveStatuses();
});

// Start the server
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

// Export the app for testing or further usage
module.exports = app;
