#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 显示带颜色的消息
echo_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# 检查npm登录状态
echo_info "检查 npm 登录状态..."
npm whoami &> /dev/null
if [ $? -ne 0 ]; then
  echo_error "您尚未登录 npm，请先运行 'npm login' 后重试"
  exit 1
fi

# 询问版本更新类型
echo "请选择要执行的操作:"
echo "1) patch (1.0.4 -> 1.0.5) - 修复错误，没有新功能"
echo "2) minor (1.0.4 -> 1.1.0) - 添加向后兼容的功能"
echo "3) major (1.0.4 -> 2.0.0) - 不向后兼容的更改"
echo "4) beta (1.0.4 -> 1.0.5-beta.0) - 测试版"
echo "5) 自定义版本"
echo "6) 取消发布指定版本"

read -p "选择 [1-6]: " VERSION_TYPE
echo

# 根据选择的操作执行预检查
if [[ "$VERSION_TYPE" =~ ^[1-5]$ ]]; then
    # 检查是否有未提交的更改
    if [[ -n $(git status -s) ]]; then
      echo_warn "有未提交的更改，建议先提交所有更改"
      echo_warn "未提交的文件:"
      git status -s
      
      read -p "是否继续？(y/n) " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo_info "操作已取消"
        exit 1
      fi
    fi
    # 显示当前版本
    CURRENT_VERSION=$(node -p "require('./package.json').version")
    echo_info "当前版本: $CURRENT_VERSION"
fi

case $VERSION_TYPE in
  1)
    UPDATE_TYPE="patch"
    ;;
  2)
    UPDATE_TYPE="minor"
    ;;
  3)
    UPDATE_TYPE="major"
    ;;
  4)
    echo_info "处理beta版本..."
    # 提取当前版本的组成部分
    if [[ $CURRENT_VERSION =~ ([0-9]+)\.([0-9]+)\.([0-9]+)(-beta\.([0-9]+))? ]]; then
      MAJOR=${BASH_REMATCH[1]}
      MINOR=${BASH_REMATCH[2]}
      PATCH=${BASH_REMATCH[3]}
      
      echo_info "解析版本: 主版本=$MAJOR, 次版本=$MINOR, 补丁版本=$PATCH"
      
      # 检查是否已经是beta版本
      if [[ $CURRENT_VERSION =~ -beta\.([0-9]+) ]]; then
        BETA_NUM=${BASH_REMATCH[1]}
        echo_info "当前已是beta版本，beta编号为: $BETA_NUM"
        CUSTOM_VERSION="$MAJOR.$MINOR.$PATCH-beta.$((BETA_NUM+1))"
      else
        # 如果不是beta版本，增加patch版本并添加beta.0
        echo_info "当前不是beta版本，创建新的beta版本"
        CUSTOM_VERSION="$MAJOR.$MINOR.$((PATCH+1))-beta.0"
      fi
      echo_info "将创建beta版本: $CUSTOM_VERSION"
    else
      echo_error "无法解析当前版本号: $CURRENT_VERSION"
      exit 1
    fi
    ;;
  5)
    read -p "请输入新版本号 (例如 1.0.5 或 1.0.5-beta.1): " CUSTOM_VERSION
    if [[ ! $CUSTOM_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9\.]+)?$ ]]; then
      echo_error "无效的版本格式，应该是 x.y.z 或 x.y.z-tag"
      exit 1
    fi
    ;;
  6)
    PACKAGE_NAME=$(node -p "require('./package.json').name")
    if [ -z "$PACKAGE_NAME" ]; then
        echo_error "无法从 package.json 获取包名"
        exit 1
    fi

    echo_warn "您选择了取消发布版本。这是一个危险操作！"
    read -p "请输入要取消发布的版本号（多个版本用空格隔开）: " UNPUBLISH_VERSIONS
    
    if [ -z "$UNPUBLISH_VERSIONS" ]; then
      echo_error "没有输入任何版本号，操作已取消。"
      exit 1
    fi

    echo_warn "即将取消发布包 '$PACKAGE_NAME' 的以下版本: $UNPUBLISH_VERSIONS"
    read -p "请再次确认，此操作不可逆 (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo_info "操作已取消。"
      exit 1
    fi

    for version in $UNPUBLISH_VERSIONS; do
      echo_info "正在取消发布版本: $PACKAGE_NAME@$version..."
      npm unpublish "$PACKAGE_NAME@$version" --force
      if [ $? -eq 0 ]; then
        echo_info "版本 $version 取消发布成功。"
      else
        echo_error "版本 $version 取消发布失败。请检查错误信息或权限。"
        echo_warn "注意：npm unpublish 在发布24小时后可能会受限。"
      fi
    done
    exit 0
    ;;
  *)
    echo_error "无效的选择"
    exit 1
    ;;
esac

# 更新版本
echo_info "更新版本..."
if [[ "$VERSION_TYPE" == "4" || "$VERSION_TYPE" == "5" ]]; then
  echo_info "使用自定义版本号: $CUSTOM_VERSION"
  npm version "$CUSTOM_VERSION" --no-git-tag-version
else
  echo_info "使用npm version命令升级版本类型: $UPDATE_TYPE"
  npm version $UPDATE_TYPE --no-git-tag-version
fi

# 获取新版本
NEW_VERSION=$(node -p "require('./package.json').version")
echo_info "版本已更新: $CURRENT_VERSION -> $NEW_VERSION"

# 同步 mcp.json 中的版本
echo_info "更新 mcp.json 中的版本..."
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" mcp.json

# 同步 mcp-server.ts 中的版本
echo_info "更新 mcp-server.ts 中的版本..."
sed -i '' "s/version: \"[^\"]*\"/version: \"$NEW_VERSION\"/" examples/mcp-server.ts

# 更新 README.md 中的版本信息
echo_info "检查 README.md 中的版本..."
VERSION_IN_README=$(grep -n "### v[0-9]\\+\\.[0-9]\\+\\.[0-9]\\+" README.md | head -1 | sed 's/:.*//')
if [ -n "$VERSION_IN_README" ]; then
  echo_info "在 README.md 中添加新版本信息..."
  
  # 根据版本类型添加不同的更新说明
  if [[ "$NEW_VERSION" =~ -beta ]]; then
    VERSION_NOTES="### v$NEW_VERSION\\
- 测试版：增强MCP工具定义，确保所有工具在客户端可见\\
- 优化异步参数处理，默认启用异步模式避免超时\\
- 增加更详细的视频生成调试信息\\
\\
"
  else
    VERSION_NOTES="### v$NEW_VERSION\\
- 增强MCP工具定义，确保所有工具在客户端可见\\
- 优化异步参数处理，默认启用异步模式避免超时\\
- 增加更详细的视频生成调试信息\\
\\
"
  fi
  
  sed -i '' "${VERSION_IN_README}i\\
$VERSION_NOTES" README.md
fi

# 构建项目
echo_info "构建项目..."
npm run build

# 询问是否确认发布
echo
echo_warn "请确认以下信息:"
echo "- 版本: $NEW_VERSION"
if [[ "$NEW_VERSION" =~ -beta ]]; then
  echo "- 标签: beta (测试版)"
  NPM_TAG="--tag beta"
else
  echo "- 标签: latest (正式版)"
  NPM_TAG=""
fi
echo "- 发布到: npm 公共仓库"
echo "- 包名: jimeng-ai-mcp"
echo

read -p "确认发布? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo_info "发布已取消"
  exit 1
fi

# 发布到 npm
echo_info "发布到 npm..."
npm publish $NPM_TAG

# 检查发布结果
if [ $? -eq 0 ]; then
  echo_info "发布成功! 新版本: $NEW_VERSION"
  
  # 提交更改
  echo_info "提交版本更新..."
  git add package.json package-lock.json mcp.json examples/mcp-server.ts README.md
  git commit -m "Release v$NEW_VERSION"
  
  # 创建标签
  echo_info "创建 git 标签..."
  git tag -a "v$NEW_VERSION" -m "Version $NEW_VERSION"
  
  echo_info "推送更改和标签到远程仓库..."
  echo_warn "请手动执行以下命令将更改推送到远程仓库:"
  echo "git push origin main"
  echo "git push origin v$NEW_VERSION"
else
  echo_error "发布失败，请检查错误信息"
fi

echo_info "完成!" 