import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { FileText, Plus, Upload, Settings, TestTube, MoreVertical, Archive, Trash, FileUp } from 'lucide-react';

const Dashboard = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', key: '' });
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
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

      // file_url is now a relative URL like /api/files/{filename}
      const fullFileUrl = `${BACKEND_URL}${uploadResponse.data.file_url}`;

      // Create version with uploaded PDF
      const versionResponse = await axios.post(`${API}/versions`, {
        template_id: selectedTemplate.id,
        file_url: fullFileUrl,
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

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return;
    
    try {
      await axios.delete(`${API}/templates/${templateToDelete.id}`);
      toast.success('Template deleted successfully');
      setTemplates(templates.filter(t => t.id !== templateToDelete.id));
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const handleArchiveTemplate = async (template) => {
    try {
      if (!template.active_version_id) {
        toast.error('No published version to archive');
        return;
      }
      
      // Archive the active version
      await axios.patch(`${API}/versions/${template.active_version_id}`, {
        field_schema: [],  // Keep existing fields
        status: 'ARCHIVED'
      });
      
      toast.success('Template archived successfully');
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to archive template');
    }
  };

  const handlePublishLatest = async (template) => {
    try {
      const versionsRes = await axios.get(`${API}/templates/${template.id}/versions`);
      const versions = versionsRes.data;
      
      if (versions.length === 0) {
        toast.error('No versions available');
        return;
      }
      
      const latestVersion = versions[0];
      await axios.patch(`${API}/versions/${latestVersion.id}`, {
        field_schema: latestVersion.field_schema,
        status: 'PUBLISHED'
      });
      
      toast.success('Latest version published successfully');
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to publish version');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="container mx-auto px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">Form Studio</h1>
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
                className="hover:shadow-md transition-shadow duration-200"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleTemplateClick(template)}>
                          <FileUp className="h-4 w-4 mr-2" />
                          Open Builder
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {template.active_version_id ? (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveTemplate(template);
                          }}>
                            <Archive className="h-4 w-4 mr-2" />
                            Archive Version
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handlePublishLatest(template);
                          }}>
                            <FileUp className="h-4 w-4 mr-2" />
                            Publish Latest
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTemplateToDelete(template);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Delete Template
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardTitle className="mt-4 cursor-pointer" onClick={() => handleTemplateClick(template)}>
                    {template.name}
                  </CardTitle>
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
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? This action cannot be undone and will remove all versions of this template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;