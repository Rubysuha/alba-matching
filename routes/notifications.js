const express = require('express');
const { isLoggedIn } = require('../middlewares/auth');
const { isNotificationOwner } = require('../middlewares/owner');
const c = require('../controllers/notifications');

const router = express.Router();

router.get('/', isLoggedIn, c.list);                                            // 목록 (?unread=true)
router.get('/unread-count', isLoggedIn, c.unreadCount);                         // ★ 안읽은 개수
router.patch('/read-all', isLoggedIn, c.readAll);                               // 모두 읽음
router.patch('/:id/read', isLoggedIn, isNotificationOwner, c.read);             // 읽음 처리
router.delete('/:id', isLoggedIn, isNotificationOwner, c.remove);               // 삭제

module.exports = router;
