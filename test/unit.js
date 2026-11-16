// DB 없이 실행되는 단위 테스트: 미들웨어와 급여 계산
process.env.NODE_ENV = 'test';

const { expect } = require('chai');
const { isLoggedIn, isNotLoggedIn } = require('../middlewares/auth');
const { HttpError } = require('../utils/response');
const { calculatePayroll, weekKey } = require('../utils/payroll');
const { dateOnlyOf, ratingOf } = require('../utils/validate');

// 가짜 req 와 next 를 넣어 통과(에러 없이 next) 또는 거부(HttpError) 를 확인한다
const run = (middleware, authenticated) => {
    let result = 'not-called';
    middleware({ isAuthenticated: () => authenticated }, {}, err => { result = err; });
    return result;
};

describe('Unit: middlewares/auth', () => {
    it('isLoggedIn - 로그인했으면 통과', () => {
        expect(run(isLoggedIn, true)).to.equal(undefined);
    });

    it('isLoggedIn - 로그인 안 했으면 401', () => {
        const err = run(isLoggedIn, false);
        expect(err).to.be.instanceOf(HttpError);
        expect(err.status).to.equal(401);
    });

    it('isNotLoggedIn - 로그인 안 했으면 통과', () => {
        expect(run(isNotLoggedIn, false)).to.equal(undefined);
    });

    it('isNotLoggedIn - 로그인했으면 400', () => {
        const err = run(isNotLoggedIn, true);
        expect(err).to.be.instanceOf(HttpError);
        expect(err.status).to.equal(400);
    });
});

describe('Unit: utils/validate', () => {
    it('ratingOf - 1~5 정수만 허용', () => {
        expect(ratingOf(1)).to.equal(1);
        expect(ratingOf('5')).to.equal(5);
        expect(ratingOf(0)).to.equal(null);
        expect(ratingOf(6)).to.equal(null);
        expect(ratingOf(3.5)).to.equal(null);
        expect(ratingOf('abc')).to.equal(null);
    });

    it('dateOnlyOf - 실제 있는 YYYY-MM-DD 만 허용', () => {
        expect(dateOnlyOf('2026-11-09')).to.equal('2026-11-09');
        expect(dateOnlyOf('2026-02-30')).to.equal(null);
        expect(dateOnlyOf('2026-1-9')).to.equal(null);
        expect(dateOnlyOf(20261109)).to.equal(null);
    });
});

describe('Unit: utils/payroll', () => {
    const HOURLY = 10320;
    // 로컬 시간 기준 일정 만들기 (2026-11-02 는 월요일)
    const shift = (day, minutes, status = 'confirmed') =>
        ({ startAt: new Date(2026, 10, day, 9, 0), workedMinutes: minutes, status });

    it('weekKey - 한 주는 월요일부터 일요일까지', () => {
        expect(weekKey(new Date(2026, 10, 2, 9, 0))).to.equal('2026-11-02');   // 월
        expect(weekKey(new Date(2026, 10, 8, 23, 0))).to.equal('2026-11-02');  // 일
        expect(weekKey(new Date(2026, 10, 9, 0, 30))).to.equal('2026-11-09');  // 다음 월
    });

    it('주 15시간 미만이면 주휴수당 0', () => {
        const r = calculatePayroll([shift(2, 240), shift(3, 240), shift(4, 240)], HOURLY);   // 12시간
        expect(r.totalMinutes).to.equal(720);
        expect(r.basePay).to.equal(123840);
        expect(r.weeklyHolidayPay).to.equal(0);
        expect(r.totalPay).to.equal(123840);
    });

    it('주 3일 × 6시간(18시간): 기본급과 주휴수당', () => {
        const r = calculatePayroll([shift(2, 360), shift(3, 360), shift(4, 360)], HOURLY);
        expect(r.basePay).to.equal(185760);            // 18h × 10,320
        expect(r.weeklyHolidayPay).to.equal(37152);    // 18 ÷ 40 × 8 × 10,320
        expect(r.totalPay).to.equal(222912);
    });

    it('정확히 15시간이면 주휴수당 발생', () => {
        const r = calculatePayroll([shift(2, 300), shift(3, 300), shift(4, 300)], HOURLY);
        expect(r.weeklyHolidayPay).to.equal(30960);    // 15 ÷ 40 × 8 × 10,320
    });

    it('40시간 이상이면 주휴수당은 8시간분으로 고정', () => {
        const r = calculatePayroll([shift(2, 600), shift(3, 600), shift(4, 600), shift(5, 600), shift(6, 600)], HOURLY);   // 50시간
        expect(r.weeklyHolidayPay).to.equal(8 * HOURLY);
    });

    it('결근이 있는 주는 주휴수당 0 (기본급은 그대로)', () => {
        const r = calculatePayroll([shift(2, 360), shift(3, 360), shift(4, 360), shift(5, 0, 'no_show')], HOURLY);
        expect(r.basePay).to.equal(185760);
        expect(r.weeklyHolidayPay).to.equal(0);
    });

    it('주마다 따로 계산: 첫 주는 결근으로 0, 둘째 주는 지급', () => {
        const r = calculatePayroll([
            shift(2, 360), shift(3, 360), shift(4, 0, 'no_show'),
            shift(9, 360), shift(10, 360), shift(11, 360)
        ], HOURLY);
        expect(r.totalMinutes).to.equal(1800);
        expect(r.weeklyHolidayPay).to.equal(37152);
    });

    it('확인(confirmed)되지 않은 근무는 계산에 넣지 않는다', () => {
        const r = calculatePayroll([shift(2, 360), shift(3, 360, 'checked_out')], HOURLY);
        expect(r.totalMinutes).to.equal(360);
    });

    it('원 단위 내림', () => {
        const r = calculatePayroll([shift(2, 100)], 10001);
        expect(r.basePay).to.equal(16668);   // 100 × 10,001 ÷ 60 = 16668.33…
    });

    it('근무가 없으면 모두 0', () => {
        expect(calculatePayroll([], HOURLY)).to.deep.equal({ totalMinutes: 0, basePay: 0, weeklyHolidayPay: 0, totalPay: 0 });
    });
});
