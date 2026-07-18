/* [工具函数] 分类成员转移模块 */

const pc = require('picocolors');
const { sleep } = require('./catnav-handler');
const { createBot } = require('../auth');
const { allowBots } = require('./check-bot-permission');

/**
 * 将源分类中的所有成员转移到目标分类
 * @param {Object} bot - Mwn bot实例
 * @param {string} sourceCategory - 源分类名称（完整标题，包含 "Category:" 前缀）
 * @param {string} targetCategory - 目标分类名称（完整标题，包含 "Category:" 前缀）
 * @param {number} sleepTime - 每次操作后的延时时间（毫秒），默认3000
 * @returns {Promise<Object>} 返回统计信息 { success: number, failed: number, skipped: number }
 */
async function moveCategoryMembers(bot, sourceCategory, targetCategory, sleepTime = 3000) {
    const stats = { success: 0, failed: 0, skipped: 0 };
    
    console.log(pc.cyan(`[INFO] 开始转移分类成员: ${sourceCategory} → ${targetCategory}`));
    
    try {
        // 1. 获取源分类的所有成员
        const members = await getAllCategoryMembers(bot, sourceCategory);
        
        if (members.length === 0) {
            console.log(pc.yellow(`[SKIP] 源分类没有成员: ${sourceCategory}`));
            return stats;
        }
        
        console.log(pc.blue(`[INFO] 找到 ${members.length} 个成员需要转移`));
        
        // 2. 遍历所有成员，添加到目标分类并移除原分类标记
        for (let i = 0; i < members.length; i++) {
            const member = members[i];
            const pageTitle = member.title;
            
            console.log(pc.cyan(`[INFO] 处理成员 (${i + 1}/${members.length}): ${pageTitle}`));
            
            try {
                // 读取页面内容
                const pageData = await bot.read(pageTitle);
                let content = pageData.revisions[0].content;
                
                // 检查机器人编辑权限
                const botUsername = bot.config.username || 'Bot';
                if (!allowBots(content, botUsername)) {
                    console.log(pc.red(`[SKIP] 页面禁止机器人编辑，跳过: ${pageTitle}`));
                    stats.skipped++;
                    await sleep(sleepTime);
                    continue;
                }
                
                // 检查是否已经包含目标分类（支持多种前缀）
                const targetCatName = targetCategory.replace(/^Category:/i, '');
                const targetCatPattern = new RegExp(`\\[\\[(?:Category|Cat|分[类類]):${escapeRegex(targetCatName)}(?:\\|[^[]*)?\\]\\]`, 'i');
                if (targetCatPattern.test(content)) {
                    console.log(pc.yellow(`[SKIP] 页面已包含目标分类，跳过: ${pageTitle}`));
                    stats.skipped++;
                    await sleep(sleepTime);
                    continue;
                }
                
                // 直接替换源分类为目标分类（保留原有的排序键参数）
                const sourceCatName = sourceCategory.replace(/^Category:/i, '');
                // 匹配多种分类命名空间前缀：Category、Cat、分类、類別
                const categoryPrefixPattern = '(?:Category|Cat|分[类類])';
                const sourceCatPattern = new RegExp(`\\[\\[${categoryPrefixPattern}:${escapeRegex(sourceCatName)}((?:\\|[^[]*)?)\\]\\]`, 'gi');
                
                // 使用替换函数，保留管道符和排序键参数
                const hasReplacement = content.includes(sourceCatName);
                if (hasReplacement) {
                    content = content.replace(sourceCatPattern, `[[${targetCategory}$1]]`);
                    console.log(pc.blue(`[INFO] 已替换分类标记: ${pageTitle}`));
                } else {
                    // 如果页面中没有源分类标记，则在末尾添加目标分类
                    const targetCatLink = `[[${targetCategory}]]`;
                    const lastCatMatch = content.match(/\[\[(?:Category|Cat|分[类類]):[^[]+\]\]/gi);
                    if (lastCatMatch && lastCatMatch.length > 0) {
                        // 如果已有分类，在最后一个分类后添加
                        const lastCatIndex = content.lastIndexOf(lastCatMatch[lastCatMatch.length - 1]);
                        const insertPos = lastCatIndex + lastCatMatch[lastCatMatch.length - 1].length;
                        content = content.slice(0, insertPos) + '\n' + targetCatLink + content.slice(insertPos);
                    } else {
                        // 如果没有分类，在页面末尾添加
                        content = content.trimEnd() + '\n\n' + targetCatLink + '\n';
                    }
                    console.log(pc.blue(`[INFO] 已添加目标分类: ${pageTitle}`));
                }
                
                // 保存修改
                const editSummary = `分类成员转移：从 [[${sourceCategory}]] 移至 [[${targetCategory}]]`;

                await sleep(sleepTime/2);
                await bot.save(pageTitle, content, editSummary, { minor: true , tag: 'Bot'});
                
                console.log(pc.green(`[SUCCESS] 已转移成员: ${pageTitle}`));
                stats.success++;
                
            } catch (error) {
                console.error(pc.red(`[ERROR] 转移成员失败 (${pageTitle}):`), error.message);
                stats.failed++;
            }
            
            // 延时，避免触发速率限制
            await sleep(sleepTime/2);
        }
        
        console.log(pc.green(`[COMPLETE] 分类成员转移完成: 成功 ${stats.success}, 跳过 ${stats.skipped}, 失败 ${stats.failed}`));
        
    } catch (error) {
        console.error(pc.red(`[ERROR] 分类成员转移过程出错:`), error.message);
    }
    
    return stats;
}

/**
 * 获取分类的所有成员（支持分页）
 * @param {Object} bot - Mwn bot实例
 * @param {string} categoryName - 分类名称
 * @returns {Promise<Array>} 成员列表
 */
async function getAllCategoryMembers(bot, categoryName) {
    const allMembers = [];
    let continueParams = null;
    
    do {
        const params = {
            action: 'query',
            format: 'json',
            list: 'categorymembers',
            cmtitle: categoryName,
            cmlimit: 'max',
            cmtype: 'page|subcat' // 包括普通页面和子分类
        };
        
        if (continueParams) {
            Object.assign(params, continueParams);
        }
        
        const result = await bot.request(params);
        
        if (result.query && result.query.categorymembers) {
            allMembers.push(...result.query.categorymembers);
        }
        
        // 检查是否有更多结果
        continueParams = result.continue || null;
        
    } while (continueParams);
    
    return allMembers;
}

/**
 * 转义正则表达式中的特殊字符
 * @param {string} string - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
    moveCategoryMembers
};

// 如果直接运行此脚本，则执行命令行模式
if (require.main === module) {
    const args = process.argv.slice(2);
    
    // 解析命令行参数
    let sourceCategory = null;
    let targetCategory = null;
    let sleepTime = 2500; // 默认延时 2.5 秒
    let accountType = 'bot'; // 默认使用 bot 账号
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith('--source=')) {
            sourceCategory = arg.substring('--source='.length);
        } else if (arg.startsWith('--target=')) {
            targetCategory = arg.substring('--target='.length);
        } else if (arg.startsWith('--sleep=')) {
            sleepTime = parseInt(arg.substring('--sleep='.length));
            if (isNaN(sleepTime) || sleepTime < 0) {
                console.error(pc.red('[ERROR] 无效的延时时间，必须是非负整数'));
                process.exit(1);
            }
        } else if (arg.startsWith('--account=')) {
            accountType = arg.substring('--account='.length);
            if (accountType !== 'user' && accountType !== 'bot') {
                console.error(pc.red('[ERROR] 无效的账号类型，必须是 "user" 或 "bot"'));
                process.exit(1);
            }
        } else if (arg === '--help' || arg === '-h') {
            printUsage();
            process.exit(0);
        }
    }
    
    // 验证必需参数
    if (!sourceCategory || !targetCategory) {
        console.error(pc.red('[ERROR] 缺少必需参数'));
        printUsage();
        process.exit(1);
    }
    
    // 确保分类名称包含 "Category:" 前缀
    if (!sourceCategory.startsWith('Category:') && !sourceCategory.startsWith('category:')) {
        sourceCategory = 'Category:' + sourceCategory;
    }
    if (!targetCategory.startsWith('Category:') && !targetCategory.startsWith('category:')) {
        targetCategory = 'Category:' + targetCategory;
    }
    
    console.log(pc.cyan('[INFO] 启动分类成员转移工具'));
    console.log(pc.cyan(`[INFO] 源分类: ${sourceCategory}`));
    console.log(pc.cyan(`[INFO] 目标分类: ${targetCategory}`));
    console.log(pc.cyan(`[INFO] 延时时间: ${sleepTime}ms`));
    console.log(pc.cyan(`[INFO] 账号类型: ${accountType}`));
    
    // 执行转移操作
    (async () => {
        try {
            // 创建 bot 实例
            const bot = await createBot(accountType);
            
            // 执行分类成员转移
            const stats = await moveCategoryMembers(bot, sourceCategory, targetCategory, sleepTime);
            
            console.log(pc.green('\n[COMPLETE] 所有操作完成！'));
            console.log(pc.green(`成功: ${stats.success}, 跳过: ${stats.skipped}, 失败: ${stats.failed}`));
            
            process.exit(stats.failed > 0 ? 1 : 0);
            
        } catch (error) {
            console.error(pc.red('[FATAL ERROR]'), error.message);
            console.error(error.stack);
            process.exit(1);
        }
    })();
}

/**
 * 打印使用说明
 */
function printUsage() {
    console.log(`
分类成员转移工具 - 将源分类的所有成员转移到目标分类

用法:
  node move-category-members.js --source=<源分类> --target=<目标分类> [选项]

必需参数:
  --source=<分类名>      源分类名称（可带或不带 "Category:" 前缀）
  --target=<分类名>      目标分类名称（可带或不带 "Category:" 前缀）

可选参数:
  --sleep=<毫秒数>       每次操作后的延时时间（默认: 5000）
  --account=<类型>       使用的账号类型: "user" 或 "bot"（默认: "bot"）
  --help, -h             显示此帮助信息

示例:
  # 基本用法
  node move-category-members.js --source="Category:旧分类" --target="Category:新分类"
  
  # 不带前缀的分类名
  node move-category-members.js --source="旧分类" --target="新分类"
  
  # 自定义延时时间（3秒）
  node move-category-members.js --source="旧分类" --target="新分类" --sleep=3000
  
  # 使用 user 账号
  node move-category-members.js --source="旧分类" --target="新分类" --account=user
`);
}
