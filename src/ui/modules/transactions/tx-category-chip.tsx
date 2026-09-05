import { CategoryIcon } from '../categories/category-icons';

type CategoryChipData = {
  name: string;
  color: string;
  icon: string;
} | null;

type TxCategoryChipProps = {
  category: CategoryChipData;
  suffix?: string;
};

export function TxCategoryChip({ category, suffix }: TxCategoryChipProps) {
  if (!category) {
    return (
      <span className="tx-category-chip tx-category-chip--empty">
        Sem categoria
      </span>
    );
  }

  return (
    <span className="tx-category-chip">
      <span
        className="category-swatch category-swatch--sm"
        style={{ ['--swatch' as string]: category.color }}
        aria-hidden
      >
        <CategoryIcon icon={category.icon} />
      </span>
      <span className="tx-category-chip__name" title={category.name}>
        {category.name}
      </span>
      {suffix ? (
        <span className="tx-category-chip__suffix">{suffix}</span>
      ) : null}
    </span>
  );
}
