const db = require("../index");
const notify = require('../novu/send-notification');
const operators = require('../users/operator/operator.controller');
const dotenv = require("dotenv");
dotenv.config();
// Retrieve all drives/
exports.getDrives = async (req, res) => {
  db.query("SELECT * FROM drives", (err, results) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      res.status(500).send("Error fetching Drives");
      return;
    }
    res.json(results);
  });
};

exports.getDriveById = async (req, res) => {
  const id = req.params.id;
  console.log("Drive_id", id);

  db.query(`SELECT * FROM drives WHERE drive_id = ${id}`, (err, results) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      res.status(500).send("Error fetching users");
      return;
    }
    res.json(results);
  });
};

//Retrieve the drives of a company
exports.getDrivesByCompanyId = async (req, res) => {
  const companyId = req.params.companyId;
  console.log("companyId", companyId);

  db.query(
    `SELECT * FROM drives WHERE company_id = ${companyId}`,
    (err, results) => {
      if (err) {
        console.error("Error executing query: " + err.stack);
        res.status(500).send("Error fetching users");
        return;
      }
      res.json(results);
    }
  );
};
//Retrieve the drives of a Operator
exports.getDrivesByOperatorId = async (req, res) => {
  const operator_id = req.params.operator_id;
  console.log("operator_id :", operator_id);

  db.query(
    `SELECT * FROM drives WHERE operator_id = ${operator_id}`,
    (err, results) => {
      if (err) {
        console.error("Error executing query: " + err.stack);
        res.status(500).send("Error fetching users");
        return;
      }
      res.json(results);
    }
  );
};

//Retrieve the drives for a specific driver
exports.getDrivesByDriverId = async (req, res) => {
  const driver_id = req.params.driver_id;
  console.log("driver_id :", driver_id);

  db.query(
    `SELECT * FROM drives WHERE driver_id = ${driver_id}`,
    (err, results) => {
      if (err) {
        console.error("Error executing query: " + err.stack);
        res.status(500).send("Error fetching users");
        return;
      }
      res.json(results);
    }
  );
};

// Add a drive
/*
exports.addDrive = async(req, res) => {
    db.query('INSERT INTO drives SET ?', req.body, (err, results) => {
        if (err) {
          console.error('Error executing query: ' + err.stack);
          res.status(500).send('Error fetching users');
          return;
        }
        res.json(results);
      });
};
*/
exports.addDrive = (req, res) => {
  console.log("Inside the controller add drive");

  const {
    price, // Use price directly
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

  // Start with core fields
  const coreFields = {
    price, // Use price directly, no need for a cost mapping
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

  // Execute the SQL query
  db.query(sqlQuery, values, (error, result) => {
    if (error) {
      console.error("Error executing query:", error.message);
      return res.status(500).json({ message: "Error adding drive" });
    }
    const sId = operators.getNotificationId(operator_id);
    notify(sId, `${process.env.REACT_APP_URL}/operator/view-drive/${result.insertId}`,'A new drive is scheduled')
    res.status(200).json({
      id: result.insertId,
      // ...combinedFields,
      message: "Drive added and offer sent successfully",
    });
  });
};

// Edit a drive
// Edit a drive

exports.editDrive = async (req, res) => {
  const { id } = req.params;
  const {
    start,
    end,
    shift,
    price,
    status,
    operator_id,
    driver_id,
    company_id,
  } = req.body;

  console.log("Edit Drive");
  console.log(id);
  // Validate required fields
  if (
    !id ||
    !start ||
    !end ||
    !shift ||
    !price ||
    !status ||
    !operator_id ||
    !company_id
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const query = `
    UPDATE drives
    SET start = ?,
        end = ?,
        shift = ?,
        price = ?,
        status = ?,
        operator_id = ?,
        driver_id = ?,
        company_id = ?
    WHERE drive_id = ?
  `;

  const values = [
    start,
    end,
    shift,
    price,
    status,
    operator_id,
    driver_id,
    company_id,
    id,
  ];

  try {
    db.query(query, values, (err, results) => {
      if (err) {
        console.error("Error executing query:", err.stack);
        return res.status(500).json({ error: "Error updating drive" });
      }

      if (results.affectedRows === 0) {
        return res.status(404).json({ error: "Drive not found" });
      }

      return res.json({ message: "Drive updated successfully" });
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Controller function to update the payment status of a drive
// Controller function to update the payment status of a drive
exports.changePaymentStatusDrive = async (req, res) => {
  const { id } = req.params;
  const { payment } = req.body;

  // Validate input
  if (payment !== 0 && payment !== 1) {
    return res.status(400).json({ error: "Invalid payment status" });
  }

  // SQL query to update payment status
  const query = "UPDATE drives SET payment = ? WHERE drive_id = ?";
  const values = [payment, id];

  db.query(query, values, (err, results) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      return res.status(500).json({ error: "Server error" });
    }

    // Check if any rows were affected (i.e., the drive was updated)
    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Drive not found" });
    }

    res.status(200).json({ message: "Payment status updated successfully" });
  });
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
  

  let query = "SELECT * FROM drives WHERE 1=1";
  let queryParams = [];

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
  if (payment) {
    payment = payment === '0' ? 0 : 1;
    query += " AND payment = ?";
    queryParams.push(payment);
  }
  if (price_min) {
    query += " AND price >= ?";
    queryParams.push(parseFloat(price_min));
  }
  if (price_max) {
    query += " AND price <= ?";
    queryParams.push(parseFloat(price_max));
  }
  if (start) {
    query += " AND start >= ?";
    queryParams.push(start);
  }
  if (end) {
    query += " AND end <= ?";
    queryParams.push(end);
  }

  db.query(query, queryParams, (error, results) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json(results);
  });
};

//Status Drives

// Retrieve drives of a specific company with a given status
exports.getCompanyStatusDrive = async (req, res) => {
  const companyId = req.params.companyId;
  const status = req.params.status;
  if (!companyId || !status) {
    return res.status(400).json({
      message:
        "Both operatorId and status must be provided in the request parameters.",
    });
  }

  console.log("companyId:", companyId);
  console.log("status:", status);

  const query = "SELECT * FROM drives WHERE company_id = ? AND status = ?";
  const queryParams = [companyId, status];

  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      return res.status(500).send("Error fetching drives");
    }
    res.json(results);
  });
};

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

  // SQL query to select drives based on operator ID and status
  const query = "SELECT * FROM drives WHERE operator_id = ? AND status = ?";
  const queryParams = [operatorId, status];

  // Execute the query with the provided operator ID and status
  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      return res.status(500).send("Error fetching drives");
    }
    res.json(results); // Send back the results
  });
};

// Retrieve all drives with a given status
exports.getStatusDrives = async (req, res) => {
  const status = req.params.status;


  const query = "SELECT * FROM drives WHERE status = ?";
  const queryParams = [status];

  db.query(query, queryParams, (err, results) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      return res.status(500).send("Error fetching drives");
    }
    res.json(results);
  });
};




exports.getDriveByIdWithFilters = (req, res) => {
  const { id } = req.params;

  // Query to fetch the drive by its ID
  const driveQuery = "SELECT * FROM drives WHERE drive_id = ?";

  // Query to fetch all active filters
  const filterQuery = "SELECT * FROM Filters";

  // Execute both queries in parallel
  db.query(driveQuery, [id], (error, driveResults) => {
    if (error) {
      console.error("Error fetching drive:", error.message);
      return res.status(500).json({ message: "Error fetching drive" });
    }

    // Check if the drive exists
    if (driveResults.length === 0) {
      return res.status(404).json({ message: "Drive not found" });
    }

    const drive = driveResults[0]; // Extract the drive row

    // Fetch all filters
    db.query(filterQuery, (filterError, filterResults) => {
      if (filterError) {
        console.error("Error fetching filters:", filterError.message);
        return res.status(500).json({ message: "Error fetching filters" });
      }

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
          options: filter.type === 'Select' ? filter.options : null,
          selectedValue: selectedValue || null, // Value from drive
        };
      });

      // Send the final combined response
      res.status(200).json({
        driveId: drive.drive_id,
        operatorId: drive.operator_id,
        companyId: drive.company_id,
        start:drive.start,
        end:drive.end,
        price:drive.price,
        driveDate: drive.drive_date,
        trainType: drive.train_type,
        status: drive.status,
        filters: responseData, // Filter metadata and selected values
      });
    });
  });
};



exports.changeDriveStatus = (req, res) => {
  const { id } = req.params;  // Extract drive ID from the request parameters
  const { status } = req.body;  // Extract the new status from the request body

  // Validate that both the ID and status are provided
  if (!id || !status) {
    return res.status(400).json({
      message: "Drive ID and status are required",
    });
  }

  // Define the allowed statuses (you can adjust these as needed)
  const validStatuses = ['ongoing', 'offer sent','offer declined', 'scheduled', 'cancelled', 'completed'];

  // Check if the provided status is valid
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      message: "Invalid status provided",
    });
  }

  // SQL query to update the drive status by drive ID
  const updateQuery = "UPDATE drives SET status = ? WHERE drive_id = ?";

  // Execute the update query
  db.query(updateQuery, [status, id], (error, results) => {
    if (error) {
      console.error("Error updating drive status:", error.message);
      return res.status(500).json({ message: "Error updating drive status" });
    }

    // Check if any row was affected (i.e., if the drive ID exists)
    if (results.affectedRows === 0) {
      return res.status(404).json({
        message: "Drive not found",
      });
    }

    // If the update was successful, send a success response
    res.status(200).json({
      message: `Drive status updated successfully to '${status}'`,
    });
  });
};



exports.EndDrive = (req, res) => {
  const { id } = req.params; // Extract the drive ID from the request parameters
  const { status, endMessage } = req.body; // Extract the status and end message from the request body

  // Validate the ID, status, and end message
  if (!id || !status || !endMessage) {
    return res.status(400).json({
      message: "Drive ID, status, and end message are required",
    });
  }
  console.log(req.body)

  // SQL query to update both status and end message
  const query = "UPDATE drives SET status = ?, termination_message = ? WHERE drive_id = ?";

  // Execute the query to update the status and end message
  db.query(query, [status, endMessage, id], (error, results) => {
    if (error) {
      console.error("Error updating drive:", error.message);
      return res.status(500).json({ message: "Error ending drive" });
    }

    // Check if any rows were affected
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Drive not found" });
    }

    // Send a success response
    res.status(200).json({ message: `Drive ended with status '${status}' and message '${endMessage}'` });
  });
};




exports.cancelDrive = (req, res) => {
  const { id } = req.params; // Extract the drive ID from the request parameters
  const { status, endMessage } = req.body; // Extract the status and end message from the request body

  // Validate the ID, status, and end message
  if (!id || !status || !endMessage) {
    return res.status(400).json({
      message: "Drive ID, status, and cancellation message are required",
    });
  }

  // SQL query to update both status and cancellation message
  const query = "UPDATE drives SET status = ?, termination_message = ? WHERE drive_id = ?";

  // Execute the query to update the status and cancellation message
  db.query(query, [status, endMessage, id], (error, results) => {
    if (error) {
      console.error("Error canceling drive:", error.message);
      return res.status(500).json({ message: "Error canceling drive" });
    }

    // Check if any rows were affected
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "Drive not found" });
    }

    // Send a success response
    res.status(200).json({ message: `Drive canceled with status '${status}' and message '${endMessage}'` });
  });
};
