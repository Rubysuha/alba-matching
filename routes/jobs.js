const express = require('express');
const { isLoggedIn } = require('../middlewares/auth');
const { isJobOwner } = require('../middlewares/owner');
const c = require('../controllers/jobs');

const router = express.Router();

router.get('/', c.list);                                                        // ★ 공고 목록 (필터·페이지)
router.get('/:id', c.detail);                                                   // 공고 상세
router.post('/', isLoggedIn, c.create);                                         // 공고 등록
router.patch('/:id', isLoggedIn, isJobOwner, c.update);                         // 공고 수정 (작성자만)
router.delete('/:id', isLoggedIn, isJobOwner, c.remove);                        // 공고 삭제 (작성자만)
router.patch('/:id/status', isLoggedIn, isJobOwner, c.changeStatus);            // 조기 마감 / 재오픈

module.exports = router;
