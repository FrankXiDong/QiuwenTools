require('dotenv').config();

module.exports = {
    apiUrl: process.env.API_URL || 'https://www.qiuwenbaike.cn/api.php',
    apiDelayMs: parseInt(process.env.API_DELAY_MS, 10) || 3000,
    
    // User账号配置（用于需要人工身份的操作）
    user: {
        userAgent: process.env.USER_USER_AGENT || 'Qiuwen/1.1 (Node.js/mwn; +https://www.qiuwenbaike.cn/User:YourUsername)',
        clientId: process.env.USER_OAUTH2_CLIENT_ID,
        clientSecret: process.env.USER_OAUTH2_CLIENT_SECRET,
        accessToken: process.env.USER_OAUTH2_ACCESS_TOKEN,
    },
    
    // Bot账号配置（用于自动化批量操作）
    bot: {
        userAgent: process.env.BOT_USER_AGENT || 'Qiuwen/1.1 (Node.js/mwn; +https://www.qiuwenbaike.cn/User:FDtool)',
        clientId: process.env.BOT_OAUTH2_CLIENT_ID,
        clientSecret: process.env.BOT_OAUTH2_CLIENT_SECRET,
        accessToken: process.env.BOT_OAUTH2_ACCESS_TOKEN,
    },
    
    // 兼容旧配置（临时保留，建议迁移到新结构）
    oauth2: {
        clientId: process.env.OAUTH2_CLIENT_ID,
        clientSecret: process.env.OAUTH2_CLIENT_SECRET,
        accessToken: process.env.OAUTH2_ACCESS_TOKEN
    },
    move_bot: {
        userAgent: process.env.MOVE_BOT_USER_AGENT || process.env.BOT_USER_AGENT,
        clientId: process.env.MOVE_OAUTH2_CLIENT_ID || process.env.OAUTH2_CLIENT_ID,
        clientSecret: process.env.MOVE_OAUTH2_CLIENT_SECRET || process.env.OAUTH2_CLIENT_SECRET,
        accessToken: process.env.OAUTH2_ACCESS_TOKEN,
    },
    // Customize rate limits
    requestOptions: {
        retry: {
            limit: 3,
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            statusCodes: [408, 413, 429, 500, 502, 503, 504],
        }
    }
};