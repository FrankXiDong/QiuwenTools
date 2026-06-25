/* [机器人任务] 批量将分类的所有成员从该分类中移除 */

const { createBot } = require('../auth');
const { logError } = require('./log');
const pc = require('picocolors');

// 解析命令行参数
function parseArgs() {
    const args = process.argv.slice(2);
    
    // 检查帮助参数
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
使用方法: node remove-category-members.js --category=<分类名> [选项]

必需参数:
  --category <分类名>      要移出成员的分类名称（可带或不带 "Category:" 前缀）

可选参数:
  --sleep_time <毫秒>      每次操作后的延时时间（默认: 5000ms）
  --account_type <类型>    使用的账号类型: 'user' 或 'bot'（默认: 'user'）
  --limit <数量>           最多处理的页面数量（默认: 无限制，处理所有页面）
  --help, -h              显示此帮助信息

示例:
  node remove-category-members.js --category="Category:待清理分类"
  node remove-category-members.js --category="待清理分类" --limit 10
  node remove-category-members.js --category="待清理分类" --sleep_time 6000
  node remove-category-members.js --category="待清理分类" --account_type user
  node remove-category-members.js --category="待清理分类" --limit 50 --sleep_time 4000
        `.trim());
        process.exit(0);
    }
    
    // 解析必需参数
    let category = null;
    const categoryIndex = args.indexOf('--category');
    if (categoryIndex !== -1 && categoryIndex + 1 < args.length) {
        category = args[categoryIndex + 1];
    } else {
        // 尝试 --category=value 格式
        const categoryArg = args.find(arg => arg.startsWith('--category='));
        if (categoryArg) {
            category = categoryArg.substring('--category='.length);
        }
    }
    
    if (!category) {
        console.error(pc.red('[ERROR] 缺少必需参数 --category'));
        console.error(pc.red('请使用 --help 查看使用说明'));
        process.exit(1);
    }
    
    // 解析可选参数
    let sleepTime = 5000; // 默认5秒延时
    let accountType = 'bot'; // 默认使用bot账号
    let limit = null; // 默认无限制
    
    const sleepTimeIndex = args.indexOf('--sleep_time');
    if (sleepTimeIndex !== -1 && sleepTimeIndex + 1 < args.length) {
        const parsed = parseInt(args[sleepTimeIndex + 1], 10);
        if (!isNaN(parsed) && parsed > 0) {
            sleepTime = parsed;
        } else {
            console.warn(pc.yellow('[WARN] 无效的 --sleep_time 参数，使用默认值 5000ms'));
        }
    }
    
    const accountTypeIndex = args.indexOf('--account_type');
    if (accountTypeIndex !== -1 && accountTypeIndex + 1 < args.length) {
        const type = args[accountTypeIndex + 1];
        if (type === 'user' || type === 'bot') {
            accountType = type;
        } else {
            console.warn(pc.yellow('[WARN] 无效的 --account_type 参数，使用默认值 bot'));
        }
    }
    
    const limitIndex = args.indexOf('--limit');
    if (limitIndex !== -1 && limitIndex + 1 < args.length) {
        const parsed = parseInt(args[limitIndex + 1], 10);
        if (!isNaN(parsed) && parsed > 0) {
            limit = parsed;
        } else {
            console.warn(pc.yellow('[WARN] 无效的 --limit 参数，将处理所有页面'));
        }
    }
    
    return {
        category,
        sleepTime,
        accountType,
        limit
    };
}

// 延时函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// 转义正则表达式中的特殊字符
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 从页面内容中移除指定分类标记
function removeCategoryFromContent(content, categoryName) {
    if (!content || typeof content !== 'string') {
        return { content, removed: false };
    }
    
    let modified = false;
    let newContent = content;
    
    // 提取分类名称（去除 Category: 前缀）
    const catName = categoryName.replace(/^Category:/i, '').trim();
    
    // 构建正则表达式，支持多种分类命名空间前缀
    // 匹配: [[Category:xxx]], [[Cat:xxx]], [[分类:xxx]]
    // 保留管道符参数: [[Category:xxx|排序键]]
    const categoryPrefixPattern = '(?:Category|Cat|分[类類])';
    const catPattern = new RegExp(`\\[\\[${categoryPrefixPattern}:${escapeRegex(catName)}((?:\\|[^[]*)?)\\]\\]\n`, 'gi');
    
    // 多次执行以确保移除所有匹配项
    let previousContent;
    do {
        previousContent = newContent;
        newContent = newContent.replace(catPattern, '');
        if (newContent !== previousContent) {
            modified = true;
        }
    } while (newContent !== previousContent);
    
    // 清理可能留下的多余空行和空白
    // 将多个连续空行替换为最多一个换行
    newContent = newContent.replace(/\n\s*\n\s*\n+/g, '\n');

    // 清理首尾空白
    newContent = newContent.trim();
    
    return {
        content: newContent,
        removed: modified
    };
}

// 获取分类的所有成员（支持分页）
async function getAllCategoryMembers(bot, categoryName) {
    const allMembers = [];
    let continueParams = null;
    
    console.log(pc.cyan(`[INFO] 正在获取分类 "${categoryName}" 的所有成员...`));
    
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
        
        try {
            const result = await bot.request(params);
            
            if (result.query && result.query.categorymembers) {
                const members = result.query.categorymembers;
                allMembers.push(...members);
                console.log(pc.green(`[INFO] 已获取 ${members.length} 个成员（累计: ${allMembers.length}）`));
            }
            
            // 检查是否有更多结果
            continueParams = result.continue || null;
            
            // 延时避免API速率限制
            await sleep(1000);
            
        } catch (error) {
            console.error(pc.red('[ERROR] 获取分类成员失败:'), error.message);
            await logError(bot, `获取分类成员失败: ${categoryName}`, {
                error: error.message,
                stack: error.stack
            });
            break;
        }
    } while (continueParams);
    
    return allMembers;
}

// 封装主逻辑，增加错误处理，确保脚本退出状态正确
async function main() {
    // 解析命令行参数
    const { category, sleepTime, accountType, limit } = parseArgs();
    
    // 确保分类名称包含 "Category:" 前缀
    let fullCategoryName = category;
    if (!category.startsWith('Category:') && !category.startsWith('category:')) {
        fullCategoryName = 'Category:' + category;
    }
    
    console.log(pc.blue(`[INFO] 账号类型: ${accountType}`));
    console.log(pc.blue(`[INFO] 目标分类: ${fullCategoryName}`));
    console.log(pc.blue(`[INFO] 延时设置: ${sleepTime}ms`));
    if (limit) {
        console.log(pc.blue(`[INFO] 处理限制: 最多处理 ${limit} 个页面`));
    } else {
        console.log(pc.blue(`[INFO] 处理限制: 无限制（处理所有页面）`));
    }
    
    // 1. 创建 bot 实例
    console.log(pc.blue(`[INFO] 初始化 ${accountType.toUpperCase()} 账号...`));
    const bot = await createBot(accountType);

    // 2. 获取分类的所有成员
    const allMembers = await getAllCategoryMembers(bot, fullCategoryName);
    
    console.log(pc.green(`[COMPLETE] 共找到 ${allMembers.length} 个分类成员`));
    
    if (allMembers.length === 0) {
        console.log(pc.yellow('[INFO] 分类没有成员，任务结束'));
        return;
    }
    
    // 如果设置了limit，截取前n个页面
    let membersToProcess = allMembers;
    if (limit && limit < allMembers.length) {
        membersToProcess = allMembers.slice(0, limit);
        console.log(pc.yellow(`[INFO] 根据 --limit 参数，将只处理前 ${limit} 个成员（总共 ${allMembers.length} 个）`));
    }
    
    // 3. 逐个页面处理，移除分类标记
    console.log(pc.cyan(`[INFO] 开始从成员页面移除分类标记（共 ${membersToProcess.length} 个页面）...`));
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < membersToProcess.length; i++) {
        const member = membersToProcess[i];
        const pageTitle = member.title;
        const progress = `[${i + 1}/${membersToProcess.length}]`;
        
        try {
            console.log(pc.blue(`${progress} 处理页面: ${pageTitle}`));
            
            // 读取页面内容
            let pageData;
            try {
                pageData = await bot.read(pageTitle);
            } catch (readError) {
                console.error(pc.red(`${progress} [ERROR] 读取页面失败:`), readError.message);
                await logError(bot, `读取页面失败: ${pageTitle}`, {
                    error: readError.message,
                    stack: readError.stack
                });
                failCount++;
                await sleep(sleepTime);
                continue;
            }
            
            if (!pageData || !pageData.revisions || !pageData.revisions[0]) {
                console.log(pc.yellow(`${progress} [SKIP] 无法获取页面内容，跳过`));
                skipCount++;
                await sleep(sleepTime);
                continue;
            }
            
            const originalContent = pageData.revisions[0].content;
            
            // 移除分类标记
            const { content: newContent, removed } = removeCategoryFromContent(originalContent, fullCategoryName);
            
            if (!removed) {
                console.log(pc.yellow(`${progress} [SKIP] 未检测到分类标记，跳过`));
                skipCount++;
                await sleep(sleepTime);
                continue;
            }
            
            // 保存修改后的内容
            const editSummary = `机器人：从 [[${fullCategoryName}]] 分类中移出（remove-category-members）`;
            
            try {
                await bot.save(pageTitle, newContent, editSummary, {
                    minor: true,
                    bot: accountType === 'bot'
                });
                
                console.log(pc.green(`${progress} [SUCCESS] 已成功移除分类标记`));
                successCount++;
                
            } catch (saveError) {
                console.error(pc.red(`${progress} [ERROR] 保存页面失败:`), saveError.message);
                await logError(bot, `保存页面失败: ${pageTitle}`, {
                    error: saveError.message,
                    stack: saveError.stack,
                    originalContent: originalContent.substring(0, 200)
                });
                failCount++;
            }
            
        } catch (error) {
            console.error(pc.red(`${progress} [ERROR] 处理页面时发生未知错误:`), error.message);
            await logError(bot, `处理页面时发生未知错误: ${pageTitle}`, {
                error: error.message,
                stack: error.stack
            });
            failCount++;
        }
        
        // 延时避免API速率限制
        await sleep(sleepTime);
    }
    
    // 4. 输出统计信息
    console.log(pc.cyan('\n========== 任务完成统计 =========='));
    console.log(pc.green(`成功移除: ${successCount} 个页面`));
    console.log(pc.yellow(`跳过: ${skipCount} 个页面`));
    console.log(pc.red(`失败: ${failCount} 个页面`));
    console.log(pc.cyan(`总计: ${allMembers.length} 个成员`));
    console.log(pc.cyan('====================================\n'));
}

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常
