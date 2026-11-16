import type { ReactNode } from 'react';

function renderInlineFormatting(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-navy">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-primary-light/60 font-mono text-[0.9em] text-navy"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{token}</span>;
  });
}

export function FormattedAiText({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let listItems: { ordered: boolean; content: string }[] = [];

  const flushList = (keyPrefix: string) => {
    if (listItems.length === 0) return;
    const isOrdered = listItems[0].ordered;
    if (isOrdered) {
      blocks.push(
        <ol
          key={keyPrefix}
          className="list-decimal pl-5 space-y-1.5 text-sm sm:text-[15px] leading-relaxed"
        >
          {listItems.map((item, i) => (
            <li key={i}>{renderInlineFormatting(item.content)}</li>
          ))}
        </ol>,
      );
    } else {
      blocks.push(
        <ul
          key={keyPrefix}
          className="list-disc pl-5 space-y-1.5 text-sm sm:text-[15px] leading-relaxed"
        >
          {listItems.map((item, i) => (
            <li key={i}>{renderInlineFormatting(item.content)}</li>
          ))}
        </ul>,
      );
    }
    listItems = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      flushList(`list-${index}`);
      return;
    }

    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      flushList(`list-${index}`);
      blocks.push(
        <h4
          key={`h-${index}`}
          className="text-sm sm:text-[15px] font-semibold text-navy pt-1"
        >
          {renderInlineFormatting(headingMatch[1])}
        </h4>,
      );
      return;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      if (listItems.length > 0 && listItems[0].ordered) {
        flushList(`list-switch-${index}`);
      }
      listItems.push({ ordered: false, content: bulletMatch[1] });
      return;
    }

    const orderedMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      if (listItems.length > 0 && !listItems[0].ordered) {
        flushList(`list-switch-${index}`);
      }
      listItems.push({ ordered: true, content: orderedMatch[1] });
      return;
    }

    flushList(`list-${index}`);
    blocks.push(
      <p key={`p-${index}`} className="text-sm sm:text-[15px] leading-relaxed">
        {renderInlineFormatting(line)}
      </p>,
    );
  });

  flushList('list-end');

  return <div className="space-y-2.5 text-ink">{blocks}</div>;
}
