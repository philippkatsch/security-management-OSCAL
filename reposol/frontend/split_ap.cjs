const fs = require('fs');
const content = fs.readFileSync('extracted_ap.tsx', 'utf8');

const tcStart = content.indexOf('function TermsAndConditionsEditor');
const activityStart = content.indexOf('function ActivityEditor');
const subjectStart = content.indexOf('function AssessmentSubjectEditor');

const partNodeAndTc = content.substring(0, activityStart);
const activity = content.substring(activityStart, subjectStart > -1 ? subjectStart : content.length);

const imports = `import React from 'react';\nimport styles from '../../assessment-plan/APPage.module.css';\n\nconst generateUUID = () => crypto.randomUUID();\n\n`;

fs.writeFileSync('src/components/shared/assessment/TermsAndConditionsEditor.tsx', imports + partNodeAndTc.replace('function TermsAndConditionsEditor', 'export function TermsAndConditionsEditor'));
fs.writeFileSync('src/components/shared/assessment/ActivityEditor.tsx', imports + activity.replace('function ActivityEditor', 'export function ActivityEditor'));

let apContent = fs.readFileSync('src/components/assessment-plan/APPage.tsx', 'utf8');
const pageStart = apContent.indexOf('export function APPage');
const before = apContent.substring(0, apContent.indexOf('function PartNode'));
const after = apContent.substring(pageStart);

const newImports = `import { TermsAndConditionsEditor } from '../shared/assessment/TermsAndConditionsEditor';\nimport { ActivityEditor } from '../shared/assessment/ActivityEditor';\n`;

fs.writeFileSync('src/components/assessment-plan/APPage.tsx', before + newImports + after);
console.log('Done splitting inline editors');
