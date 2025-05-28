const db = require("../index");
const { Op } = require("sequelize");

// Get all filters
exports.getAllFilters = async (req, res) => {
  db.query("SELECT * FROM Filters", (err, results) => {
    if (err) {
      console.error("Error executing query:", err.stack);
      res.status(500).send("Error fetching filters");
      return;
    }
    res.status(200).json(results);
  });
};

// Get a filter by ID
exports.getFilterById = async (req, res) => {
  const id = req.params.id;
  console.log("Filter ID:", id);

  db.query("SELECT * FROM Filters WHERE id = ?", [id], (err, results) => {
    if (err) {
      console.error("Error executing query:", err.stack);
      res.status(500).send("Error fetching filter");
      return;
    }
    if (results.length === 0) {
      res.status(404).send("Filter not found");
      return;
    }
    res.json(results[0]);
  });
};

// Add a new filter
/*
//Filter addition and company coulmn added
exports.addFilter = async (req, res) => {
  const { name, label, type, options } = req.body;

  // Validate required fields
  if (!name || !label || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const query = 'INSERT INTO Filters (name, label, type, options) VALUES (?, ?, ?, ?)';
  const values = [name, label, type, options];

  db.query(query, values, (err, results) => {
    if (err) {
      console.error('Error executing query:', err.stack);
      res.status(500).send('Error adding filter');
      return;
    }
    res.json({ message: 'Filter added successfully', id: results.insertId });
  });
};
*/

/*
exports.addFilter = async (req, res) => {
  const { name, label, type, options } = req.body;

  // Validate required fields
  if (!name || !label || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Begin a transaction
  db.beginTransaction(err => {
    if (err) {
      console.error('Error starting transaction:', err.stack);
      return res.status(500).json({ error: 'Error starting transaction' });
    }

    // Insert the new filter into the Filters table
    const insertQuery = 'INSERT INTO Filters (name, label, type, options) VALUES (?, ?, ?, ?)';
    const insertValues = [name, label, type, options];

    db.query(insertQuery, insertValues, (insertErr, insertResults) => {
      if (insertErr) {
        console.error('Error executing insert query:', insertErr.stack);
        return db.rollback(() => {
          res.status(500).json({ error: 'Error adding filter' });
        });
      }

      // Construct the ALTER TABLE query to add the new column to the Companies table
      const alterQuery = `ALTER TABLE companies ADD COLUMN ${name} ${type === "NumberField" ? "BIGINT" : type === "DateTimePicker" ? "DATETIME" : "VARCHAR(255)"} DEFAULT NULL`;

      db.query(alterQuery, (alterErr) => {
        if (alterErr) {
          console.error('Error executing alter query:', alterErr.stack);
          return db.rollback(() => {
            res.status(500).json({ error: 'Error adding column to Companies table' });
          });
        }

        // Commit the transaction
        db.commit(commitErr => {
          if (commitErr) {
            console.error('Error committing transaction:', commitErr.stack);
            return db.rollback(() => {
              res.status(500).json({ error: 'Error committing transaction' });
            });
          }

          res.json({ message: 'Filter added successfully', id: insertResults.insertId });
        });
      });
    });
  });
};
*/

// Update an existing filter
/*
exports.updateFilter = async (req, res) => {
  const { id } = req.params;
  const { name, label, type, options } = req.body;

  // Validate required fields
  if (!name || !label || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const query = `
    UPDATE Filters
    SET name = ?,
        label = ?,
        type = ?,
        options = ?
    WHERE id = ?
  `;
  const values = [name, label, type, options, id];

  db.query(query, values, (err, results) => {
    if (err) {
      console.error('Error executing query:', err.stack);
      return res.status(500).json({ error: 'Error updating filter' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Filter not found' });
    }

    res.json({ message: 'Filter updated successfully' });
  });
};
*/

//New add filter for company and request field too
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

  db.beginTransaction((err) => {
    if (err) {
      console.error("Error starting transaction:", err.stack);
      return res.status(500).json({ error: "Error starting transaction" });
    }

    const insertQuery =
      "INSERT INTO Filters (name, label, type, options) VALUES (?, ?, ?, ?)";
    const insertValues = [name, label, type, options];

    db.query(insertQuery, insertValues, (insertErr, insertResults) => {
      if (insertErr) {
        console.error("Error executing insert query:", insertErr.stack);
        return db.rollback(() => {
          res.status(500).json({ error: "Error adding filter" });
        });
      }

      const alterCompaniesQuery = `ALTER TABLE companies ADD COLUMN ${escapedName} ${
        type === "NumberField"
          ? "BIGINT"
          : type === "DateTimePicker"
          ? "DATETIME"
          : "TEXT"
      } DEFAULT NULL`;

      db.query(alterCompaniesQuery, (alterCompaniesErr) => {
        if (alterCompaniesErr) {
          console.error(
            "Error executing alter query on companies table:",
            alterCompaniesErr.stack
          );
          return db.rollback(() => {
            res
              .status(500)
              .json({ error: "Error adding column to Companies table" });
          });
        }

        const alterDriveRequestsQuery = `ALTER TABLE driveRequests ADD COLUMN ${escapedName} ${
          type === "NumberField"
            ? "BIGINT"
            : type === "DateTimePicker"
            ? "DATETIME"
            : "TEXT"
        } DEFAULT NULL`;

        db.query(alterDriveRequestsQuery, (alterDriveRequestsErr) => {
          if (alterDriveRequestsErr) {
            console.error(
              "Error executing alter query on driveRequests table:",
              alterDriveRequestsErr.stack
            );
            return db.rollback(() => {
              res
                .status(500)
                .json({ error: "Error adding column to driveRequests table" });
            });
          }

          // Add column to drives table
          const alterDrivesQuery = `ALTER TABLE drives ADD COLUMN ${escapedName} ${
            type === "NumberField"
              ? "BIGINT"
              : type === "DateTimePicker"
              ? "DATETIME"
              : "TEXT"
          } DEFAULT NULL`;

          db.query(alterDrivesQuery, (alterDrivesErr) => {
            if (alterDrivesErr) {
              console.error(
                "Error executing alter query on drives table:",
                alterDrivesErr.stack
              );
              return db.rollback(() => {
                res
                  .status(500)
                  .json({ error: "Error adding column to drives table" });
              });
            }

            db.commit((commitErr) => {
              if (commitErr) {
                console.error("Error committing transaction:", commitErr.stack);
                return db.rollback(() => {
                  res
                    .status(500)
                    .json({ error: "Error committing transaction" });
                });
              }

              res.json({
                message: "Filter added successfully",
                id: insertResults.insertId,
              });
            });
          });
        });
      });
    });
  });
};

exports.updateFilter = async (req, res) => {
  const { id } = req.params;
  const { name, label, type, options } = req.body;

  if (!name || !label || !type) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const optionsValue = options || null;

  db.beginTransaction(async (err) => {
    if (err) {
      console.error("Error starting transaction:", err);
      return res.status(500).json({ error: "Error starting transaction" });
    }

    try {
      const fetchFilterQuery = "SELECT * FROM Filters WHERE id = ?";
      db.query(fetchFilterQuery, [id], (error, results) => {
        if (error) {
          throw error;
        }

        const currentFilter = results[0];
        if (!currentFilter) {
          throw new Error("Filter not found");
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
        db.query(
          updateFilterQuery,
          [name, label, type, optionsValue, id],
          (error) => {
            if (error) {
              throw error;
            }

            if (name !== currentName || updatedType !== currentType) {
              const alterCompaniesQuery = `
              ALTER TABLE companies CHANGE COLUMN \`${currentName}\` \`${name}\` ${updatedType}`;
              db.query(alterCompaniesQuery, (error) => {
                if (error) {
                  throw error;
                }

                const alterDriveRequestsQuery = `
                ALTER TABLE driveRequests CHANGE COLUMN \`${currentName}\` \`${name}\` ${updatedType}`;
                db.query(alterDriveRequestsQuery, (error) => {
                  if (error) {
                    throw error;
                  }

                  // Add column change for drives table
                  const alterDrivesQuery = `
                  ALTER TABLE drives CHANGE COLUMN \`${currentName}\` \`${name}\` ${updatedType}`;
                  db.query(alterDrivesQuery, (error) => {
                    if (error) {
                      throw error;
                    }

                    db.commit((commitErr) => {
                      if (commitErr) {
                        throw commitErr;
                      }
                      res.json({
                        message:
                          "Filter and related tables updated successfully",
                      });
                    });
                  });
                });
              });
            } else {
              db.commit((commitErr) => {
                if (commitErr) {
                  throw commitErr;
                }
                res.json({
                  message: "Filter updated successfully",
                });
              });
            }
          }
        );
      });
    } catch (error) {
      db.rollback(() => {
        console.error("Error updating filter and related tables:", error.stack);
        res.status(500).json({ error: error.message });
      });
    }
  });
};

//Delete filters with compnay and driveRequests Table
exports.deleteFilter = async (req, res) => {
  const { id } = req.params;

  db.beginTransaction(async (err) => {
    if (err) {
      console.error("Error starting transaction:", err.stack);
      return res.status(500).json({ error: "Error starting transaction" });
    }

    try {
      const filterResults = await executeQuery(
        "SELECT name FROM Filters WHERE id = ?",
        [id]
      );
      if (filterResults.length === 0) {
        return db.rollback(() => {
          res.status(404).json({ error: "Filter not found" });
        });
      }
      const filterName = filterResults[0].name;
      const escapedName = `\`${filterName}\``;

      const deleteResults = await executeQuery(
        "DELETE FROM Filters WHERE id = ?",
        [id]
      );
      if (deleteResults.affectedRows === 0) {
        return db.rollback(() => {
          res.status(404).json({ error: "Filter not found" });
        });
      }

      const alterCompaniesQuery = `ALTER TABLE companies DROP COLUMN ${escapedName}`;
      await executeQuery(alterCompaniesQuery);

      const alterDriveRequestsQuery = `ALTER TABLE driveRequests DROP COLUMN ${escapedName}`;
      await executeQuery(alterDriveRequestsQuery);

      // Add drop column for drives table
      const alterDrivesQuery = `ALTER TABLE drives DROP COLUMN ${escapedName}`;
      await executeQuery(alterDrivesQuery);

      db.commit((commitErr) => {
        if (commitErr) {
          console.error("Error committing transaction:", commitErr.stack);
          return db.rollback(() => {
            res.status(500).json({ error: "Error committing transaction" });
          });
        }

        res.json({ message: "Filter deleted successfully" });
      });
    } catch (error) {
      console.error("Error executing query:", error.stack);
      db.rollback(() => {
        res.status(500).json({ error: "Error deleting filter" });
      });
    }
  });
};

// Utility function to execute queries with promises
function executeQuery(query, params) {
  return new Promise((resolve, reject) => {
    db.query(query, params, (error, results) => {
      if (error) {
        return reject(error);
      }
      resolve(results);
    });
  });
}

//Delete filters with the compnay columns
/*

const executeQuery = (query, params) => {
  return new Promise((resolve, reject) => {
    db.query(query, params, (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

exports.deleteFilter = async (req, res) => {
  const { id } = req.params;

  // Begin a transaction
  db.beginTransaction(async (err) => {
    if (err) {
      console.error('Error starting transaction:', err.stack);
      return res.status(500).json({ error: 'Error starting transaction' });
    }

    try {
      // Get the filter name to determine which column to delete
      const filterResults = await executeQuery('SELECT name FROM Filters WHERE id = ?', [id]);
      if (filterResults.length === 0) {
        return db.rollback(() => {
          res.status(404).json({ error: 'Filter not found' });
        });
      }
      const filterName = filterResults[0].name;

      // Delete the filter from the Filters table
      const deleteResults = await executeQuery('DELETE FROM Filters WHERE id = ?', [id]);
      if (deleteResults.affectedRows === 0) {
        return db.rollback(() => {
          res.status(404).json({ error: 'Filter not found' });
        });
      }

      // Construct the ALTER TABLE query to drop the column from the Companies table
      const alterQuery = `ALTER TABLE companies DROP COLUMN ${filterName}`;

      await executeQuery(alterQuery);

      // Commit the transaction
      db.commit((commitErr) => {
        if (commitErr) {
          console.error('Error committing transaction:', commitErr.stack);
          return db.rollback(() => {
            res.status(500).json({ error: 'Error committing transaction' });
          });
        }

        res.json({ message: 'Filter deleted successfully' });
      });
    } catch (error) {
      console.error('Error executing query:', error.stack);
      db.rollback(() => {
        res.status(500).json({ error: 'Error deleting filter' });
      });
    }
  });
};
*/
// Delete a filter
/*
exports.deleteFilter = async (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM Filters WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error executing query:', err.stack);
      return res.status(500).json({ error: 'Error deleting filter' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Filter not found' });
    }

    res.json({ message: 'Filter deleted successfully' });
  });
};
*/
