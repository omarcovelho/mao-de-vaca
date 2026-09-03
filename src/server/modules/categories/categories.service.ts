import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, CategoryKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  isValidCategoryColor,
  isValidCategoryIcon,
  MAX_CATEGORY_DEPTH,
} from './category-icons';
import {
  CategoryResponse,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './categories.types';

type CategoryRow = Category & { _count?: { children: number } };

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    includeInactive = false,
  ): Promise<CategoryResponse[]> {
    const rows = await this.prisma.category.findMany({
      where: {
        userId,
        ...(includeInactive ? {} : { active: true }),
      },
      include: { _count: { select: { children: true } } },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });

    const byParent = new Map<string | null, CategoryRow[]>();
    for (const row of rows) {
      const key = row.parentId;
      const list = byParent.get(key) ?? [];
      list.push(row);
      byParent.set(key, list);
    }

    const build = (parentId: string | null, depth: number): CategoryResponse[] => {
      const children = byParent.get(parentId) ?? [];
      return children.map((row) => {
        const nested = build(row.id, depth + 1);
        return {
          ...this.toResponse(row, depth, (row._count?.children ?? 0) === 0),
          children: nested,
          isLeaf: (row._count?.children ?? 0) === 0,
        };
      });
    };

    return build(null, 1);
  }

  async create(
    userId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryResponse> {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('Nome é obrigatório');
    }

    const parentId: string | null = dto.parentId ?? null;
    let kind: CategoryKind;
    let color: string;
    let icon: string;
    let depth = 1;

    if (parentId) {
      const parent = await this.prisma.category.findFirst({
        where: { id: parentId, userId },
      });
      if (!parent) {
        throw new NotFoundException('Categoria pai não encontrada');
      }
      depth = (await this.computeDepth(parent.id)) + 1;
      if (depth > MAX_CATEGORY_DEPTH) {
        throw new BadRequestException(
          `Profundidade máxima de categorias é ${MAX_CATEGORY_DEPTH}`,
        );
      }
      kind = parent.kind;
      color = dto.color?.trim() || parent.color;
      icon = dto.icon?.trim() || parent.icon;
    } else {
      if (!dto.kind) {
        throw new BadRequestException('Tipo é obrigatório para categoria raiz');
      }
      kind = dto.kind;
      color = dto.color?.trim() ?? '';
      icon = dto.icon?.trim() ?? '';
      if (!color || !icon) {
        throw new BadRequestException(
          'Cor e ícone são obrigatórios para categoria raiz',
        );
      }
    }

    this.assertColorIcon(color, icon);
    await this.assertSiblingUnique(userId, parentId, name);
    await this.assertLeafNameUnique(userId, name);

    const created = await this.prisma.category.create({
      data: {
        userId,
        parentId,
        name,
        kind,
        color,
        icon,
      },
      include: { _count: { select: { children: true } } },
    });

    return this.toResponse(created, depth, true);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponse> {
    const existing = await this.prisma.category.findFirst({
      where: { id, userId },
      include: { _count: { select: { children: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Categoria não encontrada');
    }

    const data: Prisma.CategoryUpdateInput = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Nome é obrigatório');
      }
      if (name !== existing.name) {
        await this.assertSiblingUnique(userId, existing.parentId, name, id);
        if (existing._count.children === 0) {
          await this.assertLeafNameUnique(userId, name, id);
        }
      }
      data.name = name;
    }

    if (dto.color !== undefined) {
      const color = dto.color.trim();
      this.assertColorIcon(color, existing.icon);
      data.color = color;
    }

    if (dto.icon !== undefined) {
      const icon = dto.icon.trim();
      this.assertColorIcon(dto.color?.trim() ?? existing.color, icon);
      data.icon = icon;
    }

    if (dto.active === false) {
      await this.deactivateSubtree(userId, id);
      const refreshed = await this.prisma.category.findFirstOrThrow({
        where: { id, userId },
        include: { _count: { select: { children: true } } },
      });
      const depth = await this.computeDepth(id);
      return this.toResponse(
        refreshed,
        depth,
        refreshed._count.children === 0,
      );
    }

    if (dto.active === true) {
      data.active = true;
    }

    if (Object.keys(data).length === 0 && dto.active === undefined) {
      const depth = await this.computeDepth(id);
      return this.toResponse(existing, depth, existing._count.children === 0);
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data,
      include: { _count: { select: { children: true } } },
    });
    const depth = await this.computeDepth(id);
    return this.toResponse(updated, depth, updated._count.children === 0);
  }

  async countActiveLeaves(userId: string): Promise<number> {
    const rows = await this.prisma.category.findMany({
      where: { userId, active: true },
      select: { id: true, parentId: true },
    });
    const parentIds = new Set(
      rows.map((r) => r.parentId).filter((id): id is string => Boolean(id)),
    );
    return rows.filter((r) => !parentIds.has(r.id)).length;
  }

  private toResponse(
    row: CategoryRow,
    depth: number,
    isLeaf: boolean,
  ): CategoryResponse {
    return {
      id: row.id,
      parentId: row.parentId,
      name: row.name,
      kind: row.kind,
      color: row.color,
      icon: row.icon,
      active: row.active,
      depth,
      isLeaf,
    };
  }

  private assertColorIcon(color: string, icon: string): void {
    if (!isValidCategoryColor(color)) {
      throw new BadRequestException('Cor inválida; use o formato #RRGGBB');
    }
    if (!isValidCategoryIcon(icon)) {
      throw new BadRequestException('Ícone inválido');
    }
  }

  private async assertSiblingUnique(
    userId: string,
    parentId: string | null,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const conflict = await this.prisma.category.findFirst({
      where: {
        userId,
        parentId,
        name,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (conflict) {
      throw new ConflictException('Já existe uma categoria com este nome');
    }
  }

  private async assertLeafNameUnique(
    userId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const withChildren = await this.prisma.category.findMany({
      where: { userId },
      select: { id: true, parentId: true, name: true },
    });
    const parentIds = new Set(
      withChildren
        .map((r) => r.parentId)
        .filter((id): id is string => Boolean(id)),
    );
    const leafConflict = withChildren.find(
      (r) =>
        r.name === name &&
        !parentIds.has(r.id) &&
        r.id !== excludeId,
    );
    if (leafConflict) {
      throw new ConflictException(
        'Já existe uma subcategoria (folha) com este nome',
      );
    }
  }

  private async computeDepth(categoryId: string): Promise<number> {
    let depth = 1;
    let currentId: string | null = categoryId;
    const seen = new Set<string>();
    while (currentId) {
      if (seen.has(currentId)) {
        break;
      }
      seen.add(currentId);
      const row: { parentId: string | null } | null =
        await this.prisma.category.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });
      if (!row?.parentId) {
        break;
      }
      depth += 1;
      currentId = row.parentId;
    }
    return depth;
  }

  private async deactivateSubtree(
    userId: string,
    rootId: string,
  ): Promise<void> {
    const all = await this.prisma.category.findMany({
      where: { userId },
      select: { id: true, parentId: true },
    });
    const childrenByParent = new Map<string, string[]>();
    for (const row of all) {
      if (!row.parentId) continue;
      const list = childrenByParent.get(row.parentId) ?? [];
      list.push(row.id);
      childrenByParent.set(row.parentId, list);
    }
    const toDeactivate: string[] = [];
    const walk = (id: string) => {
      toDeactivate.push(id);
      for (const childId of childrenByParent.get(id) ?? []) {
        walk(childId);
      }
    };
    walk(rootId);
    await this.prisma.category.updateMany({
      where: { id: { in: toDeactivate }, userId },
      data: { active: false },
    });
  }
}
