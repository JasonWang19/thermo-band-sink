'use strict';

const express = require('express');
const bodyParser = require('body-parser')
const { ObjectID } = require('mongodb');
const axios = require('axios');
const { v4: uuid4, v5: uuid5 } = require('uuid');
const net = require('net');
const lodash = require('lodash');

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

app.get('/test', (req, res)=>{
    throw new Error('test error in index');
})

//Error handlers & middlewares
// if (!isProduction) {
//     app.use((err, req, res, next) => {
//         res.status(err.status || 500);

//         res.json({
//             errors: {
//                 message: err.message,
//                 error: err,
//             },
//         });
//     });
// }

// app.use((err, req, res, next) => {
//     res.status(err.status || 500);

//     res.json({
//         errors: {
//             message: err.message,
//             error: {},
//         },
//     });
// });

/*
 *  remote logging
 *  远程日志
*/
app.post('/logs', (req, res) => {
    const data = req.body;
    console.log("request body", data);
    conn.logsCol.insertOne( data )
    .then(()=>res.end())
    .catch((err)=>{
        console.warn('post log failure', err);
        res.end();
    })

});

/* 
 *  wx configuration
 *  获取微信小程序配置
*/
// app.get('/configs', (req, res) => {
    
//     res.send({
//         // refreshDuration: 1*60*1000,
//         defaultLogger: true
//     })
// });


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
            if (lodash.isEmpty(docs)) {
                res.status(404).end();
            } else {
                res.json(docs);
            }
        })
        .catch(err => {
            console.error('Query failed when extract org');
            res.status(500).end();
        })

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
