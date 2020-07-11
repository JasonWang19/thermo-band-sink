'use strict';
const jwt = require('jsonwebtoken');
const crypto = require('crypto');


const SECRET = process.env.SECRET || 'secret';

const { Connection } = require('../utils/Connection');
const user = require('../user');

const iterations = 10000;

class Users {
    constructor({ username }) {
        this.username = username;
    }
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

        this.hash = await Connection.usersCol.findOne({ username: this.username }, { projection: { hash: 1 } });
        const hash = crypto.pbkdf2Sync(password, this.salt, iterations, 512, 'sha512').toString('hex');
        return this.hash === hash;
    }
    get generateJWT() {
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
            token: this.generateJWT,
        };
    }

}

module.exports = { Users }