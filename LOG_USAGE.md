# 错误日志记录模块使用说明

## 概述

`log.js` 提供了一个统一的错误日志记录功能，将所有脚本执行过程中的错误信息集中写入到用户的个人页面（`Special:MyPage/errorlog`），便于后续查看和分析。

## 功能特性

- ✅ **自动创建页面**：如果日志页面不存在，自动创建
- ✅ **有序列表格式**：使用 MediaWiki 的有序列表格式（`# ... ——时间戳`）
- ✅ **详细信息支持**：可附加错误对象、堆栈跟踪等详细信息
- ✅ **异步非阻塞**：日志记录失败不会影响主流程执行
- ✅ **时间戳标记**：每条错误都带有 ISO 格式的时间戳
- ✅ **截断保护**：编辑摘要自动截断，避免过长

## 安装与导入

```javascript
const { logError } = require('./log');
```

## API 参考

### `logError(bot, errorMessage, errorDetails)`

将错误信息写入日志页面。

**参数：**

- `bot` (Object): Mwn bot 实例
- `errorMessage` (string): 简短的错误描述（必填）
- `errorDetails` (Object|string, 可选): 详细的错误信息
  - 如果是对象，会以 JSON 格式格式化后放入 `<pre>` 标签
  - 如果是字符串，会直接放入 `<pre>` 标签

**返回值：**

- `Promise<boolean>`: 成功返回 `true`，失败返回 `false`

## 使用示例

### 1. 简单错误记录

```javascript
try {
    await bot.move(oldCategory, newCategory);
} catch (error) {
    await logError(bot, `分类移动失败: ${oldCategory}`);
}
```

### 2. 带详细信息的错误

```javascript
const moveResult = await bot.move(oldCategory, newCategory);

if (moveResult.error) {
    await logError(bot, `分类移动失败: ${oldCategory} → ${newCategory}`, {
        errorCode: moveResult.error.code,
        errorInfo: moveResult.error.info,
        sourceCategory: oldCategory,
        targetCategory: newCategory
    });
}
```

### 3. 异常捕获

```javascript
try {
    await someAsyncOperation();
} catch (error) {
    await logError(bot, '操作异常', {
        message: error.message,
        stack: error.stack,
        name: error.name
    });
}
```

### 4. 在批量处理中使用

```javascript
for (const item of items) {
    try {
        await processItem(item);
    } catch (error) {
        // 记录错误但继续处理其他项
        await logError(bot, `处理项失败: ${item.id}`, error);
        stats.failed++;
        continue;
    }
}
```

## 日志格式

日志页面内容示例：

```wiki
# 分类移动失败: Category:测试分类 → Category:新测试分类 ——2026-06-19T12:00:00.000Z
<pre>
{
  "errorCode": "articleexists",
  "errorInfo": "目标页面已存在",
  "sourceCategory": "Category:测试分类",
  "targetCategory": "Category:新测试分类"
}
</pre>

# API请求超时 ——2026-06-19T12:05:30.000Z
<pre>
Request timeout after 30000ms
</pre>
```

## 最佳实践

### 1. 错误描述要清晰

```javascript
// ❌ 不好的做法
await logError(bot, '出错了');

// ✅ 好的做法
await logError(bot, `分类成员迁移失败: ${categoryName} → ${newCategoryName}`);
```

### 2. 提供足够的上下文

```javascript
await logError(bot, 'API 请求失败', {
    action: 'query',
    title: pageTitle,
    errorCode: error.code,
    retryCount: attempt
});
```

### 3. 不要因日志记录失败而中断主流程

```javascript
try {
    await logError(bot, '某个错误', error);
} catch (logError) {
    // 仅输出警告，不抛出异常
    console.warn('无法记录错误日志:', logError.message);
}
```

### 4. 区分已知错误和未知错误

```javascript
if (isKnownError(error)) {
    // 已知错误，简单记录
    await logError(bot, getErrorMessage(error));
} else {
    // 未知错误，记录详细信息
    await logError(bot, '未知错误', {
        message: error.message,
        stack: error.stack,
        context: getContext()
    });
}
```

## 注意事项

1. **性能考虑**：每次日志记录都会发起 API 请求，在高频错误场景下可能影响性能
2. **页面大小**：长期运行可能导致日志页面过大，建议定期清理
3. **权限要求**：确保 bot 账号有编辑用户个人页面的权限
4. **并发安全**：多个脚本同时写入同一日志页面可能存在竞态条件（MediaWiki 会处理冲突）

## 与其他模块集成

`log.js` 已集成到以下脚本中：

- `task-0619.js`: 分类移动和成员迁移任务
- 未来可在其他脚本中按需引入

## 测试

运行测试脚本验证功能：

```bash
node test-log.js
```

测试完成后，访问 `Special:MyPage/errorlog` 页面查看生成的日志。

## 故障排除

### 日志页面未创建

- 检查 bot 账号是否有编辑权限
- 确认 API 连接正常
- 查看控制台输出的错误信息

### 日志记录失败

- 检查网络连接
- 确认 token 有效
- 查看 `logError` 返回值的布尔状态

### 日志格式不正确

- 确认 MediaWiki 支持有序列表语法
- 检查时间戳格式是否符合预期
