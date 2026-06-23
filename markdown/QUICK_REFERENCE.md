# 快速参考卡片 🚀

## 📦 认证模块使用

```javascript
const { createBot } = require('./auth');

// 创建 bot 实例（一行搞定！）
const bot = await createBot('bot');  // 自动化操作
const bot = await createBot('user'); // 人工操作
```

---

## 🎯 账号选择速查表

| 脚本类型 | 账号类型 | 示例 |
|---------|---------|------|
| 页面导入 | `user` | MassImport.js |
| 分类管理 | `bot` | cat.js, cat01.js |
| 页面移动 | `bot` | task1.js, task2.js |
| 缓存刷新 | `bot` | purge.js |
| 数据统计 | `bot` | count-category-pages.js |
| 模板处理 | `bot` | catnav-handler.js |

**原则**: 
- 🤖 批量/自动化 → `bot`
- 👤 人工/特殊权限 → `user`

---

## 💻 常用操作示例

### 读取页面
```javascript
const page = await bot.read('页面标题');
console.log(page.content);
```

### 保存页面
```javascript
await bot.save('页面标题', '新内容', {
    summary: '编辑摘要',
    minor: true  // 小编辑
});
```

### 获取分类成员
```javascript
const members = await bot.getCategoryMembers('分类名', {
    type: 'page',  // 'page' | 'subcat' | 'file'
    limit: 500
});
```

### 移动页面
```javascript
await bot.move('旧标题', '新标题', '移动原因', {
    movetalk: true,      // 同时移动讨论页
    noredirect: false,   // 保留重定向
    watchlist: 'unwatch' // 不加入监视列表
});
```

### 批量操作（带延时）
```javascript
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

for (const page of pages) {
    try {
        await processPage(page);
        await sleep(3000); // ⚠️ 必须延时！
    } catch (e) {
        console.error('失败:', e);
    }
}
```

---

## ⚙️ 环境变量配置

```env
# User 账号
USER_OAUTH2_CLIENT_ID=xxx
USER_OAUTH2_CLIENT_SECRET=xxx
USER_OAUTH2_ACCESS_TOKEN=xxx  # 可选

# Bot 账号
BOT_OAUTH2_CLIENT_ID=xxx
BOT_OAUTH2_CLIENT_SECRET=xxx
BOT_OAUTH2_ACCESS_TOKEN=xxx  # 可选

# 通用
API_URL=https://www.qiuwenbaike.cn/api.php
API_DELAY_MS=3000
```

---

## 🔧 迁移其他脚本（3步完成）

### Step 1: 替换导入
```javascript
// 删除
const { Mwn } = require('mwn');
const config = require('./config');

// 改为
const { createBot } = require('./auth');
```

### Step 2: 删除认证代码
```javascript
// 删除 getOAuth2Token() 函数（~60行）
// 删除手动初始化 bot 的代码（~40行）
```

### Step 3: 简化 main 函数
```javascript
async function main() {
    const bot = await createBot('bot'); // ← 添加这一行
    
    // 原有业务逻辑保持不变...
}
```

---

## ⚠️ 重要提醒

### ✅ 必须做的
- [ ] 每次 API 调用后延时 **3000ms**
- [ ] 使用 `try-catch` 包裹 API 调用
- [ ] 选择合适的账号类型（user/bot）
- [ ] 保护 `.env` 文件安全

### ❌ 禁止做的
- [ ] 不要混用 user 和 bot 账号
- [ ] 不要忘记添加延时
- [ ] 不要硬编码敏感信息
- [ ] 不要提交 `.env` 到 Git

---

## 🐛 常见问题

**Q: 如何知道该用 user 还是 bot？**  
A: 批量/自动化 → `bot`，人工/特殊权限 → `user`

**Q: 延时时间多少合适？**  
A: 建议 **3000ms**（3秒），可根据实际情况调整

**Q: 如何处理大量页面？**  
A: 分批处理 + 延时，避免一次性加载太多

**Q: Token 过期怎么办？**  
A: 配置 `ACCESS_TOKEN` 或让系统自动通过 Client Credentials 获取

---

## 📚 详细文档

- 📖 [完整使用指南](AUTH_USAGE.md)
- 📊 [重构总结报告](REFACTORING_SUMMARY.md)
- 🔐 [认证模块源码](auth.js)

---

**提示**: 将此文件保存到项目根目录，方便随时查阅！📌
