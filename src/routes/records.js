'use strict'

const router = require('express').Router();
const { Connection: conn } = require('../utils/Connection');
const lodash = require('lodash');

// constants
const DEFAULT_QUERY_INTERVAL = 7 * 24 * 3600 * 1000;


/* 
 *  Records 
 *  保存历史数据
*/
router.post('', (req, res) => {
    const data = req.body;
    console.log("request body", data);

    // backward compatible
    const filterBase = data.n
        ? {
            n: data.n,
            c: data.c
        }
        : {
            i: data.i
        };


    const updates = [];
    let maxTs = -1;
    for (let r of data.r) {
        maxTs = Math.max(maxTs, r.ts);
        const ts = new Date(r.ts);
        updates.push(conn.dataHistoriesCol.updateOne(
            {
                ...filterBase,
                ts,
            },
            {
                $setOnInsert: {
                    ...filterBase,
                    ...r,
                    ts
                }
            },
            {
                upsert: true
            }
        ))
    }

    Promise.all(updates)
        .then(results => {
            console.log("results", results);
            res.send({
                ts: maxTs,
                v: data.v
            });
        })
        .catch(err => {
            console.error(err);
            res.status(400);
        })
});

/*
*  Records by user id
*  GET 
*  获取历史数据
*/
router.get('', (req, res) => {
    const param = {}
    if (req.query.c) {
        param['c'] = req.query.c;
    }
    if (req.query.n) {
        param['n'] = req.query.n;
    }
    getHistoryRecords(param, req, res);
});

/*
*  deprecated due to device id is different between ios and android
*  Records by device id 
*  GET 
*  获取历史数据
*/
router.get('/i/:i', (req, res) => {
    getHistoryRecords({
        i: req.params.i
    }, req, res);

});

const getHistoryRecords = (param, req, res) => {

    const current = new Date();
    // TODO determine if limit on time range needed?
    // const startTs = req.query.from ? new Date(parseInt(req.query.from)) : new Date(current.getTime() - DEFAULT_QUERY_INTERVAL);
    // const endTs = req.query.to ? new Date(parseInt(req.query.to)) : current;
    const startTs = req.query.from ? new Date(parseInt(req.query.from)) : null;
    const endTs = req.query.to ? new Date(parseInt(req.query.to)) : current;
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    const skip = req.query.skip ? parseInt(req.query.skip) : 0;
    console.log(`Request records for: ${JSON.stringify(param)}, start: ${startTs}, end: ${endTs}`);

    let ts = { $lt: endTs };
    if (startTs) {
        ts = {
            ...ts,
            $gt: startTs,
        }
    }
    const query = {
        ...param,
        ts
    };


    let find = conn.dataHistoriesCol.find(query);

    if (lodash.isEmpty(param)) {
        find = find.sort({ ts: -1 })
    }
    if (skip > 0) {
        find = find.skip(skip);
    }
    find = find.limit(limit);

    find.toArray((err, docs) => {
        if (err) {
            throw err;
        }
        // if (lodash.isEmpty(docs)) {
        //     res.status(404).end();
        //     return;
        // }

        const r =
            docs.map(doc => {
                return {
                    c: doc.c,
                    n: doc.n,
                    ts: new Date(doc.ts).getTime(),
                    ti: doc.ti,
                    ta: doc.ta
                }
            });

        res.json({
            ...param,
            limit,
            skip,
            r
        });
    });
}
module.exports = router;