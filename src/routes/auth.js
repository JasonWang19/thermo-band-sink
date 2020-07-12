const jwt = require('express-jwt');
const SECRET = process.env.SECRET || 'secret';

const getToken = (req) => {
  const { headers: { authorization } } = req;

  if(authorization && authorization.split(' ')[0] === 'Bearer') {
    return authorization.split(' ')[1];
  }
  return null;
};

const auth = {
  required: jwt({
    secret: SECRET,
    userProperty: 'payload',
    getToken,
    algorithms: ['HS256']
  }),
  optional: jwt({
    secret: SECRET,
    userProperty: 'payload',
    getToken,
    credentialsRequired: false,
    algorithms: ['HS256']
  }),
};

module.exports = auth;