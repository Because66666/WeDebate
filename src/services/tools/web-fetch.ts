import type { Tool } from '../../types';

interface FetchPageResponse {
  url: string;
  title: string;
  content: string;
  error?: string;
}

export async function fetchWebPageContent(url: string): Promise<{ title: string; content: string }> {
  const apiUrl = `/api/fetch-page?url=${encodeURIComponent(url)}`;

  const response = await fetch(apiUrl);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.error || `网页抓取失败: HTTP ${response.status}`,
    );
  }

  const data: FetchPageResponse = await response.json();
  return { title: data.title || '', content: data.content || '页面内容为空' };
}

export const webFetchTool: Tool = {
  name: 'web_fetch',
  description:
    '获取网页的完整正文内容。当搜索结果的摘要信息不足以回答问题时，使用此工具访问相关网页获取详细信息。你应该在搜索后对重要结果使用此工具以获得更准确、更全面的答案。',
  parameters: {
    url: {
      type: 'string',
      description: '要访问的网页 URL，必须以 http:// 或 https:// 开头',
    },
  },
  execute: async (args: Record<string, unknown>) => {
    const url = String(args.url || '');
    if (!url.trim()) {
      return '请提供要访问的网页 URL。';
    }
    try {
      const { title, content } = await fetchWebPageContent(url);
      return `## 网页内容: ${url}\n**网页标题**: ${title}\n\n${content}`;
    } catch (error) {
      return `网页抓取失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
