const db = require('../index');

// Retrieve a drive
exports.getEvents = async(req, res) => {

    const id = req.params.id;
    db.query(`SELECT * FROM calenders where driver_id = ${id}`, (err, results) => {
        if (err) {
          console.error('Error executing query: ' + err.stack);
          res.status(500).send('Error fetching users');
          return;
        }
        res.status(200).send(results); 
      });
};

// Add a drive 
exports.addEvent = async (req, res) => {
  const { driver_id, type, start, end } = req.body;

  console.log('New Event - Start:', start, 'End:', end);

  // Check for overlapping events in UTC
  const checkOverlapQuery = `
    SELECT * FROM calenders
    WHERE driver_id = ${driver_id} AND (start < ? AND end > ?)
  `;
  db.query(checkOverlapQuery, [end, start], (err, results) => {
    if (err) {
      console.error('Error executing query:', err.stack);
      res.status(500).send('Error checking events');
      return;
    }

    console.log('Overlap Check Results:', results);

    if (results.length > 0) {
      res.status(400).send('An overlapping event already exists');
      return;
    }

    // Insert the new event in UTC
    const insertEventQuery = `
      INSERT INTO calenders (driver_id, type, start, end)
      VALUES (?, ?, ?, ?)
    `;
    db.query(insertEventQuery, [driver_id, type, start, end], (err, results) => {
      if (err) {
        console.error('Error executing query:', err.stack);
        res.status(500).send('Error adding event');
        return;
      }
      res.json(results);
    });
  });
};


// Edit a drive
exports.editEvent = async(req, res) => {
    // Your code to edit a drive by ID goes 
    const id = req.params.id;
    const { driver_id, type, start, end } = req.body;

    const checkOverlapQuery = `
    SELECT * FROM calenders
    WHERE driver_id = ${driver_id} AND (start < ? AND end > ?)
  `;
  db.query(checkOverlapQuery, [end, start], (err, results) => {
    if (err) {
      console.error('Error executing query:', err.stack);
      res.status(500).send('Error checking events');
      return;
    }

    console.log('Overlap Check Results:', results);

    if (results.length > 0) {
      res.status(400).send('An overlapping event already exists');
      return;
    }

    // Insert the new event in UTC
    db.query(`UPDATE calenders SET driver_id = ${driver_id}, type = '${type}', start = '${start}', end = '${end}' WHERE id = ${id}`, (err, results) => {
      if (err) {
        console.error('Error executing query: ' + err.stack);
        res.status(500).send('Error fetching users');
        return;
      }
      res.status(200).send(results);
    });
  });

};

exports.deleteEvent = async(req, res) => {
    const id = req.params.id;
    db.query(`DELETE FROM calenders WHERE id = ${id}`, (err, results) => {
        if (err) {
          console.error('Error executing query: ' + err.stack);
          res.status(500).send('Error fetching users');
          return;
        }
        res.status(200).send(results);
      });
}
