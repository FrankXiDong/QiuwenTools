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
        title.startsWith("Category:Photographs by") ||
        title.startsWith("Category:Files by") ||
        title.startsWith("Category:Images by") ||
        title.startsWith("Category:Images translated by") ||
        title.startsWith("Category:People sitting")
    );

    console.log(pc.blue(`[INFO] 获取到待处理分类列表，共 ${pagelist.length} 个分类，为：${pagelist.join(', ')}`));


    for (const page of pagelist) {
        categoryname = "Category:" + page
        const wikitext = `{{分类重定向|迁移文件}}`
        await bot.save(title=categoryname, content=wikitext, summary='机器人：批量清理以“Photographs by”开头的分类', tags='Bot');
        console.log(pc.blue(`[INFO] 完成创建：${categoryname}`));
        await sleep(2500);
    }
    console.log(pc.green(`[INFO] 批量创建完成`));
    await sleep(2000);
    for (const page of pagelist) {
        categoryname = "Category:" + page
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
