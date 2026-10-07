// Spec 0004: Groq model ids. Check them against
// https://console.groq.com/docs/models before shipping. The Hindi smoke test
// decides the order; swap PRIMARY and BACKUP if the backup does better.
export const PRIMARY_MODEL = "openai/gpt-oss-120b";
export const BACKUP_MODEL = "qwen/qwen3.8-27b";
export const TRANSCRIBE_MODEL = "whisper-large-v3-turbo";
