#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { JimengClient } from "../src";
import * as dotenvSilent from "../src/dotenv-silent";
import { z } from "zod";
import path from "path";
import fs from "fs";

// 添加一个全局的日志函数，确保所有日志都输出到stderr而不是stdout
const log = (...args: any[]) => {
  process.stderr.write(args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ') + '\n');
};

// 用更简单的方法处理dotenv问题 - 预先加载环境变量
try {
  // 首先尝试从当前目录加载.env文件
  const envResult = dotenvSilent.config();

  // 如果环境变量未设置，尝试从用户主目录加载
  if ((!envResult || !envResult.parsed || Object.keys(envResult.parsed).length === 0) &&
    (!process.env.JIMENG_ACCESS_KEY || !process.env.JIMENG_SECRET_KEY)) {
    const homeEnvPath = path.join(process.env.HOME || process.env.USERPROFILE || "", ".jimeng-ai-mcp", ".env");
    if (fs.existsSync(homeEnvPath)) {
      dotenvSilent.config({ path: homeEnvPath });
    }
  }
} catch (error) {
  log(`加载环境变量时出错: ${error instanceof Error ? error.message : String(error)}`);
}

// 火山引擎即梦AI API配置
const ENDPOINT = "https://visual.volcengineapi.com";
const HOST = "visual.volcengineapi.com";
const SERVICE = "cv";

// 环境变量配置
const JIMENG_ACCESS_KEY = process.env.JIMENG_ACCESS_KEY;
const JIMENG_SECRET_KEY = process.env.JIMENG_SECRET_KEY;

if (!JIMENG_ACCESS_KEY || !JIMENG_SECRET_KEY) {
  log("警告：未设置环境变量 JIMENG_ACCESS_KEY 和 JIMENG_SECRET_KEY");
  log("服务将启动但无法调用API功能，仅供测试使用");
}

// 图片比例映射
const RATIO_MAPPING: Record<string, { width: number; height: number }> = {
  "4:3": { width: 512, height: 384 },
  "3:4": { width: 384, height: 512 },
  "16:9": { width: 512, height: 288 },
  "9:16": { width: 288, height: 512 }
};

// 生成组合后的prompt
function generatePrompt(text: string, illustration: string, color: string): string {
  return `字体设计："${text}"，黑色字体，斜体，带阴影。干净的背景，白色到${color}渐变。点缀浅灰色、半透明${illustration}等元素插图做配饰插画。`;
}

// 创建MCP服务器实例
const server = new McpServer({
  name: "jimeng4.0-mcp-steve",
  version: "1.0.0",
});

// 添加服务器信息资源
server.resource(
  "info",
  "info://server",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: `火山引擎即梦AI多模态生成服务 (MCP)\n\n版本: 1.0.4\n状态: ${JIMENG_ACCESS_KEY && JIMENG_SECRET_KEY ? "已配置密钥" : "未配置密钥"}`
    }]
  })
);

// 添加图像生成帮助文档资源
server.resource(
  "help",
  "help://generate-image",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: `# generate-image 工具使用帮助\n\n生成图像的工具，可以根据文字、插图元素和颜色生成图像。\n\n## 参数\n\n- text: 用户需要在图片上显示的文字\n- illustration: 根据用户要显示的文字，提取3-5个可以作为图片配饰的插画元素关键词\n- color: 图片的背景主色调\n- ratio: 图片比例。支持: 4:3 (512*384), 3:4 (384*512), 16:9 (512*288), 9:16 (288*512)\n\n## 示例\n\n请使用generate-image工具生成一张图片，图片上显示"创新未来"文字，配饰元素包括科技、星空、光线，背景色调为蓝色，比例为16:9。`
    }]
  })
);

// 视频生成帮助文档已暂时注释
/*
// 添加视频生成帮助文档资源
server.resource(
  "help",
  "help://generate-video",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: `# generate-video 工具使用帮助\n\n提交视频生成任务的工具，使用即梦AI文生视频模型根据文字提示词生成视频。\n\n## 参数\n\n- prompt: 视频内容的描述\n\n## 使用流程\n\n1. 使用 generate-video 提交任务，获得 task_id\n2. 等待 1-3 分钟\n3. 使用 get-video-result 查询结果，传入 task_id\n4. 如果还在生成中，继续等待后再次查询\n\n## 注意事项\n\n- 使用模型：jimeng_vgfm_t2v_l20\n- 视频生成通常需要1-3分钟\n- 由于MCP协议超时限制，视频生成采用分步方式\n\n## 示例\n\n步骤1 - 提交任务：\n请使用 generate-video 工具生成一段视频，视频内容为"熊猫在竹林中玩耍"\n\n步骤2 - 查询结果（等待1-3分钟后）：\n请使用 get-video-result 工具查询任务ID为"xxx"的视频生成结果`
    }]
  })
);

// 添加查询视频结果帮助文档资源
server.resource(
  "help",
  "help://get-video-result",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: `# get-video-result 工具使用帮助\n\n查询视频生成任务结果的工具。\n\n## 参数\n\n- task_id: 任务ID，通过 generate-video 工具获取\n\n## 任务状态说明\n\n- pending/in_queue/processing: 任务正在处理中，需要继续等待\n- done/SUCCEEDED: 任务完成，返回视频URL\n- FAILED: 任务失败\n\n## 使用建议\n\n- 提交任务后等待1-3分钟再查询\n- 如果返回"正在处理中"，等待30秒-1分钟后再次查询\n- 最多可能需要查询3-5次才能获得结果\n\n## 示例\n\n请使用 get-video-result 工具查询任务ID为"7392616336519610409"的视频生成结果`
    }]
  })
);
*/


// 注册图片生成工具
server.tool(
  "generate-image",
  "当用户需要生成图片时使用的工具",
  {
    text: z.string().describe("用户需要在图片上显示的文字"),
    illustration: z.string().describe("根据用户要显示的文字，提取3-5个可以作为图片配饰的插画元素关键词"),
    color: z.string().describe("图片的背景主色调"),
    ratio: z.enum(["4:3", "3:4", "16:9", "9:16"]).describe("图片比例。支持: 4:3 (512*384), 3:4 (384*512), 16:9 (512*288), 9:16 (288*512)")
  },
  async (args, _extra) => {
    const { text, illustration, color, ratio } = args;
    const imageSize = RATIO_MAPPING[ratio];

    if (!imageSize) {
      // 构建标准JSON格式的错误返回数据
      const errorData = {
        status: "error",
        message: "不支持的图片比例",
        error: `不支持的比例: ${ratio}`,
        supported_ratios: ["4:3", "3:4", "16:9", "9:16"],
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorData, null, 2)
          }
        ],
        isError: true
      };
    }

    // 检查API密钥是否配置
    if (!JIMENG_ACCESS_KEY || !JIMENG_SECRET_KEY) {
      // 构建标准JSON格式的错误返回数据
      const errorData = {
        status: "error",
        message: "API密钥未配置",
        error: "未设置环境变量 JIMENG_ACCESS_KEY 和 JIMENG_SECRET_KEY",
        help: "请参考文档配置环境变量",
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorData, null, 2)
          }
        ],
        isError: true
      };
    }

    try {
      // 创建即梦AI客户端
      const client = new JimengClient({
        debug: false // 设置为true可以查看详细日志
      });

      // 生成组合后的prompt
      const prompt = generatePrompt(text, illustration, color);

      // 调用即梦AI生成图像
      const result = await client.generateImage({
        prompt: prompt,
        width: imageSize.width,
        height: imageSize.height,
        region: "cn-north-1"
      });

      if (!result.success || !result.image_urls || result.image_urls.length === 0) {
        // 构建标准JSON格式的失败返回数据
        const failureData = {
          status: "error",
          message: "生成图片失败",
          error: result.error || "未知错误",
          timestamp: new Date().toISOString()
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(failureData, null, 2)
            }
          ],
          isError: true
        };
      }

      // 获取LLM优化后的提示词
      const llmPrompt = result.raw_response?.data?.rephraser_result || prompt;

      // 构建符合MCP标准的返回数据，包含JSON格式的结果
      const responseData = {
        status: "success",
        message: "图片生成成功",
        data: {
          text,
          illustration,
          color,
          ratio,
          dimensions: `${imageSize.width}×${imageSize.height}`,
          prompt,
          llm_prompt: llmPrompt,
          image_url: result.image_urls[0],
          image_urls: result.image_urls
        },
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(responseData, null, 2)
          }
        ]
      };
    } catch (error) {
      // 构建标准JSON格式的错误返回数据
      const errorData = {
        status: "error",
        message: "生成图片时发生错误",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorData, null, 2)
          }
        ],
        isError: true
      };
    }
  }
);

// 视频生成工具已暂时注释（由于MCP协议超时限制，需要后续优化）
/*
// 注册视频生成工具 - 提交任务（由于MCP协议超时限制，视频生成采用分步方式）
server.tool(
  "generate-video",
  "提交视频生成任务，基于即梦AI文生视频模型。此工具会立即返回任务ID，然后需要使用 get-video-result 工具查询结果（预计1-3分钟后可查询）。",
  {
    prompt: z.string().describe("视频内容的描述")
  },
  async (args, _extra) => {
    const { prompt } = args;

    // 检查API密钥是否配置
    if (!JIMENG_ACCESS_KEY || !JIMENG_SECRET_KEY) {
      const errorData = {
        status: "error",
        message: "API密钥未配置",
        error: "未设置环境变量 JIMENG_ACCESS_KEY 和 JIMENG_SECRET_KEY",
        help: "请参考文档配置环境变量",
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorData, null, 2)
          }
        ],
        isError: true
      };
    }

    try {
      const client = new JimengClient({
        debug: false
      });

      log("提交视频生成任务...");

      const result = await client.submitVideoTask({
        prompt: prompt,
        req_key: "jimeng_vgfm_t2v_l20",
        region: "cn-north-1"
      });

      if (!result.success || !result.task_id) {
        log(`提交视频生成任务失败: ${result.error}`);

        const failureData = {
          status: "error",
          message: "提交视频生成任务失败",
          error: result.error || "未知错误",
          timestamp: new Date().toISOString()
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(failureData, null, 2)
            }
          ],
          isError: true
        };
      }

      // 构建符合MCP标准的返回数据，包含JSON格式的结果
      const responseData = {
        status: "success",
        message: "视频生成任务提交成功",
        data: {
          prompt,
          task_id: result.task_id,
          help: `任务已提交！请等待1-3分钟后，使用 get-video-result 工具查询结果，参数：{"task_id": "${result.task_id}"}`
        },
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(responseData, null, 2)
          }
        ]
      };
    } catch (error) {
      log("提交视频生成任务出错: " + (error instanceof Error ? error.message : String(error)));

      const errorData = {
        status: "error",
        message: "提交视频生成任务时发生错误",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorData, null, 2)
          }
        ],
        isError: true
      };
    }
  }
);

// 注册查询视频结果工具
server.tool(
  "get-video-result",
  "查询视频生成任务的结果。通常需要在提交任务后等待1-3分钟再查询。",
  {
    task_id: z.string().describe("任务ID，通过 generate-video 工具获取")
  },
  async (args, _extra) => {
    const { task_id } = args;

    // 检查API密钥是否配置
    if (!JIMENG_ACCESS_KEY || !JIMENG_SECRET_KEY) {
      const errorData = {
        status: "error",
        message: "API密钥未配置",
        error: "未设置环境变量 JIMENG_ACCESS_KEY 和 JIMENG_SECRET_KEY",
        help: "请参考文档配置环境变量",
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorData, null, 2)
          }
        ],
        isError: true
      };
    }

    try {
      const client = new JimengClient({
        debug: false
      });

      log("查询视频生成任务结果...");

      const result = await client.getVideoTaskResult(task_id, "jimeng_vgfm_t2v_l20");

      if (!result.success) {
        log(`查询视频生成任务结果失败: ${result.error}`);

        const failureData = {
          status: "error",
          message: "查询视频生成任务结果失败",
          error: result.error || "未知错误",
          task_id: task_id,
          timestamp: new Date().toISOString()
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(failureData, null, 2)
            }
          ],
          isError: true
        };
      }

      // 根据任务状态返回不同的结果
      if ((result.status === 'SUCCEEDED' || result.status === 'done') && result.video_urls && result.video_urls.length > 0) {
        // 视频生成成功
        const responseData = {
          status: "success",
          message: "视频生成成功",
          data: {
            status: result.status,
            video_urls: result.video_urls,
            video_url: result.video_urls[0],
            task_id: task_id
          },
          timestamp: new Date().toISOString()
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(responseData, null, 2)
            }
          ]
        };
      } else if (result.status === 'FAILED') {
        // 视频生成失败
        const failureData = {
          status: "error",
          message: "视频生成任务失败",
          data: {
            status: result.status,
            task_id: task_id,
            error: result.error || "视频生成任务失败"
          },
          timestamp: new Date().toISOString()
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(failureData, null, 2)
            }
          ],
          isError: true
        };
      } else {
        // 视频生成中
        const pendingData = {
          status: "pending",
          message: "视频生成任务正在进行中",
          data: {
            status: result.status,
            task_id: task_id,
            help: "请等待30秒-1分钟后再次使用 get-video-result 工具查询结果"
          },
          timestamp: new Date().toISOString()
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(pendingData, null, 2)
            }
          ]
        };
      }
    } catch (error) {
      log("查询视频生成任务结果出错: " + (error instanceof Error ? error.message : String(error)));

      const errorData = {
        status: "error",
        message: "查询视频生成任务结果时发生错误",
        error: error instanceof Error ? error.message : String(error),
        task_id: task_id,
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorData, null, 2)
          }
        ],
        isError: true
      };
    }
  }
);
*/

// 注意：由于视频生成工具(generate-video)已默认使用同步方式（内部轮询），以下工具已不再需要
// 如果需要异步方式，可以取消以下注释
/*
// 注册提交视频任务工具
server.tool(
  "submit-video-task",
  "提交视频生成任务，立即返回任务ID，不等待视频生成完成（已弃用，推荐使用generate-video工具）",
  {
    prompt: z.string().describe("视频内容的描述")
  },
  async (args, _extra) => {
    const { prompt } = args;

    // 检查API密钥是否配置
    if (!JIMENG_ACCESS_KEY || !JIMENG_SECRET_KEY) {
      // 构建标准JSON格式的错误返回数据
      const errorData = {
        status: "error",
        message: "API密钥未配置",
        error: "未设置环境变量 JIMENG_ACCESS_KEY 和 JIMENG_SECRET_KEY",
        help: "请参考文档配置环境变量",
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorData, null, 2)
          }
        ],
        isError: true
      };
    }

    try {
      // 创建即梦AI客户端
      const client = new JimengClient({
        debug: false // 设置为true可以查看详细日志
      });

      // 提交视频生成任务
      log("提交视频生成任务...");

      const result = await client.submitVideoTask({
        prompt: prompt,
        req_key: "jimeng_vgfm_t2v_l20",
        region: "cn-north-1"
      });

      if (!result.success || !result.task_id) {
        log(`提交视频生成任务失败: ${result.error}`);

        // 构建标准JSON格式的失败返回数据
        const failureData = {
          status: "error",
          message: "提交视频生成任务失败",
          error: result.error || "未知错误",
          timestamp: new Date().toISOString()
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(failureData, null, 2)
            }
          ],
          isError: true
        };
      }

      // 构建符合MCP标准的返回数据，包含JSON格式的结果
      const responseData = {
        status: "success",
        message: "视频生成任务提交成功",
        data: {
          prompt,
          task_id: result.task_id,
          help: "使用 get-video-task 工具并提供此 task_id 查询结果"
        },
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(responseData, null, 2)
          }
        ]
      };
    } catch (error) {
      log("提交视频生成任务出错: " + (error instanceof Error ? error.message : String(error)));

      // 构建标准JSON格式的错误返回数据
      const errorData = {
        status: "error",
        message: "提交视频生成任务时发生错误",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorData, null, 2)
          }
        ],
        isError: true
      };
    }
  }
);

// 注册查询视频任务工具
server.tool(
  "get-video-task",
  "查询视频生成任务的结果，根据任务ID获取视频生成结果（已弃用，推荐使用generate-video工具）",
  {
    task_id: z.string().describe("任务ID，通过submit-video-task工具获取")
  },
  async (args, _extra) => {
    const { task_id } = args;

    // 检查API密钥是否配置
    if (!JIMENG_ACCESS_KEY || !JIMENG_SECRET_KEY) {
      // 构建标准JSON格式的错误返回数据
      const errorData = {
        status: "error",
        message: "API密钥未配置",
        error: "未设置环境变量 JIMENG_ACCESS_KEY 和 JIMENG_SECRET_KEY",
        help: "请参考文档配置环境变量",
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorData, null, 2)
          }
        ],
        isError: true
      };
    }

    try {
      // 创建即梦AI客户端
      const client = new JimengClient({
        debug: false // 设置为true可以查看详细日志
      });

      // 查询任务结果
      log("查询视频生成任务结果...");

      const result = await client.getVideoTaskResult(task_id, "jimeng_vgfm_t2v_l20");

      if (!result.success) {
        log(`查询视频生成任务结果失败: ${result.error}`);

        // 构建标准JSON格式的失败返回数据
        const failureData = {
          status: "error",
          message: "查询视频生成任务结果失败",
          error: result.error || "未知错误",
          task_id: task_id,
          timestamp: new Date().toISOString()
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(failureData, null, 2)
            }
          ],
          isError: true
        };
      }

      // 根据任务状态返回不同的结果
      if ((result.status === 'SUCCEEDED' || result.status === 'done') && result.video_urls && result.video_urls.length > 0) {
        // 视频生成成功
        const responseData = {
          status: "success",
          message: "视频生成成功",
          data: {
            status: result.status,
            video_urls: result.video_urls,
            video_url: result.video_urls[0],
            task_id: task_id
          },
          timestamp: new Date().toISOString()
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(responseData, null, 2)
            }
          ]
        };
      } else if (result.status === 'FAILED') {
        // 视频生成失败
        const failureData = {
          status: "error",
          message: "视频生成任务失败",
          data: {
            status: result.status,
            task_id: task_id,
            error: result.error || "视频生成任务失败"
          },
          timestamp: new Date().toISOString()
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(failureData, null, 2)
            }
          ],
          isError: true
        };
      } else {
        // 视频生成中
        const pendingData = {
          status: "pending",
          message: "视频生成任务正在进行中",
          data: {
            status: result.status,
            task_id: task_id,
            help: "请稍后再次使用 get-video-task 工具查询结果"
          },
          timestamp: new Date().toISOString()
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(pendingData, null, 2)
            }
          ]
        };
      }
    } catch (error) {
      log("查询视频生成任务结果出错: " + (error instanceof Error ? error.message : String(error)));

      // 构建标准JSON格式的错误返回数据
      const errorData = {
        status: "error",
        message: "查询视频生成任务结果时发生错误",
        error: error instanceof Error ? error.message : String(error),
        task_id: task_id,
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorData, null, 2)
          }
        ],
        isError: true
      };
    }
  }
);
*/

// ==================== 即梦AI新版模型工具 ====================

// 注册即梦4.0图片生成工具
server.tool(
  "jimeng-v40-generate",
  "即梦4.0图片生成工具，支持文生图、图像编辑及多图组合生成（最多10张输入图，最多15张输出图），支持4K超高清输出。此工具会等待图片生成完成后返回结果。",
  {
    prompt: z.string().describe("生成图像的提示词，中英文均可，最长800字符"),
    image_urls: z.array(z.string()).optional().describe("输入图片URL数组，最多10张，支持JPEG/PNG格式，最大15MB"),
    width: z.number().optional().describe("图像宽度，需与height同时传入才生效"),
    height: z.number().optional().describe("图像高度，需与width同时传入才生效"),
    size: z.number().optional().describe("生成图片的尺寸，可以是边长（如2048表示2048×2048）或面积（如4194304）。支持常见尺寸：1024/2048/4096表示正方形，或直接传面积值"),
    scale: z.number().optional().describe("文本描述影响程度，范围[0,1]，默认0.5，越大文本影响越大"),
    force_single: z.boolean().optional().describe("是否强制生成单图，默认false"),
    seed: z.number().optional().describe("随机种子，默认-1（随机）"),
    min_ratio: z.number().optional().describe("生图结果的最小宽高比，默认1/3"),
    max_ratio: z.number().optional().describe("生图结果的最大宽高比，默认3")
  },
  async (args, _extra) => {
    if (!JIMENG_ACCESS_KEY || !JIMENG_SECRET_KEY) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: "API密钥未配置",
            error: "未设置环境变量 JIMENG_ACCESS_KEY 和 JIMENG_SECRET_KEY"
          }, null, 2)
        }],
        isError: true
      };
    }

    try {
      const client = new JimengClient({ debug: false });

      // 智能处理size参数
      const processedArgs = { ...args };
      if (args.size && !args.width && !args.height) {
        // 如果size值较小，可能是边长而不是面积
        if (args.size <= 4096) {
          // 常见边长值：1024, 2048, 4096等
          const sideLength = args.size;
          processedArgs.size = sideLength * sideLength;
          log(`检测到size可能是边长${sideLength}，转换为面积${processedArgs.size}`);
        }
        // 否则认为是面积值，直接使用
      }

      // 同步生成图片（内部轮询直到完成）
      log("即梦4.0图片生成中，请稍候...");
      const result = await client.generateJimengV40Image(processedArgs as any);

      if (!result.success) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "error",
              message: "生成图片失败",
              error: result.error || "未知错误",
              task_id: result.task_id
            }, null, 2)
          }],
          isError: true
        };
      }

      // 返回成功结果
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "success",
            message: "图片生成成功",
            data: {
              prompt: args.prompt,
              model: "jimeng_t2i_v40",
              image_urls: result.image_urls,
              image_count: result.image_urls?.length || 0,
              task_id: result.task_id
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: "生成图片时发生错误",
            error: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// 注册即梦图生图3.0工具
server.tool(
  "jimeng-i2i-v30",
  "即梦图生图3.0智能参考工具，支持基于文本指令进行图像编辑（如添加/删除实体、修改风格/色彩/动作/背景等）。此工具会等待图片编辑完成后返回结果。",
  {
    image_url: z.string().describe("输入图片URL，支持JPEG/PNG格式，最大4.7MB"),
    prompt: z.string().describe("编辑图像的提示词，建议<=120字符，最长800字符"),
    width: z.number().optional().describe("生成图像宽度，范围[512,2016]，需与height同时传入"),
    height: z.number().optional().describe("生成图像高度，范围[512,2016]，需与width同时传入"),
    scale: z.number().optional().describe("文本描述影响程度，范围[0,1]，默认0.5"),
    seed: z.number().optional().describe("随机种子，默认-1（随机）")
  },
  async (args, _extra) => {
    if (!JIMENG_ACCESS_KEY || !JIMENG_SECRET_KEY) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: "API密钥未配置"
          }, null, 2)
        }],
        isError: true
      };
    }

    try {
      const client = new JimengClient({ debug: false });

      // 同步编辑图片（内部轮询直到完成）
      log("即梦图生图3.0编辑中，请稍候...");
      const result = await client.generateJimengI2IV30Image({
        image_urls: [args.image_url],
        prompt: args.prompt,
        width: args.width,
        height: args.height,
        scale: args.scale,
        seed: args.seed
      });

      if (!result.success) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "error",
              message: "图像编辑失败",
              error: result.error || "未知错误",
              task_id: result.task_id
            }, null, 2)
          }],
          isError: true
        };
      }

      // 返回成功结果
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "success",
            message: "图像编辑成功",
            data: {
              prompt: args.prompt,
              model: "jimeng_i2i_v30",
              image_urls: result.image_urls,
              image_count: result.image_urls?.length || 0,
              task_id: result.task_id
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: "图像编辑时发生错误",
            error: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// 注册即梦文生图3.1工具
server.tool(
  "jimeng-t2i-v31",
  "即梦文生图3.1工具，画面效果呈现升级版，在画面美感、风格精准多样及细节丰富度方面显著提升，支持1K-2K高清输出。此工具会等待图片生成完成后返回结果。",
  {
    prompt: z.string().describe("生成图像的提示词，中英文均可，建议<=120字符，最长800字符"),
    use_pre_llm: z.boolean().optional().describe("是否开启文本扩写，prompt较短建议开启，较长建议关闭，默认true"),
    width: z.number().optional().describe("生成图像宽度，需与height同时传入"),
    height: z.number().optional().describe("生成图像高度，需与width同时传入"),
    seed: z.number().optional().describe("随机种子，默认-1（随机）")
  },
  async (args, _extra) => {
    if (!JIMENG_ACCESS_KEY || !JIMENG_SECRET_KEY) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: "API密钥未配置"
          }, null, 2)
        }],
        isError: true
      };
    }

    try {
      const client = new JimengClient({ debug: false });

      // 同步生成图片（内部轮询直到完成）
      log("即梦文生图3.1生成中，请稍候...");
      const result = await client.generateJimengT2IV31Image(args as any);

      if (!result.success) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "error",
              message: "生成图片失败",
              error: result.error || "未知错误",
              task_id: result.task_id
            }, null, 2)
          }],
          isError: true
        };
      }

      // 返回成功结果
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "success",
            message: "图片生成成功",
            data: {
              prompt: args.prompt,
              model: "jimeng_t2i_v31",
              image_urls: result.image_urls,
              image_count: result.image_urls?.length || 0,
              task_id: result.task_id
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: "生成图片时发生错误",
            error: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// 注册即梦文生图3.0工具
server.tool(
  "jimeng-t2i-v30",
  "即梦文生图3.0工具，在文字响应准确度、图文排版、层次美感和语义理解方面显著提升，支持各类艺术字体和不同字重。此工具会等待图片生成完成后返回结果。",
  {
    prompt: z.string().describe("生成图像的提示词，中英文均可，建议<=120字符，最长800字符"),
    use_pre_llm: z.boolean().optional().describe("是否开启文本扩写，默认true"),
    width: z.number().optional().describe("生成图像宽度，需与height同时传入"),
    height: z.number().optional().describe("生成图像高度，需与width同时传入"),
    seed: z.number().optional().describe("随机种子，默认-1（随机）")
  },
  async (args, _extra) => {
    if (!JIMENG_ACCESS_KEY || !JIMENG_SECRET_KEY) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: "API密钥未配置"
          }, null, 2)
        }],
        isError: true
      };
    }

    try {
      const client = new JimengClient({ debug: false });

      // 同步生成图片（内部轮询直到完成）
      log("即梦文生图3.0生成中，请稍候...");
      const result = await client.generateJimengT2IV30Image(args as any);

      if (!result.success) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "error",
              message: "生成图片失败",
              error: result.error || "未知错误",
              task_id: result.task_id
            }, null, 2)
          }],
          isError: true
        };
      }

      // 返回成功结果
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "success",
            message: "图片生成成功",
            data: {
              prompt: args.prompt,
              model: "jimeng_t2i_v30",
              image_urls: result.image_urls,
              image_count: result.image_urls?.length || 0,
              task_id: result.task_id
            }
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: "生成图片时发生错误",
            error: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// 注意：由于所有图像生成工具已改为同步方式（内部轮询），此工具已不再需要
// 如果需要查询历史任务，可以取消以下注释
/*
// 注册通用的任务查询工具
server.tool(
  "jimeng-query-task",
  "查询即梦AI图像生成任务的结果，支持所有图像生成模型（已弃用，所有工具已改为同步方式）",
  {
    task_id: z.string().describe("任务ID，由图像生成工具返回"),
    req_key: z.enum(["jimeng_t2i_v40", "jimeng_i2i_v30", "jimeng_t2i_v31", "jimeng_t2i_v30"]).describe("模型标识：jimeng_t2i_v40(4.0), jimeng_i2i_v30(图生图3.0), jimeng_t2i_v31(文生图3.1), jimeng_t2i_v30(文生图3.0)")
  },
  async (args, _extra) => {
    if (!JIMENG_ACCESS_KEY || !JIMENG_SECRET_KEY) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: "API密钥未配置"
          }, null, 2)
        }],
        isError: true
      };
    }

    try {
      const client = new JimengClient({ debug: false });

      log(`查询任务结果: ${args.task_id}`);

      const result = await client.queryAsyncTask({
        req_key: args.req_key,
        task_id: args.task_id,
        // 默认返回URL而不是base64（根据API文档）
        req_json: JSON.stringify({ return_url: true })
      });

      if (!result.success) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "error",
              message: "查询任务失败",
              error: result.error,
              task_id: args.task_id
            }, null, 2)
          }],
          isError: true
        };
      }

      // 根据任务状态返回不同结果
      if (result.status === 'SUCCEEDED' && result.data) {
        const imageUrls = result.data.image_urls || [];
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "success",
              message: "图片生成成功",
              data: {
                task_id: args.task_id,
                model: args.req_key,
                image_urls: imageUrls,
                image_count: imageUrls.length
              }
            }, null, 2)
          }]
        };
      } else if (result.status === 'FAILED') {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "error",
              message: "图片生成失败",
              error: result.error || "任务失败",
              task_id: args.task_id
            }, null, 2)
          }],
          isError: true
        };
      } else if (result.status === 'PENDING' || result.status === 'RUNNING') {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "processing",
              message: "任务正在处理中，请稍后再次查询",
              data: {
                task_id: args.task_id,
                current_status: result.status,
                suggestion: "请等待10-30秒后再次查询"
              }
            }, null, 2)
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              status: "unknown",
              message: `未知任务状态: ${result.status}`,
              data: {
                task_id: args.task_id,
                raw_status: result.status
              }
            }, null, 2)
          }]
        };
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "error",
            message: "查询任务时发生错误",
            error: error instanceof Error ? error.message : String(error),
            task_id: args.task_id
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);
*/

// 启动服务器的主函数
async function main() {
  try {
    // 重定向console.log/error到stderr以避免干扰JSON通信
    console.log = function (...args: any[]) {
      process.stderr.write(args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ') + '\n');
    };

    console.error = function (...args: any[]) {
      process.stderr.write(args.map(arg => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' ') + '\n');
    };

    // 确保不会有dotenv调试输出
    process.env.DOTENV_DEBUG = "false";

    // 开始记录到stderr
    console.log(`即梦AI MCP服务器 v1.0.0 (jimeng4.0-mcp-steve) 正在启动...`);
    console.log(`运行环境: Node.js ${process.version}`);
    console.log(`授权状态: ${JIMENG_ACCESS_KEY && JIMENG_SECRET_KEY ? "已配置" : "未配置"}`);

    // 添加stdio传输层
    const transport = new StdioServerTransport();

    // 连接服务器
    await server.connect(transport);

    // 服务器启动成功
    console.log(`MCP服务器启动成功，等待客户端请求...`);
  } catch (error) {
    // 记录错误到标准错误
    process.stderr.write(`错误: MCP服务器启动失败 - ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

// 运行主函数
main(); 