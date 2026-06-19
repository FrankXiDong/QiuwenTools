/* 临时任务：替换[[Category:中国各省已撤销的行政区]]中的“撤消”→“撤销” */
/* https://www.qiuwenbaike.cn/index.php?title=Qiuwen_talk:%E8%8C%B6%E9%A6%86/%E7%BC%96%E8%BE%91&oldid=10913596#%E5%85%B3%E4%BA%8E%E2%80%9C%E6%92%A4%E6%B6%88%E2%80%9D%E2%86%92%E2%80%9C%E6%92%A4%E9%94%80%E2%80%9D%E7%9A%84%E6%9B%BF%E6%8D%A2 */

const { createBot } = require('./auth');
const pc = require('picocolors');
const { handleCatnavTemplate, sleep } = require(    './catnav-handler');
const { moveCategoryMembers } = require('./move-category-members');

// 封装主逻辑，增加错误处理，确保脚本退出状态正确
async function main() {
    // 1. 创建 bot 实例（使用 bot 账号进行自动化批量操作）
    console.log(pc.blue('[INFO] 初始化 Bot 账号...'));
    const bot = await createBot('bot');
    
    let categoryList = [];
    
    // 始终从母分类获取所有子分类
    console.log(pc.blue('[INFO] 从母分类获取所有子分类...'));
    
    // 2. 获取分类列表
    let pageList = await bot.request({
        "action": "query",
        "format": "json",
        "list": "categorymembers",
        "formatversion": "2",
        "cmtitle": "Category:中国各省已撤销的行政区", 
        "cmlimit": "max"
    });
    
    categoryList = pageList.query.categorymembers.map(page => page.title); // 提取标题列表

    // 排除不是分类的页面 (使用 filter 避免 forEach splice 的索引问题)
    categoryList = categoryList.filter(categoryName0 => {
        if (!categoryName0.includes('Category:')) {
            console.debug(pc.yellow(`[SKIP] 非分类页面，跳过：${categoryName0}`));
            return false;
        }
        return true;
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
        
        if (!categoryName0.includes('撤消')){
            console.log(pc.yellow(`[SKIP] 分类名称不包含"撤消"，跳过: ${categoryName0}`));
            continue;
        }

        const newCategoryName = categoryName0.replace('撤消', '撤销');

        const moveResult = await bot.move(categoryName0, newCategoryName, `批量移动"撤消"→"撤销"：[[Special:固定链接/10913596#关于"撤消"→"撤销"的替换]]`);

        if (moveResult && !moveResult.error) {
            console.log(pc.green(`[SUCCESS] 分类 "${categoryName0}" 移动成功，新名称为 "${newCategoryName}"`));
        } else {
            console.error(pc.red(`[ERROR] 分类 "${categoryName0}" 移动失败:`, moveResult?.error || '未知错误'));
            continue;
        }

        // 处理新分类页面的 Catnav 模板
        await handleCatnavTemplate(bot, newCategoryName, 2000);

        const membersResult = await moveCategoryMembers(bot, categoryName0, newCategoryName);

        if (membersResult) {
            console.log(pc.green(`[SUCCESS] 已完成分类成员迁移：${categoryName0} → ${newCategoryName}`));
        } else {
            console.error(pc.red(`[ERROR] 分类成员迁移失败：${categoryName0} → ${newCategoryName}`));
        }

        await sleep(3000);
    }

}

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常