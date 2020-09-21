'use strict'

const router = require('express').Router();
const { Connection: conn } = require('../utils/Connection');
const lodash = require('lodash');
const { logger } = require('../utils/logger');

/*
 *  Device info
 *  POST
 *  更新手环相关信息
*/
router.post('', (req, res) => {
    logger.info(`Upsert device info`, req.body);
    const data = req.body;
    const deviceName = data.deviceName;

    conn.devicesCol.updateOne(
        {
            deviceName
        },
        {
            $set: {
                ...data
            }
        },
        {
            upsert: true
        }
    )
        .then(result => {
            res.json(data);
        })
        .catch(err => {
            console.error('err', err);
            res.status(400).json({
                errmsg: `cannot setup device info for device id: ${deviceId}`
            })
        });

});

/*
 *  Devices info bulk
 *  POST
 *  批量更新手环相关信息
*/
router.post('/bulk', (req, res) => {
    logger.info('Bulk upser devices info', req.body);
    const data = req.body;
    const bulk = conn.devicesCol.initializeUnorderedBulkOp();

    for (let d of data) {
        bulk.find({ deviceId: d.deviceId }).upsert().updateOne({ $set: d });
    }

    bulk.execute()
        .then(results => {
            console.log(JSON.stringify(results));
            res.json(data);
        })
        .catch(err => {
            console.error('err', err);
            res.status(400).json({
                errmsg: `cannot setup device info for device id: ${deviceId}`
            })
        });

});

/*
 *  Device info
 *  GET
 *  获取手环相关信息
*/
router.get('/name/:deviceName', (req, res) => {
    const deviceName = req.params.deviceName;

    logger.info(`Req device info, device name: ${deviceName}`);
    conn.devicesCol.findOne({
        deviceName
    },
        (err, doc) => {
            if (err) {
                logger.error(`Query failed searching device, device name: ${deviceName}`, err);

                // TODO set error response
                res.status(500).end();
            }
            if (doc) {
                res.json(doc);
            } else {
                res.status(404).end();
            }

        })
});

/*
 *  All Device info
 *  GET
 *  获取所有手环相关信息
*/
router.get('/bulk', (req, res) => {

    // TODO add query criteria

    logger.info('Req all devices info');
    conn.devicesCol.find({}).toArray()
        .then(docs => {
            if (lodash.isEmpty(docs)) {
                res.status(404).end();
            } else {
                res.json(docs);
            }
        })
        .catch(err => {
            logger.error('Query failed info of all devices', err);
            res.status(500).end();
        })
});

module.exports = router;