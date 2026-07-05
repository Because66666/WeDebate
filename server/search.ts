/**
 * 搜索引擎服务端实现
 * 使用 Bing 搜索抓取结果，避免浏览器 CORS 限制
 */

import * as cheerio from 'cheerio';

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

/**
 * 搜索 Bing 并返回结构化的结果列表
 */
export async function searchBing(query: string): Promise<SearchResult[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
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
    const $link = $el.find('a').first();
    const href = $link.attr('href') || '';
    const title = $link.text().trim();

    if (!title && !href) return;

    const snippet = $el.find('p').first().text().trim();

    results.push({ title, snippet, url: href });
  });

  // 后备方案：如果 b_algo 未命中，提取所有外部链接
  if (results.length === 0) {
    const seenUrls = new Set<string>();
    $('a[href^="http"]').each((_i, el) => {
      const $link = $(el);
      const href = $link.attr('href') || '';
      const title = $link.text().trim();

      if (
        title &&
        href &&
        !href.includes('bing.com') &&
        !href.includes('go.microsoft.com') &&
        !seenUrls.has(href)
      ) {
        seenUrls.add(href);
        results.push({ title, snippet: '', url: href });
      }
    });
  }

  // 按 URL 去重
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
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
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
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
