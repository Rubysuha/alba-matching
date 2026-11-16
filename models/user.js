const Sequelize = require('sequelize');

// 회원: 계정 정보 (/users)
module.exports = class User extends Sequelize.Model {
    static init(sequelize) {
        return super.init({
            email: { type: Sequelize.STRING(100), allowNull: false, unique: true },
            password: { type: Sequelize.STRING(100), allowNull: false },   // bcrypt 해시
            name: { type: Sequelize.STRING(20), allowNull: false },
            phone: { type: Sequelize.STRING(20), allowNull: true }
        }, {
            sequelize,
            timestamps: true,
            modelName: 'User',
            tableName: 'users',
            paranoid: false,
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
        });
    }

    static associate(db) {
        // 사장님 1 : N 공고
        db.User.hasMany(db.Job, { foreignKey: 'ownerId', onDelete: 'CASCADE' });
        // 알바생 1 : N 이력서
        db.User.hasMany(db.Resume, { foreignKey: 'userId', onDelete: 'CASCADE' });
        // 지원자 1 : N 지원
        db.User.hasMany(db.Application, { foreignKey: 'applicantId', onDelete: 'CASCADE' });
        // 받는 사람 1 : N 알림
        db.User.hasMany(db.Notification, { foreignKey: 'userId', onDelete: 'CASCADE' });
    }
};
