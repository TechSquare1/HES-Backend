const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('./jwtSecret');

const generateToken = (id) => {
  return jwt.sign({ id }, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

module.exports = generateToken;

