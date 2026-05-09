import { tokenizeKeyword } from "../../historySearch.js";

function appendText(container, value) {
  container.appendChild(document.createTextNode(value));
}

export function buildHighlightParts(value, keyword) {
  const text = value ?? "";
  const keywordTokens = tokenizeKeyword(keyword).sort((left, right) => right.length - left.length);

  if (keywordTokens.length === 0) {
    return [{ text, highlighted: false }];
  }

  const escapedTokens = keywordTokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(escapedTokens.join("|"), "gi");
  let lastIndex = 0;
  const parts = [];

  for (const match of text.matchAll(pattern)) {
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, matchIndex),
        highlighted: false
      });
    }

    parts.push({
      text: match[0],
      highlighted: true
    });
    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({
      text: text.slice(lastIndex),
      highlighted: false
    });
  }

  return parts;
}

export function appendHighlightedText(container, value, keyword) {
  for (const part of buildHighlightParts(value, keyword)) {
    if (!part.highlighted) {
      appendText(container, part.text);
      continue;
    }

    const mark = document.createElement("mark");
    mark.textContent = part.text;
    container.appendChild(mark);
  }
}
