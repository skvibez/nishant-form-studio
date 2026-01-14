import requests
import sys
import json
from datetime import datetime

class PMSFormStudioTester:
    def __init__(self, base_url="https://pdf-template-engine.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.template_id = None
        self.version_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {}
        if data and not files:
            headers['Content-Type'] = 'application/json'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_list_templates_empty(self):
        """Test listing templates when empty"""
        success, response = self.run_test(
            "List Templates (Empty)",
            "GET",
            "templates",
            200
        )
        return success and isinstance(response, list)

    def test_create_template(self):
        """Test creating a new template"""
        # Use timestamp to ensure unique key
        timestamp = int(datetime.now().timestamp())
        template_data = {
            "name": f"Test KYC Form {timestamp}",
            "key": f"test_kyc_{timestamp}"
        }
        success, response = self.run_test(
            "Create Template",
            "POST",
            "templates",
            200,
            data=template_data
        )
        if success and 'id' in response:
            self.template_id = response['id']
            print(f"   Created template ID: {self.template_id}")
            return True
        return False

    def test_list_templates_with_data(self):
        """Test listing templates with data"""
        success, response = self.run_test(
            "List Templates (With Data)",
            "GET",
            "templates",
            200
        )
        return success and len(response) > 0

    def test_get_template(self):
        """Test getting a specific template"""
        if not self.template_id:
            print("❌ Skipped - No template ID available")
            return False
            
        success, response = self.run_test(
            "Get Template",
            "GET",
            f"templates/{self.template_id}",
            200
        )
        return success and response.get('id') == self.template_id

    def test_upload_pdf(self):
        """Test PDF upload"""
        try:
            with open('/app/uploads/sample_kyc_form.pdf', 'rb') as f:
                files = {'file': ('sample_kyc_form.pdf', f, 'application/pdf')}
                success, response = self.run_test(
                    "Upload PDF",
                    "POST",
                    "upload",
                    200,
                    files=files
                )
                return success and 'file_url' in response
        except FileNotFoundError:
            print("❌ Failed - Sample PDF file not found")
            return False

    def test_create_version(self):
        """Test creating a template version"""
        if not self.template_id:
            print("❌ Skipped - No template ID available")
            return False

        version_data = {
            "template_id": self.template_id,
            "file_url": "/app/uploads/sample_kyc_form.pdf",
            "dimensions": {"width": 595.28, "height": 841.89},
            "field_schema": []
        }
        success, response = self.run_test(
            "Create Version",
            "POST",
            "versions",
            200,
            data=version_data
        )
        if success and 'id' in response:
            self.version_id = response['id']
            print(f"   Created version ID: {self.version_id}")
            return True
        return False

    def test_get_version(self):
        """Test getting a specific version"""
        if not self.version_id:
            print("❌ Skipped - No version ID available")
            return False
            
        success, response = self.run_test(
            "Get Version",
            "GET",
            f"versions/{self.version_id}",
            200
        )
        return success and response.get('id') == self.version_id

    def test_update_version_with_fields(self):
        """Test updating version with field schema"""
        if not self.version_id:
            print("❌ Skipped - No version ID available")
            return False

        field_schema = [
            {
                "id": "field_1",
                "key": "client.name",
                "type": "TEXT",
                "pageIndex": 0,
                "rect": {"x": 100, "y": 100, "w": 200, "h": 30},
                "style": {
                    "fontFamily": "Helvetica",
                    "fontSize": 12,
                    "alignment": "LEFT",
                    "color": "#000000"
                },
                "validation": {"required": True}
            },
            {
                "id": "field_2",
                "key": "client.us_resident",
                "type": "CHECKBOX",
                "pageIndex": 0,
                "rect": {"x": 100, "y": 200, "w": 20, "h": 20},
                "style": {
                    "fontFamily": "Helvetica",
                    "fontSize": 12,
                    "alignment": "LEFT",
                    "color": "#000000",
                    "tickChar": "✓"
                },
                "validation": {"required": False}
            }
        ]

        update_data = {
            "field_schema": field_schema,
            "status": "PUBLISHED"
        }
        success, response = self.run_test(
            "Update Version with Fields",
            "PATCH",
            f"versions/{self.version_id}",
            200,
            data=update_data
        )
        return success and response.get('status') == 'PUBLISHED'

    def test_list_template_versions(self):
        """Test listing versions for a template"""
        if not self.template_id:
            print("❌ Skipped - No template ID available")
            return False
            
        success, response = self.run_test(
            "List Template Versions",
            "GET",
            f"templates/{self.template_id}/versions",
            200
        )
        return success and len(response) > 0

    def test_generate_pdf_validation_error(self):
        """Test PDF generation with validation errors"""
        generate_data = {
            "template_key": "test_kyc",
            "version": "latest",
            "payload": {
                "client": {
                    "us_resident": True
                    # Missing required 'name' field
                }
            },
            "options": {"flatten": True, "output": "base64"}
        }
        success, response = self.run_test(
            "Generate PDF (Validation Error)",
            "POST",
            "generate",
            400,
            data=generate_data
        )
        return not success  # We expect this to fail with validation error

    def test_generate_pdf_success(self):
        """Test successful PDF generation"""
        generate_data = {
            "template_key": "test_kyc",
            "version": "latest",
            "payload": {
                "client": {
                    "name": "John Doe",
                    "us_resident": True
                }
            },
            "options": {"flatten": True, "output": "base64"}
        }
        success, response = self.run_test(
            "Generate PDF (Success)",
            "POST",
            "generate",
            200,
            data=generate_data
        )
        return success and 'submission_id' in response

    def test_generate_pdf_invalid_template(self):
        """Test PDF generation with invalid template key"""
        generate_data = {
            "template_key": "nonexistent_template",
            "version": "latest",
            "payload": {"test": "data"},
            "options": {"flatten": True, "output": "base64"}
        }
        success, response = self.run_test(
            "Generate PDF (Invalid Template)",
            "POST",
            "generate",
            404,
            data=generate_data
        )
        return not success  # We expect this to fail

def main():
    print("🚀 Starting PMS Form Studio Backend API Tests")
    print("=" * 60)
    
    tester = PMSFormStudioTester()
    
    # Run all tests in sequence
    tests = [
        tester.test_list_templates_empty,
        tester.test_create_template,
        tester.test_list_templates_with_data,
        tester.test_get_template,
        tester.test_upload_pdf,
        tester.test_create_version,
        tester.test_get_version,
        tester.test_list_template_versions,
        tester.test_update_version_with_fields,
        tester.test_generate_pdf_validation_error,
        tester.test_generate_pdf_success,
        tester.test_generate_pdf_invalid_template
    ]
    
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Backend API Test Results:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All backend tests passed!")
        return 0
    else:
        print("⚠️  Some backend tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())