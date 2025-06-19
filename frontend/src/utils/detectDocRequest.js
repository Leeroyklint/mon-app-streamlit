export function detectDocRequest(txt) {
    const m = txt.toLowerCase().match(/\b(csv|docx?|pdf|pptx?)\b/);
    return m ? m[1] : null;
}
