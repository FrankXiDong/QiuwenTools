/* 0803临时任务*/

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

    // 获取分类列表
    const pagelist=[
        "Photographs by Dietmar Rabich/Quality images of trees",
        "Photographs by Dietmar Rabich/Architectural photography",
        "Photographs by Dietmar Rabich/Black-and-white photography",
        "Photographs by Dietmar Rabich/Year/2017",
        "Photographs by Dietmar Rabich/Night photography",
        "Photographs by Dietmar Rabich/Landscape photography",
        "Photographs by Dietmar Rabich/Contre-jour photography",
        "Photographs by Vauxford — 2018",
        "Photographs by Erik van Leeuwen",
        "Photographs by Dietmar Rabich/Quality images of photo art",
        "Photographs by Dietmar Rabich/Still-life photography",
        "Photographs by Victor Segalen",
        "Photographs by Dietmar Rabich/Reflections",
        "Photographs by Dietmar Rabich/Photo art",
        "Photographs by Dietmar Rabich/Year/2020",
        "Photographs by Dietmar Rabich/Light trails",
        "Photographs by User:Diliff",
        "Photographs by Dietmar Rabich/Quality images of buildings",
        "Photographs by Dietmar Rabich/Bokeh",
        "Photographs by Dietmar Rabich/Year/2019",
        "Photographs by Dietmar Rabich/Quality images of landscapes",
        "Photographs by Pbdragonwang taken in 2012",
        "Photographs by order 242"
    ]

    /* done
    for (const page of pagelist) {
        categoryname = "Category:" + page
        const wikitext = `{{分类重定向|迁移文件}}`
        await bot.save(title=categoryname, content=wikitext, summary='机器人：批量清理以“Photographs by”开头的分类', tags='Bot');
        console.log(pc.blue(`[INFO] 创建：${categoryname}`));
        await sleep(3000);
    }
    console.log(pc.blue(`[INFO] 批量创建完成`));
    */
    for (const page of pagelist) {
        categoryname = "Category:" + page
        await moveCategoryMembers(bot, categoryname, 'Category:迁移文件', 1500);
        console.log(pc.blue(`[INFO] 迁移分类成员：${categoryname} -> Category:迁移文件`));
        await sleep(500);
    }
}

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常
