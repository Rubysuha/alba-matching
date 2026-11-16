const { Notification } = require('../models');
const { ok } = require('../utils/response');

// GET /notifications - 내 알림 목록 (?unread=true 안읽은 것만)
exports.list = async (req, res, next) => {
    try {
        const where = { userId: req.user.id };
        if (req.query.unread === 'true') where.isRead = false;

        const notifications = await Notification.findAll({
            where,
            order: [['createdAt', 'DESC'], ['id', 'DESC']]
        });
        ok(res, notifications);
    } catch (err) { next(err); }
};

// ★ GET /notifications/unread-count - 안읽은 알림 개수
exports.unreadCount = async (req, res, next) => {
    try {
        const count = await Notification.count({ where: { userId: req.user.id, isRead: false } });
        ok(res, { count });
    } catch (err) { next(err); }
};

// PATCH /notifications/read-all - 모두 읽음 처리
exports.readAll = async (req, res, next) => {
    try {
        const [updated] = await Notification.update(
            { isRead: true },
            { where: { userId: req.user.id, isRead: false } }
        );
        ok(res, { updated });
    } catch (err) { next(err); }
};

// PATCH /notifications/:id/read - 읽음 처리 (isNotificationOwner 가 req.notification 에 실어 줌)
exports.read = async (req, res, next) => {
    try {
        await req.notification.update({ isRead: true });
        ok(res, req.notification);
    } catch (err) { next(err); }
};

// DELETE /notifications/:id - 알림 삭제
exports.remove = async (req, res, next) => {
    try {
        await req.notification.destroy();
        ok(res, { id: req.notification.id });
    } catch (err) { next(err); }
};
