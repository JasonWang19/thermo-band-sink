'use strict';

const express = require('express');
const bodyParser = require('body-parser')
const { ObjectID } = require('mongodb');
const axios = require('axios');
const { v4: uuid4, v5: uuid5 } = require('uuid');
const net = require('net');

const app = express();
const server = net.createServer();

const util = require("./src/utils/util");

const passport = require('passport');

// env
const isProduction = process.env.NODE_ENV === 'production';

const PORT = process.env.PORT;
const wxUrl = process.env.WX_URL;
const appId = process.env.WX_APP_ID;
const appSecret = process.env.WX_SECRET;
const TCP_PORT = process.env.TCP_PORT;

// constants
const DEFAULT_QUERY_INTERVAL = 2 * 3600 * 1000;

// DB initialization
const { Connection: conn } = require('./src/utils/Connection')
conn.connectToDb()

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(bodyParser.text())
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-token, Authorization');
    next();
});

app.use(passport.initialize());
require('./src/config/passport');
app.use(require('./src/routes'));


// //Error handlers & middlewares
// if (!isProduction) {
//     app.use((err, req, res) => {
//         res.status(err.status || 500);

//         res.json({
//             errors: {
//                 message: err.message,
//                 error: err,
//             },
//         });
//     });
// }

// app.use((err, req, res) => {
//     res.status(err.status || 500);

//     res.json({
//         errors: {
//             message: err.message,
//             error: {},
//         },
//     });
// });

// utility function
const isEmptyArray = arr => {
    return !(Array.isArray(arr) && arr.length);
}

const getUuid = () => {
    return uuid4();
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
                conn.userInfosCol.updateOne(
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
    conn.userInfosCol.updateOne(
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
app.get('/staff/:staffId', (req, res) => {
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
app.get('/staff/:staffId/userlist', (req, res) => {
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
app.get('/staff/:staffId/org/:orgId/userlist', (req, res) => {
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
            if (isEmptyArray(docs)) {
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
app.get('/staffs/org/:orgId', (req, res) => {
    const orgId = req.params.orgId;

    console.log('Request for list of staff by org id: ', orgId);

    conn.staffsCol.find({ orgId }).toArray()
        .then(docs => {
            if (isEmptyArray(docs)) {
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

/*
 *  Device info
 *  POST
 *  更新手环相关信息
*/
app.post('/device', (req, res) => {
    console.log('Request for update device information: ', req.body);
    const data = req.body;
    const deviceName = data.deviceName;

    conn.devicesCol.updateOne(
        {
            deviceName
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
                errmsg: `cannot setup device info for device id: ${deviceId}`
            })
        });

});

/*
 *  Devices info bulk
 *  POST
 *  批量更新手环相关信息
*/
app.post('/devices', (req, res) => {
    console.log('Request for update devices information: ', req.body);
    const data = req.body;
    const bulk = conn.devicesCol.initializeUnorderedBulkOp();

    for (let d of data) {
        bulk.find({ deviceId: d.deviceId }).upsert().updateOne({ $set: d });
    }

    bulk.execute()
        .then(results => {
            console.log(JSON.stringify(results));
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
 *  Device info
 *  GET
 *  获取手环相关信息
*/
app.get('/device/:deviceName', (req, res) => {
    console.log('Request for device information for device name: ', req.params.deviceName);
    const deviceName = req.params.deviceName;
    conn.devicesCol.findOne({
        deviceName
    },
        (err, doc) => {
            if (err) {
                console.error('Query failed when extract device via device name:', deviceName, err);

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
 *  All Device info
 *  GET
 *  获取所有手环相关信息
*/
app.get('/devices', (req, res) => {

    // TODO add query criteria

    console.log('Request for device information for all devices');
    conn.devicesCol.find({}).toArray()
        .then(docs => {
            if (isEmptyArray(docs)) {
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

/*
 *  Org info
 *  POST
 *  更新机构相关信息
*/
app.post('/org', (req, res) => {
    console.log('Request for update org information: ', req.body);
    let data = req.body;
    const orgId = data.orgId ? data.orgId : getUuid();
    data = {
        ...data,
        orgId
    };
    let promise;
    if (data._id) {
        const { _id, ...newData } = data;
        promise = conn.orgsCol.updateOne(
            { _id: new ObjectID(_id) },
            {
                $set: newData
            },
            { upsert: true }
        );
    } else {
        promise = conn.orgsCol.updateOne(
            { orgId },
            { $set: data },
            { upsert: true }
        );
    }

    promise
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
 *  通过Org ID获取机构相关信息
*/
app.get('/org/id/:orgId', (req, res) => {
    console.log('Request for obtain org information: ', req.params.orgId);

    const orgId = req.params.orgId;

    conn.orgsCol.findOne(
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
 *  通过Org name获取机构相关信息
*/
app.get('/org/name/:orgName', (req, res) => {
    console.log('Request for obtain org information: ', req.params.orgName);

    const orgName = req.params.orgName;

    conn.orgsCol.findOne(
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

/*
 *  Orgs all of the orgs
 *  GET
 *  获取所有的org的列表
*/
app.get('/orgs', (req, res) => {
    console.log('Request for obtain list of all orgs.');

    conn.orgsCol.find({}, { leaves: 0, teams: 0 })
        .toArray()
        .then(docs => {
            if (isEmptyArray(docs)) {
                res.status(404).end();
            } else {
                res.json(docs);
            }
        })
        .catch(err => {
            console.error('Query failed when extract org via org name:', orgName);
            res.status(500).end();
        })

});



/*
 *  Bulk Org structure info
 *  POST
 *  批量更新机构人员架构相关信息
*/
app.post('/orgstruct/org', (req, res) => {
    console.log('Request for update org structure information: ', req.body);
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
app.post('/orgstruct/org', (req, res) => {
    console.log('Request for update org structure information: ', req.body);
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
app.post('/orgstruct', (req, res) => {
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
app.get('/orgstruct/id/:orgId', (req, res) => {
    console.log('Request for obtain org information: ', req.params.orgId);

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
app.get('/orgstruct/id/:orgId/staff/:staffId', (req, res) => {
    console.log('Request for obtain org information: ', req.params.orgId);

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

// TODO deprecate team apis, move team into org
/*
*  Team info
*  POST
*  更新班级相关信息
*/
app.post('/team', (req, res) => {
    console.log('Request for update team information: ', req.body);
    let data = req.body;
    const teamId = data.teamId ? data.teamId : getUuid();
    data = {
        ...data,
        teamId
    }

    conn.teamsCol.updateOne(
        {
            teamId
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
                errmsg: `cannot setup org info for org id: ${orgId}`
            })
        });

});

/*
 *  Team info by id
 *  GET
 *  通过Team id获取班级相关信息
*/
app.get('/team/id/:teamId', (req, res) => {
    console.log('Request for obtain org information: ', req.params.teamId);

    const teamId = req.params.teamId;

    conn.teamsCol.findOne(
        { teamId },
        (err, doc) => {
            if (err) {
                console.error('Query failed when extract team via team id:', teamId);
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
 *  Teams by org id
 *  GET
 *  获取机构所有班级
*/
app.get('/teams/org/:orgId', (req, res) => {
    const orgId = req.params.orgId;
    console.log('Request for obtain teams of org: ', orgId);

    conn.teamsCol.find({ orgId })
        .toArray()
        .then(docs => {
            res.json(docs)
        })
        .catch(err => {
            if (err) {
                console.error('Query failed when extract team via team id:', teamId);
                res.status(500).end();
            }
        })
});

/*
*  Leaf info
*  POST
*  更新用户信息
*/
app.post('/leaf', (req, res) => {
    console.log('Request for update leaf information: ', req.body);
    const { _id, data } = req.body


    conn.leavesConn.updateOne(
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
 *  Team info by id
 *  GET
 *  通过Team id获取班级相关信息
*/
app.get('/leaf/c/:c', (req, res) => {
    const c = req.params.c;

    console.log('Request for obtain leaf information: ', c);

    conn.leavesConn.findOne(
        { c },
        (err, doc) => {
            if (err) {
                console.error('Query failed when extract team via c:', c);
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
 *  Teams by org id
 *  GET
 *  获取机构所有班级
*/
app.get('/leaves/org/:orgId', (req, res) => {
    const orgId = req.params.orgId;
    console.log('Request for obtain teams of org: ', orgId);

    conn.leavesConn.find({ orgId })
        .toArray()
        .then(docs => {
            res.json(docs)
        })
        .catch(err => {
            if (err) {
                console.error('Query failed when extract leaf via org id:', orgId);
                res.status(500).end();
            }
        })
});

app.post('/dump', (req, res) => {
    console.log('Dumped info body:', req.body);
    res.send('success');
})


/*
*   mock user api
*/
const { loginHandler, getUserInfoHandler, logOutHandler } = require('./src/user');
app.post('/user/login', (req, res) => {
    res.json(loginHandler(req));
})
app.get('/user/Info', (req, res) => {
    res.json(getUserInfoHandler(req));
})
app.post('/user/logout', (req, res) => {
    res.json(logOutHandler(req));
})


app.get('/health', (req, res) => {
    res.send('success');
})

//Error handlers & middlewares
// if (!isProduction) {
//     app.use((err, req, res) => {
//         res.status(err.status || 500);

//         res.json({
//             errors: {
//                 message: err.message,
//                 error: err,
//             },
//         });
//     });
// }

// app.use((err, req, res) => {
//     res.status(err.status || 500);

//     res.json({
//         errors: {
//             message: err.message,
//             error: {},
//         },
//     });
// });

app.listen(PORT, function () {
    console.log(`Rest Server is listening on port: ${PORT}.`)
})


server.listen(TCP_PORT, () => {
    console.log(`TCP Server is running on port: ${TCP_PORT}.`);
});


/* 
 *  TCP Server
*/
const handleTcpConnection = socket => {
    const success = "2";
    const failure = "5";
    const client = socket.remoteAddress + ':' + socket.remotePort;
    console.log('new client connection from %s', client);

    /* 
     *  Records BLE to WIFI
     *  保存历史数据 蓝牙转WIFI
    */
    socket.on('data', chunk => {
        const result = util.processBle2Wifi(chunk.buffer);

        if (result !== null) {
            const { n, ts, ti, te, ta, i } = result;
            const recordBase = {
                n,
                ts: new Date(ts)
            }

            conn.dataHistoriesCol.updateOne(
                recordBase,
                {
                    $setOnInsert: {
                        ...recordBase,
                        i,
                        ti,
                        te,
                        ta
                    }
                },
                {
                    upsert: true
                }
            )
                .then(result => {
                    socket.write(success);
                })
                .catch(err => {
                    console.error(`Failed saving record for client ${client}, data ${chunk}, err ${err}`);
                    socket.write(failure);
                })


        } else {
            socket.write(failure);
        }



    });
    // socket.on('data', chunk => {
    //     console.log(chunk);
    // });  

    socket.on('end', () => {
        console.log(`Closing connection with ${client}`);
    });

    socket.on('error', err => {
        console.error(`Failed saving record for client ${client}, err ${err}`);
    });

}

server.on('connection', handleTcpConnection);
