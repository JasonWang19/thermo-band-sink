const passport = require('passport');
const LocalStrategy = require('passport-local');

const { Users } = require('../models/Users');

passport.use(new LocalStrategy({
    usernameField: 'user[username]',
    passwordField: 'user[password]',
}, (username, password, done) => {
    console.debug('Verifying user by local strategy: ', username);

    Users.findUser({ username })
        .then((user) => {
            if (!user || !user.validatePassword(password)) {
                return done({ status: 401, msg: { 'username or password': 'is invalid or unavailable' } });
            }

            return done(null, user);
        }).catch(done);
}));