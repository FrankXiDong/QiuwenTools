/* [工具函数] 分类成员转移模块 */

const pc = require('picocolors');
const { sleep } = require('./catnav-handler');

/**
 * 将源分类中的所有成员转移到目标分类
 * @param {Object} bot - Mwn bot实例
 * @param {string} sourceCategory - 源分类名称（完整标题，包含 "Category:" 前缀）
 * @param {string} targetCategory - 目标分类名称（完整标题，包含 "Category:" 前缀）
 * @param {number} sleepTime - 每次操作后的延时时间（毫秒），默认5000
 * @returns {Promise<Object>} 返回统计信息 { success: number, failed: number, skipped: number }
 */
async function moveCategoryMembers(bot, sourceCategory, targetCategory, sleepTime = 5000) {
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
                
                // 检查是否已经包含目标分类（支持多种前缀）
                const targetCatName = targetCategory.replace(/^Category:/i, '');
                const targetCatPattern = new RegExp(`\\[\\[(?:Category|Cat|分[类類]):${escapeRegex(targetCatName)}(?:\\|[^[]*)?\\]\\]`, 'i');
                if (targetCatPattern.test(content)) {
                    console.log(pc.yellow(`[SKIP] 页面已包含目标分类，跳过: ${pageTitle}`));
                    stats.skipped++;
                    await sleep(sleepTime);
                    continue;
                }
                
                // 构建要添加的目标分类链接
                const targetCatLink = `[[${targetCategory}]]`;
                
                // 移除源分类标记（包括可能的排序键参数）
                const sourceCatName = sourceCategory.replace(/^Category:/i, '');
                // 匹配多种分类命名空间前缀：Category、Cat、分类、類別
                const categoryPrefixPattern = '(?:Category|Cat|分[类類])';
                const sourceCatPattern = new RegExp(`\\[\\[${categoryPrefixPattern}:${escapeRegex(sourceCatName)}(?:\\|[^[]*)?\\]\\]\\s*`, 'gi');
                content = content.replace(sourceCatPattern, '');
                
                // 在页面末尾添加目标分类（如果还没有分类的话）
                // 查找最后一个分类标记的位置（支持多种前缀）
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
                
                // 保存修改
                const editSummary = `分类成员转移：从 [[${sourceCategory}]] 移至 [[${targetCategory}]]`;

                await sleep(sleepTime/2);
                await bot.save(pageTitle, content, editSummary, { minor: true });
                
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
