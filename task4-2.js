/* [机器人任务4] 批量移除所有Commons cat模板 */

const { createBot } = require('./auth');
const { logError } = require('./script/log');
const pc = require('picocolors');

// 解析命令行参数
function parseArgs() {
    const args = process.argv.slice(2);
    
    // 检查帮助参数
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
使用方法: node task4.js [选项]

可选参数:
  --sleep_time <毫秒>      每次操作后的延时时间（默认: 5000ms）
  --account_type <类型>    使用的账号类型: 'user' 或 'bot'（默认: 'bot'）
  --limit <数量>           最多处理的页面数量（默认: 无限制，处理所有页面）
  --help, -h              显示此帮助信息

示例:
  node task4.js
  node task4.js --sleep_time 6000
  node task4.js --account_type user
  node task4.js --limit 10          # 只处理前10个页面
  node task4.js --limit 50 --sleep_time 4000
        `.trim());
        process.exit(0);
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
        sleepTime,
        accountType,
        limit
    };
}

// 延时函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 从页面内容中移除Commons cat模板
function removeCommonscatTemplate(content) {
    if (!content || typeof content !== 'string') {
        return { content, removed: false };
    }
    
    let modified = false;
    let newContent = content;
    
    // 匹配各种形式的Commons cat模板（包括带空格和不带空格的重定向版本）
    // 支持格式：
    // - {{Commons cat|...}} / {{commons cat|...}} （标准格式，带空格）
    // - {{Commonscat|...}} / {{commonscat|...}} （重定向格式，无空格）
    // 规则：首字母C/c可以大写或小写，其余字母必须是小写
    // 支持带参数的情况: {{Commons cat|url=xxx|date=xxx}}
    // 支持多行情况
    
    // 正则表达式说明：
    // \{\{           - 匹配 {{
    // [Cc]ommons     - 匹配 Commons 或 commons（首字母大小写均可，其余小写）
    // \s*            - 匹配零个或多个空白字符（兼容带空格和不带空格的格式）
    // [Cc]at         - 匹配 Cat 或 cat（首字母大小写均可，其余小写）
    // [^}]*          - 匹配任意非}字符（包括参数）
    // \}\}           - 匹配 }}
    const CommonscatPattern = /\{\{[Cc]ommons\s*[Cc]at[^}]*\}\}/g;
    
    // 多次执行以确保移除所有匹配项
    let previousContent;
    do {
        previousContent = newContent;
        newContent = newContent.replace(CommonscatPattern, '');
        if (newContent !== previousContent) {
            modified = true;
        }
    } while (newContent !== previousContent);
    
    // 清理可能留下的多余空行和空白
    // 将多个连续空行替换为最多两个换行
    newContent = newContent.replace(/\n\s*\n\s*\n/g, '\n\n');
    // 清理行首行尾空白
    newContent = newContent.trim();
    
    return {
        content: newContent,
        removed: modified
    };
}

// 封装主逻辑，增加错误处理，确保脚本退出状态正确
async function main() {
    // 解析命令行参数
    const { sleepTime, accountType, limit } = parseArgs();
    
    console.log(pc.blue(`[INFO] 账号类型: ${accountType}`));
    console.log(pc.blue(`[INFO] 延时设置: ${sleepTime}ms`));
    if (limit) {
        console.log(pc.blue(`[INFO] 处理限制: 最多处理 ${limit} 个页面`));
    } else {
        console.log(pc.blue(`[INFO] 处理限制: 无限制（处理所有页面）`));
    }
    
    // 1. 创建 bot 实例
    console.log(pc.blue(`[INFO] 初始化 ${accountType.toUpperCase()} 账号...`));
    const bot = await createBot(accountType);

    // 2. 查询Commons cat模板的链入页面（包括标准版本和重定向版本）
    console.log(pc.cyan('[INFO] 正在查询Commons cat模板的链入页面...'));
    
    const templatesToCheck = ['Template:Commons cat', 'Template:Commonscat'];
    let allPages = [];
    
    // 使用 mwn 的 continuedQuery 方法自动处理分页
    for (const templateTitle of templatesToCheck) {
        console.log(pc.blue(`[INFO] 查询模板: ${templateTitle}`));
        
        try {
            const responses = await bot.continuedQuery({
                action: 'query',
                list: 'embeddedin',
                eititle: templateTitle,
                eilimit: 'max',
                formatversion: '2'
            });
            
            // 合并所有响应的结果
            responses.forEach(response => {
                if (response.query && response.query.embeddedin) {
                    const pages = response.query.embeddedin.map(item => item.title);
                    allPages = allPages.concat(pages);
                }
            });
            
            console.log(pc.green(`[INFO] 从 ${templateTitle} 获取 ${allPages.length} 个页面`));
            
            // 延时避免API速率限制
            await sleep(sleepTime);
            
        } catch (error) {
            console.error(pc.red(`[ERROR] 查询 ${templateTitle} 链入页面失败:`), error.message);
            await logError(bot, `查询${templateTitle}模板链入页面失败`, {
                error: error.message,
                stack: error.stack
            });
        }
    }
    
    // 去重：使用 Set 去除重复的页面
    const uniquePages = [...new Set(allPages)];
    console.log(pc.green(`[COMPLETE] 共找到 ${uniquePages.length} 个包含Commons cat模板的页面（去重前: ${allPages.length}）`));
    
    if (uniquePages.length === 0) {
        console.log(pc.yellow('[INFO] 没有找到包含Commons cat模板的页面，任务结束'));
        return;
    }
    
    // 如果设置了limit，截取前n个页面
    let pagesToProcess = uniquePages;
    if (limit && limit < uniquePages.length) {
        pagesToProcess = uniquePages.slice(0, limit);
        console.log(pc.yellow(`[INFO] 根据 --limit 参数，将只处理前 ${limit} 个页面（总共 ${uniquePages.length} 个）`));
    }
    
    // 3. 使用 batchOperation 批量处理页面
    console.log(pc.cyan(`[INFO] 开始批量移除Commons cat模板（共 ${pagesToProcess.length} 个页面）...`));
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    // 定义工作函数
    const processPage = async (pageTitle, index) => {
        const progress = `[${index + 1}/${pagesToProcess.length}]`;
        
        try {
            console.log(pc.blue(`${progress} 处理页面: ${pageTitle}`));
            
            // 读取页面内容
            const pageData = await bot.read(pageTitle);
            
            if (!pageData || !pageData.revisions || !pageData.revisions[0]) {
                console.log(pc.yellow(`${progress} [SKIP] 无法获取页面内容，跳过`));
                skipCount++;
                return;
            }
            
            const originalContent = pageData.revisions[0].content;
            
            // 移除Commons cat模板
            const { content: newContent, removed } = removeCommonscatTemplate(originalContent);
            
            if (!removed) {
                console.log(pc.yellow(`${progress} [SKIP] 未检测到Commons cat模板，跳过`));
                skipCount++;
                return;
            }
            
            // 保存修改后的内容
            const editSummary = '机器人：批量移除已弃用的{{Commons cat}}模板（task4-2）';
            
            await bot.save(pageTitle, newContent, editSummary, {
                minor: true,
                bot: accountType === 'bot'
            });
            
            console.log(pc.green(`${progress} [SUCCESS] 已成功移除Commons cat模板`));
            successCount++;
            
        } catch (error) {
            console.error(pc.red(`${progress} [ERROR] 处理页面失败:`), error.message);
            await logError(bot, `处理页面失败: ${pageTitle}`, {
                error: error.message,
                stack: error.stack
            });
            failCount++;
        }
        
        // 延时避免API速率限制
        await sleep(sleepTime);
    };
    
    // 使用 seriesBatchOperation 顺序处理（concurrency=1），确保延时生效
    const result = await bot.seriesBatchOperation(
        pagesToProcess,
        processPage,
        0, // delay 设为 0，因为我们在工作函数内部手动控制延时
        0  // 不重试
    );
    
    // 输出统计信息
    console.log(pc.cyan('\n========== 任务完成统计 =========='));
    console.log(pc.green(`成功移除: ${successCount} 个页面`));
    console.log(pc.yellow(`跳过: ${skipCount} 个页面`));
    console.log(pc.red(`失败: ${failCount} 个页面`));
    console.log(pc.cyan(`总计: ${pagesToProcess.length} 个页面`));
    if (result.failures && Object.keys(result.failures).length > 0) {
        console.log(pc.red(`batchOperation 报告的失败数: ${Object.keys(result.failures).length}`));
    }
    console.log(pc.cyan('====================================\n'));
}

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常
