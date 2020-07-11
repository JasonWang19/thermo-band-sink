const router = require('express').Router();
const auth = require('./auth');
const passport = require('passport');
const { Users } = require('../models/Users');

//POST new user route (optional, everyone has access)
router.post('/', auth.optional, (req, res, next) => {
    const { body: { user } } = req;

    if (!user.username) {
        return res.status(422).json({
            errors: {
                username: 'is required',
            },
        });
    }

    if (!user.password) {
        return res.status(422).json({
            errors: {
                password: 'is required',
            },
        });
    }

    const finalUser = new Users(user);

    finalUser.setPassword(user.password);

    return finalUser.save()
        .then(() => res.json({ user: finalUser.authJson }));
});

//POST login route (optional, everyone has access)
router.post('/login', auth.optional, (req, res, next) => {
    const { body: { user } } = req;

    if (!user.username) {
        return res.status(422).json({
            errors: {
                username: 'is required',
            },
        });
    }

    if (!user.password) {
        return res.status(422).json({
            errors: {
                password: 'is required',
            },
        });
    }

    return passport.authenticate('local', { session: false }, (err, passportUser, info) => {
        if (err) {
            return next(err);
        }

        if (passportUser) {
            const user = passportUser;
            user.token = passportUser.generateJWT();

            return res.json({ user: user.authJson });
        }

        return status(400).info;
    })(req, res, next);
});


module.exports = router;