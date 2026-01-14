import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { FileText, Plus, Upload, Settings, TestTube } from 'lucide-react';

const Dashboard = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', key: '' });
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await axios.get(`${API}/templates`);
      setTemplates(response.data);
    } catch (error) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.key) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const response = await axios.post(`${API}/templates`, newTemplate);
      toast.success('Template created successfully');
      setTemplates([response.data, ...templates]);
      setCreateDialogOpen(false);
      setNewTemplate({ name: '', key: '' });
      setSelectedTemplate(response.data);
      setUploadDialogOpen(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create template');
    }
  };

  const handleUploadPDF = async () => {
    if (!pdfFile) {
      toast.error('Please select a PDF file');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);

      const uploadResponse = await axios.post(`${API}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Create version with uploaded PDF
      const versionResponse = await axios.post(`${API}/versions`, {
        template_id: selectedTemplate.id,
        file_url: uploadResponse.data.file_url,
        dimensions: { width: 595.28, height: 841.89 }, // A4 default
        field_schema: []
      });

      toast.success('PDF uploaded successfully');
      setUploadDialogOpen(false);
      setPdfFile(null);
      navigate(`/builder/${selectedTemplate.id}/${versionResponse.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  };

  const handleTemplateClick = async (template) => {
    try {
      const response = await axios.get(`${API}/templates/${template.id}/versions`);
      if (response.data.length === 0) {
        setSelectedTemplate(template);
        setUploadDialogOpen(true);
      } else {
        navigate(`/builder/${template.id}/${response.data[0].id}`);
      }
    } catch (error) {
      toast.error('Failed to load template versions');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="container mx-auto px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">PMS Form Studio</h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium uppercase tracking-wider">Template Management</p>
          </div>
          <div className="flex gap-3">
            <Button
              data-testid="api-tester-button"
              variant="outline"
              onClick={() => navigate('/api-tester')}
              className="font-medium"
            >
              <TestTube className="h-4 w-4 mr-2" />
              API Tester
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="create-template-button" className="font-medium">
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Template</DialogTitle>
                  <DialogDescription>
                    Create a template to start building your PDF forms
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="name">Template Name</Label>
                    <Input
                      id="name"
                      data-testid="template-name-input"
                      placeholder="e.g., Individual KYC Agreement"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="key">Template Key</Label>
                    <Input
                      id="key"
                      data-testid="template-key-input"
                      placeholder="e.g., pms_kyc_individual"
                      value={newTemplate.key}
                      onChange={(e) => setNewTemplate({ ...newTemplate, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1.5">Used in API calls (lowercase, underscores only)</p>
                  </div>
                  <Button data-testid="create-template-submit" onClick={handleCreateTemplate} className="w-full font-medium">
                    Create Template
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload PDF Template</DialogTitle>
            <DialogDescription>
              Upload the blank PDF that will be used as the base template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-border rounded-md p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <Input
                type="file"
                accept=".pdf"
                data-testid="pdf-upload-input"
                onChange={(e) => setPdfFile(e.target.files[0])}
                className="max-w-xs mx-auto"
              />
              {pdfFile && (
                <p className="text-sm text-foreground mt-3 font-medium">{pdfFile.name}</p>
              )}
            </div>
            <Button
              data-testid="upload-pdf-button"
              onClick={handleUploadPDF}
              disabled={!pdfFile || uploading}
              className="w-full font-medium"
            >
              {uploading ? 'Uploading...' : 'Upload & Start Building'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <main className="container mx-auto px-8 py-12">
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
            <p className="text-muted-foreground mt-4">Loading templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-20 max-w-2xl mx-auto">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-6" />
            <h2 className="text-3xl font-medium tracking-tight mb-3">No Templates Yet</h2>
            <p className="text-base text-muted-foreground mb-8 leading-relaxed">
              Create your first template to start building dynamic PDF forms with precision field placement.
            </p>
            <Button data-testid="empty-state-create-button" onClick={() => setCreateDialogOpen(true)} size="lg" className="font-medium">
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Template
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {templates.map((template) => (
              <Card
                key={template.id}
                data-testid={`template-card-${template.key}`}
                className="hover:shadow-md transition-shadow duration-200 cursor-pointer"
                onClick={() => handleTemplateClick(template)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Settings menu
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardTitle className="mt-4">{template.name}</CardTitle>
                  <CardDescription className="font-mono text-xs mt-1">{template.key}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground">
                    {template.active_version_id ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-secondary rounded-md font-medium">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md font-medium">
                        <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                        Draft
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;