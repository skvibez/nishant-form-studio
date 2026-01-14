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
import { ArrowLeft, Play, Download, RefreshCw, Copy } from 'lucide-react';

const APITester = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedTemplateObj, setSelectedTemplateObj] = useState(null);
  const [fieldSchema, setFieldSchema] = useState([]);
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
        setSelectedTemplateObj(published[0]);
        await loadTemplateFields(published[0]);
      }
    } catch (error) {
      toast.error('Failed to load templates');
    }
  };

  const loadTemplateFields = async (template) => {
    try {
      const versionRes = await axios.get(`${API}/versions/${template.active_version_id}`);
      setFieldSchema(versionRes.data.field_schema || []);
      generateSamplePayload(versionRes.data.field_schema || []);
    } catch (error) {
      console.error('Failed to load field schema:', error);
      setFieldSchema([]);
      setPayload('{}');
    }
  };

  const generateSamplePayload = (fields) => {
    if (fields.length === 0) {
      setPayload('{}');
      return;
    }

    const payload = {};
    const fieldComments = {};

    fields.forEach(field => {
      const keys = field.key.split('.');
      let current = payload;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      const lastKey = keys[keys.length - 1];
      
      // Generate sample value based on type
      let sampleValue = '';
      let commentParts = [`Type: ${field.type}`];
      
      switch (field.type) {
        case 'TEXT':
        case 'TEXTAREA':
          sampleValue = 'Sample Text';
          break;
        case 'EMAIL':
          sampleValue = 'user@example.com';
          break;
        case 'PHONE':
          sampleValue = '+1234567890';
          break;
        case 'NUMBER':
          sampleValue = 123;
          break;
        case 'CHECKBOX':
        case 'RADIO':
          sampleValue = true;
          commentParts.push('Values: true/false');
          break;
        case 'DATE':
          sampleValue = '2025-01-14';
          commentParts.push('Format: YYYY-MM-DD');
          break;
        default:
          sampleValue = 'Sample';
      }
      
      // Add validation info to comments
      if (field.validation) {
        if (field.validation.required) {
          commentParts.push('REQUIRED');
        }
        if (field.validation.regex) {
          commentParts.push(`Pattern: ${field.validation.regex}`);
        }
        if (field.validation.maxLen) {
          commentParts.push(`MaxLen: ${field.validation.maxLen}`);
        }
      }
      
      current[lastKey] = sampleValue;
      fieldComments[field.key] = `// ${commentParts.join(', ')}`;
    });

    // Format JSON with inline comments
    const jsonLines = JSON.stringify(payload, null, 2).split('\n');
    const withComments = jsonLines.map(line => {
      // Match property keys in JSON
      const match = line.match(/^\s*"([^"]+)":/);
      if (match) {
        const key = match[1];
        // Find the full path for nested keys
        const fullKey = findKeyInObject(payload, key);
        if (fullKey && fieldComments[fullKey]) {
          // Remove trailing comma if exists, add comment, then add comma back
          const hasComma = line.trim().endsWith(',');
          const lineWithoutComma = hasComma ? line.slice(0, -1) : line;
          return `${lineWithoutComma}  ${fieldComments[fullKey]}${hasComma ? ',' : ''}`;
        }
      }
      return line;
    });
    
    setPayload(withComments.join('\n'));
  };

  const findKeyInObject = (obj, searchKey, prefix = '') => {
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (key === searchKey) {
        return fullKey;
      }
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        const found = findKeyInObject(obj[key], searchKey, fullKey);
        if (found) return found;
      }
    }
    return null;
  };

  const handleTemplateChange = async (templateKey) => {
    setSelectedTemplate(templateKey);
    const template = templates.find(t => t.key === templateKey);
    setSelectedTemplateObj(template);
    if (template) {
      await loadTemplateFields(template);
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    let parsedPayload;
    try {
      // Remove comments before parsing
      const cleanJson = payload.split('\n').map(line => {
        const commentIndex = line.indexOf('//');
        return commentIndex > 0 ? line.substring(0, commentIndex).trim() : line;
      }).join('\n');
      parsedPayload = JSON.parse(cleanJson);
    } catch (e) {
      toast.error('Invalid JSON payload. Please fix syntax errors.');
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
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  const copyCurl = () => {
    // Remove comments from payload
    const cleanJson = payload.split('\n').map(line => {
      const commentIndex = line.indexOf('//');
      return commentIndex > 0 ? line.substring(0, commentIndex).trim() : line;
    }).join('\n');

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(cleanJson);
    } catch (e) {
      toast.error('Invalid JSON - fix syntax before copying cURL');
      return;
    }

    const curlCommand = `curl -X POST "${window.location.origin}/api/generate" \\
  -H "Content-Type: application/json" \\
  -d '{
  "template_key": "${selectedTemplate}",
  "version": "latest",
  "payload": ${JSON.stringify(parsedPayload, null, 2).replace(/\n/g, '\n    ')},
  "options": {
    "flatten": true,
    "output": "base64"
  }
}'`;

    navigator.clipboard.writeText(curlCommand).then(() => {
      toast.success('cURL command copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
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
                <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
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
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="payload">Payload (JSON with comments)</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="refresh-payload-button"
                    onClick={() => generateSamplePayload(fieldSchema)}
                    className="h-7 text-xs"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refresh
                  </Button>
                </div>
                <Textarea
                  id="payload"
                  data-testid="api-payload-input"
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  className="mt-1.5 font-mono text-xs h-96"
                  placeholder='{ "client": { "name": "..." } }'
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Comments show field types and validation rules
                </p>
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

              <Button
                data-testid="copy-curl-button"
                onClick={copyCurl}
                disabled={!selectedTemplate}
                variant="outline"
                className="w-full font-medium"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy cURL Command
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

                  {response.pdf_data ? (
                    <>
                      <div className="border rounded-md overflow-hidden">
                        <iframe
                          src={`data:application/pdf;base64,${response.pdf_data}`}
                          className="w-full h-96"
                          title="Generated PDF Preview"
                        />
                      </div>
                      
                      <Button
                        data-testid="download-pdf-button"
                        onClick={downloadPDF}
                        className="w-full font-medium"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">PDF generated but preview unavailable</p>
                      <p className="text-xs text-muted-foreground mt-1">Use the download button above to get the file</p>
                    </div>
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