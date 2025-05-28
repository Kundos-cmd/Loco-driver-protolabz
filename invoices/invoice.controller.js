const db = require("../index");

//Get All Invoices
exports.getAllInvoices = async (req, res) => {
  const query = `
      SELECT 
        invoices.id AS invoice_id,
        invoices.created_at,
        invoices.updated_at,
        invoices.due_date,
        invoices.status AS invoice_status,
        invoices.drive_id,
        drives.start,
        drives.end,
        drives.shift,
        drives.status AS drive_status,
        drives.price,
        drives.payment,
        companies.id AS company_id,
        companies.name AS company_name,
        companies.email AS company_email,
        operators.id AS operator_id,
        operators.name AS operator_name,
        operators.email AS operator_email
      FROM invoices
      INNER JOIN drives ON invoices.drive_id = drives.drive_id
      INNER JOIN companies ON drives.company_id = companies.id
      INNER JOIN operators ON drives.operator_id = operators.id
    `;

  db.query(query, (err, result) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      res.status(500).send("Error fetching invoices");
      return;
    }
    res.json(result);
  });
};
exports.getInvoiceStats = async (req, res) => {
  try {
    // Helper function to wrap db.query in a promise
    const queryAsync = (query) => {
      return new Promise((resolve, reject) => {
        db.query(query, (err, results) => {
          if (err) {
            reject(err);
          } else {
            resolve(results);
          }
        });
      });
    };

    // Define queries
    const totalInvoicesQuery = `SELECT COUNT(*) AS total_invoices, SUM(amount) AS total_amount FROM invoices`;
    const totalPaidQuery = `SELECT COUNT(*) AS total_paid, SUM(amount) AS total_paid_amount FROM invoices WHERE status = 'paid'`;
    const totalOverdueQuery = `SELECT COUNT(*) AS total_overdue, SUM(amount) AS total_overdue_amount FROM invoices WHERE status = 'overdue'`;
    const totalPendingQuery = `SELECT COUNT(*) AS total_pending, SUM(amount) AS total_pending_amount FROM invoices WHERE status = 'pending'`;

    // Run all queries in parallel
    const [
      totalInvoicesResult,
      totalPaidResult,
      totalOverdueResult,
      totalPendingResult,
    ] = await Promise.all([
      queryAsync(totalInvoicesQuery),
      queryAsync(totalPaidQuery),
      queryAsync(totalOverdueQuery),
      queryAsync(totalPendingQuery),
    ]);

    // Structure the response
    const response = {
      total: {
        count: totalInvoicesResult[0].total_invoices,
        amount: totalInvoicesResult[0].total_amount,
      },
      paid: {
        count: totalPaidResult[0].total_paid,
        amount: totalPaidResult[0].total_paid_amount,
      },
      overdue: {
        count: totalOverdueResult[0].total_overdue,
        amount: totalOverdueResult[0].total_overdue_amount,
      },
      pending: {
        count: totalPendingResult[0].total_pending,
        amount: totalPendingResult[0].total_pending_amount,
      },
    };

    // Send the response
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching invoice stats" });
  }
};

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

  db.query(query, (err, result) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      res.status(500).send("Error fetching recent invoices");
      return;
    }
    res.json(result);
  });
};

exports.getAllInvoicesInTable = (req, res) => {
  const sqlQuery = `
      SELECT invoices.*, drives.price 
      FROM invoices 
      LEFT JOIN drives ON invoices.drive_id = drives.drive_id
    `;

  db.query(sqlQuery, (error, results) => {
    if (error) {
      console.error("Error executing query:", error.message);
      return res.status(500).json({ message: "Error retrieving invoices" });
    }
    res.status(200).json(results);
  });
};

exports.getInvoicesByCompanyId = (req, res) => {
  const { company_id } = req.params;

  const sqlQuery = `
      SELECT invoices.*, drives.price 
      FROM invoices 
      LEFT JOIN drives ON invoices.drive_id = drives.drive_id
      WHERE invoices.company_id = ?
    `;

  db.query(sqlQuery, [company_id], (error, results) => {
    if (error) {
      console.error("Error executing query:", error.message);
      return res.status(500).json({ message: "Error retrieving invoices" });
    }
    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "No invoices found for the specified company_id" });
    }
    res.status(200).json(results);
  });
};

exports.getInvoicesByOperatorId = (req, res) => {
  const { operator_id } = req.params;

  const sqlQuery = `
      SELECT invoices.*, drives.price 
      FROM invoices 
      LEFT JOIN drives ON invoices.drive_id = drives.drive_id 
      WHERE invoices.operator_id = ?
    `;

  db.query(sqlQuery, [operator_id], (error, results) => {
    if (error) {
      console.error("Error executing query:", error.message);
      return res.status(500).json({ message: "Error retrieving invoices" });
    }
    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "No invoices found for the specified operator_id" });
    }
    res.status(200).json(results);
  });
};

exports.getInvoicesByOperatorIdWithStatus = (req, res) => {
  const { operator_id, status } = req.params;

  let sqlQuery;
  let queryParams = [operator_id];

  if (status === "pending") {
    sqlQuery = `
      SELECT invoices.*, drives.price 
      FROM invoices 
      LEFT JOIN drives ON invoices.drive_id = drives.drive_id
      WHERE invoices.operator_id = ? AND invoices.status = 'unpaid' 
    `;
  } else if (status === "paid") {
    sqlQuery = `
      SELECT invoices.*, drives.price 
      FROM invoices 
      LEFT JOIN drives ON invoices.drive_id = drives.drive_id
      WHERE invoices.operator_id = ? AND (invoices.status = 'paid' OR invoices.status = 'pending')
    `;
  } else if (status === "paid") {
    sqlQuery = `
      SELECT invoices.*, drives.price 
      FROM invoices 
      LEFT JOIN drives ON invoices.drive_id = drives.drive_id
      WHERE invoices.operator_id = ? AND invoices.status = 'change' 
    `;
  } else {
    sqlQuery = `
      SELECT invoices.*, drives.price 
      FROM invoices 
      LEFT JOIN drives ON invoices.drive_id = drives.drive_id
      WHERE invoices.operator_id = ? AND invoices.status = ?
    `;
    queryParams.push(status);
  }

  db.query(sqlQuery, queryParams, (error, results) => {
    if (error) {
      console.error("Error executing query:", error.message);
      return res.status(500).json({ message: "Error retrieving invoices" });
    }
    // Return empty array if no records found
    res.status(200).json(results);
  });
};

exports.getInvoicesByCompanyIdWithStatus = (req, res) => {
  const { company_id, status } = req.params;

  const sqlQuery = `
    SELECT invoices.*, drives.price 
    FROM invoices 
    LEFT JOIN drives ON invoices.drive_id = drives.drive_id
    WHERE invoices.company_id = ? AND invoices.status = ?
  `;

  db.query(sqlQuery, [company_id, status], (error, results) => {
    if (error) {
      console.error("Error executing query:", error.message);
      return res.status(500).json({ message: "Error retrieving invoices" });
    }
    // Return empty array if no records found
    res.status(200).json(results);
  });
};

exports.getInvoicesByCompanyIdWithDuration = (req, res) => {
  const { company_id, duration } = req.params;

  const currentDate = new Date();
  console.log(currentDate);
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
  console.log("dateCondition");
  console.log(dateCondition);

  // Format the dateCondition to match SQL datetime format
  dateCondition = dateCondition.toISOString().slice(0, 19).replace("T", " ");

  const sqlQuery = `
    SELECT invoices.*, drives.price 
    FROM invoices 
    LEFT JOIN drives ON invoices.drive_id = drives.drive_id
    WHERE invoices.company_id = ? AND invoices.created_at >= ?
  `;

  db.query(sqlQuery, [company_id, dateCondition], (error, results) => {
    if (error) {
      console.error("Error executing query:", error.message);
      return res.status(500).json({ message: "Error retrieving invoices" });
    }
    // Return an empty array if no records are found
    res.status(200).json(results);
  });
};

exports.getInvoicesByOperatorIdWithDuration = (req, res) => {
  const { operator_id, duration } = req.params;

  const currentDate = new Date();
  console.log(currentDate);
  let dateCondition;

  // Calculate date based on the duration parameter
  switch (duration) {
    case "weekly":
      dateCondition = new Date();
      dateCondition.setDate(currentDate.getDate() - 7);
      break;
    case "monthly":
      dateCondition = new Date();
      dateCondition.setMonth(currentDate.getMonth() - 1);
      break;
    case "yearly":
      dateCondition = new Date();
      dateCondition.setFullYear(currentDate.getFullYear() - 1);
      break;
    default:
      return res.status(400).json({
        message:
          "Invalid duration provided. Use 'weekly', 'monthly', or 'yearly'.",
      });
  }

  // Format the dateCondition to match SQL datetime format
  dateCondition = dateCondition.toISOString().slice(0, 19).replace("T", " ");
  console.log("dateCondition");
  console.log(dateCondition);
  const sqlQuery = `
    SELECT invoices.*, drives.price 
    FROM invoices 
    LEFT JOIN drives ON invoices.drive_id = drives.drive_id
    WHERE invoices.operator_id = ? AND invoices.created_at >= ?
  `;

  db.query(sqlQuery, [operator_id, dateCondition], (error, results) => {
    if (error) {
      console.error("Error executing query:", error.message);
      return res.status(500).json({ message: "Error retrieving invoices" });
    }
    // Return an empty array if no records are found
    res.status(200).json(results);
  });
};

/*

exports.getInvoicesByCompanyIdWithStatus = async (req, res) => {
  const { company_id, status } = req.params;

  try {
    // Validate company_id and status
    if (!company_id || !status) {
      return res.status(400).json({ error: 'Missing company_id or status' });
    }

    // Fetch invoices from the database
    const invoices = await Invoice.find({ company_id, status });

    if (!invoices.length) {
      return res.status(404).json({ message: 'No invoices found' });
    }

    // Calculate totals
    let totalAmount = 0;
    let weeklyAmount = 0;
    let monthlyAmount = 0;
    let yearlyAmount = 0;

    invoices.forEach(invoice => {
      totalAmount += invoice.price;

      const createdDate = new Date(invoice.created_at);
      const now = new Date();
      const diffInDays = (now - createdDate) / (1000 * 60 * 60 * 24);

      if (diffInDays <= 7) {
        weeklyAmount += invoice.price;
      } else if (diffInDays <= 30) {
        monthlyAmount += invoice.price;
      } else if (diffInDays <= 365) {
        yearlyAmount += invoice.price;
      }
    });

    res.status(200).json({
      totalAmount,
      weeklyAmount,
      monthlyAmount,
      yearlyAmount
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



exports.getInvoicesByOperatorIdWithStatus = async (req, res) => {
  const { operator_id, status } = req.params;

  try {
    // Validate operator_id and status
    if (!operator_id || !status) {
      return res.status(400).json({ error: 'Missing operator_id or status' });
    }

    // Fetch invoices from the database
    const invoices = await Invoice.find({ operator_id, status });

    if (!invoices.length) {
      return res.status(404).json({ message: 'No invoices found' });
    }

    // Calculate totals
    let totalAmount = 0;
    let weeklyAmount = 0;
    let monthlyAmount = 0;
    let yearlyAmount = 0;

    invoices.forEach(invoice => {
      totalAmount += invoice.price;

      const createdDate = new Date(invoice.created_at);
      const now = new Date();
      const diffInDays = (now - createdDate) / (1000 * 60 * 60 * 24);

      if (diffInDays <= 7) {
        weeklyAmount += invoice.price;
      } else if (diffInDays <= 30) {
        monthlyAmount += invoice.price;
      } else if (diffInDays <= 365) {
        yearlyAmount += invoice.price;
      }
    });

    res.status(200).json({
      totalAmount,
      weeklyAmount,
      monthlyAmount,
      yearlyAmount
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
*/

// Get Invoice by ID
/*
exports.getInvoiceByID = async (req, res) => {
  const id = req.params.id;

  const query = `
      SELECT 
        invoices.id AS invoice_id,
        invoices.created_at,
        invoices.updated_at,
        invoices.due_date,
        invoices.status AS invoice_status,
        invoices.drive_id,
        drives.start,
        drives.end,
        drives.shift,
        drives.status AS drive_status,
        drives.price,
        drives.payment,
        companies.id AS company_id,
        companies.name AS company_name,
        companies.email AS company_email,
        operators.id AS operator_id,
        operators.name AS operator_name,
        operators.email AS operator_email
      FROM invoices
      INNER JOIN drives ON invoices.drive_id = drives.drive_id
      INNER JOIN companies ON drives.company_id = companies.id
      INNER JOIN operators ON drives.operator_id = operators.id
      WHERE invoices.id = ?
    `;

  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      res.status(500).send("Error fetching invoice");
      return;
    }
    if (result.length === 0) {
      res.status(404).send("Invoice not found");
      return;
    }
    res.json(result[0]);
  });
};
*/

//nEW gET INVOICE BY iD
exports.getInvoiceByID = async (req, res) => {
  const id = req.params.id;

  const query = `
    SELECT 
      invoices.*,
      companies.name AS company_name,
      companies.email AS company_email,
      operators.name AS operator_name,
      operators.email AS operator_email
    FROM invoices
    INNER JOIN companies ON invoices.company_id = companies.id
    INNER JOIN operators ON invoices.operator_id = operators.id
    WHERE invoices.id = ?
  `;

  db.query(query, [id], (err, result) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      res.status(500).send("Error fetching invoice");
      return;
    }
    if (result.length === 0) {
      res.status(404).send("Invoice not found");
      return;
    }
    res.json(result[0]);
  });
};

//New Add Invoice
/*
exports.addInvoice = async (req, res) => {
  const {
    created_at,
    updated_at,
    due_date,
    drive_id,
    company_id,
    operator_id,
    amount,
  } = req.body;

  // Validate if necessary fields are provided in the request body
  if (
    !created_at ||
    !updated_at ||
    !due_date ||
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
    (created_at, updated_at, due_date, drive_id, company_id, operator_id, amount) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    created_at,
    updated_at,
    due_date,
    drive_id,
    company_id,
    operator_id,
    amount,
  ];

  // Execute the query to insert the new invoice
  db.query(insertQuery, values, (err, results) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      return res.status(500).json({ message: "Error adding invoice" });
    }

    // Send a success response with the newly created invoice ID (if needed)
    return res.status(200).json({
      message: "Invoice added successfully",
      invoiceId: results.insertId, // Assuming you want to return the ID of the created invoice
    });
  });
};
*/
exports.addInvoice = async (req, res) => {
  const {
    created_at,
    updated_at,
    drive_id,
    company_id,
    operator_id,
    amount,
  } = req.body;

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

  // Execute the query to insert the new invoice
  db.query(insertQuery, values, (err, results) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      return res.status(500).json({ message: "Error adding invoice" });
    }

    // Send a success response with the newly created invoice ID (if needed)
    return res.status(200).json({
      message: "Invoice added successfully",
      invoiceId: results.insertId, // Assuming you want to return the ID of the created invoice
    });
  });
};

// Add Invoice
/*
exports.addInvoice = async (req, res) => {
  const { created_at, updated_at, due_date, status, drive_id } = req.body;

  // Fetch company_id and operator_id based on drive_id
  const fetchDetailsQuery = `
    SELECT 
      drives.company_id,
      drives.operator_id
    FROM drives
    WHERE drives.drive_id = ?
  `;

  db.query(fetchDetailsQuery, [drive_id], (err, results) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      res.status(500).send("Error fetching drive details");
      return;
    }

    if (results.length === 0) {
      // If no drive is found with the provided drive_id
      res.status(400).json({ message: "Invalid drive_id" });
      return;
    }

    const { company_id, operator_id } = results[0];

    // Insert the new invoice with company_id and operator_id
    const insertQuery =
      "INSERT INTO invoices (created_at, updated_at, due_date, status, drive_id, company_id, operator_id) VALUES (?, ?, ?, ?, ?, ?, ?)";
    const values = [
      created_at,
      updated_at,
      due_date,
      status,
      drive_id,
      company_id,
      operator_id,
    ];

    db.query(insertQuery, values, (err, results) => {
      if (err) {
        console.error("Error executing query: " + err.stack);
        res.status(500).send("Error adding invoice");
        return;
      }
      res.json({ message: "Invoice added successfully", id: results.insertId });
    });
  });
};
*/

// Update Invoice
exports.updateInvoice = async (req, res) => {
  const id = req.params.id;
  const { due_date, status } = req.body;

  const query = `UPDATE invoices 
                 SET due_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`;
  const values = [due_date, status, id];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      res.status(500).send("Error updating invoice");
      return;
    }
    if (result.affectedRows === 0) {
      res.status(404).send("Invoice not found");
      return;
    }
    res.json({ message: "Invoice updated successfully" });
  });
};

//Inoive and Drive Price
exports.updateInvoiceAndDrivePrice = async (req, res) => {
  const id = req.params.id;
  console.log("id", id);
  const { status, created_at, due_date, price, drive_id } = req.body;

  // Check if all required fields are present
  if (!status || !created_at || !due_date || price === undefined || !drive_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Generate current timestamp in ISO string format
  const currentTimestamp = new Date().toISOString();

  // Start a transaction to ensure both updates happen atomically
  db.beginTransaction(async (err) => {
    if (err) {
      console.error("Error starting transaction: " + err.stack);
      return res.status(500).json({ error: "Error starting transaction" });
    }

    try {
      // Update the invoice
      const updateInvoiceQuery = `
          UPDATE invoices 
          SET status = ?, created_at = ?, due_date = ?, updated_at = ? 
          WHERE id = ?
        `;
      const invoiceValues = [
        status,
        created_at,
        due_date,
        currentTimestamp,
        id,
      ];

      db.query(updateInvoiceQuery, invoiceValues, (err, invoiceResult) => {
        if (err) {
          throw err;
        }
        if (invoiceResult.affectedRows === 0) {
          return db.rollback(() => {
            res.status(404).json({ error: "Invoice not found" });
          });
        }

        // Update the price in the drives table using the provided drive_id
        const updateDrivePriceQuery = `
            UPDATE drives 
            SET price = ? 
            WHERE drive_id = ?
          `;
        const driveValues = [price, drive_id];

        db.query(
          updateDrivePriceQuery,
          driveValues,
          (err, drivePriceResult) => {
            if (err) {
              throw err;
            }
            if (drivePriceResult.affectedRows === 0) {
              return db.rollback(() => {
                res.status(404).json({ error: "Drive not found" });
              });
            }

            // Commit the transaction
            db.commit((err) => {
              if (err) {
                db.rollback(() => {
                  throw err;
                });
              }
              res.status(200).json({
                message: "Invoice and drive price updated successfully",
              });
            });
          }
        );
      });
    } catch (err) {
      // Rollback the transaction in case of an error
      db.rollback(() => {
        console.error("Error executing transaction: " + err.stack);
        res.status(500).json({
          error: err.message || "Error updating invoice and drive price",
        });
      });
    }
  });
};

//Update invoice with payment status of drive

// Invoice and Drive Payment Status
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
    operator_payment_date,
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

  // Start a transaction to ensure both updates happen atomically
  db.beginTransaction(async (err) => {
    if (err) {
      console.error("Error starting transaction: " + err.stack);
      return res.status(500).json({ error: "Error starting transaction" });
    }

    try {
      // Update the invoice
      db.query(updateInvoiceQuery, invoiceValues, (err, invoiceResult) => {
        if (err) {
          throw err;
        }
        if (invoiceResult.affectedRows === 0) {
          return db.rollback(() => {
            res.status(404).json({ error: "Invoice not found" });
          });
        }

        // Update the drive payment status in the drives table
        const updateDrivePaymentStatusQuery = `
          UPDATE drives 
          SET payment = ? 
          WHERE drive_id = ?
        `;
        const driveValues = [paymentField, drive_id];

        db.query(
          updateDrivePaymentStatusQuery,
          driveValues,
          (err, drivePaymentStatusResult) => {
            if (err) {
              throw err;
            }
            if (drivePaymentStatusResult.affectedRows === 0) {
              return db.rollback(() => {
                res.status(404).json({ error: "Drive not found" });
              });
            }

            // Commit the transaction
            db.commit((err) => {
              if (err) {
                db.rollback(() => {
                  throw err;
                });
              }
              res.status(200).json({
                message:
                  "Invoice and drive payment status updated successfully",
              });
            });
          }
        );
      });
    } catch (err) {
      // Rollback the transaction in case of an error
      db.rollback(() => {
        console.error("Error executing transaction: " + err.stack);
        res.status(500).json({
          error:
            err.message || "Error updating invoice and drive payment status",
        });
      });
    }
  });
};

// Delete Invoice
exports.deleteInvoice = async (req, res) => {
  const id = req.params.id;

  db.query(`DELETE FROM invoices WHERE id = ?`, [id], (err, result) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      res.status(500).send("Error deleting invoice");
      return;
    }
    if (result.affectedRows === 0) {
      res.status(404).send("Invoice not found");
      return;
    }
    res.json({ message: "Invoice deleted successfully" });
  });
};
