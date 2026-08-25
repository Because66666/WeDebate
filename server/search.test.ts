import { describe, it, expect } from 'vitest';
import { searchBaidu, searchBing, searchWeb } from './search.js';

describe('searchBaidu (服务端爬虫·主引擎)', () => {
  // 注：直连百度的集成测试受 IP 风控影响（高频请求会触发图形验证码），
  // 遇风控时跳过而非失败；风控不影响线上服务，searchWeb 会自动回退 Bing。
  it('应能搜索并返回中文结果', async (ctx) => {
    let results: Awaited<ReturnType<typeof searchBaidu>>;
    try {
      results = await searchBaidu('人工智能 发展现状');
    } catch (error) {
      if (error instanceof Error && error.message.includes('风控')) ctx.skip();
      throw error;
    }
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    const r = results[0];
    expect(r).toHaveProperty('title');
    expect(r).toHaveProperty('snippet');
    expect(r).toHaveProperty('url');
    expect(r.title.length).toBeGreaterThan(0);
  }, 15000);

  it('应过滤广告链接', async (ctx) => {
    let results: Awaited<ReturnType<typeof searchBaidu>>;
    try {
      results = await searchBaidu('人工智能');
    } catch (error) {
      if (error instanceof Error && error.message.includes('风控')) ctx.skip();
      throw error;
    }
    for (const r of results) {
      expect(r.url).not.toContain('baidu.php?url=');
    }
  }, 15000);
});

describe('searchBing (服务端爬虫·回退引擎)', () => {
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

  it('应返回最多 8 条结果', async () => {
    const results = await searchBing('JavaScript');
    expect(results.length).toBeLessThanOrEqual(8);
  }, 15000);

  it('标题不应混入 URL 文本（h2 a 解析）', async () => {
    const results = await searchBing('Node.js');
    for (const r of results) {
      expect(r.title).not.toMatch(/^https?:\/\//);
      expect(r.title).not.toContain('›');
    }
  }, 15000);
});

describe('searchWeb (统一入口)', () => {
  it('应能返回中文搜索结果', async () => {
    const results = await searchWeb('人工智能 发展现状');
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.url).toMatch(/^https?:\/\//);
      expect(r.title.length).toBeGreaterThan(0);
    }
  }, 20000);

  it('应返回最多 8 条结果', async () => {
    const results = await searchWeb('气候变化');
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(8);
  }, 20000);
});
