import { useEffect, useRef } from 'react';
import { marked, type Tokens } from 'marked';
import DOMPurify from 'dompurify';

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

function decodeHtmlEntities(html: string): string {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function hasBoxDrawing(text: string): boolean {
  return /[\u2500-\u257F\u2580-\u259F]/.test(text);
}

class CustomRenderer extends marked.Renderer {
  heading(token: Tokens.Heading): string {
    const text = this.parser.parseInline(token.tokens);
    return `<h${token.depth}>${text}</h${token.depth}>`;
  }

  paragraph(token: Tokens.Paragraph): string {
    const text = this.parser.parseInline(token.tokens);
    return `<p>${text}</p>`;
  }

  strong(token: Tokens.Strong): string {
    return `<strong>${token.text}</strong>`;
  }

  em(token: Tokens.Em): string {
    return `<em>${token.text}</em>`;
  }

  del(token: Tokens.Del): string {
    return `<del>${token.text}</del>`;
  }

  list(token: Tokens.List): string {
    const tag = token.ordered ? 'ol' : 'ul';
    const itemsHtml = token.items
      .map((item) => {
        const itemText = this.parser.parseInline(item.tokens);
        return `<li>${itemText}</li>`;
      })
      .join('');
    return `<${tag}>${itemsHtml}</${tag}>`;
  }

  blockquote(token: Tokens.Blockquote): string {
    const text = this.parser.parse(token.tokens);
    return `<blockquote>${text}</blockquote>`;
  }

  hr(): string {
    return `<hr />`;
  }

  link(token: Tokens.Link): string {
    return `<a href="${token.href}" target="_blank" rel="noopener noreferrer">${token.text}</a>`;
  }

  table(token: Tokens.Table): string {
    const headerHtml = token.header
      .map((cell) => {
        const cellText = this.parser.parseInline(cell.tokens);
        return `<th>${cellText}</th>`;
      })
      .join('');

    const rowsHtml = token.rows
      .map((row) => {
        const cellsHtml = row
          .map((cell) => {
            const cellText = this.parser.parseInline(cell.tokens);
            return `<td>${cellText}</td>`;
          })
          .join('');
        return `<tr>${cellsHtml}</tr>`;
      })
      .join('');

    return `<div class="md-table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
  }

  code(token: Tokens.Code): string {
    const language = token.lang || '';
    const code = escapeHtml(token.text);
    const isDiagram = !language && hasBoxDrawing(token.text);
    const label = isDiagram ? '图表' : language || '代码';

    return `
      <div class="md-code-block">
        <div class="md-code-header"><span>${label}</span><button class="md-copy-btn" data-code="${code}">复制</button></div>
        <pre><code>${code}</code></pre>
      </div>
    `;
  }

  codespan(token: Tokens.Codespan): string {
    return `<code>${token.text}</code>`;
  }
}

marked.use({
  gfm: true,
  breaks: true,
  renderer: new CustomRenderer(),
});

const ALLOWED_TAGS = [
  'div', 'span', 'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'del', 'a', 'ul', 'ol', 'li', 'blockquote', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'pre', 'code', 'button',
];

const ALLOWED_ATTR = ['class', 'href', 'target', 'rel', 'data-code'];

function MarkdownRendererInner({ content }: { content: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.md-copy-btn') as HTMLButtonElement | null;
      if (!btn) return;

      const code = btn.getAttribute('data-code');
      if (!code) return;

      navigator.clipboard.writeText(decodeHtmlEntities(code)).then(() => {
        const original = btn.textContent || '复制';
        btn.textContent = '已复制';
        setTimeout(() => {
          btn.textContent = original;
        }, 1500);
      });
    };

    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, []);

  const rawHtml = marked.parse(content, { async: false }) as string;
  const html = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });

  return (
    <div
      ref={containerRef}
      className="markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return <MarkdownRendererInner content={content} />;
}
