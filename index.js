'use strict';

const express = require('express');
const bodyParser = require('body-parser')

const { MongoClient, ObjectID } = require('mongodb');
const app = express();

const dbUrl = process.env.DB_URL;
const dbName = process.env.DB_NAME;
const collectionName = process.env.DB_COLLECTION;
const PORT = process.env.PORT;

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
