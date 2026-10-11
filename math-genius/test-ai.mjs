import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const [model, level] = process.argv.slice(2);

const config = level
  ? { thinkingConfig: { thinkingLevel: ThinkingLevel[level.toUpperCase()] } }
  : {};

console.log("Model:", model, "| Thinking:", level || "mặc định");
console.time("gemini");
const res = await ai.models.generateContent({
  model,
  contents: "Nói xin chào trong 5 từ.",
  config,
});
console.timeEnd("gemini");
console.log(res.text);
console.log(res.usageMetadata);