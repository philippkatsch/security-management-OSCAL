import React from 'react';

const generateUUID = () => crypto.randomUUID();

export default function DiagramUploader({ diagrams = [], onDiagramsChange, backMatter = {}, onBackMatterChange, label, editMode }) {
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
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

      const newBackMatter = {
        ...backMatter,
        resources: [...(backMatter.resources || []), newResource]
      };

      const newDiagram = {
        uuid: diagramUuid,
        description: `Diagram for ${label}`,
        links: [{ rel: 'diagram', href: `#${resourceUuid}` }]
      };

      onBackMatterChange(newBackMatter);
      onDiagramsChange([...diagrams, newDiagram]);
    };
    reader.readAsDataURL(file);
  };

  const removeDiagram = (diagramId) => {
    const diagram = diagrams.find(d => d.uuid === diagramId);
    if (!diagram) return;
    
    let resourceUuid = null;
    const link = diagram.links?.find(l => l.rel === 'diagram');
    if (link && link.href && link.href.startsWith('#')) {
      resourceUuid = link.href.substring(1);
    }

    const newDiagrams = diagrams.filter(d => d.uuid !== diagramId);
    onDiagramsChange(newDiagrams);

    if (resourceUuid) {
       const newResources = (backMatter.resources || []).filter(r => r.uuid !== resourceUuid);
       onBackMatterChange({ ...backMatter, resources: newResources });
    }
  };

  return (
    <div className="diagram-uploader mt-2">
      {diagrams.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          {diagrams.map(diagram => {
            const link = diagram.links?.find(l => l.rel === 'diagram');
            let imgSrc = '';
            if (link && link.href && link.href.startsWith('#')) {
              const resId = link.href.substring(1);
              const res = (backMatter.resources || []).find(r => r.uuid === resId);
              if (res && res.rlinks && res.rlinks[0]) {
                imgSrc = res.rlinks[0].href;
              }
            } else if (link && link.href) {
                imgSrc = link.href;
            }

            return (
              <div key={diagram.uuid} className="relative border rounded p-2 bg-gray-50 dark:bg-gray-800 flex flex-col items-center">
                {imgSrc ? (
                  <img src={imgSrc} alt={diagram.description} className="max-w-full h-auto max-h-48 object-contain mb-2" />
                ) : (
                  <div className="text-gray-500 italic mb-2">Image not found</div>
                )}
                {editMode && (
                  <button onClick={() => removeDiagram(diagram.uuid)} className="text-red-500 text-xs hover:underline mt-auto">Remove Diagram</button>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {editMode && (
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileUpload} 
          className="text-sm border p-1 rounded w-full dark:bg-gray-700 mt-2"
        />
      )}
    </div>
  );
}
