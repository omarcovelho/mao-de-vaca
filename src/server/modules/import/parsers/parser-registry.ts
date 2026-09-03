import type { ImportParser } from './canonical';
import { parseStandardCsv } from './standard-csv.parser';

export const STANDARD_PARSER_ID = 'standard';

export const standardParser: ImportParser = {
  id: STANDARD_PARSER_ID,
  label: 'Padrão',
  parse: parseStandardCsv,
};

const parsers = new Map<string, ImportParser>([
  [STANDARD_PARSER_ID, standardParser],
]);

export function getParser(parserId: string): ImportParser | undefined {
  return parsers.get(parserId);
}

export function listParsers(): Array<{ id: string; label: string }> {
  return [{ id: STANDARD_PARSER_ID, label: standardParser.label }];
}
