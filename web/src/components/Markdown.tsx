import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** GFM対応のMarkdownレンダラ（KB-5: 表・チェックリスト対応） */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed text-slate-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h1 className="mt-6 mb-3 border-b border-slate-200 pb-1.5 text-xl font-bold first:mt-0" {...p} />,
          h2: (p) => <h2 className="mt-6 mb-2.5 border-b border-slate-200 pb-1 text-lg font-bold first:mt-0" {...p} />,
          h3: (p) => <h3 className="mt-5 mb-2 text-base font-bold first:mt-0" {...p} />,
          p: (p) => <p className="my-2.5" {...p} />,
          ul: (p) => <ul className="my-2.5 list-disc space-y-1 pl-6" {...p} />,
          ol: (p) => <ol className="my-2.5 list-decimal space-y-1 pl-6" {...p} />,
          li: (p) => <li {...p} />,
          a: (p) => <a className="text-indigo-600 underline hover:text-indigo-800" target="_blank" rel="noreferrer" {...p} />,
          blockquote: (p) => <blockquote className="my-2.5 border-l-4 border-amber-300 bg-amber-50 px-3 py-2 text-slate-700" {...p} />,
          code: (p) => <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px] text-rose-600" {...p} />,
          pre: (p) => <pre className="my-2.5 overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-[13px] text-slate-100 [&_code]:bg-transparent [&_code]:text-slate-100" {...p} />,
          table: (p) => (
            <div className="my-2.5 overflow-x-auto">
              <table className="min-w-[50%] border-collapse text-sm" {...p} />
            </div>
          ),
          th: (p) => <th className="border border-slate-300 bg-slate-50 px-3 py-1.5 text-left font-bold" {...p} />,
          td: (p) => <td className="border border-slate-300 px-3 py-1.5" {...p} />,
          input: (p) => <input {...p} disabled className="mr-1 accent-indigo-600" />,
          img: (p) => <img {...p} className="my-2 max-h-72 max-w-full rounded-lg border border-slate-200" />,
          hr: () => <hr className="my-4 border-slate-200" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
