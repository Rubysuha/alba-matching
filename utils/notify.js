const { Notification } = require('../models');

// 알림은 사람이 만드는 게 아니라 서버가 만든다 (POST API 없음)
// 트랜잭션 안에서 부를 때는 options 에 { transaction: t } 를 넘긴다
module.exports = (userId, type, message, targetId = null, options = {}) =>
    Notification.create({ userId, type, message, targetId }, options);
