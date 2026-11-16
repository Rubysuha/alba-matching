const Sequelize = require('sequelize');

// 공고: 사장님이 쓰는 구인 문서 (모집중 → 마감)
module.exports = class Job extends Sequelize.Model {
    static init(sequelize) {
        return super.init({
            ownerId: { type: Sequelize.INTEGER, allowNull: false },
            title: { type: Sequelize.STRING(100), allowNull: false },
            category: { type: Sequelize.STRING(50), allowNull: true },
            region: { type: Sequelize.STRING(50), allowNull: false },
            pay: { type: Sequelize.INTEGER, allowNull: false },                 // 시급
            headcount: { type: Sequelize.INTEGER, allowNull: false, validate: { min: 1 } },
            status: { type: Sequelize.ENUM('open', 'closed'), allowNull: false, defaultValue: 'open' }
        }, {
            sequelize,
            timestamps: true,
            modelName: 'Job',
            tableName: 'jobs',
            paranoid: false,
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
        });
    }

    static associate(db) {
        db.Job.belongsTo(db.User, { as: 'owner', foreignKey: 'ownerId' });
        // 공고 1 : N 지원 (공고를 지우면 대기·거절 지원도 함께 삭제)
        db.Job.hasMany(db.Application, { foreignKey: 'jobId', onDelete: 'CASCADE' });
    }
};
