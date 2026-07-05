import type { Tool } from '../../types';

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

interface SearchApiResponse {
  query: string;
  results: SearchResult[];
  error?: string;
}

/**
 * 通过后端 API 搜索互联网信息
 * 后端发起爬虫请求，避免浏览器 CORS 限制
 */
export async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const apiUrl = `/api/search?q=${encodeURIComponent(query)}`;

  const response = await fetch(apiUrl);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.error || `搜索失败: HTTP ${response.status}`,
    );
  }

  const data: SearchApiResponse = await response.json();
  return data.results || [];
}

/**
 * 将搜索结果格式化为 Markdown 字符串
 */
function formatResultsAsMarkdown(query: string, results: SearchResult[]): string {
  if (results.length === 0) {
    return `## 搜索: ${query}\n\n未找到相关结果。`;
  }

  let md = `## 搜索: ${query}\n\n`;
  for (const r of results) {
    const url = r.url || '#';
    md += `- **[${r.title}](${url})**\n`;
    md += `  ${r.snippet}\n\n`;
  }
  return md;
}

/**
 * Web 搜索工具定义
 */
export const duckduckgoSearchTool: Tool = {
  name: 'web_search',
  description:
    '搜索互联网信息。当你需要回答关于最新新闻、事实信息或需要联网获取内容时使用此工具。',
  parameters: {
    query: {
      type: 'string',
      description: '搜索查询关键词',
    },
  },
  execute: async (args: Record<string, unknown>) => {
    const query = String(args.query || '');
    if (!query.trim()) {
      return '请提供搜索关键词。';
    }
    try {
      const results = await searchDuckDuckGo(query);
      return formatResultsAsMarkdown(query, results);
    } catch (error) {
      return `搜索失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
