require('dotenv').config();

const base = {
    username: process.env.DB_USER || 'root',
    
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'mysql',
    logging: false
};

const name = process.env.DB_NAME || 'alba_matching';

module.exports = {
    development: { ...base, database: name },
    test: { ...base, database: `${name}_test` }   // 테스트는 별도 DB를 쓴다 (실제 데이터 보호)
};
