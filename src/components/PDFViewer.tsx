import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Loader2, FileText, BookOpen, Lightbulb, Download, ExternalLink, Copy, Check, AlertCircle } from 'lucide-react';
import { paperService } from '@/services/paperService';
import { indexedDBService } from '@/services/indexedDBService';
import { PDFInlineViewer } from './PDFInlineViewer';
import { useToast } from '@/hooks/use-toast';

interface PDFViewerProps {
  pdfUrl: string;
  paperId: string;
  paperTitle?: string;
  paperAbstract?: string;
  initialSummary?: string;
  initialKeyPoints?: string;
}

export function PDFViewer({ pdfUrl, paperId, paperTitle, paperAbstract, initialSummary, initialKeyPoints }: PDFViewerProps) {
  const [activeTab, setActiveTab] = useState<'view' | 'summary' | 'keypoints'>('view');
  const [summarizing, setSummarizing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [summary, setSummary] = useState<string>(initialSummary || '');
  const [keyPoints, setKeyPoints] = useState<string>(initialKeyPoints || '');
  const [copied, setCopied] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const { toast } = useToast();

  const isDataUrl = pdfUrl?.startsWith('data:');
  const isIdbUrl = pdfUrl?.startsWith('idb://');

  // Resolve idb:// URLs to object URLs from IndexedDB
  useEffect(() => {
    if (!isIdbUrl) return;
    const id = pdfUrl.replace('idb://', '');
    let cancelled = false;

    indexedDBService.getPDF(id).then((blob) => {
      if (cancelled || !blob) return;
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setResolvedUrl(url);
    });

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [pdfUrl, isIdbUrl]);

  const effectivePdfUrl = isIdbUrl ? resolvedUrl : pdfUrl;

  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      // Use paper title and abstract for summarization
      const textToSummarize = paperAbstract 
        ? `Title: ${paperTitle}\n\nAbstract: ${paperAbstract}`
        : paperTitle || 'Research paper content';
      
      const result = await paperService.summarizePaper(textToSummarize, paperId);
      setSummary(result);
      setActiveTab('summary');
      await paperService.updatePaper(paperId, { summary: result });
      toast({ title: 'Paper summarized!' });
    } catch (error: any) {
      console.error('Summarization error:', error);
      const fallback = getFallbackSummary(paperTitle);
      setSummary(fallback);
      setActiveTab('summary');
      await paperService.updatePaper(paperId, { summary: fallback }).catch(() => {});
      toast({
        title: 'Using offline summary',
        description: 'AI service unavailable, showing tips instead',
      });
    } finally {
      setSummarizing(false);
    }
  };

  const handleExtractKeyPoints = async () => {
    setExtracting(true);
    try {
      const textToAnalyze = paperAbstract 
        ? `Title: ${paperTitle}\n\nAbstract: ${paperAbstract}`
        : paperTitle || 'Research paper content';
      
      const result = await paperService.extractKeyPoints(textToAnalyze, paperId);
      setKeyPoints(result);
      setActiveTab('keypoints');
      await paperService.updatePaper(paperId, { key_points: result });
      toast({ title: 'Key points extracted!' });
    } catch (error: any) {
      console.error('Extraction error:', error);
      const fallback = getFallbackKeyPoints(paperTitle);
      setKeyPoints(fallback);
      setActiveTab('keypoints');
      await paperService.updatePaper(paperId, { key_points: fallback }).catch(() => {});
      toast({
        title: 'Using offline extraction',
        description: 'AI service unavailable, showing tips instead',
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Copied to clipboard!' });
    } catch (error) {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  const handleDownload = () => {
    const url = effectivePdfUrl || pdfUrl;
    if (isDataUrl || isIdbUrl) {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${paperTitle || 'paper'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      window.open(url, '_blank');
    }
  };

  // Render markdown-like content
  const renderContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="text-lg font-bold text-gray-900 mt-4 mb-2">{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-md font-semibold text-gray-800 mt-3 mb-1">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={idx} className="font-semibold text-gray-800 mt-2">{line.replace(/\*\*/g, '')}</p>;
      }
      if (line.match(/^\d+\./)) {
        return <p key={idx} className="text-gray-700 ml-4 my-1">{line}</p>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <p key={idx} className="text-gray-700 ml-4 my-1">• {line.substring(2)}</p>;
      }
      if (line.startsWith('*') && line.endsWith('*')) {
        return <p key={idx} className="text-gray-500 italic text-sm mt-2">{line.replace(/\*/g, '')}</p>;
      }
      if (line.trim() === '') {
        return <br key={idx} />;
      }
      return <p key={idx} className="text-gray-700 my-1">{line}</p>;
    });
  };

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button 
          onClick={handleSummarize} 
          disabled={summarizing}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
        >
          {summarizing ? (
            <Loader2 className="animate-spin mr-2 h-4 w-4" />
          ) : (
            <FileText className="mr-2 h-4 w-4" />
          )}
          Summarize with AI
        </Button>
        
        <Button 
          onClick={handleExtractKeyPoints} 
          disabled={extracting}
          variant="outline"
        >
          {extracting ? (
            <Loader2 className="animate-spin mr-2 h-4 w-4" />
          ) : (
            <Lightbulb className="mr-2 h-4 w-4" />
          )}
          Extract Key Points
        </Button>

        {pdfUrl && (
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        )}

        {pdfUrl && !isDataUrl && !isIdbUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in New Tab
            </Button>
          </a>
        )}
      </div>

      {/* Tabs for View/Summary/Key Points */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="view" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> View PDF
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Summary
          </TabsTrigger>
          <TabsTrigger value="keypoints" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" /> Key Points
          </TabsTrigger>
        </TabsList>

        <TabsContent value="view" className="mt-4">
          {!pdfUrl ? (
            <div className="border rounded-lg bg-gray-50 p-8 text-center">
              <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">No PDF available for this paper</p>
              <p className="text-sm text-gray-500">Upload a PDF or use the AI features to analyze the paper metadata</p>
            </div>
          ) : isIdbUrl && !resolvedUrl ? (
            <div className="border rounded-lg bg-gray-50 h-[700px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mr-3" />
              <span className="text-gray-600">Loading PDF…</span>
            </div>
          ) : (
            <PDFInlineViewer
              pdfUrl={effectivePdfUrl || pdfUrl}
              paperId={paperId}
            />
          )}
        </TabsContent>

        <TabsContent value="summary" className="mt-4">
          {summary ? (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-indigo-900 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  AI-Generated Summary
                </h4>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleCopy(summary)}
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="prose prose-sm max-w-none">
                {renderContent(summary)}
              </div>
              <div className="mt-4 pt-4 border-t border-indigo-200">
                <Badge variant="secondary" className="text-xs">
                  Powered by Groq AI (Llama 3.1)
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Click "Summarize with AI" to generate a summary</p>
              <p className="text-sm mt-2">Uses Groq's Llama 3.1 model for fast, accurate summaries</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="keypoints" className="mt-4">
          {keyPoints ? (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-amber-900 flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Key Technical Points
                </h4>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleCopy(keyPoints)}
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="prose prose-sm max-w-none">
                {renderContent(keyPoints)}
              </div>
              <div className="mt-4 pt-4 border-t border-amber-200">
                <Badge variant="secondary" className="text-xs">
                  Powered by Groq AI (Llama 3.1)
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Click "Extract Key Points" to analyze the paper</p>
              <p className="text-sm mt-2">Identifies main contributions, methodology, and findings</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Fallback summary when AI is unavailable
function getFallbackSummary(title?: string): string {
  return `## Summary Generation Tips

Since the AI service is temporarily unavailable, here's how to understand "${title || 'this paper'}" effectively:

### Quick Reading Strategy

1. **Read the Abstract** - Get the main idea in 200-300 words
2. **Check the Introduction** - Understand the problem and motivation
3. **Jump to Conclusion** - See the main findings and contributions
4. **Review Figures** - Visual summaries of key results

### Key Sections to Focus On

- **Problem Statement** - What challenge is being addressed?
- **Methodology** - How did they solve it?
- **Results** - What did they achieve?
- **Discussion** - What are the implications?

*Tip: Try summarizing again later when the AI service is available.*`;
}

// Fallback key points when AI is unavailable
function getFallbackKeyPoints(title?: string): string {
  return `## Key Points Extraction Tips

The AI service is temporarily unavailable. Here's how to extract key points from "${title || 'this paper'}":

### What to Look For

1. **Novel Contributions** - What's new in this paper?
2. **Technical Approach** - What methods or algorithms are used?
3. **Experimental Setup** - How were experiments conducted?
4. **Main Results** - What are the quantitative findings?
5. **Comparisons** - How does it compare to prior work?
6. **Limitations** - What are the acknowledged weaknesses?
7. **Future Work** - What directions are suggested?

### Quick Tips

- Check **bold text** and **section headings** for emphasis
- Look at **tables** for comparative results
- Review **figures** for visual explanations
- Read the **abstract** for a condensed summary

*Try again later for AI-powered extraction.*`;
}
