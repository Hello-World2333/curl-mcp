import Openai from 'openai';
import { ANSI_COLORS } from '../utils/colors.js';
import config from '../config/config.js';

if (!process.env.IMAGE_RECOGNITION_API_KEY) {
    console.error('IMAGE_RECOGNITION_API_KEY 未设置');
    process.exit(1);
}

const CONFIG = {
    baseURL: config.imageRecognition.baseURL,
    apiKey: process.env.IMAGE_RECOGNITION_API_KEY,
    model: config.imageRecognition.model,
};

const openai = new Openai({
    baseURL: CONFIG.baseURL,
    apiKey: CONFIG.apiKey,
});

const PROMPT = `
You are an OCR assistant.

{{ focus }}

For each element, specify:
- The exact text (for text) or a short description (for non-text).
- For document-type content, please use markdown and latex format.
- If there are objects like buildings or characters, try to identify who they are.
- Its approximate position in the image (e.g., 'top left', 'center right', 'bottom middle').
- Its spatial relationship to nearby elements (e.g., 'above', 'below', 'next to', 'on the left of').

Keep the original reading order and layout structure as much as possible.
Do not interpret or translate—only transcribe and describe what is visually present.

Output language: zh_cn
DO NOT USE JSON FORMAT. ONLY PLAIN TEXT WITH MARKDOWN.`;

/**
 * 调用 AI 识别图片
 * @param image base64 编码的图片
 * @param focus 关注区域
 */
export async function imageRecognition(
    image: string,
    focus: string = `Extract all visible text from the image and also describe any non-text elements (icons, shapes, arrows, objects, symbols, or emojis).`,
) {
    const prompt = PROMPT.replace('{{ focus }}', focus);
    const response = await openai.chat.completions.create(
        {
            model: CONFIG.model,
            messages: [],
            stream: true,
            //reasoning_effort: 'none',
        },
        {
            body: {
                model: CONFIG.model,
                stream: true,
                messages: [
                    {
                        role: 'system',
                        content: prompt,
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                image_url: {
                                    url: image,
                                },
                            },
                        ],
                    },
                ],
                thinking: {
                    type: 'disabled',
                },
            },
        },
    );
    let result = '';
    const start = Date.now();
    let tokenCount = 0;
    let usage: Openai.CompletionUsage | null = null;
    for await (const chunk of response) {
        if (chunk.choices[0]?.delta?.content) {
            result += chunk.choices[0].delta.content;
            tokenCount += 1;
            process.stdout.write(
                ANSI_COLORS.GREEN + chunk.choices[0].delta.content + ANSI_COLORS.RESET,
            );
        }
        if (chunk.usage) {
            usage = chunk.usage;
        }
    }
    const now = Date.now();
    console.log(ANSI_COLORS.YELLOW);
    console.log(
        `usage: ↑ ${usage?.prompt_tokens} tk  ↓ ${usage?.completion_tokens} tk  total ${usage?.total_tokens} tk`,
    );
    console.log(`time: ${now - start}ms`);
    console.log(
        `speed: ${(((usage?.completion_tokens || tokenCount) / (now - start)) * 1000).toFixed(3)} tokens/s`,
    );
    console.log(ANSI_COLORS.RESET);
    return result;
}
