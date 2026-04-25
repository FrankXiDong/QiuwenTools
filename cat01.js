/* 本工具用于批量删除分类的索引字 */

const { createBot } = require('./auth');
const pc = require('picocolors');

// 封装主逻辑，增加错误处理，确保脚本退出状态正确
async function main() {
    // 1. 创建 bot 实例（使用 bot 账号进行自动化批量操作）
    console.log(pc.blue('[INFO] 初始化 Bot 账号...'));
    const bot = await createBot('bot');

    // 2. 批量修改页面
    const categoryName = '权姓';

    let pageList = await bot.request({
        "action": "query",
        "format": "json",
        "list": "categorymembers",
        "formatversion": "2",
        "cmtitle": `Category:${categoryName}`,
        "cmlimit": "max"
    });
    
    const titleList = pageList.query.categorymembers.map(page => page.title); // 提取标题列表
    
    console.log(pc.cyan(`[INFO] 找到 ${titleList.length} 个页面需要处理`));
    
    for (const Title of titleList) {
        try {
            let summary = `批量删除分类 [[Category:${categoryName}]] 的索引字`;
            
            const originalWikitext = await bot.read(Title);
            let wikitext = originalWikitext.revisions[0].content;
            
            if (!wikitext.includes("{{bd|")) {
                console.log(pc.yellow(`[SKIP] 页面内容不包含 "{{bd|" 模板 (${Title})`));
                continue;
            }
            
            // 匹配带索引字的分类格式：[[Category:分类名 | 索引字]]
            // 正则说明：匹配 [[Category:分类名|任意内容]] 或 [[Category:分类名 | 任意内容]]
            const categoryWithSortKeyPattern = new RegExp(
                `\\[\\[Category:${categoryName}\\s*\\|([^\\]]+)\\]\\]`,
                'g'
            );
            
            // 替换为不带索引字的格式：[[Category:分类名]]
            const targetCategory = `[[Category:${categoryName}]]`;
            
            // 检查是否有带索引字的分类
            const hasSortKey = categoryWithSortKeyPattern.test(wikitext);
            
            if (!hasSortKey) {
                console.log(pc.yellow(`[SKIP] 页面没有带索引字的分类 (${Title})`));
                continue;
            }
            
            // 替换所有带索引字的分类为不带索引字的分类
            wikitext = wikitext.replace(categoryWithSortKeyPattern, targetCategory);

            // 如果没有变化，则跳过保存
            if (wikitext.trim() === originalWikitext.revisions[0].content.trim()) {
                console.log(pc.yellow(`[SKIP] 页面内容无实质变化，跳过保存 (${Title})`));
                continue;
            }
            
            await bot.save(Title, wikitext, summary, { minor: false });
            console.log(pc.green(`[SUCCESS] 已删除分类索引字：${Title}`));

            // 礼貌延时
            await sleep(3000); 

        } catch (error) {
            console.error(pc.red(`修改页面失败 (${Title}):`), error.message);
            console.log(pc.dim(`[WAIT] 等待 5 秒后继续处理下一个页面...`));
            await sleep(5000);
            // 继续处理下一个页面，不要中断整个流程
        }
    }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // 礼貌延时

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常