// 続きを出力する際に、前置きや断り書き・要約・挨拶を入れないよう強く指示
export const CONTINUE_PROMPT =
  'Continue EXACTLY from the previous response. Output only the next segment of the content without any preface, no acknowledgements, no recap, no greetings, no meta text. Start immediately with the next token.';

// 初回応答用: チャットタイトルを末尾に付けて返す
export const TITLE_INSTRUCTION = `
You are generating an assistant response for a chat application.
In addition to answering, you must also create a concise, human-readable Japanese chat title summarizing the conversation.
Append a single XML-like tag exactly at the very end of your first response in the following format:
<chatTitle>ここに短いタイトル</chatTitle>

Hard requirements:
- The tag must appear once, at the very end (no trailing characters after the closing tag).
- Title length should be up to 30 characters, no quotes, no newlines.
- Do not include any preface or meta explanations about the title.
 - Even if you decline or cannot answer, still output a minimal helpful reply followed by the chatTitle tag.
`;


