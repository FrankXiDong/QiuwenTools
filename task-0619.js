/* 临时任务：替换[[Category:中国各省已撤销的行政区]]中的"撤消"→"撤销" */
/* https://www.qiuwenbaike.cn/index.php?title=Qiuwen_talk:%E8%8C%B6%E9%A6%86/%E7%BC%96%E8%BE%91&oldid=10913596#%E5%85%B3%E4%BA%8E%E2%80%9C%E6%92%A4%E6%B6%88%E2%80%9D%E2%86%92%E2%80%9C%E6%92%A4%E9%94%80%E2%80%9D%E7%9A%84%E6%9B%BF%E6%8D%A2 */

const { createBot } = require('./auth');
const pc = require('picocolors');
const { handleCatnavTemplate, sleep } = require('./catnav-handler');
const { moveCategoryMembers } = require('./move-category-members');
const { logError } = require('./log');

/**
 * 判断错误是否可重试
 * @param {Object} error - 错误对象
 * @returns {boolean} 是否可重试
 */
function isRetryableError(error) {
    if (!error || !error.code) return false;
    
    const retryableCodes = [
        'maxlag',           // 服务器延迟
        'internal_api_error', // 内部API错误
        'http',             // HTTP错误
        'readonly'          // 只读模式
    ];
    
    return retryableCodes.includes(error.code);
}

/**
 * 判断错误是否为致命错误（需要跳过当前项但继续执行）
 * @param {Object} error - 错误对象
 * @returns {string} 错误类型描述
 */
function classifyError(error) {
    if (!error || !error.code) return 'unknown';
    
    const fatalErrors = {
        'articleexists': '目标页面已存在',
        'titleblacklist-forbidden': '触犯标题黑名单',
        'protectedpage': '页面已被保护',
        'protectednamespace': '命名空间已被保护',
        'cantmove-anon': '匿名用户无法移动',
        'cantmove': '无法移动（权限不足）',
        'immobilenamespace': '命名空间不可移动',
        'selfmove': '源和目标相同',
        'nonexistent': '源页面不存在',
        'badtitle': '无效的标题',
        'hookaborted': '钩子中止操作'
    };
    
    return fatalErrors[error.code] || '未知错误';
}

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
    
    // 统计信息
    const stats = {
        total: categoryList.length,
        processed: 0,
        success: 0,
        skipped: 0,
        failed: 0,
        errors: []
    };
    
    // 3. 批量处理分类
    for (let categoryName0 of categoryList) {
        stats.processed++;
        
        // 确保输入为字符串类型并清理
        if (typeof categoryName0 !== 'string' || !categoryName0.trim()) {
            console.log(pc.yellow(`[SKIP] 无效的分类名称，跳过: ${JSON.stringify(categoryName0)}`));
            stats.skipped++;
            continue;
        }
        
        categoryName0 = categoryName0.trim(); // 清理输入
        
        // 检查是否包含非法字符
        const illegalCharsPattern = /[{}<>|*#]/;
        if (illegalCharsPattern.test(categoryName0)) {
            console.log(pc.yellow(`[SKIP] 分类名称包含非法字符，跳过: ${categoryName0}`));
            stats.skipped++;
            continue;
        }
        
        if (!categoryName0.includes('撤消')){
            console.log(pc.yellow(`[SKIP] 分类名称不包含"撤消"，跳过: ${categoryName0}`));
            stats.skipped++;
            continue;
        }

        const newCategoryName = categoryName0.replace('撤消', '撤销');

        console.log(pc.cyan(`\n[PROCESSING] (${stats.processed}/${stats.total}) 处理分类: ${categoryName0} → ${newCategoryName}`));

        // 尝试移动分类，增加重试机制
        let moveResult = null;
        let moveSuccess = false;
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                moveResult = await bot.move(categoryName0, newCategoryName, `批量移动"撤消"→"撤销"：[[Special:固定链接/10913596#关于"撤消"→"撤销"的替换]]`);
                
                if (moveResult && !moveResult.error) {
                    moveSuccess = true;
                    console.log(pc.green(`[SUCCESS] 分类 "${categoryName0}" 移动成功，新名称为 "${newCategoryName}"`));
                    stats.success++;
                    break;
                } else if (moveResult && moveResult.error) {
                    const errorType = classifyError(moveResult.error);
                    
                    // 如果是致命错误，直接跳过
                    if (errorType !== '未知错误') {
                        console.error(pc.red(`[FATAL] 分类 "${categoryName0}" 移动失败 (${errorType}):`, moveResult.error.info || moveResult.error.code));
                        
                        // 记录错误到日志页面
                        await logError(bot, `分类移动失败: ${categoryName0} → ${newCategoryName}`, {
                            errorType: errorType,
                            errorCode: moveResult.error.code,
                            errorInfo: moveResult.error.info,
                            category: categoryName0,
                            newCategory: newCategoryName
                        });
                        
                        stats.errors.push({
                            category: categoryName0,
                            error: moveResult.error.code,
                            info: moveResult.error.info,
                            type: errorType
                        });
                        stats.failed++;
                        break;
                    }
                    
                    // 如果是可重试错误，继续重试
                    if (isRetryableError(moveResult.error)) {
                        console.warn(pc.yellow(`[RETRY] 第${attempt}次尝试失败 (${moveResult.error.code})，将在2秒后重试...`));
                        if (attempt < maxRetries) {
                            await sleep(2000);
                            continue;
                        }
                    }
                    
                    // 未知错误，重试
                    console.warn(pc.yellow(`[RETRY] 第${attempt}次尝试失败 (未知错误)，将在2秒后重试...`));
                    if (attempt < maxRetries) {
                        await sleep(2000);
                        continue;
                    }
                }
            } catch (error) {
                console.error(pc.red(`[EXCEPTION] 移动分类时发生异常 (第${attempt}次):`), error.message);
                
                // 如果是最后一次尝试，记录错误日志
                if (attempt === maxRetries) {
                    await logError(bot, `移动分类异常: ${categoryName0} → ${newCategoryName}`, {
                        message: error.message,
                        stack: error.stack,
                        category: categoryName0,
                        newCategory: newCategoryName,
                        attempt: attempt
                    });
                }
                
                if (attempt < maxRetries) {
                    await sleep(2000);
                    continue;
                }
            }
        }
        
        // 如果移动失败，跳过后续操作
        if (!moveSuccess) {
            console.log(pc.red(`[SKIP] 由于移动失败，跳过后续操作: ${categoryName0}`));
            await sleep(3000);
            continue;
        }

        // 处理新分类页面的 Catnav 模板
        try {
            await handleCatnavTemplate(bot, newCategoryName, 2000);
        } catch (error) {
            console.error(pc.red(`[ERROR] 处理 Catnav 模板失败 (${newCategoryName}):`), error.message);
            
            // 记录错误日志
            await logError(bot, `Catnav模板处理失败: ${newCategoryName}`, {
                message: error.message,
                stack: error.stack,
                category: newCategoryName
            });
            
            // 不中断流程，继续处理成员迁移
        }

        // 迁移分类成员
        try {
            const membersResult = await moveCategoryMembers(bot, categoryName0, newCategoryName);

            if (membersResult) {
                console.log(pc.green(`[SUCCESS] 已完成分类成员迁移：${categoryName0} → ${newCategoryName}`));
                console.log(pc.cyan(`  统计: 成功 ${membersResult.success}, 跳过 ${membersResult.skipped}, 失败 ${membersResult.failed}`));
            } else {
                console.error(pc.red(`[ERROR] 分类成员迁移返回空结果：${categoryName0} → ${newCategoryName}`));
                
                // 记录错误日志
                await logError(bot, `分类成员迁移返回空结果: ${categoryName0} → ${newCategoryName}`, {
                    category: categoryName0,
                    newCategory: newCategoryName
                });
            }
        } catch (error) {
            console.error(pc.red(`[ERROR] 分类成员迁移异常 (${categoryName0} → ${newCategoryName}):`), error.message);
            
            // 记录错误日志
            await logError(bot, `分类成员迁移异常: ${categoryName0} → ${newCategoryName}`, {
                message: error.message,
                stack: error.stack,
                category: categoryName0,
                newCategory: newCategoryName
            });
        }

        await sleep(3000);
    }

    // 输出最终统计
    console.log(pc.cyan('\n========== 执行统计 =========='));
    console.log(pc.cyan(`总分类数: ${stats.total}`));
    console.log(pc.cyan(`已处理: ${stats.processed}`));
    console.log(pc.green(`成功: ${stats.success}`));
    console.log(pc.yellow(`跳过: ${stats.skipped}`));
    console.log(pc.red(`失败: ${stats.failed}`));
    
    if (stats.errors.length > 0) {
        console.log(pc.red('\n错误详情:'));
        stats.errors.forEach((err, index) => {
            console.log(pc.red(`  ${index + 1}. ${err.category}`));
            console.log(pc.red(`     类型: ${err.type}`));
            console.log(pc.red(`     代码: ${err.error}`));
            if (err.info) {
                console.log(pc.red(`     信息: ${err.info}`));
            }
        });
    }
    
    console.log(pc.cyan('\n========== 任务完成 =========='));
    
    // 如果有失败项，返回非零退出码
    if (stats.failed > 0) {
        process.exitCode = 1;
    }
}

// 执行主函数并处理未捕获的异常
main().catch(async error => {
    console.error(pc.red('\n[FATAL] 脚本执行失败:'), error);
    
    // 尝试记录致命错误到日志页面（如果 bot 已初始化）
    try {
        // 注意：这里 bot 可能还未初始化，所以使用可选链
        const { createBot } = require('./auth');
        const bot = await createBot('bot').catch(() => null);
        
        if (bot) {
            await logError(bot, '脚本执行致命错误', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
        }
    } catch (logError) {
        console.error(pc.red('[WARN] 无法记录致命错误到日志页面:'), logError.message);
    }
    
    process.exitCode = 1;
});
