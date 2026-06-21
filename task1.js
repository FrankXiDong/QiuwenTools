/* [机器人任务1] 批量移动分类："中国各朝代"→"中国各时期" */

const { createBot } = require('./auth');
const pc = require('picocolors');
const { handleCatnavTemplate, sleep } = require('./catnav-handler');
const { moveCategoryMembers } = require('./move-category-members');

// 解析命令行参数
function parseArgs() {
    const args = process.argv.slice(2);
    
    // 检查帮助参数
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
使用方法: node task1.js --category <分类名称> [选项]

必需参数:
  --category <分类名称>    需要处理的母分类名称（可带或不带 "Category:" 前缀）

可选参数:
  --help, -h              显示此帮助信息

示例:
  node task1.js --category "Category:中国各时期人物"
  node task1.js --category "中国各时期人物"
        `.trim());
        process.exit(0);
    }
    
    // 查找 --category 参数
    const categoryIndex = args.indexOf('--category');
    if (categoryIndex === -1) {
        console.error(pc.red('[ERROR] 缺少必需参数: --category'));
        console.error(pc.yellow('请使用 --help 查看使用说明'));
        process.exit(1);
    }
    
    if (categoryIndex + 1 >= args.length) {
        console.error(pc.red('[ERROR] --category 参数后必须指定分类名称'));
        console.error(pc.yellow('请使用 --help 查看使用说明'));
        process.exit(1);
    }
    
    let categoryName = args[categoryIndex + 1];
    
    // 自动补全 Category: 前缀
    if (!categoryName.startsWith('Category:') && !categoryName.startsWith('category:')) {
        categoryName = 'Category:' + categoryName;
    }
    
    return {
        category: categoryName
    };
}

// 封装主逻辑，增加错误处理，确保脚本退出状态正确
async function main() {
    // 解析命令行参数
    const { category } = parseArgs();
    
    console.log(pc.blue(`[INFO] 目标分类: ${category}`));
    
    // 1. 创建 bot 实例（使用 bot 账号进行自动化批量操作）
    console.log(pc.blue('[INFO] 初始化 Bot 账号...'));
    const bot = await createBot('bot');

    // 2. 批量修改页面
    let pageList = await bot.request({
        "action": "query",
        "format": "json",
        "list": "categorymembers",
        "formatversion": "2",
        "cmtitle": category,
        "cmlimit": "max"
    });
    
    const categoryList = pageList.query.categorymembers.map(page => page.title); // 提取标题列表
    
    for (let categoryName0 of categoryList) {
        // 确保输入为字符串类型并清理
        if (typeof categoryName0 !== 'string' || !categoryName0.trim()) {
            console.log(pc.yellow(`[SKIP] 无效的分类名称，跳过: ${JSON.stringify(categoryName0)}`));
            continue;
        }
        
        categoryName0 = categoryName0.trim();
        
        // 检查是否包含非法字符
        const illegalCharsPattern = /[{}<>|*#]/;
        if (illegalCharsPattern.test(categoryName0)) {
            console.log(pc.yellow(`[SKIP] 分类名称包含非法字符，跳过: ${categoryName0}`));
            continue;
        }
        
        // 全局替换"中国各朝代"为"中国各时期"
        let categoryName1 = categoryName0.replace(/中国各朝代/g, '中国各时期');
        
        if (categoryName0 === categoryName1){
            console.log(pc.yellow(`[SKIP] 相同标题，跳过移动: ${categoryName0}`));
            continue;
        }
        
        let summary = '半自动：批量移动分类（"中国各朝代"→"中国各时期）（task1）"';
        
        // 执行移动操作
        try {
            await bot.move(categoryName0, categoryName1, summary, {
                reason: summary,
                movesubpages: false,
                ignorewarnings: false,
                watchlist: 'unwatch',
                noredirect: false,
                movetalk: true,
            });
            console.log(pc.green(`[SUCCESS] 已完成移动：${categoryName0} → ${categoryName1}`));
        } catch (moveError) {
            console.error(pc.red(`[ERROR] 移动页面失败 (${categoryName0}):`), moveError.message);
            continue; // 如果移动失败，跳过后续处理
        }
        
        if (categoryName1.includes('Category:')){
            // 处理新分类页面的 Catnav 模板
            await handleCatnavTemplate(bot, categoryName1, 3000);
        }

        // 使用 move-category-members 模块转移分类成员
        console.log(pc.cyan(`[INFO] 开始转移分类成员: ${categoryName0} → ${categoryName1}`));
        try {
            const stats = await moveCategoryMembers(bot, categoryName0, categoryName1, 4000);
            console.log(pc.green(`[COMPLETE] 分类成员转移完成: 成功 ${stats.success}, 跳过 ${stats.skipped}, 失败 ${stats.failed}`));
        } catch (error) {
            console.error(pc.red(`[ERROR] 分类成员转移失败:`), error.message);
        }
    }
 
}

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常