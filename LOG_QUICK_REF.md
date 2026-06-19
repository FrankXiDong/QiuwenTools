# 错误日志记录 - 快速参考

## 导入模块

```javascript
const { logError } = require('./log');
```

## 基本用法

```javascript
// 简单错误
await logError(bot, '错误描述');

// 带详细信息
await logError(bot, '错误描述', { key: 'value' });

// 异常捕获
try {
    // 操作
} catch (error) {
    await logError(bot, '操作失败', error);
}
```

## 常见场景

### API 错误
```javascript
if (result.error) {
    await logError(bot, `API错误: ${action}`, result.error);
}
```

### 移动失败
```javascript
await logError(bot, `移动失败: ${old} → ${new}`, {
    code: moveResult.error.code,
    info: moveResult.error.info
});
```

### 异常处理
```javascript
catch (error) {
    await logError(bot, '异常', {
        message: error.message,
        stack: error.stack
    });
}
```

## 日志位置

`Special:MyPage/errorlog`

## 日志格式

```
# 错误描述 ——ISO时间戳
<pre>
详细信息（如果有）
</pre>
```

## 注意事项

- ✅ 日志记录失败不会中断主流程
- ✅ 自动创建不存在的日志页面
- ⚠️ 高频调用可能影响性能
- ⚠️ 定期清理过大的日志页面
