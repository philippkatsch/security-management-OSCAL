import React from 'react';

const generateUUID = () => crypto.randomUUID();

export interface DiagramUploaderProps {
  diagrams?: any[];
  onDiagramsChange?: (diagrams: any[]) => void;
  backMatter?: any;
  onBackMatterChange?: (bm: any) => void;
  onUploadDiagram?: (diagram: any, resource: any) => void;
  onRemoveDiagram?: (diagramUuid: string, resourceUuid?: string) => void;
  label?: string;
  editMode?: boolean;
}

export default function DiagramUploader({ 
  diagrams = [], 
  onDiagramsChange = () => {}, 
  backMatter = {}, 
  onBackMatterChange = () => {}, 
  onUploadDiagram,
  onRemoveDiagram,
  label = '', 
  editMode = false 
}: DiagramUploaderProps) {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result;
      const resourceUuid = generateUUID();
      const diagramUuid = generateUUID();

      const newResource = {
        uuid: resourceUuid,
        title: file.name,
        rlinks: [{ href: base64Data }]
      };

      const newDiagram = {
        uuid: diagramUuid,
        caption: file.name.replace(/\.[^/.]+$/, ''),
        description: `Diagram for ${label || 'system boundary'}`,
        links: [{ rel: 'diagram', href: `#${resourceUuid}` }]
      };

      if (onUploadDiagram) {
        onUploadDiagram(newDiagram, newResource);
      } else {
        const newBackMatter = {
          ...backMatter,
          resources: [...(backMatter.resources || []), newResource]
        };
        onBackMatterChange(newBackMatter);
        onDiagramsChange([...diagrams, newDiagram]);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeDiagram = (diagramId: string) => {
    const diagram = diagrams.find(d => d.uuid === diagramId);
    if (!diagram) return;
    
    let resourceUuid: string | undefined = undefined;
    const link = diagram.links?.find((l: any) => l.rel === 'diagram');
    if (link && link.href && link.href.startsWith('#')) {
      resourceUuid = link.href.substring(1);
    }

    if (onRemoveDiagram) {
      onRemoveDiagram(diagramId, resourceUuid);
    } else {
      const newDiagrams = diagrams.filter(d => d.uuid !== diagramId);
      onDiagramsChange(newDiagrams);

      if (resourceUuid) {
         const newResources = (backMatter.resources || []).filter((r: any) => r.uuid !== resourceUuid);
         onBackMatterChange({ ...backMatter, resources: newResources });
      }
    }
  };

  const updateDiagram = (diagramId: string, updates: Record<string, any>) => {
    const newDiagrams = diagrams.map(d => {
      if (d.uuid === diagramId) {
        return { ...d, ...updates };
      }
      return d;
    });
    onDiagramsChange(newDiagrams);
  };

  return (
    <div className="diagram-uploader mt-2">
      {diagrams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {diagrams.map(diagram => {
            const link = diagram.links?.find((l: any) => l.rel === 'diagram');
            let imgSrc = '';
            if (link && link.href && link.href.startsWith('#')) {
              const resId = link.href.substring(1);
              const res = (backMatter.resources || []).find((r: any) => r.uuid === resId);
              if (res && res.rlinks && res.rlinks[0]) {
                imgSrc = res.rlinks[0].href;
              }
            } else if (link && link.href) {
              imgSrc = link.href;
            }

            return (
              <div key={diagram.uuid} className="relative border rounded p-3 bg-gray-50 dark:bg-gray-800 flex flex-col gap-2">
                {imgSrc ? (
                  <img
                    src={imgSrc}
                    alt={diagram.description || diagram.caption || label}
                    className="max-w-full h-auto max-h-48 object-contain rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                  />
                ) : (
                  <div className="text-gray-500 italic py-6 text-center">Image preview not available</div>
                )}

                {/* Caption & Description */}
                {editMode ? (
                  <div className="space-y-2 mt-1">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Caption</label>
                      <input
                        type="text"
                        className="w-full text-xs p-1.5 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="Diagram caption / title"
                        value={diagram.caption || ''}
                        onChange={(e) => updateDiagram(diagram.uuid, { caption: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Accessibility Alt-Text (508)</label>
                      <input
                        type="text"
                        className="w-full text-xs p-1.5 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        placeholder="Detailed accessibility description"
                        value={diagram.description || ''}
                        onChange={(e) => updateDiagram(diagram.uuid, { description: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-1">
                    {diagram.caption && (
                      <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">{diagram.caption}</div>
                    )}
                    {diagram.description && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 italic mt-0.5">{diagram.description}</div>
                    )}
                  </div>
                )}

                {editMode && (
                  <button
                    type="button"
                    onClick={() => removeDiagram(diagram.uuid)}
                    className="text-red-500 text-xs hover:underline mt-auto pt-2 text-left"
                  >
                    Remove Diagram
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {editMode && (
        <input 
          type="file" 
          aria-label={`Upload Diagram for ${label}`}
          accept="image/*" 
          onChange={handleFileUpload} 
          className="text-sm border p-1 rounded w-full dark:bg-gray-700 mt-2"
        />
      )}
    </div>
  );
}
