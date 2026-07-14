import type { ParsedFile } from './types';

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([^<\r\n]*)`, 'i'));
  return match ? match[1]!.trim() : null;
}

/** Converte data OFX (yyyyMMdd[hhmmss][.xxx][gmt offset]) para ISO yyyy-mm-dd. */
function formatOfxDate(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  if (year.length !== 4 || month.length !== 2 || day.length !== 2) return raw;
  return `${year}-${month}-${day}`;
}

/**
 * Faz parsing de um arquivo OFX (extrato de cartão/conta). OFX é SGML/XML-like e
 * frequentemente vem com tags sem fechamento — por isso o parsing é feito com
 * regex tolerante em vez de um parser XML estrito. As colunas resultantes já são
 * fixas (data/valor/descricao), então o mapeamento de colunas na importação é
 * automático para este formato.
 */
export function parseOFX(text: string): ParsedFile {
  const headers = ['data', 'valor', 'descricao'];
  const blocks =
    text.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANSLIST>|<\/CCSTMTTRNRS>|$)/gi) ?? [];

  const rows = blocks
    .map((block, index) => {
      const date = extractTag(block, 'DTPOSTED');
      const amount = extractTag(block, 'TRNAMT');
      const name = extractTag(block, 'NAME') ?? extractTag(block, 'PAYEE') ?? '';
      const memo = extractTag(block, 'MEMO') ?? '';
      if (!date || !amount) return null;

      return {
        rowIndex: index,
        columns: {
          data: formatOfxDate(date),
          valor: amount,
          descricao: [name, memo].filter(Boolean).join(' - '),
        },
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return { headers, rows };
}
