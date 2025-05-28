const db = require('../index');

// Add a new FAQ
exports.addFaq = async (req, res) => {
  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const query = 'INSERT INTO faq (question, answer) VALUES (?, ?)';
  const values = [question, answer];

  db.query(query, values, (err, results) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      return res.status(500).json({ error: 'Error adding FAQ' });
    }

    res.json({ message: 'FAQ added successfully', faqId: results.insertId });
  });
};

// Retrieve all FAQs
exports.getFaqs = async (req, res) => {
  db.query('SELECT * FROM faq', (err, results) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      return res.status(500).json({ error: 'Error fetching FAQs' });
    }

    res.json(results);
  });
};

// Retrieve a single FAQ by ID
exports.getFaqById = async (req, res) => {
  const id = req.params.id;

  db.query('SELECT * FROM faq WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      return res.status(500).json({ error: 'Error fetching FAQ' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'FAQ not found' });
    }

    res.json(results[0]);
  });
};

// Update an FAQ by ID
exports.updateFaq = async (req, res) => {
  const { id } = req.params;
  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const query = 'UPDATE faq SET question = ?, answer = ? WHERE id = ?';
  const values = [question, answer, id];

  db.query(query, values, (err, results) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      return res.status(500).json({ error: 'Error updating FAQ' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'FAQ not found' });
    }

    res.json({ message: 'FAQ updated successfully' });
  });
};

// Delete an FAQ by ID
exports.deleteFaq = async (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM faq WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('Error executing query: ' + err.stack);
      return res.status(500).json({ error: 'Error deleting FAQ' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'FAQ not found' });
    }

    res.json({ message: 'FAQ deleted successfully' });
  });
};
