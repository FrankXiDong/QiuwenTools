/* 本工具用于批量刷新页面缓存 */

const { createBot } = require('./auth');
const pc = require('picocolors');

// 封装主逻辑，增加错误处理，确保脚本退出状态正确
async function main() {
    // 1. 创建 bot 实例（使用 bot 账号进行自动化批量操作）
    console.log(pc.blue('[INFO] 初始化 Bot 账号...'));
    const bot = await createBot('bot');

    // 新增：加载站点信息以确保命名空间数据可用
    console.log(pc.blue('[INFO] 加载站点信息...'));
    await bot.getSiteInfo();

    // 2. 批量刷新页面缓存
    const cat = true;
    let titles = []; // 在函数开头声明
    
    if (cat === false) {
        let titleTemplate = '中国中央电视台{year}年春节联欢晚会';
        for (let i = 1983; i <= 2016; i++) {
            titles.push(titleTemplate.replace('{year}', i));
        }
    }
    else {
        const result = await bot.getPagesInCategory('Category:未被条目使用的合理使用文件');
        console.log(pc.dim('[DEBUG] getPagesInCategory 原始返回类型:'), typeof result, Array.isArray(result));
        
        // 提取标题字符串 - 确保只处理字符串
        titles = result.map((page, index) => {
            if (typeof page === 'string') {
                return page;
            } else if (page && typeof page === 'object' && page.title) {
                return page.title;
            } else {
                console.warn(pc.yellow(`[WARN] 第${index}个元素不是有效标题:`, page));
                return null;
            }
        }).filter(title => title !== null); // 过滤掉无效值
        
        console.log(pc.dim('[DEBUG] 处理后的 titles 类型:'), typeof titles, Array.isArray(titles));
    }
    
    console.log(pc.green(`[SUCCESS] 获取了以下 ${titles.length} 个页面标题:`), titles);
    
    // 验证所有标题都是字符串
    const invalidTitles = titles.filter(t => typeof t !== 'string');
    if (invalidTitles.length > 0) {
        console.error(pc.red('[ERROR] 发现非字符串标题:'), invalidTitles);
        process.exit(1);
    }
    
    // 礼貌延时
    await sleep(5000);
    console.log(pc.blue('[INFO] 开始刷新页面缓存...'));
    
    // 将titles转为string，xx|xx|xx|...的格式，确保传递给API的是字符串
    //titles = titles.join('|');
    //console.debug(pc.dim('[DEBUG] 传递给 purge API 的 titles:'), titles);
    const request_result = await bot.purge(titles);
    console.log(pc.green(`[SUCCESS] 刷新了 ${titles.length} 个页面的缓存，结果:`), request_result);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // 礼貌延时

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常