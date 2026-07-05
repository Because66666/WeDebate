import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchDuckDuckGo, duckduckgoSearchTool } from './duckduckgo-search';

const mockResults = [
  { title: 'Result 1', snippet: 'Snippet 1', url: 'https://example.com/1' },
  { title: 'Result 2', snippet: 'Snippet 2', url: 'https://example.com/2' },
];

describe('searchDuckDuckGo (后端API)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('应调用 /api/search 并返回结果', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ query: 'test', results: mockResults }),
    });

    const results = await searchDuckDuckGo('test');
    expect(results).toEqual(mockResults);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/search?q=test');
  });

  it('API 返回错误时应抛出异常', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.resolve({ error: '上游搜索失败' }),
    });

    await expect(searchDuckDuckGo('error')).rejects.toThrow('上游搜索失败');
  });

  it('API 返回非 JSON 错误时也应处理', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(searchDuckDuckGo('fail')).rejects.toThrow('搜索失败: HTTP 500');
  });

  it('应正确处理中文搜索词', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ query: '人工智能', results: [] }),
    });

    const results = await searchDuckDuckGo('人工智能');
    expect(results).toEqual([]);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/search?q=%E4%BA%BA%E5%B7%A5%E6%99%BA%E8%83%BD');
  });
});

describe('duckduckgoSearchTool', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ query: 'test', results: mockResults }),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('应导出正确的工具定义', () => {
    expect(duckduckgoSearchTool).toHaveProperty('name', 'web_search');
    expect(duckduckgoSearchTool).toHaveProperty('description');
    expect(typeof duckduckgoSearchTool.description).toBe('string');
    expect(duckduckgoSearchTool).toHaveProperty('parameters');
    expect(duckduckgoSearchTool.parameters).toHaveProperty('query');
  });

  it('execute 应返回 Markdown 格式的搜索结果', async () => {
    const result = await duckduckgoSearchTool.execute({ query: 'test' });
    expect(result).toContain('## 搜索');
    expect(result).toContain('[Result 1](https://example.com/1)');
    expect(result).toContain('Snippet 1');
    expect(result.length).toBeGreaterThan(0);
  });

  it('空查询时应返回提示信息', async () => {
    const result = await duckduckgoSearchTool.execute({ query: '' });
    expect(result).toBe('请提供搜索关键词。');
    // 不应发起 API 请求
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('缺少 query 参数时应返回提示信息', async () => {
    const result = await duckduckgoSearchTool.execute({});
    expect(result).toBe('请提供搜索关键词。');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('API 调用失败时应返回错误提示而非抛出异常', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('网络错误'));
    const result = await duckduckgoSearchTool.execute({ query: 'fail' });
    expect(result).toContain('搜索失败');
    expect(result).toContain('网络错误');
  });

  it('返回的 Markdown 应包含有效的链接格式', async () => {
    const result = await duckduckgoSearchTool.execute({ query: 'test' });
    expect(result).toMatch(/\[.+\]\(.+\)/);
  });

  it('无结果时应返回 "未找到" 提示', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ query: 'nothing', results: [] }),
    });
    const result = await duckduckgoSearchTool.execute({ query: 'nothing' });
    expect(result).toContain('未找到相关结果');
  });
});
