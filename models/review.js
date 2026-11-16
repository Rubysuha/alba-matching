const Sequelize = require('sequelize');

// 후기: 완료된 지원 1건당 1개 (applicationId UNIQUE). 평판은 공고가 아니라 사장님(ownerId)에게 쌓인다
module.exports = class Review extends Sequelize.Model {
    static init(sequelize) {
        return super.init({
            applicationId: { type: Sequelize.INTEGER, allowNull: false, unique: true },
            authorId: { type: Sequelize.INTEGER, allowNull: false },
            ownerId: { type: Sequelize.INTEGER, allowNull: false },
            score: { type: Sequelize.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
            content: { type: Sequelize.TEXT, allowNull: true }
        }, {
            sequelize,
            timestamps: true,
            modelName: 'Review',
            tableName: 'reviews',
            paranoid: false,
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci',
        });
    }

    static associate(db) {
        db.Review.belongsTo(db.Application, { foreignKey: 'applicationId' });
        db.Review.belongsTo(db.User, { as: 'author', foreignKey: 'authorId' });
        db.Review.belongsTo(db.User, { as: 'owner', foreignKey: 'ownerId' });
    }
};
