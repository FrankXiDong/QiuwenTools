/* 0720临时任务：{{金陵十二钗}}→{{红楼梦}}{{金陵十二钗}} */

const { createBot } = require('./auth');
const { logError } = require('./script/log');
const pc = require('picocolors');

// 解析命令行参数
function parseArgs() {
    const args = process.argv.slice(2);
    
    // 解析可选参数
    let sleepTime = 5000; // 默认5秒延时
    let accountType = 'user'; // 默认使用user账号
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
            console.warn(pc.yellow('[WARN] 无效的 --account_type 参数，使用默认值 user'));
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

function replaceText(content) {
    if (!content || typeof content !== 'string') {
        return { content, removed: false };
    }
    
    let modified = false;
    let newContent = content;

    // 如果已经包含{{红楼梦}}，则跳过
    if (newContent.includes('{{红楼梦}}')) {
        return { content: newContent, removed: false };
    }
    
    // 替换 {{金陵十二钗}} 为 {{红楼梦}}\n{{金陵十二钗}}
    if (newContent.includes('{{金陵十二钗}}')) {
        newContent = newContent.replace(/\{\{金陵十二钗\}\}/g, '{{红楼梦}}\n{{金陵十二钗}}');
        modified = true;
    }
    
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

    // 2. 查询链入页面
    console.log(pc.cyan('[INFO] 正在查询模板的链入页面...'));
    
    let allPages = [];
    let continueParam = null;
    
    do {
        const params = {
            action: 'query',
            list: 'embeddedin',
            eititle: 'Template:金陵十二钗',
            eilimit: 'max',
            format: 'json',
            formatversion: '2'
        };
        
        if (continueParam) {
            params.eicontinue = continueParam;
        }
        
        try {
            const result = await bot.request(params);
            
            if (result.query && result.query.embeddedin) {
                const pages = result.query.embeddedin.map(item => item.title);
                allPages = allPages.concat(pages);
                console.log(pc.green(`[INFO] 已获取 ${pages.length} 个页面（累计: ${allPages.length}）`));
            }
            
            // 检查是否有更多结果
            if (result.continue && result.continue.eicontinue) {
                continueParam = result.continue.eicontinue;
            } else {
                continueParam = null;
            }
            
            // 延时避免API速率限制
            await sleep(sleepTime);
            
        } catch (error) {
            console.error(pc.red('[ERROR] 查询链入页面失败:'), error.message);
            await logError(bot, `查询Template:金陵十二钗模板链入页面失败`, {
                error: error.message,
                stack: error.stack
            });
            break;
        }
    } while (continueParam);
    
    console.log(pc.green(`[COMPLETE] 共找到 ${allPages.length} 个包含Template:金陵十二钗模板的页面`));
    
    if (allPages.length === 0) {
        console.log(pc.yellow('[INFO] 没有找到包含Template:金陵十二钗模板的页面，任务结束'));
        return;
    }
    
    // 如果设置了limit，截取前n个页面
    let pagesToProcess = allPages;
    if (limit && limit < allPages.length) {
        pagesToProcess = allPages.slice(0, limit);
        console.log(pc.yellow(`[INFO] 根据 --limit 参数，将只处理前 ${limit} 个页面（总共 ${allPages.length} 个）`));
    }
    
    // 3. 逐个页面处理
    console.log(pc.cyan(`[INFO] 开始执行替换（共 ${pagesToProcess.length} 个页面）...`));
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < pagesToProcess.length; i++) {
        const pageTitle = pagesToProcess[i];
        const progress = `[${i + 1}/${pagesToProcess.length}]`;
        
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
            
            // 替换金陵十二钗模板
            const { content: newContent, removed } = replaceText(originalContent);
            
            if (!removed) {
                console.log(pc.yellow(`${progress} [SKIP] 未检测到Template:金陵十二钗模板或已包含红楼梦模板，跳过`));
                skipCount++;
                await sleep(sleepTime);
                continue;
            }
            
            // 保存修改后的内容
            const editSummary = '添加{{红楼梦}}模板';
            
            try {
                await bot.save(pageTitle, newContent, editSummary, { minor: true , tags: 'Bot'});
                
                console.log(pc.green(`${progress} [SUCCESS] 已成功替换`));
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
    console.log(pc.green(`成功替换: ${successCount} 个页面`));
    console.log(pc.yellow(`跳过: ${skipCount} 个页面`));
    console.log(pc.red(`失败: ${failCount} 个页面`));
    console.log(pc.cyan(`总计: ${allPages.length} 个页面`));
    console.log(pc.cyan('====================================\n'));
}

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常
