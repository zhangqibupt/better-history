function appendText(container, value) {
  container.appendChild(document.createTextNode(value));
}

export function appendHighlightedText(container, value, keyword) {
  const text = value ?? "";
  const normalizedKeyword = (keyword ?? "").trim();

  if (!normalizedKeyword) {
    appendText(container, text);
    return;
  }

  const escapedKeyword = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escapedKeyword, "gi");
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      appendText(container, text.slice(lastIndex, matchIndex));
    }

    const mark = document.createElement("mark");
    mark.textContent = match[0];
    container.appendChild(mark);
    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < text.length) {
    appendText(container, text.slice(lastIndex));
  }
}
