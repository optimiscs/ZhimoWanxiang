#!/bin/bash

# 脚本出错时立即退出
set -e
# 将未设置的变量视为错误
set -u
# 管道中的任何命令失败都视为整个管道失败
set -o pipefail

# --- 配置区域 ---
LOCAL_ENV_FILE=".env"                 # 本地环境文件名 (存储服务器访问凭证)
EXPORT_DIR="./data_exports"           # 本地保存导出数据的目录
REMOTE_EXPORT_DIR="/tmp/mongodb_exports"  # 服务器临时存储导出数据的目录
MONGODB_CONTAINER="mongodb_prod"      # MongoDB容器名称 (来自docker-compose.prod.yml)
DATABASE_NAME="zhimo"                 # 数据库名称 (默认值，可通过参数修改)
COLLECTION_NAME=""                    # 初始化为空字符串

# 解析命令行参数
while [[ $# -gt 0 ]]; do
  case $1 in
    --db)
      DATABASE_NAME="$2"
      shift 2
      ;;
    --collection)
      COLLECTION_NAME="$2"
      shift 2
      ;;
    *)
      echo "未知选项: $1"
      echo "用法: $0 [--db 数据库名] [--collection 集合名]"
      exit 1
      ;;
  esac
done

# --- 加载本地环境变量 (用于服务器访问) ---
echo ">>> 正在加载本地环境变量..."
if [ ! -f "$LOCAL_ENV_FILE" ]; then
    echo "错误: 本地环境文件 '$LOCAL_ENV_FILE' 未找到。"
    echo "请创建该文件并包含 SERVER_IP, SERVER_USER, 以及 SSH_KEY_PATH 或 SERVER_PASSWORD。"
    exit 1
fi

# 更安全地从 .env 文件导入变量
while IFS= read -r line || [[ -n "$line" ]]; do
    # 移除行首尾的空格
    cleaned_line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    # 跳过空行和注释行
    if [[ -z "$cleaned_line" || "$cleaned_line" =~ ^# ]]; then
        continue
    fi
    # 检查是否为 KEY=VALUE 格式
    if [[ "$cleaned_line" =~ ^[a-zA-Z_][a-zA-Z0-9_]*=.* ]]; then
        # 分离 KEY 和 VALUE
        key=$(echo "$cleaned_line" | cut -d '=' -f 1)
        value=$(echo "$cleaned_line" | cut -d '=' -f 2-) # 获取第一个 '=' 后面的所有内容

        # 移除 VALUE 两端的引号
        cleaned_value=$(echo "$value" | sed -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//')
        
        # 导出清理后的 KEY=VALUE
        export "$key=$cleaned_value"
    fi
done < "$LOCAL_ENV_FILE"

# 检查必需的变量是否已设置
if [ -z "${SERVER_IP-}" ] || [ -z "${SERVER_USER-}" ] || [ -z "${REMOTE_DEPLOY_PATH-}" ]; then
  echo "错误: 必须在 $LOCAL_ENV_FILE 文件中设置 SERVER_IP, SERVER_USER, 和 REMOTE_DEPLOY_PATH"
  exit 1
fi
if [ -z "${SSH_KEY_PATH-}" ] && [ -z "${SERVER_PASSWORD-}" ]; then
  echo "错误: 必须在 $LOCAL_ENV_FILE 文件中设置 SSH_KEY_PATH 或 SERVER_PASSWORD"
  exit 1
fi

# 创建本地导出目录
mkdir -p "$EXPORT_DIR"
echo ">>> 创建本地导出目录: $EXPORT_DIR"

# 配置 SSH 命令
SSH_CMD="ssh"
if [ -n "${SSH_KEY_PATH-}" ]; then
    if [ ! -f "$SSH_KEY_PATH" ]; then
        echo "错误: SSH 密钥文件未在 $SSH_KEY_PATH 找到"
        exit 1
    fi
    SSH_CMD="ssh -i $SSH_KEY_PATH"
    echo "正在使用 SSH 密钥: $SSH_KEY_PATH"
elif [ -n "${SERVER_PASSWORD-}" ]; then
    echo "警告: 正在使用密码认证。推荐使用 SSH 密钥。"
fi

# 通过 SSH 在服务器上执行导出命令
echo ">>> 正在服务器上执行数据库导出命令..."

if [ -n "${SSH_KEY_PATH-}" ]; then
  ssh -i "$SSH_KEY_PATH" "$SERVER_USER@$SERVER_IP" << EOF
    echo "Current directory on server: \$(pwd)"
    cd "$REMOTE_DEPLOY_PATH" || exit 1
    echo "Changed to directory: \$(pwd)"

    # 创建临时导出目录
    mkdir -p "$REMOTE_EXPORT_DIR"
    echo "已创建临时导出目录: $REMOTE_EXPORT_DIR"

    # 列出数据库中的所有集合
    echo "正在获取数据库 $DATABASE_NAME 中的集合列表..."
    COLLECTIONS=\$(docker exec $MONGODB_CONTAINER mongosh --quiet --eval "db.getMongo().getDB('$DATABASE_NAME').getCollectionNames().join(' ')")
    
    if [ -z "\$COLLECTIONS" ]; then
        echo "警告: 在数据库 $DATABASE_NAME 中未找到集合"
        exit 1
    fi
    
    echo "找到以下集合: \$COLLECTIONS"
    
    # 如果指定了特定集合，则只导出该集合
    if [ -n "$COLLECTION_NAME" ]; then
        COLLECTIONS="$COLLECTION_NAME"
        echo "将只导出指定的集合: $COLLECTION_NAME"
    fi

    # 对每个集合进行导出
    for COLLECTION in \$COLLECTIONS; do
        echo "正在导出集合: \$COLLECTION"
        
        # 导出到 JSON 文件
        echo "  -> 导出为 JSON..."
        docker exec $MONGODB_CONTAINER mongoexport --db=$DATABASE_NAME --collection=\$COLLECTION --out=/tmp/\$COLLECTION.json --jsonArray
        
        # 将导出的文件从容器复制到主机
        echo "  -> 从容器复制到主机..."
        docker cp $MONGODB_CONTAINER:/tmp/\$COLLECTION.json $REMOTE_EXPORT_DIR/
        
        # 使用 Python 将 JSON 转换为 CSV
        echo "  -> 转换为 CSV..."
        cat > $REMOTE_EXPORT_DIR/convert_to_csv.py << 'PYEOF'
import json
import csv
import sys
import os
from datetime import datetime

def json_to_csv(json_file, csv_file):
    # 读取 JSON 文件
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if not data:
        print(f"警告: {json_file} 中没有数据")
        return
    
    # 获取所有可能的字段名
    fieldnames = set()
    for item in data:
        fieldnames.update(item.keys())
    
    # 确保 '_id' 字段在第一个位置
    fieldnames = sorted(fieldnames)
    if '_id' in fieldnames:
        fieldnames.remove('_id')
        fieldnames = ['_id'] + fieldnames
    
    # 写入 CSV 文件
    with open(csv_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for item in data:
            # 将所有日期对象转换为 ISO 格式字符串
            row = {}
            for key, value in item.items():
                if isinstance(value, dict) and '\$date' in value:
                    try:
                        # 处理包含 ISO 日期的对象
                        timestamp = int(value['\$date']) / 1000 if isinstance(value['\$date'], int) else None
                        if timestamp:
                            row[key] = datetime.fromtimestamp(timestamp).isoformat()
                        else:
                            row[key] = value['\$date']
                    except:
                        row[key] = str(value)
                elif isinstance(value, dict):
                    # 处理嵌套对象
                    row[key] = json.dumps(value, ensure_ascii=False)
                elif isinstance(value, list):
                    # 处理数组
                    row[key] = json.dumps(value, ensure_ascii=False)
                else:
                    row[key] = value
            
            writer.writerow(row)
    
    print(f"已将 {json_file} 转换为 {csv_file}")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        json_file = sys.argv[1]
        csv_file = os.path.splitext(json_file)[0] + '.csv'
        json_to_csv(json_file, csv_file)
    else:
        print("用法: python convert_to_csv.py <json_file>")
PYEOF
        
        # 执行 Python 脚本转换为 CSV
        python3 $REMOTE_EXPORT_DIR/convert_to_csv.py $REMOTE_EXPORT_DIR/\$COLLECTION.json
        
        echo "集合 \$COLLECTION 已导出并转换为 CSV"
    done

    echo "所有集合导出完成"
    
    # 打包所有导出文件
    TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
    ARCHIVE_NAME="mongodb_export_\${TIMESTAMP}.tar.gz"
    
    echo "正在将导出文件打包为 \$ARCHIVE_NAME..."
    # 使用更简单和可靠的方法打包CSV文件
    cd "$REMOTE_EXPORT_DIR" && tar -czf "\$ARCHIVE_NAME" *.csv
    
    echo "导出过程完成，可下载的归档文件位置: $REMOTE_EXPORT_DIR/\$ARCHIVE_NAME"
EOF
else
  ssh "$SERVER_USER@$SERVER_IP" << EOF
    echo "Current directory on server: \$(pwd)"
    cd "$REMOTE_DEPLOY_PATH" || exit 1
    echo "Changed to directory: \$(pwd)"

    # 创建临时导出目录
    mkdir -p "$REMOTE_EXPORT_DIR"
    echo "已创建临时导出目录: $REMOTE_EXPORT_DIR"

    # 列出数据库中的所有集合
    echo "正在获取数据库 $DATABASE_NAME 中的集合列表..."
    COLLECTIONS=\$(docker exec $MONGODB_CONTAINER mongosh --quiet --eval "db.getMongo().getDB('$DATABASE_NAME').getCollectionNames().join(' ')")
    
    if [ -z "\$COLLECTIONS" ]; then
        echo "警告: 在数据库 $DATABASE_NAME 中未找到集合"
        exit 1
    fi
    
    echo "找到以下集合: \$COLLECTIONS"
    
    # 如果指定了特定集合，则只导出该集合
    if [ -n "$COLLECTION_NAME" ]; then
        COLLECTIONS="$COLLECTION_NAME"
        echo "将只导出指定的集合: $COLLECTION_NAME"
    fi

    # 对每个集合进行导出
    for COLLECTION in \$COLLECTIONS; do
        echo "正在导出集合: \$COLLECTION"
        
        # 导出到 JSON 文件
        echo "  -> 导出为 JSON..."
        docker exec $MONGODB_CONTAINER mongoexport --db=$DATABASE_NAME --collection=\$COLLECTION --out=/tmp/\$COLLECTION.json --jsonArray
        
        # 将导出的文件从容器复制到主机
        echo "  -> 从容器复制到主机..."
        docker cp $MONGODB_CONTAINER:/tmp/\$COLLECTION.json $REMOTE_EXPORT_DIR/
        
        # 使用 Python 将 JSON 转换为 CSV
        echo "  -> 转换为 CSV..."
        cat > $REMOTE_EXPORT_DIR/convert_to_csv.py << 'PYEOF'
import json
import csv
import sys
import os
from datetime import datetime

def json_to_csv(json_file, csv_file):
    # 读取 JSON 文件
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if not data:
        print(f"警告: {json_file} 中没有数据")
        return
    
    # 获取所有可能的字段名
    fieldnames = set()
    for item in data:
        fieldnames.update(item.keys())
    
    # 确保 '_id' 字段在第一个位置
    fieldnames = sorted(fieldnames)
    if '_id' in fieldnames:
        fieldnames.remove('_id')
        fieldnames = ['_id'] + fieldnames
    
    # 写入 CSV 文件
    with open(csv_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for item in data:
            # 将所有日期对象转换为 ISO 格式字符串
            row = {}
            for key, value in item.items():
                if isinstance(value, dict) and '\$date' in value:
                    try:
                        # 处理包含 ISO 日期的对象
                        timestamp = int(value['\$date']) / 1000 if isinstance(value['\$date'], int) else None
                        if timestamp:
                            row[key] = datetime.fromtimestamp(timestamp).isoformat()
                        else:
                            row[key] = value['\$date']
                    except:
                        row[key] = str(value)
                elif isinstance(value, dict):
                    # 处理嵌套对象
                    row[key] = json.dumps(value, ensure_ascii=False)
                elif isinstance(value, list):
                    # 处理数组
                    row[key] = json.dumps(value, ensure_ascii=False)
                else:
                    row[key] = value
            
            writer.writerow(row)
    
    print(f"已将 {json_file} 转换为 {csv_file}")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        json_file = sys.argv[1]
        csv_file = os.path.splitext(json_file)[0] + '.csv'
        json_to_csv(json_file, csv_file)
    else:
        print("用法: python convert_to_csv.py <json_file>")
PYEOF
        
        # 执行 Python 脚本转换为 CSV
        python3 $REMOTE_EXPORT_DIR/convert_to_csv.py $REMOTE_EXPORT_DIR/\$COLLECTION.json
        
        echo "集合 \$COLLECTION 已导出并转换为 CSV"
    done

    echo "所有集合导出完成"
    
    # 打包所有导出文件
    TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
    ARCHIVE_NAME="mongodb_export_\${TIMESTAMP}.tar.gz"
    
    echo "正在将导出文件打包为 \$ARCHIVE_NAME..."
    # 使用更简单和可靠的方法打包CSV文件
    cd "$REMOTE_EXPORT_DIR" && tar -czf "\$ARCHIVE_NAME" *.csv
    
    echo "导出过程完成，可下载的归档文件位置: $REMOTE_EXPORT_DIR/\$ARCHIVE_NAME"
EOF
fi

# 获取最新的归档文件名
echo ">>> 正在从服务器获取最新的导出文件..."
LATEST_ARCHIVE=$(${SSH_CMD} "$SERVER_USER@$SERVER_IP" "ls -t $REMOTE_EXPORT_DIR/mongodb_export_*.tar.gz | head -1")

if [ -z "$LATEST_ARCHIVE" ]; then
    echo "错误: 在服务器上未找到导出的归档文件"
    exit 1
fi

echo "找到最新的归档文件: $LATEST_ARCHIVE"

# 下载归档文件到本地
echo ">>> 正在下载归档文件到本地..."
if [ -n "${SSH_KEY_PATH-}" ]; then
    scp -i "$SSH_KEY_PATH" "$SERVER_USER@$SERVER_IP:$LATEST_ARCHIVE" "$EXPORT_DIR/"
else
    scp "$SERVER_USER@$SERVER_IP:$LATEST_ARCHIVE" "$EXPORT_DIR/"
fi

# 获取下载的文件名（不包含路径）
DOWNLOADED_FILE=$(basename "$LATEST_ARCHIVE")

# 解压归档文件
echo ">>> 正在解压归档文件..."
tar -xzf "$EXPORT_DIR/$DOWNLOADED_FILE" -C "$EXPORT_DIR"

# 清理：删除服务器上的临时文件
echo ">>> 正在清理服务器上的临时文件..."
${SSH_CMD} "$SERVER_USER@$SERVER_IP" "rm -rf $REMOTE_EXPORT_DIR"

echo ">>> 数据导出完成！文件已保存到: $EXPORT_DIR"
echo "    CSV 文件可以用 Excel, LibreOffice, 或任何文本编辑器打开"
echo ""
echo "导出的数据库: $DATABASE_NAME"
if [ -n "$COLLECTION_NAME" ]; then
    echo "导出的集合: $COLLECTION_NAME"
else
    echo "导出了所有集合"
fi 