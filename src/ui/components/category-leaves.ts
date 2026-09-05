import type { Category, CategoryKind } from '../modules/categories/types';

export type CategoryLeafOption = {
  value: string;
  label: string;
  kind: CategoryKind;
  systemKey: string | null;
};

export type CategoryNodeOption = {
  value: string;
  label: string;
  kind: CategoryKind;
  depth: number;
};

const MAX_CATEGORY_DEPTH = 5;

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
        systemKey: node.systemKey ?? null,
      });
    }
  }
  return leaves;
}

/** Nodes that can receive a child (depth < max). */
export function flattenCategoryParents(
  nodes: Category[],
  path: string[] = [],
): CategoryNodeOption[] {
  const options: CategoryNodeOption[] = [];
  for (const node of nodes) {
    const nextPath = [...path, node.name];
    if (node.depth < MAX_CATEGORY_DEPTH) {
      options.push({
        value: node.id,
        label: nextPath.join(' › '),
        kind: node.kind,
        depth: node.depth,
      });
    }
    if (node.children && node.children.length > 0) {
      options.push(...flattenCategoryParents(node.children, nextPath));
    }
  }
  return options;
}

/** Flatten tree to filter options: parents and leaves (path labels). */
export function flattenCategoryFilterOptions(
  nodes: Category[],
  path: string[] = [],
): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  for (const node of nodes) {
    const nextPath = [...path, node.name];
    options.push({
      value: node.id,
      label: nextPath.join(' › '),
    });
    if (node.children && node.children.length > 0) {
      options.push(...flattenCategoryFilterOptions(node.children, nextPath));
    }
  }
  return options;
}

export function findCategoryLabel(
  options: Array<{ value: string; label: string }>,
  id: string,
): string | undefined {
  return options.find((option) => option.value === id)?.label;
}
