import type { Category, CategoryKind } from '../modules/categories/types';

export type CategoryLeafOption = {
  value: string;
  label: string;
  kind: CategoryKind;
};

/** Flatten category tree to leaf options with path labels (Parent › Leaf). */
export function flattenCategoryLeaves(
  nodes: Category[],
  path: string[] = [],
): CategoryLeafOption[] {
  const leaves: CategoryLeafOption[] = [];
  for (const node of nodes) {
    const nextPath = [...path, node.name];
    if (node.children && node.children.length > 0) {
      leaves.push(...flattenCategoryLeaves(node.children, nextPath));
    } else if (node.isLeaf) {
      leaves.push({
        value: node.id,
        label: nextPath.join(' › '),
        kind: node.kind,
      });
    }
  }
  return leaves;
}
