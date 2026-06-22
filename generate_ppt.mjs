import pptxgen from "pptxgenjs";

const prs = new pptxgen();
const pptx = prs;
pptx.layout = "LAYOUT_WIDE";
pptx.author = "DynaTwin-Swarm";
pptx.company = "Guizhou University";
pptx.subject = "贵州省人工智能创业大赛路演PPT";
pptx.title = "DynaTwin-Swarm路演PPT";
pptx.lang = "zh-CN";
pptx.theme = {
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  lang: "zh-CN",
};
pptx.margin = 0;

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const C = {
  bg: "040E24",
  bg2: "071936",
  card: "0A1F3D",
  card2: "0E2B54",
  accent: "00D4FF",
  purple: "7B61FF",
  success: "00FF88",
  warn: "FFB800",
  danger: "FF4444",
  text: "FFFFFF",
  muted: "8FB4D4",
  dim: "4F7397",
  line: "134A7A",
};

const S = pptx.ShapeType;
const FONT = "Arial";

function svgData(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function techSvg(color1 = "#00D4FF", color2 = "#7B61FF") {
  return svgData(`
  <svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900">
    <defs>
      <radialGradient id="g" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="${color1}" stop-opacity=".42"/>
        <stop offset=".42" stop-color="${color2}" stop-opacity=".18"/>
        <stop offset="1" stop-color="${color1}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="900" height="900" fill="none"/>
    <circle cx="450" cy="450" r="340" fill="url(#g)"/>
    <g fill="none" stroke="${color1}" stroke-width="2" opacity=".45">
      <circle cx="450" cy="450" r="110"/>
      <circle cx="450" cy="450" r="190"/>
      <circle cx="450" cy="450" r="275"/>
      <path d="M450 120 L450 780 M120 450 L780 450 M220 220 L680 680 M680 220 L220 680"/>
    </g>
    <g fill="${color1}" opacity=".85">
      <circle cx="450" cy="120" r="8"/><circle cx="780" cy="450" r="8"/><circle cx="450" cy="780" r="8"/><circle cx="120" cy="450" r="8"/>
      <circle cx="680" cy="220" r="7"/><circle cx="680" cy="680" r="7"/><circle cx="220" cy="680" r="7"/><circle cx="220" cy="220" r="7"/>
    </g>
  </svg>`);
}

function addBg(slide, variant = "normal") {
  slide.background = { color: C.bg };
  slide.addShape(S.rect, { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, fill: { color: C.bg }, line: { transparency: 100 } });
  slide.addShape(S.ellipse, { x: 0.02, y: 0.03, w: 3.45, h: 3.45, fill: { color: C.accent, transparency: 88 }, line: { transparency: 100 } });
  slide.addShape(S.ellipse, { x: 9.75, y: 0.1, w: 3.2, h: 3.2, fill: { color: C.purple, transparency: 88 }, line: { transparency: 100 } });
  slide.addShape(S.ellipse, { x: 5.55, y: 5.18, w: 3.7, h: 2.15, fill: { color: variant === "danger" ? C.danger : C.accent, transparency: 92 }, line: { transparency: 100 } });
  for (let x = 0.35; x < SLIDE_W; x += 0.72) {
    slide.addShape(S.line, { x, y: 0.2, w: 0, h: 7.05, line: { color: C.line, transparency: 84, width: 0.35 } });
  }
  for (let y = 0.35; y < SLIDE_H; y += 0.72) {
    slide.addShape(S.line, { x: 0.2, y, w: 12.9, h: 0, line: { color: C.line, transparency: 86, width: 0.35 } });
  }
}

function text(slide, str, x, y, w, h, opt = {}) {
  slide.addText(str, {
    x, y, w, h,
    fontFace: FONT,
    fontSize: opt.size ?? 16,
    bold: opt.bold ?? false,
    color: opt.color ?? C.text,
    margin: opt.margin ?? 0,
    breakLine: false,
    fit: "shrink",
    valign: opt.valign ?? "top",
    align: opt.align ?? "left",
    paraSpaceAfterPt: opt.spaceAfter ?? 0,
    breakLine: opt.breakLine ?? false,
  });
}

function tag(slide, str, x, y, w, color = C.accent) {
  slide.addShape(S.roundRect, { x, y, w, h: 0.34, rectRadius: 0.06, fill: { color: "06284A", transparency: 8 }, line: { color, transparency: 10, width: 1 } });
  text(slide, str, x + 0.08, y + 0.07, w - 0.16, 0.16, { size: 8.8, bold: true, color, align: "center" });
}

function title(slide, str, page, subtitle = "") {
  text(slide, str, 0.56, 0.38, 9.6, 0.54, { size: 36, bold: true, color: C.text });
  if (subtitle) text(slide, subtitle, 0.58, 0.98, 8.5, 0.25, { size: 10.5, color: C.muted });
  slide.addShape(S.line, { x: 0.56, y: 1.26, w: 12.15, h: 0, line: { color: C.accent, transparency: 20, width: 1.2 } });
  text(slide, String(page).padStart(2, "0"), 12.05, 0.43, 0.62, 0.24, { size: 14, bold: true, color: C.accent, align: "right" });
}

function footer(slide, page) {
  slide.addShape(S.line, { x: 0.58, y: 7.03, w: 12.15, h: 0, line: { color: C.line, transparency: 70, width: 0.6 } });
  text(slide, "DynaTwin-Swarm · Guizhou University", 0.6, 7.12, 5.2, 0.18, { size: 8.5, color: C.dim });
  text(slide, `${String(page).padStart(2, "0")} / 15`, 12.0, 7.12, 0.7, 0.18, { size: 8.5, color: C.dim, align: "right" });
}

function card(slide, x, y, w, h, opts = {}) {
  slide.addShape(S.roundRect, {
    x, y, w, h,
    rectRadius: 0.07,
    fill: { color: opts.fill ?? C.card, transparency: opts.transparency ?? 8 },
    line: { color: opts.line ?? C.accent, transparency: opts.lineTransparency ?? 34, width: opts.lineWidth ?? 1.2, dash: opts.dash },
    shadow: opts.shadow ? { type: "outer", color: "000000", opacity: 0.26, blur: 1, angle: 45, distance: 2 } : undefined,
  });
  if (opts.accentBar) {
    slide.addShape(S.rect, { x, y, w: 0.05, h, fill: { color: opts.accentBar }, line: { transparency: 100 } });
  }
}

function bulletLines(slide, lines, x, y, w, h, opt = {}) {
  const paragraphs = lines.map((line) => ({
    text: line,
    options: {
      bullet: opt.bullet ?? false,
      hanging: opt.bullet ? 3 : 0,
      fontFace: FONT,
      fontSize: opt.size ?? 15,
      color: opt.color ?? C.text,
      breakLine: true,
      paraSpaceAfterPt: opt.gap ?? 7,
    },
  }));
  slide.addText(paragraphs, { x, y, w, h, margin: 0, fit: "shrink" });
}

function iconCard(slide, x, y, w, h, icon, head, body, color) {
  card(slide, x, y, w, h, { line: color, accentBar: color, shadow: true });
  slide.addShape(S.roundRect, { x: x + 0.23, y: y + 0.25, w: 0.62, h: 0.62, rectRadius: 0.08, fill: { color, transparency: 18 }, line: { color, transparency: 30 } });
  text(slide, icon, x + 0.29, y + 0.34, 0.5, 0.28, { size: 21, bold: true, color, align: "center" });
  text(slide, head, x + 0.25, y + 1.05, w - 0.5, 0.36, { size: 21, bold: true, color });
  text(slide, body, x + 0.25, y + 1.56, w - 0.5, h - 1.85, { size: 15, color: C.text });
}

function kpiCard(slide, x, y, w, h, num, label, color) {
  card(slide, x, y, w, h, { line: color, shadow: true });
  text(slide, num, x + 0.12, y + 0.25, w - 0.24, 0.72, { size: 60, bold: true, color, align: "center" });
  text(slide, label, x + 0.18, y + 1.15, w - 0.36, 0.28, { size: 14, color: C.muted, align: "center" });
}

function arrow(slide, x, y, w, h, color = C.accent, direction = "right") {
  slide.addShape(direction === "down" ? S.downArrow : S.rightArrow, {
    x, y, w, h,
    fill: { color, transparency: 8 },
    line: { color, transparency: 30, width: 0.8 },
  });
}

function architectureLayer(slide, x, y, w, color, label, desc) {
  slide.addShape(S.roundRect, { x, y, w, h: 0.82, rectRadius: 0.08, fill: { color, transparency: 8 }, line: { color, transparency: 8, width: 1.2 } });
  text(slide, label, x + 0.25, y + 0.18, 2.0, 0.28, { size: 17, bold: true, color: C.text });
  text(slide, desc, x + 2.2, y + 0.2, w - 2.45, 0.24, { size: 15, bold: true, color: C.text });
}

function miniTopology(slide, x, y, name, color, type) {
  card(slide, x, y, 1.85, 1.18, { line: color, transparency: 16 });
  text(slide, name, x + 0.1, y + 0.1, 1.65, 0.18, { size: 8.5, bold: true, color: C.text, align: "center" });
  const pts = {
    chain: [[0.35, 0.72], [0.85, 0.72], [1.35, 0.72]],
    fusion: [[0.35, 0.55], [1.35, 0.55], [0.85, 0.88]],
    tree: [[0.85, 0.45], [0.45, 0.86], [0.85, 0.86], [1.25, 0.86]],
    mesh: [[0.48, 0.52], [1.25, 0.52], [0.48, 0.9], [1.25, 0.9]],
    risk: [[0.35, 0.55], [0.85, 0.55], [1.35, 0.55], [0.85, 0.9]],
  }[type];
  for (let i = 0; i < pts.length - 1; i++) {
    slide.addShape(S.line, { x: x + pts[i][0] + 0.04, y: y + pts[i][1] + 0.04, w: pts[i + 1][0] - pts[i][0], h: pts[i + 1][1] - pts[i][1], line: { color, transparency: 25, width: 1.0 } });
  }
  if (type === "mesh") {
    slide.addShape(S.line, { x: x + pts[0][0] + 0.04, y: y + pts[0][1] + 0.04, w: pts[3][0] - pts[0][0], h: pts[3][1] - pts[0][1], line: { color, transparency: 35, width: 0.8 } });
    slide.addShape(S.line, { x: x + pts[1][0] + 0.04, y: y + pts[1][1] + 0.04, w: pts[2][0] - pts[1][0], h: pts[2][1] - pts[1][1], line: { color, transparency: 35, width: 0.8 } });
  }
  pts.forEach(([px, py]) => {
    slide.addShape(S.ellipse, { x: x + px, y: y + py, w: 0.12, h: 0.12, fill: { color }, line: { transparency: 100 } });
  });
}

function placeholder(slide, x, y, w, h, textStr, color = C.accent) {
  card(slide, x, y, w, h, { fill: "06162F", transparency: 4, line: color, lineTransparency: 12, dash: "dash" });
  text(slide, textStr, x + 0.2, y + h / 2 - 0.18, w - 0.4, 0.3, { size: 18, color: C.muted, align: "center", bold: true });
}

function progressRow(slide, x, y, label, pct, color) {
  text(slide, label, x, y, 1.75, 0.18, { size: 13, color: C.text, bold: true });
  slide.addShape(S.roundRect, { x: x + 1.85, y: y + 0.035, w: 2.65, h: 0.12, rectRadius: 0.03, fill: { color: "17385F" }, line: { transparency: 100 } });
  slide.addShape(S.roundRect, { x: x + 1.85, y: y + 0.035, w: 2.65 * pct / 100, h: 0.12, rectRadius: 0.03, fill: { color }, line: { transparency: 100 } });
  text(slide, `${pct}%`, x + 4.65, y - 0.015, 0.55, 0.18, { size: 12, color, bold: true, align: "right" });
}

function addCover() {
  const slide = pptx.addSlide();
  addBg(slide);
  slide.addImage({ data: techSvg(), x: 8.25, y: 0.75, w: 4.35, h: 4.35, transparency: 4 });
  tag(slide, "2026贵州省人工智能创业大赛 · 昇腾AI创新赛题", 0.72, 0.78, 3.55);
  text(slide, "DynaTwin-Swarm", 0.72, 1.65, 6.85, 0.85, { size: 54, bold: true, color: C.accent });
  text(slide, "工业数字孪生智能排产系统", 0.78, 2.55, 5.8, 0.45, { size: 26, color: C.text, bold: true });
  slide.addShape(S.rect, { x: 0.78, y: 3.22, w: 4.25, h: 0.03, fill: { color: C.accent }, line: { transparency: 100 } });
  bulletLines(slide, [
    "📄 基于EMNLP 2025顶会论文工程化实现",
    "🔷 深度集成华为昇腾AI技术体系",
    "🏭 贵州磷化工/矿山工业场景适配",
  ], 0.82, 3.6, 6.8, 1.1, { size: 16, color: C.text, gap: 6 });
  text(slide, "贵州大学 · 网络与信息安全 · 王骏", 0.8, 6.55, 4.5, 0.22, { size: 11, color: C.muted });
  [2.8, 2.0, 1.15].forEach((r, i) => {
    slide.addShape(S.ellipse, {
      x: 9.05 + (2.8 - r) / 2, y: 1.52 + (2.8 - r) / 2, w: r, h: r,
      fill: { color: i === 1 ? C.purple : C.accent, transparency: 100 },
      line: { color: i === 1 ? C.purple : C.accent, transparency: 20 + i * 22, width: 2.2 },
    });
  });
  text(slide, "AI", 10.02, 2.48, 0.9, 0.42, { size: 38, color: C.text, bold: true, align: "center" });
}

function addToc() {
  const slide = pptx.addSlide(); addBg(slide); title(slide, "目录", 2, "六个章节构成完整路演叙事");
  const chapters = [["01", "问题背景"], ["02", "解决方案"], ["03", "核心技术"], ["04", "系统演示"], ["05", "数据验证"], ["06", "团队与规划"]];
  chapters.forEach(([num, name], i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.86 + col * 4.08, y = 1.72 + row * 2.04;
    card(slide, x, y, 3.45, 1.42, { line: i % 2 ? C.purple : C.accent, shadow: true });
    text(slide, num, x + 0.24, y + 0.22, 0.72, 0.36, { size: 22, bold: true, color: i % 2 ? C.purple : C.accent });
    text(slide, name, x + 0.24, y + 0.72, 2.5, 0.35, { size: 22, bold: true, color: C.text });
  });
  footer(slide, 2);
}

function addProblem() {
  const slide = pptx.addSlide(); addBg(slide); title(slide, "传统工厂调度的三大痛点", 2, "响应、经验、扰动是工业现场的核心瓶颈");
  iconCard(slide, 0.72, 1.65, 3.75, 3.25, "⏱", "响应迟滞", "设备故障后人工重排需数小时，每次停产损失数十万元", C.warn);
  iconCard(slide, 4.78, 1.65, 3.75, 3.25, "👤", "人工依赖", "调度经验难以沉淀复用，关键人员离职导致能力断层", C.danger);
  iconCard(slide, 8.84, 1.65, 3.75, 3.25, "⚡", "扰动处理弱", "紧急插单无法实时响应，订单延误率居高不下", C.warn);
  slide.addShape(S.roundRect, { x: 1.02, y: 5.55, w: 11.3, h: 0.55, rectRadius: 0.05, fill: { color: C.accent, transparency: 8 }, line: { transparency: 100 } });
  text(slide, "贵州磷化工年产值超800亿 · 智能调度渗透率不足5%", 1.2, 5.72, 10.9, 0.22, { size: 17, bold: true, color: C.bg, align: "center" });
  footer(slide, 2);
}

function addSolution() {
  const slide = pptx.addSlide(); addBg(slide); title(slide, "DynaTwin-Swarm · 秒级响应的AI调度系统", 3, "感知层 → 决策层 → 执行层的闭环智能调度");
  architectureLayer(slide, 0.95, 1.75, 7.35, C.accent, "感知层", "IoT传感器 + 数字孪生工厂");
  arrow(slide, 4.25, 2.65, 0.48, 0.5, C.accent, "down");
  architectureLayer(slide, 0.95, 3.22, 7.35, C.purple, "决策层", "11个AI智能体协作 + 动态拓扑选择");
  arrow(slide, 4.25, 4.12, 0.48, 0.5, C.purple, "down");
  architectureLayer(slide, 0.95, 4.7, 7.35, C.success, "执行层", "CP-SAT约束规划求解 + 甘特图可视化");
  kpiCard(slide, 8.85, 1.55, 3.35, 1.38, "3秒", "故障响应时间", C.accent);
  kpiCard(slide, 8.85, 3.15, 3.35, 1.38, "15%", "OEE最高提升", C.success);
  kpiCard(slide, 8.85, 4.75, 3.35, 1.38, "70%", "排产成本降低", C.purple);
  footer(slide, 3);
}

function addDynaSwarm() {
  const slide = pptx.addSlide(); addBg(slide); title(slide, "动态图结构自适应选择（DynaSwarm）", 4, "不同工厂状态选择不同Agent协作拓扑");
  const rows = [
    [{ text: "拓扑类型", options: { bold: true, color: C.bg, fill: C.accent } }, { text: "适用场景", options: { bold: true, color: C.bg, fill: C.accent } }, { text: "Agent数量", options: { bold: true, color: C.bg, fill: C.accent } }, { text: "特点", options: { bold: true, color: C.bg, fill: C.accent } }],
    ["串行链", "正常低负荷", "4个", "轻量快速"],
    ["并行汇聚", "中等复杂", "7个", "并行分析"],
    ["层级树", "多层任务", "8个", "分层协调"],
    ["全连接", "高复杂度", "10个", "充分协作"],
    ["高风险审查", "故障紧急", "11个", "多层审核"],
  ];
  slide.addTable(rows, {
    x: 0.72, y: 1.72, w: 6.25, h: 3.38,
    border: { type: "solid", color: "13547F", pt: 0.7 },
    color: C.text,
    fontFace: FONT,
    fontSize: 10.2,
    margin: 0.08,
    valign: "mid",
    align: "center",
    fill: { color: C.card },
    rowH: 0.55,
  });
  const topologies = [["串行链", "chain"], ["并行汇聚", "fusion"], ["层级树", "tree"], ["全连接", "mesh"], ["高风险审查", "risk"]];
  topologies.forEach(([name, type], i) => miniTopology(slide, 7.35 + (i % 2) * 2.25, 1.62 + Math.floor(i / 2) * 1.38, name, i === 4 ? C.danger : (i % 2 ? C.purple : C.accent), type));
  tag(slide, "来源：EMNLP 2025顶会论文 DynaSwarm · A2C强化学习优化", 3.3, 6.05, 6.75, C.accent);
  footer(slide, 4);
}

function addReflAct() {
  const slide = pptx.addSlide(); addBg(slide); title(slide, "ReflAct目标状态反射推理", 5, "观察 → 对齐 → 分析 → 动作，形成可解释可审计决策");
  const steps = [
    [C.accent, "①观察", "当前工厂状态"],
    [C.purple, "②对齐", "与生产目标对比"],
    [C.warn, "③分析", "偏差识别风险评估"],
    [C.success, "④动作", "输出可审计决策"],
  ];
  steps.forEach(([color, head, body], i) => {
    const x = 0.9 + i * 3.05;
    card(slide, x, 2.2, 2.38, 1.22, { line: color, shadow: true });
    text(slide, head, x + 0.2, 2.43, 1.96, 0.28, { size: 18, color, bold: true, align: "center" });
    text(slide, body, x + 0.2, 2.83, 1.96, 0.2, { size: 12.5, color: C.text, align: "center" });
    if (i < 3) arrow(slide, x + 2.43, 2.65, 0.48, 0.28, color);
  });
  card(slide, 0.95, 4.55, 5.38, 1.1, { line: C.accent, accentBar: C.accent });
  text(slide, "🤖 豆包大模型驱动推理 · 11个专业智能体分工协作", 1.25, 4.88, 4.78, 0.26, { size: 16, color: C.text, bold: true });
  card(slide, 7.0, 4.55, 5.38, 1.1, { line: C.purple, accentBar: C.purple });
  text(slide, "📄 来源EMNLP 2025 ReflAct论文 · 可解释可审计防幻觉", 7.3, 4.88, 4.78, 0.26, { size: 16, color: C.text, bold: true });
  footer(slide, 5);
}

function addHuawei() {
  const slide = pptx.addSlide(); addBg(slide); title(slide, "深度集成华为昇腾AI技术体系", 6, "全栈云服务与昇腾推理生态适配");
  const items = [
    ["盘古大模型", "备用推理引擎接口预留"], ["MindIE推理引擎", "NPU加速推理"], ["GaussDB", "历史调度知识库"],
    ["IoTDA", "工厂传感器接入"], ["EventGrid", "事件驱动实时触发"], ["FunctionGraph", "无服务器弹性计算"], ["ModelArts Studio", "模型部署管理"],
  ];
  items.forEach(([name, desc], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.9 + col * 5.9, y = 1.55 + row * 0.96;
    card(slide, x, y, 5.15, 0.72, { line: C.accent, transparency: 12 });
    slide.addShape(S.roundRect, { x: x + 0.12, y: y + 0.13, w: 0.44, h: 0.44, rectRadius: 0.05, fill: { color: C.accent, transparency: 10 }, line: { transparency: 100 } });
    text(slide, "◆", x + 0.19, y + 0.22, 0.28, 0.16, { size: 12, color: C.bg, bold: true, align: "center" });
    text(slide, name, x + 0.72, y + 0.13, 1.85, 0.2, { size: 13.5, color: C.text, bold: true });
    text(slide, desc, x + 2.5, y + 0.15, 2.25, 0.18, { size: 10.5, color: C.muted });
  });
  slide.addShape(S.rect, { x: 1.05, y: 6.12, w: 11.25, h: 0.46, fill: { color: "D61F2C" }, line: { transparency: 100 } });
  text(slide, "部署区域：西南-贵阳一 · 充分体现昇腾算力价值", 1.25, 6.27, 10.85, 0.18, { size: 14, color: C.text, bold: true, align: "center" });
  footer(slide, 6);
}

function addDemo() {
  const slide = pptx.addSlide(); addBg(slide); title(slide, "一屏掌控全局 · 工业数字孪生大屏", 7, "系统演示页预留真实Dashboard截图位置");
  placeholder(slide, 1.65, 1.5, 10.0, 4.5, "【请插入系统Dashboard全屏截图】", C.accent);
  ["3D工厂实时布局", "AI推理日志流", "排程甘特图", "订单队列"].forEach((label, i) => tag(slide, label, 1.75 + i * 2.55, 6.25, 2.05, C.accent));
  footer(slide, 7);
}

function addFaultDemo() {
  const slide = pptx.addSlide(); addBg(slide, "danger"); title(slide, "场景演示：设备故障秒级自动重排", 8, "故障前后状态对比，展示自动感知与重排流程");
  placeholder(slide, 0.72, 1.72, 5.05, 3.75, "【插入故障前截图：所有机器绿色正常运行，OEE 91%】", C.success);
  arrow(slide, 6.03, 2.98, 1.12, 0.52, C.danger);
  text(slide, "触发故障\n<3秒重排", 5.9, 3.55, 1.4, 0.5, { size: 16, color: C.danger, bold: true, align: "center" });
  placeholder(slide, 7.55, 1.72, 5.05, 3.75, "【插入故障后截图：红色故障机器+高风险审查拓扑+AI日志】", C.danger);
  footer(slide, 8);
}

function addRecovery() {
  const slide = pptx.addSlide(); addBg(slide); title(slide, "场景演示：机器自动恢复", 9, "恢复事件触发后重新纳入调度资源池");
  placeholder(slide, 0.9, 1.55, 7.55, 1.72, "【插入机器倒计时截图：显示预计XX分钟后自动恢复】", C.warn);
  arrow(slide, 4.3, 3.38, 0.45, 0.48, C.success, "down");
  placeholder(slide, 0.9, 4.0, 7.55, 1.72, "【插入恢复后截图：机器变绿+甘特图更新】", C.success);
  card(slide, 9.0, 1.55, 3.2, 4.17, { line: C.success, accentBar: C.success });
  bulletLines(slide, ["故障发生", "30-120分钟", "自动恢复", "AI重新纳入资源池", "排程优化"], 9.35, 2.0, 2.4, 2.8, { size: 17, color: C.text, bullet: true, gap: 9 });
  footer(slide, 9);
}

function cell(textValue, options = {}) {
  return { text: String(textValue), options: { fontFace: FONT, color: options.color ?? C.text, bold: options.bold ?? false, fill: options.fill, align: "center", valign: "mid" } };
}

function addData() {
  const slide = pptx.addSlide(); addBg(slide); title(slide, "5个国际标准数据集验证系统性能", 10, "Benchmark验证：公共数据集、最优值、差距与响应速度");
  const header = ["数据集", "作业数", "机器数", "本系统Makespan", "最优已知值", "差距"].map((h) => cell(h, { fill: C.accent, color: C.bg, bold: true }));
  const rows = [
    ["FT06", "6", "6", "67", "55", "21.8%"],
    ["LA40", "15", "15", "1307", "1222", "7.0%"],
    ["ABZ9", "20", "15", "873", "678", "28.8%"],
    ["SWV20", "50", "10", "2823", "1675", "68.5%"],
    ["DMU80", "50", "20", "9280", "暂无", "-"],
  ];
  const tableRows = [header, ...rows.map((r) => r.map((v, i) => cell(v, { fill: r[0] === "LA40" && i === 5 ? C.success : (rows.indexOf(r) % 2 ? "0D2A52" : C.card), color: r[0] === "LA40" && i === 5 ? C.bg : C.text, bold: i === 0 || (r[0] === "LA40" && i === 5) })))];
  slide.addTable(tableRows, { x: 0.72, y: 1.55, w: 11.9, h: 3.62, border: { type: "solid", color: "1B5B8F", pt: 0.7 }, fontFace: FONT, fontSize: 11, margin: 0.06, valign: "mid", align: "center", rowH: 0.48 });
  kpiCard(slide, 2.25, 5.55, 3.5, 1.1, "200ms内", "最大求解时间", C.accent);
  kpiCard(slide, 7.6, 5.55, 3.5, 1.1, "5个", "验证数据集", C.purple);
  footer(slide, 10);
}

function addA2C() {
  const slide = pptx.addSlide(); addBg(slide); title(slide, "A2C强化学习训练拓扑选择策略", 11, "训练拓扑选择概率，提升动态场景适应能力");
  placeholder(slide, 0.85, 1.58, 5.7, 3.65, "【插入A2C训练奖励曲线截图】", C.accent);
  card(slide, 7.15, 1.58, 4.95, 3.65, { line: C.purple, accentBar: C.purple });
  const probs = [["并行汇聚", 42, C.accent], ["高风险审查", 28, C.purple], ["串行链", 15, "3B82F6"], ["全连接", 10, C.warn], ["层级树", 5, "6B7280"]];
  probs.forEach(([label, pct, color], i) => progressRow(slide, 7.55, 2.0 + i * 0.47, label, pct, color));
  card(slide, 1.15, 5.75, 10.85, 0.62, { line: C.success });
  text(slide, "经过20轮训练，系统学会在高风险场景下自动切换高风险审查拓扑，相比固定拓扑策略降低排程延误", 1.38, 5.94, 10.35, 0.2, { size: 13.5, color: C.text, bold: true, align: "center" });
  footer(slide, 11);
}

function addScenarios() {
  const slide = pptx.addSlide(); addBg(slide); title(slide, "贵州重点工业场景深度适配", 12, "从磷化工、矿山到园区数字孪生的本地落地路径");
  const items = [
    ["🏭", "磷化工生产调度", "年产值800亿+ · 秒级重排降低停产损失", C.accent],
    ["⛏️", "非煤矿山作业", "高危环境 · 高风险审查拓扑保障安全", C.warn],
    ["🔧", "智能制造产线", "万企融合战略 · OEE提升5-15%", C.success],
    ["🏙️", "工业园区孪生", "IoT全链路 · 数据孤岛打通", C.purple],
  ];
  items.forEach(([icon, head, body, color], i) => {
    const x = 0.95 + (i % 2) * 5.95, y = 1.75 + Math.floor(i / 2) * 2.18;
    card(slide, x, y, 5.35, 1.72, { line: color, accentBar: color, shadow: true });
    text(slide, icon, x + 0.25, y + 0.34, 0.5, 0.35, { size: 24, color });
    text(slide, head, x + 0.88, y + 0.36, 3.8, 0.3, { size: 18, bold: true, color: C.text });
    text(slide, body, x + 0.88, y + 0.82, 3.9, 0.28, { size: 14, color: C.muted });
  });
  footer(slide, 12);
}

function addBusiness() {
  const slide = pptx.addSlide(); addBg(slide); title(slide, "可持续的商业化路径", 13, "由轻量SaaS切入，向行业平台和知识库授权演进");
  const stages = [
    [C.accent, "短期", "SaaS订阅\n中小制造企业\n按月收费"],
    [C.purple, "中期", "定制集成\n大型工业企业\n项目制交付"],
    [C.success, "长期", "数据智能\n行业平台\n知识库授权"],
  ];
  stages.forEach(([color, head, body], i) => {
    const x = 0.85 + i * 4.13;
    card(slide, x, 2.15, 3.35, 2.1, { line: color, shadow: true });
    text(slide, head, x + 0.24, 2.45, 1.0, 0.34, { size: 22, bold: true, color });
    text(slide, body, x + 0.26, 3.0, 2.55, 0.72, { size: 16, color: C.text, bold: true });
    if (i < 2) arrow(slide, x + 3.42, 3.0, 0.48, 0.32, color);
  });
  slide.addShape(S.roundRect, { x: 1.3, y: 5.35, w: 10.7, h: 0.6, rectRadius: 0.05, fill: { color: C.accent, transparency: 10 }, line: { transparency: 100 } });
  text(slide, "目标市场：贵州及西南地区制造业 · 市场规模超500亿", 1.5, 5.55, 10.3, 0.18, { size: 16, color: C.bg, bold: true, align: "center" });
  footer(slide, 13);
}

function addTeam() {
  const slide = pptx.addSlide(); addBg(slide); title(slide, "团队介绍", 14, "贵州大学网络与信息安全 · 工业AI与多智能体系统方向");
  card(slide, 1.35, 1.65, 10.7, 4.65, { line: C.accent, shadow: true });
  slide.addShape(S.ellipse, { x: 2.15, y: 2.65, w: 1.55, h: 1.55, fill: { color: C.accent, transparency: 16 }, line: { color: C.accent, width: 1.5 } });
  text(slide, "WJ", 2.45, 3.13, 0.95, 0.34, { size: 24, color: C.text, bold: true, align: "center" });
  text(slide, "王骏", 4.25, 2.05, 1.5, 0.38, { size: 28, color: C.text, bold: true });
  bulletLines(slide, [
    "贵州大学网络与信息安全专业硕士研究生",
    "指导教师：谭伟杰教授",
    "贵州省公共大数据重点实验室",
    "研究方向：IoT安全 · 多智能体系统 · 工业AI",
    "GitHub：github.com/wjhard/DynaTwin-Swarm",
  ], 4.25, 2.75, 6.6, 2.2, { size: 16, color: C.text, gap: 7 });
  footer(slide, 14);
}

function addSummary() {
  const slide = pptx.addSlide(); addBg(slide);
  text(slide, "核心价值总结", 0.72, 0.72, 5.2, 0.55, { size: 42, bold: true, color: C.text });
  const items = [
    [C.accent, "📄 顶会论文工程化落地", "EMNLP 2025两篇论文首次工业落地"],
    [C.purple, "🔷 华为昇腾全栈集成", "贵阳一区域算力深度对接"],
    [C.success, "🏭 贵州工业场景适配", "磷化工矿山落地方案"],
  ];
  items.forEach(([color, head, body], i) => {
    card(slide, 2.0, 1.75 + i * 1.28, 9.3, 0.9, { line: color, accentBar: color, shadow: true });
    text(slide, head, 2.32, 1.98 + i * 1.28, 3.8, 0.26, { size: 19, color, bold: true });
    text(slide, body, 6.25, 2.0 + i * 1.28, 4.35, 0.22, { size: 15, color: C.text, bold: true });
  });
  text(slide, "感谢评委老师 · 期待交流指导", 2.0, 5.76, 9.3, 0.38, { size: 28, color: C.text, bold: true, align: "center" });
  text(slide, "2330708544@qq.com · github.com/wjhard/DynaTwin-Swarm", 2.35, 6.35, 8.6, 0.22, { size: 13, color: C.muted, align: "center" });
  footer(slide, 15);
}

addCover();
addProblem();
addSolution();
addDynaSwarm();
addReflAct();
addHuawei();
addDemo();
addFaultDemo();
addRecovery();
addData();
addA2C();
addScenarios();
addBusiness();
addTeam();
addSummary();

await prs.writeFile({ fileName: "DynaTwin-Swarm路演PPT.pptx" });
console.log("生成完成: DynaTwin-Swarm路演PPT.pptx");
