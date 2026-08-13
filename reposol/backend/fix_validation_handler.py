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
content = re.sub(r'def validation_error_response.*?raise HTTPException\(\s*status_code=400,\s*detail=f"Validation failed: \{e\.message\}"\s*\)', new_def, content, flags=re.DOTALL)

with open('C:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/backend/app/constants.py', 'w', encoding='utf-8') as f:
    f.write(content)

with open('C:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/backend/app/main.py', 'r', encoding='utf-8') as f:
    main_content = f.read()

handler = '''from app.constants import OSCALValidationException
from fastapi import Request

@app.exception_handler(OSCALValidationException)
async def oscal_validation_exception_handler(request: Request, exc: OSCALValidationException):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "errors": exc.errors}
    )

for router in routers:'''
main_content = main_content.replace('for router in routers:', handler)

with open('C:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/backend/app/main.py', 'w', encoding='utf-8') as f:
    f.write(main_content)

print("DONE")
