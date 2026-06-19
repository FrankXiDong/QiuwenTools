/* [工具函数] Catnav模板处理模块 */

const pc = require('picocolors');

/**
 * 处理分类页面的Catnav模板
 * @param {Object} bot - Mwn bot实例
 * @param {string} categoryName - 分类页面名称
 * @param {number} sleepTime - 操作后的延时时间（毫秒），默认3000
 * @returns {Promise<boolean>} 是否成功处理
 */
async function handleCatnavTemplate(bot, categoryName, sleepTime = 3000) {
    try {
        const result = await bot.read(categoryName);
        const content = result.revisions[0].content;
        
        // 检查是否为分类重定向页面
        if (content.includes('{{cr') || content.includes('{{Cr') || content.includes('{{分类重定向')) {
            console.log(pc.yellow(`[SKIP] 分类重定向页面，跳过Catnav处理: ${categoryName}`));
            return false;
        }
        
        // 处理Catnav模板：统一替换为{{Catnav|auto=1}}
        const catnavPattern = /\{\{[Cc]atnav(?:\|[^}]*)?\}\}/g;
        const hasCatnav = catnavPattern.test(content);
        
        let updatedContent = content;
        let editSummary = '';
        let hasChanges = false;

        if (hasCatnav) {
            // 如果存在Catnav模板，统一替换为{{Catnav|auto=1}}
            updatedContent = content.replace(catnavPattern, '{{Catnav|auto=1}}');
            
            // 如果有变化且不是仅大小写变化，则保存
            if (updatedContent !== content) {
                // 检查是否只是模板名大小写变化（内容实质未变）
                const oldTemplate = content.match(/\{\{[Cc]atnav(?:\|[^}]*)?\}\}/)?.[0];
                const isOnlyCaseChange = oldTemplate && 
                    oldTemplate.toLowerCase().replace('{{catnav', '').replace('}}', '') === 
                    '{{Catnav|auto=1}}'.toLowerCase().replace('{{catnav', '').replace('}}', '');
                
                if (isOnlyCaseChange) {
                    console.log(pc.yellow(`[SKIP] 分类页面{{Catnav}}模板仅大小写不同，跳过编辑：${categoryName}`));
                } else {
                    editSummary = '统一{{Catnav}}模板参数';
                    await bot.save(categoryName, updatedContent, editSummary, { minor: true });
                    console.log(pc.green(`[SUCCESS] 已更新分类页面的{{Catnav}}模板：${categoryName}`));
                    hasChanges = true;
                }
            } else {
                console.log(pc.yellow(`[SKIP] 分类页面{{Catnav}}模板已是目标格式：${categoryName}`));
            }
        } else {
            // 如果不存在Catnav模板，在页首添加
            updatedContent = '{{Catnav|auto=1}}\n' + content;
            editSummary = '添加{{Catnav}}模板';
            await bot.save(categoryName, updatedContent, editSummary, { minor: true });
            console.log(pc.green(`[SUCCESS] 已在分类页面页首添加{{Catnav}}模板：${categoryName}`));
            hasChanges = true;
        }
        
        // 礼貌延时
        if (sleepTime > 0) {
            await sleep(sleepTime);
        }
        
        return hasChanges;
        
    } catch (error) {
        console.error(pc.red(`[ERROR] 处理{{Catnav}}模板失败 (${categoryName}):`), error.message);
        return false;
    }
}

/**
 * 批量处理多个分类页面的Catnav模板
 * @param {Object} bot - Mwn bot实例
 * @param {string[]} categoryNames - 分类页面名称数组
 * @param {number} sleepTime - 每个操作后的延时时间（毫秒），默认3000
 * @returns {Promise<Object>} 处理结果统计
 */
async function batchHandleCatnavTemplates(bot, categoryNames, sleepTime = 3000) {
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const categoryName of categoryNames) {
        try {
            const result = await handleCatnavTemplate(bot, categoryName, sleepTime);
            if (result === true) {
                successCount++;
            } else if (result === false) {
                // 可能是跳过或错误，需要进一步判断
                skipCount++;
            }
        } catch (error) {
            console.error(pc.red(`[ERROR] 批量处理中出错 (${categoryName}):`), error.message);
            errorCount++;
        }
    }
    
    return {
        total: categoryNames.length,
        success: successCount,
        skip: skipCount,
        error: errorCount
    };
}

/**
 * 延时函数
 * @param {number} ms - 延时毫秒数
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    handleCatnavTemplate,
    batchHandleCatnavTemplates,
    sleep
};
