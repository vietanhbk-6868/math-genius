import katex from "katex";
import "katex/dist/katex.min.css";

export default function MathText({ text }) {
  const parts = String(text ?? "").split(/(\$[^$]+\$)/g);
  return (
    <span>
      {parts.map((p, i) =>
        p.length > 2 && p.startsWith("$") && p.endsWith("$") ? (
          <span
            key={i}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(p.slice(1, -1), { throwOnError: false }),
            }}
          />
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}