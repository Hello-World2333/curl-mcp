import express from 'express';
import { imageRecognition } from './middlewares/imageRecognition.js';
const app = express();

app.use(express.json({ limit: '10000mb' }));
app.use(express.text({ limit: '10000mb' }));

app.post('/image-recognition', async (req, res) => {
    const imageDataUrl = req.body;
    const result = await imageRecognition(imageDataUrl);
    res.send(result);
});

app.listen(3012, () => {
    console.log('启动成功!');
});
