const { fn, col } = require('sequelize');
const { sequelize, User, Job, Application, Review } = require('../models');
const { HttpError, ok } = require('../utils/response');
const { positiveInt, ratingOf, text, parseFields, pageOf } = require('../utils/validate');
const notify = require('../utils/notify');

const reviewSpec = {
    score: ratingOf,
    content: v => text(v, 2000)
};

// :ownerId 를 숫자로 바꾸고 그 사용자가 있는지 확인 (404 없는 사용자)
const loadOwnerId = async req => {
    const ownerId = positiveInt(req.params.ownerId);
    if (ownerId === null) throw new HttpError(400, 'ownerId가 올바르지 않습니다.');
    if (!await User.findByPk(ownerId, { attributes: ['id'] }))
        throw new HttpError(404, '사용자를 찾을 수 없습니다.');
    return ownerId;
};

// ★ POST /reviews - 후기 작성
// 검사 순서: 입력(400) → 지원 없음(404) → 내 지원 아님(403) → completed 아님(409) → 이미 작성함(409) → 생성(201)
// 중복은 DB 의 UNIQUE(applicationId) 가 한 번 더 막는다
exports.create = async (req, res, next) => {
    try {
        const applicationId = positiveInt(req.body.applicationId);
        if (applicationId === null) throw new HttpError(400, 'applicationId는 필수입니다.');
        const fields = parseFields(req.body, reviewSpec, ['score']);

        const application = await Application.findByPk(applicationId, { include: [Job] });
        if (!application) throw new HttpError(404, '지원을 찾을 수 없습니다.');
        if (application.applicantId !== req.user.id)
            throw new HttpError(403, '본인의 지원에만 후기를 쓸 수 있습니다.');
        if (application.status !== 'completed')
            throw new HttpError(409, '근무 완료된 지원에만 후기를 쓸 수 있습니다.');
        if (await Review.findOne({ where: { applicationId } }))
            throw new HttpError(409, '이미 후기를 작성한 지원입니다.');

        const review = await sequelize.transaction(async t => {
            // authorId 는 로그인한 사용자, ownerId 는 지원한 공고의 주인으로 서버가 채운다
            const created = await Review.create({
                ...fields,
                applicationId,
                authorId: req.user.id,
                ownerId: application.Job.ownerId
            }, { transaction: t });
            await notify(application.Job.ownerId, 'review_created',
                `'${application.Job.title}' 공고에 새 후기가 등록되었습니다. (평점 ${fields.score})`,
                created.id, { transaction: t });
            return created;
        });
        ok(res, review, 201);
    } catch (err) { next(err); }
};

// GET /reviews/owners/:ownerId - 사장님별 후기 목록 (공개)
exports.listByOwner = async (req, res, next) => {
    try {
        const ownerId = await loadOwnerId(req);
        const { page, limit, offset } = pageOf(req.query);

        const { rows, count } = await Review.findAndCountAll({
            where: { ownerId },
            include: [{ model: User, as: 'author', attributes: ['id', 'name'] }],
            order: [['createdAt', 'DESC'], ['id', 'DESC']],
            limit,
            offset
        });
        ok(res, { ownerId, total: count, page, limit, reviews: rows });
    } catch (err) { next(err); }
};

// GET /reviews/owners/:ownerId/score - 평균 평점·후기 수 (AVG, COUNT 집계)
exports.score = async (req, res, next) => {
    try {
        const ownerId = await loadOwnerId(req);
        const row = await Review.findOne({
            where: { ownerId },
            attributes: [
                [fn('AVG', col('score')), 'avgScore'],
                [fn('COUNT', col('id')), 'count']
            ],
            raw: true
        });
        ok(res, {
            ownerId,
            avgScore: row.avgScore === null ? null : Number(Number(row.avgScore).toFixed(2)),
            count: Number(row.count)
        });
    } catch (err) { next(err); }
};

// PATCH /reviews/:id - 후기 수정 (400)
exports.update = async (req, res, next) => {
    try {
        const fields = parseFields(req.body, reviewSpec);
        if (Object.keys(fields).length === 0) throw new HttpError(400, '수정할 값이 없습니다.');

        await req.review.update(fields);
        ok(res, req.review);
    } catch (err) { next(err); }
};

// DELETE /reviews/:id - 후기 삭제
exports.remove = async (req, res, next) => {
    try {
        await req.review.destroy();
        ok(res, { id: req.review.id });
    } catch (err) { next(err); }
};
