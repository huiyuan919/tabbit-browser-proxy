import { serveFile } from "jsr:@std/http/file-server";

Deno.serve((req: Request) => {
    return serveFile(req, "./index.html");
});Deno Deploy
tabbitbrowser
Playground

Fork to Edit
1234567891011121314151617181920212223242526272829303132333435363738394041
// ============================================================
// Tabbit Browser API Proxy - Deno 单文件版
// 功能：OpenAI 兼容接口代理 + Web 管理控制台（5页）+ Deno KV 监控
// 运行：deno run --env-file=.env --allow-net --allow-env --allow-read tabbitbrowser.ts
// ============================================================

// ============================================================
// 环境变量配置
// 支持从 .env 文件加载（deno run --env-file=.env ...）
// ============================================================

https://tabbitbrowser.deno.dev


