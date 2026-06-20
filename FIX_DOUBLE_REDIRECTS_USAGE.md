# 双重定向修复工具使用说明

## 概述

`fix-double-redirects.js` 是一个用于修复 MediaWiki 分类移动后产生的双重/多重重定向问题的工具模块。

## 问题背景

在秋闻（Qiuwen）wiki 中，**分类重定向是通过分类重定向模板实现的**，而不是标准的 `#REDIRECT` 语法。常见的分类重定向模板包括：

- `{{cr|目标分类名}}` - 最常用的简写形式
- `{{Cr|目标分类名}}` - 大小写变体
- `{{分类重定向|目标分类名}}` - 中文全称
- `{{Category Redirect|目标分类名}}` - 英文全称

当多次移动分类或操作不当时，可能会产生链式重定向（例如：A → B → C），这就是双重或多重重定向。

双重定向会导致：
- 页面访问效率降低
- 分类导航混乱
- API 查询性能下降
- 用户体验不佳

## 重要说明

### 分类重定向 vs 标准重定向

**标准页面重定向**使用 `#REDIRECT [[目标页面]]` 语法，而**分类重定向**使用模板语法。

秋闻 wiki 支持的分类重定向模板格式包括：
- `{{cr|目标分类名}}` - 最常用的简写形式
- `{{Cr|目标分类名}}` - 大小写变体
- `{{Category Redirect|目标分类名}}` - 英文全称
- `{{CategoryRedirect|目标分类名}}` - 无空格版本
- `{{分類重定向|目标分类名}}` - 繁体中文全称

本工具专门处理**分类重定向模板**的链式问题，能够：
- ✅ 正确解析上述所有模板格式
- ✅ 追踪基于模板的重定向链
- ✅ 使用正确的模板格式修复重定向

## 功能特性

1. **自动检测重定向链**：递归追踪重定向目标，直到找到最终非重定向页面
2. **智能修复**：将所有中间重定向直接指向最终目标
3. **模板识别**：支持多种分类重定向模板格式（`{{cr}}`、`{{Cr}}`、`{{分类重定向}}` 等）
4. **安全防护**：设置最大深度限制（10层），防止循环重定向
5. **批量处理**：支持同时处理多个分类
6. **详细日志**：输出完整的重定向链信息和修复结果

## 使用方法

### 方式一：作为模块在其他脚本中使用

```
const { fixDoubleRedirects } = require('./fix-double-redirects');

// 在 task2.js 中的使用示例
await bot.move(sourceCategory, targetCategory, summary, {
    noredirect: false,  // 创建重定向
    // ... 其他参数
});

// 移动完成后立即修复双重定向
await fixDoubleRedirects(bot, sourceCategory, 3000);
```

### 方式二：命令行独立运行

```
# 修复单个分类
node fix-double-redirects.js --categories="Category:测试分类"

# 修复多个分类（逗号分隔）
node fix-double-redirects.js --categories="Category:分类1,Category:分类2"

# 使用位置参数
node fix-double-redirects.js Category:分类1 Category:分类2

# 不带前缀的分类名（自动补全）
node fix-double-redirects.js 分类1 分类2

# 自定义延时时间
node fix-double-redirects.js --categories="Category:测试" --sleep=5000

# 使用 user 账号
node fix-double-redirects.js --categories="Category:测试" --account=user

# 查看帮助
node fix-double-redirects.js --help
```

### 命令行参数

**必需参数：**
- `--categories=<分类列表>` - 分类名称列表（逗号分隔）
- 或直接传入分类名作为位置参数

**可选参数：**
- `--sleep=<毫秒数>` - 每次操作后的延时时间（默认: 3000）
- `--account=<类型>` - 使用的账号类型: "user" 或 "bot"（默认: "bot"）
- `--help, -h` - 显示帮助信息

## API 参考

### fixDoubleRedirects(bot, categoryName, sleepTime)

修复单个分类的双重定向。

**参数：**
- `bot` (Object) - Mwn bot 实例
- `categoryName` (string) - 分类名称（完整标题，包含 "Category:" 前缀）
- `sleepTime` (number) - 每次操作后的延时时间（毫秒），默认 3000

**返回值：**
```javascript
{
    fixed: boolean,      // 是否进行了修复
    redirectChain: string[]  // 重定向链数组
}
```

### batchFixDoubleRedirects(bot, categoryNames, sleepTime)

批量修复多个分类的双重定向。

**参数：**
- `bot` (Object) - Mwn bot 实例
- `categoryNames` (string[]) - 分类名称数组
- `sleepTime` (number) - 每个操作后的延时时间（毫秒），默认 3000

**返回值：**
```javascript
{
    total: number,    // 总数
    success: number,  // 成功数
    fixed: number,    // 实际修复数
    skip: number,     // 跳过数
    error: number     // 错误数
}
```

### getRedirectTarget(bot, pageTitle)

获取页面的重定向目标（内部工具函数）。

**参数：**
- `bot` (Object) - Mwn bot 实例
- `pageTitle` (string) - 页面标题

**返回值：**
- `string | null` - 重定向目标，如果不是重定向则返回 null

## 工作流程

1. **检测重定向**：读取分类页面内容，识别分类重定向模板（`{{cr|...}}` 等）
2. **提取目标**：从模板参数中提取重定向目标分类名
3. **追踪链条**：递归追踪重定向目标，构建完整的重定向链
4. **判断是否需要修复**：如果重定向链长度 > 2，说明存在双重定向
5. **执行修复**：更新原始分类的重定向模板，直接指向最终目标
6. **记录日志**：输出详细的处理和修复信息

## 示例输出

```
[INFO] 检查重定向链: Category:测试分类
[INFO] 检测到分类重定向模板: Category:测试分类 → Category:中间分类
[INFO] 发现重定向: Category:测试分类 → Category:中间分类
[INFO] 检测到分类重定向模板: Category:中间分类 → Category:最终分类
[INFO] 追踪重定向链: Category:中间分类 → Category:最终分类
[WARN] 检测到多重定向链 (3 层):
       Category:测试分类 → Category:中间分类 → Category:最终分类
[INFO] 修复为直接重定向到最终目标: Category:最终分类
[SUCCESS] 已修复重定向: Category:测试分类 → Category:最终分类
```

## 集成到 task2.js

在 `task2.js` 中，修复双重定向的步骤已经集成到分类移动流程中：

```
// 1. 移动分类（创建重定向）
await bot.move(categoryName0, targetCategory, summary, {
    noredirect: false,
    movetalk: true,
});

// 2. 修复可能存在的双重定向
await fixDoubleRedirects(bot, categoryName0, 3000);

// 3. 转移分类成员
await moveCategoryMembers(bot, categoryName0, targetCategory, 5000);

// 4. 处理 Catnav 模板
await handleCatnavTemplate(bot, targetCategory, 3000);
```

## 注意事项

1. **认证配置**：确保 `.env` 文件中配置了正确的 OAuth2 凭证
2. **速率限制**：工具内置了延时机制，避免触发 API 速率限制
3. **循环重定向**：设置了最大深度限制（10层），检测到循环重定向会报错
4. **权限要求**：需要具有编辑和移动页面的权限
5. **错误处理**：单个分类失败不会影响其他分类的处理

## 测试

可以使用提供的测试脚本验证功能：

```
node test-fix-double-redirects.js
```

修改测试脚本中的 `testCategories` 数组为实际存在的分类名称即可。

## 故障排除

### 问题：提示 "页面不是重定向"
- 检查分类名称是否正确
- 确认分类确实存在且是重定向页面

### 问题：提示 "重定向链过长"
- 可能存在循环重定向，需要手动检查并清理
- 检查是否有恶意或错误的重定向设置

### 问题：API 请求失败
- 检查网络连接
- 验证 OAuth2 token 是否有效
- 查看错误日志获取详细信息

## 相关文档

- [MediaWiki API 文档](https://www.mediawiki.org/wiki/API:Main_page)
- [重定向页面](https://www.mediawiki.org/wiki/Help:Redirects)
- [QiuwenTools 项目 README](./README.md)
