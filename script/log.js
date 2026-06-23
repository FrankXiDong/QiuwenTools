/* [工具函数] 错误日志记录模块 */

const pc = require('picocolors');

/**
 * 将错误信息写入 Special:MyPage/errorlog 页面
 * @param {Object} bot - Mwn bot实例
 * @param {string} errorMessage - 简短的错误描述
 * @param {Object|string} [errorDetails] - 可选的详细错误信息（对象或字符串）
 * @returns {Promise<boolean>} 是否成功写入日志
 */
async function logError(bot, errorMessage, errorDetails = null) {
    const logPageAlias = 'Special:MyPage/errorlog';
    
    try {
        // 获取当前时间戳
        const timestamp = new Date().toISOString();
        
        // 构建日志条目
        let logEntry = `# ${errorMessage} ——${timestamp}`;
        
        // 如果有详细信息，追加到日志条目
        if (errorDetails) {
            if (typeof errorDetails === 'object') {
                // 如果是对象，转换为格式化的字符串
                const detailsStr = JSON.stringify(errorDetails, null, 2);
                logEntry += `\n<pre>\n${detailsStr}\n</pre>`;
            } else {
                // 如果是字符串，直接追加
                logEntry += `\n<pre>\n${errorDetails}\n</pre>`;
            }
        }
        
        logEntry += '\n';
        
        // 解析 Special:MyPage 获取实际的页面标题
        // Special:MyPage 会重定向到 User:<username>/errorlog
        let actualLogPage = logPageAlias;
        try {
            // 首先尝试读取 Special:MyPage/errorlog 获取重定向信息
            const redirectResult = await bot.request({
                action: 'query',
                titles: logPageAlias,
                redirects: true
            });
            
            // 从响应中提取实际的页面标题
            const pages = redirectResult.query.pages;
            const pageId = Object.keys(pages)[0];
            if (pageId !== '-1' && pages[pageId].title) {
                actualLogPage = pages[pageId].title;
                console.log(pc.cyan(`[INFO] 日志页面实际路径: ${actualLogPage}`));
            }
        } catch (resolveError) {
            // 如果无法解析，使用默认格式
            console.log(pc.yellow(`[WARN] 无法解析 Special:MyPage，使用默认路径`));
            // 尝试获取当前用户名
            try {
                const userInfo = await bot.request({
                    action: 'query',
                    meta: 'userinfo'
                });
                const username = userInfo.query.userinfo.name;
                actualLogPage = `User:${username}/errorlog`;
                console.log(pc.cyan(`[INFO] 推断日志页面路径: ${actualLogPage}`));
            } catch (userError) {
                actualLogPage = 'User:Bot/errorlog'; // 最后的备选
                console.log(pc.yellow(`[WARN] 无法获取用户名，使用默认路径: ${actualLogPage}`));
            }
        }
        
        // 读取现有日志页面内容
        let existingContent = '';
        try {
            const result = await bot.read(actualLogPage);
            if (result && result.revisions && result.revisions[0]) {
                existingContent = result.revisions[0].content || '';
            }
        } catch (readError) {
            // 如果页面不存在，使用空内容
            console.log(pc.yellow(`[INFO] 日志页面不存在，将创建新页面: ${actualLogPage}`));
            existingContent = '';
        }
        
        // 在现有内容末尾追加新日志
        const newContent = existingContent + '\n' + logEntry;
        
        // 保存更新后的内容
        const editSummary = `添加错误日志: ${errorMessage.substring(0, 50)}${errorMessage.length > 50 ? '...' : ''}`;
        await bot.save(actualLogPage, newContent, editSummary, { minor: true });
        
        console.log(pc.green(`[LOG] 错误已记录到 ${actualLogPage}`));
        return true;
        
    } catch (error) {
        // 日志记录失败，输出警告但不中断主流程
        console.error(pc.red(`[WARN] 无法写入错误日志: ${error.message}`));
        return false;
    }
}

module.exports = {
    logError
};
