// ============================================================
// Tabbit Browser API Proxy - Deno 单文件版
// 功能：OpenAI 兼容接口代理 + Web 管理控制台（5页）+ Deno KV 监控
// 运行：deno run --env-file=.env --allow-net --allow-env --allow-read tabbitbrowser.ts
// ============================================================

// ============================================================
// 环境变量配置
// 支持从 .env 文件加载（deno run --env-file=.env ...）
// ============================================================
const ENV = {
  // Tabbit 账号凭据（token 为必填，其余可选）
  TABBIT_TOKEN: Deno.env.get("TABBIT_TOKEN") ?? "eyJhbGciOiJSUzI1NiIsImtpZCI6ImNlcnRfNXh5Z21kIiwidHlwIjoiSldUIn0.eyJuYW1lIjoidXNlcl9kZGYxYjU1Y2ZjMzAiLCJpZCI6ImJmOWNhZmQ5LTk1OWItNDFlNC1iMDc2LTc3MDU4ZjUzN2NhNCIsInRva2VuVHlwZSI6ImFjY2Vzcy10b2tlbiIsInRhZyI6IiIsInNjb3BlIjoidGFiIiwiYXpwIjoiZTdmYTQ0Mzg3YjEyMzhlZjFmNmYiLCJpc3MiOiJodHRwczovL3dlYi50YWItYnJvd3Nlci5jb20iLCJzdWIiOiJiZjljYWZkOS05NTliLTQxZTQtYjA3Ni03NzA1OGY1MzdjYTQiLCJhdWQiOlsiZTdmYTQ0Mzg3YjEyMzhlZjFmNmYiXSwiZXhwIjoxNzgwMzczODI2LCJuYmYiOjE3Nzk3NjkwMjYsImlhdCI6MTc3OTc2OTAyNiwianRpIjoiYWRtaW4vZGNhYzY3MmYtMmQ0ZS00MGVlLWFmOWYtMGQwN2U2NWYwMzg5In0.bTqoQgKPLpFarD1nmvji_Olc_Iiqp7ZyQplolAT5ZS8YNJluu9ENIFysSCUeD-Rcqtu1MwPH5Z2D5ven82ap6s-VO3hRW2Q0CNk3ubJvWjm9oyRh3qYNLIdWbUS-8cP14In5QvmbcFpeD2fLQyUmTkxF39cZz1LRjIAnH1aoOptN3B5vWfo71tVL58am2hnFjAsIOHtJKQAB233w9THYS2w3-4uf0DwIE2VtSbwLOUlZO0UQq5CU0PUcRMBlfcYNKPhkFtFcFcGxbrprnVvKmSwzbH_EsUWrU9qZv5KQLuRpq_Ap33-St7Vsd5OGG_wT1Hmh8LPDSDxo-EZ5kkxNx0xXRrIRYwR-W1Nbg4sSWPBp4432b3R-tFtMEnW9hWnRKJPWXZcu1dZDdoMUXyDVIWwM2GfD_c159FtiJLlVfLSs0remsoYSLeEJIxqSCXKSH7opGx2_QOOlK6p05tCpzr-PWY-Pt4AgdxNyyrpg9VjVbGxcd49hBWv1fAIvzzZyCLR-TmfntOFULCRQ_t4sVUgtfdQ286cXUNb5r1k2eNSB8syDdffuWj6X6eH2LQqpiG0LjNWFOyzB3bhSbrXVawBrkymmk0gglck932p3qCS05xk88F1nN6g8tPEa1rss7kYmqh4uDawhEnlOQ8R_LKiHKVuioGw5xL4-R7f-Phs",
  TABBIT_SESSION: Deno.env.get("TABBIT_SESSION") ?? "",
  TABBIT_DEVICE_ID: Deno.env.get("TABBIT_DEVICE_ID") ?? "",
  // 本地服务访问鉴权（可选）
  // 设置后：请求 Bearer 必须匹配此值，Tabbit 凭据使用环境变量
  // 不设置：请求 Bearer 直接作为 Tabbit token 字符串（兼容旧用法）
  API_KEY: Deno.env.get("API_KEY") ?? "sk-54188",
  // 监听端口
  PORT: parseInt(Deno.env.get("PORT") ?? "8800"),
};

// 由环境变量拼接的默认 Tabbit token 字符串（token|session|device_id）
const DEFAULT_TABBIT_TOKEN = [
  ENV.TABBIT_TOKEN,
  ENV.TABBIT_SESSION,
  ENV.TABBIT_DEVICE_ID,
].filter(Boolean).join("|");

// ============================================================
// 静态常量
// ============================================================
const TABBIT_BASE = "https://web.tabbitbrowser.com";
const CLIENT_ID = "e7fa44387b1238ef1f6f";
// hashlib.md5(b"").hexdigest() 的结果，原代码生成空字符串的 MD5
const EMPTY_MD5 = "d41d8cd98f00b204e9800998ecf8427e";
// 服务启动时间（用于兜底，实际部署时间从 KV 读取）
const SERVER_START_TIME = new Date().toISOString();
// 静态资源代理基地址
const PROXY = "https://proxy.jhun.edu.kg/proxy";

const MODEL_MAP: Record<string, string> = {
  "best": "最佳",
  "gpt-5.2-chat": "GPT-5.2-Chat",
  "gpt-5.1-chat": "GPT-5.1-Chat",
  "gemini-3.1-pro": "Gemini-3.1-Pro",
  "gemini-3-flash": "Gemini-3-Flash",
  "gemini-2.5-flash": "Gemini-2.5-Flash",
  "claude-sonnet-4.6": "Claude-Sonnet-4.6",
  "claude-haiku-4.5": "Claude-Haiku-4.5",
  "glm-5": "GLM-5",
  "deepseek-v3.2": "DeepSeek-V3.2",
  "minimax-m2.5": "MiniMax-M2.5",
  "kimi-k2.5": "Kimi-K2.5",
  "qwen3.5-plus": "Qwen3.5-Plus",
  "doubao-seed-1.8": "Doubao-Seed-1.8",
};

// ============================================================
// 工具函数
// ============================================================
function logger(level: string, message: string) {
  const time = new Date().toISOString().replace("T", " ").substring(0, 19);
  console.log(`${time} [${level}] ${message}`);
}

function parseJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return {};
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64).split("").map((c) =>
        "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
      ).join(""),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return {};
  }
}

async function* readLines(stream: ReadableStream<Uint8Array>) {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) yield line;
  }
  if (buffer) yield buffer;
}

// ============================================================
// Tabbit 核心客户端
// ============================================================
class TabbitClient {
  jwt_token: string;
  next_auth: string | null;
  device_id: string;
  user_id: string;

  constructor(token_str: string) {
    const parts = token_str.split("|");
    this.jwt_token = parts[0];
    this.next_auth = parts.length > 1 ? parts[1] : null;
    this.device_id = parts.length > 2 ? parts[2] : crypto.randomUUID();

    const payload = parseJwtPayload(this.jwt_token);
    this.user_id =
      (payload.id as string) || (payload.sub as string) || crypto.randomUUID();
  }

  private _get_headers(referer_path = "/newtab"): HeadersInit {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      "sec-ch-ua": '"Not:A-Brand";v="99", "Tabbit";v="145", "Chromium";v="145"',
      "sec-ch-ua-platform": '"Windows"',
      "x-chrome-id-consistency-request":
        `version=1,client_id=${CLIENT_ID},device_id=${this.device_id},sync_account_id=${this.user_id},signin_mode=all_accounts,signout_mode=show_confirmation`,
      "referer": `${TABBIT_BASE}${referer_path}`,
    };
  }

  private _get_cookie_string(): string {
    const cookies: Record<string, string> = {
      token: this.jwt_token,
      user_id: this.user_id,
      managed: "tab_browser",
      NEXT_LOCALE: "zh",
    };
    if (this.next_auth) cookies["next-auth.session-token"] = this.next_auth;
    return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  }

  async create_chat_session(): Promise<string> {
    const router_state = [
      "",
      {
        children: [
          "chat",
          {
            children: [
              ["id", "new", "d"],
              { children: ["__PAGE__", {}, null, "refetch"] },
              null,
              null,
            ],
          },
          null,
          null,
        ],
      },
      null,
      null,
    ];
    const headers = new Headers(this._get_headers("/chat/new"));
    headers.set("rsc", "1");
    headers.set(
      "next-router-state-tree",
      encodeURIComponent(JSON.stringify(router_state)),
    );
    headers.set("cookie", this._get_cookie_string());

    const resp = await fetch(`${TABBIT_BASE}/chat/new?_rsc=auto`, { headers });
    const text = await resp.text();
    const match = text.match(
      /\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    );
    if (match) return match[1];
    throw new Error("Failed to extract chat session_id from RSC response");
  }

  async *send_message(session_id: string, content: string, model: string) {
    const payload = {
      chat_session_id: session_id,
      content,
      selected_model: model,
      agent_mode: false,
      metadatas: { html_content: `<p>${content}</p>` },
      entity: { key: EMPTY_MD5, extras: { type: "tab", url: "" } },
    };

    const headers = new Headers(this._get_headers(`/chat/${session_id}`));
    headers.set("Accept", "text/event-stream");
    headers.set("Content-Type", "application/json");
    headers.set("cookie", this._get_cookie_string());

    const resp = await fetch(`${TABBIT_BASE}/chat/send`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Tabbit API error ${resp.status}: ${body}`);
    }
    if (!resp.body) return;

    let current_event = "";
    for await (const line of readLines(resp.body)) {
      if (line.startsWith("event:")) {
        current_event = line.substring(6).trim();
      } else if (line.startsWith("data:") && current_event) {
        try {
          yield { event: current_event, data: JSON.parse(line.substring(5).trim()) };
        } catch { /* ignore parse errors */ }
      }
    }
  }
}

// ============================================================
// Deno KV 监控指标
// ============================================================
interface RequestRecord {
  time: string;
  method: string;
  path: string;
  status: number;
  latency: number;
  model: string;
  stream: boolean;
  success: boolean;
}

interface Metrics {
  totalRequests: number;
  successRequests: number;
  failureRequests: number;
  totalLatency: number;
  minLatency: number;
  maxLatency: number;
  streamRequests: number;
  nonStreamRequests: number;
  modelCounts: Record<string, number>;
}

// 初始化 Deno KV（顶层 await，Deno 原生支持）
const kv = await Deno.openKv();

// 初始化部署时间：首次部署写入 KV，后续重启复用，确保 uptime 从真实部署时刻起算
let DEPLOY_TIME: string;
{
  const entry = await kv.get<string>(["deploy_time"]);
  if (entry.value) {
    DEPLOY_TIME = entry.value;
  } else {
    DEPLOY_TIME = SERVER_START_TIME;
    await kv.set(["deploy_time"], DEPLOY_TIME);
  }
}

// 页面访问次数自增（按页面路径分别计数 + 总计）
async function incrementPageViews(page: string): Promise<void> {
  const [totalEntry, pageEntry] = await Promise.all([
    kv.get<number>(["pageviews", "total"]),
    kv.get<number>(["pageviews", "page", page]),
  ]);
  await kv.atomic()
    .set(["pageviews", "total"], (totalEntry.value ?? 0) + 1)
    .set(["pageviews", "page", page], (pageEntry.value ?? 0) + 1)
    .commit();
}

async function recordRequest(record: RequestRecord): Promise<void> {
  const metricsEntry = await kv.get<Metrics>(["metrics"]);
  const m: Metrics = metricsEntry.value ?? {
    totalRequests: 0,
    successRequests: 0,
    failureRequests: 0,
    totalLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
    streamRequests: 0,
    nonStreamRequests: 0,
    modelCounts: {},
  };

  m.totalRequests++;
  if (record.success) m.successRequests++;
  else m.failureRequests++;
  m.totalLatency += record.latency;
  if (record.latency < m.minLatency) m.minLatency = record.latency;
  if (record.latency > m.maxLatency) m.maxLatency = record.latency;
  if (record.stream) m.streamRequests++;
  else m.nonStreamRequests++;
  if (record.model) {
    m.modelCounts[record.model] = (m.modelCounts[record.model] ?? 0) + 1;
  }

  // 读取最近请求列表，仅保留最近 10 条
  const reqEntry = await kv.get<RequestRecord[]>(["requests"]);
  const requests = reqEntry.value ?? [];
  requests.unshift(record);
  if (requests.length > 10) requests.pop();

  // 原子写入，保证一致性
  await kv.atomic()
    .set(["metrics"], m)
    .set(["requests"], requests)
    .commit();
}

async function getMetricsData() {
  const [metricsEntry, requestsEntry, deployEntry, pageviewsEntry] = await Promise.all([
    kv.get<Metrics>(["metrics"]),
    kv.get<RequestRecord[]>(["requests"]),
    kv.get<string>(["deploy_time"]),
    kv.get<number>(["pageviews", "total"]),
  ]);
  return {
    metrics: metricsEntry.value ?? null,
    requests: requestsEntry.value ?? [],
    startTime: deployEntry.value ?? DEPLOY_TIME,
    pageviews: pageviewsEntry.value ?? 0,
  };
}

// ============================================================
// HTML 公共组件
// ============================================================
const NAV_LINKS = [
  { href: "/", label: "首页" },
  { href: "/docs", label: "文档" },
  { href: "/playground", label: "Playground" },
  { href: "/deploy", label: "部署" },
  { href: "/dashboard", label: "控制台" },
];

function navbar(activePath: string): string {
  const links = NAV_LINKS.map((l) => {
    const active = l.href === activePath;
    return `<a href="${l.href}" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}">${l.label}</a>`;
  }).join("");
  return `
  <nav class="sticky top-0 z-50 border-b border-gray-800 backdrop-blur-sm" style="background:var(--nb);border-color:var(--br);">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <a href="/" class="flex items-center gap-3">
          <div class="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">T</div>
          <span class="font-semibold" style="color:var(--tx)">Tabbit Proxy</span>
        </a>
        <div class="flex items-center gap-1">
          ${links}
          <button onclick="toggleTheme()" aria-label="切换主题" title="切换明暗模式" class="ml-1 p-2 rounded-lg transition-colors hover:bg-gray-800" style="color:var(--txm)">
            <svg id="ti-sun" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
            </svg>
            <svg id="ti-moon" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="display:none">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </nav>`;
}

function footer(): string {
  return `
  <footer class="border-t border-gray-800 py-8 mt-16">
    <div class="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm space-y-2">
      <div>Tabbit Browser API Proxy &middot; OpenAI 兼容接口 &middot; Powered by Deno</div>
      <div class="flex items-center justify-center gap-4">
        <a href="https://linux.do/t/topic/1682005/1" target="_blank" rel="noopener noreferrer" class="text-indigo-400 hover:text-indigo-300 transition-colors">📖 部署教程</a>
        <span class="text-gray-700">&middot;</span>
        <a href="https://dash.deno.com/playground/tabbitbrowser" target="_blank" rel="noopener noreferrer" class="text-indigo-400 hover:text-indigo-300 transition-colors">🦕 源码</a>
      </div>
      <div class="text-xs text-gray-600">👁️ 累计访问：<span id="footer-pv" class="text-gray-500 font-mono">—</span> 次</div>
    </div>
  </footer>
  <script>
    (function(){
      fetch('/api/pageviews').then(function(r){return r.json();}).then(function(d){
        var el=document.getElementById('footer-pv');
        if(el)el.textContent=d.total.toLocaleString('zh-CN');
      }).catch(function(){});
    })();
  </script>`;
}

function layout(
  title: string,
  activePath: string,
  content: string,
  extraHead = "",
): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Tabbit Proxy</title>
  <script>(function(){var t=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');if(t==='dark')document.documentElement.classList.add('dark');})()</script>
  <script src="${PROXY}/cdn.tailwindcss.com"></script>
  ${extraHead}
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;transition:background-color .15s,color .15s;}
    .grad{background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
    /* ── Theme variables ── */
    html{--bg:#f8fafc;--sf:#fff;--sf2:#f1f5f9;--br:#e2e8f0;--nb:rgba(248,250,252,.92);--tx:#0f172a;--txm:#64748b;}
    html.dark{--bg:#030712;--sf:#111827;--sf2:#0d1117;--br:#1f2937;--nb:rgba(3,7,18,.9);--tx:#f9fafb;--txm:#9ca3af;}
    body{background:var(--bg);color:var(--tx);}
    .card{background:var(--sf);border:1px solid var(--br);border-radius:12px;}
    /* ── Light-mode Tailwind overrides ── */
    html:not(.dark) .bg-gray-950{background:var(--bg)!important;}
    html:not(.dark) .bg-gray-900{background:var(--sf2)!important;}
    html:not(.dark) .bg-gray-800{background:var(--br)!important;}
    html:not(.dark) .hover\\:bg-gray-800:hover{background:#e2e8f0!important;}
    html:not(.dark) .hover\\:bg-gray-700:hover{background:#cbd5e1!important;}
    html:not(.dark) .text-gray-100{color:var(--tx)!important;}
    html:not(.dark) .text-gray-200{color:#1e293b!important;}
    html:not(.dark) .text-gray-300{color:#334155!important;}
    html:not(.dark) .text-gray-400{color:var(--txm)!important;}
    html:not(.dark) .text-gray-500{color:#94a3b8!important;}
    html:not(.dark) .text-gray-600{color:#94a3b8!important;}
    html:not(.dark) nav .hover\\:text-white:hover{color:#1e293b!important;}
    html:not(.dark) .border-gray-800{border-color:var(--br)!important;}
    html:not(.dark) .divide-y>*+*{border-color:var(--br)!important;}
    html:not(.dark) pre{background:var(--sf2)!important;}
    html:not(.dark) select,html:not(.dark) input[type=password],html:not(.dark) textarea{background:var(--sf2)!important;border-color:var(--br)!important;color:var(--tx)!important;}
    html:not(.dark) .text-green-400{color:#059669!important;}
    html:not(.dark) .text-yellow-400{color:#d97706!important;}
    html:not(.dark) .text-red-400{color:#dc2626!important;}
    html:not(.dark) .text-blue-400{color:#2563eb!important;}
    html:not(.dark) .text-indigo-400{color:#4f46e5!important;}
    html:not(.dark) .text-purple-400{color:#7c3aed!important;}
    html:not(.dark) [class*="bg-indigo-900"]{background:rgba(238,242,255,.6)!important;}
    html:not(.dark) [class*="bg-purple-900"]{background:rgba(245,243,255,.6)!important;}
    html:not(.dark) [class*="bg-green-900"]{background:rgba(240,253,244,.6)!important;}
    html:not(.dark) [class*="bg-red-900"]{background:rgba(254,242,242,.6)!important;}
    html:not(.dark) [class*="bg-blue-900"]{background:rgba(239,246,255,.6)!important;}
    html:not(.dark) .border-indigo-700\\/50{border-color:rgba(99,102,241,.3)!important;}
    pre::-webkit-scrollbar{height:6px;}pre::-webkit-scrollbar-thumb{background:#374151;border-radius:3px;}
  </style>
  <script>
    function toggleTheme(){
      const h=document.documentElement,isDark=!h.classList.contains('dark');
      h.classList.toggle('dark',isDark);
      localStorage.setItem('theme',isDark?'dark':'light');
      _si();
    }
    function _si(){
      const d=document.documentElement.classList.contains('dark');
      const s=document.getElementById('ti-sun'),m=document.getElementById('ti-moon');
      if(s&&m){s.style.display=d?'block':'none';m.style.display=d?'none':'block';}
    }
    document.addEventListener('DOMContentLoaded',_si);
  </script>
</head>
<body class="min-h-screen flex flex-col">
  ${navbar(activePath)}
  <main class="flex-1">${content}</main>
  ${footer()}
</body>
</html>`;
}

// ============================================================
// 页面：首页
// ============================================================
function homePage(): string {
  const modelTags = Object.keys(MODEL_MAP).map((k) =>
    `<span class="px-2 py-1 bg-gray-800 rounded text-xs font-mono text-gray-300">${k}</span>`
  ).join(" ");

  return layout("首页", "/", `
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
    <div class="text-center mb-20">
      <div class="inline-flex items-center gap-2 px-3 py-1 bg-indigo-900/30 border border-indigo-700/50 rounded-full text-indigo-400 text-sm mb-6">
        <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>服务运行中
      </div>
      <h1 class="text-5xl font-bold mb-6"><span class="grad">Tabbit Browser</span><br>API 代理服务</h1>
      <p class="text-xl text-gray-400 max-w-2xl mx-auto mb-10">将 Tabbit Browser 的 AI 对话能力封装为标准 OpenAI 兼容接口，支持流式输出与多模型切换。</p>
      <div class="flex flex-wrap justify-center gap-4">
        <a href="/playground" class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-medium transition-colors">立即体验</a>
        <a href="/docs" class="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-colors">查看文档</a>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
      <div class="card p-6"><div class="w-12 h-12 bg-indigo-900/50 rounded-xl flex items-center justify-center text-2xl mb-4">🔌</div><h3 class="text-lg font-semibold mb-2">OpenAI 兼容</h3><p class="text-gray-400 text-sm">完全兼容 Chat Completions API，无需修改现有代码即可接入。</p></div>
      <div class="card p-6"><div class="w-12 h-12 bg-purple-900/50 rounded-xl flex items-center justify-center text-2xl mb-4">⚡</div><h3 class="text-lg font-semibold mb-2">流式输出</h3><p class="text-gray-400 text-sm">支持 SSE 流式响应，实现实时逐字输出，提升用户体验。</p></div>
      <div class="card p-6"><div class="w-12 h-12 bg-green-900/50 rounded-xl flex items-center justify-center text-2xl mb-4">🤖</div><h3 class="text-lg font-semibold mb-2">多模型支持</h3><p class="text-gray-400 text-sm">支持 ${Object.keys(MODEL_MAP).length} 款主流 AI 模型，统一接口自由切换。</p></div>
    </div>
    <div class="card p-8 mb-8">
      <h2 class="text-2xl font-bold mb-4">快速开始</h2>
      <pre class="bg-gray-900 rounded-xl p-5 text-sm text-green-400 overflow-x-auto">curl http://localhost:${ENV.PORT}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -d '{"model":"best","messages":[{"role":"user","content":"你好"}],"stream":false}'</pre>
    </div>
    <div class="card p-8">
      <h2 class="text-2xl font-bold mb-4">支持的模型</h2>
      <div class="flex flex-wrap gap-2">${modelTags}</div>
    </div>
  </div>`);
}

// ============================================================
// 页面：文档
// ============================================================
function docsPage(): string {
  const modelCodes = Object.keys(MODEL_MAP).map((k) =>
    `<code class="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">${k}</code>`
  ).join(" ");

  return layout("文档", "/docs", `
  <div class="max-w-4xl mx-auto px-4 py-16">
    <h1 class="text-4xl font-bold mb-4">API 文档</h1>
    <p class="text-gray-400 mb-12">Tabbit Proxy 完全兼容 OpenAI Chat Completions API v1 规范。</p>

    <section class="mb-12">
      <h2 class="text-2xl font-semibold mb-4 border-b border-gray-800 pb-3">认证方式</h2>
      <div class="space-y-4">
        <div class="card p-6">
          <h3 class="font-semibold text-indigo-400 mb-2">场景 A：配置了 <code class="bg-gray-800 px-1 rounded">API_KEY</code></h3>
          <p class="text-gray-400 text-sm mb-3">Bearer 用于本地鉴权，Tabbit 凭据取自环境变量。</p>
          <pre class="bg-gray-900 rounded-lg p-3 text-sm text-yellow-400">Authorization: Bearer &lt;API_KEY&gt;</pre>
        </div>
        <div class="card p-6">
          <h3 class="font-semibold text-purple-400 mb-2">场景 B：未配置 <code class="bg-gray-800 px-1 rounded">API_KEY</code></h3>
          <p class="text-gray-400 text-sm mb-3">Bearer 直接作为 Tabbit token 字符串（格式：<code class="bg-gray-800 px-1 rounded">token|session|device_id</code>）。</p>
          <pre class="bg-gray-900 rounded-lg p-3 text-sm text-yellow-400">Authorization: Bearer &lt;TABBIT_TOKEN&gt;|&lt;SESSION&gt;|&lt;DEVICE_ID&gt;</pre>
        </div>
      </div>
    </section>

    <section class="mb-12">
      <h2 class="text-2xl font-semibold mb-4 border-b border-gray-800 pb-3">接口列表</h2>
      <div class="space-y-6">
        <div class="card p-6">
          <div class="flex items-center gap-3 mb-3">
            <span class="px-2 py-1 bg-green-900/50 text-green-400 rounded text-xs font-bold">GET</span>
            <code class="text-indigo-400 font-mono">/v1/models</code>
          </div>
          <p class="text-gray-400 text-sm mb-3">获取可用模型列表。</p>
          <pre class="bg-gray-900 rounded-lg p-4 text-sm text-gray-300">{"object":"list","data":[{"id":"best","object":"model","owned_by":"tabbit"},...]}</pre>
        </div>
        <div class="card p-6">
          <div class="flex items-center gap-3 mb-3">
            <span class="px-2 py-1 bg-blue-900/50 text-blue-400 rounded text-xs font-bold">POST</span>
            <code class="text-indigo-400 font-mono">/v1/chat/completions</code>
          </div>
          <p class="text-gray-400 text-sm mb-3">对话请求，支持流式与非流式。</p>
          <pre class="bg-gray-900 rounded-lg p-4 text-sm text-gray-300 mb-4">{"model":"best","messages":[{"role":"user","content":"你好"}],"stream":false}</pre>
          <div class="flex flex-wrap gap-2">${modelCodes}</div>
        </div>
        <div class="card p-6">
          <div class="flex items-center gap-3 mb-3">
            <span class="px-2 py-1 bg-green-900/50 text-green-400 rounded text-xs font-bold">GET</span>
            <code class="text-indigo-400 font-mono">/api/metrics</code>
          </div>
          <p class="text-gray-400 text-sm">获取服务运行指标与最近 10 条请求记录（JSON）。</p>
        </div>
      </div>
    </section>

    <section class="mb-12">
      <h2 class="text-2xl font-semibold mb-4 border-b border-gray-800 pb-3">环境变量</h2>
      <div class="card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-900/50"><tr>
            <th class="text-left px-4 py-3 text-gray-400 font-medium">变量名</th>
            <th class="text-left px-4 py-3 text-gray-400 font-medium">说明</th>
            <th class="text-left px-4 py-3 text-gray-400 font-medium">必填</th>
          </tr></thead>
          <tbody class="divide-y divide-gray-800">
            <tr><td class="px-4 py-3 font-mono text-indigo-400">TABBIT_TOKEN</td><td class="px-4 py-3 text-gray-300">JWT access token（Cookie token= 的值）</td><td class="px-4 py-3 text-yellow-400">二选一</td></tr>
            <tr><td class="px-4 py-3 font-mono text-indigo-400">TABBIT_SESSION</td><td class="px-4 py-3 text-gray-300">next-auth session token</td><td class="px-4 py-3 text-gray-500">可选</td></tr>
            <tr><td class="px-4 py-3 font-mono text-indigo-400">TABBIT_DEVICE_ID</td><td class="px-4 py-3 text-gray-300">设备 UUID（省略则自动生成）</td><td class="px-4 py-3 text-gray-500">可选</td></tr>
            <tr><td class="px-4 py-3 font-mono text-indigo-400">API_KEY</td><td class="px-4 py-3 text-gray-300">本地服务访问密钥</td><td class="px-4 py-3 text-gray-500">可选</td></tr>
            <tr><td class="px-4 py-3 font-mono text-indigo-400">PORT</td><td class="px-4 py-3 text-gray-300">监听端口（默认 8800）</td><td class="px-4 py-3 text-gray-500">可选</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>`);
}

// ============================================================
// 页面：Playground
// ============================================================
function playgroundPage(): string {
  const modelOptions = Object.keys(MODEL_MAP).map((k) =>
    `<option value="${k}">${k} → ${MODEL_MAP[k]}</option>`
  ).join("");

  return layout("Playground", "/playground", `
  <div class="max-w-5xl mx-auto px-4 py-12">
    <h1 class="text-3xl font-bold mb-2">Playground</h1>
    <p class="text-gray-400 mb-8">在线测试 API 接口，无需离开浏览器。</p>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div class="card p-6 space-y-4">
        <h2 class="font-semibold text-gray-300">配置</h2>
        <div>
          <label class="block text-xs text-gray-500 mb-1">模型</label>
          <select id="pg-model" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500">${modelOptions}</select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 mb-1">Authorization Token（留空使用服务端环境变量）</label>
          <input id="pg-token" type="password" placeholder="Bearer token" class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500">
        </div>
        <label class="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input id="pg-stream" type="checkbox" checked> 流式输出（stream）
        </label>
        <div>
          <label class="block text-xs text-gray-500 mb-1">消息内容</label>
          <textarea id="pg-message" rows="4" placeholder="输入消息..." class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 resize-none"></textarea>
        </div>
        <button id="pg-btn" onclick="sendReq()" class="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-medium text-sm transition-colors">发送请求</button>
      </div>
      <div class="card p-6 flex flex-col">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold text-gray-300">响应</h2>
          <span id="pg-stat" class="text-xs text-gray-500"></span>
        </div>
        <div id="pg-out" class="flex-1 bg-gray-900 rounded-xl p-4 text-sm font-mono text-gray-300 whitespace-pre-wrap overflow-y-auto" style="min-height:220px">等待发送...</div>
      </div>
    </div>
    <div class="card p-6">
      <h2 class="font-semibold text-gray-300 mb-3">curl 命令预览</h2>
      <pre id="pg-curl" class="bg-gray-900 rounded-xl p-4 text-sm text-green-400 overflow-x-auto whitespace-pre-wrap"></pre>
    </div>
  </div>
  <script>
    function updateCurl(){
      const m=document.getElementById('pg-model').value,
            t=document.getElementById('pg-token').value,
            s=document.getElementById('pg-stream').checked,
            msg=document.getElementById('pg-message').value||'你好';
      const auth=t?'  -H "Authorization: Bearer '+t+'" \\\\\\n':'';
      document.getElementById('pg-curl').textContent=
        'curl http://localhost:${ENV.PORT}/v1/chat/completions \\\\\\n'+
        '  -H "Content-Type: application/json" \\\\\\n'+auth+
        '  -d \\'{"model":"'+m+'","messages":[{"role":"user","content":"'+msg.replace(/"/g,'\\\\\\"')+'"}],"stream":'+s+'}\\'';    }
    ['pg-model','pg-token','pg-stream','pg-message'].forEach(id=>{
      document.getElementById(id).addEventListener('input',updateCurl);
      document.getElementById(id).addEventListener('change',updateCurl);
    });
    updateCurl();
    async function sendReq(){
      const btn=document.getElementById('pg-btn'),
            out=document.getElementById('pg-out'),
            st=document.getElementById('pg-stat');
      const model=document.getElementById('pg-model').value,
            token=document.getElementById('pg-token').value,
            stream=document.getElementById('pg-stream').checked,
            msg=document.getElementById('pg-message').value;
      if(!msg.trim()){out.textContent='请输入消息内容';return;}
      btn.disabled=true; btn.textContent='请求中...'; out.textContent=''; st.textContent='';
      const t0=Date.now();
      const hdrs={'Content-Type':'application/json'};
      if(token) hdrs['Authorization']='Bearer '+token;
      try{
        const resp=await fetch('/v1/chat/completions',{method:'POST',headers:hdrs,body:JSON.stringify({model,messages:[{role:'user',content:msg}],stream})});
        const ms=Date.now()-t0;
        if(stream){
          const reader=resp.body.pipeThrough(new TextDecoderStream()).getReader();
          let buf='';
          while(true){
            const{done,value}=await reader.read(); if(done)break;
            buf+=value;
            const lines=buf.split('\\n'); buf=lines.pop()||'';
            for(const line of lines){
              if(line.startsWith('data: ')&&line!=='data: [DONE]'){
                try{const d=JSON.parse(line.slice(6));out.textContent+=(d.choices?.[0]?.delta?.content??'');}catch{}
              }
            }
          }
        }else{
          const d=await resp.json();
          out.textContent=d.choices?.[0]?.message?.content??JSON.stringify(d,null,2);
        }
        st.textContent=resp.status+' · '+ms+'ms';
        st.className='text-xs '+(resp.ok?'text-green-400':'text-red-400');
      }catch(e){out.textContent='错误: '+e.message;}
      finally{btn.disabled=false;btn.textContent='发送请求';}
    }
  </script>`);
}

// ============================================================
// 页面：部署
// ============================================================
function deployPage(): string {
  return layout("部署", "/deploy", `
  <div class="max-w-4xl mx-auto px-4 py-16">
    <h1 class="text-4xl font-bold mb-4">部署指南</h1>
    <p class="text-gray-400 mb-12">按照以下步骤在本地或服务器快速部署。</p>

    <section class="mb-12">
      <h2 class="text-2xl font-semibold mb-6 border-b border-gray-800 pb-3">🖥️ 本地运行</h2>
      <div class="space-y-4">
        <div class="card p-6"><h3 class="font-semibold mb-3">1. 安装 Deno 2.x</h3>
          <pre class="bg-gray-900 rounded-lg p-4 text-sm text-green-400">curl -fsSL https://deno.land/install.sh | sh</pre>
        </div>
        <div class="card p-6"><h3 class="font-semibold mb-3">2. 配置环境变量</h3>
          <pre class="bg-gray-900 rounded-lg p-4 text-sm text-yellow-400">cp .env.example .env
# 编辑 .env，至少填入 TABBIT_TOKEN</pre>
        </div>
        <div class="card p-6"><h3 class="font-semibold mb-3">3. 启动服务</h3>
          <pre class="bg-gray-900 rounded-lg p-4 text-sm text-green-400">deno run \\
  --env-file=.env \\
  --allow-net \\
  --allow-env \\
  --allow-read \\
  tabbitbrowser.ts</pre>
        </div>
      </div>
    </section>

    <section class="mb-12">
      <h2 class="text-2xl font-semibold mb-6 border-b border-gray-800 pb-3">🔑 获取 Tabbit 凭据</h2>
      <div class="card p-6">
        <ol class="space-y-3 text-sm text-gray-300 list-none">
          <li class="flex gap-3"><span class="text-indigo-400 font-bold shrink-0">1.</span>打开 <span class="text-indigo-400">web.tabbitbrowser.com</span> 并登录账户</li>
          <li class="flex gap-3"><span class="text-indigo-400 font-bold shrink-0">2.</span>打开浏览器开发者工具（F12）→ Application → Cookies</li>
          <li class="flex gap-3"><span class="text-indigo-400 font-bold shrink-0">3.</span>复制 <code class="bg-gray-800 px-1 rounded">token</code> 值 → <code class="bg-gray-800 px-1 rounded">TABBIT_TOKEN</code></li>
          <li class="flex gap-3"><span class="text-indigo-400 font-bold shrink-0">4.</span>（可选）复制 <code class="bg-gray-800 px-1 rounded">next-auth.session-token</code> → <code class="bg-gray-800 px-1 rounded">TABBIT_SESSION</code></li>
          <li class="flex gap-3"><span class="text-indigo-400 font-bold shrink-0">5.</span>Token 约 7 天过期，届时重新获取即可</li>
        </ol>
      </div>
    </section>

    <section class="mb-12">
      <h2 class="text-2xl font-semibold mb-6 border-b border-gray-800 pb-3">🔗 SDK 接入示例</h2>
      <div class="space-y-4">
        <div class="card p-6"><h3 class="font-semibold mb-3 text-gray-300">Python</h3>
          <pre class="bg-gray-900 rounded-lg p-4 text-sm text-green-400 overflow-x-auto">from openai import OpenAI
client = OpenAI(base_url="http://localhost:${ENV.PORT}/v1", api_key="your-key")
resp = client.chat.completions.create(model="best", messages=[{"role":"user","content":"你好"}])
print(resp.choices[0].message.content)</pre>
        </div>
        <div class="card p-6"><h3 class="font-semibold mb-3 text-gray-300">JavaScript / Node.js</h3>
          <pre class="bg-gray-900 rounded-lg p-4 text-sm text-green-400 overflow-x-auto">import OpenAI from 'openai';
const client = new OpenAI({ baseURL: 'http://localhost:${ENV.PORT}/v1', apiKey: 'your-key' });
const resp = await client.chat.completions.create({ model: 'best', messages: [{ role: 'user', content: '你好' }] });
console.log(resp.choices[0].message.content);</pre>
        </div>
      </div>
    </section>
  </div>`);
}

// ============================================================
// 页面：控制台 Dashboard
// ============================================================
function dashboardPage(): string {
  const credSrc = JSON.stringify(ENV.TABBIT_TOKEN ? "环境变量" : "Bearer Token");
  const apiKeyEnabled = ENV.API_KEY ? "✅ 已启用" : "❌ 未启用";

  return layout("控制台", "/dashboard", `
  <div class="max-w-7xl mx-auto px-4 py-10">
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold">控制台</h1>
        <p class="text-gray-500 text-sm mt-1">实时监控 API 调用状态，每 10 秒自动刷新</p>
      </div>
      <div class="flex items-center gap-3">
        <span id="refresh-ts" class="text-xs text-gray-500"></span>
        <button onclick="load()" class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">刷新</button>
      </div>
    </div>

    <!-- 指标卡片 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
      ${[
        ["总请求数", "m0"],["成功请求", "m1"],["失败请求", "m2"],["成功率", "m3"],
        ["平均耗时", "m4"],["最快响应", "m5"],["最慢响应", "m6"],["流式/普通", "m7"],
      ].map(([label, id]) =>
        `<div class="card p-5"><p class="text-xs text-gray-500 mb-1">${label}</p><p id="${id}" class="text-2xl font-bold">—</p></div>`
      ).join("")}
    </div>

    <!-- 热门模型 + 系统信息 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      <div class="card p-6">
        <h3 class="font-semibold mb-4 text-gray-300">🤖 热门模型</h3>
        <div id="model-list" class="space-y-2 text-sm text-gray-400">—</div>
      </div>
      <div class="card p-6">
        <h3 class="font-semibold mb-4 text-gray-300">⚙️ 系统信息</h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-gray-500">服务端口</span><span class="font-mono text-gray-200">${ENV.PORT}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">凭据来源</span><span class="text-gray-200">${credSrc.replace(/"/g, "")}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">API_KEY 鉴权</span><span class="text-gray-200">${apiKeyEnabled}</span></div>
          <div class="flex justify-between"><span class="text-gray-500">启动时间</span><span id="start-t" class="font-mono text-gray-200">—</span></div>
          <div class="flex justify-between"><span class="text-gray-500">运行时长</span><span id="uptime" class="font-mono text-gray-200">—</span></div>
        </div>
      </div>
    </div>

    <!-- 图表 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="card p-6 md:col-span-2">
        <h3 class="font-semibold mb-4 text-gray-300">📈 请求耗时趋势</h3>
        <div id="echart" style="height:280px"></div>
      </div>
      <div class="card p-6">
        <h3 class="font-semibold mb-4 text-gray-300">🥧 请求状态分布</h3>
        <div style="height:280px;position:relative"><canvas id="piechart"></canvas></div>
      </div>
    </div>

    <!-- 最近请求 -->
    <div class="card overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-800">
        <h3 class="font-semibold text-gray-300">📋 最近请求（最多 10 条）</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-900/50"><tr>
            <th class="text-left px-4 py-3 text-gray-500 font-medium">时间</th>
            <th class="text-left px-4 py-3 text-gray-500 font-medium">方法</th>
            <th class="text-left px-4 py-3 text-gray-500 font-medium">路径</th>
            <th class="text-left px-4 py-3 text-gray-500 font-medium">状态</th>
            <th class="text-left px-4 py-3 text-gray-500 font-medium">耗时</th>
            <th class="text-left px-4 py-3 text-gray-500 font-medium">模型</th>
          </tr></thead>
          <tbody id="req-table" class="divide-y divide-gray-800/50">
            <tr><td colspan="6" class="px-4 py-8 text-center text-gray-600">加载中...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script src="${PROXY}/cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  <script src="${PROXY}/cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <script>
    // 初始化 ECharts 折线图
    const ec = echarts.init(document.getElementById('echart'), 'dark');
    ec.setOption({
      backgroundColor:'transparent',
      tooltip:{trigger:'axis'},
      grid:{left:50,right:20,top:20,bottom:30},
      xAxis:{type:'category',data:[],axisLine:{lineStyle:{color:'#374151'}},axisLabel:{color:'#6B7280',fontSize:11}},
      yAxis:{type:'value',name:'ms',axisLine:{show:false},splitLine:{lineStyle:{color:'#1F2937'}},axisLabel:{color:'#6B7280',fontSize:11}},
      series:[{name:'耗时(ms)',type:'line',smooth:true,data:[],
        lineStyle:{color:'#6366F1',width:2},
        areaStyle:{color:{type:'linear',x:0,y:0,x2:0,y2:1,colorStops:[{offset:0,color:'rgba(99,102,241,0.3)'},{offset:1,color:'rgba(99,102,241,0)'}]}},
        itemStyle:{color:'#6366F1'},symbol:'circle',symbolSize:5}]
    });

    // 初始化 Chart.js 环形图
    const pie = new Chart(document.getElementById('piechart').getContext('2d'),{
      type:'doughnut',
      data:{labels:['成功','失败'],datasets:[{data:[0,0],backgroundColor:['#22C55E','#EF4444'],borderWidth:0,hoverOffset:4}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#9CA3AF',font:{size:12}}}},cutout:'65%'}
    });

    window.addEventListener('resize', ()=>ec.resize());

    function s(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
    function uptime(iso){
      const sec=Math.floor((Date.now()-new Date(iso).getTime())/1000);
      const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
      return h?h+'h '+m+'m':m?m+'m '+s+'s':s+'s';
    }

    async function load(){
      try{
        const resp=await fetch('/api/metrics');
        if(!resp.ok)throw new Error('HTTP '+resp.status);
        const {metrics:m,requests,startTime}=await resp.json();
        document.getElementById('refresh-ts').textContent='更新于 '+new Date().toLocaleTimeString('zh-CN');
        if(!m){['m0','m1','m2','m3','m4','m5','m6','m7'].forEach(id=>s(id,'0'));return;}

        const avg=m.totalRequests>0?Math.round(m.totalLatency/m.totalRequests):0;
        const rate=m.totalRequests>0?((m.successRequests/m.totalRequests)*100).toFixed(1)+'%':'—';
        const minL=m.minLatency===null||m.minLatency===1e308?0:m.minLatency;
        s('m0',m.totalRequests); s('m1',m.successRequests); s('m2',m.failureRequests); s('m3',rate);
        s('m4',avg+'ms'); s('m5',minL+'ms'); s('m6',m.maxLatency+'ms');
        s('m7',m.streamRequests+' / '+m.nonStreamRequests);

        // 热门模型
        const entries=Object.entries(m.modelCounts||{}).sort((a,b)=>b[1]-a[1]).slice(0,5);
        document.getElementById('model-list').innerHTML=entries.length
          ?entries.map(([k,v])=>'<div class="flex justify-between"><span>'+k+'</span><span class="text-indigo-400 font-mono">'+v+'</span></div>').join('')
          :'<span class="text-gray-600">暂无数据</span>';

        s('start-t', new Date(startTime).toLocaleString('zh-CN'));
        s('uptime', uptime(startTime));

        // ECharts 数据（最近请求正序）
        const rev=[...requests].reverse();
        ec.setOption({
          xAxis:{data:rev.map(r=>new Date(r.time).toLocaleTimeString('zh-CN'))},
          series:[{data:rev.map(r=>r.latency)}]
        });

        // Chart.js
        pie.data.datasets[0].data=[m.successRequests,m.failureRequests];
        pie.update();

        // 请求表格
        document.getElementById('req-table').innerHTML=requests.length
          ?requests.map(r=>'<tr class="hover:bg-gray-900/30 transition-colors">'+
            '<td class="px-4 py-3 font-mono text-xs text-gray-400">'+new Date(r.time).toLocaleTimeString('zh-CN')+'</td>'+
            '<td class="px-4 py-3"><span class="px-2 py-0.5 bg-blue-900/40 text-blue-400 rounded text-xs">'+r.method+'</span></td>'+
            '<td class="px-4 py-3 font-mono text-xs text-gray-300">'+r.path+'</td>'+
            '<td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-xs '+(r.success?'bg-green-900/40 text-green-400':'bg-red-900/40 text-red-400')+'">'+r.status+'</span></td>'+
            '<td class="px-4 py-3 font-mono text-xs text-gray-300">'+r.latency+'ms</td>'+
            '<td class="px-4 py-3 text-xs text-gray-400">'+(r.model||'—')+'</td>'+
            '</tr>').join('')
          :'<tr><td colspan="6" class="px-4 py-8 text-center text-gray-600">暂无请求记录</td></tr>';
      }catch(e){console.error(e);}
    }

    load();
    setInterval(load, 10000);
  </script>`, "");
}

// ============================================================
// Web 服务适配层
// ============================================================
const clientsCache: Record<string, TabbitClient> = {};

interface ChatMessage {
  role: string;
  content: string;
}

function buildContent(messages: ChatMessage[]): string {
  if (messages.length === 1) return messages[0].content;
  return messages.map((m) => {
    const label = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "System";
    return `[${label}]: ${m.content}`;
  }).join("\n\n") + "\n\n[Assistant]:";
}

Deno.serve({ port: ENV.PORT }, async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // ---- 页面路由 ----
  const pages: Record<string, () => string> = {
    "/": homePage,
    "/docs": docsPage,
    "/playground": playgroundPage,
    "/deploy": deployPage,
    "/dashboard": dashboardPage,
  };
  if (req.method === "GET" && pages[path]) {
    incrementPageViews(path).catch(() => {});
    return new Response(pages[path](), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // ---- GET /api/pageviews ----
  if (req.method === "GET" && path === "/api/pageviews") {
    try {
      const [totalEntry, ...pageEntries] = await Promise.all([
        kv.get<number>(["pageviews", "total"]),
        ...Object.keys({ "/": 1, "/docs": 1, "/playground": 1, "/deploy": 1, "/dashboard": 1 })
          .map((p) => kv.get<number>(["pageviews", "page", p])),
      ]);
      const pages_count: Record<string, number> = {};
      const pageKeys = ["/", "/docs", "/playground", "/deploy", "/dashboard"];
      pageEntries.forEach((e: { value: number | null }, i: number) => { pages_count[pageKeys[i]] = e.value ?? 0; });
      return Response.json({ total: totalEntry.value ?? 0, pages: pages_count });
    } catch {
      return Response.json({ total: 0, pages: {} });
    }
  }

  // ---- GET /api/metrics ----
  if (req.method === "GET" && path === "/api/metrics") {
    try {
      return Response.json(await getMetricsData());
    } catch (e) {
      logger("ERROR", `getMetricsData: ${e}`);
      return Response.json({ metrics: null, requests: [], startTime: DEPLOY_TIME, pageviews: 0 });
    }
  }

  // ---- GET /v1/models ----
  if (req.method === "GET" && path === "/v1/models") {
    return Response.json({
      object: "list",
      data: Object.keys(MODEL_MAP).map((k) => ({
        id: k, object: "model", owned_by: "tabbit",
      })),
    });
  }

  // ---- POST /v1/chat/completions ----
  if (req.method === "POST" && path === "/v1/chat/completions") {
    const t0 = Date.now();
    let reqModel = "best";
    let isStream = false;

    try {
      const bearer = (req.headers.get("authorization") ?? "")
        .replace(/^Bearer\s+/i, "").trim();

      // 鉴权逻辑：
      //   场景 A（设置了 API_KEY）：Bearer 用于本地服务鉴权，Tabbit 凭据取自环境变量
      //   场景 B（未设置 API_KEY）：Bearer 直接作为 Tabbit token 字符串，或回退到环境变量
      let tabbitTokenStr: string;
      if (ENV.API_KEY) {
        if (bearer !== ENV.API_KEY) {
          await recordRequest({ time: new Date().toISOString(), method: "POST", path, status: 401, latency: Date.now() - t0, model: "", stream: false, success: false });
          return new Response("Unauthorized", { status: 401 });
        }
        tabbitTokenStr = DEFAULT_TABBIT_TOKEN;
      } else {
        tabbitTokenStr = bearer || DEFAULT_TABBIT_TOKEN;
      }

      if (!tabbitTokenStr) {
        await recordRequest({ time: new Date().toISOString(), method: "POST", path, status: 401, latency: Date.now() - t0, model: "", stream: false, success: false });
        return new Response(
          "Unauthorized: No credentials. Set TABBIT_TOKEN env var or pass Bearer token.",
          { status: 401 },
        );
      }

      if (!clientsCache[tabbitTokenStr]) {
        clientsCache[tabbitTokenStr] = new TabbitClient(tabbitTokenStr);
      }
      const client = clientsCache[tabbitTokenStr];

      const body = await req.json();
      reqModel = body.model || "best";
      const tabbitModel = MODEL_MAP[reqModel.toLowerCase()] || "最佳";
      isStream = body.stream === true;
      const content = buildContent(body.messages || []);

      const sessionId = await client.create_chat_session();
      const completionId = `chatcmpl-${crypto.randomUUID().replace(/-/g, "")}`;

      if (isStream) {
        const stream = new ReadableStream({
          async start(controller) {
            const enc = new TextEncoder();
            const send = (s: string) => controller.enqueue(enc.encode(s));

            send(`data: ${JSON.stringify({ id: completionId, object: "chat.completion.chunk", choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }] })}\n\n`);

            let ok = true;
            try {
              for await (const ev of client.send_message(sessionId, content, tabbitModel)) {
                const { event: et, data: ed } = ev;
                if (et === "message_chunk" && ed.content !== undefined) {
                  send(`data: ${JSON.stringify({ id: completionId, object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: ed.content }, finish_reason: null }] })}\n\n`);
                } else if (et === "message_finish" || et === "finish") {
                  send(`data: ${JSON.stringify({ id: completionId, object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`);
                }
              }
            } catch (err: unknown) {
              ok = false;
              logger("ERROR", (err as Error).message);
            } finally {
              send("data: [DONE]\n\n");
              controller.close();
              // 流式结束后异步记录（不阻塞响应流）
              recordRequest({ time: new Date().toISOString(), method: "POST", path, status: 200, latency: Date.now() - t0, model: reqModel, stream: true, success: ok }).catch(() => {});
            }
          },
        });
        return new Response(stream, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
        });
      } else {
        let fullText = "";
        for await (const ev of client.send_message(sessionId, content, tabbitModel)) {
          if (ev.event === "message_chunk" && ev.data.content) fullText += ev.data.content;
        }
        await recordRequest({ time: new Date().toISOString(), method: "POST", path, status: 200, latency: Date.now() - t0, model: reqModel, stream: false, success: true });
        return Response.json({
          id: completionId, object: "chat.completion",
          created: Math.floor(Date.now() / 1000), model: reqModel,
          choices: [{ index: 0, message: { role: "assistant", content: fullText }, finish_reason: "stop" }],
        });
      }
    } catch (error: unknown) {
      const latency = Date.now() - t0;
      logger("ERROR", (error as Error).message);
      recordRequest({ time: new Date().toISOString(), method: "POST", path, status: 502, latency, model: reqModel, stream: isStream, success: false }).catch(() => {});
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 502, headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Not Found", { status: 404 });
});

logger("INFO", `Server      : http://0.0.0.0:${ENV.PORT}`);
logger("INFO", `Dashboard   : http://localhost:${ENV.PORT}/dashboard`);
logger("INFO", `Credentials : ${ENV.TABBIT_TOKEN ? "env vars" : "Bearer token"}`);
if (ENV.API_KEY) logger("INFO", "API_KEY auth: enabled");
