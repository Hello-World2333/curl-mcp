import { configSchema } from '../schema/config.js';
import fs from 'fs';

export default configSchema.parse(JSON.parse(fs.readFileSync('./config.json', 'utf-8')));
