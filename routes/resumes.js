const express = require('express');
const { isLoggedIn } = require('../middlewares/auth');
const { isResumeOwner, canViewResume } = require('../middlewares/owner');
const c = require('../controllers/resumes');

const router = express.Router();

router.get('/me', isLoggedIn, c.listMine);                                      // 내 이력서 (/:id보다 위)
router.get('/:id', isLoggedIn, canViewResume, c.detail);                        // 이력서 상세
router.get('/:id/careers', isLoggedIn, canViewResume, c.careers);               // ★ 인증 경력
router.post('/', isLoggedIn, c.create);                                         // 이력서 작성
router.patch('/:id', isLoggedIn, isResumeOwner, c.update);                      // 이력서 수정
router.delete('/:id', isLoggedIn, isResumeOwner, c.remove);                     // 이력서 삭제

module.exports = router;
