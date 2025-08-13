import fs from 'node:fs';
import path from 'node:path';

function transformPgToSqlite(sql: string): string {
  let out = sql;
  // Remove schema qualifiers
  out = out.replace(/\bpublic\./g, '');
  // SERIAL → INTEGER
  out = out.replace(/\bSERIAL\b/gi, 'INTEGER');
  // TIMESTAMP → DATETIME
  out = out.replace(/\bTIMESTAMP\b/gi, 'DATETIME');
  // Boolean → INTEGER (0/1)
  out = out.replace(/\bBOOLEAN\b/gi, 'INTEGER');
  // Remove PostgreSQL-specific
  out = out.replace(/::[a-zA-Z_]+/g, '');
  out = out.replace(/WITH\s*\([^)]+\)/gi, '');
  out = out.replace(/USING\s+[^;]+;/gi, ';');
  // Ensure AUTOINCREMENT on integer PKs
  out = out.replace(/(id\s+INTEGER\s+PRIMARY\s+KEY)(?!\s+AUTOINCREMENT)/gi, '$1 AUTOINCREMENT');
  // Drop IF NOT EXISTS already fine; SQLite supports it
  // Foreign keys syntax is compatible
  return out;
}

function main() {
  const [,, inFile, outFile] = process.argv;
  if (!inFile || !outFile) {
    // eslint-disable-next-line no-console
    console.error('Usage: tsx scripts/pg2sqlite.ts <input.pg.sql> <output.sqlite.sql>');
    process.exit(1);
  }
  const inputPath = path.resolve(process.cwd(), inFile);
  const outputPath = path.resolve(process.cwd(), outFile);
  const sql = fs.readFileSync(inputPath, 'utf-8');
  const transformed = transformPgToSqlite(sql);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, transformed);
  // eslint-disable-next-line no-console
  console.log(`Generated SQLite SQL: ${outputPath}`);
}

main();


