const router = require('express').Router();
const auth = require('./auth');
const passport = require('passport');
const { Users } = require('../models/Users');
const { Connection: conn } = require('../utils/Connection');

async function createUser(user, res) {
    const finalUser = new Users(user);

    const u = await Users.findUser(finalUser);
    if (u) {
        return res.status(409).json({
            errors: {
                username: 'already exist',
            }
        })
    }
    finalUser.setPassword(user.password);

    return finalUser.save()
        .then(() => res.json({ user: finalUser.authJson }));

}

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

    createUser(user, res);
});

//POST new user route (optional, everyone has access)
router.post('/signup', auth.optional, (req, res, next) => {
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

    conn.staffsCol.findOne({ staffId: user.username })
        .then(staff => {
            if (!staff) {
                return res.status(400).json({
                    errors: {
                        msg: 'can only signup for onboarded staff',
                        code: 10001
                    },
                });
            }
            createUser(user, res);
        })
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

//GET check username availability
router.get('/username/:username', auth.required, (req, res, next) => {
    const username = req.params.username;

    Users.findUser({ username })
        .then(u => {
            return res.json({
                exist: u ? true : false
            })
        })
});

//GET current route (required, only authenticated users have access)
router.post('/logout', auth.required, (req, res, next) => {
    const { payload: { id } } = req;

    return res.status(200).send();
});

module.exports = router;