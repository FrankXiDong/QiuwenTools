# 双重定向修复功能 - 快速参考

## 重要说明

⚠️ **分类重定向使用模板语法**，而非标准 `#REDIRECT`：
- ✅ `{{cr|目标分类名}}` - 秋闻 wiki 标准格式
- ✅ `{{Cr|目标分类名}}` - 大小写变体
- ✅ `{{Category Redirect|目标分类名}}` - 英文全称
- ✅ `{{CategoryRedirect|目标分类名}}` - 无空格版本
- ✅ `{{分類重定向|目标分类名}}` - 繁体中文全称
- ❌ `#REDIRECT [[目标]]` - 不适用于分类

本工具专门处理基于**分类重定向模板**的链式问题。

## 新增文件

1. **fix-double-redirects.js** - 核心工具模块
2. **test-fix-double-redirects.js** - 测试脚本
3. **FIX_DOUBLE_REDIRECTS_USAGE.md** - 详细使用文档

## 修改文件

1. **task2.js** - 集成双重定向修复功能

## 核心功能

```javascript
const { fixDoubleRedirects } = require('./fix-double-redirects');

// 在分类移动后调用
await bot.move(sourceCategory, targetCategory, summary, {
    noredirect: false,  // 创建重定向
});

// 立即修复双重定向
await fixDoubleRedirects(bot, sourceCategory, 3000);
```

## 命令行使用

```bash
# 基本用法
node fix-double-redirects.js Category:分类名

# 批量处理
node fix-double-redirects.js --categories="Cat1,Cat2,Cat3"

# 查看帮助
node fix-double-redirects.js --help
```

## 工作流程（task2.js）

```
1. 检查目标分类是否存在
   ↓ (不存在)
2. 移动分类（创建重定向）
   ↓
3. 修复双重定向 ← 新增步骤
   ↓
4. 转移分类成员
   ↓
5. 处理 Catnav 模板
```

## 关键特性

✅ 自动检测重定向链  
✅ 递归追踪最终目标  
✅ 智能修复多重定向  
✅ 防止循环重定向（最大10层）  
✅ 支持批量处理  
✅ 详细日志输出  

## 注意事项

- 确保 `.env` 配置了正确的 OAuth2 凭证
- 内置延时机制防止 API 限流
- 单个失败不影响整体流程
- 需要编辑和移动页面权限
