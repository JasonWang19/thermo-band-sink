'use strict';

const express = require('express');
const bodyParser = require('body-parser')
const { MongoClient, ObjectID } = require('mongodb');
const axios = require('axios');

const app = express();

const dbUrl = process.env.DB_URL;
const dbName = process.env.DB_NAME;
const PORT = process.env.PORT;
const wxUrl = process.env.WX_URL;
const appId = process.env.WX_APP_ID;
const appSecret = process.env.WX_SECRET;

// collection names
const dataHistories = 'data_histories';
const userInfos = 'user_infos';
const devices = 'devices'

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

MongoClient.connect(dbUrl, { useUnifiedTopology: true })
    .then(client => {
        console.log("Connected successfully to DB");
        const db = client.db(dbName);
        const dataHistoriesCol = db.collection(dataHistories);
        const userInfosCol = db.collection(userInfos);
        const devicesCol = db.collection(devices);
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
                    res.statusCode(400);
                })
            // res.statusCode(500).send('internal error');
        });

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
         *  Staff user info
         *  员工用户(教职员工)信息的更新
        */
        app.post('/staff', (req, res) => {
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
         *  Device info
         *  GET
         *  获取手环相关信息
        */
        app.get('/device/:deviceId', (req, res) => {
            console.log('Request for device information for device id: ', req.params.deviceId);
            const deviceId = req.params.deviceId;
            devicesCol.find({
                deviceId
            })
                .toArray((err, rels) => {
                    if (err) {
                        console.error('Query failed when extract device via device id:', deviceId);
                        // TODO set error response
                    } else if (rels.length > 1) {
                        console.error('Data setup issue, one device should have only one record, device id:', deviceId)
                    } else if (rels.length < 1) {
                        res.status(404);
                        // TODO return common 404
                    } else {
                        res.json(rels[0]);
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
            devicesCol.count({ deviceId })
                .then(number => {
                    if (number > 1) {
                        res.status(400).json({
                            errmsg: `Data setup issue, more than one recrods for deviceId: ${deviceId}`
                        });
                        return;
                    }
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
                })

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
