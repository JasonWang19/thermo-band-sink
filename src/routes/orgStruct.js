'use strict'

const router = require('express').Router();
const { Connection: conn } = require('../utils/Connection');
const lodash = require('lodash');
const { logger } = require('../utils/logger');

/*
 *  Bulk Org structure info
 *  POST
 *  批量更新机构人员架构相关信息
*/
router.post('/org', (req, res) => {
    logger.info('Upsert org structure info', req.body);
    let data = req.body;
    const orgId = data.orgId;

    const promises = Object.entries(data.structs).map(e => {
        const staffId = e[0];
        return conn.orgStructsCol.updateOne(
            { orgId, staffId },
            { $set: e[1] },
            { upsert: true }
        );
    })

    Promise.all(promises)
        .then(results => {
            res.json(data);
        })
        .catch(err => {
            console.error('err', err);
            res.status(400).json({
                errmsg: `cannot setup org info for org id: ${orgId}`
            })
        });

});

/*
 *  Bulk Org structure info
 *  POST
 *  批量更新机构人员架构相关信息
*/
router.post('/', (req, res) => {
    console.log('Request for update org structure information: ', req.body);
    let data = req.body;

    const bulk = conn.orgStructsCol.initializeUnorderedBulkOp();

    for (let d of data) {
        const { _id, ...upd } = d
        bulk.find({ orgId: d.orgId, staffId: d.staffId }).upsert().updateOne({ $set: upd });
    }

    bulk.execute()
        .then(results => {
            console.log(JSON.stringify(results));
            res.json(null);
        })
        .catch(err => {
            console.error('err', err);
            res.status(400).json({
                errmsg: `cannot bulk update org struct`
            })
        });

});

/*
 *  Org structure by id
 *  GET
 *  通过Org ID获取机构人员架构信息
*/
router.get('/org/:orgId', (req, res) => {
    logger.info(`Req org structure, org id: ${req.params.orgId}`);

    const orgId = req.params.orgId;

    conn.orgStructsCol.find({ orgId }).toArray()
        .then(
            docs => {
                res.json(docs);
                // if (!isEmptyArray(docs)) {
                //     res.json(docs);
                // } else {
                //     res.status(404).end();
                // }
            })
        .catch(err => {
            console.error('Query failed when extract org via org id:', orgId);
            res.status(500).end();
        })

});

/*
 *  Org structure by id
 *  GET
 *  通过Org ID获取机构人员架构信息
*/
router.get('/org/:orgId/staff/:staffId', (req, res) => {
    console.log('Req for obtain org information: ', req.params.orgId);

    const orgId = req.params.orgId;


    conn.orgStructsCol.findOne(
        { orgId },
        (err, doc) => {
            if (err) {
                console.error('Query failed when extract org via org id:', orgId);
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

module.exports = router;