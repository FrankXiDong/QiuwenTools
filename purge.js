/* 本工具用于批量刷新页面缓存 */

const { Mwn } = require('mwn');
const fs = require('fs');
const config = require('./config');
const pc = require('picocolors');

async function getOAuth2Token() {
    // MediaWiki OAuth 2.0 Client Credentials Grant
    // Token endpoint usually: /w/rest.php/oauth2/access_token
    const tokenUrl = config.apiUrl.replace('api.php', 'rest.php/oauth2/access_token');
    
    console.log(pc.cyan(`[INFO] 获取 OAuth 2.0 令牌... (${tokenUrl})`));
    
    // 调试信息：显示使用的凭据
    console.log(pc.dim(`[DEBUG] Client ID: ${config.move_bot.clientId ? '已设置' : '未设置'}`));
    console.log(pc.dim(`[DEBUG] Client Secret: ${config.move_bot.clientSecret ? '已设置' : '未设置'}`));
    console.log(pc.dim(`[DEBUG] User Agent: ${config.move_bot.userAgent}`));
    
    // 检查必要的配置是否存在
    if (!config.move_bot.clientId || !config.move_bot.clientSecret) {
        console.error(pc.red('[ERROR] 缺少必要的OAuth2配置:'));
        console.error(pc.red(`  Client ID: ${config.move_bot.clientId || '未设置'}`));
        console.error(pc.red(`  Client Secret: ${config.move_bot.clientSecret || '未设置'}`));
        console.error(pc.red('请检查 .env 文件中的配置'));
        process.exit(1);
    }
    
    try {
        // Use global fetch (Node 18+)
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': config.move_bot.userAgent
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: config.move_bot.clientId,
                client_secret: config.move_bot.clientSecret
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
        return data.access_token;
    } catch (e) {
        console.error(pc.red('[FATAL] 无法获取 OAuth 2.0 令牌'), e);
        process.exit(1);
    }
}

// 封装主逻辑，增加错误处理，确保脚本退出状态正确
async function main() {
    // 1. 获取 OAuth 2.0 Token
    // 优先使用直接提供的 Access Token，否则尝试通过 Client Credentials 获取
    let accessToken;
    if (config.move_bot.accessToken) {
        console.log(pc.blue('[INFO] 使用直接提供的 Access Token'));
        accessToken = config.move_bot.accessToken;
    } else {
        console.log(pc.blue('[INFO] 通过 Client Credentials 获取 Access Token'));
        accessToken = await getOAuth2Token();
    }

    // 2. 初始化 bot 实例
    // 使用 new Mwn() 而不是 init()，因为我们手动处理认证
    const bot = new Mwn({
        apiUrl: config.apiUrl,
        userAgent: config.move_bot.userAgent,
        defaultParams: {
            assert: 'user', // 强制要求登录状态
            maxlag: 5 
        }
    });

    const originalRequest = bot.request;
    bot.request = async function(params) {
        // 确保headers中的Authorization值只包含ASCII字符
        if(this.requestOptions.headers && this.requestOptions.headers.Authorization) {
            const authHeader = this.requestOptions.headers.Authorization;
            const cleanAuthHeader = authHeader.split('').filter(char => 
                char.charCodeAt(0) <= 255
            ).join('');
            this.requestOptions.headers.Authorization = cleanAuthHeader;
        }
        return originalRequest.call(this, params);
    };

    // 3. 注入 Header
    bot.requestOptions.headers = {
        ...bot.requestOptions.headers,
        'Authorization': `Bearer ${accessToken}`
    };

    try {
        // 4. 获取 CSRF Token 等所有需要的 token (edit, delete, etc)
        console.log(pc.blue('[INFO] 验证登录状态并获取编辑令牌...'));
        await bot.getTokens(); // 这会发送一个 meta=tokens 请求，利用 Bearer token 认证
        
        const user = await bot.userinfo();
        console.log(pc.green(`[INFO] 登录成功，当前身份: ${user.name}`));

        // 新增：加载站点信息以确保命名空间数据可用
        console.log(pc.blue('[INFO] 加载站点信息...'));
        await bot.getSiteInfo();

    } catch (e) {
        console.error(pc.red('[FATAL] 初始化失败或认证无效:'), e);
        process.exit(1);
    }

    // 5. 批量刷新页面缓存
    const cat = true;
    let titles = []; // 在函数开头声明
    
    if (cat === false) {
        let titleTemplate = '中国中央电视台{year}年春节联欢晚会';
        for (let i = 1983; i <= 2016; i++) {
            titles.push(titleTemplate.replace('{year}', i));
        }
    }
    else {
        const result = await bot.getPagesInCategory('Category:中華民國');
        console.log(pc.dim('[DEBUG] getPagesInCategory 原始返回类型:'), typeof result, Array.isArray(result));
        
        // 提取标题字符串 - 确保只处理字符串
        titles = result.map((page, index) => {
            if (typeof page === 'string') {
                return page;
            } else if (page && typeof page === 'object' && page.title) {
                return page.title;
            } else {
                console.warn(pc.yellow(`[WARN] 第${index}个元素不是有效标题:`, page));
                return null;
            }
        }).filter(title => title !== null); // 过滤掉无效值
        
        console.log(pc.dim('[DEBUG] 处理后的 titles 类型:'), typeof titles, Array.isArray(titles));
    }
    
    console.log(pc.green(`[SUCCESS] 获取了以下 ${titles.length} 个页面标题:`), titles);
    
    // 验证所有标题都是字符串
    const invalidTitles = titles.filter(t => typeof t !== 'string');
    if (invalidTitles.length > 0) {
        console.error(pc.red('[ERROR] 发现非字符串标题:'), invalidTitles);
        process.exit(1);
    }
    
    await sleep(5000);
    console.log(pc.blue('[INFO] 开始刷新页面缓存...'));
    // 将titles转为string，xx|xx|xx|...的格式，确保传递给API的是字符串
    //titles = titles.join('|');
    //console.debug(pc.dim('[DEBUG] 传递给 purge API 的 titles:'), titles);
    const request_result = await bot.purge(titles= titles);
    console.log(pc.green(`[SUCCESS] 刷新了 ${titles.length} 个页面的缓存，结果:`), request_result);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // 礼貌延时

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常