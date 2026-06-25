# 分类成员移除工具使用说明

## 概述

`remove-category-members.js` 是一个用于批量将分类的所有成员从该分类中移除的自动化工具。它会读取指定分类下的所有成员（包括普通页面和子分类），并从这些成员的页面内容中移除该分类标记。

## 功能特性

- ✅ 自动获取分类下的所有成员（支持分页）
- ✅ 从每个成员页面中移除指定的分类标记
- ✅ 支持多种分类命名空间前缀（Category、Cat、分类、類別）
- ✅ 保留管道符参数（如排序键）
- ✅ 批量处理，支持限制处理数量
- ✅ 详细的日志输出和错误处理
- ✅ 支持自定义延时时间，避免触发 API 速率限制
- ✅ 支持使用 user 或 bot 账号执行

## 使用方法

### 基本用法

```bash
node remove-category-members.js --category=<分类名>
```

### 必需参数

- `--category <分类名>`: 要移出成员的分类名称（可带或不带 "Category:" 前缀）

### 可选参数

- `--sleep_time <毫秒>`: 每次操作后的延时时间（默认: 5000ms）
- `--account_type <类型>`: 使用的账号类型，'user' 或 'bot'（默认: 'bot'）
- `--limit <数量>`: 最多处理的页面数量（默认: 无限制，处理所有页面）
- `--help, -h`: 显示帮助信息

## 使用示例

### 1. 基本用法

```bash
# 带 Category: 前缀
node remove-category-members.js --category="Category:待清理分类"

# 不带 Category: 前缀（自动补全）
node remove-category-members.js --category="待清理分类"
```

### 2. 限制处理数量

```bash
# 只处理前 10 个页面
node remove-category-members.js --category="待清理分类" --limit 10

# 只处理前 50 个页面
node remove-category-members.js --category="待清理分类" --limit 50
```

### 3. 自定义延时时间

```bash
# 设置延时为 6 秒
node remove-category-members.js --category="待清理分类" --sleep_time 6000

# 设置延时为 3 秒
node remove-category-members.js --category="待清理分类" --sleep_time 3000
```

### 4. 使用不同账号类型

```bash
# 使用 user 账号（默认是 bot）
node remove-category-members.js --category="待清理分类" --account_type user

# 显式指定 bot 账号
node remove-category-members.js --category="待清理分类" --account_type bot
```

### 5. 组合使用多个参数

```bash
# 处理前 20 个页面，延时 4 秒，使用 user 账号
node remove-category-members.js --category="待清理分类" --limit 20 --sleep_time 4000 --account_type user
```

### 6. 查看帮助信息

```bash
node remove-category-members.js --help
node remove-category-members.js -h
```

## 工作流程

1. **初始化**: 解析命令行参数，创建 bot 实例
2. **获取成员**: 通过 `categorymembers` API 获取分类下的所有成员
3. **逐个处理**: 遍历每个成员页面
   - 读取页面内容
   - 使用正则表达式匹配并移除分类标记
   - 保存修改后的内容
4. **输出统计**: 显示成功、跳过、失败的数量

## 技术细节

### 分类标记匹配

工具支持以下分类命名空间前缀（不区分大小写）：
- `Category:`
- `Cat:`
- `分类:`
- `類別:`

### 正则表达式

```javascript
const categoryPrefixPattern = '(?:Category|Cat|分[类類])';
const catPattern = new RegExp(`\\[\\[${categoryPrefixPattern}:${escapeRegex(catName)}((?:\\|[^[]*)?)\\]\\]`, 'gi');
```

该正则表达式会：
- 匹配所有支持的分类前缀
- 保留管道符参数（如 `[[Category:分类名|排序键]]`）
- 全局替换所有匹配项

### 内容清理

移除分类标记后，工具会自动：
- 将多个连续空行替换为最多两个换行
- 清理行首行尾空白

## 错误处理

- 单个页面读取或保存失败不会影响整体流程
- 所有错误都会记录到日志中
- 可通过 `logError()` 函数将错误记录到用户页面的 errorlog
- 最终输出详细的统计信息

## 注意事项

1. **API 速率限制**: 建议设置合理的延时时间（3-8 秒），避免触发 MediaWiki API 的速率限制
2. **账号权限**: 确保使用的账号有编辑页面的权限
3. **备份数据**: 在大规模操作前，建议先备份重要数据
4. **测试运行**: 首次使用时，建议使用 `--limit` 参数少量测试
5. **重定向页面**: 工具会处理所有类型的页面，包括重定向页面
6. **模板页面**: 工具不会特殊处理模板页面，会正常移除分类标记

## 日志输出示例

```
[INFO] 账号类型: bot
[INFO] 目标分类: Category:待清理分类
[INFO] 延时设置: 5000ms
[INFO] 处理限制: 无限制（处理所有页面）
[INFO] 初始化 BOT 账号...
[INFO] 正在获取分类 "Category:待清理分类" 的所有成员...
[INFO] 已获取 50 个成员（累计: 50）
[COMPLETE] 共找到 50 个分类成员
[INFO] 开始从成员页面移除分类标记（共 50 个页面）...
[1/50] 处理页面: Page1
[SUCCESS] 已成功移除分类标记
[2/50] 处理页面: Page2
[SKIP] 未检测到分类标记，跳过
...
========== 任务完成统计 ==========
成功移除: 45 个页面
跳过: 3 个页面
失败: 2 个页面
总计: 50 个成员
====================================
```

## 相关文件

- `remove-category-members.js`: 主脚本文件
- `auth.js`: OAuth 认证模块
- `script/log.js`: 错误日志记录模块
- `config.js`: 配置文件

## 相关文档

- [AUTH_USAGE.md](AUTH_USAGE.md): 认证模块使用说明
- [LOG_USAGE.md](LOG_USAGE.md): 日志模块使用说明
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md): 快速参考指南
