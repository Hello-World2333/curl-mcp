这是一个 MCP 服务器，可以让你的 AI 调用 HTTP API、使用浏览器。  
准确来说，本项目提供了`curl`工具和一套`browser`工具

## 快速开始

### 初始化

你需要先安装`node.js`环境(推荐`Node.js v22`)  
克隆本项目，在项目目录下执行这个命令
```bash
npm install
cp .env.example .env
cp config.json.example config.json
```

### 配置

- 编辑`config.json`文件，修改`imageRecognition`字段的`baseURL`和`model`属性，输入你的提供商，填写一个支持图片输入的模型  
- 如果你想要 headless 浏览器，把`config.json`的`.browser.headless`改成`true`就行
- 编辑`.env`文件，将`YOUR_API_KEY`修改为你的 API 密钥

然后加载`.env`文件的环境变量


### 启动

运行这个命令:
```bash
npm run build
npm start
```

在你的客户端配置MCP服务器:
- URL: `http://<服务器IP>:3002/mcp`
- type: `Streamable HTTP`

## FAQ

Q: 报错`IMAGE_RECOGNITION_API_KEY 未设置`  
A: 没有加载环境变量导致的

Q: 我可以在浏览器里登录账号吗?  
A: 可以，本项目配置了持久化，登录状态会保留


## footer

> 警告: `browser_control工具采用了不安全的`vm2`沙盒  
> 如果你担心安全风险，可以在配置文件内将`.disabledBrowserControlTool`设置为`true`以禁用此工具

