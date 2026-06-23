# Task4 - 批量移除Wayback模板

## 功能说明

`task4.js` 是一个自动化工具，用于批量移除Wiki页面中的Wayback模板。该脚本会：

1. 查询所有嵌入了 `Template:Wayback` 的页面
2. 逐个读取页面内容
3. 使用正则表达式移除所有形式的Wayback模板（兼容大小写）
4. 保存修改后的页面内容
5. 记录详细的执行日志和统计信息

## 使用方法

### 基本用法

```bash
node task4.js
```

### 带参数运行

```bash
# 自定义延时时间（毫秒）
node task4.js --sleep_time 6000

# 使用user账号而非bot账号
node task4.js --account_type user

# 只处理前10个页面（用于测试）
node task4.js --limit 10

# 组合使用多个参数
node task4.js --limit 50 --sleep_time 4000 --account_type bot
```

### 查看帮助

```bash
node task4.js --help
# 或
node task4.js -h
```

## 命令行参数

### 可选参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--sleep_time <毫秒>` | 每次API操作后的延时时间 | 5000ms |
| `--account_type <类型>` | 使用的账号类型：'user' 或 'bot' | 'bot' |
| `--limit <数量>` | **最多处理的页面数量**（新增） | 无限制 |
| `--help`, `-h` | 显示帮助信息 | - |

### --limit 参数详解

`--limit` 参数允许你限制处理的页面数量，适用于以下场景：

1. **测试运行**：在大规模执行前先测试少量页面
   ```bash
   node task4.js --limit 5
   ```

2. **分批处理**：将大量页面分成多个批次处理
   ```bash
   # 第一批：处理前100个
   node task4.js --limit 100
   
   # 第二批：处理接下来的100个（需要手动调整或使用其他方法）
   ```

3. **快速清理**：只处理最近添加的Wayback模板
   ```bash
   node task4.js --limit 20
   ```

**注意事项**：
- 如果设置的limit大于实际找到的页面数量，将处理所有页面
- limit只限制处理数量，不影响查询阶段（仍会查询所有链入页面）
- 适合用于验证脚本效果或控制单次运行的规模

## 工作原理

### 1. 查询链入页面

脚本使用MediaWiki API的 `embeddedin` 列表查询所有嵌入了 `Template:Wayback` 的页面：

```javascript
{
    action: 'query',
    list: 'embeddedin',
    eititle: 'Template:Wayback',
    eilimit: 'max'
}
```

支持分页获取所有结果。

### 2. 正则匹配移除

使用不区分大小写的正则表达式匹配各种形式的Wayback模板：

```javascript
const waybackPattern = /\{\{[Ww][Aa][Yy][Bb][Aa][Cc][Kk][^}]*\}\}/g;
```

支持的模板形式包括：
- `{{Wayback}}`
- `{{wayback}}`
- `{{WAYBACK}}`
- `{{Wayback|url=xxx}}`
- `{{Wayback|url=xxx|date=yyy}}`
- 以及其他任何大小写变体

### 3. 内容清理

移除模板后，脚本会自动清理：
- 多余的空行（超过2个连续空行会被压缩为2个）
- 行首行尾的空白字符

### 4. 错误处理

- 单个页面处理失败不会影响其他页面
- 所有错误都会记录到 `Special:MyPage/errorlog` 页面
- 提供详细的错误信息和堆栈跟踪

## 输出示例

```
[INFO] 账号类型: bot
[INFO] 延时设置: 5000ms
[INFO] 初始化 BOT 账号...
[INFO] 正在查询Wayback模板的链入页面...
[INFO] 已获取 50 个页面（累计: 50）
[COMPLETE] 共找到 120 个包含Wayback模板的页面
[INFO] 开始逐个页面移除Wayback模板...
[1/120] 处理页面: Example_Page_1
[SUCCESS] 已成功移除Wayback模板
[2/120] 处理页面: Example_Page_2
[SKIP] 未检测到Wayback模板，跳过
...

========== 任务完成统计 ==========
成功移除: 95 个页面
跳过: 20 个页面
失败: 5 个页面
总计: 120 个页面
====================================
```

## 注意事项

1. **延时设置**：建议保持默认5秒延时，避免触发API速率限制。如果遇到问题可以增加延时时间。

2. **账号选择**：
   - 批量自动化任务推荐使用 `bot` 账号
   - 需要人工身份的操作使用 `user` 账号

3. **安全性**：
   - 脚本会标记为小编辑（minor edit）
   - 使用bot账号时会自动标记为机器人编辑
   - 所有操作都有详细的日志记录

4. **幂等性**：脚本可以安全地多次运行，已经移除过模板的页面会被跳过。

5. **正则兼容性**：当前正则表达式假设Wayback模板不包含嵌套的 `}}`，对于绝大多数情况都适用。

## 依赖模块

- `auth.js` - OAuth认证模块
- `script/log.js` - 错误日志记录模块
- `picocolors` - 彩色终端输出

## 相关文档

- [AUTH_USAGE.md](./markdown/AUTH_USAGE.md) - 认证模块使用说明
- [LOG_USAGE.md](./markdown/LOG_USAGE.md) - 日志模块使用说明
- [QUICK_REFERENCE.md](./markdown/QUICK_REFERENCE.md) - 快速参考指南
