/* 本工具用于批量修改页面分类 */

const { createBot } = require('./auth');
const pc = require('picocolors');

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
        "cmtitle": "Category:中华人民共和国地方性法规",
        "cmlimit": "max"
    })
    const titleList = pageList.query.categorymembers.map(page => page.title); // 提取标题列表
    
    // 使用正确的 for 循环语法和 move 方法参数
    for (const Title of titleList) {
        if (!Title.includes('黑龙江省')) {
            // console.debug(pc.yellow(`[SKIP] 页面不包含“黑龙江省”，跳过 (${Title})`));
            continue; // 跳过不包含“黑龙江省”的页面
        }
        if (Title.includes('Category:')) {
            console.debug(pc.yellow(`[SKIP] 页面是分类页面，跳过 (${Title})`));
            continue; // 跳过分类页面
        }
        try {
            let summary = '快速移动页面分类：[[:Category:中华人民共和国地方性法规]]→[[:Category:黑龙江省地方性法规]]';
            // const summary = '回退对文件名的修改';；同时添加模板参数
            
            const originalWikitext = await bot.read(Title);
            let wikitext = originalWikitext.revisions[0].content;
            
            // 处理分类：先尝试替换现有分类，如果没有则添加新的分类
            const categoryPattern = /\[\[Category:中华人民共和国地方性法规(?:\|(.*?))?\]\]/g;
            const targetCategory = `[[Category:黑龙江省地方性法规]]`;
            
            // 检查是否已经存在目标分类格式
            const hasTargetCategory = wikitext.includes(`Category:中华人民共和国地方性法规`);
            
            wikitext = wikitext.replace(categoryPattern, targetCategory); // 替换旧分类为新分类
            
            wikitext = wikitext.replaceAll(categoryPattern, ''); // 移除多余的旧分类

            wikitext = wikitext.replaceAll('\n[[Category:黑龙江省人大常委会]]', ''); // 移除常委会分类

            if (wikitext.match(/\{\{\s*creator\s*\|\s*wikidata\s*=\s*Q97300337\s*\}\}/g)) {
                // wikitext = wikitext.replaceAll(/\{\{\s*creator\s*\|\s*wikidata\s*=\s*Q97300337\s*\}\}/g, '[[黑龙江省人民代表大会常务委员会]]');
                // summary += '；替换掉已停用的{{creator}}模板（Q97300337→黑龙江省人民代表大会常务委员会）';
            }
           //  else continue;
           /* 
           if (wikitext.match(/\{\{\s*creator\s*\|\s*wikidata\s*=\s*Q106033593\s*\}\}/g)) {
                wikitext = wikitext.replaceAll(/\{\{\s*creator\s*\|\s*wikidata\s*=\s*Q106033593\s*\}\}/g, '[[黑龙江省人民代表大会]]');
                summary += '；替换掉已停用的{{creator}}模板（Q106033593→黑龙江省人民代表大会）';
            }*/

            if (wikitext.match(/《([^《》]*)《([^《»]*)》([^《»]*)》/g)) {
                wikitext = wikitext.replaceAll(/《([^《》]*)《([^《»]*)》([^《»]*)》/g, '《$1〈$2〉$3》'); // 修正嵌套书名号
                summary += '；修正嵌套书名号';
            }
            /*
            if (!wikitext.includes('| 范围 = 黑龙江省')) {
                wikitext = wikitext.replaceAll(`| 类别 = 地方性法规`,
`| 类别 = 地方性法规
| 范围 = 黑龙江省`);
            }
            */

            // 计算新分类出现的次数
            const newCategoryCount = (wikitext.match(new RegExp(`\\[\\[Category:黑龙江省地方性法规\\]\\]`, 'g')) || []).length;
            
            if (newCategoryCount > 1 ) {
                console.log(pc.yellow(`[WARNING] 页面包含多个黑龙江省地方性法规分类 (${Title})，开始去重...`));
                // 去重：只保留第一个出现的分类
                let firstFound = false;
                wikitext = wikitext.replace(new RegExp(`\\[\\[Category:黑龙江省地方性法规\\]\\]`, 'g'), (match) => {
                    if (!firstFound) {
                        firstFound = true;
                        return match; // 保留第一个
                    }
                    return ''; // 移除后续的重复分类
                });
            }
            // 如果没有变化，或变化只有空格、行数等无实质内容的修改，则跳过保存
            if (wikitext.trim() === originalWikitext.revisions[0].content.trim()) {
                console.log(pc.yellow(`[SKIP] 页面内容无实质变化，跳过保存 (${Title})`));
                continue;
            }
            
            await bot.save(Title, wikitext, summary, { minor: false });
            console.log(pc.green(`[SUCCESS] 已移动页面分类并添加参数：${Title}`));

            // 礼貌延时
            await sleep(3000); 

        } catch (error) {
            console.error(pc.red(`修改页面失败 (${Title}):`), error.message);
            console.log(pc.dim(`[WAIT] 等待5秒后继续处理下一个页面...`));
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