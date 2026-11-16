const bcrypt = require('bcrypt');
const passport = require('passport');
const { User } = require('../models');
const { HttpError, ok } = require('../utils/response');
const { text, parseFields } = require('../utils/validate');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = user => ({ id: user.id, email: user.email, name: user.name, phone: user.phone });

// POST /users/join - 회원가입 (400 입력 오류, 409 이메일 중복)
exports.join = async (req, res, next) => {
    try {
        const fields = parseFields(req.body, {
            email: v => (typeof v === 'string' && EMAIL.test(v.trim()) && v.trim().length <= 100 ? v.trim() : null),
            password: v => (typeof v === 'string' && v.length >= 6 && v.length <= 50 ? v : null),
            name: v => text(v, 20),
            phone: v => text(v, 20)
        }, ['email', 'password', 'name']);

        if (await User.findOne({ where: { email: fields.email } }))
            throw new HttpError(409, '이미 가입된 이메일입니다.');

        const hash = await bcrypt.hash(fields.password, 12);
        const user = await User.create({ ...fields, password: hash });
        ok(res, publicUser(user), 201);
    } catch (err) { next(err); }
};

// POST /users/login - 로그인 (401 이메일·비밀번호 불일치)
exports.login = (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) return next(new HttpError(401, (info && info.message) || '로그인에 실패했습니다.'));
        req.login(user, loginErr => {
            if (loginErr) return next(loginErr);
            ok(res, publicUser(user));
        });
    })(req, res, next);
};

// POST /users/logout - 로그아웃
exports.logout = (req, res, next) => {
    try {
        req.logout();
        req.session.destroy(() => ok(res, null));
    } catch (err) { next(err); }
};

// GET /users/me - 내 정보
exports.me = (req, res, next) => {
    try {
        ok(res, publicUser(req.user));
    } catch (err) { next(err); }
};
