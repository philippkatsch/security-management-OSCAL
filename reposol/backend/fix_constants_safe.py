import re
with open('C:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/backend/app/constants.py', 'r', encoding='utf-8') as f:
    content = f.read()

new_def = '''class OSCALValidationException(HTTPException):
    def __init__(self, message: str, errors: list):
        super().__init__(status_code=400, detail=message)
        self.errors = errors

def validation_error_response(e):
    """Creates a standardized JSON response for validation errors."""
    errors = getattr(e, "errors", [])
    raise OSCALValidationException(f"Validation failed: {e.message}", errors)
'''

content = re.sub(
    r'def validation_error_response\(e\):\n    \"\"\"Creates a standardized JSON response for validation errors\.\"\"\"\n    errors = getattr\(e, "errors", \[\]\)\n    return JSONResponse\(\n        status_code=400,\n        content=\{\n            "detail": f"Validation failed: \{e\.message\}",\n            "errors": errors\n        \}\n    \)',
    new_def,
    content
)

with open('C:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/backend/app/constants.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("DONE")
