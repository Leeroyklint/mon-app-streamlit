export function detectDocRequest(txt: string):
  | "csv" | "docx" | "pdf" | "ppt" | null {

  const m = txt.toLowerCase().match(/\b(csv|docx?|pdf|pptx?)\b/);
  return m ? (m[1] as any) : null;
}
