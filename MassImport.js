/* 本工具用于批量导入多个页面 */

const { createBot } = require('./auth');
const pc = require('picocolors');

// 封装主逻辑，增加错误处理，确保脚本退出状态正确
async function main() {
    // 1. 创建 bot 实例（使用 user 账号）
    console.log(pc.blue('[INFO] 初始化 User 账号...'));
    const bot = await createBot('user');

    // 2. 执行批量导入
    const importList = `亞洲U18男子排球錦標賽` // 可替换为多行页面标题（每行一个页面）
        .split('\n')
        .filter(page => page.trim()); // 过滤空行
    
    for (const page of importList) {
        const trimmedPage = page.trim();
        
        // 如果页面已经存在，警告，请求用户确认是否导入
        try {
            const pageInfo = await bot.read(trimmedPage);
            if (pageInfo.revisions && pageInfo.revisions.length > 0) {
                console.warn(pc.yellow(`[WARNING] 页面 "${trimmedPage}" 已存在`));
                
                // TODO: 如果需要交互式确认，可以引入 prompts 库
                // const confirm = await prompts({
                //     type: 'confirm',
                //     name: 'value',
                //     message: `是否导入页面 "${trimmedPage}"？`,
                //     initial: false
                // });
                // if (!confirm.value) {
                //     console.log(pc.yellow(`[WARNING] 用户取消导入页面 "${trimmedPage}"`));
                //     continue;
                // }
                
                console.log(pc.yellow('[INFO] 跳过已存在的页面（如需覆盖请修改代码）'));
                continue;
            }
        } catch (e) {
            // 页面不存在，继续导入
            console.log(pc.cyan(`[INFO] 页面 "${trimmedPage}" 不存在，准备导入...`));
        }
        
        try {
            // 获取编辑令牌
            const tokens = await bot.request({
                "action": "query",
                "meta": "tokens",
                "formatversion": "2"
            });
            
            // 执行导入
            const result = await bot.request({
                summary: `[页面文字原许可: [[:cc-by-sa:4.0|CC BY-SA 4.0]]；作者请参见来源页面历史 ]`,
                action: 'import',
                interwikisource: "zhwiki",
                interwikipage: trimmedPage,
                format: 'json',
                token: tokens.query.tokens.csrftoken
            });
            
            if (result.error) {
                console.error(pc.red(`[ERROR] 导入页面 "${trimmedPage}" 失败: ${result.error.info}`));
            } else {
                console.log(pc.green(`[SUCCESS] 已导入页面 "${trimmedPage}"`));
            }
        } catch (e) {
            console.error(pc.red(`[ERROR] 导入页面 "${trimmedPage}" 时发生异常:`), e);
        }
        
        // 礼貌延时
        await sleep(3000);
    }
    
    console.log(pc.green('[INFO] 批量导入完成'));
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // 礼貌延时

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常