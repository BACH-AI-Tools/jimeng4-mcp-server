#!/usr/bin/env ts-node
/**
 * 火山引擎即梦AI视频生成示例 - 文生视频
 *
 * 使用方法:
 * 1. 设置环境变量:
 *    export JIMENG_ACCESS_KEY=你的访问密钥
 *    export JIMENG_SECRET_KEY=你的密钥
 *
 * 2. 运行示例:
 *    文生视频：npx ts-node examples/jimeng-video-generator.ts --text-to-video "一只熊猫在竹林中玩耍"
 *    图生视频：npx ts-node examples/jimeng-video-generator.ts --image-to-video "https://example.com/image.jpg" --prompt "动态效果"
 *    查询任务：npx ts-node examples/jimeng-video-generator.ts --check-task "任务ID" --type "t2v或i2v"
 *
 * 注:
 * - 文生视频使用模型标识符 jimeng_vgfm_t2v_l20
 * - 图生视频使用模型标识符 jimeng_vgfm_i2v_l20
 * - 默认使用区域: cn-north-1
 */
export {};
