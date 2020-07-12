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
            return res.status(err.status).json(err.msg);
        }

        if (passportUser) {
            const user = passportUser;
            user.token = passportUser.generatedJwt;

            return res.json({ user: user.authJson });
        }

        return res.status(400).info;
    })(req, res, next);
});

//GET current route (required, only authenticated users have access)
router.get('/current', auth.required, (req, res, next) => {
    const { payload: { id } } = req;

    return Users.findById(id)
        .then((user) => {
            if (!user) {
                return res.sendStatus(400);
            }

            return res.json({ user });
        });
});

//GET current route (required, only authenticated users have access)
router.post('/logout', auth.required, (req, res, next) => {
    const { payload: { id } } = req;

    return res.status(200).send();
});

module.exports = router;