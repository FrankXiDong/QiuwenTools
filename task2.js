/* [机器人任务2] 批量移动分类 */

const { createBot } = require('./auth');
const pc = require('picocolors');
const { handleCatnavTemplate, sleep } = require('./catnav-handler');
const { moveCategoryMembers } = require('./move-category-members');

// 封装主逻辑，增加错误处理，确保脚本退出状态正确
async function main() {
    // 1. 创建 bot 实例（使用 bot 账号进行自动化批量操作）
    console.log(pc.blue('[INFO] 初始化 Bot 账号...'));
    const bot = await createBot('bot');

    // 2. 获取分类列表
    let pageList = await bot.request({
        "action": "query",
        "format": "json",
        "list": "categorymembers",
        "formatversion": "2",
        "cmtitle": "Category:各年加入中国共产党的人物", // 在此处修改需要清理、批量移动的母分类
        "cmlimit": "max"
    });
    
    const categoryList = pageList.query.categorymembers.map(page => page.title); // 提取标题列表

    // 排除不是分类的页面
    categoryList.forEach(categoryName0 => {
        if (!categoryName0.includes('Category:')) {
            console.debug(pc.yellow(`[SKIP] 非分类页面，跳过：${categoryName0}`));
            categoryList.splice(categoryList.indexOf(categoryName0), 1); // 从列表中删除非分类页面
        }
    });
    
    // 3. 批量处理分类
    for (let categoryName0 of categoryList) {
        // 确保输入为字符串类型并清理
        if (typeof categoryName0 !== 'string' || !categoryName0.trim()) {
            console.log(pc.yellow(`[SKIP] 无效的分类名称，跳过: ${JSON.stringify(categoryName0)}`));
            continue;
        }
        
        categoryName0 = categoryName0.trim(); // 清理输入
        
        // 检查是否包含非法字符
        const illegalCharsPattern = /[{}<>|*#]/;
        if (illegalCharsPattern.test(categoryName0)) {
            console.log(pc.yellow(`[SKIP] 分类名称包含非法字符，跳过: ${categoryName0}`));
            continue;
        }
        
        // 检查与"中国共产党党员（xxxx年入党）"同年的"xxxx年加入中国共产党的人物"分类是否存在，如不存在则移动至该新分类
        
        // 提取年份模式：匹配 "Category:中国共产党党员（xxxx年入党）" 格式
        const yearPattern = /^Category:中国共产党党员[（(](\d{4})年入党[）)]$/;
        const match = categoryName0.match(yearPattern);
        
        if (match) {
            const year = match[1];
            const targetCategory = `Category:${year}年加入中国共产党的人物`;
            
            console.log(pc.cyan(`[INFO] 检测到年份分类: ${categoryName0}, 目标分类: ${targetCategory}`));
            
            // 检查目标分类是否存在
            try {
                const checkResult = await bot.request({
                    action: 'query',
                    format: 'json',
                    titles: targetCategory
                });

                sleep(1000);
                
                const pages = checkResult.query.pages;
                const pageId = Object.keys(pages)[0];
                const targetExists = pageId !== '-1' && !pages[pageId].missing;
                
                if (targetExists) {
                    console.log(pc.yellow(`[SKIP] 目标分类已存在: ${targetCategory}，跳过移动`));
                    continue;
                }
                
                // 目标分类不存在，执行移动操作（将创建新的目标分类）
                const summary = `批量移动分类（[[Qiuwen_talk:茶馆/存档/编辑/2026年04月#关于Category:依入党年份分类的中国共产党党员]]"`;
                
                await bot.move(categoryName0, targetCategory, summary, {
                    reason: summary,
                    movesubpages: false,
                    ignorewarnings: false,
                    watchlist: 'unwatch',
                    noredirect: false,
                    movetalk: true,
                });
                
                console.log(pc.green(`[SUCCESS] 已完成移动：${categoryName0} → ${targetCategory}`));
                
                // 转移原分类的成员到新分类
                console.log(pc.cyan(`[INFO] 开始转移分类成员...`));
                await moveCategoryMembers(bot, categoryName0, targetCategory, 5000);
                
                // 处理新分类页面的 Catnav 模板
                await handleCatnavTemplate(bot, targetCategory, 3000);

                sleep(5000); //  等待5秒
                
            } catch (error) {
                console.error(pc.red(`[ERROR] 处理分类失败 (${categoryName0}):`), error.message);
                continue;
            }
        } else {
            console.log(pc.yellow(`[SKIP] 不匹配年份分类模式，跳过: ${categoryName0}`));
        }
    }
 
}

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常