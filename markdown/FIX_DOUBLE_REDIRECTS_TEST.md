# 双重定向修复功能测试指南

## 测试准备

### 1. 创建测试分类结构

在秋闻 wiki 上手动创建以下分类页面来模拟双重定向场景：

**测试场景 1：简单的双重定向**
```
Category:测试双重定向A 内容: {{cr|测试双重定向B}}
Category:测试双重定向B 内容: {{cr|测试双重定向C}}
Category:测试双重定向C 内容: （正常分类页面，有实际内容）
```

**测试场景 2：三重重定向**
```
Category:测试三重定向1 内容: {{cr|测试三重定向2}}
Category:测试三重定向2 内容: {{cr|测试三重定向3}}
Category:测试三重定向3 内容: {{cr|测试三重定向4}}
Category:测试三重定向4 内容: （正常分类页面）
```

**测试场景 3：混合模板格式**
```
Category:测试混合格式A 内容: {{Cr|测试混合格式B}}
Category:测试混合格式B 内容: {{分类重定向|测试混合格式C}}
Category:测试混合格式C 内容: （正常分类页面）
```

### 2. 运行测试脚本

修改 `test-fix-double-redirects.js` 中的测试分类列表：

```javascript
const testCategories = [
    'Category:测试双重定向A',
    'Category:测试三重定向1',
    'Category:测试混合格式A'
];
```

然后运行：
```bash
node test-fix-double-redirects.js
```

## 预期结果

### 测试场景 1 预期输出
```
[INFO] 检查重定向链: Category:测试双重定向A
[INFO] 检测到分类重定向模板: Category:测试双重定向A → Category:测试双重定向B
[INFO] 发现重定向: Category:测试双重定向A → Category:测试双重定向B
[INFO] 检测到分类重定向模板: Category:测试双重定向B → Category:测试双重定向C
[INFO] 追踪重定向链: Category:测试双重定向B → Category:测试双重定向C
[WARN] 检测到多重定向链 (3 层):
       Category:测试双重定向A → Category:测试双重定向B → Category:测试双重定向C
[INFO] 修复为直接重定向到最终目标: Category:测试双重定向C
[SUCCESS] 已修复重定向: Category:测试双重定向A → Category:测试双重定向C
```

修复后，`Category:测试双重定向A` 的内容应该变为：
```
{{cr|测试双重定向C}}
```

### 测试场景 2 预期输出
```
[WARN] 检测到多重定向链 (4 层):
       Category:测试三重定向1 → Category:测试三重定向2 → Category:测试三重定向3 → Category:测试三重定向4
[SUCCESS] 已修复重定向: Category:测试三重定向1 → Category:测试三重定向4
```

修复后，`Category:测试三重定向1` 的内容应该变为：
```
{{cr|测试三重定向4}}
```

### 测试场景 3 预期输出
应该能够正确识别不同格式的模板并成功修复。

## 验证方法

### 1. 通过网页验证
访问修复后的分类页面，确认：
- 页面显示正确的重定向信息
- 点击重定向链接能到达最终目标
- 页面源代码中使用 `{{cr|...}}` 格式

### 2. 通过 API 验证
```bash
# 查询页面内容
curl "https://qiuwen.wiki/api.php?action=query&titles=Category:测试双重定向A&format=json"
```

### 3. 再次运行测试
修复后再次运行测试脚本，应该看到：
```
[OK] 重定向正常，无需修复: Category:测试双重定向A → Category:测试双重定向C
```

## 边界情况测试

### 1. 非重定向页面
测试一个正常的分类页面（没有重定向），应该输出：
```
[SKIP] 页面不是重定向或无法解析: Category:正常分类
```

### 2. 循环重定向（异常场景）
创建循环重定向来测试防护机制：
```
Category:循环A 内容: {{cr|循环B}}
Category:循环B 内容: {{cr|循环A}}
```

应该输出：
```
[ERROR] 重定向链过长，可能存在循环重定向: Category:循环A
```

### 3. 不存在的目标分类
```
Category:无效重定向 内容: {{cr|不存在的分类}}
```

工具应该能够处理这种情况，不会报错但会追踪到缺失页面。

## 集成测试

在 `task2.js` 中运行完整的分类移动流程：

```bash
node task2.js --single
```

观察输出日志，确认在分类移动后能看到：
```
[SUCCESS] 已完成移动：Category:旧分类 → Category:新分类
[INFO] 检查并修复双重定向...
[INFO] 检测到分类重定向模板: Category:旧分类 → Category:新分类
[OK] 重定向正常，无需修复: Category:旧分类 → Category:新分类
```

## 常见问题

### Q: 为什么修复后还是显示重定向？
A: 这是正常的！修复的目的是将多重定向（A→B→C）简化为单重定向（A→C），而不是移除重定向本身。

### Q: 工具会修复所有重定向吗？
A: 不会。工具只修复长度 > 2 的重定向链（即双重或多重定向）。正常的单重定向不会被修改。

### Q: 如果模板格式不被识别怎么办？
A: 目前支持 `{{cr}}`、`{{Cr}}`、`{{分类重定向}}`、`{{Category Redirect}}` 等常见格式。如果遇到其他格式，可以在代码中添加新的正则表达式模式。

### Q: 修复操作安全吗？
A: 是的。修复操作只是更新重定向模板的目标参数，不会影响分类成员或其他页面内容。所有操作都有详细日志记录。

## 清理测试数据

测试完成后，记得删除或清理测试用的分类页面，保持 wiki 整洁。
