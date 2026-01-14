import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, Play, Download } from 'lucide-react';

const APITester = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [payload, setPayload] = useState('{}');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API}/templates`);
      const published = res.data.filter(t => t.active_version_id);
      setTemplates(published);
      if (published.length > 0) {
        setSelectedTemplate(published[0].key);
        setPayload(JSON.stringify(getSamplePayload(), null, 2));
      }
    } catch (error) {
      toast.error('Failed to load templates');
    }
  };

  const getSamplePayload = () => {
    return {
      client: {
        pan_number: "ABCDE1234F",
        name: "Arjun Kapoor",
        address: "123 MG Road, Mumbai",
        us_resident: false
      }
    };
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(payload);
    } catch (e) {
      toast.error('Invalid JSON payload');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/generate`, {
        template_key: selectedTemplate,
        version: 'latest',
        payload: parsedPayload,
        options: {
          flatten: true,
          output: 'base64'
        }
      });

      setResponse(res.data);
      toast.success('PDF generated successfully');
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (typeof detail === 'object' && detail.validation_errors) {
        toast.error(
          <div>
            <div className="font-semibold mb-1">Validation Failed</div>
            {detail.validation_errors.map((err, i) => (
              <div key={i} className="text-xs mt-1">{err}</div>
            ))}
          </div>
        );
      } else {
        toast.error(detail || 'Failed to generate PDF');
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!response?.pdf_data) return;

    const byteCharacters = atob(response.pdf_data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated.pdf';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="container mx-auto px-8 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">API Tester</h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium uppercase tracking-wider">Test PDF Generation</p>
          </div>
          <Button
            variant="outline"
            data-testid="back-to-dashboard-api"
            onClick={() => navigate('/')}
            className="font-medium"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-8 py-12 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Request Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Request</CardTitle>
              <CardDescription>Configure your PDF generation request</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="template-select">Template</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger id="template-select" data-testid="api-template-select" className="mt-1.5">
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.key}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="payload">Payload (JSON)</Label>
                <Textarea
                  id="payload"
                  data-testid="api-payload-input"
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  className="mt-1.5 font-mono text-xs h-96"
                  placeholder='{ "client": { "name": "..." } }'
                />
              </div>

              <Button
                data-testid="generate-pdf-button"
                onClick={handleGenerate}
                disabled={loading || !selectedTemplate}
                className="w-full font-medium"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Generate PDF
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Response Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Response</CardTitle>
              <CardDescription>Generated PDF output</CardDescription>
            </CardHeader>
            <CardContent>
              {response ? (
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-md p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Submission ID</span>
                      <span className="text-xs font-mono text-muted-foreground">{response.submission_id}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Status</span>
                      <span className="text-xs font-medium text-green-600">Success</span>
                    </div>
                  </div>

                  {response.pdf_data && (
                    <>
                      <Button
                        data-testid="download-pdf-button"
                        onClick={downloadPDF}
                        variant="outline"
                        className="w-full font-medium"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                      </Button>

                      <div className="border rounded-md overflow-hidden">
                        <iframe
                          src={`data:application/pdf;base64,${response.pdf_data}`}
                          className="w-full h-96"
                          title="Generated PDF Preview"
                        />
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="text-muted-foreground mb-3">
                    <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-muted-foreground">No PDF generated yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Configure the request and click Generate</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default APITester;