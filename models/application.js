const Sequelize = require('sequelize');

// 지원: 공고와 이력서를 잇는 중간 테이블이면서 자기 상태를 가진다
// 대기(pending) → 확정(accepted) → 완료(completed) / 거절(rejected, 끝)
module.exports = class Application extends Sequelize.Model {
    static init(sequelize) {
        return super.init({
            jobId: { type: Sequelize.INTEGER, allowNull: false },
            resumeId: { type: Sequelize.INTEGER, allowNull: true },
            applicantId: { type: Sequelize.INTEGER, allowNull: false },
            status: {
                type: Sequelize.ENUM('pending', 'accepted', 'completed', 'rejected'),
                allowNull: false,
                defaultValue: 'pending'
            },
            message: { type: Sequelize.STRING(500), allowNull: true },
            ownerRating: { type: Sequelize.INTEGER, allowNull: true, validate: { min: 1, max: 5 } },   // 사장님이 매기는 성실도
            acceptedAt: { type: Sequelize.DATE, allowNull: true },
            completedAt: { type: Sequelize.DATE, allowNull: true }
        }, {
            sequelize,
            timestamps: true,
            modelName: 'Application',
            tableName: 'applications',
            paranoid: false,
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
            indexes: [
                // 같은 공고에 같은 사람은 한 번만 지원 (거절당해도 재지원 불가)
                { unique: true, fields: ['jobId', 'applicantId'] }
            ]
        });
    }

    static associate(db) {
        db.Application.belongsTo(db.Job, { foreignKey: 'jobId' });
        db.Application.belongsTo(db.Resume, { foreignKey: 'resumeId' });
        db.Application.belongsTo(db.User, { as: 'applicant', foreignKey: 'applicantId' });
        // 지원 1 : 1 후기
        db.Application.hasOne(db.Review, { foreignKey: 'applicationId', onDelete: 'CASCADE' });
        // 지원 1 : N 근무 일정, 정산서
        db.Application.hasMany(db.Shift, { foreignKey: 'applicationId', onDelete: 'CASCADE' });
        db.Application.hasMany(db.Payroll, { foreignKey: 'applicationId', onDelete: 'CASCADE' });
    }
};
