/* [机器人任务1] 批量移动分类："中国各朝代"→"中国各时期" */

const { createBot } = require('./auth');
const pc = require('picocolors');
const { handleCatnavTemplate, sleep } = require('./catnav-handler');

// 封装主逻辑，增加错误处理，确保脚本退出状态正确
async function main() {
    // 1. 创建 bot 实例（使用 bot 账号进行自动化批量操作）
    console.log(pc.blue('[INFO] 初始化 Bot 账号...'));
    const bot = await createBot('bot');

    // 2. 批量修改页面
    let pageList = await bot.request({
        "action": "query",
        "format": "json",
        "list": "categorymembers",
        "formatversion": "2",
        "cmtitle": "Category:中国各时期司法", // 在此处修改需要清理、批量移动的母分类
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
        
        let summary = '批量移动分类："中国各朝代"→"中国各时期"';
        
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

        // 修改页面中的分类
        // 注意：这里查询的是移动前的分类名 categoryName0，因为成员关系可能还没完全更新到新分类，或者我们需要从旧分类获取成员列表来批量修改
        let memberPageList = await bot.request({
            "action": "query",
            "format": "json",
            "list": "categorymembers",
            "formatversion": "2",
            "cmtitle": categoryName0,
            "cmlimit": "max"
        });
        
        const titleList = memberPageList.query.categorymembers.map(page => page.title); // 提取标题列表
        for (const Title of titleList) {
            const result2 = await bot.read(Title);
            let wikitext = result2.revisions[0].content;

            // 处理分类：先尝试替换现有分类，如果没有则添加新的分类
            // 从categoryName0中提取原分类名称（去掉"Category:"前缀）
            const sourceCategoryName = categoryName0.replace(/^Category:/, '');
            // 从categoryName1中提取目标分类名称（去掉"Category:"前缀）
            const targetCategoryName = categoryName1.replace(/^Category:/, '');
            
            // 构建动态的正则表达式，匹配源分类
            const categoryPattern = new RegExp(`\\[\\[Category:${sourceCategoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\|(.*?))?\\]\\]`, 'g');
            const targetCategory = `[[Category:${targetCategoryName}]]`;
            
            // 检查是否已经存在目标分类格式
            const hasTargetCategory = wikitext.includes(`Category:${targetCategoryName}`);
            
            if (!hasTargetCategory) {
                // 如果不存在目标分类，则替换旧分类或添加新分类
                if (categoryPattern.test(wikitext)) {
                    // 存在旧分类，进行替换
                    wikitext = wikitext.replace(categoryPattern, targetCategory);
                    // 移除可能存在的其他旧分类实例
                    wikitext = wikitext.replaceAll(categoryPattern, '');
                } else {
                    // 不存在任何相关分类，在末尾添加新分类
                    wikitext = wikitext.trim() + '\n\n' + targetCategory;
                }
            }

            // 如果没有变化，或变化只有空格、行数等无实质内容的修改，则跳过保存
            if (wikitext.trim() === result2.revisions[0].content.trim()) {
                console.log(pc.yellow(`[SKIP] 页面内容无实质变化，跳过保存 (${Title})`));
                continue;
            }
            
            let saveSummary = '批量移动分类："中国各朝代"→"中国各时期"';
            await bot.save(Title, wikitext, saveSummary, { minor: false });
            console.log(pc.green(`[SUCCESS] 已移动页面分类并添加参数：${Title}`));

            // 礼貌延时
            await sleep(4000); 
        }
    }
 
}

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常