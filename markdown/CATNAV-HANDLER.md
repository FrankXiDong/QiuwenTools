# Catnav 模板处理模块

## 概述

`catnav-handler.js` 是一个独立的工具模块，用于处理 MediaWiki 分类页面中的 Catnav 模板。该模块从 `task1.js` 中提取出来，可以复用到其他需要处理 Catnav 模板的脚本中。

## 功能特性

- **自动检测**：检测分类页面是否已存在 Catnav 模板
- **智能替换**：将各种格式的 Catnav 模板统一替换为 `{{Catnav|auto=1}}`
- **自动添加**：如果页面没有 Catnav 模板，自动在页首添加
- **重定向检测**：自动跳过分类重定向页面
- **批量处理**：支持批量处理多个分类页面
- **错误处理**：完善的错误处理和日志输出
- **礼貌延时**：内置延时机制，避免对服务器造成过大压力

## API

### handleCatnavTemplate(bot, categoryName, sleepTime)

处理单个分类页面的 Catnav 模板。

**参数：**
- `bot` (Object): Mwn bot 实例
- `categoryName` (string): 分类页面名称（如 "Category:示例分类"）
- `sleepTime` (number): 操作后的延时时间（毫秒），默认 3000

**返回值：**
- `Promise<boolean>`: 返回 true 表示成功处理，false 表示跳过或失败

**示例：**
```javascript
const { handleCatnavTemplate } = require('./catnav-handler');

// 处理单个分类页面
await handleCatnavTemplate(bot, 'Category:中国历史', 3000);
```

### batchHandleCatnavTemplates(bot, categoryNames, sleepTime)

批量处理多个分类页面的 Catnav 模板。

**参数：**
- `bot` (Object): Mwn bot 实例
- `categoryNames` (string[]): 分类页面名称数组
- `sleepTime` (number): 每个操作后的延时时间（毫秒），默认 3000

**返回值：**
- `Promise<Object>`: 包含处理结果统计的对象
  - `total`: 总数
  - `success`: 成功数量
  - `skip`: 跳过数量
  - `error`: 错误数量

**示例：**
```javascript
const { batchHandleCatnavTemplates } = require('./catnav-handler');

// 批量处理分类页面
const categories = [
    'Category:中国历史',
    'Category:世界历史',
    'Category:欧洲历史'
];

const result = await batchHandleCatnavTemplates(bot, categories, 3000);
console.log(`处理完成: 成功 ${result.success}, 跳过 ${result.skip}, 错误 ${result.error}`);
```

### sleep(ms)

延时函数。

**参数：**
- `ms` (number): 延时毫秒数

**返回值：**
- `Promise<void>`

**示例：**
```javascript
const { sleep } = require('./catnav-handler');

// 延时 2 秒
await sleep(2000);
```

## 使用场景

### 1. 在移动分类后处理 Catnav 模板

```javascript
const { Mwn } = require('mwn');
const { handleCatnavTemplate } = require('./catnav-handler');
const config = require('./config');

// 初始化 bot
const bot = new Mwn({
    apiUrl: config.apiUrl,
    userAgent: config.userAgent
});

// 移动分类
await bot.move('Category:旧分类', 'Category:新分类', '移动原因');

// 处理新分类的 Catnav 模板
await handleCatnavTemplate(bot, 'Category:新分类', 3000);
```

### 2. 批量更新现有分类的 Catnav 模板

```javascript
const { batchHandleCatnavTemplates } = require('./catnav-handler');

// 获取分类列表
const pageList = await bot.request({
    action: 'query',
    list: 'categorymembers',
    cmtitle: 'Category:父分类',
    cmlimit: 'max'
});

const categories = pageList.query.categorymembers.map(page => page.title);

// 批量处理
const result = await batchHandleCatnavTemplates(bot, categories, 3000);
console.log(result);
```

## 注意事项

1. **认证要求**：使用前需要确保 bot 实例已经正确认证并获取了必要的 token
2. **速率限制**：建议设置合理的 `sleepTime` 以避免触发 MediaWiki 的速率限制
3. **重定向页面**：模块会自动检测并跳过分类重定向页面
4. **错误处理**：建议在调用时添加 try-catch 以捕获可能的异常

## 依赖

- `picocolors`: 用于彩色终端输出
- `mwn`: MediaWiki Node.js 客户端库（需要在调用方提供 bot 实例）

## 许可证

与主项目相同
