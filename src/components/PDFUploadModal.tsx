import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2, FileText, X, AlertCircle } from 'lucide-react';
import { paperService } from '@/services/paperService';
import { useToast } from '@/hooks/use-toast';

interface PDFUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PDFUploadModal({ open, onClose, onSuccess }: PDFUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const [abstract, setAbstract] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
        // Auto-fill title from filename
        if (!title) {
          setTitle(droppedFile.name.replace('.pdf', '').replace(/[-_]/g, ' '));
        }
      } else {
        setError('Please upload a PDF file');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        if (!title) {
          setTitle(selectedFile.name.replace('.pdf', '').replace(/[-_]/g, ' '));
        }
      } else {
        setError('Please upload a PDF file');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      setError('Please enter a title');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      let pdfUrl = '';
      
      // Upload PDF if provided — stored in IndexedDB, so up to 50MB is fine
      if (file) {
        if (file.size > 50 * 1024 * 1024) {
          setError('PDF file is too large. Maximum size is 50MB.');
          setUploading(false);
          return;
        }

        pdfUrl = await paperService.uploadPDF(file);
      }

      // Create paper record
      await paperService.createPaper({
        title,
        authors: authors.split(',').map(a => a.trim()).filter(a => a),
        year: parseInt(year) || new Date().getFullYear(),
        source: 'Uploaded',
        pdf_url: pdfUrl || undefined,
        abstract: abstract || '',
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
        status: 'to-read',
        progress: 0,
        has_code: false
      });

      toast({ title: 'Paper uploaded successfully!' });
      onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Upload error:', error);
      setError(error.message || 'Upload failed. Please try again.');
      toast({ 
        title: 'Upload failed', 
        description: error.message || 'Please try again',
        variant: 'destructive' 
      });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setTitle('');
    setAuthors('');
    setYear('');
    setAbstract('');
    setTags('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-indigo-600" />
            Upload Research Paper
          </DialogTitle>
          <DialogDescription>
            Add a paper to your library. PDF upload is optional - you can add paper details manually.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* PDF Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive 
                ? 'border-indigo-500 bg-indigo-50' 
                : file 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-300 hover:border-indigo-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-green-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div>
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-2">
                  Drag and drop your PDF here, or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-indigo-600 hover:underline font-medium"
                  >
                    browse
                  </button>
                </p>
                <p className="text-sm text-gray-400">PDF files only, max 50MB</p>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter paper title"
              required
            />
          </div>

          <div>
            <Label htmlFor="authors">Authors (comma-separated)</Label>
            <Input
              id="authors"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              placeholder="e.g., John Doe, Jane Smith"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder={new Date().getFullYear().toString()}
                min="1900"
                max={new Date().getFullYear() + 1}
              />
            </div>
            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., ML, NLP, Deep Learning"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="abstract">Abstract</Label>
            <Textarea
              id="abstract"
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              placeholder="Enter paper abstract (optional)"
              rows={4}
            />
          </div>

          {/* CSE-specific tags suggestion */}
          <div>
            <Label className="text-sm text-gray-500">Suggested CSE Tags</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {['Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision', 'Algorithms', 'Data Structures', 'Networks', 'Security', 'Databases', 'AI'].map(tag => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="cursor-pointer hover:bg-indigo-50"
                  onClick={() => {
                    const currentTags = tags.split(',').map(t => t.trim()).filter(t => t);
                    if (!currentTags.includes(tag)) {
                      setTags([...currentTags, tag].join(', '));
                    }
                  }}
                >
                  + {tag}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={!title || uploading} className="flex-1">
              {uploading ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Add Paper
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
