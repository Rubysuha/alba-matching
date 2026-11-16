const passport = require('passport');
const localStrategy = require('./localStrategy');
const { User } = require('../models');

module.exports = () => {
    passport.serializeUser((user, done) => done(null, user.id));

    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findByPk(id);
            done(null, user || false);
        } catch (err) {
            done(err);
        }
    });

    localStrategy();
};
