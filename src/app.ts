import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import z from 'zod';
import express from 'express';
import cors from 'cors';
import util from 'util';
import puppeteer from 'puppeteer';
import { ANSI_COLORS } from './utils/colors.js';
import { imageRecognition, OCR } from './middlewares/imageRecognition.js';
import { generateRandomString } from './utils/utils.js';
import config from './config/config.js';
import { VM } from 'vm2';

// Create an MCP server
const server = new McpServer({
    name: 'utils',
    version: '1.0.0',
});

const browser = await puppeteer.launch({
    headless: config.browser.headless,
    userDataDir: './browser_data',
});

const pages = new Map<string, puppeteer.Page>();

// Register individual browser tools

server.registerTool(
    'browser_new_page',
    {
        title: 'browser_new_page',
        description:
            '打开新浏览器页面并导航到指定 URL。本浏览器工具基于puppeteer。如果页面没有显示想要的内容，可以刷新重试。',
        inputSchema: z.object({
            url: z.string().url(),
        }),
    },
    async (args, context) => {
        console.log('[browser_new_page]', util.inspect(args, { colors: true, depth: null }));
        const page = await browser.newPage();
        const pageId = generateRandomString(8);
        pages.set(pageId, page);
        await page.goto(args.url);
        await page.setViewport({
            width: 1920,
            height: 1080,
        });
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ pageId }),
                },
            ],
        };
    },
);

server.registerTool(
    'browser_goto',
    {
        title: 'browser_goto',
        description: '在指定页面中导航到新 URL',
        inputSchema: z.object({
            url: z.string().url(),
            pageId: z.string(),
        }),
    },
    async (args, context) => {
        console.log('[browser_goto]', util.inspect(args, { colors: true, depth: null }));
        if (pages.has(args.pageId)) {
            await pages.get(args.pageId)?.goto(args.url);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ success: true }),
                    },
                ],
            };
        } else {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ error: 'Page not found' }),
                    },
                ],
            };
        }
    },
);

server.registerTool(
    'browser_eval',
    {
        title: 'browser_eval',
        description:
            '在指定页面中执行 JavaScript 代码。可用于获取页面元素信息，关闭弹窗等\n' +
            '代码运行在浏览器页面上下文，可以访问 document、window 等浏览器 API。不能使用 return',
        inputSchema: z.object({
            code: z.string(),
            pageId: z.string(),
        }),
    },
    async (args, context) => {
        console.log('[browser_eval]', util.inspect(args, { colors: true, depth: null }));
        const res = await pages.get(args.pageId)?.evaluate(args.code);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(res),
                },
            ],
        };
    },
);

server.registerTool(
    'browser_control',
    {
        title: 'browser_control',
        description:
            '执行任意 JavaScript 代码，可获取到 page 对象本身(类型为 puppeteer.Page)，可以对页面进行任意操作。page 对象将被注入到全局变量中，可直接使用。\n' +
            '默认超时 10 秒。代码最后的 return 将被返回。\n' +
            '本工具可以更好的进行页面操作。\n' +
            '代码运行在 node.js 上下文，没有 document 对象。\n' +
            '代码外部将自动包裹 async IIFE 和 try...catch，无需手动添加。',
        inputSchema: z.object({
            code: z.string(),
            pageId: z.string(),
        }),
    },
    async (args, context) => {
        try {
            console.log('[browser_control]', util.inspect(args, { colors: true, depth: null }));
            const vm = new VM({
                sandbox: {
                    page: pages.get(args.pageId),
                    setTimeout: setTimeout,
                    clearTimeout: clearTimeout,
                    setInterval: setInterval,
                    clearInterval: clearInterval,
                },
                timeout: 10000,
                eval: false,
                wasm: false,
                allowAsync: true,
            });
            const code = `
            (async () => {
                try {
                    ${args.code}
                } catch (error) {
                    return { error: error.message || '执行错误' };
                }
            })()`;
            const res = await vm.run(code);
            console.log(res);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(res),
                    },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ error: error.message || '执行错误' }),
                    },
                ],
            };
        }
    },
);

server.registerTool(
    'browser_set_viewport',
    {
        title: 'browser_set_viewport',
        description: '设置指定页面的视口大小',
        inputSchema: z.object({
            width: z.number(),
            height: z.number(),
            pageId: z.string(),
        }),
    },
    async (args, context) => {
        console.log('[browser_set_viewport]', util.inspect(args, { colors: true, depth: null }));
        if (pages.has(args.pageId)) {
            await pages.get(args.pageId)?.setViewport({
                width: args.width,
                height: args.height,
            });
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ success: true }),
                    },
                ],
            };
        } else {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ error: 'Page not found' }),
                    },
                ],
            };
        }
    },
);

server.registerTool(
    'browser_close_page',
    {
        title: 'browser_close_page',
        description: '关闭指定页面',
        inputSchema: z.object({
            pageId: z.string(),
        }),
    },
    async (args, context) => {
        console.log('[browser_close_page]', util.inspect(args, { colors: true, depth: null }));
        const page = pages.get(args.pageId);
        if (page) {
            await page.close();
            pages.delete(args.pageId);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ success: true }),
                    },
                ],
            };
        } else {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ error: 'Page not found' }),
                    },
                ],
            };
        }
    },
);

server.registerTool(
    'browser_screenshot',
    {
        title: 'browser_screenshot',
        description:
            '对指定页面进行截图，并根据所选方式识别图片内容。focus 参数仅在 recognizer 为 "ai" 时有效，可用于向 AI 指定要关注的区域。\n' +
            'fullPage 为 false 时，仅截取当前可见范围，为 true 时截取整个页面(自动滚动)。',
        inputSchema: z.object({
            pageId: z.string(),
            fullPage: z.boolean().optional().default(false),
            focus: z.string().optional(),
            recognizer: z.enum(['ai', 'ocr']),
        }),
    },
    async (args, context) => {
        console.log('[browser_screenshot]', util.inspect(args, { colors: true, depth: null }));
        const { pageId, fullPage = false, focus } = args;

        const page = pages.get(pageId);
        if (!page) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ error: 'Page not found' }),
                    },
                ],
            };
        }

        try {
            const screenshotBuffer = await page.screenshot({
                fullPage,
                type: 'png',
            });

            const base64 = Buffer.from(screenshotBuffer).toString('base64');
            const imageDataUrl = `data:image/png;base64,${base64}`;

            console.log('[browser_screenshot] 开始识别图片...');
            if (args.recognizer === 'ocr') {
                console.log('[browser_screenshot] 使用 OCR 识别图片');
                const start = Date.now();
                const ocrResult = await OCR(imageDataUrl);
                console.log('识别结果:\n' + ANSI_COLORS.GREEN + ocrResult + ANSI_COLORS.RESET);
                console.log(
                    ANSI_COLORS.YELLOW + '耗时:' + (Date.now() - start) + 'ms' + ANSI_COLORS.RESET,
                );
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    success: true,
                                    body: ocrResult,
                                },
                                null,
                                2,
                            ),
                        },
                    ],
                };
            } else {
                console.log('[browser_screenshot] 使用 AI 识别图片');
                const recognitionResult = await imageRecognition(imageDataUrl, focus);

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    success: true,
                                    body: recognitionResult,
                                },
                                null,
                                2,
                            ),
                        },
                    ],
                };
            }
        } catch (error: any) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                error: error.message || '截图或识别失败',
                            },
                            null,
                            2,
                        ),
                    },
                ],
            };
        }
    },
);

server.registerTool(
    'curl',
    {
        title: 'curl',
        description: '进行网络请求',
        inputSchema: z.object({
            url: z.url(),
            method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']),
            headers: z.record(z.string(), z.string()).optional(),
            body: z.any().optional(),
            recongnizeImage: z
                .boolean()
                .optional()
                .describe('如果返回值是图片，那么调用 AI 进行图片识别'),
        }),
    },
    async (args, context) => {
        console.log(
            '[curl]',
            util.inspect(args, {
                colors: true,
                depth: null,
            }),
        );
        const { url, method, headers, body, recongnizeImage } = args;

        try {
            // 判断 body 类型并决定如何序列化及设置 Content-Type
            let requestBody: string | undefined = undefined;
            let finalHeaders = { ...headers };

            if (body !== undefined && body !== null) {
                if (typeof body === 'string') {
                    requestBody = body;
                    if (!finalHeaders['Content-Type']) {
                        finalHeaders['Content-Type'] = 'text/plain';
                    }
                } else if (typeof body === 'object') {
                    requestBody = JSON.stringify(body);
                    if (!finalHeaders['Content-Type']) {
                        finalHeaders['Content-Type'] = 'application/json';
                    }
                } else {
                    // 其他类型（如 number, boolean）转为字符串
                    requestBody = String(body);
                    if (!finalHeaders['Content-Type']) {
                        finalHeaders['Content-Type'] = 'text/plain';
                    }
                }
            }

            const response = await fetch(url, {
                method,
                headers: finalHeaders,
                body: requestBody,
            });

            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            const contentType = responseHeaders['content-type'] || '';

            // 检查是否为二进制类型
            const isBinary =
                /application\/octet-stream|image\/|video\/|audio\/|font\/|application\/pdf/.test(
                    contentType,
                );

            if (isBinary) {
                // 如果启用了 recongnizeImage 且是图片类型，则进行识别
                if (recongnizeImage && contentType.startsWith('image/')) {
                    const arrayBuffer = await response.arrayBuffer();
                    const base64 = Buffer.from(arrayBuffer).toString('base64');
                    const imageDataUrl = `data:${contentType};base64,${base64}`;

                    console.log('[image recognition] 开始识别图片...');
                    const recognitionResult = await imageRecognition(imageDataUrl);

                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(
                                    {
                                        code: response.status,
                                        headers: responseHeaders,
                                        body: recognitionResult,
                                    },
                                    null,
                                    2,
                                ),
                            },
                        ],
                    };
                } else {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(
                                    {
                                        code: response.status,
                                        headers: responseHeaders,
                                        error: '不支持返回二进制内容',
                                    },
                                    null,
                                    2,
                                ),
                            },
                        ],
                    };
                }
            }

            let responseBody: any = undefined;
            if (response.status !== 204 && response.status !== 304) {
                const text = await response.text();
                try {
                    responseBody = JSON.parse(text);
                } catch {
                    responseBody = text;
                }
            }

            console.log(
                '[response]',
                util.inspect(
                    {
                        code: response.status,
                        headers: responseHeaders,
                        body: responseBody,
                    },
                    { depth: null, colors: true },
                ),
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                code: response.status,
                                headers: responseHeaders,
                                body: responseBody,
                            },
                            null,
                            2,
                        ),
                    },
                ],
            };
        } catch (error: any) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                code: -1,
                                headers: {},
                                error: error.message || '未知错误',
                            },
                            null,
                            2,
                        ),
                    },
                ],
            };
        }
    },
);

// 启动服务器
async function startServer() {
    try {
        // 1. 创建 HTTP 服务器
        const app = express();
        app.use(express.json());

        // 添加 CORS 中间件
        app.use(cors());

        // 2. 创建 MCP 传输层
        const transport = new StreamableHTTPServerTransport();

        // 3. 将 MCP 服务器连接到传输层
        await server.connect(transport);

        // 4. 设置 HTTP 路由
        app.post('/mcp', async (req: any, res: any) => {
            await transport.handleRequest(req, res, req.body);
        });

        app.get('/mcp/sse', async (req: any, res: any) => {
            await transport.handleRequest(req, res);
        });

        // 5. 启动 HTTP 服务器
        const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3002;
        app.listen(PORT, () => {
            console.log(
                `${ANSI_COLORS.GREEN}MCP 服务器运行在 http://localhost:${PORT}${ANSI_COLORS.RESET}`,
            );
            console.log('启动成功!');
        });
    } catch (error) {
        console.error('服务器错误:', error);
        process.exit(1);
    }
}

startServer().catch((error) => {
    console.error('主程序错误:', error);
    process.exit(1);
});
