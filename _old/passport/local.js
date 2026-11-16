const passport = require('passport');
const { Strategy } = require('passport-local');
const bcrypt = require('bcrypt');
const { User } = require('../models');

module.exports = () => {
    passport.use(new Strategy({
        usernameField: 'email',
        passwordField: 'password'
    }, async (email, password, done) => {
        try {
            const user = await User.findOne({ where: { email } });
            if (user && await bcrypt.compare(password, user.password)) done(null, user);
            else done(null, false, { message: '이메일 또는 비밀번호가 일치하지 않습니다.' });
        } catch (err) {
            done(err);
        }
    }));
};
