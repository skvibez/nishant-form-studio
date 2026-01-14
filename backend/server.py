from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_
import os
import logging
from pathlib import Path
import json
import subprocess
import base64
from datetime import datetime, timezone

from database import init_db, get_db, Template, TemplateVersion, Submission, VersionStatus
from models import (
    TemplateCreate, TemplateResponse, VersionCreate, VersionUpdate, 
    VersionResponse, GenerateRequest, GenerateResponse, FieldSchema
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI()
api_router = APIRouter(prefix="/api")

@app.on_event("startup")
async def startup():
    await init_db()
    logging.info("Database initialized")

# Template Management
@api_router.post("/templates", response_model=TemplateResponse)
async def create_template(template: TemplateCreate, db: AsyncSession = Depends(get_db)):
    # Check if key already exists
    result = await db.execute(select(Template).where(Template.key == template.key))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A template with this key already exists")
    
    db_template = Template(
        name=template.name,
        key=template.key
    )
    db.add(db_template)
    await db.commit()
    await db.refresh(db_template)
    return db_template

@api_router.get("/templates", response_model=list[TemplateResponse])
async def list_templates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Template).order_by(Template.created_at.desc()))
    templates = result.scalars().all()
    return templates

@api_router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(template)
    await db.commit()
    return {"message": "Template deleted successfully"}

# Version Management
@api_router.post("/versions", response_model=VersionResponse)
async def create_version(version: VersionCreate, db: AsyncSession = Depends(get_db)):
    # Get template
    result = await db.execute(select(Template).where(Template.id == version.template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get highest version number
    result = await db.execute(
        select(TemplateVersion.version_number)
        .where(TemplateVersion.template_id == version.template_id)
        .order_by(TemplateVersion.version_number.desc())
    )
    last_version = result.scalar_one_or_none()
    next_version = (last_version or 0) + 1
    
    db_version = TemplateVersion(
        template_id=version.template_id,
        version_number=next_version,
        file_url=version.file_url,
        dimensions=version.dimensions,
        field_schema=[f.model_dump() for f in version.field_schema]
    )
    db.add(db_version)
    await db.commit()
    await db.refresh(db_version)
    return db_version

@api_router.get("/versions/{version_id}", response_model=VersionResponse)
async def get_version(version_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TemplateVersion).where(TemplateVersion.id == version_id))
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version

@api_router.get("/templates/{template_id}/versions", response_model=list[VersionResponse])
async def list_versions(template_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TemplateVersion)
        .where(TemplateVersion.template_id == template_id)
        .order_by(TemplateVersion.version_number.desc())
    )
    versions = result.scalars().all()
    return versions

@api_router.patch("/versions/{version_id}", response_model=VersionResponse)
async def update_version(version_id: str, update_data: VersionUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TemplateVersion).where(TemplateVersion.id == version_id))
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    version.field_schema = [f.model_dump() for f in update_data.field_schema]
    if update_data.status:
        version.status = update_data.status
        
        # If publishing, set as active version
        if update_data.status == VersionStatus.PUBLISHED:
            await db.execute(
                update(Template)
                .where(Template.id == version.template_id)
                .values(active_version_id=version_id)
            )
    
    await db.commit()
    await db.refresh(version)
    return version

# File Upload
@api_router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Save to local storage for MVP
    upload_dir = Path("/app/uploads")
    upload_dir.mkdir(exist_ok=True)
    
    filename = f"{datetime.now().timestamp()}_{file.filename}"
    file_path = upload_dir / filename
    
    contents = await file.read()
    with open(file_path, 'wb') as f:
        f.write(contents)
    
    # Return relative URL that frontend can use
    return {"file_url": f"/api/files/{filename}", "filename": file.filename}

# Serve uploaded files
@api_router.get("/files/{filename}")
async def get_file(filename: str):
    file_path = Path("/app/uploads") / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    with open(file_path, 'rb') as f:
        content = f.read()
    
    return Response(content=content, media_type="application/pdf")

# PDF Generation
@api_router.post("/generate", response_model=GenerateResponse)
async def generate_pdf(request: GenerateRequest, db: AsyncSession = Depends(get_db)):
    # Get template
    result = await db.execute(select(Template).where(Template.key == request.template_key))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{request.template_key}' not found")
    
    # Get version
    if request.version == "latest":
        if not template.active_version_id:
            raise HTTPException(status_code=400, detail="No published version available. Please publish a version first.")
        version_id = template.active_version_id
    else:
        version_id = request.version
    
    result = await db.execute(select(TemplateVersion).where(TemplateVersion.id == version_id))
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Validate payload against field schema
    errors = []
    for field in version.field_schema:
        field_obj = FieldSchema(**field)
        value = get_nested_value(request.payload, field_obj.key)
        
        if field_obj.validation.required and (value is None or value == ""):
            errors.append(f"Field '{field_obj.key}' is required but missing")
        
        if value and field_obj.validation.regex:
            import re
            if not re.match(field_obj.validation.regex, str(value)):
                errors.append(f"Field '{field_obj.key}' does not match the required format")
        
        if value and field_obj.validation.maxLen:
            if len(str(value)) > field_obj.validation.maxLen:
                errors.append(f"Field '{field_obj.key}' exceeds maximum length of {field_obj.validation.maxLen}")
    
    if errors:
        raise HTTPException(status_code=400, detail={"validation_errors": errors})
    
    # Call Node.js generator
    try:
        input_data = {
            "fileUrl": version.file_url,
            "fieldSchema": version.field_schema,
            "payload": request.payload,
            "options": request.options
        }
        
        result = subprocess.run(
            ['node', '/app/pdf_service/generator.js', json.dumps(input_data)],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"PDF generation failed: {result.stderr}")
        
        pdf_data = result.stdout.strip()
        
        # Create submission record
        submission = Submission(
            template_id=template.id,
            version_id=version.id,
            payload=request.payload,
            status="completed"
        )
        db.add(submission)
        await db.commit()
        await db.refresh(submission)
        
        return GenerateResponse(
            pdf_data=pdf_data if request.options.get("output") == "base64" else None,
            submission_id=submission.id
        )
        
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="PDF generation timed out")
    except Exception as e:
        logging.error(f"PDF Generation Error: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred while generating the PDF: {str(e)}")

@api_router.get("/generate/{submission_id}/download")
async def download_pdf(submission_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Submission).where(Submission.id == submission_id))
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Regenerate PDF
    result = await db.execute(select(TemplateVersion).where(TemplateVersion.id == submission.version_id))
    version = result.scalar_one_or_none()
    
    input_data = {
        "fileUrl": version.file_url,
        "fieldSchema": version.field_schema,
        "payload": submission.payload,
        "options": {"flatten": True, "output": "base64"}
    }
    
    result = subprocess.run(
        ['node', '/app/pdf_service/generator.js', json.dumps(input_data)],
        capture_output=True,
        text=True,
        timeout=30
    )
    
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail="PDF generation failed")
    
    pdf_data = base64.b64decode(result.stdout.strip())
    
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=generated.pdf"}
    )

def get_nested_value(obj, path):
    keys = path.split('.')
    value = obj
    for key in keys:
        if value is None or not isinstance(value, dict):
            return None
        value = value.get(key)
    return value

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)