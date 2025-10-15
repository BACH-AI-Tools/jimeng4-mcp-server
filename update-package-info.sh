#!/bin/bash

# 即梦AI MCP 包信息更新脚本
# 使用方法: ./update-package-info.sh

echo "==================================="
echo "即梦AI MCP 包信息更新工具"
echo "==================================="
echo ""

# 读取用户输入
read -p "请输入新的npm包名 (例如: @yourname/jimeng-mcp): " PACKAGE_NAME
read -p "请输入作者信息 (例如: Your Name): " AUTHOR
read -p "请输入GitHub仓库地址 (留空则不设置): " REPO_URL

if [ -z "$PACKAGE_NAME" ]; then
    echo "错误: 包名不能为空！"
    exit 1
fi

if [ -z "$AUTHOR" ]; then
    echo "错误: 作者信息不能为空！"
    exit 1
fi

echo ""
echo "开始更新配置文件..."
echo ""

# 1. 更新 package.json
echo "1. 更新 package.json..."
if [ -f "package.json" ]; then
    # 使用 sed 替换包名
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|\"name\": \"jimeng-ai-mcp\"|\"name\": \"$PACKAGE_NAME\"|g" package.json
        sed -i '' "s|\"author\": \".*\"|\"author\": \"$AUTHOR\"|g" package.json
        sed -i '' "s|\"jimeng-ai-mcp\": \"dist/examples/mcp-server.js\"|\"$(basename $PACKAGE_NAME)\": \"dist/examples/mcp-server.js\"|g" package.json
        
        if [ ! -z "$REPO_URL" ]; then
            sed -i '' "s|\"url\": \"git+https://github.com/.*\"|\"url\": \"git+$REPO_URL.git\"|g" package.json
            sed -i '' "s|\"url\": \"https://github.com/.*/issues\"|\"url\": \"${REPO_URL}/issues\"|g" package.json
            sed -i '' "s|\"homepage\": \"https://github.com/.*#readme\"|\"homepage\": \"${REPO_URL}#readme\"|g" package.json
        fi
    else
        # Linux
        sed -i "s|\"name\": \"jimeng-ai-mcp\"|\"name\": \"$PACKAGE_NAME\"|g" package.json
        sed -i "s|\"author\": \".*\"|\"author\": \"$AUTHOR\"|g" package.json
        sed -i "s|\"jimeng-ai-mcp\": \"dist/examples/mcp-server.js\"|\"$(basename $PACKAGE_NAME)\": \"dist/examples/mcp-server.js\"|g" package.json
        
        if [ ! -z "$REPO_URL" ]; then
            sed -i "s|\"url\": \"git+https://github.com/.*\"|\"url\": \"git+$REPO_URL.git\"|g" package.json
            sed -i "s|\"url\": \"https://github.com/.*/issues\"|\"url\": \"${REPO_URL}/issues\"|g" package.json
            sed -i "s|\"homepage\": \"https://github.com/.*#readme\"|\"homepage\": \"${REPO_URL}#readme\"|g" package.json
        fi
    fi
    echo "   ✓ package.json 更新完成"
else
    echo "   ✗ package.json 文件不存在"
fi

# 2. 更新 mcp.json
echo "2. 更新 mcp.json..."
if [ -f "mcp.json" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|\"name\": \"jimeng-ai-mcp\"|\"name\": \"$PACKAGE_NAME\"|g" mcp.json
        sed -i '' "s|\"author\": \".*\"|\"author\": \"$AUTHOR\"|g" mcp.json
    else
        sed -i "s|\"name\": \"jimeng-ai-mcp\"|\"name\": \"$PACKAGE_NAME\"|g" mcp.json
        sed -i "s|\"author\": \".*\"|\"author\": \"$AUTHOR\"|g" mcp.json
    fi
    echo "   ✓ mcp.json 更新完成"
else
    echo "   ✗ mcp.json 文件不存在"
fi

# 3. 更新 README.md 中的包名
echo "3. 更新 README.md..."
if [ -f "README.md" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|jimeng-ai-mcp|$PACKAGE_NAME|g" README.md
    else
        sed -i "s|jimeng-ai-mcp|$PACKAGE_NAME|g" README.md
    fi
    echo "   ✓ README.md 更新完成"
else
    echo "   ✗ README.md 文件不存在"
fi

# 4. 更新 mcp-config.json
echo "4. 更新 mcp-config.json..."
if [ -f "mcp-config.json" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|jimeng-ai-mcp|$PACKAGE_NAME|g" mcp-config.json
    else
        sed -i "s|jimeng-ai-mcp|$PACKAGE_NAME|g" mcp-config.json
    fi
    echo "   ✓ mcp-config.json 更新完成"
else
    echo "   ✗ mcp-config.json 文件不存在"
fi

echo ""
echo "==================================="
echo "✅ 所有配置文件已更新完成！"
echo "==================================="
echo ""
echo "包名: $PACKAGE_NAME"
echo "作者: $AUTHOR"
if [ ! -z "$REPO_URL" ]; then
    echo "仓库: $REPO_URL"
fi
echo ""
echo "下一步操作："
echo "1. 检查修改: git diff"
echo "2. 构建项目: npm run build"
echo "3. 发布到npm: npm publish"
if [[ "$PACKAGE_NAME" == @* ]]; then
    echo "   (scope包需要: npm publish --access public)"
fi
echo ""
