本仓库存放一些半自动化脚本，用于便捷地清理一些页面问题。尚未归类。

部分代码（特别是获取token的代码）修改自/参考：https://github.com/ZoruaFox/2026SFE

## 工具模块

### Catnav 模板处理模块

- **文件**: `catnav-handler.js`
- **文档**: [CATNAV-HANDLER.md](./markdown/ATNAV-HANDLER.md)
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
- `task2.js`: 分类移动与成员转移（集成双重重定向修复）
- `task3.js`: 其他自动化任务
- `task4.js`: **批量移除Wayback模板**（新增）
- `remove-category-members.js`: **批量将分类成员从分类中移除**（新增）
- `cat.js`, `cat01.js`: 分类相关处理脚本
- `move.js`: 页面移动脚本
- `purge.js`: 页面清理脚本
- `import.js`: 数据导入脚本
- `count-category-pages.js`: 分类页面统计

### Task4 - Wayback模板移除

`task4.js` 用于批量移除Wiki页面中的Wayback模板（网页存档链接）。

**功能特点**：
- 自动查询所有使用Wayback模板的页面
- 兼容各种大小写形式（`{{Wayback}}`、`{{wayback}}`、`{{WAYBACK}}`等）
- 智能清理多余空行和空白
- 详细的执行日志和统计报告
- 支持GitHub Actions自动化运行

**使用方法**：
```bash
# 基本用法
node task4.js

# 自定义延时
node task4.js --sleep_time 6000

# 查看帮助
node task4.js --help
```

**详细文档**：
- [TASK4_USAGE.md](./markdown/TASK4_USAGE.md) - 完整使用说明
- [TASK4_QUICK_REF.md](./.github/workflows/task4.yml) - 快速参考指南
- [.github/workflows/task4.yml](./.github/workflows/task4.yml) - GitHub Actions配置

### Remove Category Members - 分类成员移除工具

`remove-category-members.js` 用于批量将指定分类的所有成员从该分类中移除。

**功能特点**：
- 自动获取分类下的所有成员（支持分页）
- 从每个成员页面中移除指定的分类标记
- 支持多种分类命名空间前缀（Category、Cat、分类、類別）
- 保留管道符参数（如排序键）
- 批量处理，支持限制处理数量
- 详细的日志输出和错误处理
- 支持自定义延时时间，避免触发 API 速率限制

**使用方法**：
```bash
# 基本用法（带或不带 Category: 前缀均可）
node remove-category-members.js --category="Category:待清理分类"
node remove-category-members.js --category="待清理分类"

# 限制处理数量
node remove-category-members.js --category="待清理分类" --limit 10

# 自定义延时
node remove-category-members.js --category="待清理分类" --sleep_time 6000

# 使用 user 账号
node remove-category-members.js --category="待清理分类" --account_type user

# 查看帮助
node remove-category-members.js --help
```

**详细文档**：
- [REMOVE_CATEGORY_MEMBERS_USAGE.md](./markdown/REMOVE_CATEGORY_MEMBERS_USAGE.md) - 完整使用说明
