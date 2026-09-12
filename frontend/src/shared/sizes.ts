const clothingSizes = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL'];

export function compareSizes(left: string, right: string): number {
  const leftIndex = clothingSizes.indexOf(left.toUpperCase());
  const rightIndex = clothingSizes.indexOf(right.toUpperCase());
  if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
  if (leftIndex >= 0) return -1;
  if (rightIndex >= 0) return 1;
  return left.localeCompare(right, 'ru', { numeric: true });
}
