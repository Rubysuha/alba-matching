const { Op } = require('sequelize');
const { Resume, Application, Job, Shift, User } = require('../models');
const { HttpError, ok } = require('../utils/response');
const { text, parseFields } = require('../utils/validate');
const { dayKey } = require('../utils/payroll');

const resumeSpec = {
    title: v => text(v, 100),
    intro: v => text(v, 5000),
    desiredRegion: v => text(v, 50)
};

// GET /resumes/me - 내 이력서 목록
exports.listMine = async (req, res, next) => {
    try {
        const resumes = await Resume.findAll({
            where: { userId: req.user.id },
            order: [['createdAt', 'DESC'], ['id', 'DESC']]
        });
        ok(res, resumes);
    } catch (err) { next(err); }
};

// GET /resumes/:id - 이력서 상세 (canViewResume 가 req.resumeDoc 에 실어 줌)
exports.detail = (req, res, next) => {
    try {
        ok(res, req.resumeDoc);
    } catch (err) { next(err); }
};

// ★ GET /resumes/:id/careers - 인증 경력 조회
// 저장하지 않고 조회할 때마다 완료된 지원에서 만든다 (원본과 어긋나거나 조작될 여지가 없다)
// 이력서가 아니라 사람(applicantId) 기준이라, 어떤 이력서로 지원했든 경력에 모두 잡힌다
exports.careers = async (req, res, next) => {
    try {
        const applications = await Application.findAll({
            where: { applicantId: req.resumeDoc.userId, status: 'completed' },
            include: [
                { model: Job, include: [{ model: User, as: 'owner', attributes: ['id', 'name'] }] },
                { model: Shift, attributes: ['id', 'startAt', 'workedMinutes', 'status'] }
            ],
            order: [['completedAt', 'DESC'], ['id', 'DESC']]
        });

        const careers = applications.map(a => {
            const confirmed = a.Shifts.filter(s => s.status === 'confirmed');
            return {
                applicationId: a.id,
                jobId: a.Job.id,
                jobTitle: a.Job.title,
                category: a.Job.category,
                region: a.Job.region,
                owner: a.Job.owner.name,
                ownerId: a.Job.owner.id,
                startedAt: a.acceptedAt,
                endedAt: a.completedAt,
                // 확정된 실제 근무 기록 (일한 기록이 곧 경력의 근거)
                workedMinutes: confirmed.reduce((sum, s) => sum + (s.workedMinutes || 0), 0),
                workedDays: new Set(confirmed.map(s => dayKey(new Date(s.startAt)))).size,
                noShowCount: a.Shifts.filter(s => s.status === 'no_show').length,
                ownerRating: a.ownerRating
            };
        });

        const rated = careers.filter(c => c.ownerRating !== null);
        ok(res, {
            count: careers.length,
            avgRating: rated.length
                ? Number((rated.reduce((sum, c) => sum + c.ownerRating, 0) / rated.length).toFixed(2))
                : null,
            totalWorkedMinutes: careers.reduce((sum, c) => sum + c.workedMinutes, 0),
            totalWorkedDays: careers.reduce((sum, c) => sum + c.workedDays, 0),
            totalNoShowCount: careers.reduce((sum, c) => sum + c.noShowCount, 0),
            careers
        });
    } catch (err) { next(err); }
};

// POST /resumes - 이력서 작성 (400: 제목·자기소개·희망지역 필수, 한 사람이 여러 개 가능)
exports.create = async (req, res, next) => {
    try {
        const fields = parseFields(req.body, resumeSpec, ['title', 'intro', 'desiredRegion']);
        const resume = await Resume.create({ ...fields, userId: req.user.id });
        ok(res, resume, 201);
    } catch (err) { next(err); }
};

// PATCH /resumes/:id - 이력서 수정 (400)
exports.update = async (req, res, next) => {
    try {
        const fields = parseFields(req.body, resumeSpec);
        if (Object.keys(fields).length === 0) throw new HttpError(400, '수정할 값이 없습니다.');

        await req.resumeDoc.update(fields);
        ok(res, req.resumeDoc);
    } catch (err) { next(err); }
};

// DELETE /resumes/:id - 이력서 삭제 (409: 대기·확정 지원에 사용 중)
// 완료·거절된 지원은 resumeId 만 null 이 되고 남는다 (경력은 applicantId 로 조회하므로 끊기지 않는다)
exports.remove = async (req, res, next) => {
    try {
        const inUse = await Application.count({
            where: { resumeId: req.resumeDoc.id, status: { [Op.in]: ['pending', 'accepted'] } }
        });
        if (inUse > 0)
            throw new HttpError(409, '대기·확정 중인 지원에 쓰인 이력서는 삭제할 수 없습니다.');

        await req.resumeDoc.destroy();
        ok(res, { id: req.resumeDoc.id });
    } catch (err) { next(err); }
};
