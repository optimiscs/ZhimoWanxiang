# 定时任务测试

本目录包含对新闻热搜采集系统的定时任务进行测试的工具和测试用例。

## 测试内容

测试覆盖以下定时任务:

1. **心跳任务** (`heartbeat`) - 简单的应用运行状态检查
2. **基础新闻收集** (`collect_news_task`) - 从API收集新闻数据
3. **智能新闻收集** (`smart_collect_news_task`) - 带内容变化检测的智能收集
4. **热门新闻分析** (`analyze_trending_news_task`) - 定期深度分析热门新闻
5. **新闻处理任务** (`process_news_task`) - 处理新闻分析队列

## 环境配置

安装测试所需依赖:

```bash
pip install -r tests/requirements.txt
```

## 运行自动化测试

可以使用以下命令运行所有测试并生成HTML测试报告:

```bash
python tests/run_tests.py all
```

报告将生成在 `tests/reports` 目录下。

### 运行特定测试类

```bash
python tests/run_tests.py TestScheduledTasks
```

### 运行特定测试方法

```bash
python tests/run_tests.py TestScheduledTasks.test_heartbeat
```

### 查看可用测试

```bash
python tests/run_tests.py help
```

## 手动测试

除了自动化测试，还可以使用 `manual_test_tasks.py` 脚本在实际环境中手动测试各任务。

### 运行所有任务

```bash
python tests/manual_test_tasks.py all
```

### 运行特定任务

```bash
python tests/manual_test_tasks.py heartbeat
python tests/manual_test_tasks.py smart_collect_news
python tests/manual_test_tasks.py analyze_trending_news
```

### 强制执行智能任务（忽略变更检测）

```bash
python tests/manual_test_tasks.py smart_collect_news --force
```

### 监控模式

监控模式会连续多次执行同一任务，用于观察任务行为随时间变化的情况：

```bash
# 默认会每60秒执行一次智能采集任务，共执行5次
python tests/manual_test_tasks.py monitor

# 自定义监控参数
python tests/manual_test_tasks.py monitor --monitor-task collect_news --interval 30 --count 3
```

## 最佳实践

1. 先运行自动化测试，确保基本功能正常
2. 使用手动测试进行实际环境验证
3. 使用监控模式观察智能采集的行为（特别是内容变化检测功能）
4. 检查MongoDB中的相关集合，验证数据是否正确存储

## 设置开发环境的.env文件

确保在项目根目录有正确配置的 `.env` 文件，以便测试能够连接到API和数据库。 