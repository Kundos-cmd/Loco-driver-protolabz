const db = require("../index"); // Assuming you have a db module to interact with your database
const notify = require("../novu/send-notification");
const getCompanyNotificationId = require('../utils/NotificationIds/getCompanyNotificationId')
const sendNotificationEmail = require('../novu/send-notification-email')
const companies = require("../users/company/company.controller");
const dotenv = require("dotenv");
dotenv.config();
// Add a new request
/*
exports.addRequest = (req, res) => {
  const { operator_id, company_id, requested_at, request_message, status } =
    req.body;
  db.query(
    "INSERT INTO driveRequests (operator_id, company_id, requested_at, request_message, status) VALUES (?, ?, ?, ?, ?)",
    [operator_id, company_id, requested_at, request_message, status],
    (error, result) => {
      if (error) {
        console.error("Error executing query:", error.message);
        return res.status(500).json({ message: "Error adding request" });
      }
      res.status(201).json({
        id: result.insertId,
        operator_id,
        company_id,
        requested_at,
        request_message,
        status,
      });
    }
  );
};
*/
exports.addRequest = (req, res) => {
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

  db.query(sqlQuery, values, async (error, result) => {
    if (error) {
      console.error("Error executing query:", error.message);
      return res.status(500).json({ message: "Error adding request" });
    }
    const sId = await getCompanyNotificationId(company_id);
    const email = await companies.getCompanyEmail(company_id);
    notify(sId,`${process.env.REACT_APP_URL}/company/requests/view-request/${result.insertId}`,'You have a new drive request');
    console.log('notification sending to ',email);
    sendNotificationEmail(email,'New Drive Request','You recieved a new drive request from an operator. Click View button below to learn more.',`${process.env.REACT_APP_URL}/company/requests/view-request/${result.insertId}`,sId);
    res.status(201).json({
      id: result.insertId,
      ...combinedFields,
    });
  });
};

// Delete a request by ID
exports.deleteRequest = (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM driveRequests WHERE id = ?", [id], (error, result) => {
    if (error) {
      console.error("Error executing query:", error.message);
      return res.status(500).json({ message: "Error deleting request" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Request not found" });
    }
    res.status(200).json({ message: "Request deleted successfully" });
  });
};

// Update a request by ID
exports.updateRequest = (req, res) => {
  const { id } = req.params;
  const { operator_id, company_id, requested_at, request_message, status } =
    req.body;

  // Build the update query dynamically based on provided fields
  const updates = [];
  const values = [];

  if (operator_id !== undefined) {
    updates.push("operator_id = ?");
    values.push(operator_id);
  }
  if (company_id !== undefined) {
    updates.push("company_id = ?");
    values.push(company_id);
  }
  if (requested_at !== undefined) {
    updates.push("requested_at = ?");
    values.push(requested_at);
  }
  if (request_message !== undefined) {
    updates.push("request_message = ?");
    values.push(request_message);
  }
  if (status !== undefined) {
    updates.push("status = ?");
    values.push(status);
  }

  // If no fields are provided, return an error
  if (updates.length === 0) {
    return res.status(400).json({ message: "No fields to update" });
  }

  // Add the ID to the end of the values array
  values.push(id);

  // Create the final SQL query string
  const query = `UPDATE driveRequests SET ${updates.join(", ")} WHERE id = ?`;

  db.query(query, values, (error, result) => {
    if (error) {
      console.error("Error executing query:", error.message);
      return res.status(500).json({ message: "Error updating request" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Request not found" });
    }
    res.status(200).json({
      // id,
      // operator_id,
      // company_id,
      // requested_at,
      // request_message,
      // status,
      message: "Updated Successfully",
    });
  });
};

// Get all requests
exports.getAllRequests = (req, res) => {
  console.log("Check kar");
  db.query("SELECT * FROM driveRequests", (error, results) => {
    if (error) {
      console.error("Error executing query:", error.message);
      return res.status(500).json({ message: "Error fetching requests" });
    }
    console.log("Query Result:", results); // Debugging line
    res.status(200).json(results);
  });
};

// Get a single request by ID
// Get a single request by ID
exports.getRequestById = (req, res) => {
  const { id } = req.params;
  db.query("SELECT * FROM driveRequests WHERE id = ?", [id], (error, rows) => {
    if (error) {
      console.error("Error executing query:", error.message);
      return res.status(500).json({ message: "Error fetching request" });
    }
    if (rows.length === 0) {
      return res.status(404).json({ message: "Request not found" });
    }
    res.status(200).json(rows[0]);
  });
};

//Get request by operator id

exports.getRequestByOperatorId = (req, res) => {
  const { id } = req.params; // Extract operator ID from request parameters

  // Query the database to find all requests for the given operator ID
  db.query(
    "SELECT * FROM driveRequests WHERE operator_id = ?",
    [id],
    (error, results) => {
      if (error) {
        console.error("Error executing query:", error.message); // Log any SQL errors
        return res.status(500).json({ message: "Error fetching requests" }); // Respond with a 500 status code
      }
      res.status(200).json(results); // Respond with the list of requests
    }
  );
};

exports.getRequestByOperatorIdWithStatus = (req, res) => {
  const { id, status } = req.params; // Extract operator ID and status from request parameters

  if (!id || !status) {
    return res.status(400).json({
      message: "Insufficient parameters provided",
    });
  }

  let query = "SELECT * FROM driveRequests WHERE operator_id = ?";
  const queryParams = [id];

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

  // Query to fetch requests based on the specified status
  db.query(query, queryParams, (error, results) => {
    if (error) {
      console.error("Error executing query:", error.message); // Log any SQL errors
      return res.status(500).json({ message: "Error fetching requests" }); // Respond with a 500 status code
    }
    if (results.length === 0) {
      return res.status(404).json({
        message:
          "No requests found for this operator with the specified status",
      }); // Handle case where no results are found
    }
    res.status(200).json(results); // Respond with the list of requests
  });
};

exports.getDriveRequestsByCompanyWithOperator = (req, res) => {
  const { company_id, operator_id } = req.params; // Extract company ID and operator ID from request parameters

  // Check if both company_id and operator_id are provided
  if (!company_id || !operator_id) {
    return res.status(400).json({
      message:
        "Both company_id and operator_id must be provided in the request parameters.",
    });
  }

  // SQL query to find requests by both company ID and operator ID
  const query = `
    SELECT * FROM driveRequests 
    WHERE company_id = ? AND operator_id = ?
  `;

  // Execute the query with the provided company_id and operator_id
  db.query(query, [company_id, operator_id], (error, results) => {
    if (error) {
      console.error("Error executing query:", error.message); // Log SQL errors
      return res.status(500).json({ message: "Error fetching requests" }); // Respond with a 500 status
    }

    // Handle case where no results are found
    if (results.length === 0) {
      return res.status(404).json({
        message: "No requests found for this company and operator.",
      });
    }

    // Respond with the list of requests
    res.status(200).json(results);
  });
};

exports.getDriveInitiationRequestsByCompanyWithOperator = (req, res) => {
  const { company_id, operator_id } = req.params; // Extract company ID and operator ID from request parameters

  // Check if both company_id and operator_id are provided
  if (!company_id || !operator_id) {
    return res.status(400).json({
      message:
        "Both company_id and operator_id must be provided in the request parameters.",
    });
  }

  // SQL query to find requests by company ID and operator ID with specific status conditions
  const query = `
    SELECT * FROM driveRequests 
    WHERE company_id = ? 
    AND operator_id = ?
    AND status IN ('submitted', 'viewed','replied')
  `;

  // Execute the query with the provided company_id and operator_id
  db.query(query, [company_id, operator_id], (error, results) => {
    if (error) {
      console.error("Error executing query:", error.message); // Log SQL errors
      return res.status(500).json({ message: "Error fetching requests" }); // Respond with a 500 status
    }

    // Handle case where no results are found
    if (results.length === 0) {
      return res.status(404).json({
        message: "No requests found for this company and operator.",
      });
    }

    // Respond with the list of requests
    res.status(200).json(results);
  });
};

//For companyies
// Get requests by company ID
exports.getRequestByCompanyId = (req, res) => {
  const { id } = req.params; // Extract company ID from request parameters

  db.query(
    "SELECT * FROM driveRequests WHERE company_id = ?",
    [id],
    (error, results) => {
      if (error) {
        console.error("Error executing query:", error.message);
        return res.status(500).json({ message: "Error fetching requests" });
      }
      if (results.length === 0) {
        return res
          .status(404)
          .json({ message: "No requests found for this company" });
      }
      res.status(200).json(results);
    }
  );
};

// Get requests by company ID and status
exports.getRequestByCompanyIdWithViewStatus = (req, res) => {
  const { id, view } = req.params; // Extract company ID and status from request parameters

  if (!id || !view) {
    return res
      .status(400)
      .json({ message: "Insufficient parameters provided" });
  }

  db.query(
    "SELECT * FROM driveRequests WHERE company_id = ? AND is_viewed = ?",
    [id, view],
    (error, results) => {
      if (error) {
        console.error("Error executing query:", error.message);
        return res.status(500).json({ message: "Error fetching requests" });
      }
      if (results.length === 0) {
        return res.status(404).json({
          message:
            "No requests found for this company with the specified view status",
        });
      }
      res.status(200).json(results);
    }
  );
};

//Get request by company id with theres.status();

exports.getRequestByCompanyIdWithStatus = (req, res) => {
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

  let query = "SELECT * FROM driveRequests WHERE company_id = ?";
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
  db.query(query, queryParams, (error, results) => {
    if (error) {
      console.error("Error executing query:", error.message);
      return res.status(500).json({ message: "Error fetching requests" });
    }
    if (results.length === 0) {
      return res.status(404).json({
        message: "No requests found for this company with the specified status",
      });
    }
    res.status(200).json(results);
  });
};

// Get requests by company ID and reply status
exports.getRequestByCompanyIdWithReply = (req, res) => {
  const { id, reply } = req.params; // Extract company ID and reply status from request parameters

  if (!id || !reply) {
    return res
      .status(400)
      .json({ message: "Insufficient parameters provided" });
  }

  db.query(
    "SELECT * FROM driveRequests WHERE company_id = ? AND is_replied = ?",
    [id, reply],
    (error, results) => {
      if (error) {
        console.error("Error executing query:", error.message);
        return res.status(500).json({ message: "Error fetching requests" });
      }
      if (results.length === 0) {
        return res.status(404).json({
          message:
            "No requests found for this company with the specified reply status",
        });
      }
      res.status(200).json(results);
    }
  );
};

exports.getRequestByCompanyIdWithViewReply = async (req, res) => {
  try {
    const { id, view, reply } = req.params;

    // Validate parameters
    if (!id || !view || !reply) {
      return res.status(400).send({
        message:
          "Invalid parameters. Please provide company ID, view status, and reply status.",
      });
    }

    // Construct the SQL query based on parameters
    const sqlQuery = `
      SELECT * 
      FROM driveRequests 
      WHERE company_id = ?
        AND is_viewed = ?
        AND is_replied = ?
    `;

    // Execute the query with the parameters
    db.query(sqlQuery, [id, view, reply], (err, result) => {
      if (err) {
        console.error("Error executing query:", err);
        return res.status(500).send({
          message: "Error occurred while fetching requests.",
        });
      }
      res.status(200).send(result);
    });
  } catch (err) {
    console.error(
      "Error fetching requests by company ID with view and reply status:",
      err
    );
    res.status(500).send({
      message: "Error occurred while fetching requests.",
    });
  }
};

exports.ChangeViewByID = async (req, res) => {
  try {
    const { id, view } = req.params;

    // Validate parameters
    if (!id || !view) {
      return res.status(400).send({
        message:
          "Invalid parameters. Please provide request ID and view status.",
      });
    }

    // Validate view status (adjust this if you have specific valid values)
    const validViews = ["0", "1"]; // Example valid values
    if (!validViews.includes(view)) {
      return res.status(400).send({
        message:
          "Invalid view status. Accepted values are 'pending', 'completed', 'archived'.",
      });
    }

    // Construct the SQL query to update the view status
    const sqlQuery = `
      UPDATE driveRequests
      SET is_viewed = ?
      WHERE id = ?
    `;

    // Execute the update query
    db.query(sqlQuery, [view, id], (err, result) => {
      if (err) {
        console.error("Error executing query:", err);
        return res.status(500).send({
          message: "Error occurred while updating the view status.",
        });
      }

      // Check if any rows were affected
      if (result.affectedRows === 0) {
        return res.status(404).send({
          message: "Request not found.",
        });
      }

      res.status(200).send({
        message: "View status updated successfully.",
      });
    });
  } catch (err) {
    console.error("Error updating view status by request ID:", err);
    res.status(500).send({
      message: "Error occurred while updating the view status.",
    });
  }
};

exports.ChangeReplyByID = async (req, res) => {
  try {
    const { id, reply } = req.params;

    // Validate parameters
    if (!id || !reply) {
      return res.status(400).send({
        message:
          "Invalid parameters. Please provide request ID and reply status.",
      });
    }

    // Validate reply status
    const validReplies = ["0", "1"]; // Example valid values, '0' for not replied and '1' for replied
    if (!validReplies.includes(reply)) {
      return res.status(400).send({
        message: "Invalid reply status. Accepted values are '0' and '1'.",
      });
    }

    // Construct a query to update is_replied, status (if reply is '1'), and completion_status
    const sqlQuery = `
      UPDATE driveRequests
      SET 
        is_replied = ?, 
        status = CASE WHEN ? = '1' THEN 'answered' ELSE status END,
        completion_status = CASE WHEN ? = '1' THEN 0 ELSE completion_status END
      WHERE id = ?
    `;

    // Execute the single update query
    db.query(sqlQuery, [reply, reply, reply, id], (err, result) => {
      if (err) {
        console.error("Error executing query:", err);
        return res.status(500).send({
          message: "Error occurred while updating the reply status.",
        });
      }

      // Check if any rows were affected
      if (result.affectedRows === 0) {
        return res.status(404).send({
          message: "Request not found.",
        });
      }

      res.status(200).send({
        message:
          "Reply status, request status, and completion status updated successfully.",
      });
    });
  } catch (err) {
    console.error("Error updating reply status by request ID:", err);
    res.status(500).send({
      message: "Error occurred while updating the reply status.",
    });
  }
};

exports.ChangeStatusByID = async (req, res) => {
  try {
    const { id, status } = req.params;

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
      // Add other valid statuses here as needed
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

    // Execute the query
    db.query(sqlQuery, [status, id], (err, result) => {
      if (err) {
        console.error("Error executing query:", err);
        return res.status(500).send({
          message: "Error occurred while updating the status.",
        });
      }

      // Check if any rows were affected
      if (result.affectedRows === 0) {
        return res.status(404).send({
          message: "Request not found.",
        });
      }

      res.status(200).send({
        message: "Status updated successfully.",
      });
    });
  } catch (err) {
    console.error("Error updating status by request ID:", err);
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
          status  = rejected
          rejection_message = ?,
          rejection_reason = ?
      WHERE id = ?
    `;

    // Execute the update query
    db.query(
      sqlQuery,
      [rejection_message, rejection_reason, id],
      (err, result) => {
        if (err) {
          console.error("Error executing query:", err);
          return res.status(500).send({
            message: "Error occurred while rejecting the request.",
          });
        }

        // Check if any rows were affected
        if (result.affectedRows === 0) {
          return res.status(404).send({
            message: "Request not found.",
          });
        }

        res.status(200).send({
          message: "Request rejected successfully.",
        });
      }
    );
  } catch (err) {
    console.error("Error rejecting request by ID:", err);
    res.status(500).send({
      message: "Error occurred while rejecting the request.",
    });
  }
};

// Get a single request by ID, dynamically including filter metadata
exports.getRequestByIdWithFilters = (req, res) => {
  const { id } = req.params;

  // Query to fetch the drive request by its ID
  const requestQuery = "SELECT * FROM driveRequests WHERE id = ?";

  // Query to fetch all active filters
  const filterQuery = "SELECT * FROM Filters";

  // Execute both queries in parallel
  db.query(requestQuery, [id], (error, requestResults) => {
    if (error) {
      console.error("Error fetching drive request:", error.message);
      return res.status(500).json({ message: "Error fetching drive request" });
    }

    // Check if drive request exists
    if (requestResults.length === 0) {
      return res.status(404).json({ message: "Drive request not found" });
    }

    const driveRequest = requestResults[0]; // Extract the drive request row

    // Fetch all filters
    db.query(filterQuery, (filterError, filterResults) => {
      if (filterError) {
        console.error("Error fetching filters:", filterError.message);
        return res.status(500).json({ message: "Error fetching filters" });
      }

      // Build the response with filters and corresponding drive request column values
      const responseData = filterResults.map((filter) => {
        const filterName = filter.name;

        // Retrieve the value from the driveRequest that corresponds to this filter's column
        const selectedValue = driveRequest[filterName];

        // Prepare the response object for each filter
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
        requestMessage: driveRequest.request_message,
        status: driveRequest.status,
        filters: responseData, // Filter metadata and selected values
      });
    });
  });
};
