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

import { JimengClient, GenerateVideoParams, GenerateI2VParams } from '../src';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// 加载环境变量
dotenv.config();

// 检查必要的环境变量
const requiredEnvVars = ['JIMENG_ACCESS_KEY', 'JIMENG_SECRET_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`错误: 缺少环境变量 ${envVar}`);
    console.error('请创建一个 .env 文件并设置所有必要的变量');
    process.exit(1);
  }
}

// 创建客户端
const client = new JimengClient({
  accessKey: process.env.JIMENG_ACCESS_KEY!,
  secretKey: process.env.JIMENG_SECRET_KEY!,
  debug: true, // 启用调试模式
});

// 默认区域
const DEFAULT_REGION = 'cn-north-1';

/**
 * 解析命令行参数
 */
function parseArgs(args: string[]) {
  const params: Record<string, string> = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        params[key] = args[i + 1];
        i++;
      } else {
        params[key] = 'true';
      }
    }
  }
  
  return params;
}

/**
 * 展示文生视频功能
 */
async function demoTextToVideo(prompt: string, oneStep: boolean = false) {
  console.log('========== 文生视频示例 ==========');
  console.log('提示词:', prompt);
  console.log();
  
  // 设置参数
  const params: GenerateVideoParams = {
    prompt: prompt,
    req_key: 'jimeng_vgfm_t2v_l20',
    region: DEFAULT_REGION
  };

  try {
    // 一步到位方式生成
    console.log('生成视频中...(内部会自动提交任务并轮询结果)');
    const result = await client.generateVideo(params);
    
    if (result.success && result.video_urls && result.video_urls.length > 0) {
      console.log('\n视频生成成功!');
      console.log('视频URL列表:');
      result.video_urls.forEach((url, index) => {
        console.log(`[${index + 1}] ${url}`);
      });
      
      // 任务ID可以用于后续查询
      if (result.task_id) {
        console.log('任务ID:', result.task_id);
      }
    } else if (result.success) {
      console.log('\n视频生成成功，但未返回视频URL');
      if (result.task_id) {
        console.log('任务ID:', result.task_id);
      }
    } else {
      console.error('\n视频生成失败:', result.error || '未知错误');
      if (result.task_id) {
        console.log('任务ID:', result.task_id);
        console.log('您可以稍后使用以下命令查询任务状态:');
        console.log(`npx ts-node examples/jimeng-video-generator.ts --check-task ${result.task_id} --type t2v`);
      }
    }
  } catch (error) {
    console.error('\n发生错误:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * 展示图生视频功能
 */
async function demoImageToVideo(imageUrl: string, prompt?: string, oneStep: boolean = false) {
  console.log('========== 图生视频示例 ==========');
  console.log('图片URL:', imageUrl);
  if (prompt) console.log('提示词:', prompt);
  console.log();
  
  // 设置参数 - 注意使用图片URL数组格式
  const params: GenerateI2VParams = {
    image_urls: [imageUrl],  // 使用图片URL数组
    req_key: 'jimeng_vgfm_i2v_l20',
    aspect_ratio: '16:9',  // 指定长宽比，避免使用默认的"keep_ratio"
    region: DEFAULT_REGION
  };
  
  // 如果提供了提示词，添加到参数中
  if (prompt) {
    params.prompt = prompt;
  }
  
  try {
    // 异步提交任务
    console.log('提交图生视频任务...');
    const taskResult = await client.submitI2VTask(params);
    
    if (!taskResult.success) {
      console.error('提交任务失败:', taskResult.error);
      return;
    }
    
    console.log('任务提交成功!');
    console.log('任务ID:', taskResult.task_id);
    
    // 如果是一步到位模式，则自动轮询结果
    if (oneStep) {
      console.log('开始轮询任务结果...');
      
      const maxTries = 30;
      for (let i = 1; i <= maxTries; i++) {
        console.log(`轮询任务结果 (${i}/${maxTries})...`);
        
        // 查询任务结果
        const result = await client.getVideoTaskResult(taskResult.task_id!, 'jimeng_vgfm_i2v_l20');
        
        if (result.success && result.status === 'SUCCEEDED') {
          console.log('视频生成成功!');
          console.log('视频URL列表:');
          if (result.video_urls && result.video_urls.length > 0) {
            result.video_urls.forEach((url, index) => {
              console.log(`[${index + 1}] ${url}`);
            });
          } else {
            console.log('未返回视频URL');
          }
          return;
        } else if (!result.success) {
          console.error('查询任务失败:', result.error);
          // 如果是内容安全检查失败，给出明确提示
          if (result.error && result.error.includes('内容安全检查未通过')) {
            console.error('提示: 您的图片未通过内容安全检查，请使用符合内容政策的图片');
          }
          return;
        } else if (result.status === 'FAILED') {
          console.error('任务失败:', result.error || '未知错误');
          return;
        }
        
        console.log(`任务仍在进行中，状态: ${result.status}，等待 5 秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      console.error('视频生成失败: 轮询任务结果超时，请使用任务ID手动查询结果');
      console.log('任务ID:', taskResult.task_id);
      console.log('您可以稍后使用以下命令查询任务状态:');
      console.log(`npx ts-node examples/jimeng-video-generator.ts --check-task ${taskResult.task_id} --type i2v`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('图生视频出错:', error.message);
    } else {
      console.error('图生视频出错:', error);
    }
  }
}

/**
 * 查询特定任务的结果
 */
async function checkTaskResult(taskId: string, type: string = 't2v') {
  console.log(`========== 查询任务结果 ==========`);
  console.log(`任务ID: ${taskId}`);
  console.log(`任务类型: ${type === 'i2v' ? '图生视频' : '文生视频'}`);
  console.log();
  
  try {
    // 根据任务类型选择合适的模型标识符
    const reqKey = type === 'i2v' ? 'jimeng_vgfm_i2v_l20' : 'jimeng_vgfm_t2v_l20';
    
    // 查询任务结果
    console.log('查询任务结果中...');
    const result = await client.getVideoTaskResult(taskId, reqKey);
    
    if (result.success) {
      console.log('\n任务状态:', result.status);
      
      if ((result.status === 'SUCCEEDED' || result.status === 'done') && result.video_urls && result.video_urls.length > 0) {
        console.log('视频生成成功!');
        console.log('视频URL列表:');
        result.video_urls.forEach((url, index) => {
          console.log(`[${index + 1}] ${url}`);
        });
      } else if ((result.status === 'SUCCEEDED' || result.status === 'done')) {
        console.log('视频生成成功，但未返回视频URL');
      } else if (result.status === 'FAILED') {
        console.error('视频生成失败!');
      } else {
        console.log('视频正在生成中，请稍后再查询...');
      }
    } else {
      console.error('\n查询任务失败:', result.error || '未知错误');
    }
  } catch (error) {
    console.error('\n发生错误:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * 异步视频生成示例
 */
async function demoAsyncVideoGeneration(prompt: string) {
  console.log('========== 异步视频生成示例 ==========');
  console.log('提示词:', prompt);
  console.log();
  
  // 设置参数
  const params: GenerateVideoParams = {
    prompt: prompt,
    req_key: 'jimeng_vgfm_t2v_l20'
  };
  
  try {
    // 提交任务
    console.log('提交视频生成任务...');
    const submitResult = await client.submitVideoTask(params);
    
    if (!submitResult.success || !submitResult.task_id) {
      console.error('提交任务失败:', submitResult.error || '未知错误');
      return;
    }
    
    console.log('任务提交成功!');
    console.log('任务ID:', submitResult.task_id);
    console.log('\n您可以稍后使用以下命令查询任务状态:');
    console.log(`npx ts-node examples/jimeng-video-generator.ts --check-task ${submitResult.task_id}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error('提交任务出错:', error.message);
    } else {
      console.error('提交任务出错:', error);
    }
  }
}

/**
 * 主函数
 */
async function main() {
  // 解析命令行参数
  const args = parseArgs(process.argv.slice(2));
  
  // 是否使用一步到位模式
  const oneStep = typeof args['one-step'] !== 'undefined';
  
  // 创建客户端
  const client = new JimengClient({
    accessKey: process.env.JIMENG_ACCESS_KEY!,
    secretKey: process.env.JIMENG_SECRET_KEY!,
    debug: typeof args['verbose'] !== 'undefined' || typeof args['debug'] !== 'undefined',
  });
  
  // 处理不同的命令模式
  
  // 检查任务状态模式
  if (args['check-task']) {
    const taskType = args['type'] || 't2v';  // 默认为文生视频任务
    const reqKey = taskType === 't2v' 
      ? 'jimeng_vgfm_t2v_l20'
      : 'jimeng_vgfm_i2v_l20';
      
    await checkTaskResult(args['check-task'], reqKey);
    return;
  }
  
  // 检查文生视频模式
  if (args['text-to-video']) {
    await demoTextToVideo(args['text-to-video'], oneStep);
    return;
  }
  
  // 检查图生视频模式
  if (args['image-to-video']) {
    await demoImageToVideo(args['image-to-video'], args['prompt'], oneStep);
    return;
  }
  
  // 默认运行文生视频示例
  if (oneStep) {
    await demoTextToVideo("一只可爱的小猫在草地上玩耍", true);
  } else {
    await demoAsyncVideoGeneration("一只可爱的小猫在草地上玩耍");
  }
}

// 执行主函数
main().catch(error => {
  console.error('程序执行出错:', error);
  process.exit(1);
}); 