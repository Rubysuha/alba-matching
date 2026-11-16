const express = require('express');
const { isLoggedIn } = require('../middlewares/auth');
const { canViewPayroll, isPayrollIssuer, isPayrollWorker } = require('../middlewares/owner');
const c = require('../controllers/payrolls');

const router = express.Router();

router.post('/', isLoggedIn, c.issue);                                          // ★ 정산서 발행
router.get('/me', isLoggedIn, c.listMine);                                      // 내 급여 (알바생)
router.get('/issued', isLoggedIn, c.listIssued);                                // 발행한 정산서 (사장님)
router.get('/:id', isLoggedIn, canViewPayroll, c.detail);                       // 상세 (일별 내역)
router.patch('/:id/pay', isLoggedIn, isPayrollIssuer, c.pay);                   // 지급 완료
router.patch('/:id/dispute', isLoggedIn, isPayrollWorker, c.dispute);           // 이의제기

module.exports = router;
