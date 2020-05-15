'use strict';

const express = require('express');
const bodyParser = require('body-parser')

const { MongoClient, ObjectID } = require('mongodb');
const app = express();

const dbUrl = 'mongodb://localhost:27017';
const dbName = 'thermo-band';
const collectionName = 'test';

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

MongoClient.connect(dbUrl, { useUnifiedTopology: true })
    .then(client => {
        console.log("Connected successfully to DB");
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

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
                updates.push(collection.updateOne(
                    {
                        ...filterBase,
                        ts: r.ts,
                    },
                    {
                        $setOnInsert: {
                            ...filterBase,
                            ...r
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
    })
    .catch(err => console.error(err));

app.get('/health', (req, res) => {
    res.send('success');
})

app.listen(3000, function () {
    console.log('listening on 3000')
})
