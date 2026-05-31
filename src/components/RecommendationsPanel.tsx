import React, { useState, useEffect } from 'react';
import { Paper } from '@/types/paper';
import { SearchResult, getRecommendations, getAIRecommendations } from '@/services/paperSearchService';
import { paperService } from '@/services/paperService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Sparkles, Plus, ExternalLink, Star, RefreshCw, Brain, Code } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RecommendationsPanelProps {
  currentPaper: Paper | null;
  onPaperAdded: () => void;
}

export function RecommendationsPanel({ currentPaper, onPaperAdded }: RecommendationsPanelProps) {
  const [recommendations, setRecommendations] = useState<SearchResult[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [addingPaper, setAddingPaper] = useState<string | null>(null);
  const [showAI, setShowAI] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (currentPaper) {
      fetchRecommendations();
    }
  }, [currentPaper?.id]);

  const fetchRecommendations = async () => {
    if (!currentPaper) return;
    
    setLoading(true);
    try {
      const results = await getRecommendations({
        title: currentPaper.title,
        abstract: currentPaper.abstract,
        tags: currentPaper.tags
      });
      setRecommendations(results);
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
      // Set some default recommendations based on paper tags
      setRecommendations(getDefaultRecommendations(currentPaper));
    } finally {
      setLoading(false);
    }
  };

  const fetchAIRecommendations = async () => {
    if (!currentPaper) return;
    
    setLoadingAI(true);
    setShowAI(true);
    try {
      const result = await getAIRecommendations({
        title: currentPaper.title,
        abstract: currentPaper.abstract,
        tags: currentPaper.tags
      });
      setAiRecommendations(result);
    } catch (error) {
      console.error('Failed to fetch AI recommendations:', error);
      setAiRecommendations(getDefaultAIRecommendations(currentPaper));
    } finally {
      setLoadingAI(false);
    }
  };

  const handleAddToLibrary = async (paper: SearchResult) => {
    setAddingPaper(paper.id);
    
    try {
      await paperService.createPaper({
        title: paper.title,
        authors: paper.authors,
        year: paper.year || new Date().getFullYear(),
        source: paper.source,
        url: paper.url,
        pdf_url: paper.pdf_url,
        abstract: paper.abstract,
        tags: [],
        status: 'to-read',
        progress: 0,
        has_code: paper.has_code,
        code_url: paper.code_url,
        citations: paper.citations,
        arxiv_id: paper.arxiv_id,
        doi: paper.doi
      });
      
      toast({ title: 'Paper added to library!' });
      onPaperAdded();
      
      // Remove from recommendations
      setRecommendations(prev => prev.filter(p => p.id !== paper.id));
    } catch (error) {
      toast({ title: 'Failed to add paper', variant: 'destructive' });
    } finally {
      setAddingPaper(null);
    }
  };

  // Render markdown-like content
  const renderAIContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('## ')) {
        return <h3 key={idx} className="text-sm font-bold text-indigo-900 mt-3 mb-1">{line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('**') && line.includes('**')) {
        const parts = line.split('**');
        return (
          <p key={idx} className="text-xs text-gray-700 my-1">
            {parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part)}
          </p>
        );
      }
      if (line.match(/^\d+\./)) {
        return <p key={idx} className="text-xs text-gray-700 ml-2 my-0.5">{line}</p>;
      }
      if (line.startsWith('- ')) {
        return <p key={idx} className="text-xs text-gray-700 ml-2 my-0.5">• {line.substring(2)}</p>;
      }
      if (line.trim() === '') return null;
      return <p key={idx} className="text-xs text-gray-700 my-0.5">{line}</p>;
    });
  };

  if (!currentPaper) {
    return (
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm text-center py-4">
            Select a paper to see related recommendations
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            Related Papers
          </CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={fetchAIRecommendations} disabled={loadingAI} title="Get AI suggestions">
              <Brain className={`h-4 w-4 ${loadingAI ? 'animate-pulse' : ''}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchRecommendations} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-500 line-clamp-1">Based on: {currentPaper.title}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* AI Recommendations */}
        {showAI && (
          <div className="bg-white/80 rounded-lg p-3 border border-indigo-200 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-semibold text-indigo-900">AI Research Directions</span>
            </div>
            {loadingAI ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                <span className="ml-2 text-xs text-gray-600">Analyzing paper...</span>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto">
                {renderAIContent(aiRecommendations)}
              </div>
            )}
          </div>
        )}

        {/* Paper Recommendations */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            <span className="ml-2 text-gray-600">Finding related papers...</span>
          </div>
        ) : recommendations.length > 0 ? (
          recommendations.slice(0, 6).map((paper) => (
            <div
              key={paper.id}
              className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition"
            >
              <h4 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">
                {paper.title}
              </h4>
              <p className="text-xs text-gray-500 mb-2 line-clamp-1">
                {paper.authors.slice(0, 2).join(', ')}
                {paper.authors.length > 2 && ' et al.'}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex gap-1 flex-wrap">
                  <Badge variant="outline" className="text-xs">{paper.source}</Badge>
                  {paper.year && <Badge variant="outline" className="text-xs">{paper.year}</Badge>}
                  {paper.citations && paper.citations > 0 && (
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      <Star className="h-2 w-2" /> {paper.citations}
                    </Badge>
                  )}
                  {paper.has_code && (
                    <Badge className="text-xs bg-green-100 text-green-700">
                      <Code className="h-2 w-2 mr-1" /> Code
                    </Badge>
                  )}
                </div>
                
                <div className="flex gap-1">
                  {paper.url && (
                    <a href={paper.url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleAddToLibrary(paper)}
                    disabled={addingPaper === paper.id}
                  >
                    {addingPaper === paper.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-sm text-center py-4">
            No recommendations found. Try refreshing or use AI suggestions.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Default recommendations based on paper tags/title
function getDefaultRecommendations(paper: Paper): SearchResult[] {
  const title = paper.title.toLowerCase();
  const tags = paper.tags || [];
  
  const recommendations: SearchResult[] = [];
  
  if (title.includes('transformer') || title.includes('attention') || tags.includes('NLP')) {
    recommendations.push({
      id: 'rec-1',
      title: 'Attention Is All You Need',
      authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar'],
      year: 2017,
      abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...',
      source: 'Sample',
      url: 'https://arxiv.org/abs/1706.03762',
      citations: 90000,
      has_code: true
    });
  }
  
  if (title.includes('neural') || title.includes('deep') || tags.includes('Deep Learning')) {
    recommendations.push({
      id: 'rec-2',
      title: 'Deep Residual Learning for Image Recognition',
      authors: ['Kaiming He', 'Xiangyu Zhang', 'Shaoqing Ren'],
      year: 2016,
      abstract: 'Deeper neural networks are more difficult to train. We present a residual learning framework...',
      source: 'Sample',
      url: 'https://arxiv.org/abs/1512.03385',
      citations: 150000,
      has_code: true
    });
  }
  
  if (title.includes('language') || title.includes('bert') || title.includes('gpt')) {
    recommendations.push({
      id: 'rec-3',
      title: 'BERT: Pre-training of Deep Bidirectional Transformers',
      authors: ['Jacob Devlin', 'Ming-Wei Chang', 'Kenton Lee'],
      year: 2018,
      abstract: 'We introduce a new language representation model called BERT...',
      source: 'Sample',
      url: 'https://arxiv.org/abs/1810.04805',
      citations: 75000,
      has_code: true
    });
  }
  
  // Add some general ML recommendations
  recommendations.push({
    id: 'rec-4',
    title: 'Adam: A Method for Stochastic Optimization',
    authors: ['Diederik P. Kingma', 'Jimmy Ba'],
    year: 2015,
    abstract: 'We introduce Adam, an algorithm for first-order gradient-based optimization...',
    source: 'Sample',
    url: 'https://arxiv.org/abs/1412.6980',
    citations: 180000,
    has_code: true
  });
  
  return recommendations.slice(0, 5);
}

// Default AI recommendations
function getDefaultAIRecommendations(paper: Paper): string {
  const title = paper.title;
  const tags = paper.tags?.join(', ') || 'machine learning';
  
  return `Based on "${title}", here are suggested research directions:

1. **Survey Papers** - Look for comprehensive surveys covering ${tags}
2. **Recent Advances** - Check NeurIPS, ICML, ACL 2024-2025 proceedings
3. **Implementation Studies** - Find papers with code on Papers With Code
4. **Benchmark Comparisons** - Look for papers comparing methods on standard datasets
5. **Application Papers** - Explore real-world applications of the methodology

**Suggested Keywords**: ${tags}, state-of-the-art, benchmark, evaluation`;
}
