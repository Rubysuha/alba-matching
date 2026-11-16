const { Op } = require('sequelize');
const { sequelize, Job, Application, Shift, Payroll } = require('../models');
const { HttpError, ok } = require('../utils/response');
const { positiveInt, dateOnlyOf, text } = require('../utils/validate');
const { calculatePayroll } = require('../utils/payroll');
const notify = require('../utils/notify');

// 'YYYY-MM-DD' 기간 → 로컬 시간 기준 [시작, 끝] Date
const periodRange = (periodStart, periodEnd) => ({
    from: new Date(`${periodStart}T00:00:00`),
    to: new Date(`${periodEnd}T23:59:59.999`)
});

// ★ POST /payrolls - 정산서 발행 (사장님)
// 400 기간 오류, 403 남의 공고, 404, 409 확인된 근무 없음·기간 중복
// 급여는 서버가 확인된 근무 기록으로 계산한다 (utils/payroll.js)
exports.issue = async (req, res, next) => {
    try {
        const applicationId = positiveInt(req.body.applicationId);
        const periodStart = dateOnlyOf(req.body.periodStart);
        const periodEnd = dateOnlyOf(req.body.periodEnd);
        if (applicationId === null) throw new HttpError(400, 'applicationId는 필수입니다.');
        if (!periodStart || !periodEnd) throw new HttpError(400, 'periodStart, periodEnd는 YYYY-MM-DD 형식이어야 합니다.');
        if (periodStart > periodEnd) throw new HttpError(400, 'periodEnd는 periodStart보다 빠를 수 없습니다.');

        const application = await Application.findByPk(applicationId, { include: [Job] });
        if (!application) throw new HttpError(404, '지원을 찾을 수 없습니다.');
        if (application.Job.ownerId !== req.user.id) throw new HttpError(403, '내 공고의 지원에만 정산서를 발행할 수 있습니다.');

        const { from, to } = periodRange(periodStart, periodEnd);
        const shifts = await Shift.findAll({
            where: { applicationId, startAt: { [Op.between]: [from, to] } }
        });
        if (!shifts.some(s => s.status === 'confirmed'))
            throw new HttpError(409, '기간 안에 확인된 근무가 없습니다.');

        // 같은 지원·겹치는 기간의 정산서가 있으면 409. 단, 기존 정산서가 이의제기 상태면 재발행을 허용한다
        const duplicated = await Payroll.findOne({
            where: {
                applicationId,
                status: { [Op.ne]: 'disputed' },
                periodStart: { [Op.lte]: periodEnd },
                periodEnd: { [Op.gte]: periodStart }
            }
        });
        if (duplicated) throw new HttpError(409, '같은 기간에 이미 발행된 정산서가 있습니다.');

        // 시급 스냅샷: 발행 시점의 시급을 저장한다 (나중에 공고 시급이 바뀌어도 이미 발행된 금액은 그대로)
        const hourlyPay = application.Job.pay;
        const calc = calculatePayroll(shifts, hourlyPay);

        const payroll = await sequelize.transaction(async t => {
            const created = await Payroll.create({
                applicationId,
                ownerId: req.user.id,
                workerId: application.applicantId,
                periodStart,
                periodEnd,
                hourlyPay,
                ...calc,
                status: 'issued'
            }, { transaction: t });
            await notify(application.applicantId, 'payroll_issued',
                `'${application.Job.title}' 정산서가 발행되었습니다. (${calc.totalPay.toLocaleString('ko-KR')}원)`,
                created.id, { transaction: t });
            return created;
        });
        ok(res, payroll, 201);
    } catch (err) { next(err); }
};

// GET /payrolls/me - 알바생: 내가 받은 정산서
exports.listMine = async (req, res, next) => {
    try {
        const payrolls = await Payroll.findAll({
            where: { workerId: req.user.id },
            order: [['createdAt', 'DESC'], ['id', 'DESC']]
        });
        ok(res, payrolls);
    } catch (err) { next(err); }
};

// GET /payrolls/issued - 사장님: 내가 발행한 정산서
exports.listIssued = async (req, res, next) => {
    try {
        const payrolls = await Payroll.findAll({
            where: { ownerId: req.user.id },
            order: [['createdAt', 'DESC'], ['id', 'DESC']]
        });
        ok(res, payrolls);
    } catch (err) { next(err); }
};

// GET /payrolls/:id - 정산서 상세 (일별 내역 포함, canViewPayroll 이 req.payroll 에 실어 줌)
exports.detail = async (req, res, next) => {
    try {
        const { from, to } = periodRange(req.payroll.periodStart, req.payroll.periodEnd);
        const shifts = await Shift.findAll({
            where: {
                applicationId: req.payroll.applicationId,
                startAt: { [Op.between]: [from, to] },
                status: { [Op.in]: ['confirmed', 'no_show'] }
            },
            order: [['startAt', 'ASC']]
        });

        ok(res, {
            ...req.payroll.toJSON(),
            days: shifts.map(s => ({
                shiftId: s.id,
                startAt: s.startAt,
                endAt: s.endAt,
                workedMinutes: s.workedMinutes,
                status: s.status
            }))
        });
    } catch (err) { next(err); }
};

// PATCH /payrolls/:id/pay - 지급 완료 (사장님, 409: 발행 상태 아님)
exports.pay = async (req, res, next) => {
    try {
        if (req.payroll.status !== 'issued') throw new HttpError(409, '발행 상태의 정산서만 지급 처리할 수 있습니다.');

        await req.payroll.update({ status: 'paid', paidAt: new Date() });
        ok(res, req.payroll);
    } catch (err) { next(err); }
};

// PATCH /payrolls/:id/dispute - 이의제기 (알바생, 400: 사유 없음, 409: 발행 상태 아님)
exports.dispute = async (req, res, next) => {
    try {
        const reason = text(req.body.reason, 500);
        if (reason === null) throw new HttpError(400, 'reason(이의제기 사유)은 필수입니다.');
        if (req.payroll.status !== 'issued') throw new HttpError(409, '발행 상태의 정산서만 이의제기할 수 있습니다.');

        await sequelize.transaction(async t => {
            await req.payroll.update({ status: 'disputed', disputeReason: reason }, { transaction: t });
            await notify(req.payroll.ownerId, 'payroll_disputed',
                '정산서에 이의제기가 접수되었습니다.', req.payroll.id, { transaction: t });
        });
        ok(res, req.payroll);
    } catch (err) { next(err); }
};
