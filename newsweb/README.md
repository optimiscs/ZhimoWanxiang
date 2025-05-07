# Ant Design Pro

This project is initialized with [Ant Design Pro](https://pro.ant.design). Follow is the quick guide for how to use.

## Environment Prepare

Install `node_modules`:

```bash
npm install
```

or

```bash
yarn
```

## Provided Scripts

Ant Design Pro provides some useful script to help you quick start and build with web project, code style check and test.

Scripts provided in `package.json`. It's safe to modify or add additional script:

### Start project

```bash
npm start
```

### Build project

```bash
npm run build
```

### Check code style

```bash
npm run lint
```

You can also use script to auto fix some lint error:

```bash
npm run lint:fix
```

### Test code

```bash
npm test
```

## More

You can view full document on our [official website](https://pro.ant.design). And welcome any feedback in our [github](https://github.com/ant-design/ant-design-pro).

## 报告生成功能使用说明

该项目新增了在聊天界面生成并导出舆情分析报告的功能。

### 功能特点

1. 在聊天界面可一键生成美观的舆情分析报告
2. 支持将报告导出为PDF文件保存到本地
3. 报告自动包含所有AI回复内容，支持Markdown格式
4. 生成的报告带有格式化的标题、页眉和页脚
5. **新增**：支持自定义报告模板，可设置标题、页眉、内容和页脚
6. **新增**：自动提取AI回复中的情感分析和热门话题数据，生成图表可视化

### 使用前准备

在使用报告导出功能前，需要安装以下依赖：

```bash
cd /path/to/newsweb
npm install --save html2canvas jspdf @ant-design/plots
```

### 使用方法

1. 进入聊天界面，与AI进行正常对话
2. 当有AI回复内容后，点击界面上的"生成分析报告"按钮
3. 在弹出的预览窗口中查看报告内容
4. **新增**：切换到"模板设置"选项卡，可以选择预设模板或创建自定义模板
5. **新增**：自定义模板支持设置标题、页眉、内容组件、样式和页脚
6. 点击"导出PDF"按钮将报告保存到本地

### 自定义模板功能

新增的自定义模板功能允许您：

1. 选择三种预设模板：默认模板、简约模板和可视化模板
2. 自定义创建新模板，可设置：
   - 基本设置：标题、Logo显示、日期显示等
   - 内容设置：数据统计、情感分析图、话题分析图等
   - 样式设置：自定义主色调、次要色调和强调色
   - 页脚设置：版权信息和自定义文本

### 数据可视化功能

新增的数据可视化功能会自动：

1. 从AI回复中提取情感分析数据，生成饼图展示正面、负面和中性情感分布
2. 从AI回复中提取热门话题，生成柱状图展示话题热度
3. 支持在报告中高亮显示关键词
4. 提供数据统计概览，展示分析项数量、正面情感占比和热门话题数量

### 代码配置说明

如果安装了依赖后导出功能仍不可用，请按照以下步骤手动启用导出功能：

1. 打开 `/src/pages/chatboard/index.tsx` 文件
2. 找到 `exportReport` 函数(约1230行左右)
3. 取消注释以下部分代码(删除 `/*` 和 `*/` 注释标记)：

```typescript
import('html2canvas')
  .then((html2canvasModule: any) => {
    const html2canvas = html2canvasModule.default;
    // ... 剩余代码
  })
```

4. 保存文件并重启开发服务器
