const Sequelize = require('sequelize');

// 이력서: 알바생이 쓰는 구직 문서 (재사용 문서, 상태 없음)
module.exports = class Resume extends Sequelize.Model {
    static init(sequelize) {
        return super.init({
            userId: { type: Sequelize.INTEGER, allowNull: false },
            title: { type: Sequelize.STRING(100), allowNull: false },
            intro: { type: Sequelize.TEXT, allowNull: false },
            desiredRegion: { type: Sequelize.STRING(50), allowNull: false }
        }, {
            sequelize,
            timestamps: true,
            modelName: 'Resume',
            tableName: 'resumes',
            paranoid: false,
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
        });
    }

    static associate(db) {
        db.Resume.belongsTo(db.User, { foreignKey: 'userId' });
        // 이력서를 지워도 완료된 지원은 남긴다 (Application.resumeId 는 null 허용)
        db.Resume.hasMany(db.Application, { foreignKey: 'resumeId', onDelete: 'SET NULL' });
    }
};
