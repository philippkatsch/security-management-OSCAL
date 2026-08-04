export const STATUS_CONFIG = {
  'document-lifecycle': {
    label: 'Document Lifecycle',
    values: {
      'draft': { label: 'Draft', color: 'hsl(45, 93%, 47%)', icon: '📝', textColor: '#000' },
      'active': { label: 'Active', color: 'hsl(142, 71%, 45%)', icon: '✅', textColor: '#fff' },
      'archived': { label: 'Archived', color: 'hsl(0, 0%, 60%)', icon: '📦', textColor: '#fff' },
      'superseded': { label: 'Superseded', color: 'hsl(0, 72%, 51%)', icon: '🔄', textColor: '#fff' },
    }
  },
  'operational-status': {
    label: 'Operational Status',
    values: {
      'operational': { label: 'Operational', color: 'hsl(142, 71%, 45%)', icon: '✅', textColor: '#fff' },
      'under-development': { label: 'Under Development', color: 'hsl(45, 93%, 47%)', icon: '🚧', textColor: '#000' },
      'under-major-modification': { label: 'Major Modification', color: 'hsl(24, 98%, 53%)', icon: '🏗️', textColor: '#fff' },
      'disposition': { label: 'Disposition', color: 'hsl(0, 0%, 60%)', icon: '🗑️', textColor: '#fff' },
      'other': { label: 'Other', color: 'hsl(0, 0%, 60%)', icon: '❓', textColor: '#fff' },
    }
  },
  'implementation-status': {
    label: 'Implementation Status',
    values: {
      'implemented': { label: 'Implemented', color: 'hsl(142, 71%, 45%)', icon: '✅', textColor: '#fff' },
      'partial': { label: 'Partial', color: 'hsl(45, 93%, 47%)', icon: '⏳', textColor: '#000' },
      'planned': { label: 'Planned', color: 'hsl(217, 91%, 60%)', icon: '📅', textColor: '#fff' },
      'alternative': { label: 'Alternative', color: 'hsl(270, 60%, 60%)', icon: '🔄', textColor: '#fff' },
      'not-applicable': { label: 'Not Applicable', color: 'hsl(0, 0%, 60%)', icon: '⛔', textColor: '#fff' },
    }
  },
  'fips-impact': {
    label: 'FIPS Impact',
    values: {
      'low': { label: 'Low', color: 'hsl(142, 71%, 45%)', icon: '🟢', textColor: '#fff' },
      'moderate': { label: 'Moderate', color: 'hsl(45, 93%, 47%)', icon: '🟡', textColor: '#000' },
      'high': { label: 'High', color: 'hsl(0, 72%, 51%)', icon: '🔴', textColor: '#fff' },
    }
  },
  'finding-status': {
    label: 'Finding Target Status',
    values: {
      'satisfied': { label: 'Satisfied', color: 'hsl(142, 71%, 45%)', icon: '✅', textColor: '#fff' },
      'not-satisfied': { label: 'Not Satisfied', color: 'hsl(0, 72%, 51%)', icon: '❌', textColor: '#fff' },
    }
  },
  'traceability-status': {
    label: 'Traceability Status',
    values: {
      'satisfied': { label: 'Satisfied', color: 'hsl(142, 71%, 45%)', icon: '✅', textColor: '#fff' },
      'not-satisfied': { label: 'Not Satisfied', color: 'hsl(0, 72%, 51%)', icon: '❌', textColor: '#fff' },
      'in-progress': { label: 'In Progress', color: 'hsl(45, 93%, 47%)', icon: '⏳', textColor: '#000' },
      'not-assessed': { label: 'Not Assessed', color: 'hsl(0, 0%, 60%)', icon: '⬜', textColor: '#fff' },
    }
  },
  'risk-status': {
    label: 'Risk Status',
    values: {
      'open': { label: 'Open', color: 'hsl(0, 72%, 51%)', icon: '🔴', textColor: '#fff' },
      'investigating': { label: 'Investigating', color: 'hsl(24, 98%, 53%)', icon: '🔍', textColor: '#fff' },
      'remediating': { label: 'Remediating', color: 'hsl(45, 93%, 47%)', icon: '🛠️', textColor: '#000' },
      'deviation-requested': { label: 'Deviation Req.', color: 'hsl(270, 60%, 60%)', icon: '📝', textColor: '#fff' },
      'deviation-approved': { label: 'Deviation Appr.', color: 'hsl(217, 91%, 60%)', icon: '✅', textColor: '#fff' },
      'closed': { label: 'Closed', color: 'hsl(142, 71%, 45%)', icon: '🔒', textColor: '#fff' },
    }
  },
  'remediation-lifecycle': {
    label: 'Remediation Lifecycle',
    values: {
      'recommendation': { label: 'Recommendation', color: 'hsl(217, 91%, 60%)', icon: '💡', textColor: '#fff' },
      'planned': { label: 'Planned', color: 'hsl(45, 93%, 47%)', icon: '📅', textColor: '#000' },
      'completed': { label: 'Completed', color: 'hsl(142, 71%, 45%)', icon: '✅', textColor: '#fff' },
    }
  },
  'mapping-relationship': {
    label: 'Mapping Relationship',
    values: {
      'equal-to': { label: 'Equal To', color: 'hsl(270, 60%, 60%)', icon: '🟰', textColor: '#fff' },
      'equivalent-to': { label: 'Equivalent To', color: 'hsl(142, 71%, 45%)', icon: '≈', textColor: '#fff' },
      'subset-of': { label: 'Subset Of', color: 'hsl(217, 91%, 60%)', icon: '⊂', textColor: '#fff' },
      'superset-of': { label: 'Superset Of', color: 'hsl(24, 98%, 53%)', icon: '⊃', textColor: '#fff' },
      'intersects-with': { label: 'Intersects With', color: 'hsl(45, 93%, 47%)', icon: '∩', textColor: '#000' },
      'no-relationship': { label: 'No Relationship', color: 'hsl(0, 72%, 51%)', icon: '∅', textColor: '#fff' },
    }
  },
  'confidence': {
    label: 'Confidence',
    values: {
      'high': { label: 'High', color: 'hsl(142, 71%, 45%)', icon: '🟢', textColor: '#fff' },
      'medium': { label: 'Medium', color: 'hsl(45, 93%, 47%)', icon: '🟡', textColor: '#000' },
      'low': { label: 'Low', color: 'hsl(0, 72%, 51%)', icon: '🔴', textColor: '#fff' },
      'unspecified': { label: 'Unspecified', color: 'hsl(0, 0%, 60%)', icon: '⚪', textColor: '#fff' },
    }
  },
  'collection-status': {
    label: 'Collection Status',
    values: {
      'complete': { label: 'Complete', color: 'hsl(142, 71%, 45%)', icon: '✅', textColor: '#fff' },
      'not-complete': { label: 'Not Complete', color: 'hsl(45, 93%, 47%)', icon: '⏳', textColor: '#000' },
      'draft': { label: 'Draft', color: 'hsl(217, 91%, 60%)', icon: '📝', textColor: '#fff' },
      'deprecated': { label: 'Deprecated', color: 'hsl(24, 98%, 53%)', icon: '⚠️', textColor: '#fff' },
      'superseded': { label: 'Superseded', color: 'hsl(0, 72%, 51%)', icon: '🔄', textColor: '#fff' },
    }
  },
  'assessment-method': {
    label: 'Assessment Method',
    values: {
      'EXAMINE': { label: 'Examine', color: 'hsl(217, 91%, 60%)', icon: '👁️', textColor: '#fff' },
      'INTERVIEW': { label: 'Interview', color: 'hsl(142, 71%, 45%)', icon: '🗣️', textColor: '#fff' },
      'TEST': { label: 'Test', color: 'hsl(24, 98%, 53%)', icon: '🧪', textColor: '#fff' },
      'UNKNOWN': { label: 'Unknown', color: 'hsl(0, 0%, 60%)', icon: '❓', textColor: '#fff' },
    }
  },
  'observation-method': {
    label: 'Observation Method',
    values: {
      'EXAMINE': { label: 'Examine', color: 'hsl(217, 91%, 60%)', icon: '👁️', textColor: '#fff' },
      'INTERVIEW': { label: 'Interview', color: 'hsl(142, 71%, 45%)', icon: '🗣️', textColor: '#fff' },
      'TEST': { label: 'Test', color: 'hsl(24, 98%, 53%)', icon: '🧪', textColor: '#fff' },
    }
  },
  'priority': {
    label: 'Priority',
    values: {
      '1': { label: 'Critical', color: 'hsl(0, 72%, 51%)', icon: '🔴', textColor: '#fff' },
      '2': { label: 'High', color: 'hsl(24, 98%, 53%)', icon: '🟠', textColor: '#fff' },
      '3': { label: 'Medium', color: 'hsl(45, 93%, 47%)', icon: '🟡', textColor: '#000' },
      '4': { label: 'Low', color: 'hsl(142, 71%, 45%)', icon: '🟢', textColor: '#fff' },
    }
  }
};

export function getStatusConfig(category, value) {
  const cat = STATUS_CONFIG[category];
  if (!cat || !cat.values[value]) {
    return { label: value || 'Unknown', color: 'hsl(0, 0%, 60%)', icon: '?', textColor: '#fff' };
  }
  return cat.values[value];
}

export function getStatusColor(category, value) {
  return getStatusConfig(category, value).color;
}

export function getStatusLabel(category, value) {
  return getStatusConfig(category, value).label;
}

export function getStatusValues(category) {
  const cat = STATUS_CONFIG[category];
  if (!cat) return [];
  return Object.entries(cat.values).map(([val, config]) => ({
    value: val,
    label: config.label,
    color: config.color,
    icon: config.icon
  }));
}
