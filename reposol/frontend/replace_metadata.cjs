const fs = require('fs');
const files = [
  'src/components/assessment-plan/APPage.tsx',
  'src/components/assessment-results/ARPage.tsx',
  'src/components/poam/POAMPage.tsx',
  'src/components/ssp/SSPPage.tsx',
  'src/components/profile/ProfilePage.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes('StandardMetadataTab')) {
    content = content.replace(/import \{ MetadataEditor \} from '[^']+';/, 
      "import { MetadataEditor } from '../shared/MetadataEditor';\nimport { StandardMetadataTab } from '../shared/tabs/StandardMetadataTab';");
  }

  if (file.includes('ARPage')) {
    content = content.replace(/<div className=\{styles\['ar-metadata'\]\}>[\s\S]*?<\/div>/, 
      `<div className={styles['ar-metadata']}>
            <StandardMetadataTab 
              document={activeDoc['assessment-results']} 
              onChange={(updated) => {
                const newDoc = { ...activeDoc };
                newDoc['assessment-results'] = updated;
                setDoc(newDoc);
                pushUndoRedoState(newDoc);
              }} 
            />
          </div>`);
  } else if (file.includes('POAMPage')) {
    content = content.replace(/<div className=\"poam-metadata-section\"[\s\S]*?<\/div>\n\s*<\/div>\n\s*<\/div>/, 
      `<div className="poam-metadata-section" style={{ padding: '24px' }}>
            <StandardMetadataTab 
              document={poam} 
              onChange={(updated) => {
                const newDoc = { ...activeDoc };
                newDoc['plan-of-action-and-milestones'] = updated;
                setDoc(newDoc);
                pushUndoRedoState(newDoc);
              }} 
            />
          </div>`);
  } else if (file.includes('SSPPage')) {
    content = content.replace(/<div className=\"metadata-tab p-6 max-w-4xl mx-auto space-y-8\">[\s\S]*?<\/div>/, 
      `<div className="metadata-tab p-6 max-w-4xl mx-auto space-y-8">
            <StandardMetadataTab 
              document={ssp} 
              onChange={(updated) => {
                handleUpdate({ ...activeDoc, 'system-security-plan': updated });
              }} 
            />
          </div>`);
  } else if (file.includes('APPage')) {
     content = content.replace(/<MetadataEditor[\s\S]*?BackMatterEditor[\s\S]*?\/>/, 
      `<StandardMetadataTab 
              document={activeDoc['assessment-plan']} 
              onChange={(updated) => {
                const newDoc = { ...activeDoc };
                newDoc['assessment-plan'] = updated;
                handleUpdate(newDoc);
              }} 
            />`);
  }
  
  fs.writeFileSync(file, content);
  console.log('Updated ' + file);
});
