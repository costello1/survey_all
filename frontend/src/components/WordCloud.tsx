import type { CSSProperties } from 'react';
import type { WordCount } from '../types';

interface WordCloudProps {
  words: WordCount[];
}

function colorForIndex(index: number): string {
  const palette = ['#d95d39', '#0b6b76', '#bc6c25', '#1f7a8c', '#9b2226', '#2a9d8f'];
  return palette[index % palette.length];
}

export default function WordCloud({ words }: WordCloudProps) {
  const maxCount = words.reduce((max, word) => Math.max(max, word.count), 1);

  if (!words.length) {
    return (
      <div className="empty-card">
        <p>Waiting for answers</p>
      </div>
    );
  }

  return (
    <div className="word-cloud">
      {words.map((item, index) => {
        const scale = item.count / maxCount;
        const fontSize = 18 + scale * 48;
        const rotation = index % 4 === 0 ? -8 : index % 5 === 0 ? 6 : 0;
        const style: CSSProperties = {
          fontSize: `${fontSize}px`,
          color: colorForIndex(index),
          transform: `rotate(${rotation}deg)`,
        };

        return (
          <span className="word-chip" key={item.word} style={style}>
            {item.word}
            <small>{item.count}</small>
          </span>
        );
      })}
    </div>
  );
}
