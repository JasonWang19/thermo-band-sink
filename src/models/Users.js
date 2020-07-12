'use strict';
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { ObjectID } = require('mongodb');


const SECRET = process.env.SECRET || 'secret';

const { Connection } = require('../utils/Connection');

const user = require('../user');

const iterations = 10000;

class Users {
    constructor(user) {
        this._id = user._id;
        this.username = user.username;
        this.hash = user.hash;
        this.salt = user.salt;
        this.type = user.type;
        this.roles = user.roles;
        this.avatar = user.avatar;
        this.name = user.name;  
    }

    // static method
    static async findUser({ username }) {
        const user = await Connection.usersCol.findOne({ username });
        return user ? new this(user) : null;
    }
    static async findById(id) {
        return Connection.usersCol.findOne({ _id: new ObjectID(id) });
    }

    // methods
    save() {
        return Connection.usersCol.save(this);
    }
    setPassword(password) {
        this.salt = crypto.randomBytes(16).toString('hex');
        this.hash = crypto.pbkdf2Sync(password, this.salt, iterations, 512, 'sha512').toString('hex');
        // return Connection.usersCol.updateOne(
        //     { username: this.username },
        //     {
        //         $set: {
        //             salt: this.salt,
        //             hash: this.hash
        //         }
        //     },
        //     { upsert: true }
        // )
    }
    async validatePassword(password) {

        if (!this.hash) {
            this.hash = await Connection.usersCol.findOne({ username: this.username }, { projection: { hash: 1 } }).then(user => user.hash);
        }
        const hash = crypto.pbkdf2Sync(password, this.salt, iterations, 512, 'sha512').toString('hex');
        return this.hash === hash;
    }

    // getter
    get generatedJwt() {
        const today = new Date();
        const expirationDate = new Date(today);
        expirationDate.setDate(today.getDate() + 60);

        return jwt.sign({
            username: this.username,
            id: this._id,
            exp: parseInt(expirationDate.getTime() / 1000, 10),
        }, SECRET);
    }
    get authJson() {
        return {
            _id: this._id,
            username: this.username,
            token: this.generatedJwt,
        };
    }
}

module.exports = { Users }