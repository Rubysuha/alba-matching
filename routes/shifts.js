const express = require('express');
const { isLoggedIn } = require('../middlewares/auth');
const { isShiftWorker, isShiftJobOwner } = require('../middlewares/owner');
const c = require('../controllers/shifts');

const router = express.Router();

router.post('/', isLoggedIn, c.create);                                         // 일정 등록 (사장님)
router.get('/me', isLoggedIn, c.listMine);                                      // 내 일정 (알바생)
router.get('/jobs/:jobId', isLoggedIn, c.listByJob);                            // 공고별 일정 (사장님)
router.patch('/:id/check-in', isLoggedIn, isShiftWorker, c.checkIn);            // ★ 출근
router.patch('/:id/check-out', isLoggedIn, isShiftWorker, c.checkOut);          // 퇴근
router.patch('/:id/confirm', isLoggedIn, isShiftJobOwner, c.confirm);           // 근무 확인
router.patch('/:id/no-show', isLoggedIn, isShiftJobOwner, c.markNoShow);        // 결근 처리

module.exports = router;
