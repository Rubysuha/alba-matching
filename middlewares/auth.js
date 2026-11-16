const { HttpError } = require('../utils/response');

// 로그인 필요 (401)
exports.isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) next();
    else next(new HttpError(401, '로그인이 필요합니다.'));
};

// 로그인하지 않은 상태에서만 (가입·로그인 API용, 400)
exports.isNotLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) next();
    else next(new HttpError(400, '이미 로그인한 상태입니다.'));
};
