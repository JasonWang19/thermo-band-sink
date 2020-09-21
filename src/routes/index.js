const express = require('express');
const router = express.Router();

router.use('/users', require('./users'));
router.use('/records', require('./records'))
router.use('/staff', require('./staff'))
router.use('/orgstruct', require('./orgStruct'))
router.use('/device', require('./device'))
router.use('/leaf', require('./leaf'))

module.exports = router;