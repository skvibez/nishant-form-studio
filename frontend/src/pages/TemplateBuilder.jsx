import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import { Document, Page, pdfjs } from 'react-pdf';
import { DndContext, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Resizable } from 'react-resizable-box';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { toast } from 'sonner';
import { ArrowLeft, Save, Eye, Plus, Trash2 } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-resizable-box/dist/index.css';

// Configure PDF.js worker from jsdelivr CDN (more reliable)
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Draggable & Resizable Field Component
const DraggableResizableField = ({ field, isSelected, onClick, onUpdate, canvasScale, showPreview, previewValues }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: field.id,
    disabled: false
  });

  const [size, setSize] = useState({ width: field.rect.w * canvasScale, height: field.rect.h * canvasScale });

  const handleResizeStop = (e, direction, ref, delta) => {
    const newWidth = (size.width + delta.width) / canvasScale;
    const newHeight = (size.height + delta.height) / canvasScale;
    onUpdate(field.id, { rect: { ...field.rect, w: newWidth, h: newHeight } });
    setSize({ width: size.width + delta.width, height: size.height + delta.height });
  };

  // Get preview content
  const getPreviewContent = () => {
    if (!showPreview || !previewValues) return field.key;
    
    const keys = field.key.split('.');
    let value = previewValues;
    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return field.key;
      }
    }
    
    if (field.type === 'CHECKBOX' || field.type === 'RADIO') {
      return value ? '✓' : '';
    }
    
    return value || field.key;
  };

  const style = {
    position: 'absolute',
    left: `${field.rect.x * canvasScale}px`,
    top: `${field.rect.y * canvasScale}px`,
    transform: CSS.Transform.toString(transform),
    border: isSelected ? '2px solid hsl(212 100% 48%)' : '2px dashed hsl(240 3.8% 46.1%)',
    backgroundColor: 'rgba(212, 212, 255, 0.1)',
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'none',
    zIndex: isSelected ? 10 : 1,
  };

  return (
    <Resizable
      width={size.width}
      height={size.height}
      onResizeStop={handleResizeStop}
      enable={{
        top: false,
        right: isSelected,
        bottom: isSelected,
        left: false,
        topRight: false,
        bottomRight: isSelected,
        bottomLeft: false,
        topLeft: false
      }}
      handleStyles={{
        right: { backgroundColor: 'hsl(212 100% 48%)', width: '4px', right: '0' },
        bottom: { backgroundColor: 'hsl(212 100% 48%)', height: '4px', bottom: '0' },
        bottomRight: { backgroundColor: 'hsl(212 100% 48%)', width: '8px', height: '8px', right: '0', bottom: '0' }
      }}
    >
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={onClick}
        className="w-full h-full flex items-center justify-start px-1"
      >
        <div 
          className="text-xs font-mono truncate"
          style={{ 
            fontSize: `${Math.min(field.style.fontSize * canvasScale * 0.8, 12)}px`,
            color: showPreview ? field.style.color : '#666',
            fontWeight: showPreview ? 'normal' : '500'
          }}
        >
          {getPreviewContent()}
        </div>
      </div>
    </Resizable>
  );
};

const TemplateBuilder = () => {
  const { templateId, versionId } = useParams();
  const navigate = useNavigate();
  const [version, setVersion] = useState(null);
  const [template, setTemplate] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 595.28, height: 841.89 });
  const [canvasScale, setCanvasScale] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [previewValues, setPreviewValues] = useState({});
  const pageRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [templateId, versionId]);

  const fetchData = async () => {
    try {
      const [templateRes, versionRes] = await Promise.all([
        axios.get(`${API}/templates/${templateId}`),
        axios.get(`${API}/versions/${versionId}`)
      ]);
      setTemplate(templateRes.data);
      setVersion(versionRes.data);
      setPdfDimensions(versionRes.data.dimensions);
      setFields(versionRes.data.field_schema || []);
      generatePreviewValues(versionRes.data.field_schema || []);
    } catch (error) {
      toast.error('Failed to load template data');
    }
  };

  const generatePreviewValues = (fieldSchema) => {
    const values = {};
    fieldSchema.forEach(field => {
      const keys = field.key.split('.');
      let current = values;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      
      const lastKey = keys[keys.length - 1];
      switch (field.type) {
        case 'EMAIL':
          current[lastKey] = 'user@example.com';
          break;
        case 'PHONE':
          current[lastKey] = '+1234567890';
          break;
        case 'NUMBER':
          current[lastKey] = '123';
          break;
        case 'CHECKBOX':
        case 'RADIO':
          current[lastKey] = true;
          break;
        case 'DATE':
          current[lastKey] = '14-01-2025';
          break;
        default:
          current[lastKey] = 'Sample Text';
      }
    });
    setPreviewValues(values);
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const onPageLoadSuccess = (page) => {
    const viewport = page.getViewport({ scale: 1 });
    const canvas = pageRef.current;
    if (canvas) {
      const canvasWidth = canvas.offsetWidth;
      const scale = canvasWidth / viewport.width;
      setCanvasScale(scale);
      setPdfDimensions({ width: viewport.width, height: viewport.height });
    }
  };

  const addField = (type) => {
    const newField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      key: `field.${fields.length + 1}`,
      type: type,
      pageIndex: currentPage,
      rect: {
        x: 100,
        y: 100,
        w: type === 'CHECKBOX' || type === 'RADIO' ? 30 : 150,
        h: type === 'TEXTAREA' ? 60 : 30
      },
      style: {
        fontFamily: 'Helvetica',
        fontSize: 11,
        alignment: 'LEFT',
        color: '#000000',
        tickChar: '✓'
      },
      validation: {
        required: false,
        regex: null,
        maxLen: null,
        charSpacing: null
      }
    };
    setFields([...fields, newField]);
    setSelectedField(newField);
  };

  const updateField = (fieldId, updates) => {
    setFields(fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
    if (selectedField?.id === fieldId) {
      setSelectedField({ ...selectedField, ...updates });
    }
  };

  const handleDragEnd = (event) => {
    const { active, delta } = event;
    if (delta.x !== 0 || delta.y !== 0) {
      const field = fields.find(f => f.id === active.id);
      if (field) {
        const xPt = field.rect.x + (delta.x / canvasScale);
        const yPt = field.rect.y + (delta.y / canvasScale);
        updateField(active.id, { rect: { ...field.rect, x: xPt, y: yPt } });
      }
    }
  };

  const updateFieldProperty = (property, value) => {
    if (!selectedField) return;

    const updates = {};
    if (property.includes('.')) {
      const [parent, child] = property.split('.');
      updates[parent] = { ...selectedField[parent], [child]: value };
    } else {
      updates[property] = value;
    }

    updateField(selectedField.id, updates);
  };

  const deleteField = (fieldId) => {
    setFields(fields.filter(f => f.id !== fieldId));
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
    }
  };

  const saveTemplate = async () => {
    try {
      await axios.patch(`${API}/versions/${versionId}`, {
        field_schema: fields,
        status: version.status
      });
      toast.success('Template saved successfully');
    } catch (error) {
      toast.error('Failed to save template');
    }
  };

  const publishVersion = async () => {
    try {
      await axios.patch(`${API}/versions/${versionId}`, {
        field_schema: fields,
        status: 'PUBLISHED'
      });
      toast.success('Version published successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to publish version');
    }
  };

  if (!version || !template) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
      </div>
    );
  }

  const pageFields = fields.filter(f => f.pageIndex === currentPage);

  return (
    <div className="h-screen overflow-hidden flex">
      {/* Left Sidebar - Tools */}
      <div className="w-64 flex-shrink-0 border-r bg-background p-4 overflow-y-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            data-testid="back-to-dashboard"
            onClick={() => navigate('/')}
            className="mb-4 font-medium"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h2 className="text-2xl font-medium tracking-tight">{template.name}</h2>
          <p className="text-sm text-muted-foreground mt-1 font-mono">v{version.version_number}</p>
        </div>

        <div className="mb-6 p-3 bg-muted/50 rounded-md">
          <div className="flex items-center justify-between">
            <Label htmlFor="preview-toggle" className="text-sm font-medium">Show Preview</Label>
            <Switch
              id="preview-toggle"
              checked={showPreview}
              onCheckedChange={setShowPreview}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Display sample values in fields</p>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Add Fields</Label>
          <div className="space-y-2">
            {['TEXT', 'TEXTAREA', 'NUMBER', 'EMAIL', 'PHONE', 'CHECKBOX', 'RADIO', 'DATE', 'SIGNATURE'].map(type => (
              <Button
                key={type}
                data-testid={`add-${type.toLowerCase()}-field`}
                onClick={() => addField(type)}
                variant="outline"
                className="w-full justify-start font-medium text-xs"
              >
                <Plus className="h-3 w-3 mr-2" />
                {type.charAt(0) + type.slice(1).toLowerCase().replace('_', ' ')}
              </Button>
            ))}
          </div>
        </div>

        {numPages > 1 && (
          <div className="mt-6">
            <Label className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Page</Label>
            <Select value={String(currentPage)} onValueChange={(v) => setCurrentPage(Number(v))}>
              <SelectTrigger data-testid="page-selector" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: numPages }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>Page {i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="mt-6 space-y-2">
          <Button
            data-testid="save-template-button"
            onClick={saveTemplate}
            className="w-full font-medium"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Template
          </Button>
          {version.status !== 'PUBLISHED' && (
            <Button
              data-testid="publish-version-button"
              onClick={publishVersion}
              variant="outline"
              className="w-full font-medium"
            >
              <Eye className="h-4 w-4 mr-2" />
              Publish Version
            </Button>
          )}
        </div>
      </div>

      {/* Center - PDF Canvas */}
      <div className="flex-1 bg-muted/30 relative overflow-auto flex items-center justify-center p-12">
        <div className="relative" ref={pageRef}>
          <Document
            file={version.file_url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div>Loading PDF...</div>}
          >
            <Page
              pageNumber={currentPage + 1}
              onLoadSuccess={onPageLoadSuccess}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              width={800}
            />
          </Document>

          {/* Field Overlays with DndContext */}
          <DndContext onDragEnd={handleDragEnd}>
            <div className="absolute inset-0 pointer-events-none">
              {pageFields.map((field) => (
                <div key={field.id} className="pointer-events-auto">
                  <DraggableResizableField
                    field={field}
                    isSelected={selectedField?.id === field.id}
                    onClick={() => setSelectedField(field)}
                    onUpdate={updateField}
                    canvasScale={canvasScale}
                    showPreview={showPreview}
                    previewValues={previewValues}
                  />
                </div>
              ))}
            </div>
          </DndContext>
        </div>
      </div>

      {/* Right Sidebar - Properties */}
      <div className="w-80 flex-shrink-0 border-l bg-background p-4 overflow-y-auto">
        {selectedField ? (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-medium tracking-tight">Properties</h3>
                <p className="text-xs text-muted-foreground font-mono mt-1">{selectedField.id}</p>
              </div>
              <Button
                data-testid="delete-field-button"
                variant="ghost"
                size="icon"
                onClick={() => deleteField(selectedField.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            <div>
              <Label htmlFor="field-key">Field Key</Label>
              <Input
                id="field-key"
                data-testid="field-key-input"
                value={selectedField.key}
                onChange={(e) => updateFieldProperty('key', e.target.value)}
                className="mt-1.5 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1.5">Used to map data (e.g., client.pan_number)</p>
            </div>

            <div>
              <Label htmlFor="field-type">Type</Label>
              <Select value={selectedField.type} onValueChange={(v) => updateFieldProperty('type', v)}>
                <SelectTrigger id="field-type" data-testid="field-type-select" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEXT">Text</SelectItem>
                  <SelectItem value="TEXTAREA">Text Area</SelectItem>
                  <SelectItem value="NUMBER">Number</SelectItem>
                  <SelectItem value="EMAIL">Email</SelectItem>
                  <SelectItem value="PHONE">Phone</SelectItem>
                  <SelectItem value="CHECKBOX">Checkbox</SelectItem>
                  <SelectItem value="RADIO">Radio Button</SelectItem>
                  <SelectItem value="DATE">Date</SelectItem>
                  <SelectItem value="SIGNATURE">Signature</SelectItem>
                  <SelectItem value="SIGNATURE_ANCHOR">Signature Anchor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(selectedField.type === 'TEXT' || 
              selectedField.type === 'TEXTAREA' ||
              selectedField.type === 'NUMBER' ||
              selectedField.type === 'EMAIL' ||
              selectedField.type === 'PHONE') && (
              <>
                <div>
                  <Label htmlFor="font-size">Font Size (pt)</Label>
                  <Input
                    id="font-size"
                    data-testid="font-size-input"
                    type="number"
                    value={selectedField.style.fontSize}
                    onChange={(e) => updateFieldProperty('style.fontSize', Number(e.target.value))}
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="alignment">Alignment</Label>
                  <Select
                    value={selectedField.style.alignment}
                    onValueChange={(v) => updateFieldProperty('style.alignment', v)}
                  >
                    <SelectTrigger id="alignment" data-testid="alignment-select" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEFT">Left</SelectItem>
                      <SelectItem value="CENTER">Center</SelectItem>
                      <SelectItem value="RIGHT">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="required">Required</Label>
              <Select
                value={String(selectedField.validation.required)}
                onValueChange={(v) => updateFieldProperty('validation.required', v === 'true')}
              >
                <SelectTrigger id="required" data-testid="required-select" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">No</SelectItem>
                  <SelectItem value="true">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="regex">Validation Regex</Label>
              <Input
                id="regex"
                data-testid="regex-input"
                value={selectedField.validation.regex || ''}
                onChange={(e) => updateFieldProperty('validation.regex', e.target.value || null)}
                placeholder="e.g., ^[A-Z]{5}[0-9]{4}[A-Z]{1}$"
                className="mt-1.5 font-mono text-xs"
              />
            </div>

            <div className="pt-4 border-t">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Position (PDF Points)</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <Label htmlFor="x" className="text-xs">X</Label>
                  <Input
                    id="x"
                    type="number"
                    value={selectedField.rect.x.toFixed(2)}
                    onChange={(e) => updateFieldProperty('rect.x', Number(e.target.value))}
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="y" className="text-xs">Y</Label>
                  <Input
                    id="y"
                    type="number"
                    value={selectedField.rect.y.toFixed(2)}
                    onChange={(e) => updateFieldProperty('rect.y', Number(e.target.value))}
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="w" className="text-xs">Width</Label>
                  <Input
                    id="w"
                    type="number"
                    value={selectedField.rect.w.toFixed(2)}
                    onChange={(e) => updateFieldProperty('rect.w', Number(e.target.value))}
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="h" className="text-xs">Height</Label>
                  <Input
                    id="h"
                    type="number"
                    value={selectedField.rect.h.toFixed(2)}
                    onChange={(e) => updateFieldProperty('rect.h', Number(e.target.value))}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <div className="text-muted-foreground mb-3">
                <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">Select a field to view properties</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateBuilder;
