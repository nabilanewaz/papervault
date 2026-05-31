import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    let result: unknown;

    switch (action) {
      case 'search':
        result = await handleSearch(body.query, body.source, body.limit ?? 10, body.offset ?? 0);
        break;
      case 'summarize':
        result = { summary: await callGroq(buildSummarizePrompt(body.text)) };
        break;
      case 'extract-key-points':
        result = { summary: await callGroq(buildKeyPointsPrompt(body.text)) };
        break;
      case 'recommend':
        result = { summary: await callGroq(buildRecommendPrompt(body.text)) };
        break;
      case 'repos':
        result = { repositories: await fetchRepos(body.arxivId, body.title) };
        break;
      default:
        return json({ error: 'Unknown action' }, 400);
    }

    return json(result);
  } catch (err) {
    console.error(err);
    return json({ error: String(err) }, 500);
  }
});

// ─── Paper Search ────────────────────────────────────────────────────────────

async function handleSearch(
  query: string,
  source: string,
  limit: number,
  offset: number,
): Promise<{ results: unknown[] }> {
  const jobs: Promise<unknown[]>[] = [];

  if (source === 'all' || source === 'semantic-scholar') {
    jobs.push(searchSemanticScholar(query, limit, offset).catch((e) => { console.error('SS error:', e); return []; }));
  }
  if (source === 'all' || source === 'arxiv') {
    jobs.push(searchArxiv(query, limit, offset).catch((e) => { console.error('arXiv error:', e); return []; }));
  }
  if (source === 'all' || source === 'papers-with-code') {
    jobs.push(searchPapersWithCode(query, limit, offset).catch((e) => { console.error('PWC error:', e); return []; }));
  }

  const arrays = await Promise.all(jobs);

  // Interleave round-robin so every working source contributes to the first N results
  const merged = source === 'all' ? interleave(arrays) : arrays.flat();

  // Deduplicate by title (normalised)
  const seen = new Set<string>();
  const results = merged.filter((p: any) => {
    const key = p.title?.toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { results: results.slice(0, limit) };
}

function interleave(arrays: unknown[][]): unknown[] {
  const out: unknown[] = [];
  const maxLen = Math.max(...arrays.map((a) => a.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const arr of arrays) {
      if (i < arr.length) out.push(arr[i]);
    }
  }
  return out;
}

const UA = 'PaperVault/1.0 (research app; contact: teamndag22@gmail.com)';

// In-memory cache — persists across requests on the same Deno instance
// Reduces repeated hits to rate-limited APIs (SS allows 100 req / 5 min without a key)
const _cache = new Map<string, { data: unknown[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function cacheGet(key: string): unknown[] | null {
  const entry = _cache.get(key);
  if (!entry || Date.now() - entry.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key: string, data: unknown[]): void {
  if (_cache.size > 200) {
    // Evict oldest 50 entries to keep memory bounded
    [..._cache.entries()]
      .sort((a, b) => a[1].ts - b[1].ts)
      .slice(0, 50)
      .forEach(([k]) => _cache.delete(k));
  }
  _cache.set(key, { data, ts: Date.now() });
}

async function searchSemanticScholar(query: string, limit: number, offset: number): Promise<unknown[]> {
  const cacheKey = `ss:${query}:${limit}:${offset}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const fields =
    'paperId,title,authors,year,abstract,citationCount,externalIds,openAccessPdf';
  const url =
    `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}&fields=${fields}`;

  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Semantic Scholar ${res.status}: ${await res.text()}`);
  const data = await res.json();

  const results = (data.data ?? []).map((p: any) => ({
    id: p.paperId,
    title: p.title ?? '',
    authors: (p.authors ?? []).map((a: any) => a.name),
    year: p.year ?? null,
    abstract: p.abstract ?? '',
    source: 'Semantic Scholar',
    url: `https://www.semanticscholar.org/paper/${p.paperId}`,
    pdf_url: p.openAccessPdf?.url ?? null,
    citations: p.citationCount ?? 0,
    arxiv_id: p.externalIds?.ArXiv ?? null,
    doi: p.externalIds?.DOI ?? null,
    has_code: false,
  }));
  cacheSet(cacheKey, results);
  return results;
}

async function searchArxiv(query: string, limit: number, offset: number): Promise<unknown[]> {
  const cacheKey = `ax:${query}:${limit}:${offset}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url =
    `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${limit}&start=${offset}&sortBy=relevance&sortOrder=descending`;

  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`arXiv ${res.status}: ${await res.text()}`);
  const text = await res.text();

  const entries = text.match(/<entry>([\s\S]*?)<\/entry>/g) ?? [];

  const results2 = entries.map((entry) => {
    const get = (tag: string) =>
      entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() ?? '';

    const rawId = get('id');
    const arxivId = rawId.split('/abs/')[1]?.replace(/v\d+$/, '') ?? rawId;
    const authorTags = entry.match(/<name>(.*?)<\/name>/g) ?? [];
    const authors = authorTags.map((a) => a.replace(/<\/?name>/g, ''));
    const published = get('published');
    const year = published ? new Date(published).getFullYear() : null;

    return {
      id: `arxiv-${arxivId}`,
      title: get('title').replace(/\s+/g, ' '),
      authors,
      year,
      abstract: get('summary').replace(/\s+/g, ' '),
      source: 'arXiv',
      url: `https://arxiv.org/abs/${arxivId}`,
      pdf_url: `https://arxiv.org/pdf/${arxivId}.pdf`,
      citations: null,
      arxiv_id: arxivId,
      has_code: false,
    };
  });
  cacheSet(cacheKey, results2);
  return results2;
}

async function searchPapersWithCode(query: string, limit: number, offset: number): Promise<unknown[]> {
  const page = Math.floor(offset / limit) + 1;
  const url =
    `https://paperswithcode.com/api/v1/papers/?q=${encodeURIComponent(query)}&items_per_page=${limit}&page=${page}`;

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': UA,
      Referer: 'https://paperswithcode.com/',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`Papers With Code ${res.status}`);

  // PWC sometimes returns an HTML challenge page with status 200 (Cloudflare)
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    throw new Error(`Papers With Code returned non-JSON response (${contentType})`);
  }

  const data = await res.json();

  return (data.results ?? []).map((p: any) => ({
    id: `pwc-${p.id}`,
    title: p.title ?? '',
    authors: p.authors ?? [],
    year: p.published ? new Date(p.published).getFullYear() : null,
    abstract: p.abstract ?? '',
    source: 'Papers With Code',
    url: p.url_abs ?? `https://paperswithcode.com/paper/${p.id}`,
    pdf_url: p.url_pdf ?? null,
    citations: null,
    arxiv_id: p.arxiv_id ?? null,
    has_code: (p.repository_count ?? 0) > 0,
    code_url: p.code_url ?? null,
  }));
}

// ─── Code Repositories ───────────────────────────────────────────────────────

async function fetchRepos(
  arxivId?: string,
  title?: string,
): Promise<unknown[]> {
  if (!arxivId && !title) return [];

  const query = arxivId ?? title ?? '';
  const url = `https://paperswithcode.com/api/v1/papers/?q=${encodeURIComponent(query)}&items_per_page=5`;

  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) return [];
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) return [];

  const data = await res.json();
  const candidates: any[] = data.results ?? [];
  if (candidates.length === 0) return [];

  // Pick the candidate that actually matches this paper
  let matched: any = null;

  if (arxivId) {
    // Exact arXiv ID match is definitive
    matched = candidates.find((p: any) => p.arxiv_id === arxivId) ?? null;
    // If no exact match and the top result has a different arxiv_id, bail — wrong paper
    if (!matched && candidates[0]?.arxiv_id && candidates[0].arxiv_id !== arxivId) return [];
    matched = matched ?? candidates[0];
  } else if (title) {
    // Title-based: require ≥60% of significant words to appear in the result title
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const words = norm(title).split(/\s+/).filter((w) => w.length > 3);
    const resultNorm = norm(candidates[0]?.title ?? '');
    const hits = words.filter((w) => resultNorm.includes(w)).length;
    if (words.length === 0 || hits < Math.ceil(words.length * 0.6)) return [];
    matched = candidates[0];
  }

  if (!matched?.id) return [];

  const repoRes = await fetch(
    `https://paperswithcode.com/api/v1/papers/${matched.id}/repositories/?items_per_page=5`,
    { headers: { Accept: 'application/json', 'User-Agent': UA } },
  );
  if (!repoRes.ok) return [];
  const repoCt = repoRes.headers.get('content-type') ?? '';
  if (!repoCt.includes('json')) return [];
  const repoData = await repoRes.json();

  return (repoData.results ?? []).map((r: any) => ({
    url: r.url,
    framework: r.framework ?? null,
    stars: r.stars ?? null,
    description: r.description ?? null,
  }));
}

// ─── Groq AI ─────────────────────────────────────────────────────────────────

async function callGroq(prompt: string): Promise<string> {
  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) throw new Error('GROQ_API_KEY secret not set');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert research assistant helping CSE students understand academic papers. Be concise, technical, and structured.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

function buildSummarizePrompt(text: string): string {
  return `Summarize the following research paper in a structured format with sections: Overview, Problem Statement, Methodology, Key Results, and Significance. Keep it concise but technically accurate.

Paper:
${text}`;
}

function buildKeyPointsPrompt(text: string): string {
  return `Extract the key technical points from this research paper. List: Main Contribution, Novel Techniques, Experimental Setup, Key Results (with numbers), Limitations, and Future Work.

Paper:
${text}`;
}

function buildRecommendPrompt(text: string): string {
  return `Based on this research paper, suggest 5 related research directions or papers a CSE student should explore next. For each, give a title/topic and one sentence explaining why it's relevant.

Paper:
${text}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
