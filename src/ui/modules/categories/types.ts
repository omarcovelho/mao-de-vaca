export type CategoryKind = 'EXPENSE' | 'INCOME' | 'NON_EXPENSE';

export type Category = {
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
  children?: Category[];
};

export type CreateCategoryInput = {
  name: string;
  parentId?: string | null;
  kind?: CategoryKind;
  color?: string;
  icon?: string;
};

export type UpdateCategoryInput = {
  name?: string;
  color?: string;
  icon?: string;
  active?: boolean;
};
