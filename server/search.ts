/**
 * 搜索引擎服务端实现
 * 主引擎：百度（中文相关性好，服务端可直连）
 * 回退引擎：Bing（对无 Cookie 的服务端请求常返回降级结果）
 */

import * as cheerio from 'cheerio';

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

/** 模拟浏览器的公共请求头（百度对 Accept 头敏感，单一 text/html 会返回无结果页面） */
const REQUEST_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

/** 单次请求超时（毫秒），防止上游挂起导致接口长时间等待 */
const FETCH_TIMEOUT_MS = 10_000;

/** 按 URL 去重 */
function dedupeByURL(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

/**
 * 搜索百度并返回结构化的结果列表（主引擎）
 */
export async function searchBaidu(query: string): Promise<SearchResult[]> {
  const url = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&rn=10`;

  const response = await fetch(url, {
    headers: { ...REQUEST_HEADERS, Referer: 'https://www.baidu.com/' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`百度搜索失败: HTTP ${response.status}`);
  }

  const html = await response.text();
  const results = parseBaiduHtml(html);
  if (results.length === 0) {
    throw new Error('百度搜索失败: 未能从结果页解析出任何条目（可能被风控）');
  }
  return results.slice(0, 8);
}

/**
 * 解析百度搜索结果 HTML（使用 cheerio）
 * 结果位于 div.c-container，标题在 h3 > a，真实 URL 优先取容器的 mu 属性
 * （a 标签的 href 多为 baidu.com/link 跳转，可被 fetch 自动跟随，但展示不友好）
 */
function parseBaiduHtml(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const $ = cheerio.load(html);

  $('div.c-container').each((_i, el) => {
    const $el = $(el);
    const $link = $el.find('h3 a').first();
    const title = $link.text().trim();
    const href = $link.attr('href') || '';

    // 过滤广告（baidu.php?url= 推广链接）与无效条目
    if (!title || !href || href.includes('baidu.php?url=')) return;

    const mu = $el.attr('mu') || '';
    const url = /^https?:\/\//.test(mu) && !mu.includes('fakeurl') ? mu : href;

    const snippet = $el
      .find('.c-abstract, [class*="abstract"], [class*="content-right"]')
      .first()
      .text()
      .trim();

    results.push({ title, snippet, url });
  });

  return dedupeByURL(results);
}

/**
 * 搜索 Bing 并返回结构化的结果列表（回退引擎）
 */
export async function searchBing(query: string): Promise<SearchResult[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Bing 搜索失败: HTTP ${response.status}`);
  }

  const html = await response.text();
  const results = parseBingHtml(html);
  return results.slice(0, 8);
}

/**
 * 解析 Bing 搜索结果 HTML（使用 cheerio）
 */
function parseBingHtml(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const $ = cheerio.load(html);

  // 提取 b_algo 区块（标准搜索结果）
  $('li.b_algo').each((_i, el) => {
    const $el = $(el);
    // 标题链接位于 h2 > a；直接取第一个 <a> 会命中含 URL 文本的错误锚点
    const $link = $el.find('h2 a').first();
    const href = $link.attr('href') || '';
    const title = $link.text().trim();

    if (!title && !href) return;

    const snippet = $el.find('.b_caption p').first().text().trim();

    results.push({ title, snippet, url: href });
  });

  // 后备方案：如果 b_algo 未命中，提取所有外部链接
  if (results.length === 0) {
    $('a[href^="http"]').each((_i, el) => {
      const $link = $(el);
      const href = $link.attr('href') || '';
      const title = $link.text().trim();

      if (
        title &&
        href &&
        !href.includes('bing.com') &&
        !href.includes('go.microsoft.com')
      ) {
        results.push({ title, snippet: '', url: href });
      }
    });
  }

  return dedupeByURL(results);
}

/**
 * 统一搜索入口：百度优先，失败或无结果时回退到 Bing
 */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  try {
    const results = await searchBaidu(query);
    if (results.length > 0) return results;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[search] 百度搜索失败，回退到 Bing: ${message}`);
  }
  return searchBing(query);
}

/**
 * 访问指定 URL 并提取页面的主要文本内容和标题
 */
export async function fetchWebPage(url: string): Promise<{ title: string; content: string }> {
  // 验证 URL 格式
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('无效的 URL，必须以 http:// 或 https:// 开头');
  }

  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`访问页面失败: HTTP ${response.status}`);
  }

  const html = await response.text();
  return extractMainContent(html);
}

/**
 * 从 HTML 中提取主要文本内容和标题（使用 cheerio）
 * 策略：优先 <article> → <main> → <body>，逐级降级
 */
function extractMainContent(html: string): { title: string; content: string } {
  const maxLength = 8000;
  const $ = cheerio.load(html);

  // 提取 <title> 文本
  const title = $('title').first().text().trim();

  // 移除无助于正文提取的元素
  $('script, style, nav, footer, header, aside, .sidebar, .nav, .footer, .header, .menu, .advertisement, .ad').remove();

  // 选择一个容器来提取文本
  let container: cheerio.Cheerio<any> | null = null;

  // 1. 优先 <article>
  if ($('article').length > 0) {
    container = $('article').first();
  }
  // 2. 尝试 <main>
  else if ($('main').length > 0) {
    container = $('main').first();
  }
  // 3. 尝试 [role="main"]
  else if ($('[role="main"]').length > 0) {
    container = $('[role="main"]').first();
  }
  // 4. 尝试 .post-content, .entry-content 等常见文章内容类名
  else if ($('.post-content, .entry-content, .article-content, .content').length > 0) {
    container = $('.post-content, .entry-content, .article-content, .content').first();
  }
  // 5. 最后用 <body>
  else {
    container = $('body');
  }

  let content = container ? container.text() : '';

  // 清理空白
  content = content
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 如果提取的内容太少（< 50 字符），降级到 <body>
  if (content.length < 50 && container && !container.is('body')) {
    content = $('body').text()
      .replace(/[\t ]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // 截断
  if (content.length > maxLength) {
    content = content.slice(0, maxLength) + '\n\n<文本过长，系统自动截断>';
  }

  return { title, content: content || '未能提取到页面内容' };
}
