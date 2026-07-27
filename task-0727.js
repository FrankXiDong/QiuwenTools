/* 0727临时任务*/

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

    let pages1 = `1950年电影
1956年电影
1957年电影
1961年电影
1962年电影
1963年电影
1964年电影
1965年电影
1966年电影
1967年电影
1968年电影
1970年电影
1972年电影
1974年电影
1975年电影
1976年电影
1977年电影
1982年电影`
    let pageslist1 = pages1.split('\n')

    // 给每一项添加Category:前缀
    pageslist1 = pageslist1.map(page => `Category:${page}`)

    for (page of pageslist1){
        let wikitext = `{{infilmyr}}`
        bot.save(title=page, wikitext, summary='临时半自动任务：繁简体分类页面互换', minor=true, tags='Bot')
        await sleep(2000);
        console.log(pc.green(`[SUCCESS] 修改页面：${page}`))

        page2 = page.replace('电影','電影')
        let wikitext2 = `{{分类重定向|${page}}}`
        bot.save(title=page2, wikitext2, summary='临时半自动任务：繁简体分类页面互换', minor=true, tags='Bot')
        console.log(pc.green(`[SUCCESS] 创建重定向页面：${page2}`))

        // 移动分类成员
        await moveCategoryMembers(bot, page2, page, 2000);

        await sleep(2000);
    }

}

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常
