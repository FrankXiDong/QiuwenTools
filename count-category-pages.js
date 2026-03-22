/*
 * 报告“[[Category:求闻百科积压工作]]”及其所有子分类（多层级）共包括多少个页面
 * 使用 mwn 获取分类成员，递归遍历子分类并统计命名空间 0 的页面。
 */

const { Mwn } = require('mwn');
const config = require('./config');
const pc = require('picocolors');

async function main() {
    const bot = new Mwn({
        apiUrl: config.apiUrl,
        userAgent: config.move_bot.userAgent,
        defaultParams: {
            maxlag: 5
        }
    });

    const rootCategory = 'Category:求闻百科积压工作';
    const seenCategories = new Set();
    const seenPages = new Set();
    // 用于记录分类与其深度（根分类深度0）
    const queue = [{ title: rootCategory, depth: 0 }];

    while (queue.length) {
        const { title: category, depth } = queue.shift();
        if (seenCategories.has(category)) continue;
        seenCategories.add(category);

        console.log(pc.blue(`[INFO] 处理分类 ${category} (深度 ${depth})`));

        let cmcontinue = '';
        do {
            const res = await bot.request({
                action: 'query',
                format: 'json',
                list: 'categorymembers',
                cmtitle: category,
                cmlimit: 'max',
                cmcontinue,
                formatversion: 2
            });

            for (const item of res.query.categorymembers) {
                if (item.ns === 14) {
                    // 子分类
                    if (depth === 0) {
                        // 根分类的所有一级子分类都入队
                        queue.push({ title: item.title, depth: 1 });
                    } else if (depth === 1) {
                        // 只有一级子分类名称包含“分类”时，才允许其子分类入队（即深度2）
                        if (item.title.includes('分类')) {
                            queue.push({ title: item.title, depth: 2 });
                        }
                    }
                    // 深度>=2 不再扩展
                } else if (item.ns === 0) {
                    // 普通页面，只要处于0/1/2级就统计，深度2只有在允许时才会达到此处
                    if (depth <= 2) {
                        seenPages.add(item.title);
                    }
                }
            }

            cmcontinue = res.continue ? res.continue.cmcontinue : '';
        } while (cmcontinue);
    }

    console.log(pc.green(`\n===== 报告 =====`));
    console.log(pc.green(`分类及其所有子分类共包含页面 数量: ${seenPages.size}`));
    console.log(pc.green(`包含页面列表（部分）：`));
    [...seenPages].slice(0, 20).forEach(t => console.log('  ' + t));
}

main().catch(err => {
    console.error(pc.red('[FATAL] 执行出错:'), err);
    process.exit(1);
});
