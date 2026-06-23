/* [工具函数] 修复双重/多重重定向模块 */

const pc = require('picocolors');
const { sleep } = require('../catnav-handler');

/**
 * 修复双重或多重重定向
 * @param {Object} bot - Mwn bot实例
 * @param {string} categoryName - 分类名称（完整标题，包含 "Category:" 前缀）
 * @param {number} sleepTime - 每次操作后的延时时间（毫秒），默认3000
 * @returns {Promise<Object>} 返回修复结果 { fixed: boolean, redirectChain: string[] }
 */
async function fixDoubleRedirects(bot, categoryName, sleepTime = 3000) {
    const result = {
        fixed: false,
        redirectChain: []
    };
    
    try {
        console.log(pc.cyan(`[INFO] 检查重定向链: ${categoryName}`));
        
        // 1. 获取分类的重定向目标
        const redirectTarget = await getRedirectTarget(bot, categoryName);
        
        if (!redirectTarget) {
            console.log(pc.yellow(`[SKIP] 页面不是重定向或无法解析: ${categoryName}`));
            return result;
        }
        
        result.redirectChain.push(categoryName);
        result.redirectChain.push(redirectTarget);
        
        console.log(pc.blue(`[INFO] 发现重定向: ${categoryName} → ${redirectTarget}`));
        
        // 2. 递归追踪重定向链，找到最终目标
        let finalTarget = redirectTarget;
        let currentTarget = redirectTarget;
        let maxDepth = 10; // 防止无限循环
        let depth = 0;
        
        while (depth < maxDepth) {
            const nextTarget = await getRedirectTarget(bot, currentTarget);
            
            if (!nextTarget) {
                // 当前目标不是重定向，这就是最终目标
                break;
            }
            
            result.redirectChain.push(nextTarget);
            finalTarget = nextTarget;
            currentTarget = nextTarget;
            depth++;
            
            console.log(pc.blue(`[INFO] 追踪重定向链: ${currentTarget} → ${nextTarget}`));
        }
        
        if (depth >= maxDepth) {
            console.error(pc.red(`[ERROR] 重定向链过长，可能存在循环重定向: ${categoryName}`));
            return result;
        }
        
        // 3. 如果存在双重或多重重定向，修复它
        if (result.redirectChain.length > 2) {
            console.log(pc.yellow(`[WARN] 检测到多重定向链 (${result.redirectChain.length} 层):`));
            console.log(pc.yellow(`       ${result.redirectChain.join(' → ')}`));
            console.log(pc.cyan(`[INFO] 修复为直接重定向到最终目标: ${finalTarget}`));
            
            // 提取最终目标的分类名（去除 Category: 前缀）
            const finalCatName = finalTarget.replace(/^Category:/i, '');
            
            // 使用分类重定向模板格式：{{cr|目标分类名}}
            const redirectContent = `{{cr|${finalCatName}}}`;
            const editSummary = `修复双重定向：直接重定向到 [[${finalTarget}]]`;
            
            await bot.save(categoryName, redirectContent, editSummary, { 
                minor: true,
                createonly: false
            });
            
            console.log(pc.green(`[SUCCESS] 已修复重定向: ${categoryName} → ${finalTarget}`));
            result.fixed = true;
            
            // 礼貌延时
            await sleep(sleepTime);
            
        } else {
            console.log(pc.green(`[OK] 重定向正常，无需修复: ${categoryName} → ${finalTarget}`));
        }
        
    } catch (error) {
        console.error(pc.red(`[ERROR] 修复重定向失败 (${categoryName}):`), error.message);
    }
    
    return result;
}

/**
 * 获取页面的重定向目标（支持分类重定向模板）
 * @param {Object} bot - Mwn bot实例
 * @param {string} pageTitle - 页面标题
 * @returns {Promise<string|null>} 重定向目标，如果不是重定向则返回 null
 */
async function getRedirectTarget(bot, pageTitle) {
    try {
        // 首先读取页面内容，检查是否使用分类重定向模板
        const pageData = await bot.read(pageTitle);
        const content = pageData.revisions[0].content;
        
        // 检测分类重定向模板
        // 支持：{{cr|...}}、{{Cr|...}}、{{Category Redirect|...}}、{{分類重定向|...}} 等
        const catRedirectPattern = /\{\{([Cc][Rr]|[Cc]ategory[_ ]?[Rr]edirect|分類重定向|分类重定向)\|\s*([^}|]+?)\s*\}\}/i;
        const match = content.match(catRedirectPattern);
        
        if (match && match[2]) {
            let target = match[2].trim();
            
            // 如果目标包含 Category: 前缀，保留；否则添加
            if (!target.startsWith('Category:') && !target.startsWith('category:')) {
                target = 'Category:' + target;
            }
            
            console.log(pc.blue(`[INFO] 检测到分类重定向模板: ${pageTitle} → ${target}`));
            return target;
        }
        
        // 如果没有找到分类重定向模板，检查是否是标准重定向
        const standardRedirectPattern = /^#REDIRECT\s*\[\[([^\]]+)\]\]/im;
        const standardMatch = content.match(standardRedirectPattern);
        if (standardMatch && standardMatch[1]) {
            let target = standardMatch[1].trim();
            console.log(pc.blue(`[INFO] 检测到标准重定向: ${pageTitle} → ${target}`));
            return target;
        }
        
        return null;
        
    } catch (error) {
        console.error(pc.red(`[ERROR] 获取重定向目标失败 (${pageTitle}):`), error.message);
        return null;
    }
}

/**
 * 批量修复多个分类的双重定向
 * @param {Object} bot - Mwn bot实例
 * @param {string[]} categoryNames - 分类名称数组
 * @param {number} sleepTime - 每个操作后的延时时间（毫秒），默认3000
 * @returns {Promise<Object>} 处理结果统计
 */
async function batchFixDoubleRedirects(bot, categoryNames, sleepTime = 3000) {
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    let fixedCount = 0;
    
    for (const categoryName of categoryNames) {
        try {
            const result = await fixDoubleRedirects(bot, categoryName, sleepTime);
            
            if (result.fixed) {
                fixedCount++;
                successCount++;
            } else if (result.redirectChain.length === 0) {
                skipCount++;
            } else {
                successCount++;
            }
        } catch (error) {
            console.error(pc.red(`[ERROR] 批量处理中出错 (${categoryName}):`), error.message);
            errorCount++;
        }
    }
    
    return {
        total: categoryNames.length,
        success: successCount,
        fixed: fixedCount,
        skip: skipCount,
        error: errorCount
    };
}

module.exports = {
    fixDoubleRedirects,
    batchFixDoubleRedirects,
    getRedirectTarget
};

// 如果直接运行此脚本，则执行命令行模式
if (require.main === module) {
    const args = process.argv.slice(2);
    
    // 解析命令行参数
    let categoryNames = [];
    let sleepTime = 3000; // 默认延时 3 秒
    let accountType = 'bot'; // 默认使用 bot 账号
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith('--categories=')) {
            // 支持逗号分隔的多个分类
            const cats = arg.substring('--categories='.length).split(',');
            categoryNames = cats.map(c => c.trim()).filter(c => c.length > 0);
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
        } else if (!arg.startsWith('--')) {
            // 支持直接传入分类名
            categoryNames.push(arg);
        }
    }
    
    // 验证必需参数
    if (categoryNames.length === 0) {
        console.error(pc.red('[ERROR] 缺少必需参数'));
        printUsage();
        process.exit(1);
    }
    
    // 确保分类名称包含 "Category:" 前缀
    categoryNames = categoryNames.map(name => {
        if (!name.startsWith('Category:') && !name.startsWith('category:')) {
            return 'Category:' + name;
        }
        return name;
    });
    
    console.log(pc.cyan('[INFO] 启动双重定向修复工具'));
    console.log(pc.cyan(`[INFO] 待处理分类: ${categoryNames.join(', ')}`));
    console.log(pc.cyan(`[INFO] 延时时间: ${sleepTime}ms`));
    console.log(pc.cyan(`[INFO] 账号类型: ${accountType}`));
    
    // 执行修复操作
    (async () => {
        try {
            // 创建 bot 实例
            const { createBot } = require('./auth');
            const bot = await createBot(accountType);
            
            // 批量修复双重定向
            const stats = await batchFixDoubleRedirects(bot, categoryNames, sleepTime);
            
            console.log(pc.green('\n[COMPLETE] 所有操作完成！'));
            console.log(pc.green(`总计: ${stats.total}, 成功: ${stats.success}, 修复: ${stats.fixed}, 跳过: ${stats.skip}, 错误: ${stats.error}`));
            
            process.exit(stats.error > 0 ? 1 : 0);
            
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
双重定向修复工具 - 修复分类移动后产生的双重/多重重定向

用法:
  node fix-double-redirects.js --categories=<分类列表> [选项]
  node fix-double-redirects.js <分类1> <分类2> ... [选项]

必需参数:
  --categories=<分类列表>   分类名称列表（逗号分隔，可带或不带 "Category:" 前缀）
  或直接传入分类名作为位置参数

可选参数:
  --sleep=<毫秒数>         每次操作后的延时时间（默认: 3000）
  --account=<类型>         使用的账号类型: "user" 或 "bot"（默认: "bot"）
  --help, -h               显示此帮助信息

示例:
  # 修复单个分类
  node fix-double-redirects.js --categories="Category:测试分类"
  
  # 修复多个分类（逗号分隔）
  node fix-double-redirects.js --categories="Category:分类1,Category:分类2"
  
  # 使用位置参数
  node fix-double-redirects.js Category:分类1 Category:分类2
  
  # 不带前缀的分类名
  node fix-double-redirects.js 分类1 分类2
  
  # 自定义延时时间
  node fix-double-redirects.js --categories="Category:测试" --sleep=5000
`);
}
