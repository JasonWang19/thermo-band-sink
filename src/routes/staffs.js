'use strict'

const router = require('express').Router();
const { Connection: conn } = require('../utils/Connection');
const lodash = require('lodash');

/*
*  Staff user detail info
*  员工用户(教职员工)信息的更新
*/
router.post('', (req, res) => {
    const data = req.body;
    console.log("request body", data);
    const staffId = data.staffId;
    const { _id, ...newData } = data;
    conn.staffsCol.updateOne(
        {
            staffId
        },
        {
            $set: {
                ...newData
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
router.get('/:staffId', (req, res) => {
    const staffId = req.params.staffId;
    console.log('Request for device information for staff id: ', staffId);

    conn.staffsCol.findOne({
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
 *  Staff - User list
 *  GET 
 *  获取员工用户的下属信息 staff id
*/
router.get('/:staffId/userlist', (req, res) => {
    const staffId = req.params.staffId;
    console.log('Request for user listfor staff id: ', staffId);

    let orgId;
    const promise = conn.staffsCol.findOne({
        staffId
    })
        .then(doc => {
            if (!doc || !doc.orgId) {
                return Promise.reject('empty doc');
            }
            orgId = doc.orgId;
            return { orgId, staffId };
        });

    getStaffUserList(promise, res);

});

/*
 *  Staff - User relation
 *  GET 
 *  获取员工用户的下属信息 staff & org id
*/
router.get('/:staffId/org/:orgId/userlist', (req, res) => {
    const staffId = req.params.staffId;
    const orgId = req.params.orgId;
    console.log('Request for user listfor staff/org id: ', staffId, orgId);

    getStaffUserList(Promise.resolve({ orgId, staffId }), res)
});

const getStaffUserList = (promise, res) => {
    promise.then(param => {
        if (!param) {
            return Promise.reject('empty doc');
        }

        return conn.orgStructsCol.findOne({
            orgId: param.orgId,
            staffId: param.staffId
        })

    })
        .then(doc => {
            if (!doc) {
                return Promise.reject('empty doc');
            }
            // construct team member and leave promise
            const promises = doc.teams.map(t => getMemberPromise(t));
            promises.push(...doc.leaves.map(c => conn.devicesCol.findOne({ c })));
            return Promise.all(promises);

        })
        .then(docs => {
            if (lodash.isEmpty(docs)) {
                return Promise.reject('empty doc');
            }
            const result = [];
            const noTeam = 'NA';
            for (let doc of docs) {
                if (Array.isArray(doc)) {
                    const teamName = doc[0].levels.join();
                    for (let d of doc[0].students) {
                        result.push({
                            ...d,
                            teamName,
                        })
                    }
                } else {
                    if (doc) {
                        result.push({
                            ...doc,
                            teamName: noTeam,
                        })
                    }
                }
            }

            return res.json(result);
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

const getMemberPromise = (teamId) => {
    return conn.teamsCol.aggregate([
        {
            $match: { teamId }
        },
        {
            $lookup:
            {
                from: "devices",
                localField: "members",
                foreignField: "c",
                as: "students"
            }
        },
        {
            $project: { "_id": 0, "members": 0 }
        }
    ])
        .toArray()
}

/*
 *  Staffs - list of staff
 *  GET 
 *  获取所有员工 staffs by org id
*/
router.get('/org/:orgId', (req, res) => {
    const orgId = req.params.orgId;

    console.log('Request for list of staff by org id: ', orgId);

    conn.staffsCol.find({ orgId }).toArray()
        .then(docs => {
            if (lodash.isEmpty(docs)) {
                res.status(404).end();
            } else {
                res.json(docs);
            }
        })
        .catch(err => {
            console.error('Query failed when extract device via device name:', deviceName, err);
            res.status(500).end();
        })
});
module.exports = router;