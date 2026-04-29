import { z } from 'zod';

export const configSchema = z.object({
    imageRecognition: z.object({
        baseURL: z.string(),
        model: z.string(),
    }),
    browser: z.object({
        headless: z.boolean(),
    }),
});
