export type CategoryKind = 'EXPENSE' | 'INCOME' | 'NON_EXPENSE';

export type CategoryResponse = {
  id: string;
  parentId: string | null;
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string;
  systemKey: string | null;
  active: boolean;
  depth: number;
  isLeaf: boolean;
  children?: CategoryResponse[];
};

export type CreateCategoryDto = {
  name: string;
  parentId?: string | null;
  kind?: CategoryKind;
  color?: string;
  icon?: string;
};

export type UpdateCategoryDto = {
  name?: string;
  color?: string;
  icon?: string;
  active?: boolean;
};
