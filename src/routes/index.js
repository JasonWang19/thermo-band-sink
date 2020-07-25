const express = require('express');
const router = express.Router();

router.use('/users', require('./users'));
router.use('/records', require('./records'))

module.exports = router;