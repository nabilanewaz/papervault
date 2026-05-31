import React, { useState } from 'react';
import { Paper } from '../types/paper';
import { paperService } from '@/services/paperService';
import { Sparkles, ExternalLink, BookOpen, Star, Code, FileText, Loader2, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';

interface CuratedPaper {
  title: string;
  authors: string[];
  year: number;
  url: string;
  abstract: string;
  topic: string;
  arxivId?: string;
  hasCode?: boolean;
  codeUrl?: string;
  citations?: number;
}

const CURATED: Record<string, CuratedPaper[]> = {
  NLP: [
    { title: 'Attention Is All You Need', authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar', 'Jakob Uszkoreit'], year: 2017, url: 'https://arxiv.org/abs/1706.03762', arxivId: '1706.03762', abstract: 'We propose the Transformer, a new simple network architecture based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.', topic: 'NLP', hasCode: true, citations: 100000 },
    { title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding', authors: ['Jacob Devlin', 'Ming-Wei Chang', 'Kenton Lee', 'Kristina Toutanova'], year: 2018, url: 'https://arxiv.org/abs/1810.04805', arxivId: '1810.04805', abstract: 'We introduce BERT, a new language representation model designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context.', topic: 'NLP', hasCode: true, citations: 75000 },
    { title: 'Language Models are Few-Shot Learners (GPT-3)', authors: ['Tom B. Brown', 'Benjamin Mann', 'Nick Ryder'], year: 2020, url: 'https://arxiv.org/abs/2005.14165', arxivId: '2005.14165', abstract: 'We train GPT-3, an autoregressive language model with 175 billion parameters, and test its ability to perform NLP tasks in the few-shot setting.', topic: 'NLP', citations: 30000 },
  ],
  'Computer Vision': [
    { title: 'Deep Residual Learning for Image Recognition', authors: ['Kaiming He', 'Xiangyu Zhang', 'Shaoqing Ren', 'Jian Sun'], year: 2015, url: 'https://arxiv.org/abs/1512.03385', arxivId: '1512.03385', abstract: 'We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously — enabling 152-layer networks.', topic: 'Computer Vision', hasCode: true, citations: 150000 },
    { title: 'An Image is Worth 16x16 Words: Vision Transformer (ViT)', authors: ['Alexey Dosovitskiy', 'Lucas Beyer', 'Alexander Kolesnikov'], year: 2020, url: 'https://arxiv.org/abs/2010.11929', arxivId: '2010.11929', abstract: 'When trained on large amounts of data, Vision Transformer attains excellent results compared to state-of-the-art convolutional networks while requiring substantially fewer computational resources.', topic: 'Computer Vision', hasCode: true, citations: 25000 },
    { title: 'Denoising Diffusion Probabilistic Models', authors: ['Jonathan Ho', 'Ajay Jain', 'Pieter Abbeel'], year: 2020, url: 'https://arxiv.org/abs/2006.11239', arxivId: '2006.11239', abstract: 'We present high quality image synthesis results using diffusion probabilistic models — a class of latent variable models inspired by nonequilibrium thermodynamics.', topic: 'Computer Vision', hasCode: true, citations: 15000 },
  ],
  'Machine Learning': [
    { title: 'Adam: A Method for Stochastic Optimization', authors: ['Diederik P. Kingma', 'Jimmy Ba'], year: 2014, url: 'https://arxiv.org/abs/1412.6980', arxivId: '1412.6980', abstract: 'We introduce Adam, an algorithm for first-order gradient-based optimization based on adaptive estimates of lower-order moments.', topic: 'Machine Learning', citations: 180000 },
    { title: 'The Lottery Ticket Hypothesis: Finding Sparse, Trainable Neural Networks', authors: ['Jonathan Frankle', 'Michael Carlin'], year: 2018, url: 'https://arxiv.org/abs/1803.03635', arxivId: '1803.03635', abstract: 'A randomly-initialized dense network contains a subnetwork that — when trained in isolation — can match the accuracy of the original network at a similar number of iterations.', topic: 'Machine Learning', citations: 5000 },
    { title: 'Batch Normalization: Accelerating Deep Network Training', authors: ['Sergey Ioffe', 'Christian Szegedy'], year: 2015, url: 'https://arxiv.org/abs/1502.03167', arxivId: '1502.03167', abstract: 'We propose a method that dramatically accelerates the training of deep networks by reducing internal covariate shift — enabling much higher learning rates.', topic: 'Machine Learning', citations: 50000 },
  ],
  'Reinforcement Learning': [
    { title: 'Playing Atari with Deep Reinforcement Learning', authors: ['Volodymyr Mnih', 'Koray Kavukcuoglu', 'David Silver'], year: 2013, url: 'https://arxiv.org/abs/1312.5602', arxivId: '1312.5602', abstract: 'The first deep learning model to successfully learn control policies directly from high-dimensional sensory input using reinforcement learning.', topic: 'Reinforcement Learning', hasCode: true, citations: 12000 },
    { title: 'Proximal Policy Optimization Algorithms', authors: ['John Schulman', 'Filip Wolski', 'Prafulla Dhariwal'], year: 2017, url: 'https://arxiv.org/abs/1707.06347', arxivId: '1707.06347', abstract: 'PPO: a family of policy gradient methods for reinforcement learning that alternate between sampling data through interaction with the environment and optimizing a surrogate objective.', topic: 'Reinforcement Learning', hasCode: true, citations: 8000 },
  ],
  default: [
    { title: 'Attention Is All You Need', authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar', 'Jakob Uszkoreit'], year: 2017, url: 'https://arxiv.org/abs/1706.03762', arxivId: '1706.03762', abstract: 'The Transformer: a model architecture based solely on attention mechanisms, eschewing recurrence and convolutions entirely.', topic: 'NLP', hasCode: true, citations: 100000 },
    { title: 'Deep Residual Learning for Image Recognition', authors: ['Kaiming He', 'Xiangyu Zhang', 'Shaoqing Ren', 'Jian Sun'], year: 2015, url: 'https://arxiv.org/abs/1512.03385', arxivId: '1512.03385', abstract: 'ResNets — a residual learning framework enabling training of networks substantially deeper than those used previously.', topic: 'Computer Vision', hasCode: true, citations: 150000 },
    { title: 'Generative Adversarial Networks', authors: ['Ian J. Goodfellow', 'Jean Pouget-Abadie', 'Mehdi Mirza'], year: 2014, url: 'https://arxiv.org/abs/1406.2661', arxivId: '1406.2661', abstract: 'We propose a new framework for estimating generative models via an adversarial process, in which two models are trained simultaneously.', topic: 'Machine Learning', citations: 60000 },
    { title: 'CLIP: Learning Transferable Visual Models From Natural Language Supervision', authors: ['Alec Radford', 'Jong Wook Kim', 'Chris Hallacy'], year: 2021, url: 'https://arxiv.org/abs/2103.00020', arxivId: '2103.00020', abstract: 'Training a neural network on (image, text) pairs enables strong zero-shot transfer to a wide variety of vision-language tasks.', topic: 'Computer Vision', hasCode: true, citations: 15000 },
    { title: 'Constitutional AI: Harmlessness from AI Feedback', authors: ['Anthropic'], year: 2022, url: 'https://arxiv.org/abs/2212.08073', arxivId: '2212.08073', abstract: 'A method for training AI assistants to be helpful, harmless, and honest — without human labels identifying harmful outputs.', topic: 'AI Safety' },
    { title: 'Scaling Laws for Neural Language Models', authors: ['Jared Kaplan', 'Sam McCandlish', 'Tom Henighan'], year: 2020, url: 'https://arxiv.org/abs/2001.08361', arxivId: '2001.08361', abstract: 'Language model performance scales as a power-law with model size, dataset size, and the amount of compute used for training.', topic: 'Machine Learning', citations: 5000 },
    { title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks', authors: ['Patrick Lewis', 'Ethan Perez', 'Aleksandra Piktus'], year: 2020, url: 'https://arxiv.org/abs/2005.11401', arxivId: '2005.11401', abstract: 'RAG: combining parametric and non-parametric memory for language generation, enabling models to access knowledge without retraining.', topic: 'NLP', citations: 4000 },
  ],
};

function getDayIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

function getTopTags(papers: Paper[]): string[] {
  const counts: Record<string, number> = {};
  papers.forEach(p => {
    const w = p.status === 'completed' ? 3 : p.status === 'reading' ? 2 : 1;
    (p.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + w; });
  });
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([t]) => t);
}

interface PaperOfTheDayProps {
  papers: Paper[];
  onPaperClick: (paper: Paper) => void;
  onPaperAdded: () => void;
}

export function PaperOfTheDay({ papers, onPaperClick, onPaperAdded }: PaperOfTheDayProps) {
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const dayIdx = getDayIndex();
  const topTags = getTopTags(papers);
  const toRead = papers.filter(p => p.status === 'to-read');

  let recommended: Paper | null = null;
  let matchedTag: string | null = null;

  if (toRead.length > 0) {
    const scored = toRead.map(p => {
      const overlap = (p.tags || []).filter(t => topTags.includes(t));
      return { paper: p, score: overlap.length, matchedTag: overlap[0] ?? null };
    });
    scored.sort((a, b) => b.score - a.score);
    const topScore = scored[0].score;
    const group = scored.filter(s => s.score === topScore);
    const pick = group[dayIdx % group.length];
    recommended = pick.paper;
    matchedTag = pick.matchedTag;
  }

  // Library paper — already has full Paper object, open directly
  if (recommended) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-100 p-5">
        <Header matchedTag={matchedTag} curated={false} />
        <div className="cursor-pointer group" onClick={() => onPaperClick(recommended!)}>
          <h4 className="text-sm font-semibold text-zinc-800 leading-snug line-clamp-3
            group-hover:text-violet-700 transition-colors mb-1.5">
            {recommended.title}
          </h4>
          <p className="text-[11px] text-zinc-400 mb-2 line-clamp-1">
            {recommended.authors.slice(0, 2).join(', ')}
            {recommended.authors.length > 2 && ` +${recommended.authors.length - 2}`}
          </p>
          {recommended.abstract && (
            <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-3 mb-3">
              {recommended.abstract}
            </p>
          )}
          <MetaChips paper={recommended} />
        </div>
        <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-zinc-100">
          <Button
            size="sm"
            className="flex-1 h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
            onClick={() => onPaperClick(recommended!)}
          >
            <BookOpen className="h-3 w-3 mr-1" /> Open Paper
          </Button>
          {recommended.url && (
            <a href={recommended.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 rounded-lg border-zinc-200">
                <ExternalLink className="h-3 w-3 text-zinc-400" />
              </Button>
            </a>
          )}
        </div>
      </div>
    );
  }

  // Curated fallback — add to library, then open in modal
  const topicKeys = Object.keys(CURATED).filter(k => k !== 'default');
  let bestTopic = 'default';
  let bestScore = 0;
  for (const topic of topicKeys) {
    const score = topTags.filter(
      t => topic.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(topic.toLowerCase())
    ).length;
    if (score > bestScore) { bestScore = score; bestTopic = topic; }
  }

  const pool = CURATED[bestTopic] ?? CURATED.default;
  const curated = pool[dayIdx % pool.length];

  // Check if this curated paper is already in the library (by title)
  const alreadyAdded = papers.find(p => p.title === curated.title);

  const handleAddAndOpen = async () => {
    if (alreadyAdded) {
      onPaperClick(alreadyAdded);
      return;
    }

    setAdding(true);
    try {
      const pdfUrl = curated.arxivId
        ? `https://arxiv.org/pdf/${curated.arxivId}`
        : undefined;

      const newPaper = await paperService.createPaper({
        title: curated.title,
        authors: curated.authors,
        year: curated.year,
        source: 'arxiv',
        url: curated.url,
        pdf_url: pdfUrl,
        abstract: curated.abstract,
        tags: [curated.topic],
        status: 'to-read',
        progress: 0,
        has_code: curated.hasCode || false,
        code_url: curated.codeUrl,
        citations: curated.citations,
        arxiv_id: curated.arxivId,
      });

      toast({ title: 'Added to your library!' });
      onPaperAdded();
      onPaperClick(newPaper);
    } catch {
      toast({ title: 'Failed to add paper', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-5">
      <Header matchedTag={null} curated />
      <h4 className="text-sm font-semibold text-zinc-800 leading-snug line-clamp-3 mb-1.5">
        {curated.title}
      </h4>
      <p className="text-[11px] text-zinc-400 mb-2">
        {curated.authors.slice(0, 2).join(', ')}
        {curated.authors.length > 2 && ` +${curated.authors.length - 2}`}
        {' · '}{curated.year}
      </p>
      <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-3 mb-3">
        {curated.abstract}
      </p>
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mb-4">
        {curated.citations && (
          <span className="flex items-center gap-0.5">
            <Star className="h-2.5 w-2.5" /> {curated.citations.toLocaleString()}
          </span>
        )}
        {curated.hasCode && (
          <span className="flex items-center gap-0.5 text-emerald-600 font-medium">
            <Code className="h-2.5 w-2.5" /> Code
          </span>
        )}
        {curated.arxivId && (
          <span className="flex items-center gap-0.5 text-blue-500">
            <FileText className="h-2.5 w-2.5" /> PDF
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 pt-3 border-t border-zinc-100">
        <Button
          size="sm"
          className="flex-1 h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
          onClick={handleAddAndOpen}
          disabled={adding}
        >
          {adding ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : alreadyAdded ? (
            <BookOpen className="h-3 w-3 mr-1" />
          ) : (
            <Plus className="h-3 w-3 mr-1" />
          )}
          {alreadyAdded ? 'Open in Library' : 'Add & Read'}
        </Button>
        <a href={curated.url} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0 rounded-lg border-zinc-200">
            <ExternalLink className="h-3 w-3 text-zinc-400" />
          </Button>
        </a>
      </div>
    </div>
  );
}

function Header({ matchedTag, curated }: { matchedTag: string | null; curated: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-7 w-7 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
      </div>
      <div>
        <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold">Paper of the Day</p>
        <p className="text-[10px] text-violet-500">
          {curated ? 'Curated pick' : matchedTag ? `Matches your interest in ${matchedTag}` : 'From your reading list'}
        </p>
      </div>
    </div>
  );
}

function MetaChips({ paper }: { paper: Paper }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-mono text-zinc-300">{paper.year}</span>
      {paper.citations != null && paper.citations > 0 && (
        <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
          <Star className="h-2.5 w-2.5" /> {paper.citations.toLocaleString()}
        </span>
      )}
      {(paper.has_code || paper.code_url) && (
        <span className="text-[10px] text-emerald-600 flex items-center gap-0.5 font-medium">
          <Code className="h-2.5 w-2.5" /> Code
        </span>
      )}
      {paper.pdf_url && (
        <span className="text-[10px] text-blue-500 flex items-center gap-0.5">
          <FileText className="h-2.5 w-2.5" /> PDF
        </span>
      )}
    </div>
  );
}
