# DD-007: Base64 Embedded Attachments Strategy

## Status: Accepted
## Date: 2026-07-19
## Decision Makers: Development Team

## Context
Originally, the application allowed uploading diagrams and system images to the server using the `/api/upload` endpoint, saving files into a flat directory `reposol/data/uploads` on the backend's filesystem. When references were needed in OSCAL documents (such as SSP diagrams), the document stored absolute API URLs (like `/api/uploads/filename.png`).

This approach caused several problems:
1. **Lack of Portability**: OSCAL documents could not be transferred or exported to other environments without losing their attachments since the files were stored locally on the server.
2. **Standard Mismatch**: Standard NIST OSCAL schemas define a formal method for storing attachments within the document itself under `back-matter.resources` using a `base64` property.
3. **Flat Directory Accumulation**: Deleting documents did not clean up their uploaded files automatically, leading to a build-up of orphaned untracked images in `reposol/data/uploads`.

## Decision
We decided to fully migrate the attachment mechanism to **Base64 embedded attachments inside `back-matter.resources` (Option 3)**:
1. **Client-Side File Processing**: When a user uploads a diagram inside the UI, the file is read client-side using `FileReader.readAsDataURL()` and stored in state as a standard data URL. No backend upload calls are made.
2. **Back-Matter Integration**: During document serialization, any `data:image/...;base64,...` URL in diagram fields is extracted. The base64 data is stored as a resource under `back-matter.resources` with a unique UUID, filename, and media-type. The diagram object links to this resource using standard OSCAL `links` with `href: "#resource-uuid"`.
3. **Resolution on Load**: When loading the document, the frontend automatically traverses `back-matter.resources`, maps resource IDs to their base64 payloads, and reconstructs the data URLs for rendering in the browser.
4. **Removal of Upload Directories and APIs**: We removed all backend file uploads/downloads routes and cleaned up the `data/uploads/` directory from the repository.

## Consequences
- **100% Schema-Compliant and Portable**: All SSP, catalog, and other OSCAL JSON documents are entirely self-contained. Exported files retain their diagrams and attachments perfectly in any OSCAL-compliant validator.
- **Fewer Backend API Dependencies**: File handling is simplified and fully client-driven.
- **Safer Backend**: Eliminating server-side binary uploads and retrieval endpoints prevents potential remote file execution, unauthenticated disk filling, and directory-traversal vulnerabilities.
- **Slightly Larger JSON Size**: Document files will be larger due to the Base64 representation of images, which is standard behavior in standard-compliant OSCAL toolchains.
