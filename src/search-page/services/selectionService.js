export const NO_SELECTION = -1;

export function getDefaultSelectionIndex(itemCount) {
  return itemCount > 0 ? 0 : NO_SELECTION;
}

export function clampSelectionIndex(index, itemCount) {
  if (itemCount <= 0) {
    return NO_SELECTION;
  }

  return Math.min(Math.max(index, 0), itemCount - 1);
}

export function moveSelectionIndex(currentIndex, itemCount, delta) {
  if (itemCount <= 0) {
    return NO_SELECTION;
  }

  const baseIndex = currentIndex === NO_SELECTION ? getDefaultSelectionIndex(itemCount) : currentIndex;
  return clampSelectionIndex(baseIndex + delta, itemCount);
}
