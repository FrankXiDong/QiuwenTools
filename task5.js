/* 任务5：自动清理迁移文件的分类 */

const { createBot } = require('./auth');
const { logError } = require('./script/log');
const { moveCategoryMembers } = require('./script/move-category-members');
const pc = require('picocolors');

// 延时函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function logdata(bot, logcontent) {
    const logPageAlias = 'Special:MyPage/task5';
    
    try {
        
        // 构建日志条目
        let logEntry = `\n# ${logcontent} ——~~~~~`;
        
        // 解析 Special:MyPage 获取实际的页面标题
        // Special:MyPage 会重定向到 User:<username>/task5
        let actualLogPage = logPageAlias;
        try {
            // 首先尝试读取 Special:MyPage/task5 获取重定向信息
            const redirectResult = await bot.request({
                action: 'query',
                titles: logPageAlias,
                redirects: true
            });
            
            // 从响应中提取实际的页面标题
            const pages = redirectResult.query.pages;
            const pageId = Object.keys(pages)[0];
            if (pageId !== '-1' && pages[pageId].title) {
                actualLogPage = pages[pageId].title;
                console.log(pc.cyan(`[INFO] 日志页面实际路径: ${actualLogPage}`));
            }
        } catch (resolveError) {
            // 如果无法解析，使用默认格式
            console.log(pc.yellow(`[WARN] 无法解析 Special:MyPage，使用默认路径`));
            // 尝试获取当前用户名
            try {
                const userInfo = await bot.request({
                    action: 'query',
                    meta: 'userinfo'
                });
                const username = userInfo.query.userinfo.name;
                actualLogPage = `User:${username}/task5`;
                console.log(pc.cyan(`[INFO] 推断日志页面路径: ${actualLogPage}`));
            } catch (userError) {
                console.log(pc.yellow(`[WARN] 无法获取用户名`));
                return false;
            }
        }
        
        // 读取现有日志页面内容
        let existingContent = '';
        try {
            const result = await bot.read(actualLogPage);
            if (result && result.revisions && result.revisions[0]) {
                existingContent = result.revisions[0].content || '';
            }
        } catch (readError) {
            console.log(pc.red(`[INFO] 日志页面不存在`));
            return false;
        }
        
        // 在现有内容末尾追加新日志
        const newContent = existingContent + logEntry;
        
        // 保存更新后的内容
        const editSummary = `机器人：添加日志 ${logcontent} `;
        await bot.save(actualLogPage, newContent, editSummary, { minor: true });
        
        console.log(pc.green(`[LOG] 日志已记录到 ${actualLogPage}`));
        return true;
        
    } catch (error) {
        // 日志记录失败，输出警告但不中断主流程
        console.error(pc.red(`[WARN] 无法写入错误日志: ${error.message}`));
        return false;
    }
}

// 封装主逻辑，增加错误处理，确保脚本退出状态正确
async function main() {
    // 1. 创建 bot 实例
    console.log(pc.blue(`[INFO] 初始化 bot 账号...`));
    const bot = await createBot('bot');

    const result = await bot.query(
        {
            "format": "json",
            "list": "querypage",
            "formatversion": "2",
            "qppage": "Wantedcategories",
        	"qplimit": "max"
        }
    )

    let pagelist = result?.query?.querypage?.results?.map(item => item.title) || [];  

    // console.log(pc.blue(`[INFO] 获取到缺失的分类列表，共 ${pagelist.length} 个分类，为：${pagelist.join(', ')}`));

    // 只保留以“Photographs by”“Files by”“Images by”“Images translated by”开头的分类
    pagelist = pagelist.filter(title => 
        title.startsWith("Category:People sitting") || // 描述图片内容
        title.startsWith("Category:Photographs by") || // 图片来源、作者或制作设备，下同
        title.startsWith("Category:Files by") ||
        title.startsWith("Category:Images by") ||
        title.startsWith("Category:Images translated by") ||
        title.startsWith("Category:Taken with") ||
        title.startsWith("Category:Pictures from") ||
        title.startsWith("Category:Photos by") ||
        title.startsWith("Category:Photographs with") ||
        title.startsWith("Category:Featured pictures") || // 特色图片
        title.startsWith("Category:Valued images") || 
        title.startsWith("Category:Media needing categorization by") ||
        title.startsWith("Category:Quality") ||
        title.includes("by User:") // 所有包括用户
    );

    console.log(pc.blue(`[INFO] 获取到待处理分类列表，共 ${pagelist.length} 个分类，为：${pagelist.join(', ')}`));


    for (const categoryname of pagelist) {
        const wikitext = `{{分类重定向|迁移文件}}`
        await bot.save(title=categoryname, content=wikitext, summary='机器人：自动创建分类重定向至[[:Category:迁移文件]]', tags='Bot');
        console.log(pc.blue(`[INFO] 完成创建：${categoryname}`));
        await sleep(1500);
        await logdata(bot, `创建[[:Category:${categoryname}]]`);
        await sleep(1500);
    }
    console.log(pc.green(`[INFO] 批量创建完成`));
    await sleep(2000);
    for (const categoryname of pagelist) {
        await moveCategoryMembers(bot, categoryname, 'Category:迁移文件', 1500);
        console.log(pc.blue(`[INFO] 迁移分类成员：${categoryname} -> Category:迁移文件`));
        console.log(pc.green(`[INFO] 所有分类成员迁移完成`));
        await sleep(500);
    }
}

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常
