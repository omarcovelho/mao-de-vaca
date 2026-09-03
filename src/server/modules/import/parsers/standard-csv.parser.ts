import { BadRequestException } from '@nestjs/common';
import type { ParseResult } from './canonical';

const REQUIRED_HEADERS = ['data', 'descricao', 'valor', 'categoria'] as const;

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseDate(raw: string): string | null {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (br) {
    return `${br[3]}-${br[2]}-${br[1]}`;
  }
  return null;
}

function parseAmount(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s/g, '');
  if (!trimmed || trimmed === '-' || trimmed === '+') {
    return null;
  }
  const negative = trimmed.startsWith('-');
  const unsigned = trimmed.replace(/^[+-]/, '');
  if (!unsigned) {
    return null;
  }

  let normalized: string;
  if (unsigned.includes(',')) {
    normalized = unsigned.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = unsigned;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const [whole, fraction = ''] = normalized.split('.');
  const decimals = fraction.padEnd(2, '0').slice(0, 2);
  const canonical = `${whole}.${decimals}`;
  if (canonical === '0.00') {
    return '0.00';
  }
  return negative ? `-${canonical}` : canonical;
}

function isTransferType(raw: string | undefined): boolean {
  if (!raw) {
    return false;
  }
  const normalized = normalizeHeader(raw);
  return normalized === 'transferencia' || normalized === 'transfer';
}

export function parseStandardCsv(buffer: Buffer): ParseResult {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((line, index, all) => {
    if (line.trim() !== '') {
      return true;
    }
    return index < all.length - 1 && all.slice(index + 1).some((l) => l.trim());
  });

  if (lines.length === 0) {
    throw new BadRequestException('Arquivo CSV vazio');
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      throw new BadRequestException(
        `Cabeçalho inválido: coluna "${required}" é obrigatória`,
      );
    }
  }

  const index = {
    data: headers.indexOf('data'),
    descricao: headers.indexOf('descricao'),
    valor: headers.indexOf('valor'),
    categoria: headers.indexOf('categoria'),
    tipo: headers.indexOf('tipo'),
  };

  const transactions: ParseResult['transactions'] = [];
  const errors: ParseResult['errors'] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const rawLine = lines[i];
    if (!rawLine.trim()) {
      continue;
    }
    const cells = splitCsvLine(rawLine);
    const date = parseDate(cells[index.data] ?? '');
    const description = (cells[index.descricao] ?? '').trim();
    const amount = parseAmount(cells[index.valor] ?? '');
    const category = (cells[index.categoria] ?? '').trim();
    const tipo = index.tipo >= 0 ? cells[index.tipo] : undefined;

    if (!date) {
      errors.push({ line: lineNumber, message: 'Data inválida' });
      continue;
    }
    if (!description) {
      errors.push({ line: lineNumber, message: 'Descrição é obrigatória' });
      continue;
    }
    if (!amount) {
      errors.push({ line: lineNumber, message: 'Valor inválido' });
      continue;
    }
    if (amount === '0.00' || amount === '-0.00') {
      errors.push({ line: lineNumber, message: 'Valor não pode ser zero' });
      continue;
    }

    const isNegative = amount.startsWith('-');
    const type = isTransferType(tipo)
      ? 'TRANSFER'
      : isNegative
        ? 'EXPENSE'
        : 'INCOME';

    transactions.push({
      line: lineNumber,
      competenceDate: date,
      cashDate: date,
      description,
      amount,
      type,
      category,
    });
  }

  return { transactions, errors };
}
