import { describe, it, expect } from 'vitest';
import { searchBing } from './search.js';

describe('searchBing (服务端爬虫)', () => {
  it('应能搜索并返回英文结果', async () => {
    const results = await searchBing('TypeScript');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    // 验证结果结构
    const r = results[0];
    expect(r).toHaveProperty('title');
    expect(r).toHaveProperty('snippet');
    expect(r).toHaveProperty('url');
    expect(typeof r.title).toBe('string');
    expect(typeof r.url).toBe('string');
    expect(r.title.length).toBeGreaterThan(0);
  }, 15000);

  it('应能正确处理中文搜索词', async () => {
    const results = await searchBing('人工智能');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    const r = results[0];
    expect(r).toHaveProperty('title');
    expect(r).toHaveProperty('url');
  }, 15000);

  it('应返回最多 8 条结果', async () => {
    const results = await searchBing('JavaScript');
    expect(results.length).toBeLessThanOrEqual(8);
  }, 15000);

  it('应包含有效 URL', async () => {
    const results = await searchBing('Node.js');
    for (const r of results) {
      expect(r.url).toMatch(/^https?:\/\//);
    }
  }, 15000);
});
