/* 本工具用于批量处理位于“已逾一个月的新闻动态”分类中的页面。
 * 对于包含 {{Current}} 模板或任何重定向到该模板的模板的页面，
 * 交由操作员选择：保留模板、替换为 {{Update}} 或者完全移除。
 */

const { Mwn } = require('mwn');
const fs = require('fs');
const config = require('./config');
const pc = require('picocolors');
const readline = require('readline');

// 创建一个全局 readline 实例用于交互
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

// 获取模板及其所有重定向标题
async function getTemplateAndRedirects(bot, name) {
    const res = await bot.request({
        action: 'query',
        format: 'json',
        list: 'backlinks',
        bltitle: `Template:${name}`,
        blnamespace: 10, // 模板
        blfilterredir: 'redirects',
        bllimit: 'max'
    });
    const redirects = res.query.backlinks.map(b => b.title.replace(/^Template:/, ''));
    return [name, ...redirects];
}

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

    // 5. 批量处理“已逾一个月的新闻动态”分类中的页面
    let pageList = await bot.request({
        action: "query",
        format: "json",
        list: "categorymembers",
        formatversion: "2",
        cmtitle: "Category:已逾一个月的新闻动态",
        cmlimit: "max"
    });
    const titleList = pageList.query.categorymembers.map(page => page.title);

    // 获取所有 current 及其重定向模板名称
    const currentTemplates = await getTemplateAndRedirects(bot, 'Current');
    const currentNamesPattern = currentTemplates
        .map(t => t.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'))
        .join('|');
    // 使用正向前瞻替代 \b，以兼容中文/非拉丁字符的模板名
    const currentRegex = new RegExp(
        '\\{\\{\\s*(?:' + currentNamesPattern + ')(?=[\\s\\|\\}])[^{}]*\\}\\}',
        'gi'
    );
    // 同时准备 update 模板集合，用于跳过已有 update 的页面并避免重复添加
    const updateTemplates = await getTemplateAndRedirects(bot, 'Update');
    const updateNamesPattern = updateTemplates
        .map(t => t.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'))
        .join('|');
    const updateRegex = new RegExp(
        '\\{\\{\\s*(?:' + updateNamesPattern + ')(?=[\\s\\|\\}])[^{}]*\\}\\}', // 匹配 {{Update}} 及其重定向模板
        'gi'
    );

    for (const Title of titleList) {
        if (Title.includes('Category:')) {
            console.debug(pc.yellow(`[SKIP] 页面是分类页面，跳过 (${Title})`));
            continue;
        }
        try {
            const originalWikitext = await bot.read(Title);
            let wikitext = originalWikitext.revisions[0].content;

            const matches = [...wikitext.matchAll(currentRegex)].map(m => m[0]);
            if (matches.length === 0) {
                console.log(pc.yellow(`[WARNING] 无{{Current}}相关模板: (${Title})`));
                continue;
            }

            // 交互式处理
            console.log(`\n======== ${Title} ========`);
            console.log('检测到以下模板调用：');
            [...new Set(matches)].forEach(m => console.log('  ' + m));

            let decision;
            while (true) {
                decision = (await ask('(k)eep 模板 / (u)pdate 替换为 {{Update}} / (r)emove 模板: ')).toLowerCase();
                if (['k','u','r'].includes(decision)) break;
                console.log('请输入 k、u 或 r。');
            }

            if (decision === 'k') {
                console.log(pc.blue('[INFO] 保留原有模板，不做更改'));                
                continue;
            }

            if (decision === 'u') {
                // 如果页面已包含 update 模板，则不需要处理
                if (updateRegex.test(wikitext)) {
                    console.log(pc.yellow(`[SKIP] 页面已包含{{Update}}或其重定向模板，跳过 (${Title})`));
                    wikitext = wikitext.replace(currentRegex, ''); // 直接移除 current 模板，避免重复添加 update
                }
                // 替换当前模板为 Update
                wikitext = wikitext.replace(currentRegex, '{{subst:update/auto}}');
            } else if (decision === 'r') {
                wikitext = wikitext.replace(currentRegex, '');
            }

            if (wikitext.trim() === originalWikitext.revisions[0].content.trim()) {
                console.log(pc.yellow(`[SKIP] 修改后内容与原文相同，跳过保存 (${Title})`));
                continue;
            }

            const summary = decision === 'u' ? '快速清理“[[:Category:已逾一个月的新闻动态]]：将{{Current}}模板替换为{{Update}}' : '快速清理“[[:Category:已逾一个月的新闻动态]]：移除{{Current}}模板';
            await bot.save(Title, wikitext, summary, { minor: false });
            console.log(pc.green(`[SUCCESS] ${summary} - ${Title}`));

            await sleep(20);
        } catch (error) {
            console.error(pc.red(`处理页面失败 (${Title}):`), error.message);
            console.log(pc.dim(`[WAIT] 等待5秒后继续处理下一个页面...`));
            await sleep(5000);
        }
    }
    // 关闭 readline
    rl.close();
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // 礼貌延时

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常