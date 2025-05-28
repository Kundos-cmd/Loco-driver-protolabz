const db = require("../../index");

exports.getDriverByID = async (req, res) => {
  const id = req.params.id;

  db.query(`SELECT * FROM drivers WHERE id= ${id}`, (err, result) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      res.status(500).send("Error fetching users");
      return;
    }
    res.json(result);
  });
};

exports.getDrivesByDriverID = async (req, res) => {
  const id = req.params.id;

  db.query(`SELECT * FROM drives WHERE driver_id= ${id}`, (err, result) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      res.status(500).send("Error fetching users");
      return;
    }
    res.json(result);
  });
};

exports.getCompanies = async (req, res) => {
  db.query(`SELECT * FROM companies WHERE total_drivers > 0`, (err, result) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      res.status(500).send("Error fetching users");
      return;
    }
    res.json(result);
  });
};

exports.getDrivers = async (req, res) => {
  db.query(`SELECT * FROM drivers`, (err, result) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      res.status(500).send("Error fetching users");
      return;
    }
    res.json(result);
  });
};

exports.addDriver = async (req, res) => {
  const currentDate = new Date();
  const formattedDate = currentDate.toISOString().split("T")[0];

  const driverData = {
    ...req.body,
    date_joined: formattedDate,
  };

  try {
    // Check if the email already exists in the database
    const query = "SELECT * FROM drivers WHERE email = ?";
    db.query(query, [driverData.email], (err, results) => {
      if (err) {
        console.error("Error executing query: " + err.stack);
        res.status(500).send(`Error ${err}`);
        return;
      }

      if (results.length > 0) {
        // Email already exists
        res.status(400).send("Driver with this email already exists");
      } else {
        // Insert new driver
        db.query("INSERT INTO drivers SET ?", driverData, (err, results) => {
          if (err) {
            console.error("Error executing query: " + err.stack);
            res.status(500).send("Error adding driver");
            return;
          }
          res.json(results);
        });
      }
    });
  } catch (error) {
    console.error("Unexpected error: ", error);
    res.status(500).send("An unexpected error occurred");
  }
};

exports.updateDriver = async (req, res) => {
  const driverId = req.params.driverId; // Extract driver ID from params
  const { name, email, age, rating, experienceYears, locations } = req.body; // Destructure fields from request body

  // Validate locations as an array
  if (!Array.isArray(locations)) {
    return res.status(400).json({ message: "Locations must be an array" });
  }

  const query = `
    UPDATE drivers 
    SET 
      name = ?, 
      email = ?, 
      age = ?, 
      rating = ?, 
      experienceYears = ?, 
      locations = ? 
    WHERE id = ?
  `;

  const values = [
    name,
    email,
    age,
    rating,
    experienceYears,
    JSON.stringify(locations), // Convert array to JSON string
    driverId,
  ];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      return res.status(500).json({ message: "Error updating driver" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Driver not found" });
    }
    res.json({ message: "Driver updated successfully" });
  });
};

exports.getDriversByCompanyID = async (req, res) => {
  const companyId = req.params.id; // Extract company ID from request parameters

  // SQL query to get drivers by company ID
  const query = `SELECT * FROM drivers WHERE company_id = ?`;

  db.query(query, [companyId], (err, result) => {
    if (err) {
      console.error("Error executing query: " + err.stack);
      res.status(500).send("Error fetching drivers by company ID");
      return;
    }
    res.json(result);
  });
};
