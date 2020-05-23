'use strict';

const express = require('express');
const bodyParser = require('body-parser')
const { MongoClient, ObjectID } = require('mongodb');
const axios = require('axios');

const app = express();

// env
const dbUrl = process.env.DB_URL;
const dbName = process.env.DB_NAME;
const PORT = process.env.PORT;
const wxUrl = process.env.WX_URL;
const appId = process.env.WX_APP_ID;
const appSecret = process.env.WX_SECRET;

// collection names
const dataHistories = 'data_histories';
const userInfos = 'user_infos';
const devices = 'devices';
const orgs = 'orgs';
const staffs = 'staffs';

// constants
const DEFAULT_QUERY_INTERVAL = 2 * 3600 * 1000;

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

// utility function
const isEmptyArray = arr => {
    return !(Array.isArray(arr) && arr.length);
}


MongoClient.connect(dbUrl, { useUnifiedTopology: true })
    .then(client => {
        console.log("Connected successfully to DB");
        const db = client.db(dbName);
        const dataHistoriesCol = db.collection(dataHistories);
        const userInfosCol = db.collection(userInfos);
        const devicesCol = db.collection(devices);
        const orgsCol = db.collection(orgs);
        const staffsCol = db.collection(staffs);

        /* 
         *  Records 
         *  保存历史数据
        */
        app.post('/records', (req, res) => {
            const data = req.body;
            console.log("request body", data);
            const filterBase = {
                i: data.i,
                c: data.c
            };

            const updates = [];
            let maxTs = -1;
            for (let r of data.r) {
                maxTs = Math.max(maxTs, r.ts);
                const ts = new Date(r.ts);
                updates.push(dataHistoriesCol.updateOne(
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
            // res.status(500).send('internal error');
        });

        /*
        *  Records
        *  GET 
        *  获取历史数据
       */
        app.get('/records/c/:c', (req, res) => {
            getHistoryRecords('c', req, res);
        });

        /*
        *  Records
        *  GET 
        *  获取历史数据
       */
        app.get('/records/i/:i', (req, res) => {
            getHistoryRecords('i', req, res);

        });


        const getHistoryRecords = (param, req, res) => {
            const id = req.params[param];
            const current = new Date();
            const startTs = req.query.from ? new Date(parseInt(req.query.from)) : new Date(current - DEFAULT_QUERY_INTERVAL);
            const endTs = req.query.to ? new Date(parseInt(req.query.to)) : current;
            console.log(`Request records for ${param} id: `, id, startTs, endTs);

            dataHistoriesCol.find({
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
                            ts: doc.ts,
                            ti: doc.ti
                        }
                    })
                });
            });
        }

        /* 
         *  User login
         *  用户登陆时的code用以从微信后台获取open id和session id，
         *  并返回open id和用户在小程序一一对应
        */
        app.get('/wxlogin/:code', (req, res) => {
            console.log('Request for user information for code: ', req.params.code);
            axios.get(wxUrl, {
                params: {
                    appId,
                    secret: appSecret,
                    js_code: req.params.code,
                    grant_type: 'authorization_code'
                }
            })
                .then(response => {
                    const data = response.data;
                    console.log('wx query response', data);
                    if (!data.openid || !data.session_key || data.errcode) {
                        res.status(404).json({
                            errmsg: data.errmsg || 'data is incomplete'
                        });
                    } else {
                        const openid = data.openid;
                        userInfosCol.updateOne(
                            {
                                openid
                            },
                            {
                                $setOnInsert: {
                                    ...data
                                }
                            },
                            {
                                upsert: true
                            }
                        )
                        res.json({
                            openid: data.openid
                        });
                    }

                })
                .catch(err => {
                    console.log('err', err)
                    res.status(400).json({
                        errmsg: 'info retrieve failed'
                    })
                })
        });

        /*
         *  Staff user weixin info
         *  员工用户(教职员工)微信信息的更新
        */
        app.post('/staffUser', (req, res) => {
            const data = req.body;
            console.log("request body", data);
            const openid = data.openid;
            userInfosCol.updateOne(
                {
                    openid
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
                        errmsg: 'cannot persist staff info'
                    })
                });
        });

        /*
        *  Staff user detail info
        *  员工用户(教职员工)信息的更新
        */
        app.post('/staff', (req, res) => {
            const data = req.body;
            console.log("request body", data);
            const staffId = data.staffId;
            staffsCol.updateOne(
                {
                    staffId
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
                        errmsg: 'cannot persist staff info'
                    })
                });
        });

        /*
         *  Staff user detail info
         *  GET 
         *  获取员工用户(教职员工)信息
        */
        app.get('/staff/:staffId', (req, res) => {
            const staffId = req.params.staffId;
            console.log('Request for device information for staff id: ', staffId);

            staffsCol.findOne({
                staffId
            },
                (err, doc) => {
                    if (err) {
                        console.error('Query failed when extract staff info via staff id:', staffId, err);

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
         *  Staff / user relation
         *  GET 
         *  获取员工用户的下属信息
        */
        app.get('/staff/:staffId/userlist', (req, res) => {
            const staffId = req.params.staffId;
            console.log('Request for user listfor staff id: ', staffId);

            let orgId;
            const promise = staffsCol.findOne({
                staffId
            })
                .then(doc => {
                    if (!doc || !doc.orgId) {
                        return Promise.reject('empty doc');
                    }
                    orgId = doc.orgId;
                    return orgsCol.findOne({
                        orgId
                    })

                });

            getStaffUserList(promise, staffId, orgId, res);

        });

        /*
         *  Staff / user relation
         *  GET 
         *  获取员工用户的下属信息
        */
        app.get('/staff/:staffId/org/:orgId/userlist', (req, res) => {
            const staffId = req.params.staffId;
            const orgId = req.params.orgId;
            console.log('Request for user listfor staff/org id: ', staffId, orgId);

            const promise = orgsCol.findOne({
                orgId
            });

            getStaffUserList(promise, staffId, orgId, res)


        });

        const getStaffUserList = (promise, staffId, orgId, res) => {
            promise.then(doc => {
                if (!doc) {
                    return Promise.reject('empty doc');
                }

                const tmp = doc.map[staffId]['leaves'].map(leaf => console.log('leaf ', leaf));
                const promises = Promise.all(doc.map[staffId]['leaves'].map(leaf => devicesCol.findOne({
                    c: leaf
                })));
                return promises;
                // return Promise.all(doc.map[staffId]['leaves'].map(leaf => devicesCol.findOne({
                //     c: leaf
                // })));
            })
                .then(docs => {
                    if (isEmptyArray(docs)) {
                        return Promise.reject('empty doc');
                    }
                    return res.json({
                        staffId,
                        orgId,
                        r: docs
                    });
                })
                .catch(err => {
                    if (err === 'empty doc') {
                        res.status(404).end();
                    } else {
                        console.error('Query failed when extract staff info via staff id:', staffId, err);

                        // TODO set error response
                        res.status(500).end();
                    }

                })
        }
        /*
         *  Device info
         *  GET
         *  获取手环相关信息
        */
        app.get('/device/:deviceId', (req, res) => {
            console.log('Request for device information for device id: ', req.params.deviceId);
            const deviceId = req.params.deviceId;
            devicesCol.findOne({
                deviceId
            },
                (err, doc) => {
                    if (err) {
                        console.error('Query failed when extract device via device id:', deviceId, err);

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
         *  Device info
         *  POST
         *  更新手环相关信息
        */
        app.post('/device', (req, res) => {
            console.log('Request for update device information: ', req.body);
            const data = req.body;
            const deviceId = data.deviceId;

            devicesCol.updateOne(
                {
                    deviceId
                },
                {
                    $setOnInsert: {
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
         *  Org info
         *  POST
         *  更新班级相关信息
        */
        app.post('/org', (req, res) => {
            console.log('Request for update org information: ', req.body);
            const data = req.body;
            const orgId = data.ordId;

            orgsCol.updateOne(
                {
                    orgId
                },
                {
                    $setOnInsert: {
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
                        errmsg: `cannot setup org info for org id: ${orgId}`
                    })
                });

        });

        /*
         *  Org info by id
         *  GET
         *  通过Org ID获取班级相关信息
        */
        app.get('/org/id/:orgId', (req, res) => {
            console.log('Request for obtain org information: ', req.params.orgId);

            const orgId = req.params.orgId;

            orgsCol.findOne(
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
        /*
         *  Org info by name
         *  GET
         *  通过Org name获取班级相关信息
        */
        app.get('/org/name/:orgName', (req, res) => {
            console.log('Request for obtain org information: ', req.params.orgName);

            const orgName = req.params.orgName;

            orgsCol.findOne(
                { orgName },
                (err, doc) => {
                    if (err) {
                        console.error('Query failed when extract org via org name:', orgName);
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

    }).catch(err => console.error(err));

app.post('/dump', (req, res) => {
    console.log('Dumped info body:', req.body);
    res.send('success');
})



app.get('/health', (req, res) => {
    res.send('success');
})

app.listen(PORT, function () {
    console.log(`listening on ${PORT}`)
})
