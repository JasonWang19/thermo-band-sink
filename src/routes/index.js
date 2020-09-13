const express = require('express');
const router = express.Router();

router.use('/users', require('./users'));
router.use('/records', require('./records'))
router.use('/staff', require('./staffs'))
router.use('/staffs', require('./staffs'))
router.use('/orgstruct', require('./orgStruct'))

module.exports = router;