# OAuth 认证模块使用指南

## 📦 模块位置

`auth.js` - 统一的 MediaWiki OAuth 认证模块

## ✨ 功能特性

- ✅ 支持 **user** 和 **bot** 两种账号类型
- ✅ 自动处理 OAuth2 令牌获取（支持直接使用 Access Token 或 Client Credentials）
- ✅ 自动注入 Bearer Token 到请求头
- ✅ 验证登录状态并获取 CSRF Token
- ✅ 详细的日志输出和错误处理
- ✅ 修复 Authorization header 中的非 ASCII 字符问题

## 🚀 快速开始

### 基础用法

```javascript
const { createBot } = require('./auth');

async function main() {
    // 创建 bot 实例（使用 user 账号）
    const bot = await createBot('user');
    
    // 或者使用 bot 账号
    // const bot = await createBot('bot');
    
    // 现在可以正常使用 bot 进行 API 操作
    const pageInfo = await bot.read('页面标题');
    console.log(pageInfo);
}

main().catch(console.error);
```

### 账号选择指南

| 账号类型 | 适用场景 | 环境变量前缀 |
|---------|---------|------------|
| `user` | 需要人工身份的操作、页面移动、数据导入等 | `USER_*` |
| `bot` | 自动化批量操作、分类管理、模板更新等 | `BOT_*` |

## 📝 完整示例

### 示例 1：读取页面内容

```javascript
const { createBot } = require('./auth');
const pc = require('picocolors');

async function readPage() {
    const bot = await createBot('user');
    
    try {
        const page = await bot.read('示例页面');
        console.log(pc.green('[SUCCESS] 页面内容:'));
        console.log(page.content);
    } catch (e) {
        console.error(pc.red('[ERROR] 读取失败:'), e);
    }
}

readPage();
```

### 示例 2：编辑页面

```javascript
const { createBot } = require('./auth');
const pc = require('picocolors');

async function editPage() {
    const bot = await createBot('bot');
    
    try {
        await bot.save('示例页面', '新的页面内容', {
            summary: '机器人自动编辑',
            minor: true
        });
        console.log(pc.green('[SUCCESS] 页面保存成功'));
    } catch (e) {
        console.error(pc.red('[ERROR] 保存失败:'), e);
    }
}

editPage();
```

### 示例 3：批量操作（带延时）

```javascript
const { createBot } = require('./auth');
const pc = require('picocolors');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function batchOperation() {
    const bot = await createBot('bot');
    
    const pages = ['页面1', '页面2', '页面3'];
    
    for (const pageTitle of pages) {
        try {
            console.log(pc.cyan(`[INFO] 处理页面: ${pageTitle}`));
            
            // 执行操作...
            const page = await bot.read(pageTitle);
            
            // 礼貌延时，避免触发速率限制
            await sleep(3000);
        } catch (e) {
            console.error(pc.red(`[ERROR] 处理 "${pageTitle}" 失败:`), e);
        }
    }
}

batchOperation();
```

### 示例 4：分类页面处理

```javascript
const { createBot } = require('./auth');
const pc = require('picocolors');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function processCategory() {
    const bot = await createBot('bot');
    const categoryName = '示例分类';
    
    try {
        // 获取分类下的所有页面
        const members = await bot.getCategoryMembers(categoryName, {
            type: 'page',
            limit: 500
        });
        
        console.log(pc.cyan(`[INFO] 分类 "${categoryName}" 下有 ${members.length} 个页面`));
        
        for (const member of members) {
            try {
                console.log(pc.cyan(`[INFO] 处理页面: ${member.title}`));
                
                // 执行你的操作...
                
                // 礼貌延时
                await sleep(3000);
            } catch (e) {
                console.error(pc.red(`[ERROR] 处理 "${member.title}" 失败:`), e);
            }
        }
    } catch (e) {
        console.error(pc.red('[ERROR] 获取分类成员失败:'), e);
    }
}

processCategory();
```

## 🔧 高级用法

### 直接使用 getOAuth2Token

如果你只需要获取访问令牌而不需要完整的 bot 实例：

```javascript
const { getOAuth2Token } = require('./auth');

async function getToken() {
    // 获取 user 账号的 token
    const userToken = await getOAuth2Token('user');
    console.log('User Token:', userToken);
    
    // 获取 bot 账号的 token
    const botToken = await getOAuth2Token('bot');
    console.log('Bot Token:', botToken);
}

getToken();
```

### 自定义配置

如果需要覆盖默认配置：

```javascript
const { createBot } = require('./auth');
const config = require('./config');

async function customBot() {
    // createBot 会自动使用 config.requestOptions 中的重试配置
    const bot = await createBot('user');
    
    // 你可以继续使用 bot 实例，它已经包含了所有配置
    // ...
}

customBot();
```

## ⚙️ 环境配置

确保在 `.env` 文件中配置了相应的账号信息：

```env
# User 账号配置
USER_USER_AGENT=QiuwenUser/1.0 (Node.js/mwn; +https://www.qiuwenbaike.cn/User:YourUsername)
USER_OAUTH2_CLIENT_ID=your_user_client_id
USER_OAUTH2_CLIENT_SECRET=your_user_client_secret
USER_OAUTH2_ACCESS_TOKEN=your_user_access_token  # 可选

# Bot 账号配置
BOT_USER_AGENT=QiuwenBot/1.1 (Node.js/mwn; +https://www.qiuwenbaike.cn/User:FDtool)
BOT_OAUTH2_CLIENT_ID=your_bot_client_id
BOT_OAUTH2_CLIENT_SECRET=your_bot_client_secret
BOT_OAUTH2_ACCESS_TOKEN=your_bot_access_token  # 可选
```

## 📌 注意事项

1. **账号选择**：根据操作性质选择合适的账号类型
   - 人工操作 → `user`
   - 自动化批量操作 → `bot`

2. **速率限制**：在批量操作时务必添加延时（建议 3000ms）
   ```javascript
   await sleep(3000);
   ```

3. **错误处理**：始终使用 try-catch 包裹 API 调用
   ```javascript
   try {
       const result = await bot.read('页面');
   } catch (e) {
       console.error('操作失败:', e);
   }
   ```

4. **Token 优先级**：
   - 如果配置了 `ACCESS_TOKEN`，会直接使用
   - 否则通过 Client Credentials 自动获取

## 🔄 迁移旧代码

### 旧代码模式

```javascript
// ❌ 旧的写法（重复代码）
const config = require('./config');
const bot = new Mwn({
    apiUrl: config.apiUrl,
    userAgent: config.move_bot.userAgent,
    oauth2: {
        clientId: config.move_bot.clientId,
        clientSecret: config.move_bot.clientSecret,
        accessToken: config.move_bot.accessToken
    }
});
// ... 手动处理认证 ...
```

### 新代码模式

```javascript
// ✅ 新的写法（简洁复用）
const { createBot } = require('./auth');
const bot = await createBot('bot'); // 或 'user'
// ... 直接使用 ...
```

## 💡 最佳实践

1. **模块化**：将认证逻辑独立出来，便于维护
2. **统一性**：所有脚本使用相同的认证方式
3. **灵活性**：轻松切换 user/bot 账号
4. **安全性**：敏感信息通过环境变量管理
5. **可观测性**：详细的日志输出便于调试

## 🐛 常见问题

### Q: 如何知道应该用 user 还是 bot？

A: 
- 如果操作需要人工权限或代表个人行为 → `user`
- 如果操作是自动化、批量的 → `bot`

### Q: 为什么需要延时？

A: MediaWiki API 有速率限制，过快请求会被封禁。建议每次 API 调用后延时 3000ms。

### Q: 如何处理大量页面？

A: 使用分批处理 + 延时的方式：
```javascript
for (const page of pages) {
    await processPage(page);
    await sleep(3000); // 每次操作后延时
}
```

---

**最后更新**: 2026-04-25
