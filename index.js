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

const dataHistories = 'data_histories';
const userInfos = 'user_infos';

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

MongoClient.connect(dbUrl, { useUnifiedTopology: true })
    .then(client => {
        console.log("Connected successfully to DB");
        const db = client.db(dbName);
        const dataHistoriesCol = db.collection(dataHistories);
        const userInfosCol = db.collection(userInfos);

        // Records 
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
        })

        // User login
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
        })
    })
    .catch(err => console.error(err));

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
