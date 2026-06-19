本仓库存放一些半自动化脚本，用于便捷地清理一些页面问题。尚未归类。

部分代码（特别是获取token的代码）修改自/参考：https://github.com/ZoruaFox/2026SFE

## 工具模块

### Catnav 模板处理模块

- **文件**: `catnav-handler.js`
- **文档**: [CATNAV-HANDLER.md](./CATNAV-HANDLER.md)
- **测试**: `test-catnav.js`

该模块提供了处理 MediaWiki 分类页面中 Catnav 模板的功能，包括：
- 自动检测和替换现有的 Catnav 模板
- 在缺少模板时自动添加
- 批量处理多个分类页面
- 智能跳过分类重定向页面

**使用示例**:
```javascript
const { handleCatnavTemplate } = require('./catnav-handler');

// 处理单个分类
await handleCatnavTemplate(bot, 'Category:示例分类', 3000);

// 批量处理
const { batchHandleCatnavTemplates } = require('./catnav-handler');
const result = await batchHandleCatnavTemplates(bot, categories, 3000);
```

### 错误日志记录模块

- **文件**: `log.js`
- **测试**: `test-log.js`

该模块提供了统一的错误日志记录功能，将错误信息写入用户的个人页面（Special:MyPage/errorlog）：
- 自动检查并创建日志页面
- 以有序列表格式追加错误信息
- 支持附加详细的错误上下文
- 异步操作，不阻塞主流程

**使用示例**:
```javascript
const { logError } = require('./log');

// 简单错误
await logError(bot, '分类移动失败: Category:测试');

// 带详细信息的错误
await logError(bot, 'API请求失败', {
  code: 'http',
  message: error.message,
  stack: error.stack
});
```

## 主要脚本

- `task1.js`: 批量移动分类并处理 Catnav 模板
- `cat.js`, `cat01.js`: 分类相关处理脚本
- `move.js`: 页面移动脚本
- `purge.js`: 页面清理脚本
- `import.js`: 数据导入脚本
- `count-category-pages.js`: 分类页面统计
