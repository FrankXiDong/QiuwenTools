/* [机器人任务3]  */

const { createBot } = require('./auth');
const pc = require('picocolors');
const { handleCatnavTemplate, sleep } = require('./script/catnav-handler');
const { moveCategoryMembers } = require('./script/move-category-members');

// 封装主逻辑，增加错误处理，确保脚本退出状态正确
async function main() {
    // 1. 创建 bot 实例（使用 bot 账号进行自动化批量操作）
    console.log(pc.blue('[INFO] 初始化 Bot 账号...'));
    const bot = await createBot('bot');

    // 2. 使用 continue 功能获取所有活跃用户
    console.log(pc.blue('[INFO] 开始获取所有活跃用户...'));
    
    let allUsers = [];
    let continueParams = null;
    let pageCount = 0;
    
    do {
        // 构建查询参数
        const queryParams = {
            "list": "allusers",
            "formatversion": "2",
	        "auprop": "groups",
            "auactiveusers": 1,
            "aulimit": 500  // 每次获取最大数量
        };
        
        // 如果有继续参数，添加到查询中
        if (continueParams) {
            Object.assign(queryParams, continueParams);
        }
        
        // 执行查询
        const result = await bot.query(queryParams);
        
        // 提取用户数据
        if (result.query && result.query.allusers) {
            const users = result.query.allusers;
            // 只保留 name 和 recentactions 字段
            const filteredUsers = users.map(user => ({
                name: user.name,
                recentactions: user.recentactions,
                isbot: user.groups && user.groups.includes("bot") ? true : false,
            }));
            
            allUsers = allUsers.concat(filteredUsers);
            pageCount += filteredUsers.length;
            
            console.log(pc.green(`[INFO] 已获取 ${pageCount} 个活跃用户...`));
        }
        
        // 检查是否有继续参数
        continueParams = result.continue || null;
        
        // 礼貌延时，避免触发速率限制
        await sleep(2000);
        
    } while (continueParams);
    
    // 3. 将用户列表转换为字典（以 name 为键）
    console.log(pc.blue('[INFO] 正在构建用户字典...'));
    const userDict = {};
    allUsers.forEach(user => {
        userDict[user.name] = {
            name: user.name,
            recentactions: user.recentactions,
            isbot: user.isbot,
        };
    });
    
    // 4. 获取"求闻百科不再活跃用户"分类的成员列表
    console.log(pc.blue('[INFO] 正在获取"求闻百科不再活跃用户"分类成员...'));
    const retiredUsersSet = new Set();
    
    try {
        const retiredCategoryName = 'Category:求闻百科不再活跃用户';
        let continueParams = null;
        
        do {
            const params = {
                action: 'query',
                format: 'json',
                list: 'categorymembers',
                cmtitle: retiredCategoryName,
                cmlimit: 'max',
                cmtype: 'page'
            };
            
            if (continueParams) {
                Object.assign(params, continueParams);
            }
            
            const result = await bot.request(params);
            
            if (result.query && result.query.categorymembers) {
                result.query.categorymembers.forEach(member => {
                    // 提取用户名（去掉 "User:" 前缀）
                    if (member.title.startsWith('User:')) {
                        const username = member.title.substring(5);
                        retiredUsersSet.add(username);
                    }
                });
                console.log(pc.green(`[INFO] 已获取 ${result.query.categorymembers.length} 个退休用户（累计: ${retiredUsersSet.size}）`));
            }
            
            continueParams = result.continue || null;
            await sleep(1000);
            
        } while (continueParams);
        
        console.log(pc.green(`[COMPLETE] 共找到 ${retiredUsersSet.size} 个退休用户`));
        
    } catch (error) {
        console.error(pc.red('[ERROR] 获取退休用户列表失败:'), error.message);
        console.log(pc.yellow('[WARN] 将继续执行，但不会标记退休用户'));
    }

    // 5. 按近期编辑数排序，并转为wikitext文本格式（使用有序列表） 
    console.log(pc.blue('[INFO] 正在按编辑数排序并生成wikitext文本...'));
    
    // 将字典转换为数组并按 recentactions 降序排序
    const sortedUsers = Object.values(userDict).sort((a, b) => {
        return (b.recentactions || 0) - (a.recentactions || 0);
    });
    
    // 生成 wikitext 格式的有序列表
    let wikitext= '本页面为近30日的操作数（含编辑、导入、移动等操作）排名\n\
    \n== 总榜（含机器人） ==\n';
    wikitext += '{| class="wikitable sortable" style="text-align:center;"\n';
    wikitext += '! 排名 !! 用户名 !! 近30日操作数\n';
    wikitext += '|-\n';
    
    sortedUsers.forEach((user, index) => {
        const rank = index + 1;
        const username = user.name;
        const actions = user.recentactions || 0;
        
        // 检查用户是否为退休用户
        const isRetired = retiredUsersSet.has(username);
        
        // 使用 {{User3}} 格式创建用户链接
        if (isRetired) {
            // 退休用户：添加删除线和标注
            wikitext += `| ${rank} || <del>{{User3|${username}}}</del>'''（已[[Template:retired|退休]]）''' || ${actions}\n`;
        } else {
            // 正常用户
            wikitext += `| ${rank} || {{User3|${username}}} || ${actions}\n`;
        }
        wikitext += '|-\n';
    });
    wikitext += '|}';

    // 生成排除机器人的榜单
    wikitext += '\n\n== 非机器人账号榜 ==\n';
    wikitext += '{| class="wikitable sortable" style="text-align:center;"\n';
    wikitext += '! 排名 !! 用户名 !! 近30日操作数\n';
    wikitext += '|-\n';
    
    // 先过滤掉机器人，再遍历生成排名
    const nonBotUsers = sortedUsers.filter(user => {
        return !user.isbot && !user.name.includes('bot') && !user.name.includes('求闻百科社区') && !user.name.includes('New user page');
    });
    
    nonBotUsers.forEach((user, index) => {
        const rank = index + 1;
        const username = user.name;
        const actions = user.recentactions || 0;
        
        // 检查用户是否为退休用户
        const isRetired = retiredUsersSet.has(username);
        // 使用 {{User3}} 格式创建用户链接
        if (isRetired) {
            // 退休用户：添加删除线和标注
            wikitext += `| ${rank} || <del>{{User3|${username}}}</del>'''（已[[Template:retired|退休]]）''' || ${actions}\n`;
        } else {
            // 正常用户
            wikitext += `| ${rank} || {{User3|${username}}} || ${actions}\n`;
        }
        wikitext += '|-\n';
    });

    // 说明
    wikitext += '|}\n\n== 说明 ==\n';
    wikitext += '* 本页面由机器人自动更新（一般每天<del>凌晨4:00左右</del>更新），数据基于最近30天的编辑活动。\n';
    wikitext += '* 本页面API数据与[[Special:活跃用户]]理论上相同，如有误可能是MediaWiki系统的缓存问题，机器人操作者无法修复。\n';
    
    // 获取 CST 时间（中国标准时间，UTC+8）
    const now = new Date();
    const cstTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
    const cstTimeString = cstTime.toISOString().replace('T', ' ').substring(0, 19) + ' (CST)';
    
    wikitext += '* 更新时间：' + cstTimeString + '\n';

    wikitext += '\n{{求闻百科信息页|cat}}';
    
    // 6. 写入"NEA:近30日编辑数排名"页面（防止重复写入，如已有内容则替换掉，否则直接写入或创建该页面）
    console.log(pc.blue('[INFO] 正在写入页面 "NEA:近30日编辑数排名"...'));
    
    const pageName = 'NEA:近30日编辑数排名';
    
    try {
        // 读取现有页面内容
        let existingContent = '';
        try {
            const existingPage = await bot.read(pageName);
            existingContent = existingPage.revisions[0].content;
            console.log(pc.yellow(`[INFO] 检测到已存在的页面，准备更新内容...`));
        } catch (readError) {
            // 页面不存在，将创建新页面
            console.log(pc.green(`[INFO] 页面不存在，将创建新页面...`));
        }
        
        // 比较内容是否相同
        if (existingContent === wikitext) {
            console.log(pc.yellow(`[SKIP] 页面内容与当前生成的内容相同，无需更新。`));
        } else {
            // 保存页面
            const editSummary = '机器人：自动更新近30日活跃用户编辑数排名（task3）';
            await bot.save(pageName, wikitext, editSummary, { minor: true });
            console.log(pc.green(`[SUCCESS] 已成功${existingContent ? '更新' : '创建'}页面：${pageName}`));
        }
        
        // 礼貌延时
        await sleep(2000);
        
    } catch (saveError) {
        console.error(pc.red(`[ERROR] 保存页面时出错：${saveError.message}`));
        throw saveError;
    }

    // 7. 输出统计信息
    totalActions = sortedUsers.reduce((acc, user) => acc + (user.recentactions || 0), 0);
    avgActions = totalActions / sortedUsers.length;
    console.log(pc.blue('\n========== 统计信息 =========='));
    console.log(pc.green(`总活跃用户数：${sortedUsers.length}`));
    console.log(pc.green(`最高编辑数：${sortedUsers.length > 0 ? sortedUsers[0].recentactions : 0} (${sortedUsers.length > 0 ? sortedUsers[0].name : 'N/A'})`));
    console.log(pc.green(`最低编辑数：${sortedUsers.length > 0 ? sortedUsers[sortedUsers.length - 1].recentactions : 0}`));
    console.log(pc.green(`平均编辑数：${avgActions}`));
    console.log(pc.green(`总编辑次数：${totalActions}`));
    console.log(pc.green(`退休用户数：${retiredUsersSet.size}`));
    console.log(pc.blue('================================\n'));
    
    return userDict;
}

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常