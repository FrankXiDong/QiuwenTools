/* 本工具用于批量删除分类的索引字 */

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
        // Mwn 会自动尝试获取，但我们可以显式调用 getTokens() 确认登录有效
        console.log(pc.blue('[INFO] 验证登录状态并获取编辑令牌...'));
        await bot.getTokens(); // 这会发送一个 meta=tokens 请求，利用 Bearer token 认证
        
        const user = await bot.userinfo();
        console.log(pc.green(`[INFO] 登录成功，当前身份: ${user.name}`));

    } catch (e) {
        console.error(pc.red('[FATAL] 初始化失败或认证无效:'), e);
        process.exit(1);
    }

    // 5. 批量修改页面
    const categoryName = '权姓';

    let pageList = await bot.request({
        "action": "query",
        "format": "json",
        "list": "categorymembers",
        "formatversion": "2",
        "cmtitle": `Category:${categoryName}`,
        "cmlimit": "max"
    })
    const titleList = pageList.query.categorymembers.map(page => page.title); // 提取标题列表
    
    console.log(pc.cyan(`[INFO] 找到 ${titleList.length} 个页面需要处理`));
    
    for (const Title of titleList) {
        try {
            let summary = `批量删除分类 [[Category:${categoryName}]] 的索引字`;
            
            const originalWikitext = await bot.read(Title);
            let wikitext = originalWikitext.revisions[0].content;
            if (!wikitext.includes("{{bd|")) {
                console.log(pc.yellow(`[SKIP] 页面内容不包含 "{{bd|" 模板 (${Title})`));
                continue;
            }
            // 匹配带索引字的分类格式：[[Category:分类名 | 索引字]]
            // 正则说明：匹配 [[Category:分类名|任意内容]] 或 [[Category:分类名 | 任意内容]]
            const categoryWithSortKeyPattern = new RegExp(
                `\\[\\[Category:${categoryName}\\s*\\|([^\\]]+)\\]\\]`,
                'g'
            );
            
            // 替换为不带索引字的格式：[[Category:分类名]]
            const targetCategory = `[[Category:${categoryName}]]`;
            
            // 检查是否有带索引字的分类
            const hasSortKey = categoryWithSortKeyPattern.test(wikitext);
            
            if (!hasSortKey) {
                console.log(pc.yellow(`[SKIP] 页面没有带索引字的分类 (${Title})`));
                continue;
            }
            
            // 替换所有带索引字的分类为不带索引字的分类
            wikitext = wikitext.replace(categoryWithSortKeyPattern, targetCategory);

            // 如果没有变化，则跳过保存
            if (wikitext.trim() === originalWikitext.revisions[0].content.trim()) {
                console.log(pc.yellow(`[SKIP] 页面内容无实质变化，跳过保存 (${Title})`));
                continue;
            }
            
            await bot.save(Title, wikitext, summary, {minor: false});
            console.log(pc.green(`[SUCCESS] 已删除分类索引字：${Title}`));

            await sleep(2000); 

        } catch (error) {
            console.error(pc.red(`修改页面失败 (${Title}):`), error.message);
            console.log(pc.dim(`[WAIT] 等待 5 秒后继续处理下一个页面...`));
            await sleep(5000);
            // 继续处理下一个页面，不要中断整个流程
        }
    }
}


const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // 礼貌延时

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常