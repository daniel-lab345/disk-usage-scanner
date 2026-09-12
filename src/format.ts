const UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];

// Binary (1024-based) units, matching what `du` and most disk tools show.
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  // One decimal place, but don't print "4.0 GiB" as "4 GiB" — keep it
  // consistent so columns of output line up.
  return `${value.toFixed(1)} ${UNITS[unitIndex]}`;
}
