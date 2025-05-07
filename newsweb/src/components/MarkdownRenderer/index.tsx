import React from 'react';
import './index.css';

interface MarkdownRendererProps {
  content: string;
}

// 简单的Markdown渲染器，使用dangerouslySetInnerHTML实现
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  // 处理标题
  let processedContent = content.replace(/#{1,6}\s+(.*?)$/gm, (match, title) => {
    const headingLevel = match.trim().indexOf(' ');
    return `<h${headingLevel}>${title}</h${headingLevel}>`;
  });

  // 处理粗体
  processedContent = processedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 处理斜体
  processedContent = processedContent.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 处理链接
  processedContent = processedContent.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

  // 处理无序列表
  processedContent = processedContent.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>');
  processedContent = processedContent.replace(/(<li>.*?<\/li>(\s*<li>.*?<\/li>)*)/g, '<ul>$1</ul>');

  // 处理有序列表
  processedContent = processedContent.replace(/^\s*\d+\.\s+(.*)$/gm, '<li>$1</li>');
  processedContent = processedContent.replace(/(<li>.*?<\/li>(\s*<li>.*?<\/li>)*)/g, '<ol>$1</ol>');

  // 处理代码块
  processedContent = processedContent.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // 处理行内代码
  processedContent = processedContent.replace(/`(.*?)`/g, '<code>$1</code>');

  // 处理换行
  processedContent = processedContent.replace(/\n\n/g, '</p><p>');
  processedContent = processedContent.replace(/\n/g, '<br />');

  // 包装在p标签内
  processedContent = `<p>${processedContent}</p>`;

  return <div className="markdown-content" dangerouslySetInnerHTML={{ __html: processedContent }} />;
};

export default MarkdownRenderer;
