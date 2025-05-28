const db = require("../index");

// Get all credentials
exports.getAllCredentials = async (req, res) => {
  db.query("SELECT * FROM invoice_credentials", (err, results) => {
    if (err) {
      console.error("Error executing query:", err.stack);
      res.status(500).send("Error fetching credentials");
      return;
    }
    res.json(results);
  });
};

// Get a credential by ID
exports.getCredentialById = async (req, res) => {
  const id = req.params.id;
  console.log("Credential ID:", id);

  db.query(
    "SELECT * FROM invoice_credentials WHERE credential_id = ?",
    [id],
    (err, results) => {
      if (err) {
        console.error("Error executing query:", err.stack);
        res.status(500).send("Error fetching credential");
        return;
      }
      if (results.length === 0) {
        res.status(404).send("Credential not found");
        return;
      }
      res.json(results[0]);
    }
  );
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

  db.query(query, values, (err, results) => {
    if (err) {
      console.error("Error executing query:", err.stack);
      res.status(500).send("Error adding credential");
      return;
    }
    res.json({
      message: "Credential added successfully",
      id: results.insertId,
    });
  });
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

  // Execute the query
  db.query(query, values, (err, results) => {
    if (err) {
      console.error("Error executing query:", err.stack);
      return res.status(500).json({ error: "Error updating credential" });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Credential not found" });
    }

    res.json({ message: "Credential updated successfully" });
  });
};

// Delete a credential
exports.deleteCredential = async (req, res) => {
  const { id } = req.params;

  db.query(
    "DELETE FROM invoice_credentials WHERE credential_id = ?",
    [id],
    (err, results) => {
      if (err) {
        console.error("Error executing query:", err.stack);
        return res.status(500).json({ error: "Error deleting credential" });
      }

      if (results.affectedRows === 0) {
        return res.status(404).json({ error: "Credential not found" });
      }

      res.json({ message: "Credential deleted successfully" });
    }
  );
};
