'use strict'

const router = require('express').Router();
const { Connection: conn } = require('../utils/Connection');
const lodash = require('lodash');
const { logger } = require('../utils/logger');

/*
*  Leaf info
*  POST
*  更新用户信息
*/
router.post('', (req, res) => {
    logger.info('Upsert leaf info', req.body);
    const { _id, ...data } = req.body


    conn.leavesCol.updateOne(
        {
            c: data.c
        },
        {
            $set: data
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
                errmsg: `cannot setup leaf info for id: ${data.c}`
            })
        });

});

/*
 *  Leaf info by id
 *  GET
 *  通过leaf id获取用户相关信息
*/
router.get('/c/:c', (req, res) => {
    const c = req.params.c;

    logger.info(`Req leaf info, c: ${c}`);

    conn.leavesCol.findOne(
        { c },
        (err, doc) => {
            if (err) {
                logger.error(`Query failed searching leaf, c: ${c}`);
                res.status(500).end();
            }
            if (doc) {
                res.json(doc);
            } else {
                res.status(404).end();
            }

        }
    )
});

/*
 *  Leaf pairing
 *  POST
 *  leaf和设备的配对
*/
router.post('/pair', (req, res) => {
    logger.info('Paring leaf and device', req.body);
    pairing(req, res);
});

async function pairing(req, res) {
    // in order to pair
    // 1. need to check leaf 
    //   a. whether exist. HACK: if doesn't exist, a new leaf will be generated
    //   b. whether c and name match, fail if doesn't match
    // 2. need to check device
    //   a. whether device exist. HACK: if doesn't exist, a new device will be generated
    //   b. whether org match, fail if org doesn't match
    const { c, name, deviceName } = req.body;

    // TODO: HACKED Default enforced to true
    const enforce = true;


    if (!c || !name || !deviceName) {
        res.status(400).json({
            errmsg: "Leaf info and Device name are both needed to pair"
        })
        return;
    }

    const leafPromise = conn.leavesCol.findOne({ c });
    const devicePromise = conn.devicesCol.findOne({ deviceName });
    const pairingPromise = conn.deviceLeafPairingsCol.findOne({ deviceName })
    try {
        let [leaf, device, pairing] = await Promise.all([leafPromise, devicePromise, pairingPromise]);

        // first of all check if leaf info is correct, leaf id matches name

        if (leaf && leaf.name !== name) {
            return res.status(400).json({ errmsg: "leaf name does not match id in record" })
        }

        // if device is paired
        if (pairing && pairing.c === c) { // if device is paired and with leaf in request
            res.end();
            return pairingCol.updateOne(
                {
                    deviceName
                },
                {
                    $set: {
                        disConnTs: null,
                        updateTs: new Date(),
                        status: "CONNECT"
                    }
                },
                {
                    upsert: true
                }
            );
        } else { // if leaf and device are not paired
            // if device is already connected and not enforced to change, quit
            if (pairing && (pairing.status === 'CONNECT' && !enforce)) {
                return res.status(400).json({ errmsg: "Device was already connected." })
            } else { // device is not connected or enforced to change
                // HACK: check if device and leaf already exist, if not create
                // create leaf
                if (!leaf) {
                    leaf = (await conn.leavesCol.insertOne({ c, name })).ops[0]
                }
                // create device
                if (!device) {
                    device = (await conn.devicesCol.insertOne({ deviceName })).ops[0]
                }
                // check if device and leaf both associated with org, but not in same org
                if (leaf.orgId && device.orgId && leaf.orgId !== device.orgId) {
                    // quit since not in same org
                    return res.status(400).json({ errmsg: "Device and leaf are not in same org" })
                } else { // no conflict in org, can connect
                    res.end();
                    conn.deviceLeafPairingsCol.updateOne(
                        {
                            deviceName
                        },
                        {
                            $set: {
                                c,
                                connTs: new Date(),
                                updateTs: new Date(),
                                status: "CONNECT"
                            }
                        },
                        {
                            upsert: true
                        }
                    );
                    conn.devicesCol.updateOne({ deviceName }, { $set: { c } }, { upsert: true })
                }
            }
            res.end();
        }
    } catch (error) {
        logger.error(`Failed pairing device ${deviceName} and leaf ${c}`, error);
        res.status(500).end();
    }

}

/*
 *  Leaves by org id
 *  GET
 *  获取机构所有用户信息
*/
router.get('/bulk/org/:orgId', (req, res) => {
    const orgId = req.params.orgId;
    logger.info(`Req bulk leaves of org: ${orgId}`);

    conn.leavesCol.find({ orgId })
        .toArray()
        .then(docs => {
            res.json(docs)
        })
        .catch(err => {
            if (err) {
                logger.error(`Query failed leaves, org id: ${orgId}`);
                res.status(500).end();
            }
        })
});

module.exports = router;