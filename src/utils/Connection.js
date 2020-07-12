'use strict';

const { MongoClient } = require('mongodb');

const dbUrl = process.env.DB_URL;
const dbName = process.env.DB_NAME;

// collection names
const dataHistories = 'data_histories';
const userInfos = 'user_infos';
const devices = 'devices';
const orgs = 'orgs';
const orgStructs = 'org_structs';
const staffs = 'staffs';
const teams = 'teams';
const leaves = 'leaves';
const users = 'users';

class Connection {
    static connectToDb() {
        if (this.db) return Promise.resolve(this.db)
        return MongoClient.connect(this.url, this.options)
            .then(client => {
                console.log('Successfully connected to DB')
                this.db = client.db(dbName)
            })
    }
    static get dataHistoriesCol() {
        return this.db.collection(dataHistories)
    }
    static get userInfosCol() {
        return this.db.collection(userInfos);
    }
    static get devicesCol() {
        return this.db.collection(devices);
    }
    static get staffsCol() { return this.db.collection(staffs); }
    static get orgsCol() { return this.db.collection(orgs); }
    static get teamsCol() { return this.db.collection(teams); }
    static get orgStructsCol() { return this.db.collection(orgStructs); }
    static get leavesCol() { return this.db.collection(leaves); }

    static get usersCol() {
        return this.db.collection(users);
    }
}

Connection.db = null
Connection.url = dbUrl
Connection.options = {
    // bufferMaxEntries: 0,
    // useNewUrlParser: true,
    useUnifiedTopology: true,
}

module.exports = { Connection }