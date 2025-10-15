"use strict";
/**
 * 火山引擎即梦AI图像生成示例
 *
 * 使用方法:
 * 1. 设置环境变量:
 *    export JIMENG_ACCESS_KEY=你的访问密钥
 *    export JIMENG_SECRET_KEY=你的密钥
 *
 * 2. 运行示例:
 *    npx ts-node examples/jimeng-image-generator.ts "一只可爱的熊猫"
 *
 * 注:
 * - 默认使用区域: cn-north-1
 */
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
// 命令行参数处理
const prompt = process.argv[2] || '一只可爱的熊猫，坐在竹林中，吃着竹子，阳光照射，高清细节，写实风格';
const width = parseInt(process.argv[3] || '512');
const height = parseInt(process.argv[4] || '512');
// 检查环境变量
if (!process.env.JIMENG_ACCESS_KEY || !process.env.JIMENG_SECRET_KEY) {
    console.error('错误: 需要设置环境变量 JIMENG_ACCESS_KEY 和 JIMENG_SECRET_KEY');
    console.error('请设置以下环境变量:');
    console.error('export JIMENG_ACCESS_KEY=你的访问密钥');
    console.error('export JIMENG_SECRET_KEY=你的密钥');
    process.exit(1);
}
// 默认区域
const DEFAULT_REGION = 'cn-north-1';
async function main() {
    var _a, _b;
    try {
        console.log('即梦AI图像生成示例');
        console.log('-------------------');
        console.log('提示词:', prompt);
        console.log('图像尺寸:', `${width}x${height}`);
        console.log('区域:', DEFAULT_REGION);
        // 创建客户端实例
        const client = new src_1.JimengClient({
            debug: true, // 设置为true可以查看详细日志
        });
        console.log('\n正在生成图像，请稍候...');
        // 生成图像
        const startTime = Date.now();
        const result = await client.generateImage({
            prompt: prompt,
            width: width,
            height: height,
            region: DEFAULT_REGION
        });
        const endTime = Date.now();
        console.log(`生成耗时: ${(endTime - startTime) / 1000}秒`);
        if (result.success && result.image_urls && result.image_urls.length > 0) {
            console.log('\n图像生成成功!');
            console.log('图像URL:');
            result.image_urls.forEach((url, index) => {
                console.log(`[${index + 1}] ${url}`);
            });
            // 如果有LLM优化后的提示词，显示出来
            if ((_b = (_a = result.raw_response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.rephraser_result) {
                console.log('\nLLM优化后的提示词:');
                console.log(result.raw_response.data.rephraser_result);
            }
        }
        else {
            console.error('\n图像生成失败:', result.error);
        }
    }
    catch (error) {
        console.error('\n发生错误:', error instanceof Error ? error.message : String(error));
    }
}
// 运行主函数
main();
