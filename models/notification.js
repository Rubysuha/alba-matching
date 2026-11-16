const Sequelize = require('sequelize');
const { NOTIFICATION_TYPES } = require('../utils/constants');

// 알림: 사람이 아니라 서버가 만든다 (utils/notify.js). 안읽음 → 읽음
module.exports = class Notification extends Sequelize.Model {
    static init(sequelize) {
        return super.init({
            userId: { type: Sequelize.INTEGER, allowNull: false },       // 받는 사람
            type: { type: Sequelize.ENUM(...NOTIFICATION_TYPES), allowNull: false },
            message: { type: Sequelize.STRING(255), allowNull: false },
            targetId: { type: Sequelize.INTEGER, allowNull: true },      // 관련 지원·일정·정산서·후기 id
            isRead: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false }
        }, {
            sequelize,
            timestamps: true,
            modelName: 'Notification',
            tableName: 'notifications',
            paranoid: false,
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
        });
    }

    static associate(db) {
        db.Notification.belongsTo(db.User, { foreignKey: 'userId' });
    }
};
