import { Paper } from '@/types/paper';

function sanitize(str?: string): string {
  return (str || '').replace(/[{}\\]/g, '');
}

function toBibKey(paper: Paper): string {
  const firstAuthor = (paper.authors[0] || 'Unknown').split(' ').pop() || 'Unknown';
  return `${firstAuthor}${paper.year || '0000'}`;
}

export function exportToBibTeX(papers: Paper[]): string {
  return papers.map(p => {
    const key = toBibKey(p);
    const authors = p.authors.join(' and ');
    const lines = [
      `@article{${key},`,
      `  title     = {${sanitize(p.title)}},`,
      `  author    = {${sanitize(authors)}},`,
      `  year      = {${p.year || ''}},`,
    ];
    if (p.abstract) lines.push(`  abstract  = {${sanitize(p.abstract)}},`);
    if (p.doi) lines.push(`  doi       = {${p.doi}},`);
    if (p.url) lines.push(`  url       = {${p.url}},`);
    if (p.arxiv_id) lines.push(`  eprint    = {${p.arxiv_id}},`);
    lines.push('}');
    return lines.join('\n');
  }).join('\n\n');
}

export function exportToCSV(papers: Paper[]): string {
  const headers = ['Title', 'Authors', 'Year', 'Status', 'Tags', 'Rating', 'Citations', 'Source', 'URL', 'DOI', 'Notes'];
  const escape = (s?: string | number) => {
    const str = String(s ?? '');
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const rows = papers.map(p => [
    escape(p.title),
    escape(p.authors.join('; ')),
    escape(p.year),
    escape(p.status),
    escape(p.tags.join('; ')),
    escape(p.rating),
    escape(p.citations),
    escape(p.source),
    escape(p.url),
    escape(p.doi),
    escape(p.notes),
  ].join(','));
  return [headers.join(','), ...rows].join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
