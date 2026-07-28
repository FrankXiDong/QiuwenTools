/* 0728临时任务*/

const { createBot } = require('./auth');
const { logError } = require('./script/log');
const { moveCategoryMembers } = require('./script/move-category-members');
const pc = require('picocolors');

// 延时函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 封装主逻辑，增加错误处理，确保脚本退出状态正确
async function main() {
    // 1. 创建 bot 实例
    console.log(pc.blue(`[INFO] 初始化 bot 账号...`));
    const bot = await createBot('bot');

    // 获取分类成员列表
    console.log(pc.blue(`[INFO] 获取分类成员列表...`));
    const result = await bot.query({
        action: 'query',
        list: 'categorymembers',
        cmtitle: 'Category:各年美國電影作品',
        cmlimit: 500,
    });

    const pages = result.query.categorymembers;

    console.log(pc.blue(`[INFO] 获取分类成员列表完成，共 ${pages.length} 个成员`));

    await sleep(2000);

    for (const page of pages) { 
        if (!page.title.includes('美國電影作品')){
            continue; // 跳过非美國電影作品
        }
        page2 = page.title.replace('美國電影作品', '美国电影作品');
        await bot.move(page.title, page2, '机器人：简体化', true)
        console.log(pc.blue(`[INFO] 移动 ${page.title} 到 ${page2}`));
        await sleep(2000);

        const wikitext = `{{filmyr2|美国}}`
        await bot.save(title=page2, content=wikitext, summary='机器人：修改模板（整理代码）', tags='Bot')
        console.log(pc.blue(`[INFO] 修改模板 ${page2}`));
        await sleep(2000);

        await moveCategoryMembers(bot, page.title , page2, 2000);
        await sleep(1000);
    }
}

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常
