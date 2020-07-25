'use strict'

const router = require('express').Router();
const { Connection: conn } = require('../utils/Connection');

/* 
 *  Records 
 *  保存历史数据
*/
router.post('/', (req, res) => {
    const data = req.body;
    console.log("request body", data);

    // backward compatible
    const filterBase = data.n
        ? {
            n: data.n
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
*  Records
*  GET 
*  获取历史数据
*/
router.get('/c/:c', (req, res) => {
    getHistoryRecords('c', req, res);
});

/*
*  Records
*  GET 
*  获取历史数据
*/
router.get('/i/:i', (req, res) => {
    getHistoryRecords('i', req, res);

});

const getHistoryRecords = (param, req, res) => {
    const id = req.params[param];
    const current = new Date();
    const startTs = req.query.from ? new Date(parseInt(req.query.from)) : new Date(current - DEFAULT_QUERY_INTERVAL);
    const endTs = req.query.to ? new Date(parseInt(req.query.to)) : current;
    console.log(`Request records for ${param} id: `, id, startTs, endTs);

    conn.dataHistoriesCol.find({
        [param]: id,
        ts: { $gte: startTs, $lt: endTs }
    }).toArray((err, docs) => {
        if (err) {
            res.status(500).end();
            return;
        }
        if (isEmptyArray(docs)) {
            res.status(404).end();
            return;
        }
        res.json({
            c: docs[0].c,
            i: docs[0].i,
            r: docs.map(doc => {
                return {
                    ts: new Date(doc.ts).getTime(),
                    ti: doc.ti,
                    ta: doc.ta
                }
            })
        });
    });
}
module.exports = router;