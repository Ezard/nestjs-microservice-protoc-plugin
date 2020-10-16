export function trimPadding(input: string): string {
  const lines = input.split(/\r?\n/);
  const firstNonEmptyLine = lines.find(line => !/^\s*$/.test(line));
  if (firstNonEmptyLine) {
    const startPaddingMatches = firstNonEmptyLine.match(/^(\s*)/);
    if (startPaddingMatches && startPaddingMatches.length >= 2) {
      return lines.map(line => line.replace(new RegExp(`${startPaddingMatches[1]}`), '')).join('\n');
    } else {
      return input;
    }
  } else {
    return input;
  }
}
