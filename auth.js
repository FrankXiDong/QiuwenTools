const { Mwn } = require('mwn');
const config = require('./config');
const pc = require('picocolors');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 获取 OAuth 2.0 访问令牌
 * @param {string} accountType - 账号类型：'user' 或 'bot'
 * @returns {Promise<string>} 访问令牌
 */
async function getOAuth2Token(accountType = 'bot') {
    const account = config[accountType];
    
    if (!account) {
        console.error(pc.red(`[ERROR] 无效的账号类型: ${accountType}`));
        console.error(pc.red('[INFO] 可用的账号类型: user, bot'));
        process.exit(1);
    }
    
    // MediaWiki OAuth 2.0 Client Credentials Grant
    // Token endpoint usually: /w/rest.php/oauth2/access_token
    const tokenUrl = config.apiUrl.replace('api.php', 'rest.php/oauth2/access_token');
    
    console.log(pc.cyan(`[INFO] 获取 OAuth 2.0 令牌... (${tokenUrl})`));
    
    // 调试信息：显示使用的凭据
    console.log(pc.dim(`[DEBUG] 账号类型: ${accountType}`));
    console.log(pc.dim(`[DEBUG] Client ID: ${account.clientId ? '已设置' : '未设置'}`));
    console.log(pc.dim(`[DEBUG] Client Secret: ${account.clientSecret ? '已设置' : '未设置'}`));
    console.log(pc.dim(`[DEBUG] User Agent: ${account.userAgent}`));
    
    // 检查必要的配置是否存在
    if (!account.clientId || !account.clientSecret) {
        console.error(pc.red('[ERROR] 缺少必要的OAuth2配置:'));
        console.error(pc.red(`  Client ID: ${account.clientId || '未设置'}`));
        console.error(pc.red(`  Client Secret: ${account.clientSecret || '未设置'}`));
        console.error(pc.red('请检查 .env 文件中的配置'));
        process.exit(1);
    }
    
    try {
        // Use global fetch (Node 18+)
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': account.userAgent,
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: account.clientId,
                client_secret: account.clientSecret
            })
        });

        if (!response.ok) {
            const body = await response.text();
            console.error(pc.red(`[ERROR] OAuth2 Token 请求失败: ${response.status}`));
            console.error(pc.red(`响应体: ${body}`));
            throw new Error(`OAuth2 Token fetch failed: ${response.status} ${body}`);
        }

        const data = await response.json();
        console.log(pc.green('[SUCCESS] 成功获取 OAuth2 令牌'));
        
        // 礼貌延时，避免频繁请求
        await sleep(2000);
        
        return data.access_token;
    } catch (e) {
        console.error(pc.red('[FATAL] 无法获取 OAuth 2.0 令牌'), e);
        process.exit(1);
    }
}

/**
 * 创建并初始化 Mwn Bot 实例
 * @param {string} accountType - 账号类型：'user' 或 'bot'
 * @returns {Promise<Mwn>} 初始化完成的 Mwn 实例
 */
async function createBot(accountType = 'bot') {
    const account = config[accountType];
    
    if (!account) {
        console.error(pc.red(`[ERROR] 无效的账号类型: ${accountType}`));
        console.error(pc.red('[INFO] 可用的账号类型: user, bot'));
        process.exit(1);
    }
    
    // 1. 获取 OAuth 2.0 Token
    // 优先使用直接提供的 Access Token，否则尝试通过 Client Credentials 获取
    let accessToken;
    if (account.accessToken) {
        console.log(pc.blue(`[INFO] 使用直接提供的 Access Token (${accountType}账号)`));
        accessToken = account.accessToken;
    } else {
        console.log(pc.blue(`[INFO] 通过 Client Credentials 获取 Access Token (${accountType}账号)`));
        accessToken = await getOAuth2Token(accountType);
    }

    // 2. 初始化 bot 实例
    // 使用 new Mwn() 而不是 init()，因为我们手动处理认证
    const bot = new Mwn({
        apiUrl: config.apiUrl,
        userAgent: account.userAgent,
        defaultParams: {
            assert: 'user', // 强制要求登录状态
            maxlag: 5 
        },
        requestOptions: config.requestOptions
    });

    // 3. 注入 Bearer Token Header
    bot.requestOptions.headers = {
        ...bot.requestOptions.headers,
        'Authorization': `Bearer ${accessToken}`
    };

    // 4. 修复 Authorization header 中的非 ASCII 字符问题
    const originalRequest = bot.request;
    bot.request = async function(params) {
        if (this.requestOptions.headers && this.requestOptions.headers.Authorization) {
            const authHeader = this.requestOptions.headers.Authorization;
            const cleanAuthHeader = authHeader.split('').filter(char => 
                char.charCodeAt(0) <= 255
            ).join('');
            this.requestOptions.headers.Authorization = cleanAuthHeader;
        }
        return originalRequest.call(this, params);
    };

    try {
        // 5. 获取 CSRF Token 等所有需要的 token (edit, delete, etc)
        // Mwn 会自动尝试获取，但我们可以显式调用 getTokens() 确认登录有效
        console.log(pc.blue('[INFO] 验证登录状态并获取编辑令牌...'));
        await bot.getTokens(); // 这会发送一个 meta=tokens 请求，利用 Bearer token 认证
        
        // 礼貌延时，确保服务器稳定
        await sleep(1500);
        
        const user = await bot.userinfo();
        console.log(pc.green(`[INFO] 登录成功，当前身份: ${user.name} (${accountType}账号)`));
        
        // 再次延时，为后续操作留出缓冲
        await sleep(1000);
        
        return bot;
    } catch (e) {
        console.error(pc.red('[FATAL] 初始化失败或认证无效:'), e);
        process.exit(1);
    }
}

module.exports = {
    getOAuth2Token,
    createBot,
    sleep
};
