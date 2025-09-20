const express = require('express');
const { createSampleCMDB } = require('../models/sampleData');

const router = express.Router();

// Load sample data
router.post('/sample-data', async (req, res) => {
  try {
    await createSampleCMDB();
    res.json({ message: 'Sample CMDB data loaded successfully' });
  } catch (error) {
    console.error('Error loading sample data:', error);
    res.status(500).json({ error: 'Failed to load sample data' });
  }
});

module.exports = router;