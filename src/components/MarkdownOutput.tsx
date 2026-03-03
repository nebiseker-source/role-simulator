"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MermaidChart from "@/components/MermaidChart";

type MarkdownOutputProps = {
  content: string;
};

export default function MarkdownOutput({ content }: MarkdownOutputProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const className = props.className ?? "";
            const raw = String(props.children ?? "").replace(/\n$/, "");

            if (className.includes("language-mermaid")) {
              return <MermaidChart chart={raw} />;
            }

            return (
              <code className={className}>
                {props.children}
              </code>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
