const express = require('express');
const { isLoggedIn } = require('../middlewares/auth');
const { isJobOwnerOfApplication } = require('../middlewares/owner');
const c = require('../controllers/applications');

const router = express.Router();

router.post('/', isLoggedIn, c.apply);                                                          // 지원하기
router.get('/sent', isLoggedIn, c.listSent);                                                    // 내가 지원한 목록
router.get('/received', isLoggedIn, c.listReceived);                                            // 내 공고로 온 지원
router.patch('/:id/accept', isLoggedIn, isJobOwnerOfApplication, c.accept);                     // ★ 채용 확정
router.patch('/:id/reject', isLoggedIn, isJobOwnerOfApplication, c.reject);                     // 지원 거절
router.patch('/:id/complete', isLoggedIn, isJobOwnerOfApplication, c.complete);                 // 근무 완료 + 평점

module.exports = router;
