# 视频处理服务

本服务提供了根据新闻标题搜索全网播放量最高的视频，获取视频音频文件并提取SRT格式字幕的功能。
字幕会被转化为JSON格式并保存在MongoDB中。

## 功能特点

1. 支持从多个平台搜索视频（YouTube、哔哩哔哩）
2. 自动下载视频的音频文件（MP3格式）
3. 自动提取和解析字幕（SRT格式）
4. 将字幕转换为结构化JSON数据
5. 保存到MongoDB数据库
6. 提供了API接口和命令行工具

## 如何使用

### 命令行工具

可以使用提供的命令行工具进行测试：

```bash
# 仅搜索视频
python scripts/video_processor.py "新闻标题" --search-only

# 选择特定平台
python scripts/video_processor.py "新闻标题" --search-only -p youtube
python scripts/video_processor.py "新闻标题" --search-only -p bilibili

# 完整处理流程（搜索、下载、解析、保存）
python scripts/video_processor.py "新闻标题"

# 保存结果到JSON文件
python scripts/video_processor.py "新闻标题" -o result.json
```

### API接口

服务提供了以下API接口：

1. 搜索视频
   ```
   POST /api/video/search
   Content-Type: application/json
   
   {
     "news_title": "新闻标题",
     "max_results": 5
   }
   ```

2. 处理视频（搜索、下载、解析、保存）
   ```
   POST /api/video/process
   Content-Type: application/json
   
   {
     "news_title": "新闻标题"
   }
   ```

3. 获取字幕
   ```
   GET /api/video/subtitles/<video_id>
   ```

### 在代码中使用

```python
from app.services.video_service import VideoService

# 搜索视频
videos = VideoService.search_video_by_news_title("新闻标题")

# 处理视频
result = VideoService.process_news_video("新闻标题")

# 从MongoDB获取字幕
from app.models import db
subtitles = db.video_subtitles.find_one({'video_info.video_id': video_id})
```

## 数据结构

### 视频信息

```json
{
  "title": "视频标题",
  "video_id": "视频ID",
  "url": "视频URL",
  "channel": "频道/UP主",
  "views": 1000,
  "publish_date": "发布日期",
  "thumbnail_url": "缩略图URL",
  "duration": 300,
  "source": "youtube/bilibili"
}
```

### 字幕JSON格式

```json
[
  {
    "index": 1,
    "start_time": {
      "hours": 0,
      "minutes": 0,
      "seconds": 5,
      "milliseconds": 100,
      "total_seconds": 5.1
    },
    "end_time": {
      "hours": 0,
      "minutes": 0,
      "seconds": 10,
      "milliseconds": 500,
      "total_seconds": 10.5
    },
    "text": "字幕文本内容",
    "position": "bottom"
  },
  // ...更多字幕条目
]
```

### MongoDB存储结构

```json
{
  "news_title": "相关新闻标题",
  "video_info": {
    // 视频信息（同上）
  },
  "subtitles": [
    // 字幕JSON（同上）
  ],
  "created_at": "ISODate('2023-04-22T12:34:56.789Z')"
}
```

## 依赖库

- yt-dlp: 视频下载和信息提取
- pytube: YouTube视频搜索
- pysrt: SRT字幕解析
- requests: HTTP请求
- pymongo: MongoDB数据库操作

## 注意事项

1. B站API可能会有请求频率限制，遇到412状态码时需要等待一段时间
2. YouTube可能会要求验证是否为机器人，可以考虑使用cookies解决
3. 处理大型视频文件时，需要考虑磁盘空间和网络带宽 