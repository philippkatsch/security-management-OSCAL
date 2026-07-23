import { useState, useEffect, useRef } from 'react';
import { authFetch } from '../lib/api';
import { ProseWithParams } from './shared/ProseWithParams';

const STAGE_CONFIG = {
  catalogs: {
    rootKey: 'catalog',
    label: 'Catalog',
    extraFields: [
      { key: 'groups', label: 'Groups (JSON array)', type: 'json', placeholder: '[]', required: false },
    ],
  },
  profiles: {
    rootKey: 'profile',
    label: 'Profile',
    extraFields: [
      { key: 'imports', label: 'Imports (JSON array)', type: 'json', placeholder: '[{"href": "catalog-uuid-here"}]', required: true },
      { key: 'merge', label: 'Merge (JSON object)', type: 'json', placeholder: '{}', required: false },
      { key: 'modify', label: 'Modify (JSON object)', type: 'json', placeholder: '{}', required: false },
      { key: 'local-controls', label: 'Local Controls (JSON array)', type: 'json', placeholder: '[]', required: false },
    ],
  },
  ssps: {
    rootKey: 'system-security-plan',
    label: 'System Security Plan',
    extraFields: [
      { key: 'import-profile', label: 'Import Profile (JSON: {"href":"..."})', type: 'json', placeholder: '{"href": "profile-uuid-here"}', required: true },
      { key: 'system-characteristics', label: 'System Characteristics (JSON)', type: 'json', placeholder: '{"system-name": "My System", "description": "..."}', required: false },
      { key: 'control-implementation', label: 'Control Implementation (JSON)', type: 'json', placeholder: '{"implemented-requirements": []}', required: false },
    ],
  },
  'component-definitions': {
    rootKey: 'component-definition',
    label: 'Component Definition',
    extraFields: [
      { key: 'components', label: 'Components (JSON array)', type: 'json', placeholder: '[]', required: false },
    ],
  },
  'assessment-plans': {
    rootKey: 'assessment-plan',
    label: 'Assessment Plan',
    extraFields: [
      { key: 'import-ssp', label: 'Import SSP (JSON: {"href":"..."})', type: 'json', placeholder: '{"href": "ssp-uuid-here"}', required: false },
      { key: 'tasks', label: 'Tasks (JSON array)', type: 'json', placeholder: '[]', required: false },
    ],
  },
  'assessment-results': {
    rootKey: 'assessment-results',
    label: 'Assessment Results',
    extraFields: [
      { key: 'import-ap', label: 'Import Assessment Plan (JSON: {"href":"..."})', type: 'json', placeholder: '{"href": "ap-uuid-here"}', required: false },
      { key: 'results', label: 'Results (JSON array)', type: 'json', placeholder: '[]', required: false },
    ],
  },
  poams: {
    rootKey: 'plan-of-action-and-milestones',
    label: 'POA&M',
    extraFields: [
      { key: 'poam-items', label: 'POA&M Items (JSON array)', type: 'json', placeholder: '[]', required: false },
    ],
  },
  'control-mappings': {
    rootKey: 'mapping-collection',
    label: 'Control Mapping',
    extraFields: [
      { key: 'provenance', label: 'Provenance (JSON)', type: 'json', placeholder: '{"method": "human", "matching-rationale": "syntactic", "status": "draft", "mapping-description": "NIST to ISO control crosswalk"}', required: false },
      { key: 'mappings', label: 'Mappings (JSON array)', type: 'json', placeholder: '[]', required: false }
    ],
  },
};

const STAGE_TO_MODEL = {
  catalogs: 'catalog',
  profiles: 'profile',
  ssps: 'ssp',
  'component-definitions': 'component-definition',
  'assessment-plans': 'assessment-plan',
  'assessment-results': 'assessment-results',
  poams: 'poam',
  'control-mappings': 'control-mappings'
};

const getImportUuid = (href = '') => (
  href.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i)?.[1]?.toLowerCase() || ''
);

const applyModify = (catalog, modify) => {
  if (!modify) return;
  const setParams = modify["set-parameters"] || [];
  const alters = modify.alters || [];
  const paramMap = new Map(setParams.map(p => [p["param-id"]?.toLowerCase(), p]));
  const alterMap = new Map(alters.map(a => [a["control-id"]?.toLowerCase(), a]));

  const traverseControl = (ctrl) => {
    if (ctrl.params) {
      ctrl.params = ctrl.params.map(param => {
        const override = paramMap.get(param.id?.toLowerCase());
        if (override) {
          return {
            ...param,
            values: override.values !== undefined ? override.values : param.values,
            label: override.label !== undefined ? override.label : param.label
          };
        }
        return param;
      });
    }
    const alter = alterMap.get(ctrl.id?.toLowerCase());
    if (alter) {
      if (alter.adds) {
        alter.adds.forEach(add => {
          if (add.parts) {
            let parts = ctrl.parts ? [...ctrl.parts] : [];
            
            const replaceOrInsertPart = (partsList, newPart, position, byId) => {
              // 1. Try to find and replace in this level
              const idx = partsList.findIndex(p => p.id === newPart.id);
              if (idx >= 0) {
                partsList[idx] = newPart;
                return true;
              }
              
              // 2. Try to find and replace in nested parts
              for (let i = 0; i < partsList.length; i++) {
                if (partsList[i].parts) {
                  const copiedParts = [...partsList[i].parts];
                  const replaced = replaceOrInsertPart(copiedParts, newPart, position, byId);
                  if (replaced) {
                    partsList[i] = { ...partsList[i], parts: copiedParts };
                    return true;
                  }
                }
              }
              
              // 3. If not found, check if this is the level where we should insert before/after by-id
              if (position && byId) {
                const targetIdx = partsList.findIndex(p => p.id === byId);
                if (targetIdx >= 0) {
                  if (position === 'before') {
                    partsList.splice(targetIdx, 0, newPart);
                  } else if (position === 'after') {
                    partsList.splice(targetIdx + 1, 0, newPart);
                  }
                  return true;
                }
                
                // Recurse to find byId in sub-parts for insertion
                for (let i = 0; i < partsList.length; i++) {
                  if (partsList[i].parts) {
                    const copiedParts = [...partsList[i].parts];
                    const inserted = replaceOrInsertPart(copiedParts, newPart, position, byId);
                    if (inserted) {
                      partsList[i] = { ...partsList[i], parts: copiedParts };
                      return true;
                    }
                  }
                }
              }
              
              return false;
            };

            add.parts.forEach(newPart => {
              const replacedOrInserted = replaceOrInsertPart(parts, newPart, add.position, add["by-id"]);
              if (!replacedOrInserted) {
                if (add.position === 'starting') {
                  parts.unshift(newPart);
                } else {
                  parts.push(newPart);
                }
              }
            });
            ctrl.parts = parts;
          }
          if (add.props) {
            let props = ctrl.props ? [...ctrl.props] : [];
            add.props.forEach(newProp => {
              const idx = props.findIndex(p => p.name === newProp.name);
              if (idx >= 0) {
                props[idx] = newProp;
              } else {
                if (add.position === 'starting' || add.position === 'before') {
                  props.unshift(newProp);
                } else {
                  props.push(newProp);
                }
              }
            });
            ctrl.props = props;
          }
          if (add.params) {
            let params = ctrl.params ? [...ctrl.params] : [];
            add.params.forEach(newParam => {
              const idx = params.findIndex(p => p.id === newParam.id);
              if (idx >= 0) {
                params[idx] = newParam;
              } else {
                if (add.position === 'starting' || add.position === 'before') {
                  params.unshift(newParam);
                } else {
                  params.push(newParam);
                }
              }
            });
            ctrl.params = params;
          }
          if (add.links) {
            let links = ctrl.links ? [...ctrl.links] : [];
            add.links.forEach(newLink => {
              const idx = links.findIndex(l => l.href === newLink.href);
              if (idx >= 0) {
                links[idx] = newLink;
              } else {
                if (add.position === 'starting' || add.position === 'before') {
                  links.unshift(newLink);
                } else {
                  links.push(newLink);
                }
              }
            });
            ctrl.links = links;
          }
        });
      }
      if (alter.removes) {
        alter.removes.forEach(remove => {
          if (remove["by-id"] && ctrl.parts) {
            const removePartRec = (partsList) => {
              if (!partsList) return [];
              let filtered = partsList.filter(p => p.id !== remove["by-id"]);
              return filtered.map(p => {
                if (p.parts) {
                  return { ...p, parts: removePartRec(p.parts) };
                }
                return p;
              });
            };
            ctrl.parts = removePartRec(ctrl.parts);
          }
          if (remove["by-name"] && ctrl.parts) {
            const removePartRec = (partsList) => {
              if (!partsList) return [];
              let filtered = partsList.filter(p => p.name !== remove["by-name"]);
              return filtered.map(p => {
                if (p.parts) {
                  return { ...p, parts: removePartRec(p.parts) };
                }
                return p;
              });
            };
            ctrl.parts = removePartRec(ctrl.parts);
          }
        });
      }
    }
    if (ctrl.controls) {
      ctrl.controls.forEach(traverseControl);
    }
  };

  const traverseGroup = (group) => {
    if (group.controls) {
      group.controls.forEach(traverseControl);
    }
    if (group.groups) {
      group.groups.forEach(traverseGroup);
    }
  };

  if (catalog.controls) {
    catalog.controls.forEach(traverseControl);
  }
  if (catalog.groups) {
    catalog.groups.forEach(traverseGroup);
  }
};

const resolveProfileSync = (profileDoc, cache) => {
  const profile = profileDoc.profile;
  if (!profile) return { catalog: {} };
  const imports = profile.imports || [];

  const matchesAnyPattern = (controlId, patterns) => {
    if (!patterns || patterns.length === 0) return false;
    const idLower = controlId.toLowerCase();
    return patterns.some(pat => {
      const regexStr = '^' + pat.toLowerCase().replace(/\*/g, '.*') + '$';
      try {
        return new RegExp(regexStr).test(idLower);
      } catch (e) {
        return false;
      }
    });
  };

  const filterControls = (controls, includeAll, includedIds, includePatterns, excludedIds, excludePatterns) => {
    if (!controls) return [];
    return controls.map(c => {
      const controlIdLower = c.id.toLowerCase();
      const hasIncludedChild = (ctrl) => {
        if (includedIds.has(ctrl.id.toLowerCase())) return true;
        if (matchesAnyPattern(ctrl.id, includePatterns)) return true;
        if (ctrl.controls) {
          return ctrl.controls.some(sub => hasIncludedChild(sub));
        }
        return false;
      };
      
      const hasInclusions = includedIds.size > 0 || includePatterns.length > 0;
      const isIncluded = includeAll || !hasInclusions || hasIncludedChild(c);
      let isExcluded = excludedIds.has(controlIdLower) || matchesAnyPattern(c.id, excludePatterns);
      
      if (!isIncluded || isExcluded) return null;
      const filteredSub = filterControls(c.controls, includeAll, includedIds, includePatterns, excludedIds, excludePatterns);
      return { ...c, controls: filteredSub.length > 0 ? filteredSub : undefined };
    }).filter(Boolean);
  };

  const filterGroups = (groups, includeAll, includedIds, includePatterns, excludedIds, excludePatterns) => {
    if (!groups) return [];
    return groups.map(g => {
      const filteredSubGroups = filterGroups(g.groups, includeAll, includedIds, includePatterns, excludedIds, excludePatterns);
      const filteredCtrls = filterControls(g.controls, includeAll, includedIds, includePatterns, excludedIds, excludePatterns);
      if (filteredSubGroups.length === 0 && filteredCtrls.length === 0) return null;
      return {
        ...g,
        groups: filteredSubGroups.length > 0 ? filteredSubGroups : undefined,
        controls: filteredCtrls.length > 0 ? filteredCtrls : undefined
      };
    }).filter(Boolean);
  };

  const allMergedGroups = [];
  const allMergedControls = [];
  for (const imp of imports) {
    const match = imp.href.match(/([a-f0-9-]{36})/i);
    const uuid = match ? match[1]?.toLowerCase() : null;
    if (!uuid || !cache.has(uuid)) continue;
    const sourceEntry = cache.get(uuid);
    let resolvedImportedCatalog;
    let realDoc = sourceEntry;
    let docType = sourceEntry.type;
    if (docType && sourceEntry.data) {
      realDoc = sourceEntry.data;
    } else {
      docType = sourceEntry.catalog ? 'catalog' : (sourceEntry.profile ? 'profile' : 'catalog');
    }
    if (docType === 'catalog') {
      resolvedImportedCatalog = realDoc.catalog;
    } else if (docType === 'profile') {
      const res = resolveProfileSync(realDoc, cache);
      resolvedImportedCatalog = res.catalog;
    }
    if (!resolvedImportedCatalog) continue;

    const includeAll = imp["include-all"] !== undefined;
    const includedIds = new Set((imp["include-controls"] || []).flatMap(ic => (ic["with-ids"] || []).map(id => id.toLowerCase())));
    const includePatterns = (imp["include-controls"] || []).flatMap(ic => (ic["matching"] || []).map(m => m.pattern).filter(Boolean));
    const excludedIds = new Set((imp["exclude-controls"] || []).flatMap(ec => (ec["with-ids"] || []).map(id => id.toLowerCase())));
    const excludePatterns = (imp["exclude-controls"] || []).flatMap(ec => {
      const directPatterns = ec["matching-patterns"] || [];
      const matchingObjs = (ec["matching"] || []).map(m => m.pattern).filter(Boolean);
      return [...directPatterns, ...matchingObjs];
    });

    if (resolvedImportedCatalog.groups) allMergedGroups.push(...filterGroups(resolvedImportedCatalog.groups, includeAll, includedIds, includePatterns, excludedIds, excludePatterns));
    if (resolvedImportedCatalog.controls) allMergedControls.push(...filterControls(resolvedImportedCatalog.controls, includeAll, includedIds, includePatterns, excludedIds, excludePatterns));
  }

  const localControls = profile["local-controls"] || [];
  if (localControls.length > 0) {
    allMergedControls.push(...localControls);
  }

  // Combine duplicates (merge.combine)
  const combineMethod = profile.merge?.combine?.method || 'keep';
  if (combineMethod === 'use-first') {
    const seenIds = new Set();
    const filterDuplicates = (controls) => {
      if (!controls) return [];
      return controls.map(c => {
        const idLower = c.id.toLowerCase();
        if (seenIds.has(idLower)) return null;
        seenIds.add(idLower);
        if (c.controls) {
          c.controls = filterDuplicates(c.controls);
        }
        return c;
      }).filter(Boolean);
    };
    
    const filterGroupsDuplicates = (groups) => {
      if (!groups) return [];
      return groups.map(g => {
        if (g.controls) {
          g.controls = filterDuplicates(g.controls);
        }
        if (g.groups) {
          g.groups = filterGroupsDuplicates(g.groups);
        }
        if ((!g.controls || g.controls.length === 0) && (!g.groups || g.groups.length === 0)) {
          return null;
        }
        return g;
      }).filter(Boolean);
    };

    const dedupedControls = filterDuplicates(allMergedControls);
    allMergedControls.length = 0;
    allMergedControls.push(...dedupedControls);

    const dedupedGroups = filterGroupsDuplicates(allMergedGroups);
    allMergedGroups.length = 0;
    allMergedGroups.push(...dedupedGroups);
  }

  // Collect all controls flatly so we can lookup by ID
  const flatControlsMap = new Map();
  const collectControls = (ctrl) => {
    flatControlsMap.set(ctrl.id.toLowerCase(), ctrl);
    if (ctrl.controls) {
      ctrl.controls.forEach(collectControls);
    }
  };
  allMergedControls.forEach(collectControls);
  const collectFromGroup = (g) => {
    if (g.controls) g.controls.forEach(collectControls);
    if (g.groups) g.groups.forEach(collectFromGroup);
  };
  allMergedGroups.forEach(collectFromGroup);

  const merge = profile.merge || {};
  let resolvedCatalog;

  if (merge.flat) {
    resolvedCatalog = {
      uuid: profile.uuid,
      metadata: { ...profile.metadata, title: `${profile.metadata.title} (Resolved Profile)` },
      controls: Array.from(flatControlsMap.values()).map(c => ({ ...c, controls: undefined }))
    };
  } else if (merge.custom) {
    const resolveCustomGroup = (g) => {
      const groupCtrls = [];
      if (g['insert-controls']) {
        g['insert-controls'].forEach(ic => {
          if (ic['include-controls']) {
            ic['include-controls'].forEach(inc => {
              if (inc['with-ids']) {
                inc['with-ids'].forEach(id => {
                  const ctrl = flatControlsMap.get(id.toLowerCase());
                  if (ctrl) {
                    groupCtrls.push(ctrl);
                  }
                });
              }
              if (inc['matching']) {
                inc['matching'].forEach(m => {
                  const pattern = m.pattern;
                  if (pattern) {
                    const regexStr = '^' + pattern.toLowerCase().replace(/\*/g, '.*') + '$';
                    try {
                      const regex = new RegExp(regexStr);
                      Array.from(flatControlsMap.keys()).forEach(k => {
                        if (regex.test(k)) {
                          groupCtrls.push(flatControlsMap.get(k));
                        }
                      });
                    } catch (e) {}
                  }
                });
              }
            });
          }
        });
      }
      const subGroups = g.groups ? g.groups.map(resolveCustomGroup) : undefined;
      return {
        id: g.id,
        title: g.title,
        props: g.props,
        links: g.links,
        parts: g.parts,
        controls: groupCtrls.length > 0 ? groupCtrls : undefined,
        groups: subGroups && subGroups.length > 0 ? subGroups : undefined
      };
    };
    const customGroups = (merge.custom.groups || []).map(resolveCustomGroup);
    resolvedCatalog = {
      uuid: profile.uuid,
      metadata: { ...profile.metadata, title: `${profile.metadata.title} (Resolved Profile)` },
      groups: customGroups.length > 0 ? customGroups : undefined
    };
  } else {
    // Default (as-is)
    resolvedCatalog = {
      uuid: profile.uuid,
      metadata: { ...profile.metadata, title: `${profile.metadata.title} (Resolved Profile)` },
      groups: allMergedGroups.length > 0 ? allMergedGroups : undefined,
      controls: allMergedControls.length > 0 ? allMergedControls : undefined
    };
  }

  applyModify(resolvedCatalog, profile.modify);

  // Reorder to standard-compliant key order
  const reorderControlKeys = (ctrl) => {
    const ordered = {};
    const keysOrder = ['id', 'class', 'title', 'params', 'props', 'links', 'parts', 'responsible-parties', 'controls'];
    keysOrder.forEach(key => {
      if (ctrl[key] !== undefined) {
        ordered[key] = ctrl[key];
      }
    });
    Object.keys(ctrl).forEach(key => {
      if (ordered[key] === undefined) {
        ordered[key] = ctrl[key];
      }
    });
    return ordered;
  };
  const reorderCatalog = (cat) => {
    const traverse = (ctrl) => {
      const ordered = reorderControlKeys(ctrl);
      Object.keys(ctrl).forEach(key => delete ctrl[key]);
      Object.assign(ctrl, ordered);
      if (ctrl.controls) {
        ctrl.controls.forEach(traverse);
      }
    };
    const traverseGroup = (g) => {
      if (g.controls) g.controls.forEach(traverse);
      if (g.groups) g.groups.forEach(traverseGroup);
    };
    if (cat.controls) cat.controls.forEach(traverse);
    if (cat.groups) cat.groups.forEach(traverseGroup);
  };
  reorderCatalog(resolvedCatalog);

  return { catalog: resolvedCatalog };
};

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function DocumentEditor({ stage, editDoc, onSaved, onCancel, onTemplateLoaded }) {
  const config = STAGE_CONFIG[stage];
  const rootKey = config?.rootKey;

  const [uuid, setUuid] = useState('');
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [oscalVersion, setOscalVersion] = useState('1.1.2');
  const [remarks, setRemarks] = useState('');
  const [extraValues, setExtraValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState(null);

  // Template Loading States
  const [registryTemplates, setRegistryTemplates] = useState([]);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [rawJsonText, setRawJsonText] = useState('');

  useEffect(() => {
    if (!editDoc) {
      authFetch('/api/import/registry')
        .then(r => r.json())
        .then(data => setRegistryTemplates(data))
        .catch(err => console.error("Error fetching templates:", err));
    }
  }, [editDoc]);

  // Catalog Visual Builder States
  const [catalogGroups, setCatalogGroups] = useState([]);
  const objProseRefs = useRef({});
  const methodProseRefs = useRef({});

  // Profile Visual Tailoring States
  const [availableCatalogs, setAvailableCatalogs] = useState([]);
  const [selectedCatalogIds, setSelectedCatalogIds] = useState([]);
  const [loadedCatalogsData, setLoadedCatalogsData] = useState({});
  const [selectedControlIds, setSelectedControlIds] = useState({});
  const [editorMode, setEditorMode] = useState('visual');
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [profileSetParams, setProfileSetParams] = useState({}); // { [paramId]: value }
  const [profileAlters, setProfileAlters] = useState({}); // { [controlIdLower]: { position, prose, partId } }
  const [mergeDirective, setMergeDirective] = useState('as-is'); // 'as-is' | 'flat' | 'custom'
  const [customGroups, setCustomGroups] = useState([]); // [ { id, title, controls: [], groups: [] } ]
  const [tailoringSubTab, setTailoringSubTab] = useState('controls'); // 'controls' | 'alters' | 'merge'
  const [profileImportsConfig, setProfileImportsConfig] = useState({}); // { [catUuidLower]: { includeAll, includeMatching: [], excludeMatching: [], excludeIds: [] } }
  const [profileRoles, setProfileRoles] = useState([]); // [ { id, title } ]
  const [activeParamOptionsId, setActiveParamOptionsId] = useState(null); // string | null
  const [combineMethod, setCombineMethod] = useState('keep'); // 'keep' | 'use-first'

  // Component Definitions Visual States
  const [visualComponents, setVisualComponents] = useState([]);

  // SSP Visual Builder States
  const [availableProfiles, setAvailableProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [availableComponents, setAvailableComponents] = useState([]);
  const [activeComponentUuids, setActiveComponentUuids] = useState([]);
  const [systemName, setSystemName] = useState('');
  const [systemSensLevel, setSystemSensLevel] = useState('moderate');
  const [systemDescription, setSystemDescription] = useState('');
  const [sspImplementedReqs, setSspImplementedReqs] = useState({});
  const [sspResolvedControls, setSspResolvedControls] = useState([]);
  const [sspTab, setSspTab] = useState('info'); // 'info' | 'components' | 'controls'

  // Assessment Plan Visual States
  const [availableSsps, setAvailableSsps] = useState([]);
  const [selectedSspId, setSelectedSspId] = useState('');
  const [apTasks, setApTasks] = useState([]);
  const [apAssets, setApAssets] = useState([]);
  const [apReviewedControls, setApReviewedControls] = useState([]);
  const [apLocalDefinitions, setApLocalDefinitions] = useState([]);

  // Assessment Results Visual States
  const [availableAps, setAvailableAps] = useState([]);
  const [selectedApId, setSelectedApId] = useState('');
  const [arFindings, setArFindings] = useState([]);
  const [arLogs, setArLogs] = useState([]);
  const [arObservations, setArObservations] = useState([]);
  const [arRisks, setArRisks] = useState([]);

  // POA&M Visual States
  const [poamItems, setPoamItems] = useState([]);
  const [availableArs, setAvailableArs] = useState([]);
  const [selectedArIdForImport, setSelectedArIdForImport] = useState('');

  const [profileLocalControls, setProfileLocalControls] = useState([]);
  const [sspLeveragedAuths, setSspLeveragedAuths] = useState([]);

  // SSP Advanced States
  const [fipsConf, setFipsConf] = useState('moderate');
  const [fipsInt, setFipsInt] = useState('moderate');
  const [fipsAvail, setFipsAvail] = useState('low');
  const [sspSystemStatus, setSspSystemStatus] = useState('operational');
  const [sspUsersList, setSspUsersList] = useState([]);
  const [authBoundaryDesc, setAuthBoundaryDesc] = useState('');
  const [authBoundaryDiagrams, setAuthBoundaryDiagrams] = useState([]);
  const [netArchDesc, setNetArchDesc] = useState('');
  const [netArchDiagrams, setNetArchDiagrams] = useState([]);
  const [dataFlowDesc, setDataFlowDesc] = useState('');
  const [dataFlowDiagrams, setDataFlowDiagrams] = useState([]);

  // Fetch available catalogs/profiles/components dynamically
  useEffect(() => {
    if (stage === 'profiles') {
      authFetch('/api/documents/catalogs')
        .then(res => res.json())
        .then(data => {
          const list = data.map(doc => {
            const cat = doc.catalog;
            return { uuid: cat.uuid, title: cat.metadata?.title || 'Untitled Catalog' };
          });
          setAvailableCatalogs(list);
        })
        .catch(err => console.error("Error fetching catalogs:", err));

      authFetch('/api/documents/profiles')
        .then(res => res.json())
        .then(data => {
          const list = data.map(doc => {
            const prof = doc.profile;
            return { uuid: prof.uuid, title: prof.metadata?.title || 'Untitled Profile' };
          });
          setAvailableProfiles(list);
        })
        .catch(err => console.error("Error fetching profiles:", err));
    } else if (stage === 'ssps') {
      // Fetch available profiles
      authFetch('/api/documents/profiles')
        .then(res => res.json())
        .then(data => {
          setAvailableProfiles(data.map(d => ({ uuid: d.profile.uuid, title: d.profile.metadata?.title || 'Untitled Profile' })));
        })
        .catch(err => console.error("Error fetching profiles:", err));
    }

    if (stage === 'ssps' || stage === 'assessment-results' || stage === 'poams') {
      // Fetch all component definitions
      authFetch('/api/documents/component-definitions')
        .then(res => res.json())
        .then(data => {
          const comps = [];
          data.forEach(doc => {
            const compDef = doc['component-definition'];
            if (compDef?.components) {
              compDef.components.forEach(c => {
                comps.push({
                  uuid: c.uuid,
                  title: c.title,
                  type: c.type || 'software',
                  description: c.description || ''
                });
              });
            }
          });
          setAvailableComponents(comps);
        })
        .catch(err => console.error("Error fetching component definitions:", err));
    }

    if (stage === 'assessment-plans') {
      authFetch('/api/documents/ssps')
        .then(res => res.json())
        .then(data => {
          setAvailableSsps(data.map(d => ({ uuid: d['system-security-plan'].uuid, title: d['system-security-plan'].metadata?.title || 'Untitled SSP' })));
        })
        .catch(err => console.error("Error fetching SSPs:", err));
    } else if (stage === 'assessment-results') {
      authFetch('/api/documents/assessment-plans')
        .then(res => res.json())
        .then(data => {
          setAvailableAps(data.map(d => ({ uuid: d['assessment-plan'].uuid, title: d['assessment-plan'].metadata?.title || 'Untitled Assessment Plan' })));
        })
        .catch(err => console.error("Error fetching APs:", err));
    } else if (stage === 'poams') {
      authFetch('/api/documents/assessment-results')
        .then(res => res.json())
        .then(data => {
          setAvailableArs(data.map(d => ({ uuid: d['assessment-results'].uuid, title: d['assessment-results'].metadata?.title || 'Untitled Assessment Results' })));
        })
        .catch(err => console.error("Error fetching Assessment Results:", err));
    }
  }, [stage]);

  // Load controls resolved from a profile
  const loadProfileControls = async (profUuid) => {
    setLoadingCatalogs(true);
    try {
      const res = await authFetch(`/api/documents/profiles/${profUuid}`);
      if (res.ok) {
        const profDoc = await res.json();
        const cache = new Map();
        const imports = profDoc.profile?.imports || [];
        await Promise.all(
          imports.map(async (imp) => {
            const match = imp.href.match(/([a-f0-9-]{36})/i);
            const catUuid = match ? match[1] : null;
            if (catUuid) {
              try {
                const catRes = await authFetch(`/api/documents/catalogs/${catUuid}`);
                if (catRes.ok) {
                  const catJson = await catRes.json();
                  cache.set(catUuid.toLowerCase(), catJson);
                }
              } catch (err) {
                console.error(err);
              }
            }
          })
        );
        const resolved = resolveProfileSync(profDoc, cache);
        const ctrlsList = [];
        const traverse = (item) => {
          if (item.controls) {
            item.controls.forEach(c => {
              ctrlsList.push({ id: c.id, title: c.title, params: c.params });
              if (c.controls) {
                c.controls.forEach(sub => ctrlsList.push({ id: sub.id, title: sub.title, params: sub.params }));
              }
            });
          }
          if (item.groups) {
            item.groups.forEach(g => traverse(g));
          }
        };
        if (resolved?.catalog) {
          traverse(resolved.catalog);
        }
        setSspResolvedControls(ctrlsList);
      }
    } catch (err) {
      console.error("Error loading profile controls:", err);
    } finally {
      setLoadingCatalogs(false);
    }
  };

  const importDocumentDataIntoStates = (data) => {
    if (!data) return;
    setUuid(stage === 'catalogs' ? generateUUID() : (data.uuid || generateUUID()));
    setTitle(data.metadata?.title || '');
    setVersion(data.metadata?.version || '1.0.0');
    setOscalVersion(data.metadata?.['oscal-version'] || '1.1.2');
    setRemarks(data.metadata?.remarks || '');

    const extra = {};
    (config.extraFields || []).forEach((f) => {
      if (data[f.key] !== undefined) {
        extra[f.key] = JSON.stringify(data[f.key], null, 2);
      } else {
        extra[f.key] = '';
      }
    });
    setExtraValues(extra);

    if (stage === 'catalogs') {
      setCatalogGroups(data.groups || []);
    }

    if (stage === 'component-definitions') {
      const comps = data.components || [];
      setVisualComponents(comps.map(c => ({
        uuid: c.uuid || generateUUID(),
        title: c.title || '',
        type: c.type || 'software',
        description: c.description || '',
        purpose: c.purpose || '',
        props: c.props || [],
        protocols: c.protocols || [],
        dependencies: c.dependencies || [],
        responsibleRoles: c['responsible-roles'] || [],
        controlImplementations: c['control-implementations'] || []
      })));
    }

    if (stage === 'ssps') {
      const comps = data['system-implementation']?.components || [];
      setActiveComponentUuids(comps.map(c => c.uuid));

      const profileHref = data['import-profile']?.href || '';
      const match = profileHref.match(/([a-f0-9-]{36})/i);
      const profUuid = match ? match[1] : '';
      setSelectedProfileId(profUuid);

      const sysChar = data['system-characteristics'] || {};
      setSystemName(sysChar['system-name'] || '');
      setSystemSensLevel(sysChar['security-sensitivity-level'] || 'moderate');
      setSystemDescription(sysChar['description'] || '');
      setSspLeveragedAuths(sysChar['leveraged-authorizations'] || []);
      
      const props = sysChar.props || [];
      const fConf = props.find(p => p.name === 'fips-199-confidentiality-impact-level')?.value || 'moderate';
      const fInt = props.find(p => p.name === 'fips-199-integrity-impact-level')?.value || 'moderate';
      const fAvail = props.find(p => p.name === 'fips-199-availability-impact-level')?.value || 'low';
      setFipsConf(fConf);
      setFipsInt(fInt);
      setFipsAvail(fAvail);
      setSspSystemStatus(sysChar['system-status']?.state || 'operational');
      const resources = data['back-matter']?.resources || [];
      const resolveDiagrams = (diagramsList) => {
        return (diagramsList || []).map(diag => {
          if (diag.location) return diag;
          const link = diag.links?.find(l => l.rel === 'diagram');
          if (link) {
            const resUuid = link.href.replace('#', '');
            const resource = resources.find(r => r.uuid === resUuid);
            if (resource && resource.base64) {
              const mime = resource.base64['media-type'] || 'image/png';
              const val = resource.base64.value;
              return {
                ...diag,
                location: `data:${mime};base64,${val}`,
                filename: resource.base64.filename,
                mediaType: mime
              };
            } else if (resource && resource.rlinks?.length > 0) {
              return {
                ...diag,
                location: resource.rlinks[0].href
              };
            }
          }
          return diag;
        });
      };
      setAuthBoundaryDesc(sysChar['authorization-boundary']?.description || '');
      setAuthBoundaryDiagrams(resolveDiagrams(sysChar['authorization-boundary']?.diagrams));
      setNetArchDesc(sysChar['network-architecture']?.description || '');
      setNetArchDiagrams(resolveDiagrams(sysChar['network-architecture']?.diagrams));
      setDataFlowDesc(sysChar['data-flow']?.description || '');
      setDataFlowDiagrams(resolveDiagrams(sysChar['data-flow']?.diagrams));
      setSspUsersList(sysChar.users || []);

      const implReqs = data['control-implementation']?.['implemented-requirements'] || [];
      const reqsMap = {};
      implReqs.forEach(r => {
        const byCompMap = {};
        (r['by-components'] || []).forEach(bc => {
          byCompMap[bc['component-uuid']] = bc.description;
        });
        const setParamMap = {};
        (r['set-parameters'] || []).forEach(sp => {
          setParamMap[sp['param-id']] = (sp.values || []).join(', ');
        });
        const inheritance = r.props?.find(p => p.name === 'inheritance-type')?.value || 'none';
        const leveragedAuth = r.links?.find(l => l.rel === 'leveraged-authorization')?.href?.replace('#', '') || '';

        reqsMap[r['control-id'].toLowerCase()] = {
          description: r.description || '',
          byComponents: byCompMap,
          setParameters: setParamMap,
          inheritanceType: inheritance,
          leveragedAuthUuid: leveragedAuth
        };
      });
      setSspImplementedReqs(reqsMap);
    }

    if (stage === 'assessment-plans') {
      const sspHref = data['import-ssp']?.href || '';
      const match = sspHref.match(/([a-f0-9-]{36})/i);
      setSelectedSspId(match ? match[1] : '');

      const tasks = data.tasks || [];
      setApTasks(tasks.map(t => ({
        uuid: t.uuid || generateUUID(),
        type: t.type || 'milestone',
        title: t.title || '',
        description: t.description || '',
        start: t.start ? t.start.substring(0, 16) : '',
        end: t.end ? t.end.substring(0, 16) : ''
      })));

      const assets = data['assessment-assets']?.components || [];
      setApAssets(assets.map(a => ({
        uuid: a.uuid || generateUUID(),
        type: a.type || 'software',
        title: a.title || '',
        description: a.description || ''
      })));

      const revControls = data['reviewed-controls'] || [];
      setApReviewedControls(revControls.map(rc => ({
        controlId: rc['control-id']?.toLowerCase() || '',
        methods: (rc.props || []).filter(p => p.name === 'assessment-method').map(p => p.value)
      })));

      const localDefs = data['local-definitions']?.components || [];
      setApLocalDefinitions(localDefs.map(ld => ({
        uuid: ld.uuid || generateUUID(),
        title: ld.title || '',
        description: ld.description || ''
      })));
    }

    if (stage === 'assessment-results') {
      const apHref = data['import-ap']?.href || '';
      const match = apHref.match(/([a-f0-9-]{36})/i);
      setSelectedApId(match ? match[1] : '');

      const findings = data.results || [];
      setArFindings(findings.map(f => ({
        uuid: f.uuid || generateUUID(),
        title: f.title || '',
        description: f.description || '',
        status: f.status || 'open',
        target: f.target ? (typeof f.target === 'object' ? f.target['target-id'] || '' : f.target) : '',
        relatedObservations: (f['related-observations'] || []).map(ro => ro['observation-uuid']),
        associatedRisks: (f['associated-risks'] || []).map(ar => ar['risk-uuid']),
        attestationState: f.attestation?.state || 'satisfied',
        attestationStatement: f.attestation?.statement || ''
      })));

      const logs = data['assessment-log'] || [];
      setArLogs(logs.map(l => ({
        uuid: l.uuid || generateUUID(),
        start: l.start ? l.start.substring(0, 16) : '',
        end: l.end ? l.end.substring(0, 16) : '',
        description: l.description || ''
      })));

      const obs = data.observations || [];
      setArObservations(obs.map(o => ({
        uuid: o.uuid || generateUUID(),
        description: o.description || '',
        type: o.type || 'satisfies',
        evidence: o.links?.[0]?.href || '',
        componentUuid: o.subjects?.find(s => s.type === 'component')?.['subject-uuid'] || ''
      })));

      const risks = data.risks || [];
      setArRisks(risks.map(r => ({
        uuid: r.uuid || generateUUID(),
        description: r.description || '',
        severity: r.severity || 'medium',
        recommendation: r.recommendation || '',
        observationUuid: r.observationUuid || ''
      })));
    }

    if (stage === 'poams') {
      const items = data['poam-items'] || [];
      setPoamItems(items.map(item => {
        const props = item.props || [];
        const devType = props.find(p => p.name === 'deviation-type')?.value || 'none';
        const devRationale = props.find(p => p.name === 'deviation-rationale')?.value || '';
        const links = item.links || [];
        const ev = links.find(l => l.rel === 'evidence')?.href || '';
        return {
          uuid: item.uuid || generateUUID(),
          title: item.title || '',
          description: item.description || '',
          remediation: item.remediation || '',
          status: item.status || 'planned',
          dueDate: item['due-date'] || '',
          deviationType: devType,
          deviationRationale: devRationale,
          evidence: ev
        };
      }));
    }

    if (stage === 'profiles') {
      setProfileRoles(data.metadata?.roles || []);

      if (data.modify) {
        const setParamsDict = {};
        (data.modify["set-parameters"] || []).forEach(p => {
          setParamsDict[p["param-id"]] = {
            values: (p.values || []).join(', '),
            label: p.label || '',
            class: p.class || '',
            usage: p.usage || '',
            select: p.select ? {
              howMany: p.select["how-many"] || 'one',
              choice: (p.select.choice || []).join(', ')
            } : { howMany: 'one', choice: '' },
            constraints: (p.constraints || []).map(c => {
              const t = c.tests?.[0] || {};
              return {
                description: c.description || '',
                testExpression: t.expression || '',
                testRemarks: t.remarks || ''
              };
            }),
            guidelines: p.guidelines?.[0]?.prose || ''
          };
        });
        setProfileSetParams(setParamsDict);

        const altersDict = {};
        (data.modify.alters || []).forEach(a => {
          const ctrlIdLower = a["control-id"]?.toLowerCase();
          const adds = (a.adds || []).flatMap(add => {
            const position = add.position || 'ending';
            const byId = add['by-id'] || '';
            const result = [];
            if (add.parts) {
              add.parts.forEach(p => result.push({ type: 'part', position, byId, prose: p.prose || '', partId: p.id || '' }));
            }
            if (add.props) {
              add.props.forEach(p => result.push({ type: 'prop', position, byId, propName: p.name || '', propValue: p.value || '' }));
            }
            if (add.params) {
              add.params.forEach(p => result.push({ type: 'param', position, byId, paramId: p.id || '', paramLabel: p.label || '', paramValue: (p.values || [])[0] || '' }));
            }
            if (add.links) {
              add.links.forEach(l => result.push({ type: 'link', position, byId, linkHref: l.href || '', linkText: l.text || '' }));
            }
            if (add['responsible-parties']) {
              add['responsible-parties'].forEach(rp => result.push({ type: 'responsible-party', position, byId, roleId: rp['role-id'] || '', partyUuids: (rp['party-uuids'] || []).join(', ') }));
            }
            if (result.length === 0) {
              result.push({ type: 'part', position, byId, prose: '', partId: '' });
            }
            return result;
          });
          const removes = (a.removes || []).map(rem => ({
            byId: rem['by-id'] || '',
            byName: rem['by-name'] || '',
            byClass: rem['by-class'] || '',
            byItemName: rem['by-item-name'] || '',
            nsRef: rem['by-ns'] || rem['ns-ref'] || ''
          }));
          altersDict[ctrlIdLower] = { adds, removes };
        });
        setProfileAlters(altersDict);
      } else {
        setProfileSetParams({});
        setProfileAlters({});
      }
      setProfileLocalControls(data['local-controls'] || []);

      const mergeObj = data.merge || {};
      setCombineMethod(mergeObj.combine?.method || 'keep');
      if (mergeObj.flat) {
        setMergeDirective('flat');
        setCustomGroups([]);
      } else if (mergeObj.custom) {
        setMergeDirective('custom');
        const parseGroup = (g) => {
          const controls = [];
          if (g['insert-controls']) {
            g['insert-controls'].forEach(ic => {
              if (ic['include-controls']) {
                ic['include-controls'].forEach(inc => {
                  if (inc['with-ids']) {
                    inc['with-ids'].forEach(id => controls.push(id.toLowerCase()));
                  }
                  if (inc['matching']) {
                    inc['matching'].forEach(m => {
                      if (m.pattern) {
                        controls.push(m.pattern.toLowerCase());
                      }
                    });
                  }
                });
              }
            });
          }
          return {
            id: g.id || `group-${generateUUID().slice(0, 4)}`,
            title: g.title || 'Untitled Group',
            props: g.props || [],
            links: g.links || [],
            parts: g.parts || [],
            controls,
            groups: g.groups ? g.groups.map(parseGroup) : []
          };
        };
        setCustomGroups((mergeObj.custom.groups || []).map(parseGroup));
      } else {
        setMergeDirective('as-is');
        setCustomGroups([]);
      }

      const imports = data.imports || [];
      setSelectedCatalogIds(imports.map(imp => getImportUuid(imp.href)).filter(Boolean));
      const importsConf = {};
      imports.forEach(imp => {
        const catUuidLower = getImportUuid(imp.href);
        if (!catUuidLower) return;
        const includeAll = !!imp['include-all'];
        const includeMatching = (imp['include-controls'] || []).flatMap(ic => ic.matching || []);
        const excludeMatching = (imp['exclude-controls'] || []).flatMap(ec => ec.matching || []);
        const excludeIds = (imp['exclude-controls'] || []).flatMap(ec => ec['with-ids'] || []);

        importsConf[catUuidLower] = {
          includeAll,
          includeMatching,
          excludeMatching,
          excludeIds
        };
      });
      setProfileImportsConfig(importsConf);
    }
  };

  const fetchDocAndDeps = async (docUuid, existingDict) => {
    const docUuidLower = docUuid.toLowerCase();
    if (existingDict[docUuidLower]) return;
    existingDict[docUuidLower] = { loading: true };
    
    try {
      let res = await authFetch(`/api/documents/catalogs/${docUuid}`);
      if (!res.ok) {
        res = await authFetch(`/api/documents/profiles/${docUuid}`);
      }
      if (res.ok) {
        const docData = await res.json();
        existingDict[docUuidLower] = docData;
        existingDict[docUuid] = docData;
        
        const rootObj = docData.catalog || docData.profile || {};
        const imports = rootObj.imports || [];
        await Promise.all(
          imports.map(async (imp) => {
            const match = imp.href.match(/([a-f0-9-]{36})/i);
            const depUuid = match ? match[1] : null;
            if (depUuid) {
              await fetchDocAndDeps(depUuid, existingDict);
            }
          })
        );
      } else {
        delete existingDict[docUuidLower];
        delete existingDict[docUuid];
      }
    } catch (err) {
      console.error(`Failed to fetch doc or deps for ${docUuid}:`, err);
      delete existingDict[docUuidLower];
      delete existingDict[docUuid];
    }
  };

  useEffect(() => {
    if (editDoc && rootKey) {
      const data = editDoc[rootKey];
      if (data) {
        importDocumentDataIntoStates(data);
        
        // Async load catalogs for profile visualization
        if (stage === 'profiles' && data.imports) {
          const catIds = data.imports.map(imp => getImportUuid(imp.href)).filter(Boolean);
          setLoadingCatalogs(true);
          const dict = { ...loadedCatalogsData };
          Promise.all(
            catIds.map(catUuid => fetchDocAndDeps(catUuid, dict))
          ).then(() => {
            setLoadedCatalogsData(dict);
          }).catch(err => {
            console.error("Error loading dependencies:", err);
          }).finally(() => {
            setLoadingCatalogs(false);
          });
        }
        
        // Async load profile for SSP visualization
        if (stage === 'ssps') {
          const profileHref = data['import-profile']?.href || '';
          const match = profileHref.match(/([a-f0-9-]{36})/i);
          const profUuid = match ? match[1] : '';
          if (profUuid) {
            loadProfileControls(profUuid);
          }
        }
      }
    } else {
      // Clear visual states for new document
      setUuid(generateUUID());
      setTitle('');
      setVersion('1.0.0');
      setOscalVersion('1.1.2');
      setRemarks('');
      setExtraValues({});
      setCatalogGroups([]);
      setSelectedCatalogIds([]);
      setLoadedCatalogsData({});
      setSelectedControlIds({});
      setVisualComponents([]);
      setSelectedProfileId('');
      setActiveComponentUuids([]);
      setSystemName('');
      setSystemSensLevel('moderate');
      setSystemDescription('');
      setSspImplementedReqs({});
      setSspResolvedControls([]);
      setSspTab('info');
      setAvailableSsps([]);
      setSelectedSspId('');
      setApTasks([]);
      setAvailableAps([]);
      setSelectedApId('');
      setArFindings([]);
      setPoamItems([]);
      setSspLeveragedAuths([]);
      setAvailableArs([]);
      setSelectedArIdForImport('');
    }
    setError(null);
    setValidationResult(null);
  }, [editDoc, stage, rootKey, config]);

  const handleToggleCatalog = async (catUuid) => {
    if (selectedCatalogIds.includes(catUuid)) {
      setSelectedCatalogIds(prev => prev.filter(id => id !== catUuid));
      const catData = loadedCatalogsData[catUuid] || loadedCatalogsData[catUuid.toLowerCase()];
      if (catData) {
        const removedIds = [];
        const traverse = (item) => {
          if (item.controls) {
            item.controls.forEach(c => {
              removedIds.push(c.id.toLowerCase());
              if (c.controls) {
                c.controls.forEach(sub => removedIds.push(sub.id.toLowerCase()));
              }
            });
          }
          if (item.groups) {
            item.groups.forEach(g => traverse(g));
          }
        };
        let catalogToTraverse = catData.catalog;
        if (!catalogToTraverse && catData.profile) {
          const cacheMap = new Map(Object.entries(loadedCatalogsData).map(([k, v]) => [k.toLowerCase(), v]));
          const resolved = resolveProfileSync(catData, cacheMap);
          catalogToTraverse = resolved.catalog;
        }
        if (catalogToTraverse) {
          traverse(catalogToTraverse);
        }
        setSelectedControlIds(prev => {
          const next = { ...prev };
          removedIds.forEach(id => delete next[id]);
          return next;
        });
      }
    } else {
      setSelectedCatalogIds(prev => [...prev, catUuid]);
      setLoadingCatalogs(true);
      try {
        const dict = { ...loadedCatalogsData };
        await fetchDocAndDeps(catUuid, dict);
        setLoadedCatalogsData(dict);
        
        const newIds = {};
        const traverse = (item) => {
          if (item.controls) {
            item.controls.forEach(c => {
              newIds[c.id.toLowerCase()] = true;
              if (c.controls) {
                c.controls.forEach(sub => {
                  newIds[sub.id.toLowerCase()] = true;
                });
              }
            });
          }
          if (item.groups) {
            item.groups.forEach(g => traverse(g));
          }
        };
        
        const catData = dict[catUuid.toLowerCase()] || dict[catUuid];
        if (catData) {
          let catalogToTraverse = catData.catalog;
          if (!catalogToTraverse && catData.profile) {
            const cacheMap = new Map(Object.entries(dict).map(([k, v]) => [k.toLowerCase(), v]));
            const resolved = resolveProfileSync(catData, cacheMap);
            catalogToTraverse = resolved.catalog;
          }
          if (catalogToTraverse) {
            traverse(catalogToTraverse);
          }
          setSelectedControlIds(prev => ({ ...prev, ...newIds }));
        }
      } catch (err) {
        console.error("Error toggling catalog/profile:", err);
      } finally {
        setLoadingCatalogs(false);
      }
    }
  };

  const buildDocument = () => {
    let finalVersion = version;
    if (stage === 'catalogs' && editDoc && editDoc.catalog) {
      const originalTitle = editDoc.catalog.metadata?.title || '';
      const originalVersion = editDoc.catalog.metadata?.version || '1.0.0';
      if (title === originalTitle) {
        const match = originalVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);
        if (match) {
          const major = parseInt(match[1]);
          const minor = parseInt(match[2]);
          const patch = parseInt(match[3]) + 1;
          finalVersion = `${major}.${minor}.${patch}`;
        }
      }
    }

    const doc = {
      [rootKey]: {
        uuid,
        metadata: {
          title,
          'last-modified': new Date().toISOString(),
          version: finalVersion,
          'oscal-version': oscalVersion,
          ...(remarks ? { remarks } : {}),
          ...(stage === 'profiles' && profileRoles.length > 0 ? { roles: profileRoles } : {}),
        },
      },
    };

    if (stage === 'catalogs' && editorMode === 'visual') {
      doc[rootKey].groups = catalogGroups;
    } else if (stage === 'profiles' && editorMode === 'visual') {
      const importsList = selectedCatalogIds.map(catUuid => {
        const catUuidLower = catUuid.toLowerCase();
        const config = profileImportsConfig[catUuidLower] || {};
        
        const catData = loadedCatalogsData[catUuid];
        if (!catData || !catData.catalog) return null;
        
        const catControlIds = [];
        const traverse = (item) => {
          if (item.controls) {
            item.controls.forEach(c => {
              catControlIds.push(c.id.toLowerCase());
              if (c.controls) {
                c.controls.forEach(sub => {
                  catControlIds.push(sub.id.toLowerCase());
                });
              }
            });
          }
          if (item.groups) {
            item.groups.forEach(g => traverse(g));
          }
        };
        traverse(catData.catalog);

        const selectedForCat = catControlIds.filter(id => !!selectedControlIds[id]);

        const includeControls = [];
        if (selectedForCat.length > 0) {
          includeControls.push({
            "with-ids": selectedForCat.map(id => id.toUpperCase())
          });
        }
        if (config.includeMatching && config.includeMatching.length > 0) {
          includeControls.push({
            "matching": config.includeMatching
          });
        }

        const excludeControls = [];
        if (config.excludeIds && config.excludeIds.length > 0) {
          excludeControls.push({
            "with-ids": config.excludeIds.map(id => id.toUpperCase())
          });
        }
        if (config.excludeMatching && config.excludeMatching.length > 0) {
          excludeControls.push({
            "matching": config.excludeMatching
          });
        }

        return {
          href: `../catalogs/${catUuid}.json`,
          ...(config.includeAll ? { "include-all": {} } : {}),
          ...(includeControls.length > 0 ? { "include-controls": includeControls } : {}),
          ...(excludeControls.length > 0 ? { "exclude-controls": excludeControls } : {})
        };
      }).filter(Boolean);

      doc[rootKey].imports = importsList;

      const setParamsList = Object.entries(profileSetParams)
        .map(([paramId, val]) => {
          const res = { "param-id": paramId };
          if (typeof val === 'string') {
            if (val.trim()) {
              res.values = val.split(',').map(s => s.trim()).filter(Boolean);
              return res;
            }
            return null;
          }
          if (val.values?.trim()) {
            res.values = val.values.split(',').map(s => s.trim()).filter(Boolean);
          }
          if (val.label?.trim()) res.label = val.label;
          if (val.class?.trim()) res.class = val.class;
          if (val.usage?.trim()) res.usage = val.usage;
          if (val.select?.choice?.trim()) {
            res.select = {
              "how-many": val.select.howMany || 'one',
              choice: val.select.choice.split(',').map(s => s.trim()).filter(Boolean)
            };
          }
          if (val.constraints && val.constraints.length > 0) {
            const filtered = val.constraints.filter(c => c.description?.trim() || c.testExpression?.trim());
            if (filtered.length > 0) {
              res.constraints = filtered.map(c => ({
                ...(c.description ? { description: c.description } : {}),
                ...(c.testExpression ? {
                  tests: [{
                    expression: c.testExpression,
                    ...(c.testRemarks ? { remarks: c.testRemarks } : {})
                  }]
                } : {})
              }));
            }
          }
          if (val.guidelines?.trim()) {
            res.guidelines = [{ prose: val.guidelines }];
          }
          
          if (Object.keys(res).length > 1) return res;
          return null;
        }).filter(Boolean);

      const altersList = Object.entries(profileAlters)
        .filter(([ctrlId, alt]) => {
          const hasAdds = (alt.adds || []).some(add => {
            if (add.type === 'part') return add.prose?.trim();
            if (add.type === 'prop') return add.propName?.trim() && add.propValue?.trim();
            if (add.type === 'param') return add.paramId?.trim() && add.paramValue?.trim();
            if (add.type === 'link') return add.linkHref?.trim();
            if (add.type === 'responsible-party') return add.roleId?.trim();
            return false;
          });
          const hasRemoves = (alt.removes || []).some(rem => 
            rem.byId?.trim() || rem.byName?.trim() || rem.byClass?.trim() || rem.byItemName?.trim() || rem.nsRef?.trim()
          );
          return hasAdds || hasRemoves;
        })
        .map(([ctrlId, alt]) => {
          const addsList = [];
          
          (alt.adds || []).forEach(add => {
            const position = add.position || 'ending';
            const byId = add.byId || '';
            const addObj = {
              position,
              ...(byId ? { 'by-id': byId } : {})
            };
            
            if (add.type === 'part' && add.prose?.trim()) {
              addObj.parts = [
                {
                  id: (add.partId && add.partId !== add.byId)
                    ? add.partId
                    : `${add.byId || ctrlId}_modified`,
                  name: 'statement',
                  prose: add.prose
                }
              ];
              addsList.push(addObj);
            } else if (add.type === 'prop' && add.propName?.trim() && add.propValue?.trim()) {
              addObj.props = [
                {
                  name: add.propName,
                  value: add.propValue
                }
              ];
              addsList.push(addObj);
            } else if (add.type === 'param' && add.paramId?.trim() && add.paramValue?.trim()) {
              addObj.params = [
                {
                  id: add.paramId,
                  label: add.paramLabel || '',
                  values: [add.paramValue]
                }
              ];
              addsList.push(addObj);
            } else if (add.type === 'link' && add.linkHref?.trim()) {
              addObj.links = [
                {
                  href: add.linkHref,
                  text: add.linkText || ''
                }
              ];
              addsList.push(addObj);
            } else if (add.type === 'responsible-party' && add.roleId?.trim()) {
              addObj['responsible-parties'] = [
                {
                  'role-id': add.roleId,
                  'party-uuids': add.partyUuids ? add.partyUuids.split(',').map(s => s.trim()).filter(Boolean) : []
                }
              ];
              addsList.push(addObj);
            }
          });

          const removes = (alt.removes || [])
            .filter(rem => rem.byId?.trim() || rem.byName?.trim() || rem.byClass?.trim() || rem.byItemName?.trim() || rem.nsRef?.trim())
            .map(rem => ({
              ...(rem.byId ? { 'by-id': rem.byId } : {}),
              ...(rem.byName ? { 'by-name': rem.byName } : {}),
              ...(rem.byClass ? { 'by-class': rem.byClass } : {}),
              ...(rem.byItemName ? { 'by-item-name': rem.byItemName } : {}),
              ...(rem.nsRef ? { 'by-ns': rem.nsRef } : {})
            }));

          return {
            "control-id": ctrlId.toUpperCase(),
            ...(addsList.length > 0 ? { adds: addsList } : {}),
            ...(removes.length > 0 ? { removes } : {})
          };
        });

      const modifyObj = {};
      if (setParamsList.length > 0) modifyObj["set-parameters"] = setParamsList;
      if (altersList.length > 0) modifyObj.alters = altersList;

      if (Object.keys(modifyObj).length > 0) {
        doc[rootKey].modify = modifyObj;
      } else if (editDoc && editDoc.profile?.modify) {
        doc[rootKey].modify = editDoc.profile.modify;
      }

      if (profileLocalControls.length > 0) {
        doc[rootKey]['local-controls'] = profileLocalControls;
      }

      // Serialize merge directive
      const mergeObj = {
        combine: {
          method: combineMethod
        }
      };
      if (mergeDirective === 'flat') {
        mergeObj.flat = {};
      } else if (mergeDirective === 'custom') {
        const formatGroup = (g) => {
          const groupObj = {
            id: g.id || `group-${generateUUID().slice(0, 4)}`,
            title: g.title || 'Untitled Group',
            props: g.props || [],
            links: g.links || [],
            parts: g.parts || []
          };
          if (g.controls && g.controls.length > 0) {
            const withIds = g.controls.filter(c => !c.includes('*')).map(c => c.toUpperCase());
            const matching = g.controls.filter(c => c.includes('*')).map(c => ({ pattern: c }));
            
            const incCtrls = [];
            if (withIds.length > 0) {
              incCtrls.push({ "with-ids": withIds });
            }
            if (matching.length > 0) {
              incCtrls.push({ "matching": matching });
            }
            
            if (incCtrls.length > 0) {
              groupObj['insert-controls'] = [
                {
                  'include-controls': incCtrls
                }
              ];
            }
          }
          if (g.groups && g.groups.length > 0) {
            groupObj.groups = g.groups.map(formatGroup);
          }
          return groupObj;
        };
        mergeObj.custom = {
          groups: customGroups.map(formatGroup)
        };
      } else {
        mergeObj['as-is'] = {};
      }
      doc[rootKey].merge = mergeObj;
    } else if (stage === 'component-definitions' && editorMode === 'visual') {
      doc[rootKey].components = visualComponents.map(c => ({
        uuid: c.uuid,
        type: c.type,
        title: c.title,
        description: c.description,
        purpose: c.purpose,
        props: c.props || [],
        protocols: c.protocols || [],
        dependencies: c.dependencies || [],
        "responsible-roles": c.responsibleRoles || [],
        "control-implementations": c.controlImplementations || []
      }));
    } else if (stage === 'ssps' && editorMode === 'visual') {
      if (!selectedProfileId) {
        throw new Error("Target Profile is required in visual mode");
      }
      doc[rootKey]['import-profile'] = {
        href: `/api/documents/profiles/${selectedProfileId}`
      };
      
      const sysProps = [
        { name: 'fips-199-confidentiality-impact-level', value: fipsConf },
        { name: 'fips-199-integrity-impact-level', value: fipsInt },
        { name: 'fips-199-availability-impact-level', value: fipsAvail }
      ];

      const finalResources = editDoc?.['back-matter']?.resources ? JSON.parse(JSON.stringify(editDoc['back-matter'].resources)) : [];
      const referencedResourceUuids = new Set();

      const prepareDiagramsForSaving = (diagramsList) => {
        return (diagramsList || []).map(diag => {
          const { location, filename, mediaType, ...rest } = diag;
          
          if (location && location.startsWith('data:')) {
            const parts = location.split(',');
            const mime = parts[0].split(':')[1].split(';')[0];
            const base64Val = parts[1];
            
            const resourceUuid = diag.links?.find(l => l.rel === 'diagram')?.href?.replace('#', '') || generateUUID();
            referencedResourceUuids.add(resourceUuid);
            
            const newResource = {
              uuid: resourceUuid,
              title: filename || 'Diagram Attachment',
              base64: {
                filename: filename || 'attachment.png',
                'media-type': mime,
                value: base64Val
              }
            };
            const resourceIdx = finalResources.findIndex(r => r.uuid === resourceUuid);
            if (resourceIdx > -1) {
              finalResources[resourceIdx] = newResource;
            } else {
              finalResources.push(newResource);
            }
            
            return {
              ...rest,
              links: [
                {
                  href: `#${resourceUuid}`,
                  rel: 'diagram'
                }
              ]
            };
          } else if (location) {
            const linkHref = location.startsWith('#') ? location : location;
            if (linkHref.startsWith('#')) {
              referencedResourceUuids.add(linkHref.replace('#', ''));
            }
            return {
              ...rest,
              links: [
                {
                  href: linkHref,
                  rel: 'diagram'
                }
              ]
            };
          }
          return rest;
        });
      };

      const preparedAuthBoundaryDiagrams = prepareDiagramsForSaving(authBoundaryDiagrams);
      const preparedNetArchDiagrams = prepareDiagramsForSaving(netArchDiagrams);
      const preparedDataFlowDiagrams = prepareDiagramsForSaving(dataFlowDiagrams);

      doc[rootKey]['system-characteristics'] = {
        'system-name': systemName,
        'security-sensitivity-level': systemSensLevel,
        'description': systemDescription,
        'system-status': {
          state: sspSystemStatus
        },
        props: sysProps,
        'leveraged-authorizations': sspLeveragedAuths,
        'authorization-boundary': {
          description: authBoundaryDesc,
          ...(preparedAuthBoundaryDiagrams.length > 0 ? { diagrams: preparedAuthBoundaryDiagrams } : {})
        },
        'network-architecture': {
          description: netArchDesc,
          ...(preparedNetArchDiagrams.length > 0 ? { diagrams: preparedNetArchDiagrams } : {})
        },
        'data-flow': {
          description: dataFlowDesc,
          ...(preparedDataFlowDiagrams.length > 0 ? { diagrams: preparedDataFlowDiagrams } : {})
        },
        users: sspUsersList,
        'last-modified': new Date().toISOString()
      };

      const cleanResources = finalResources.filter(r => {
        if (r.base64) {
          return referencedResourceUuids.has(r.uuid);
        }
        return true;
      });

      if (cleanResources.length > 0) {
        doc[rootKey]['back-matter'] = {
          resources: cleanResources
        };
      }
      
      const allSelectedComps = [];
      activeComponentUuids.forEach(uuid => {
        const found = availableComponents.find(c => c.uuid === uuid);
        if (found) {
          allSelectedComps.push({
            uuid: found.uuid,
            type: found.type || 'software',
            title: found.title,
            description: found.description || ''
          });
        }
      });
      doc[rootKey]['system-implementation'] = {
        components: allSelectedComps
      };

      const implementedRequirements = Object.entries(sspImplementedReqs).map(([ctrlId, data]) => {
        const byComps = Object.entries(data.byComponents || {})
          .filter(([compUuid, desc]) => activeComponentUuids.includes(compUuid) && desc.trim())
          .map(([compUuid, desc]) => ({
            'component-uuid': compUuid,
            description: desc
          }));

        const setParamsList = Object.entries(data.setParameters || {})
          .filter(([paramId, val]) => val.trim())
          .map(([paramId, val]) => ({
            'param-id': paramId,
            values: val.split(',').map(s => s.trim()).filter(Boolean)
          }));

        return {
          uuid: generateUUID(),
          'control-id': ctrlId,
          description: data.description || '',
          'by-components': byComps,
          ...(setParamsList.length > 0 ? { 'set-parameters': setParamsList } : {}),
          ...(data.inheritanceType && data.inheritanceType !== 'none' ? { props: [{ name: 'inheritance-type', value: data.inheritanceType }] } : {}),
          ...(data.leveragedAuthUuid ? { links: [{ href: `#${data.leveragedAuthUuid}`, rel: 'leveraged-authorization' }] } : {})
        };
      });

      doc[rootKey]['control-implementation'] = {
        description: `Control implementation for ${systemName}`,
        'implemented-requirements': implementedRequirements
      };
    } else if (stage === 'assessment-plans' && editorMode === 'visual') {
      if (selectedSspId) {
        doc[rootKey]['import-ssp'] = {
          href: `/api/documents/ssps/${selectedSspId}`
        };
      }
      doc[rootKey].tasks = apTasks.map(t => ({
        uuid: t.uuid,
        type: t.type,
        title: t.title,
        description: t.description,
        start: t.start ? new Date(t.start).toISOString() : undefined,
        end: t.end ? new Date(t.end).toISOString() : undefined
      }));
      if (apAssets.length > 0) {
        doc[rootKey]['assessment-assets'] = {
          components: apAssets.map(a => ({
            uuid: a.uuid,
            type: a.type,
            title: a.title,
            description: a.description
          }))
        };
      }
      if (apReviewedControls.length > 0) {
        doc[rootKey]['reviewed-controls'] = apReviewedControls.map(rc => ({
          'control-id': rc.controlId.toUpperCase(),
          props: (rc.methods || []).map(m => ({ name: 'assessment-method', value: m }))
        }));
      }
      if (apLocalDefinitions.length > 0) {
        doc[rootKey]['local-definitions'] = {
          components: apLocalDefinitions.map(ld => ({
            uuid: ld.uuid,
            type: 'custom-asset',
            title: ld.title,
            description: ld.description
          }))
        };
      }
    } else if (stage === 'assessment-results' && editorMode === 'visual') {
      if (selectedApId) {
        doc[rootKey]['import-ap'] = {
          href: `/api/documents/assessment-plans/${selectedApId}`
        };
      }
      doc[rootKey].results = arFindings.map(f => ({
        uuid: f.uuid,
        title: f.title,
        description: f.description,
        status: f.status,
        target: f.target ? { 'target-id': f.target, type: 'control' } : undefined,
        'related-observations': (f.relatedObservations || []).map(oUuid => ({ 'observation-uuid': oUuid })),
        'associated-risks': (f.associatedRisks || []).map(rUuid => ({ 'risk-uuid': rUuid })),
        attestation: {
          state: f.attestationState || 'satisfied',
          statement: f.attestationStatement || ''
        }
      }));
      if (arLogs.length > 0) {
        doc[rootKey]['assessment-log'] = arLogs.map(l => ({
          uuid: l.uuid,
          start: l.start ? new Date(l.start).toISOString() : undefined,
          end: l.end ? new Date(l.end).toISOString() : undefined,
          description: l.description
        }));
      }
      if (arObservations.length > 0) {
        doc[rootKey].observations = arObservations.map(o => ({
          uuid: o.uuid,
          description: o.description,
          type: o.type,
          links: o.evidence ? [{ href: o.evidence, rel: 'evidence' }] : undefined,
          subjects: o.componentUuid ? [{ 'subject-uuid': o.componentUuid, type: 'component' }] : undefined
        }));
      }
      if (arRisks.length > 0) {
        doc[rootKey].risks = arRisks.map(r => ({
          uuid: r.uuid,
          description: r.description,
          severity: r.severity,
          recommendation: r.recommendation,
          observationUuid: r.observationUuid
        }));
      }
    } else if (stage === 'poams' && editorMode === 'visual') {
      doc[rootKey]['poam-items'] = poamItems.map((item, index) => {
        if (item.status === 'completed' && !item.evidence?.trim()) {
          throw new Error(`POA&M Item #${index + 1} ("${item.title || 'Untitled'}") requires a verification evidence (Belegnachweis) before completion.`);
        }
        if (item.deviationType && item.deviationType !== 'none' && !item.deviationRationale?.trim()) {
          throw new Error(`POA&M Item #${index + 1} ("${item.title || 'Untitled'}") requires a deviation rationale.`);
        }
        return {
          uuid: item.uuid,
          title: item.title,
          description: item.description,
          remediation: item.remediation || undefined,
          status: item.status,
          'due-date': item.dueDate || undefined,
          props: item.deviationType && item.deviationType !== 'none' ? [
            { name: 'deviation-type', value: item.deviationType },
            { name: 'deviation-rationale', value: item.deviationRationale || '' }
          ] : undefined,
          links: item.evidence ? [
            { href: item.evidence, rel: 'evidence' }
          ] : undefined
        };
      });
    } else if (stage === 'control-mappings') {
      doc[rootKey].provenance = {
        method: 'human',
        'matching-rationale': 'syntactic',
        status: 'draft',
        'mapping-description': remarks || 'Manual framework mapping collection'
      };
      doc[rootKey].mappings = [];
    } else {
      for (const f of config.extraFields || []) {
        const raw = extraValues[f.key];
        if (raw && raw.trim()) {
          try {
            doc[rootKey][f.key] = JSON.parse(raw);
          } catch {
            throw new Error(`Invalid JSON in field "${f.label}"`);
          }
        }
      }
    }
    return doc;
  };

  const handleModeToggle = (newMode) => {
    if (newMode === editorMode) return;
    
    if (newMode === 'raw') {
      try {
        const doc = buildDocument();
        setRawJsonText(JSON.stringify(doc, null, 2));
        setEditorMode('raw');
        setError(null);
      } catch (err) {
        setError(`Cannot switch to Raw JSON: ${err.message}`);
      }
    } else {
      try {
        const parsed = JSON.parse(rawJsonText);
        const data = parsed[rootKey];
        if (!data) {
          throw new Error(`Missing root key "${rootKey}"`);
        }
        importDocumentDataIntoStates(data);
        
        // If ssp, load profile controls
        if (stage === 'ssps') {
          const profileHref = data['import-profile']?.href || '';
          const match = profileHref.match(/([a-f0-9-]{36})/i);
          const profUuid = match ? match[1] : '';
          if (profUuid) {
            loadProfileControls(profUuid);
          }
        }
        
        setError(null);
        setEditorMode('visual');
      } catch (err) {
        setError(`Failed to switch to Visual: Raw JSON is invalid. (${err.message})`);
      }
    }
  };

  const handleValidate = async () => {
    setError(null);
    setValidationResult(null);
    setValidating(true);
    try {
      const doc = editorMode === 'raw' ? JSON.parse(rawJsonText) : buildDocument();
      if (!doc[rootKey]) {
        throw new Error(`Invalid document structure: missing root key "${rootKey}"`);
      }
      const response = await authFetch(`/api/validate/${stage}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      });
      const data = await response.json();
      if (response.ok) {
        setValidationResult({ ok: true, message: `Valid ${config.label} document.` });
      } else {
        setValidationResult({ ok: false, message: data.detail || 'Validation failed.' });
      }
    } catch (err) {
      setValidationResult({ ok: false, message: err.message });
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      if (stage === 'ssps' && editorMode === 'visual') {
        const openParams = [];
        sspResolvedControls.forEach(ctrl => {
          if (ctrl.params) {
            ctrl.params.forEach(param => {
              const reqData = sspImplementedReqs[ctrl.id.toLowerCase()] || {};
              const hasSspVal = reqData.setParameters?.[param.id] !== undefined && reqData.setParameters[param.id] !== '';
              const defaultVal = param.values ? param.values.join(', ') : '';
              if (!hasSspVal && !defaultVal) {
                openParams.push(`${ctrl.id}: ${param.id} (${param.label || 'no label'})`);
              }
            });
          }
        });
        if (openParams.length > 0) {
          const proceed = window.confirm(
            `Warning: The following parameters are not yet set in the SSP:\n\n` +
            openParams.join('\n') +
            `\n\nDo you still want to save the document?`
          );
          if (!proceed) {
            setSaving(false);
            return;
          }
        }
      }
      const doc = editorMode === 'raw' ? JSON.parse(rawJsonText) : buildDocument();
      if (!doc[rootKey]) {
        throw new Error(`Invalid document structure: missing root key "${rootKey}"`);
      }
      const response = await authFetch(`/api/documents/${stage}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(doc),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to save document.');
      }
      if (doc[rootKey]?.metadata?.version) {
        setVersion(doc[rootKey].metadata.version);
      }
      onSaved(doc);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderVisualCatalogBuilder = () => {
    const handleAddGroup = () => {
      setCatalogGroups(prev => [...prev, {
        id: '',
        class: 'family',
        title: '',
        controls: []
      }]);
    };

    const handleRemoveGroup = (gIdx) => {
      setCatalogGroups(prev => prev.filter((_, i) => i !== gIdx));
    };

    const handleUpdateGroup = (gIdx, field, val) => {
      setCatalogGroups(prev => prev.map((g, i) => i === gIdx ? { ...g, [field]: val } : g));
    };

    const handleMoveGroupUp = (gIdx) => {
      if (gIdx === 0) return;
      setCatalogGroups(prev => {
        const next = [...prev];
        const temp = next[gIdx];
        next[gIdx] = next[gIdx - 1];
        next[gIdx - 1] = temp;
        return next;
      });
    };

    const handleMoveGroupDown = (gIdx) => {
      setCatalogGroups(prev => {
        if (gIdx === prev.length - 1) return prev;
        const next = [...prev];
        const temp = next[gIdx];
        next[gIdx] = next[gIdx + 1];
        next[gIdx + 1] = temp;
        return next;
      });
    };

    const handleAddControl = (gIdx) => {
      setCatalogGroups(prev => prev.map((g, i) => {
        if (i !== gIdx) return g;
        return {
          ...g,
          controls: [...(g.controls || []), {
            id: '',
            title: '',
            params: [],
            parts: [{ id: `${g.id || 'grp'}-temp_smt`, name: 'statement', prose: '' }]
          }]
        };
      }));
    };

    const handleRemoveControl = (gIdx, cIdx) => {
      setCatalogGroups(prev => prev.map((g, i) => {
        if (i !== gIdx) return g;
        return {
          ...g,
          controls: g.controls.filter((_, j) => j !== cIdx)
        };
      }));
    };

    const handleUpdateControl = (gIdx, cIdx, field, val) => {
      setCatalogGroups(prev => prev.map((g, i) => {
        if (i !== gIdx) return g;
        return {
          ...g,
          controls: g.controls.map((c, j) => {
            if (j !== cIdx) return c;
            if (field === 'prose') {
              const parts = c.parts ? [...c.parts] : [];
              const stmtIdx = parts.findIndex(p => p.name === 'statement');
              if (stmtIdx >= 0) {
                parts[stmtIdx] = { ...parts[stmtIdx], prose: val };
              } else {
                parts.push({ id: `${c.id || 'ctrl'}_smt`, name: 'statement', prose: val });
              }
              return { ...c, parts };
            }
            return { ...c, [field]: val };
          })
        };
      }));
    };

    const handleAddParam = (gIdx, cIdx) => {
      setCatalogGroups(prev => prev.map((g, i) => {
        if (i !== gIdx) return g;
        return {
          ...g,
          controls: g.controls.map((c, j) => {
            if (j !== cIdx) return c;
            return {
              ...c,
              params: [...(c.params || []), { id: '', label: '', values: [''] }]
            };
          })
        };
      }));
    };

    const handleRemoveParam = (gIdx, cIdx, pIdx) => {
      setCatalogGroups(prev => prev.map((g, i) => {
        if (i !== gIdx) return g;
        return {
          ...g,
          controls: g.controls.map((c, j) => {
            if (j !== cIdx) return c;
            return {
              ...c,
              params: (c.params || []).filter((_, k) => k !== pIdx)
            };
          })
        };
      }));
    };

    const handleUpdateParam = (gIdx, cIdx, pIdx, field, val) => {
      setCatalogGroups(prev => prev.map((g, i) => {
        if (i !== gIdx) return g;
        return {
          ...g,
          controls: g.controls.map((c, j) => {
            if (j !== cIdx) return c;
            return {
              ...c,
              params: (c.params || []).map((p, k) => {
                if (k !== pIdx) return p;
                if (field === 'values') {
                  return { ...p, values: [val] };
                }
                return { ...p, [field]: val };
              })
            };
          })
        };
      }));
    };

    const handleUpdateControlPartProse = (gIdx, cIdx, partName, val) => {
      setCatalogGroups(prev => prev.map((g, i) => {
        if (i !== gIdx) return g;
        return {
          ...g,
          controls: g.controls.map((c, j) => {
            if (j !== cIdx) return c;
            const parts = c.parts ? [...c.parts] : [];
            const idx = parts.findIndex(p => p.name === partName);
            if (idx >= 0) {
              if (val) {
                parts[idx] = { ...parts[idx], prose: val };
              } else {
                parts.splice(idx, 1);
              }
            } else if (val) {
              parts.push({ id: `${c.id || 'ctrl'}_${partName.slice(0, 3)}`, name: partName, prose: val });
            }
            return { ...c, parts };
          })
        };
      }));
    };

    return (
      <div className="visual-catalog-container">
        <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <label className="section-subtitle">Catalog Groups (Families) & Controls</label>
          <button className="btn-primary btn-sm" type="button" onClick={handleAddGroup}>
            + Add Group
          </button>
        </div>

        {catalogGroups.length === 0 ? (
          <div className="empty-state-text">No groups defined yet. Click "Add Group" to begin building the catalog!</div>
        ) : (
          <div className="groups-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {catalogGroups.map((group, gIdx) => (
              <div className="group-card" key={gIdx} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '16px', flex: 1, marginRight: '16px' }}>
                    <div style={{ width: '120px' }}>
                      <label style={{ fontSize: '12px' }}>Group ID *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={group.id}
                        onChange={(e) => handleUpdateGroup(gIdx, 'id', e.target.value)}
                        placeholder="e.g. ac"
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px' }}>Group Title *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={group.title}
                        onChange={(e) => handleUpdateGroup(gIdx, 'title', e.target.value)}
                        placeholder="e.g. Access Control"
                        required
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-secondary btn-sm" type="button" onClick={() => handleMoveGroupUp(gIdx)} disabled={gIdx === 0}>
                      ▲ Up
                    </button>
                    <button className="btn-secondary btn-sm" type="button" onClick={() => handleMoveGroupDown(gIdx)} disabled={gIdx === catalogGroups.length - 1}>
                      ▼ Down
                    </button>
                    <button className="btn-delete" type="button" onClick={() => handleRemoveGroup(gIdx)}>
                      Remove Group
                    </button>
                  </div>
                </div>

                <div className="controls-section" style={{ marginTop: '16px', paddingLeft: '20px', borderLeft: '2px solid var(--color-border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Controls in this Group</span>
                    <button className="btn-secondary btn-sm" type="button" onClick={() => handleAddControl(gIdx)}>
                      + Add Control
                    </button>
                  </div>

                  {(group.controls || []).length === 0 ? (
                    <div className="empty-state-text" style={{ padding: '10px 0' }}>No controls in this group.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {group.controls.map((ctrl, cIdx) => {
                        const stmtPart = (ctrl.parts || []).find(p => p.name === 'statement');
                        const statementProse = stmtPart ? stmtPart.prose : '';
                        const guidancePart = (ctrl.parts || []).find(p => p.name === 'guidance');
                        const guidanceProse = guidancePart ? guidancePart.prose : '';
                        const discussionPart = (ctrl.parts || []).find(p => p.name === 'discussion');
                        const discussionProse = discussionPart ? discussionPart.prose : '';

                        return (
                          <div className="control-card-sub" key={cIdx} style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', gap: '12px', flex: 1, marginRight: '12px' }}>
                                <div style={{ width: '100px' }}>
                                  <label style={{ fontSize: '11px' }}>Control ID *</label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={ctrl.id}
                                    onChange={(e) => handleUpdateControl(gIdx, cIdx, 'id', e.target.value)}
                                    placeholder="e.g. ac-1"
                                    required
                                  />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <label style={{ fontSize: '11px' }}>Control Title *</label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={ctrl.title}
                                    onChange={(e) => handleUpdateControl(gIdx, cIdx, 'title', e.target.value)}
                                    placeholder="e.g. Access Control Policy"
                                    required
                                  />
                                </div>
                              </div>
                              <button className="btn-delete" style={{ padding: '2px 8px', fontSize: '12px' }} type="button" onClick={() => handleRemoveControl(gIdx, cIdx)}>
                                Remove Control
                              </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '11px' }}>Statement Prose</label>
                                <textarea
                                  className="form-textarea"
                                  value={statementProse}
                                  onChange={(e) => handleUpdateControlPartProse(gIdx, cIdx, 'statement', e.target.value)}
                                  placeholder="Develop, document, and disseminate..."
                                  rows={3}
                                  style={{ fontSize: '12px' }}
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '11px' }}>Guidance (Implementation Notes)</label>
                                <textarea
                                  className="form-textarea"
                                  value={guidanceProse}
                                  onChange={(e) => handleUpdateControlPartProse(gIdx, cIdx, 'guidance', e.target.value)}
                                  placeholder="How to implement this control..."
                                  rows={3}
                                  style={{ fontSize: '12px' }}
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '11px' }}>Discussion</label>
                                <textarea
                                  className="form-textarea"
                                  value={discussionProse}
                                  onChange={(e) => handleUpdateControlPartProse(gIdx, cIdx, 'discussion', e.target.value)}
                                  placeholder="Further context or rationale..."
                                  rows={3}
                                  style={{ fontSize: '12px' }}
                                />
                              </div>
                            </div>

                            <div className="params-sub-section" style={{ marginTop: '12px', background: 'var(--color-surface-2)', padding: '12px', borderRadius: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Control Parameters</span>
                                <button className="btn-secondary btn-xs" type="button" onClick={() => handleAddParam(gIdx, cIdx)}>
                                  + Add Parameter
                                </button>
                              </div>

                              {(ctrl.params || []).length === 0 ? (
                                <div className="empty-state-text" style={{ fontSize: '11px' }}>No parameters defined for this control.</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {ctrl.params.map((param, pIdx) => (
                                    <div key={pIdx} style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-surface-1)', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border-subtle)', marginBottom: '8px' }}>
                                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                                        <div style={{ width: '150px' }}>
                                          <label style={{ fontSize: '10px' }}>Parameter ID</label>
                                          <input
                                            type="text"
                                            className="form-input"
                                            value={param.id}
                                            onChange={(e) => handleUpdateParam(gIdx, cIdx, pIdx, 'id', e.target.value)}
                                            placeholder="e.g. ac-1_prm_1"
                                            style={{ padding: '4px 8px', fontSize: '12px' }}
                                          />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: '10px' }}>Label / Description</label>
                                          <input
                                            type="text"
                                            className="form-input"
                                            value={param.label}
                                            onChange={(e) => handleUpdateParam(gIdx, cIdx, pIdx, 'label', e.target.value)}
                                            placeholder="e.g. roles permitted"
                                            style={{ padding: '4px 8px', fontSize: '12px' }}
                                          />
                                        </div>
                                        <div style={{ width: '180px' }}>
                                          <label style={{ fontSize: '10px' }}>Default Value</label>
                                          <input
                                            type="text"
                                            className="form-input"
                                            value={param.values ? param.values[0] : ''}
                                            onChange={(e) => handleUpdateParam(gIdx, cIdx, pIdx, 'values', e.target.value)}
                                            placeholder="e.g. Administrator"
                                            style={{ padding: '4px 8px', fontSize: '12px' }}
                                          />
                                        </div>
                                        <button className="btn-delete" style={{ padding: '4px 8px', fontSize: '11px', marginBottom: '2px' }} type="button" onClick={() => handleRemoveParam(gIdx, cIdx, pIdx)}>
                                          ✕
                                        </button>
                                      </div>
                                      <div style={{ display: 'flex', gap: '10px', marginTop: '6px', width: '100%' }}>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: '9px', display: 'block' }}>Selection Choices (comma-separated)</label>
                                          <input
                                            type="text"
                                            className="form-input"
                                            value={param.select?.choice ? param.select.choice.join(', ') : ''}
                                            onChange={(e) => {
                                              const choices = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                              const select = { ...param.select, choice: choices.length > 0 ? choices : undefined };
                                              handleUpdateParam(gIdx, cIdx, pIdx, 'select', select);
                                            }}
                                            placeholder="e.g. Daily, Weekly, Monthly"
                                            style={{ padding: '2px 6px', fontSize: '11px' }}
                                          />
                                        </div>
                                        <div style={{ width: '120px' }}>
                                          <label style={{ fontSize: '9px', display: 'block' }}>Quantifier</label>
                                          <select
                                            className="form-input"
                                            value={param.select?.['how-many'] || ''}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              const select = { ...param.select, 'how-many': val || undefined };
                                              handleUpdateParam(gIdx, cIdx, pIdx, 'select', select);
                                            }}
                                            style={{ padding: '2px 4px', fontSize: '11px' }}
                                          >
                                            <option value="">None</option>
                                            <option value="one">Exactly One</option>
                                            <option value="one-or-more">One or More</option>
                                          </select>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: '9px', display: 'block' }}>Regex Constraint</label>
                                          <input
                                            type="text"
                                            className="form-input"
                                            value={param.constraints?.[0]?.tests?.[0]?.expression || ''}
                                            onChange={(e) => {
                                              const expr = e.target.value;
                                              const constraints = expr ? [{
                                                description: 'Regex validation constraint',
                                                tests: [{ expression: expr }]
                                              }] : undefined;
                                              handleUpdateParam(gIdx, cIdx, pIdx, 'constraints', constraints);
                                            }}
                                            placeholder="e.g. ^[0-9]+ Tage$"
                                            style={{ padding: '2px 6px', fontSize: '11px' }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                  <label style={{ fontSize: '11px', margin: 0 }}>Assessment Objectives (prose)</label>
                                  <button
                                    type="button"
                                    onClick={() => objProseRefs.current[`${gIdx}_${cIdx}`]?.insertParamPlaceholder()}
                                    className="btn-soft"
                                    style={{ padding: '2px 6px', fontSize: '10px', color: 'var(--color-primary)' }}
                                  >
                                    ⚙️ Add Parameter
                                  </button>
                                </div>
                                <ProseWithParams
                                  ref={(el) => { if (el) objProseRefs.current[`${gIdx}_${cIdx}`] = el; }}
                                  value={(() => {
                                    const obj = (ctrl.parts || []).find(p => p.name === 'objective');
                                    return obj ? obj.prose : '';
                                  })()}
                                  onChange={(val) => {
                                    const parts = ctrl.parts ? [...ctrl.parts] : [];
                                    const oIdx = parts.findIndex(p => p.name === 'objective');
                                    if (oIdx >= 0) {
                                      parts[oIdx] = { ...parts[oIdx], prose: val };
                                    } else {
                                      parts.push({ id: `${ctrl.id}_obj`, name: 'objective', prose: val });
                                    }
                                    handleUpdateControl(gIdx, cIdx, 'parts', parts);
                                  }}
                                  params={ctrl.params || []}
                                  placeholder="Define assessment objectives..."
                                  rows={2}
                                  style={{ fontSize: '12px' }}
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                  <label style={{ fontSize: '11px', margin: 0 }}>Assessment Methods (Examine / Interview / Test)</label>
                                  <button
                                    type="button"
                                    onClick={() => methodProseRefs.current[`${gIdx}_${cIdx}`]?.insertParamPlaceholder()}
                                    className="btn-soft"
                                    style={{ padding: '2px 6px', fontSize: '10px', color: 'var(--color-primary)' }}
                                  >
                                    ⚙️ Add Parameter
                                  </button>
                                </div>
                                <ProseWithParams
                                  ref={(el) => { if (el) methodProseRefs.current[`${gIdx}_${cIdx}`] = el; }}
                                  value={(() => {
                                    const m = (ctrl.parts || []).find(p => p.name === 'assessment-method');
                                    return m ? m.prose : '';
                                  })()}
                                  onChange={(val) => {
                                    const parts = ctrl.parts ? [...ctrl.parts] : [];
                                    const mIdx = parts.findIndex(p => p.name === 'assessment-method');
                                    if (mIdx >= 0) {
                                      parts[mIdx] = { ...parts[mIdx], prose: val };
                                    } else {
                                      parts.push({ id: `${ctrl.id}_method`, name: 'assessment-method', prose: val });
                                    }
                                    handleUpdateControl(gIdx, cIdx, 'parts', parts);
                                  }}
                                  params={ctrl.params || []}
                                  placeholder="Define assessment methods (examine, interview, test)..."
                                  rows={2}
                                  style={{ fontSize: '12px' }}
                                />
                              </div>
                            </div>

                            <div className="mappings-section" style={{ marginTop: '12px', background: 'var(--color-surface-2)', padding: '12px', borderRadius: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Framework Mappings (links)</span>
                                <button className="btn-secondary btn-xs" type="button" onClick={() => {
                                  const links = ctrl.links ? [...ctrl.links] : [];
                                  links.push({ rel: 'mapping', href: '', text: '' });
                                  handleUpdateControl(gIdx, cIdx, 'links', links);
                                }}>
                                  + Add Mapping
                                </button>
                              </div>
                              {(ctrl.links || []).length === 0 ? (
                                <div className="empty-state-text" style={{ fontSize: '11px' }}>No mappings defined.</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {ctrl.links.map((link, lIdx) => (
                                    <div key={lIdx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                                      <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '10px' }}>Reference URL / ID</label>
                                        <input
                                          type="text"
                                          className="form-input"
                                          value={link.href}
                                          onChange={(e) => {
                                            const links = [...ctrl.links];
                                            links[lIdx] = { ...links[lIdx], href: e.target.value };
                                            handleUpdateControl(gIdx, cIdx, 'links', links);
                                          }}
                                          placeholder="e.g. https://iso.org/27001/A.12.1"
                                          style={{ padding: '4px 8px', fontSize: '12px' }}
                                        />
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <label style={{ fontSize: '10px' }}>Mapping Title / Text</label>
                                        <input
                                          type="text"
                                          className="form-input"
                                          value={link.text || ''}
                                          onChange={(e) => {
                                            const links = [...ctrl.links];
                                            links[lIdx] = { ...links[lIdx], text: e.target.value };
                                            handleUpdateControl(gIdx, cIdx, 'links', links);
                                          }}
                                          placeholder="e.g. ISO 27001:2022 A.12.1.1"
                                          style={{ padding: '4px 8px', fontSize: '12px' }}
                                        />
                                      </div>
                                      <button className="btn-delete" style={{ padding: '4px 8px', fontSize: '11px', marginBottom: '2px' }} type="button" onClick={() => {
                                        const links = ctrl.links.filter((_, k) => k !== lIdx);
                                        handleUpdateControl(gIdx, cIdx, 'links', links);
                                      }}>
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="enhancements-section" style={{ marginTop: '12px', background: 'var(--color-surface-2)', padding: '12px', borderRadius: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Control Enhancements (Sub-controls)</span>
                                <button className="btn-secondary btn-xs" type="button" onClick={() => {
                                  const subCtrls = ctrl.controls ? [...ctrl.controls] : [];
                                  subCtrls.push({ id: '', title: '', params: [], parts: [{ id: `${ctrl.id}_sub_temp`, name: 'statement', prose: '' }] });
                                  handleUpdateControl(gIdx, cIdx, 'controls', subCtrls);
                                }}>
                                  + Add Enhancement
                                </button>
                              </div>
                              {(ctrl.controls || []).length === 0 ? (
                                <div className="empty-state-text" style={{ fontSize: '11px' }}>No enhancements defined.</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {ctrl.controls.map((subCtrl, sIdx) => (
                                    <div key={sIdx} style={{ background: 'var(--color-surface-1)', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}>
                                      <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                                        <div style={{ width: '100px' }}>
                                          <label style={{ fontSize: '9px' }}>Sub-ID</label>
                                          <input
                                            type="text"
                                            className="form-input"
                                            value={subCtrl.id}
                                            onChange={(e) => {
                                              const subCtrls = [...ctrl.controls];
                                              subCtrls[sIdx] = { ...subCtrls[sIdx], id: e.target.value };
                                              handleUpdateControl(gIdx, cIdx, 'controls', subCtrls);
                                            }}
                                            placeholder="e.g. ac-1.1"
                                            style={{ padding: '2px 4px', fontSize: '11px' }}
                                          />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: '9px' }}>Sub-Title</label>
                                          <input
                                            type="text"
                                            className="form-input"
                                            value={subCtrl.title}
                                            onChange={(e) => {
                                              const subCtrls = [...ctrl.controls];
                                              subCtrls[sIdx] = { ...subCtrls[sIdx], title: e.target.value };
                                              handleUpdateControl(gIdx, cIdx, 'controls', subCtrls);
                                            }}
                                            placeholder="e.g. Automated System Notifications"
                                            style={{ padding: '2px 4px', fontSize: '11px' }}
                                          />
                                        </div>
                                        <button className="btn-delete" style={{ padding: '2px 6px', fontSize: '10px', alignSelf: 'flex-end' }} type="button" onClick={() => {
                                          const subCtrls = ctrl.controls.filter((_, k) => k !== sIdx);
                                          handleUpdateControl(gIdx, cIdx, 'controls', subCtrls);
                                        }}>
                                          ✕
                                        </button>
                                      </div>
                                      <div>
                                        <label style={{ fontSize: '9px' }}>Statement Prose</label>
                                        <textarea
                                          className="form-textarea"
                                          value={subCtrl.parts?.[0]?.prose || ''}
                                          onChange={(e) => {
                                            const subCtrls = [...ctrl.controls];
                                            const parts = subCtrl.parts ? [...subCtrl.parts] : [];
                                            parts[0] = { ...parts[0], prose: e.target.value };
                                            subCtrls[sIdx] = { ...subCtrl[sIdx], parts };
                                            handleUpdateControl(gIdx, cIdx, 'controls', subCtrls);
                                          }}
                                          placeholder="Sub-control statement prose..."
                                          rows={1}
                                          style={{ fontSize: '11px', padding: '4px' }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="subgroups-section" style={{ marginTop: '16px', paddingLeft: '20px', borderLeft: '2px dashed var(--color-border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Subgroups (Nested Groups)</span>
                    <button className="btn-secondary btn-sm" type="button" onClick={() => {
                      const subGroups = group.groups ? [...group.groups] : [];
                      subGroups.push({ id: '', title: '', controls: [] });
                      handleUpdateGroup(gIdx, 'groups', subGroups);
                    }}>
                      + Add Subgroup
                    </button>
                  </div>
                  {(group.groups || []).length === 0 ? (
                    <div className="empty-state-text" style={{ padding: '10px 0' }}>No subgroups in this group.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {group.groups.map((subGrp, sgIdx) => (
                        <div key={sgIdx} style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', gap: '12px', flex: 1, marginRight: '12px' }}>
                              <div style={{ width: '100px' }}>
                                <label style={{ fontSize: '11px' }}>Subgroup ID *</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={subGrp.id}
                                  onChange={(e) => {
                                    const subGroups = [...group.groups];
                                    subGroups[sgIdx] = { ...subGroups[sgIdx], id: e.target.value };
                                    handleUpdateGroup(gIdx, 'groups', subGroups);
                                  }}
                                  placeholder="e.g. ac-sub"
                                  required
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '11px' }}>Subgroup Title *</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  value={subGrp.title}
                                  onChange={(e) => {
                                    const subGroups = [...group.groups];
                                    subGroups[sgIdx] = { ...subGroups[sgIdx], title: e.target.value };
                                    handleUpdateGroup(gIdx, 'groups', subGroups);
                                  }}
                                  placeholder="e.g. Subgroup Title"
                                  required
                                />
                              </div>
                            </div>
                            <button className="btn-delete" style={{ padding: '2px 8px', fontSize: '12px' }} type="button" onClick={() => {
                              const subGroups = group.groups.filter((_, k) => k !== sgIdx);
                              handleUpdateGroup(gIdx, 'groups', subGroups);
                            }}>
                              Remove Subgroup
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderControlTailorItem = (ctrl) => {
    const isChecked = !!selectedControlIds[ctrl.id.toLowerCase()];
    const ctrlLower = ctrl.id.toLowerCase();
    const altVal = profileAlters[ctrlLower] || { position: 'ending', prose: '' };

    return (
      <div key={ctrl.id} className="profile-control-item-container" style={{ background: isChecked ? 'var(--color-surface-3)' : 'transparent', border: isChecked ? '1px solid var(--color-border)' : 'none', borderRadius: '4px', padding: isChecked ? '12px' : '4px', marginBottom: '8px' }}>
        <label className="checkbox-label control-tailor-item" style={{ marginBottom: isChecked ? '8px' : '0' }}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => {
              setSelectedControlIds(prev => ({
                ...prev,
                [ctrl.id.toLowerCase()]: !isChecked
              }));
            }}
          />
          <span className="checkbox-custom"></span>
          <span className="tailor-control-text">
            <strong>{ctrl.id.toUpperCase()}</strong>: {ctrl.title}
          </span>
        </label>

        {isChecked && (
          <div className="control-tailoring-details" style={{ marginTop: '8px', paddingLeft: '28px', borderLeft: '2px solid var(--color-accent)' }}>
            {ctrl.params && ctrl.params.length > 0 && (
              <div className="control-params-override" style={{ marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Parameter Overrides</span>
                {ctrl.params.map(param => {
                  const rawVal = profileSetParams[param.id];
                  const hasCustomConfig = rawVal && typeof rawVal === 'object';
                  const paramVal = hasCustomConfig ? (rawVal.values || '') : (rawVal || (param.values ? param.values.join(', ') : ''));
                  const paramLabel = hasCustomConfig ? (rawVal.label || '') : (param.label || '');
                  const paramClass = hasCustomConfig ? (rawVal.class || '') : (param.class || '');
                  const paramUsage = hasCustomConfig ? (rawVal.usage || '') : (param.usage || '');
                  const selectChoice = hasCustomConfig ? (rawVal.select?.choice || '') : '';
                  const selectHowMany = hasCustomConfig ? (rawVal.select?.howMany || 'one') : 'one';
                  const hasSelect = hasCustomConfig && !!rawVal.select?.choice;
                  
                  const constraintDesc = (hasCustomConfig && rawVal.constraints?.[0]) ? rawVal.constraints[0].description : '';
                  const constraintExpr = (hasCustomConfig && rawVal.constraints?.[0]) ? rawVal.constraints[0].testExpression : '';
                  const constraintRemarks = (hasCustomConfig && rawVal.constraints?.[0]) ? rawVal.constraints[0].testRemarks : '';
                  const hasConstraint = hasCustomConfig && !!(constraintDesc || constraintExpr);
                  
                  const guidelinesText = hasCustomConfig ? (rawVal.guidelines || '') : '';
                  const isOptionsOpen = activeParamOptionsId === param.id;

                  const updateParamField = (field, value) => {
                    setProfileSetParams(prev => {
                      const cur = typeof prev[param.id] === 'object' ? prev[param.id] : {
                        values: typeof prev[param.id] === 'string' ? prev[param.id] : (param.values ? param.values.join(', ') : ''),
                        label: param.label || '',
                        class: param.class || '',
                        usage: param.usage || '',
                        select: { howMany: 'one', choice: '' },
                        constraints: [],
                        guidelines: ''
                      };
                      return {
                        ...prev,
                        [param.id]: { ...cur, [field]: value }
                      };
                    });
                  };

                  return (
                    <div key={param.id} className="param-override-row" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', padding: '6px', background: 'var(--color-surface-4)', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', minWidth: '120px' }}><code>{param.id}</code>:</span>
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '4px 8px', fontSize: '12px', flex: 1, background: 'var(--color-surface)' }}
                          value={paramVal}
                          onChange={(e) => {
                            if (hasCustomConfig) {
                              updateParamField('values', e.target.value);
                            } else {
                              setProfileSetParams(prev => ({
                                ...prev,
                                [param.id]: e.target.value
                              }));
                            }
                          }}
                          placeholder="Override parameter value..."
                        />
                        <button
                          type="button"
                          className="btn-secondary btn-xs"
                          style={{ padding: '3px 6px', fontSize: '10px' }}
                          onClick={() => setActiveParamOptionsId(isOptionsOpen ? null : param.id)}
                        >
                          {isOptionsOpen ? '▲ Close' : '⚙ Options'}
                        </button>
                      </div>
                      
                      {isOptionsOpen && (
                        <div style={{ marginTop: '6px', padding: '8px', borderLeft: '2px solid var(--color-accent-dim)', background: 'var(--color-surface-2)', display: 'flex', flexDirection: 'column', gap: '8px', borderRadius: '2px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Label</label>
                              <input
                                type="text"
                                className="form-input text-xs"
                                style={{ padding: '2px 6px', width: '100%', background: 'var(--color-surface)' }}
                                value={paramLabel}
                                onChange={(e) => updateParamField('label', e.target.value)}
                                placeholder="Param label..."
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Class</label>
                              <input
                                type="text"
                                className="form-input text-xs"
                                style={{ padding: '2px 6px', width: '100%', background: 'var(--color-surface)' }}
                                value={paramClass}
                                onChange={(e) => updateParamField('class', e.target.value)}
                                placeholder="Param class..."
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Usage</label>
                              <input
                                type="text"
                                className="form-input text-xs"
                                style={{ padding: '2px 6px', width: '100%', background: 'var(--color-surface)' }}
                                value={paramUsage}
                                onChange={(e) => updateParamField('usage', e.target.value)}
                                placeholder="Usage description..."
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--color-surface-3)', padding: '6px', borderRadius: '4px' }}>
                            <label className="checkbox-label" style={{ fontSize: '10px', fontWeight: 'bold' }}>
                              <input
                                type="checkbox"
                                checked={hasSelect}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    updateParamField('select', { howMany: 'one', choice: 'Option A, Option B' });
                                  } else {
                                    updateParamField('select', { howMany: 'one', choice: '' });
                                  }
                                }}
                              />
                              <span className="checkbox-custom"></span>
                              <span>Dropdown-Auswahlregeln definieren (Choices)</span>
                            </label>
                            
                            {hasSelect && (
                              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <div style={{ flex: 2 }}>
                                  <label style={{ fontSize: '9px', display: 'block' }}>Optionen (kommagetrennt)</label>
                                  <input
                                    type="text"
                                    className="form-input text-xs"
                                    style={{ padding: '2px 6px', width: '100%', background: 'var(--color-surface)' }}
                                    value={selectChoice}
                                    onChange={(e) => updateParamField('select', { howMany: selectHowMany, choice: e.target.value })}
                                  />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <label style={{ fontSize: '9px', display: 'block' }}>Anzahl</label>
                                  <select
                                    className="form-input text-xs"
                                    style={{ padding: '2px 6px', width: '100%', background: 'var(--color-surface)' }}
                                    value={selectHowMany}
                                    onChange={(e) => updateParamField('select', { howMany: e.target.value, choice: selectChoice })}
                                  >
                                    <option value="one">Genau eine (one)</option>
                                    <option value="one-or-more">Eine oder mehrere (one-or-more)</option>
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--color-surface-3)', padding: '6px', borderRadius: '4px' }}>
                            <label className="checkbox-label" style={{ fontSize: '10px', fontWeight: 'bold' }}>
                              <input
                                type="checkbox"
                                checked={hasConstraint}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    updateParamField('constraints', [{ description: 'Input must be validated', testExpression: 'expression', testRemarks: '' }]);
                                  } else {
                                    updateParamField('constraints', []);
                                  }
                                }}
                              />
                              <span className="checkbox-custom"></span>
                              <span>Add Validations & Constraints (Tests)</span>
                            </label>
                            
                            {hasConstraint && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                <div>
                                  <label style={{ fontSize: '9px', display: 'block' }}>Description</label>
                                  <input
                                    type="text"
                                    className="form-input text-xs"
                                    style={{ padding: '2px 6px', width: '100%', background: 'var(--color-surface)' }}
                                    value={constraintDesc}
                                    onChange={(e) => updateParamField('constraints', [{ description: e.target.value, testExpression: constraintExpr, testRemarks: constraintRemarks }])}
                                  />
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '9px', display: 'block' }}>Test Expression</label>
                                    <input
                                      type="text"
                                      className="form-input text-xs"
                                      style={{ padding: '2px 6px', width: '100%', background: 'var(--color-surface)' }}
                                      value={constraintExpr}
                                      onChange={(e) => updateParamField('constraints', [{ description: constraintDesc, testExpression: e.target.value, testRemarks: constraintRemarks }])}
                                      placeholder="e.g. . >= 1"
                                    />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '9px', display: 'block' }}>Remarks</label>
                                    <input
                                      type="text"
                                      className="form-input text-xs"
                                      style={{ padding: '2px 6px', width: '100%', background: 'var(--color-surface)' }}
                                      value={constraintRemarks}
                                      onChange={(e) => updateParamField('constraints', [{ description: constraintDesc, testExpression: constraintExpr, testRemarks: e.target.value }])}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          <div>
                            <label style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Guidelines (Guidelines Prose)</label>
                            <textarea
                              className="form-input text-xs"
                              style={{ padding: '4px 6px', width: '100%', minHeight: '40px', background: 'var(--color-surface)', fontFamily: 'inherit' }}
                              value={guidelinesText}
                              onChange={(e) => updateParamField('guidelines', e.target.value)}
                              placeholder="Application notes and guidelines..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="control-alterations" style={{ marginTop: '12px', background: 'var(--color-surface-2)', padding: '12px', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Control Alterations (Adds)</span>
                <button type="button" className="btn-secondary btn-xs" onClick={() => {
                  setProfileAlters(prev => {
                    const cur = prev[ctrlLower] || { adds: [], removes: [] };
                    return {
                      ...prev,
                      [ctrlLower]: {
                        ...cur,
                        adds: [...(cur.adds || []), { type: 'part', position: 'ending', byId: '', prose: '', partId: `${ctrlLower}_add_${generateUUID().slice(0, 4)}` }]
                      }
                    };
                  });
                }}>+ Add Alteration</button>
              </div>
              
              {(!altVal.adds || altVal.adds.length === 0) ? (
                <div className="empty-state-text" style={{ fontSize: '11px', marginBottom: '10px' }}>No additions defined.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                  {altVal.adds.map((add, aIdx) => (
                    <div key={aIdx} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        className="form-input"
                        style={{ width: '120px', padding: '4px 8px', fontSize: '12px', background: 'var(--color-surface)' }}
                        value={add.type || 'part'}
                        onChange={(e) => {
                          setProfileAlters(prev => {
                            const cur = prev[ctrlLower];
                            const nextAdds = [...cur.adds];
                            nextAdds[aIdx] = { 
                              ...nextAdds[aIdx], 
                              type: e.target.value,
                              prose: '',
                              propName: '',
                              propValue: '',
                              paramId: '',
                              paramLabel: '',
                              paramValue: '',
                              linkHref: '',
                              linkText: '',
                              roleId: '',
                              partyUuids: ''
                            };
                            return { ...prev, [ctrlLower]: { ...cur, adds: nextAdds } };
                          });
                        }}
                      >
                        <option value="part">Part (Prose)</option>
                        <option value="prop">Prop (Tag)</option>
                        <option value="param">Param</option>
                        <option value="link">Link</option>
                        <option value="responsible-party">Resp. Party</option>
                      </select>

                      <select
                        className="form-input"
                        style={{ width: '100px', padding: '4px 8px', fontSize: '12px', background: 'var(--color-surface)' }}
                        value={add.position}
                        onChange={(e) => {
                          setProfileAlters(prev => {
                            const cur = prev[ctrlLower];
                            const nextAdds = [...cur.adds];
                            nextAdds[aIdx] = { ...nextAdds[aIdx], position: e.target.value };
                            return { ...prev, [ctrlLower]: { ...cur, adds: nextAdds } };
                          });
                        }}
                      >
                        <option value="starting">At Start</option>
                        <option value="ending">At End</option>
                        <option value="before">Before</option>
                        <option value="after">After</option>
                      </select>
                      
                      {(add.position === 'before' || add.position === 'after') && (
                        <input
                          type="text"
                          className="form-input"
                          style={{ width: '100px', padding: '4px 8px', fontSize: '12px', background: 'var(--color-surface)' }}
                          value={add.byId || ''}
                          onChange={(e) => {
                            setProfileAlters(prev => {
                              const cur = prev[ctrlLower];
                              const nextAdds = [...cur.adds];
                              nextAdds[aIdx] = { ...nextAdds[aIdx], byId: e.target.value };
                              return { ...prev, [ctrlLower]: { ...cur, adds: nextAdds } };
                            });
                          }}
                          placeholder="by-id..."
                        />
                      )}
                      
                      {add.type === 'prop' ? (
                        <>
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: '12px', width: '100px', background: 'var(--color-surface)' }}
                            value={add.propName || ''}
                            onChange={(e) => {
                              setProfileAlters(prev => {
                                const cur = prev[ctrlLower];
                                const nextAdds = [...cur.adds];
                                nextAdds[aIdx] = { ...nextAdds[aIdx], propName: e.target.value };
                                return { ...prev, [ctrlLower]: { ...cur, adds: nextAdds } };
                              });
                            }}
                            placeholder="Prop Name"
                          />
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: '12px', flex: 1, background: 'var(--color-surface)', minWidth: '120px' }}
                            value={add.propValue || ''}
                            onChange={(e) => {
                              setProfileAlters(prev => {
                                const cur = prev[ctrlLower];
                                const nextAdds = [...cur.adds];
                                nextAdds[aIdx] = { ...nextAdds[aIdx], propValue: e.target.value };
                                return { ...prev, [ctrlLower]: { ...cur, adds: nextAdds } };
                              });
                            }}
                            placeholder="Prop Value"
                          />
                        </>
                      ) : add.type === 'param' ? (
                        <>
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: '12px', width: '80px', background: 'var(--color-surface)' }}
                            value={add.paramId || ''}
                            onChange={(e) => {
                              setProfileAlters(prev => {
                                const cur = prev[ctrlLower];
                                const nextAdds = [...cur.adds];
                                nextAdds[aIdx] = { ...nextAdds[aIdx], paramId: e.target.value };
                                return { ...prev, [ctrlLower]: { ...cur, adds: nextAdds } };
                              });
                            }}
                            placeholder="Param ID"
                          />
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: '12px', width: '90px', background: 'var(--color-surface)' }}
                            value={add.paramLabel || ''}
                            onChange={(e) => {
                              setProfileAlters(prev => {
                                const cur = prev[ctrlLower];
                                const nextAdds = [...cur.adds];
                                nextAdds[aIdx] = { ...nextAdds[aIdx], paramLabel: e.target.value };
                                return { ...prev, [ctrlLower]: { ...cur, adds: nextAdds } };
                              });
                            }}
                            placeholder="Label"
                          />
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: '12px', flex: 1, background: 'var(--color-surface)', minWidth: '100px' }}
                            value={add.paramValue || ''}
                            onChange={(e) => {
                              setProfileAlters(prev => {
                                const cur = prev[ctrlLower];
                                const nextAdds = [...cur.adds];
                                nextAdds[aIdx] = { ...nextAdds[aIdx], paramValue: e.target.value };
                                return { ...prev, [ctrlLower]: { ...cur, adds: nextAdds } };
                              });
                            }}
                            placeholder="Value"
                          />
                        </>
                      ) : add.type === 'link' ? (
                        <>
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: '12px', flex: 1, background: 'var(--color-surface)', minWidth: '120px' }}
                            value={add.linkHref || ''}
                            onChange={(e) => {
                              setProfileAlters(prev => {
                                const cur = prev[ctrlLower];
                                const nextAdds = [...cur.adds];
                                nextAdds[aIdx] = { ...nextAdds[aIdx], linkHref: e.target.value };
                                return { ...prev, [ctrlLower]: { ...cur, adds: nextAdds } };
                              });
                            }}
                            placeholder="Link URL"
                          />
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: '12px', flex: 1, background: 'var(--color-surface)', minWidth: '100px' }}
                            value={add.linkText || ''}
                            onChange={(e) => {
                              setProfileAlters(prev => {
                                const cur = prev[ctrlLower];
                                const nextAdds = [...cur.adds];
                                nextAdds[aIdx] = { ...nextAdds[aIdx], linkText: e.target.value };
                                return { ...prev, [ctrlLower]: { ...cur, adds: nextAdds } };
                              });
                            }}
                            placeholder="Link Text"
                          />
                        </>
                      ) : add.type === 'responsible-party' ? (
                        <>
                          <select
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: '12px', width: '120px', background: 'var(--color-surface)' }}
                            value={add.roleId || ''}
                            onChange={(e) => {
                              setProfileAlters(prev => {
                                const cur = prev[ctrlLower];
                                const nextAdds = [...cur.adds];
                                nextAdds[aIdx] = { ...nextAdds[aIdx], roleId: e.target.value };
                                return { ...prev, [ctrlLower]: { ...cur, adds: nextAdds } };
                              });
                            }}
                          >
                            <option value="">-- Role --</option>
                            {profileRoles.map(role => (
                              <option key={role.id} value={role.id}>{role.id}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: '12px', flex: 1, background: 'var(--color-surface)', minWidth: '120px' }}
                            value={add.partyUuids || ''}
                            onChange={(e) => {
                              setProfileAlters(prev => {
                                const cur = prev[ctrlLower];
                                const nextAdds = [...cur.adds];
                                nextAdds[aIdx] = { ...nextAdds[aIdx], partyUuids: e.target.value };
                                return { ...prev, [ctrlLower]: { ...cur, adds: nextAdds } };
                              });
                            }}
                            placeholder="Party UUIDs / Names"
                          />
                        </>
                      ) : (
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '4px 8px', fontSize: '12px', flex: 1, background: 'var(--color-surface)' }}
                          value={add.prose || ''}
                          onChange={(e) => {
                            setProfileAlters(prev => {
                              const cur = prev[ctrlLower];
                              const nextAdds = [...cur.adds];
                              nextAdds[aIdx] = { ...nextAdds[aIdx], prose: e.target.value };
                              return { ...prev, [ctrlLower]: { ...cur, adds: nextAdds } };
                            });
                          }}
                          placeholder="Prose..."
                        />
                      )}
                      
                      <button type="button" className="btn-delete" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => {
                        setProfileAlters(prev => {
                          const cur = prev[ctrlLower];
                          const nextAdds = cur.adds.filter((_, i) => i !== aIdx);
                          return { ...prev, [ctrlLower]: { ...cur, adds: nextAdds } };
                        });
                      }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Control Alterations (Removes)</span>
                <button type="button" className="btn-secondary btn-xs" onClick={() => {
                  setProfileAlters(prev => {
                    const cur = prev[ctrlLower] || { adds: [], removes: [] };
                    return {
                      ...prev,
                      [ctrlLower]: {
                        ...cur,
                        removes: [...(cur.removes || []), { byId: '', byName: '', byClass: '', byItemName: '', nsRef: '' }]
                      }
                    };
                  });
                }}>+ Add Remove</button>
              </div>

              {(!altVal.removes || altVal.removes.length === 0) ? (
                <div className="empty-state-text" style={{ fontSize: '11px' }}>No removals defined.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {altVal.removes.map((rem, rIdx) => {
                    const selectorType = rem.byId ? 'byId' : rem.byName ? 'byName' : rem.byClass ? 'byClass' : rem.byItemName ? 'byItemName' : rem.nsRef ? 'nsRef' : 'byId';
                    const selectorValue = rem.byId || rem.byName || rem.byClass || rem.byItemName || rem.nsRef || '';
                    
                    return (
                      <div key={rIdx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <select
                          className="form-input"
                          style={{ width: '140px', padding: '4px 8px', fontSize: '12px', background: 'var(--color-surface)' }}
                          value={selectorType}
                          onChange={(e) => {
                            setProfileAlters(prev => {
                              const cur = prev[ctrlLower];
                              const nextRemoves = [...cur.removes];
                              nextRemoves[rIdx] = {
                                byId: '',
                                byName: '',
                                byClass: '',
                                byItemName: '',
                                nsRef: '',
                                [e.target.value]: selectorValue
                              };
                              return { ...prev, [ctrlLower]: { ...cur, removes: nextRemoves } };
                            });
                          }}
                        >
                          <option value="byId">by-id (ID)</option>
                          <option value="byName">by-name (Name)</option>
                          <option value="byClass">by-class (Class)</option>
                          <option value="byItemName">by-item-name</option>
                          <option value="nsRef">by-ns (Namespace)</option>
                        </select>
                        
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '4px 8px', fontSize: '12px', flex: 1, background: 'var(--color-surface)' }}
                          value={selectorValue}
                          onChange={(e) => {
                            setProfileAlters(prev => {
                              const cur = prev[ctrlLower];
                              const nextRemoves = [...cur.removes];
                              nextRemoves[rIdx] = {
                                byId: '',
                                byName: '',
                                byClass: '',
                                byItemName: '',
                                nsRef: '',
                                [selectorType]: e.target.value
                              };
                              return { ...prev, [ctrlLower]: { ...cur, removes: nextRemoves } };
                            });
                          }}
                          placeholder="Selector value..."
                        />
                        
                        <button type="button" className="btn-delete" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => {
                          setProfileAlters(prev => {
                            const cur = prev[ctrlLower];
                            const nextRemoves = cur.removes.filter((_, i) => i !== rIdx);
                            return { ...prev, [ctrlLower]: { ...cur, removes: nextRemoves } };
                          });
                        }}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const isControlActive = (ctrl, catUuid) => {
    if (!catUuid) return !!selectedControlIds[ctrl.id.toLowerCase()];
    const catUuidLower = catUuid.toLowerCase();
    const config = profileImportsConfig[catUuidLower] || {};
    
    const matchesPattern = (id, pattern) => {
      const cleanPattern = (pattern || '').toLowerCase().replace(/\*/g, '.*').replace(/\?/g, '.');
      const regex = new RegExp(`^${cleanPattern}$`);
      return regex.test(id.toLowerCase());
    };

    const isExcluded = (config.excludeIds || []).some(id => id.toLowerCase() === ctrl.id.toLowerCase()) ||
                       (config.excludeMatching || []).some(m => matchesPattern(ctrl.id, m.pattern));

    if (isExcluded) return false;

    const isImplicitlyIncluded = config.includeAll ||
      (config.includeMatching || []).some(m => matchesPattern(ctrl.id, m.pattern));

    return isImplicitlyIncluded || !!selectedControlIds[ctrl.id.toLowerCase()];
  };

  const renderControlTailorItemSimple = (ctrl, catUuid) => {
    const catUuidLower = (catUuid || '').toLowerCase();
    const config = profileImportsConfig[catUuidLower] || {
      includeAll: false,
      includeMatching: [],
      excludeMatching: [],
      excludeIds: []
    };

    const matchesPattern = (id, pattern) => {
      const cleanPattern = (pattern || '').toLowerCase().replace(/\*/g, '.*').replace(/\?/g, '.');
      const regex = new RegExp(`^${cleanPattern}$`);
      return regex.test(id.toLowerCase());
    };

    const isExcluded = (config.excludeIds || []).some(id => id.toLowerCase() === ctrl.id.toLowerCase()) ||
                       (config.excludeMatching || []).some(m => matchesPattern(ctrl.id, m.pattern));

    const isImplicitlyIncluded = !isExcluded && (
      config.includeAll ||
      (config.includeMatching || []).some(m => matchesPattern(ctrl.id, m.pattern))
    );

    const isChecked = !isExcluded && (isImplicitlyIncluded || !!selectedControlIds[ctrl.id.toLowerCase()]);
    const isDisabled = isExcluded || isImplicitlyIncluded;

    let tooltip = '';
    if (isExcluded) {
      tooltip = 'Excluded via exclusion rules';
    } else if (isImplicitlyIncluded) {
      tooltip = 'Included via import strategy (Include All or pattern)';
    }

    return (
      <div key={ctrl.id} className="profile-control-item-container" style={{ display: 'flex', alignItems: 'center', padding: '4px', marginBottom: '4px', opacity: isDisabled ? 0.7 : 1 }} title={tooltip}>
        <label className="checkbox-label control-tailor-item" style={{ margin: 0, cursor: isDisabled ? 'not-allowed' : 'pointer' }}>
          <input
            type="checkbox"
            checked={isChecked}
            disabled={isDisabled}
            onChange={() => {
              setSelectedControlIds(prev => ({
                ...prev,
                [ctrl.id.toLowerCase()]: !isChecked
              }));
            }}
          />
          <span className="checkbox-custom" style={{ backgroundColor: isDisabled ? 'var(--color-border)' : undefined }}></span>
          <span className="tailor-control-text" style={{ textDecoration: isExcluded ? 'line-through' : 'none' }}>
            <strong>{ctrl.id.toUpperCase()}</strong>: {ctrl.title}
            {isExcluded && <span style={{ fontSize: '10px', color: 'var(--color-error)', marginLeft: '8px' }}>(Ausgeschlossen)</span>}
            {isImplicitlyIncluded && <span style={{ fontSize: '10px', color: 'var(--color-accent)', marginLeft: '8px' }}>(Importiert)</span>}
          </span>
        </label>
      </div>
    );
  };

  const renderControlTailorItemDetailsOnly = (ctrl) => {
    const ctrlLower = ctrl.id.toLowerCase();
    const altVal = profileAlters[ctrlLower] || { adds: [], removes: [] };

    // Render Parts tree as editable textareas
    const renderParts = (parts, depth = 0) => {
      if (!parts || parts.length === 0) return null;
      return parts.map((part, pIdx) => {
        if (!part.id) return null;
        
        const matchingAddIdx = (altVal.adds || []).findIndex(add => (
          add.type === 'part'
          && (add.partId === `${part.id}_modified` || add.partId === part.id)
          && add.byId === part.id
        ));
        const hasBeenModified = matchingAddIdx >= 0;
        const currentProse = hasBeenModified ? altVal.adds[matchingAddIdx].prose : (part.prose || '');

        const handleTextChange = (newVal) => {
          setProfileAlters(prev => {
            const cur = prev[ctrlLower] || { adds: [], removes: [] };
            const nextAdds = [...(cur.adds || [])];
            const nextRemoves = [...(cur.removes || [])];
            
            if (newVal === (part.prose || '')) {
              // Reverted to original prose - remove alter if it exists
              if (matchingAddIdx >= 0) {
                nextAdds.splice(matchingAddIdx, 1);
              }
              const matchingRemoveIdx = nextRemoves.findIndex(rem => rem.byId === part.id);
              if (matchingRemoveIdx >= 0) {
                nextRemoves.splice(matchingRemoveIdx, 1);
              }
            } else {
              // Modified prose - update or create add alter
              if (matchingAddIdx >= 0) {
                nextAdds[matchingAddIdx] = {
                  ...nextAdds[matchingAddIdx],
                  prose: newVal
                };
              } else {
                nextAdds.push({
                  type: 'part',
                  position: 'before',
                  byId: part.id,
                  prose: newVal,
                  partId: `${part.id}_modified`
                });
              }
              // Add a remove entry if it does not already exist
              if (!nextRemoves.some(rem => rem.byId === part.id)) {
                nextRemoves.push({
                  byId: part.id
                });
              }
            }
            return {
              ...prev,
              [ctrlLower]: {
                adds: nextAdds,
                removes: nextRemoves
              }
            };
          });
        };

        const handleRevert = () => {
          handleTextChange(part.prose || '');
        };

        const displayLabel = part.props?.find(pr => pr.name === 'label')?.value || '';

        return (
          <div key={part.id || pIdx} style={{ marginLeft: `${depth * 12}px`, marginBottom: '8px' }}>
            {part.prose !== undefined && (
              <div className="editable-part-wrapper" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', position: 'relative', width: '100%', marginBottom: '4px' }}>
                {displayLabel && (
                  <span style={{ fontSize: '12px', fontWeight: 'bold', minWidth: '24px', color: 'var(--color-text-muted)', paddingTop: '6px' }}>
                    {displayLabel}
                  </span>
                )}
                <div style={{ flex: 1, position: 'relative', marginBottom: hasBeenModified ? '18px' : '0px' }}>
                  <textarea
                    className="form-input text-xs"
                    style={{
                      padding: '6px 8px',
                      width: '100%',
                      minHeight: '40px',
                      background: hasBeenModified ? 'var(--color-surface-4)' : 'transparent',
                      border: hasBeenModified ? '1px dashed var(--color-accent)' : '1px dashed transparent',
                      borderRadius: '4px',
                      fontFamily: 'inherit',
                      fontSize: '12px',
                      color: 'var(--color-text)',
                      resize: 'vertical',
                      lineHeight: 1.5,
                      borderLeft: hasBeenModified ? '3px solid var(--color-accent)' : '1px dashed transparent',
                      outline: 'none',
                      transition: 'all 0.2s'
                    }}
                    value={currentProse}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder="Text eingeben..."
                    onFocus={(e) => {
                      if (!hasBeenModified) {
                        e.target.style.border = '1px dashed var(--color-border)';
                        e.target.style.background = 'var(--color-surface)';
                      }
                    }}
                    onBlur={(e) => {
                      if (!hasBeenModified) {
                        e.target.style.border = '1px dashed transparent';
                        e.target.style.background = 'transparent';
                      }
                    }}
                  />
                  {hasBeenModified && (
                    <button
                      type="button"
                      className="btn-secondary btn-xs"
                      style={{
                        position: 'absolute',
                        right: '4px',
                        bottom: '-18px',
                        zIndex: 10,
                        padding: '1px 4px',
                        fontSize: '9px',
                        color: 'var(--color-error)',
                        background: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '3px'
                      }}
                      onClick={handleRevert}
                      title="Discard change and revert to original"
                    >
                      Revert
                    </button>
                  )}
                </div>
              </div>
            )}
            {part.parts && renderParts(part.parts, depth + 1)}
          </div>
        );
      });
    };

    const statementPart = ctrl.parts?.find(p => p.name === 'statement');
    const otherParts = ctrl.parts?.filter(p => p.name !== 'statement') || [];

    const updateAdd = (aIdx, field, value) => {
      setProfileAlters(prev => {
        const cur = prev[ctrlLower] || { adds: [], removes: [] };
        const nextAdds = [...(cur.adds || [])];
        nextAdds[aIdx] = { ...nextAdds[aIdx], [field]: value };
        return { ...prev, [ctrlLower]: { ...cur, adds: nextAdds } };
      });
    };

    const updateRemove = (rIdx, field, value) => {
      setProfileAlters(prev => {
        const cur = prev[ctrlLower] || { adds: [], removes: [] };
        const nextRemoves = [...(cur.removes || [])];
        nextRemoves[rIdx] = { ...nextRemoves[rIdx], [field]: value };
        return { ...prev, [ctrlLower]: { ...cur, removes: nextRemoves } };
      });
    };

    // Collect all part IDs for the remove dropdown
    const collectPartIds = (parts) => {
      if (!parts) return [];
      return parts.flatMap(p => [p.id, ...collectPartIds(p.parts)].filter(Boolean));
    };
    const allPartIds = collectPartIds(ctrl.parts);

    return (
      <div key={ctrl.id} className="profile-control-item-container" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: '6px', marginBottom: '12px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'var(--color-surface-3)', padding: '10px 14px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>🛠️ <strong>{ctrl.id.toUpperCase()}</strong>: {ctrl.title}</span>
        </div>

        <div style={{ padding: '12px 14px' }}>
          {/* Full control text */}
          {(statementPart || otherParts.length > 0) && (
            <details style={{ marginBottom: '12px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text-muted)', marginBottom: '6px' }}>📄 Full Control Text</summary>
              <div style={{ marginTop: '8px', paddingLeft: '12px', borderLeft: '2px solid var(--color-accent-dim)' }}>
                {statementPart && renderParts([statementPart])}
                {otherParts.length > 0 && renderParts(otherParts)}
              </div>
            </details>
          )}

          {/* Parameter Overrides */}
          {ctrl.params && ctrl.params.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px', color: 'var(--color-text)' }}>⚙️ Parameterwerte anpassen</span>
              {ctrl.params.map(param => {
                const rawVal = profileSetParams[param.id];
                const hasCustomConfig = rawVal && typeof rawVal === 'object';
                const paramVal = hasCustomConfig ? (rawVal.values || '') : (rawVal || (param.values ? param.values.join(', ') : ''));
                const paramLabel = hasCustomConfig ? (rawVal.label || '') : (param.label || '');
                const paramClass = hasCustomConfig ? (rawVal.class || '') : (param.class || '');
                const paramUsage = hasCustomConfig ? (rawVal.usage || '') : (param.usage || '');
                const selectChoice = hasCustomConfig ? (rawVal.select?.choice || '') : '';
                const selectHowMany = hasCustomConfig ? (rawVal.select?.howMany || 'one') : 'one';
                const hasSelect = hasCustomConfig && !!rawVal.select?.choice;
                const constraintDesc = (hasCustomConfig && rawVal.constraints?.[0]) ? rawVal.constraints[0].description : '';
                const constraintExpr = (hasCustomConfig && rawVal.constraints?.[0]) ? rawVal.constraints[0].testExpression : '';
                const constraintRemarks = (hasCustomConfig && rawVal.constraints?.[0]) ? rawVal.constraints[0].testRemarks : '';
                const hasConstraint = hasCustomConfig && !!(constraintDesc || constraintExpr);
                const guidelinesText = hasCustomConfig ? (rawVal.guidelines || '') : '';
                const isOptionsOpen = activeParamOptionsId === param.id;

                const updateParamField = (field, value) => {
                  setProfileSetParams(prev => {
                    const cur = typeof prev[param.id] === 'object' ? prev[param.id] : {
                      values: typeof prev[param.id] === 'string' ? prev[param.id] : (param.values ? param.values.join(', ') : ''),
                      label: param.label || '', class: param.class || '', usage: param.usage || '',
                      select: { howMany: 'one', choice: '' }, constraints: [], guidelines: ''
                    };
                    return { ...prev, [param.id]: { ...cur, [field]: value } };
                  });
                };

                return (
                  <div key={param.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', padding: '6px', background: 'var(--color-surface-4)', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', minWidth: '120px' }}><code>{param.id}</code>:</span>
                      <input
                        type="text"
                        className="form-input"
                        style={{ padding: '4px 8px', fontSize: '12px', flex: 1, background: 'var(--color-surface)' }}
                        value={paramVal}
                        onChange={(e) => {
                          if (hasCustomConfig) { updateParamField('values', e.target.value); }
                          else { setProfileSetParams(prev => ({ ...prev, [param.id]: e.target.value })); }
                        }}
                        placeholder="Override parameter value..."
                      />
                      <button type="button" className="btn-secondary btn-xs" style={{ padding: '3px 6px', fontSize: '10px' }}
                        onClick={() => setActiveParamOptionsId(isOptionsOpen ? null : param.id)}>
                        {isOptionsOpen ? '▲ Close' : '⚙ Advanced'}
                      </button>
                    </div>
                    {isOptionsOpen && (
                      <div style={{ marginTop: '6px', padding: '8px', borderLeft: '2px solid var(--color-accent-dim)', background: 'var(--color-surface-2)', display: 'flex', flexDirection: 'column', gap: '8px', borderRadius: '2px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <div style={{ flex: 1 }}><label style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Label</label>
                            <input type="text" className="form-input text-xs" style={{ padding: '2px 6px', width: '100%', background: 'var(--color-surface)' }} value={paramLabel} onChange={(e) => updateParamField('label', e.target.value)} placeholder="Label..." /></div>
                          <div style={{ flex: 1 }}><label style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Class</label>
                            <input type="text" className="form-input text-xs" style={{ padding: '2px 6px', width: '100%', background: 'var(--color-surface)' }} value={paramClass} onChange={(e) => updateParamField('class', e.target.value)} placeholder="Class..." /></div>
                          <div style={{ flex: 1 }}><label style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Usage Note</label>
                            <input type="text" className="form-input text-xs" style={{ padding: '2px 6px', width: '100%', background: 'var(--color-surface)' }} value={paramUsage} onChange={(e) => updateParamField('usage', e.target.value)} placeholder="Note..." /></div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--color-surface-3)', padding: '6px', borderRadius: '4px' }}>
                          <label className="checkbox-label" style={{ fontSize: '10px', fontWeight: 'bold' }}>
                            <input type="checkbox" checked={hasSelect} onChange={(e) => { if (e.target.checked) { updateParamField('select', { howMany: 'one', choice: 'Option A, Option B' }); } else { updateParamField('select', { howMany: 'one', choice: '' }); } }} />
                            <span className="checkbox-custom"></span><span>Dropdown-Auswahlregeln definieren (Choices)</span>
                          </label>
                          {hasSelect && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                              <div style={{ flex: 2 }}><label style={{ fontSize: '9px', display: 'block' }}>Options (comma-separated)</label>
                                <input type="text" className="form-input text-xs" style={{ padding: '2px 6px', width: '100%', background: 'var(--color-surface)' }} value={selectChoice} onChange={(e) => updateParamField('select', { howMany: selectHowMany, choice: e.target.value })} /></div>
                              <div style={{ flex: 1 }}><label style={{ fontSize: '9px', display: 'block' }}>How many</label>
                                <select className="form-input text-xs" style={{ padding: '2px 6px', width: '100%', background: 'var(--color-surface)' }} value={selectHowMany} onChange={(e) => updateParamField('select', { howMany: e.target.value, choice: selectChoice })}>
                                  <option value="one">Exactly one (one)</option><option value="one-or-more">One or more (one-or-more)</option>
                                </select></div>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--color-surface-3)', padding: '6px', borderRadius: '4px' }}>
                          <label className="checkbox-label" style={{ fontSize: '10px', fontWeight: 'bold' }}>
                            <input type="checkbox" checked={hasConstraint} onChange={(e) => { if (e.target.checked) { updateParamField('constraints', [{ description: 'Input must be validated', testExpression: 'expression', testRemarks: '' }]); } else { updateParamField('constraints', []); } }} />
                            <span className="checkbox-custom"></span><span>Add Validations & Constraints (Tests)</span>
                          </label>
                          {hasConstraint && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                              <div><label style={{ fontSize: '9px', display: 'block' }}>Description</label>
                                <input type="text" className="form-input text-xs" style={{ padding: '2px 6px', width: '100%', background: 'var(--color-surface)' }} value={constraintDesc} onChange={(e) => updateParamField('constraints', [{ description: e.target.value, testExpression: constraintExpr, testRemarks: constraintRemarks }])} /></div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={{ flex: 1 }}><label style={{ fontSize: '9px', display: 'block' }}>Test Expression</label>
                                  <input type="text" className="form-input text-xs" style={{ padding: '2px 6px', width: '100%', background: 'var(--color-surface)' }} value={constraintExpr} onChange={(e) => updateParamField('constraints', [{ description: constraintDesc, testExpression: e.target.value, testRemarks: constraintRemarks }])} placeholder="e.g. . >= 1" /></div>
                                <div style={{ flex: 1 }}><label style={{ fontSize: '9px', display: 'block' }}>Remarks</label>
                                  <input type="text" className="form-input text-xs" style={{ padding: '2px 6px', width: '100%', background: 'var(--color-surface)' }} value={constraintRemarks} onChange={(e) => updateParamField('constraints', [{ description: constraintDesc, testExpression: constraintExpr, testRemarks: e.target.value }])} /></div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div><label style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Guidelines (Filling Help)</label>
                          <textarea className="form-input text-xs" style={{ padding: '4px 6px', width: '100%', minHeight: '40px', background: 'var(--color-surface)', fontFamily: 'inherit' }} value={guidelinesText} onChange={(e) => updateParamField('guidelines', e.target.value)} placeholder="Application notes and guidelines..." /></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Adds — Add additions */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text)' }}>➕ Additions to Control Prose</span>
              <button type="button" className="btn-secondary btn-xs" onClick={() => {
                setProfileAlters(prev => {
                  const cur = prev[ctrlLower] || { adds: [], removes: [] };
                  return { ...prev, [ctrlLower]: { ...cur, adds: [...(cur.adds || []), { type: 'part', position: 'ending', byId: '', prose: '', partId: `${ctrlLower}_add_${generateUUID().slice(0, 4)}` }] } };
                });
              }}>+ Add Addition</button>
            </div>
            {(!altVal.adds || altVal.adds.length === 0) ? (
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No additions defined.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {altVal.adds.map((add, aIdx) => (
                  <div key={aIdx} style={{ background: 'var(--color-surface-3)', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '140px' }}>
                        <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>Position</label>
                        <select className="form-input" style={{ width: '100%', padding: '4px 8px', fontSize: '12px', background: 'var(--color-surface)' }}
                          value={add.position}
                          onChange={(e) => updateAdd(aIdx, 'position', e.target.value)}>
                          <option value="starting">Insert at start</option>
                          <option value="ending">Insert at end</option>
                          <option value="before">Before a specific section</option>
                          <option value="after">After a specific section</option>
                        </select>
                      </div>
                      {(add.position === 'before' || add.position === 'after') && (
                        <div style={{ flex: 1, minWidth: '100px' }}>
                          <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>Abschnitts-ID</label>
                          <input type="text" className="form-input" style={{ width: '100%', padding: '4px 8px', fontSize: '12px', background: 'var(--color-surface)' }}
                            value={add.byId || ''} onChange={(e) => updateAdd(aIdx, 'byId', e.target.value)} placeholder="e.g. ac-2_smt" />
                        </div>
                      )}
                      <button type="button" className="btn-secondary btn-xs" style={{ alignSelf: 'flex-end', padding: '4px 8px', color: 'var(--color-error)' }}
                        onClick={() => { setProfileAlters(prev => { const cur = prev[ctrlLower]; return { ...prev, [ctrlLower]: { ...cur, adds: cur.adds.filter((_, i) => i !== aIdx) } }; }); }}>🗑</button>
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>Addition Text (Free Text)</label>
                      <textarea className="form-input" style={{ width: '100%', padding: '4px 8px', fontSize: '12px', minHeight: '60px', background: 'var(--color-surface)', fontFamily: 'inherit', resize: 'vertical' }}
                        value={add.prose || ''} onChange={(e) => updateAdd(aIdx, 'prose', e.target.value)}
                        placeholder="Enter custom addition text..." />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Removes — Remove parts */}
          {allPartIds.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-text)' }}>🗑️ Remove Parts</span>
                <button type="button" className="btn-secondary btn-xs" onClick={() => {
                  setProfileAlters(prev => {
                    const cur = prev[ctrlLower] || { adds: [], removes: [] };
                    return { ...prev, [ctrlLower]: { ...cur, removes: [...(cur.removes || []), { byId: '' }] } };
                  });
                }}>+ Remove Part</button>
              </div>
              {(!altVal.removes || altVal.removes.length === 0) ? (
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No removals defined.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {altVal.removes.map((rem, rIdx) => (
                    <div key={rIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--color-surface-3)', borderRadius: '4px', padding: '6px 8px' }}>
                      <span style={{ fontSize: '11px', whiteSpace: 'nowrap', color: 'var(--color-text-muted)' }}>Abschnitt:</span>
                      <select className="form-input" style={{ flex: 1, padding: '4px 8px', fontSize: '12px', background: 'var(--color-surface)' }}
                        value={rem.byId || ''}
                        onChange={(e) => updateRemove(rIdx, 'byId', e.target.value)}>
                        <option value="">-- Select Section --</option>
                        {allPartIds.map(pid => <option key={pid} value={pid}>{pid}</option>)}
                      </select>
                      <button type="button" className="btn-secondary btn-xs" style={{ padding: '4px 8px', color: 'var(--color-error)' }}
                        onClick={() => { setProfileAlters(prev => { const cur = prev[ctrlLower]; return { ...prev, [ctrlLower]: { ...cur, removes: cur.removes.filter((_, i) => i !== rIdx) } }; }); }}>🗑</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}
          </div>
        </div>
    );
  };

  const renderVisualTailoring = () => {
    const updateImportConfig = (catUuid, field, value) => {
      setProfileImportsConfig(prev => {
        const catUuidLower = catUuid.toLowerCase();
        const cur = prev[catUuidLower] || {
          includeAll: false,
          includeMatching: [],
          excludeMatching: [],
          excludeIds: []
        };
        return {
          ...prev,
          [catUuidLower]: { ...cur, [field]: value }
        };
      });
    };

    const activeControlIdsList = [
      ...Object.entries(selectedControlIds).filter(([id, sel]) => sel).map(([id]) => id.toUpperCase()),
      ...profileLocalControls.filter(lc => lc.id).map(lc => lc.id.toUpperCase())
    ];

    const renderCustomGroupEditor = (group, path = []) => {
      const handleUpdateGroupField = (field, value) => {
        setCustomGroups(prev => {
          const next = JSON.parse(JSON.stringify(prev));
          let target = next;
          for (let i = 0; i < path.length - 1; i++) {
            target = target[path[i]].groups;
          }
          target[path[path.length - 1]][field] = value;
          return next;
        });
      };

      const handleAddSubgroup = () => {
        setCustomGroups(prev => {
          const next = JSON.parse(JSON.stringify(prev));
          let target = next;
          for (let i = 0; i < path.length; i++) {
            target = target[path[i]].groups || (target[path[i]].groups = []);
          }
          target.push({ id: '', title: '', controls: [], groups: [] });
          return next;
        });
      };

      const handleDeleteGroup = () => {
        setCustomGroups(prev => {
          const next = JSON.parse(JSON.stringify(prev));
          if (path.length === 1) {
            return next.filter((_, idx) => idx !== path[0]);
          }
          let target = next;
          for (let i = 0; i < path.length - 1; i++) {
            target = target[path[i]].groups;
          }
          target.splice(path[path.length - 1], 1);
          return next;
        });
      };

      const handleToggleControlInGroup = (ctrlId) => {
        const ctrlIdLower = ctrlId.toLowerCase();
        setCustomGroups(prev => {
          // Helper to recursively remove target control from all groups
          const removeAndClone = (groupsList) => {
            return groupsList.map(g => {
              const nextGroup = {
                ...g,
                controls: (g.controls || []).filter(id => id.toLowerCase() !== ctrlIdLower),
                groups: g.groups ? removeAndClone(g.groups) : []
              };
              return nextGroup;
            });
          };

          const cleaned = removeAndClone(prev);

          // Helper to find if the control was in the target group path
          const findInGroup = (groupsList, targetPath) => {
            let current = groupsList;
            for (let i = 0; i < targetPath.length - 1; i++) {
              current = current[targetPath[i]].groups;
            }
            const targetGroup = current[targetPath[targetPath.length - 1]];
            return (targetGroup.controls || []).includes(ctrlIdLower);
          };

          const wasOriginallyInTarget = findInGroup(prev, path);

          if (wasOriginallyInTarget) {
            // It has been removed, so just return the cleaned tree (toggled off)
            return cleaned;
          } else {
            // Helper to recursively add the control to the target path
            const addIdToTargetGroup = (groupsList, targetPath) => {
              return groupsList.map((g, idx) => {
                if (idx === targetPath[0]) {
                  const nextGroup = { ...g };
                  if (targetPath.length === 1) {
                    nextGroup.controls = [...(nextGroup.controls || []), ctrlIdLower];
                  } else {
                    nextGroup.groups = addIdToTargetGroup(nextGroup.groups, targetPath.slice(1));
                  }
                  return nextGroup;
                }
                return g;
              });
            };
            return addIdToTargetGroup(cleaned, path);
          }
        });
      };

      return (
        <div key={group.id || path.join('-')} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '16px', marginLeft: `${(path.length - 1) * 20}px` }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: '150px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Group ID *</label>
              <input
                type="text"
                className="form-input"
                value={group.id || ''}
                onChange={(e) => handleUpdateGroupField('id', e.target.value)}
                placeholder="e.g. access-controls"
                required
              />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Group Title *</label>
              <input
                type="text"
                className="form-input"
                value={group.title || ''}
                onChange={(e) => handleUpdateGroupField('title', e.target.value)}
                placeholder="e.g. Access Control & Identity"
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
              <button className="btn-secondary btn-xs" type="button" onClick={handleAddSubgroup}>+ Subgroup</button>
              <button className="btn-delete" style={{ padding: '4px 8px', fontSize: '11px' }} type="button" onClick={handleDeleteGroup}>✕ Delete Group</button>
            </div>
          </div>

          <div className="group-controls-selector" style={{ background: 'var(--color-surface-3)', padding: '12px', borderRadius: '4px', marginBottom: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Select Controls for this Group</span>
            {activeControlIdsList.length === 0 ? (
              <span className="empty-state-text" style={{ fontSize: '11px' }}>No controls active in the profile. Select controls under "1. Controls & Alters" first.</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {activeControlIdsList.map(ctrlId => {
                  const isCtrlInGroup = (group.controls || []).includes(ctrlId.toLowerCase());
                  return (
                    <label key={ctrlId} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: isCtrlInGroup ? 'var(--color-accent-bg)' : 'var(--color-surface-1)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border)', cursor: 'pointer', fontSize: '11px' }}>
                      <input
                        type="checkbox"
                        checked={isCtrlInGroup}
                        onChange={() => handleToggleControlInGroup(ctrlId)}
                        style={{ margin: 0 }}
                      />
                      <span>{ctrlId}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {group.groups && group.groups.map((sub, idx) => renderCustomGroupEditor(sub, [...path, idx]))}
        </div>
      );
    };

    const getDocTitle = (docUuid) => {
      const doc = loadedCatalogsData[docUuid] || loadedCatalogsData[docUuid.toLowerCase()];
      if (doc) {
        return doc.catalog?.metadata?.title || doc.profile?.metadata?.title || 'Loading...';
      }
      const catInfo = availableCatalogs.find(c => c.uuid === docUuid);
      if (catInfo) return catInfo.title;
      const profInfo = availableProfiles.find(p => p.uuid === docUuid);
      if (profInfo) return profInfo.title;
      return 'Loading...';
    };

    return (
      <div className="visual-tailoring-container">
        {/* Visual Tailoring Subtabs */}
        <div className="sub-tabs-container" style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--color-border)', marginBottom: '16px', paddingBottom: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`sub-tab-btn ${tailoringSubTab === 'controls' ? 'active' : ''}`}
            onClick={() => setTailoringSubTab('controls')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tailoringSubTab === 'controls' ? '2px solid var(--color-accent)' : 'none',
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: tailoringSubTab === 'controls' ? 'bold' : 'normal',
              color: tailoringSubTab === 'controls' ? 'var(--color-accent)' : 'var(--color-text-muted)'
            }}
          >
            1. Control Selection
          </button>
          <button
            type="button"
            className={`sub-tab-btn ${tailoringSubTab === 'alters' ? 'active' : ''}`}
            onClick={() => setTailoringSubTab('alters')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tailoringSubTab === 'alters' ? '2px solid var(--color-accent)' : 'none',
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: tailoringSubTab === 'alters' ? 'bold' : 'normal',
              color: tailoringSubTab === 'alters' ? 'var(--color-accent)' : 'var(--color-text-muted)'
            }}
          >
            2. Modifications
          </button>
          <button
            type="button"
            className={`sub-tab-btn ${tailoringSubTab === 'merge' ? 'active' : ''}`}
            onClick={() => setTailoringSubTab('merge')}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: tailoringSubTab === 'merge' ? '2px solid var(--color-accent)' : 'none',
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: tailoringSubTab === 'merge' ? 'bold' : 'normal',
              color: tailoringSubTab === 'merge' ? 'var(--color-accent)' : 'var(--color-text-muted)'
            }}
          >
            3. Restructuring
          </button>
        </div>

        {tailoringSubTab === 'controls' && (
          <>
            {loadingCatalogs && (
              <div className="loading-indicator-inline">
                <span className="spinner spinner-sm" /> Loading catalog controls…
              </div>
            )}

            {selectedCatalogIds.length === 0 ? (
              <div className="empty-state-text">No catalogs or profiles selected. Select documents above to tailor them.</div>
            ) : !loadingCatalogs && (
              <div className="tailoring-controls-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedCatalogIds.map(catUuid => {
                  const catUuidLower = catUuid.toLowerCase();
                  const config = profileImportsConfig[catUuidLower] || {
                    includeAll: false,
                    includeMatching: [],
                    excludeMatching: [],
                    excludeIds: []
                  };

                  return (
                    <div key={catUuid} style={{ padding: '10px', background: 'var(--color-surface-2)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                      {/* Per-catalog filter strip */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        <label className="checkbox-label" style={{ fontSize: '11px', margin: 0, whiteSpace: 'nowrap' }}>
                          <input
                            type="checkbox"
                            checked={config.includeAll}
                            onChange={(e) => updateImportConfig(catUuid, 'includeAll', e.target.checked)}
                          />
                          <span className="checkbox-custom"></span>
                          <span>📖 {getDocTitle(catUuid)} — Import All</span>
                        </label>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <input
                            type="text"
                            className="form-input text-xs"
                            style={{ padding: '4px 8px', width: '100%', background: 'var(--color-surface)' }}
                            value={[
                              ...(config.excludeIds || []),
                              ...(config.excludeMatching || []).map(m => m.pattern)
                            ].join(', ')}
                            onChange={(e) => {
                              const tokens = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                              const patterns = tokens.filter(t => t.includes('*') || t.includes('?')).map(p => ({ pattern: p }));
                              const ids = tokens.filter(t => !t.includes('*') && !t.includes('?'));
                              setProfileImportsConfig(prev => {
                                const cur = prev[catUuidLower] || { includeAll: false, includeMatching: [], excludeMatching: [], excludeIds: [] };
                                return { ...prev, [catUuidLower]: { ...cur, excludeMatching: patterns, excludeIds: ids } };
                              });
                            }}
                            placeholder="Exclusions: e.g. pe-*, ac-2 ..."
                          />
                        </div>
                      </div>

                      {/* Controls tree for this catalog */}
                      {(() => {
                        const catData = loadedCatalogsData[catUuid] || loadedCatalogsData[catUuidLower];
                        if (!catData) return null;
                        let catalog = catData.catalog;
                        if (!catalog && catData.profile) {
                          const cacheMap = new Map(Object.entries(loadedCatalogsData).map(([k, v]) => [k.toLowerCase(), v]));
                          const resolved = resolveProfileSync(catData, cacheMap);
                          catalog = resolved.catalog;
                        }
                        if (!catalog) return null;

                        const renderTailorGroup = (group, depth = 0) => {
                          const hasSubGroups = group.groups && group.groups.length > 0;
                          const hasControls = group.controls && group.controls.length > 0;
                          if (!hasSubGroups && !hasControls) return null;
                          return (
                            <div key={group.id || group.title} className="tailor-group-box" style={{ marginLeft: `${depth * 12}px` }}>
                              <div className="tailor-group-title">{group.title}</div>
                              {group.controls && (
                                <div className="tailor-controls-grid">
                                  {group.controls.map(ctrl => renderControlTailorItemSimple(ctrl, catUuid))}
                                </div>
                              )}
                              {group.groups?.map(sub => renderTailorGroup(sub, depth + 1))}
                            </div>
                          );
                        };

                        return (
                          <>
                            {catalog.controls && (
                              <div className="tailor-controls-grid">
                                {catalog.controls.map(ctrl => renderControlTailorItemSimple(ctrl, catUuid))}
                              </div>
                            )}
                            {catalog.groups?.map(group => renderTailorGroup(group, 0))}
                          </>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tailoringSubTab === 'alters' && (
          <>
            {loadingCatalogs && (
              <div className="loading-indicator-inline">
                <span className="spinner spinner-sm" /> Loading catalog controls…
              </div>
            )}

            {selectedCatalogIds.length === 0 ? (
              <div className="empty-state-text" style={{ marginBottom: '20px' }}>No catalogs or profiles selected. Select documents above to tailor them.</div>
            ) : !loadingCatalogs && (
              <div className="tailoring-controls-selection">
                <label className="section-subtitle">Modifications (Alters & Parameter-Overrides)</label>
                <div className="tailoring-controls-list">
                  {selectedCatalogIds.map(catUuid => {
                    const catData = loadedCatalogsData[catUuid] || loadedCatalogsData[catUuid.toLowerCase()];
                    if (!catData) return null;
                    let catalog = catData.catalog;
                    if (!catalog && catData.profile) {
                      const cacheMap = new Map(Object.entries(loadedCatalogsData).map(([k, v]) => [k.toLowerCase(), v]));
                      const resolved = resolveProfileSync(catData, cacheMap);
                      catalog = resolved.catalog;
                    }
                    if (!catalog) return null;

                    const filterActiveControlsOnly = (controls) => {
                      if (!controls) return [];
                      return controls.filter(c => isControlActive(c, catUuid));
                    };
                    
                    const renderTailorGroup = (group, depth = 0) => {
                      const activeCtrls = filterActiveControlsOnly(group.controls);
                      const hasSubGroups = group.groups && group.groups.length > 0;
                      const hasControls = activeCtrls.length > 0;
                      
                      if (!hasSubGroups && !hasControls) return null;
                      
                      return (
                        <div key={group.id || group.title} className="tailor-group-box" style={{ marginLeft: `${depth * 12}px` }}>
                          <div className="tailor-group-title">{group.title}</div>
                          
                          {hasControls && (
                            <div className="tailor-controls-grid">
                              {activeCtrls.map(ctrl => renderControlTailorItemDetailsOnly(ctrl))}
                            </div>
                          )}
                          
                          {group.groups?.map(sub => renderTailorGroup(sub, depth + 1))}
                        </div>
                      );
                    };

                    const activeRootCtrls = filterActiveControlsOnly(catalog.controls);
                    const hasAnySelectedInDoc = activeRootCtrls.length > 0 || (catalog.groups && catalog.groups.some(g => {
                      const checkAnyChecked = (group) => {
                        if (group.controls && group.controls.some(c => isControlActive(c, catUuid))) return true;
                        if (group.groups && group.groups.some(checkAnyChecked)) return true;
                        return false;
                      };
                      return checkAnyChecked(g);
                    }));

                    if (!hasAnySelectedInDoc) {
                      return (
                        <div key={catUuid} className="tailor-catalog-section">
                          <div className="tailor-catalog-header">
                            📖 {getDocTitle(catUuid)}
                          </div>
                          <div className="empty-state-text" style={{ fontSize: '12px', padding: '10px' }}>No controls selected from this document. Select controls in the "Control Selection" tab to modify them.</div>
                        </div>
                      );
                    }
                    
                    return (
                      <div key={catUuid} className="tailor-catalog-section">
                        <div className="tailor-catalog-header">
                          📖 {getDocTitle(catUuid)}
                        </div>
                        {activeRootCtrls.length > 0 && (
                          <div className="tailor-controls-grid">
                            {activeRootCtrls.map(ctrl => renderControlTailorItemDetailsOnly(ctrl))}
                          </div>
                        )}
                        {catalog.groups?.map(group => renderTailorGroup(group, 0))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Local Controls */}
            <div className="profile-local-controls-section" style={{ marginTop: '20px', borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label className="section-subtitle">Local Controls (Unternehmensspezifische Zusatzkontrollen)</label>
                <button className="btn-secondary btn-sm" type="button" onClick={() => {
                  setProfileLocalControls(prev => [...prev, { id: '', title: '', params: [], parts: [{ id: '', name: 'statement', prose: '' }] }]);
                }}>
                  + Add Local Control
                </button>
              </div>
              {profileLocalControls.length === 0 ? (
                <div className="empty-state-text">No local controls defined. Click "+ Add Local Control" to define company-specific guidelines.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {profileLocalControls.map((localCtrl, lcIdx) => (
                    <div key={lcIdx} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ width: '120px' }}>
                          <label style={{ fontSize: '11px' }}>Local Control ID *</label>
                          <input
                            type="text"
                            className="form-input"
                            value={localCtrl.id}
                            onChange={(e) => {
                              setProfileLocalControls(prev => prev.map((c, i) => i === lcIdx ? { ...c, id: e.target.value } : c));
                            }}
                            placeholder="e.g. corp-sec-1"
                            required
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '11px' }}>Control Title *</label>
                          <input
                            type="text"
                            className="form-input"
                            value={localCtrl.title}
                            onChange={(e) => {
                              setProfileLocalControls(prev => prev.map((c, i) => i === lcIdx ? { ...c, title: e.target.value } : c));
                            }}
                            placeholder="e.g. Verpflichtende Security-Awareness-Schulung"
                            required
                          />
                        </div>
                        <button className="btn-delete" style={{ padding: '2px 8px', fontSize: '12px', alignSelf: 'flex-end' }} type="button" onClick={() => {
                          setProfileLocalControls(prev => prev.filter((_, i) => i !== lcIdx));
                        }}>
                          Remove Local Control
                        </button>
                      </div>
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '11px' }}>Statement Prose</label>
                        <textarea
                          className="form-textarea"
                          value={localCtrl.parts?.[0]?.prose || ''}
                          onChange={(e) => {
                            setProfileLocalControls(prev => prev.map((c, i) => {
                              if (i !== lcIdx) return c;
                              const parts = [...(c.parts || [{ id: '', name: 'statement', prose: '' }])];
                              parts[0] = { ...parts[0], id: `${c.id}_stm`, prose: e.target.value };
                              return { ...c, parts };
                            }));
                          }}
                          placeholder="e.g. All new employees must complete security awareness training within 30 days..."
                          rows={2}
                        />
                      </div>
                      {/* Local control parameters */}
                      <div className="local-ctrl-params" style={{ background: 'var(--color-surface-3)', padding: '10px', borderRadius: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>Parameters</span>
                          <button className="btn-secondary btn-xs" type="button" onClick={() => {
                            setProfileLocalControls(prev => prev.map((c, i) => {
                              if (i !== lcIdx) return c;
                              const params = [...(c.params || [])];
                              params.push({ id: '', label: '', values: [''] });
                              return { ...c, params };
                            }));
                          }}>+ Add Param</button>
                        </div>
                        {(localCtrl.params || []).length === 0 ? (
                          <span className="empty-state-text" style={{ fontSize: '11px' }}>No parameters defined.</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {localCtrl.params.map((param, lpIdx) => (
                              <div key={lpIdx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                                <div style={{ width: '120px' }}>
                                  <label style={{ fontSize: '9px' }}>Param ID</label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={param.id}
                                    onChange={(e) => {
                                      setProfileLocalControls(prev => prev.map((c, i) => {
                                        if (i !== lcIdx) return c;
                                        const params = [...c.params];
                                        params[lpIdx] = { ...params[lpIdx], id: e.target.value };
                                        return { ...c, params };
                                      }));
                                    }}
                                    placeholder="e.g. corp-sec-1_prm_1"
                                    style={{ padding: '2px 4px', fontSize: '11px' }}
                                  />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <label style={{ fontSize: '9px' }}>Label</label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={param.label}
                                    onChange={(e) => {
                                      setProfileLocalControls(prev => prev.map((c, i) => {
                                        if (i !== lcIdx) return c;
                                        const params = [...c.params];
                                        params[lpIdx] = { ...params[lpIdx], label: e.target.value };
                                        return { ...c, params };
                                      }));
                                    }}
                                    placeholder="e.g. frequency"
                                    style={{ padding: '2px 4px', fontSize: '11px' }}
                                  />
                                </div>
                                <div style={{ width: '150px' }}>
                                  <label style={{ fontSize: '9px' }}>Default Value</label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={param.values ? param.values[0] : ''}
                                    onChange={(e) => {
                                      setProfileLocalControls(prev => prev.map((c, i) => {
                                        if (i !== lcIdx) return c;
                                        const params = [...c.params];
                                        params[lpIdx] = { ...params[lpIdx], values: [e.target.value] };
                                        return { ...c, params };
                                      }));
                                    }}
                                    placeholder="e.g. annually"
                                    style={{ padding: '2px 4px', fontSize: '11px' }}
                                  />
                                </div>
                                <button className="btn-delete" style={{ padding: '2px 6px', fontSize: '10px' }} type="button" onClick={() => {
                                  setProfileLocalControls(prev => prev.map((c, i) => {
                                    if (i !== lcIdx) return c;
                                    const params = c.params.filter((_, k) => k !== lpIdx);
                                    return { ...c, params };
                                  }));
                                }}>✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tailoringSubTab === 'merge' && (
          <div className="merge-regrouping-section">
            <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label style={{ fontWeight: 'bold' }}>Select Profile Merge Directive</label>
                <select
                  className="form-input"
                  value={mergeDirective}
                  onChange={(e) => setMergeDirective(e.target.value)}
                  style={{ width: '100%', background: 'var(--color-surface)' }}
                >
                  <option value="as-is">As-Is (Keep original grouping)</option>
                  <option value="flat">Flat (List all controls flatly)</option>
                  <option value="custom">Custom (Custom groups & sorting)</option>
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label style={{ fontWeight: 'bold' }}>Clashing IDs Strategy (Combine)</label>
                <select
                  className="form-input"
                  value={combineMethod}
                  onChange={(e) => setCombineMethod(e.target.value)}
                  style={{ width: '100%', background: 'var(--color-surface)' }}
                >
                  <option value="keep">Keep (Keep both imported definitions)</option>
                  <option value="use-first">Use-First (Use first definition, ignore duplicates)</option>
                </select>
              </div>
            </div>

            {mergeDirective === 'custom' && (
              <div className="custom-groups-builder" style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <label className="section-subtitle">Custom Groups & Control Assignment</label>
                  <button
                    className="btn-secondary btn-sm"
                    type="button"
                    onClick={() => setCustomGroups(prev => [...prev, { id: '', title: '', controls: [], groups: [] }])}
                  >
                    + Add Top-Level Group
                  </button>
                </div>

                {customGroups.length === 0 ? (
                  <div className="empty-state-text">No custom groups defined yet. Click "+ Add Top-Level Group" to start grouping.</div>
                ) : (
                  <div>
                    {customGroups.map((group, idx) => renderCustomGroupEditor(group, [idx]))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderVisualComponentEditor = () => {
    const handleAddComponent = () => {
      setVisualComponents(prev => [...prev, {
        uuid: generateUUID(),
        title: '',
        type: 'software',
        description: '',
        purpose: '',
        props: []
      }]);
    };

    const handleRemoveComponent = (index) => {
      setVisualComponents(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdateComponent = (index, field, val) => {
      setVisualComponents(prev => {
        const next = [...prev];
        const comp = { ...next[index], [field]: val };
        next[index] = comp;
        return next;
      });
    };

    return (
      <div className="visual-components-container">
        <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <label className="section-subtitle">System & Software Components</label>
          <button className="btn-primary btn-sm" type="button" onClick={handleAddComponent}>
            + Add Component
          </button>
        </div>

        {visualComponents.length === 0 ? (
          <div className="empty-state-text">No components defined yet. Click "Add Component" to get started!</div>
        ) : (
          <div className="component-cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            {visualComponents.map((comp, idx) => (
              <div className="component-editor-card" key={comp.uuid} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
                <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="component-badge" style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent-hover)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>{comp.type}</span>
                  <button className="btn-delete" style={{ padding: '4px 8px', fontSize: '12px' }} type="button" onClick={() => handleRemoveComponent(idx)}>
                    Remove
                  </button>
                </div>
                <div className="form-group">
                  <label>Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={comp.title}
                    onChange={(e) => handleUpdateComponent(idx, 'title', e.target.value)}
                    placeholder="Component Title (e.g. PostgreSQL Database)"
                    required
                  />
                </div>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Type</label>
                    <select
                      className="form-input"
                      value={comp.type}
                      onChange={(e) => handleUpdateComponent(idx, 'type', e.target.value)}
                    >
                      <option value="software">Software</option>
                      <option value="hardware">Hardware</option>
                      <option value="service">Service</option>
                      <option value="physical">Physical Asset</option>
                      <option value="process">Process/Procedure</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Purpose</label>
                    <input
                      type="text"
                      className="form-input"
                      value={comp.purpose}
                      onChange={(e) => handleUpdateComponent(idx, 'purpose', e.target.value)}
                      placeholder="Purpose of this component..."
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    className="form-textarea"
                    value={comp.description}
                    onChange={(e) => handleUpdateComponent(idx, 'description', e.target.value)}
                    placeholder="Brief description of the component..."
                    rows={2}
                  />
                </div>

                <div className="component-properties-section" style={{ marginTop: '12px', background: 'var(--color-surface-1)', padding: '12px', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Properties (props)</span>
                    <button className="btn-secondary btn-xs" type="button" onClick={() => {
                      const props = comp.props ? [...comp.props] : [];
                      props.push({ name: '', value: '', remarks: '' });
                      handleUpdateComponent(idx, 'props', props);
                    }}>
                      + Add Property
                    </button>
                  </div>
                  {(comp.props || []).length === 0 ? (
                    <div className="empty-state-text" style={{ fontSize: '11px' }}>No properties defined.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {comp.props.map((prop, pIdx) => (
                        <div key={pIdx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '10px' }}>Name</label>
                            <input
                              type="text"
                              className="form-input"
                              value={prop.name}
                              onChange={(e) => {
                                const props = [...comp.props];
                                props[pIdx] = { ...props[pIdx], name: e.target.value };
                                handleUpdateComponent(idx, 'props', props);
                              }}
                              placeholder="e.g. eal-level"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '10px' }}>Value</label>
                            <input
                              type="text"
                              className="form-input"
                              value={prop.value}
                              onChange={(e) => {
                                const props = [...comp.props];
                                props[pIdx] = { ...props[pIdx], value: e.target.value };
                                handleUpdateComponent(idx, 'props', props);
                              }}
                              placeholder="e.g. EAL 4+"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '10px' }}>Remarks</label>
                            <input
                              type="text"
                              className="form-input"
                              value={prop.remarks || ''}
                              onChange={(e) => {
                                const props = [...comp.props];
                                props[pIdx] = { ...props[pIdx], remarks: e.target.value };
                                handleUpdateComponent(idx, 'props', props);
                              }}
                              placeholder="Remarks..."
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            />
                          </div>
                          <button className="btn-delete" style={{ padding: '4px 8px', fontSize: '11px', marginBottom: '2px' }} type="button" onClick={() => {
                            const props = comp.props.filter((_, k) => k !== pIdx);
                            handleUpdateComponent(idx, 'props', props);
                          }}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="component-protocols-section" style={{ marginTop: '12px', background: 'var(--color-surface-1)', padding: '12px', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Protocols & Ports</span>
                    <button className="btn-secondary btn-xs" type="button" onClick={() => {
                      const protocols = comp.protocols ? [...comp.protocols] : [];
                      protocols.push({ name: '', port: '', remarks: '' });
                      handleUpdateComponent(idx, 'protocols', protocols);
                    }}>
                      + Add Protocol
                    </button>
                  </div>
                  {(comp.protocols || []).length === 0 ? (
                    <div className="empty-state-text" style={{ fontSize: '11px' }}>No protocols defined.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {comp.protocols.map((proto, pIdx) => (
                        <div key={pIdx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '10px' }}>Name</label>
                            <input
                              type="text"
                              className="form-input"
                              value={proto.name || ''}
                              onChange={(e) => {
                                const protocols = [...comp.protocols];
                                protocols[pIdx] = { ...protocols[pIdx], name: e.target.value };
                                handleUpdateComponent(idx, 'protocols', protocols);
                              }}
                              placeholder="e.g. tcp / https"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '10px' }}>Port</label>
                            <input
                              type="text"
                              className="form-input"
                              value={proto.port || ''}
                              onChange={(e) => {
                                const protocols = [...comp.protocols];
                                protocols[pIdx] = { ...protocols[pIdx], port: e.target.value };
                                handleUpdateComponent(idx, 'protocols', protocols);
                              }}
                              placeholder="e.g. 443"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '10px' }}>Remarks</label>
                            <input
                              type="text"
                              className="form-input"
                              value={proto.remarks || ''}
                              onChange={(e) => {
                                const protocols = [...comp.protocols];
                                protocols[pIdx] = { ...protocols[pIdx], remarks: e.target.value };
                                handleUpdateComponent(idx, 'protocols', protocols);
                              }}
                              placeholder="Security remarks..."
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            />
                          </div>
                          <button className="btn-delete" style={{ padding: '4px 8px', fontSize: '11px', marginBottom: '2px' }} type="button" onClick={() => {
                            const protocols = comp.protocols.filter((_, k) => k !== pIdx);
                            handleUpdateComponent(idx, 'protocols', protocols);
                          }}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="component-dependencies-section" style={{ marginTop: '12px', background: 'var(--color-surface-1)', padding: '12px', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Dependencies (Depends On)</span>
                    <button className="btn-secondary btn-xs" type="button" onClick={() => {
                      const deps = comp.dependencies ? [...comp.dependencies] : [];
                      deps.push({ 'dependency-uuid': '', remarks: '' });
                      handleUpdateComponent(idx, 'dependencies', deps);
                    }}>
                      + Add Dependency
                    </button>
                  </div>
                  {(comp.dependencies || []).length === 0 ? (
                    <div className="empty-state-text" style={{ fontSize: '11px' }}>No dependencies defined.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {comp.dependencies.map((dep, dIdx) => (
                        <div key={dIdx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '10px' }}>Component</label>
                            <select
                              className="form-input"
                              value={dep['dependency-uuid'] || ''}
                              onChange={(e) => {
                                const deps = [...comp.dependencies];
                                deps[dIdx] = { ...deps[dIdx], 'dependency-uuid': e.target.value };
                                handleUpdateComponent(idx, 'dependencies', deps);
                              }}
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            >
                              <option value="">-- Select Component --</option>
                              {visualComponents.filter(c => c.uuid !== comp.uuid).map(c => (
                                <option key={c.uuid} value={c.uuid}>{c.title || c.uuid}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '10px' }}>Remarks</label>
                            <input
                              type="text"
                              className="form-input"
                              value={dep.remarks || ''}
                              onChange={(e) => {
                                const deps = [...comp.dependencies];
                                deps[dIdx] = { ...deps[dIdx], remarks: e.target.value };
                                handleUpdateComponent(idx, 'dependencies', deps);
                              }}
                              placeholder="e.g. database client connection"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            />
                          </div>
                          <button className="btn-delete" style={{ padding: '4px 8px', fontSize: '11px', marginBottom: '2px' }} type="button" onClick={() => {
                            const deps = comp.dependencies.filter((_, k) => k !== dIdx);
                            handleUpdateComponent(idx, 'dependencies', deps);
                          }}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="component-roles-section" style={{ marginTop: '12px', background: 'var(--color-surface-1)', padding: '12px', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Responsible Roles</span>
                    <button className="btn-secondary btn-xs" type="button" onClick={() => {
                      const roles = comp.responsibleRoles ? [...comp.responsibleRoles] : [];
                      roles.push({ 'role-id': '', 'party-uuids': [] });
                      handleUpdateComponent(idx, 'responsibleRoles', roles);
                    }}>
                      + Add Role Link
                    </button>
                  </div>
                  {(comp.responsibleRoles || []).length === 0 ? (
                    <div className="empty-state-text" style={{ fontSize: '11px' }}>No responsible roles linked.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {comp.responsibleRoles.map((rRole, rIdx) => (
                        <div key={rIdx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '10px' }}>Role ID</label>
                            <input
                              type="text"
                              className="form-input"
                              value={rRole['role-id'] || ''}
                              onChange={(e) => {
                                const roles = [...comp.responsibleRoles];
                                roles[rIdx] = { ...roles[rIdx], 'role-id': e.target.value };
                                handleUpdateComponent(idx, 'responsibleRoles', roles);
                              }}
                              placeholder="e.g. system-administrator"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '10px' }}>Party UUIDs (comma-separated)</label>
                            <input
                              type="text"
                              className="form-input"
                              value={rRole['party-uuids'] ? rRole['party-uuids'].join(', ') : ''}
                              onChange={(e) => {
                                const roles = [...comp.responsibleRoles];
                                roles[rIdx] = { ...roles[rIdx], 'party-uuids': e.target.value.split(',').map(s => s.trim()).filter(Boolean) };
                                handleUpdateComponent(idx, 'responsibleRoles', roles);
                              }}
                              placeholder="e.g. uuid-1, uuid-2"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            />
                          </div>
                          <button className="btn-delete" style={{ padding: '4px 8px', fontSize: '11px', marginBottom: '2px' }} type="button" onClick={() => {
                            const roles = comp.responsibleRoles.filter((_, k) => k !== rIdx);
                            handleUpdateComponent(idx, 'responsibleRoles', roles);
                          }}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="component-controls-section" style={{ marginTop: '12px', background: 'var(--color-surface-1)', padding: '12px', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Built-in Control Implementations</span>
                    <button className="btn-secondary btn-xs" type="button" onClick={() => {
                      const controlImpls = comp.controlImplementations ? [...comp.controlImplementations] : [];
                      controlImpls.push({ uuid: generateUUID(), source: '', 'implemented-requirements': [{ uuid: generateUUID(), 'control-id': '', description: '' }] });
                      handleUpdateComponent(idx, 'controlImplementations', controlImpls);
                    }}>
                      + Add Control Implementation
                    </button>
                  </div>
                  {(comp.controlImplementations || []).length === 0 ? (
                    <div className="empty-state-text" style={{ fontSize: '11px' }}>No control implementations defined.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {comp.controlImplementations.map((impl, cIdx) => (
                        <div key={cIdx} style={{ background: 'var(--color-surface-2)', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-accent)' }}>Implementation Set #{cIdx + 1}</span>
                            <button className="btn-delete" style={{ padding: '2px 6px', fontSize: '10px' }} type="button" onClick={() => {
                              const controlImpls = comp.controlImplementations.filter((_, k) => k !== cIdx);
                              handleUpdateComponent(idx, 'controlImplementations', controlImpls);
                            }}>
                              ✕ Remove Set
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '10px', display: 'block' }}>Source Profile/Catalog UUID (optional)</label>
                              <input
                                type="text"
                                className="form-input"
                                value={impl.source || ''}
                                onChange={(e) => {
                                  const controlImpls = [...comp.controlImplementations];
                                  controlImpls[cIdx] = { ...controlImpls[cIdx], source: e.target.value };
                                  handleUpdateComponent(idx, 'controlImplementations', controlImpls);
                                }}
                                placeholder="Source URI or UUID..."
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                              />
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 4px 0' }}>
                            <span style={{ fontSize: '10px', fontWeight: 'bold' }}>Implemented Requirements</span>
                            <button className="btn-secondary btn-xs" type="button" style={{ padding: '1px 4px', fontSize: '10px' }} onClick={() => {
                              const controlImpls = [...comp.controlImplementations];
                              const reqs = [...(controlImpls[cIdx]['implemented-requirements'] || [])];
                              reqs.push({ uuid: generateUUID(), 'control-id': '', description: '' });
                              controlImpls[cIdx] = { ...controlImpls[cIdx], 'implemented-requirements': reqs };
                              handleUpdateComponent(idx, 'controlImplementations', controlImpls);
                            }}>
                              + Add Control ID
                            </button>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {(impl['implemented-requirements'] || []).map((req, rReqIdx) => (
                              <div key={rReqIdx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--color-surface-3)', padding: '6px', borderRadius: '3px' }}>
                                <div style={{ width: '100px' }}>
                                  <label style={{ fontSize: '9px', display: 'block' }}>Control ID</label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    value={req['control-id'] || ''}
                                    onChange={(e) => {
                                      const controlImpls = [...comp.controlImplementations];
                                      const reqs = [...(controlImpls[cIdx]['implemented-requirements'] || [])];
                                      reqs[rReqIdx] = { ...reqs[rReqIdx], 'control-id': e.target.value };
                                      controlImpls[cIdx] = { ...controlImpls[cIdx], 'implemented-requirements': reqs };
                                      handleUpdateComponent(idx, 'controlImplementations', controlImpls);
                                    }}
                                    placeholder="e.g. ac-2"
                                    style={{ padding: '2px 4px', fontSize: '11px' }}
                                  />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <label style={{ fontSize: '9px', display: 'block' }}>Description / Statements</label>
                                  <textarea
                                    className="form-textarea"
                                    value={req.description || ''}
                                    onChange={(e) => {
                                      const controlImpls = [...comp.controlImplementations];
                                      const reqs = [...(controlImpls[cIdx]['implemented-requirements'] || [])];
                                      reqs[rReqIdx] = { ...reqs[rReqIdx], description: e.target.value };
                                      controlImpls[cIdx] = { ...controlImpls[cIdx], 'implemented-requirements': reqs };
                                      handleUpdateComponent(idx, 'controlImplementations', controlImpls);
                                    }}
                                    placeholder="Brief description of implementation..."
                                    rows={1}
                                    style={{ padding: '2px 4px', fontSize: '11px', minHeight: '30px' }}
                                  />
                                </div>
                                <button className="btn-delete" style={{ padding: '2px 6px', fontSize: '9px', marginTop: '12px' }} type="button" onClick={() => {
                                  const controlImpls = [...comp.controlImplementations];
                                  const reqs = controlImpls[cIdx]['implemented-requirements'].filter((_, k) => k !== rReqIdx);
                                  controlImpls[cIdx] = { ...controlImpls[cIdx], 'implemented-requirements': reqs };
                                  handleUpdateComponent(idx, 'controlImplementations', controlImpls);
                                }}>
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderVisualSspBuilder = () => {

    const handleToggleComponentActive = (uuid) => {
      if (activeComponentUuids.includes(uuid)) {
        setActiveComponentUuids(prev => prev.filter(u => u !== uuid));
      } else {
        setActiveComponentUuids(prev => [...prev, uuid]);
      }
    };

    const handleUpdateControlDesc = (ctrlId, val) => {
      setSspImplementedReqs(prev => {
        const next = { ...prev };
        const lowerId = ctrlId.toLowerCase();
        next[lowerId] = {
          ...next[lowerId],
          description: val
        };
        return next;
      });
    };

    const handleUpdateControlInheritance = (ctrlId, val) => {
      setSspImplementedReqs(prev => {
        const next = { ...prev };
        const lowerId = ctrlId.toLowerCase();
        next[lowerId] = {
          ...next[lowerId],
          inheritance: val
        };
        return next;
      });
    };

    const handleUpdateControlCompDesc = (ctrlId, compUuid, val) => {
      setSspImplementedReqs(prev => {
        const next = { ...prev };
        const lowerId = ctrlId.toLowerCase();
        const cur = next[lowerId] || {};
        const byComps = { ...(cur.byComponents || {}) };
        byComps[compUuid] = val;
        next[lowerId] = {
          ...cur,
          byComponents: byComps
        };
        return next;
      });
    };

    const handleUpdateControlParam = (ctrlId, paramId, val) => {
      setSspImplementedReqs(prev => {
        const next = { ...prev };
        const lowerId = ctrlId.toLowerCase();
        const cur = next[lowerId] || {};
        const setParams = { ...(cur.setParameters || {}) };
        setParams[paramId] = val;
        next[lowerId] = {
          ...cur,
          setParameters: setParams
        };
        return next;
      });
    };

    const handleProfileChange = (e) => {
      const profUuid = e.target.value;
      setSelectedProfileId(profUuid);
      if (profUuid) {
        loadProfileControls(profUuid);
      } else {
        setSspResolvedControls([]);
      }
    };

    const activeComponentsList = [
      ...availableComponents
    ];

    const currentActiveComponents = activeComponentsList.filter(c => activeComponentUuids.includes(c.uuid));

    return (
      <div className="visual-ssp-container">
        <div className="ssp-subtabs" style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px', borderRight: '1px solid var(--color-border)', paddingRight: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginRight: '8px' }}>Stage 1: Define Scope</span>
            <button
              type="button"
              className={`mode-toggle-btn ${sspTab === 'info' ? 'active' : ''}`}
              onClick={() => setSspTab('info')}
              style={{ padding: '4px 10px', fontSize: '13px' }}
            >
              System Info
            </button>
            <button
              type="button"
              className={`mode-toggle-btn ${sspTab === 'components' ? 'active' : ''}`}
              onClick={() => setSspTab('components')}
              style={{ padding: '4px 10px', fontSize: '13px' }}
            >
              Active Components
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginRight: '8px' }}>Stage 2: Implementation</span>
            <button
              type="button"
              className={`mode-toggle-btn ${sspTab === 'controls' ? 'active' : ''}`}
              onClick={() => setSspTab('controls')}
              style={{ padding: '4px 10px', fontSize: '13px' }}
            >
              Control Implementation ({sspResolvedControls.length})
            </button>
          </div>
        </div>

        {sspTab === 'info' && (
          <div className="ssp-tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label>Import Profile *</label>
              <select
                className="form-input"
                value={selectedProfileId}
                onChange={handleProfileChange}
                required
              >
                <option value="">-- Select Target Profile --</option>
                {availableProfiles.map(p => (
                  <option key={p.uuid} value={p.uuid}>{p.title}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>System Name *</label>
              <input
                type="text"
                className="form-input"
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                placeholder="My Secure Web Application"
                required
              />
            </div>
            <div className="form-group">
              <label>Security Sensitivity Level</label>
              <select
                className="form-input"
                value={systemSensLevel}
                onChange={(e) => setSystemSensLevel(e.target.value)}
              >
                <option value="low">Low Impact</option>
                <option value="moderate">Moderate Impact</option>
                <option value="high">High Impact</option>
              </select>
            </div>
            <div className="fips-199-panel" style={{ background: 'var(--color-surface-3)', padding: '16px', borderRadius: '6px', border: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>FIPS-199 Security Sensitivity Levels</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '11px' }}>Confidentiality</label>
                  <select className="form-input" value={fipsConf} onChange={e => setFipsConf(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '11px' }}>Integrity</label>
                  <select className="form-input" value={fipsInt} onChange={e => setFipsInt(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '11px' }}>Availability</label>
                  <select className="form-input" value={fipsAvail} onChange={e => setFipsAvail(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div style={{ fontSize: '13px', marginTop: '6px', padding: '8px', background: 'var(--color-surface-1)', borderRadius: '4px', borderLeft: '3px solid var(--color-accent)', fontWeight: 'bold' }}>
                Overall FIPS-199 Sensitivity Level: {
                  (() => {
                    const levels = { low: 1, moderate: 2, high: 3 };
                    const maxVal = Math.max(levels[fipsConf] || 1, levels[fipsInt] || 1, levels[fipsAvail] || 1);
                    if (maxVal === 3) return 'HIGH';
                    if (maxVal === 2) return 'MODERATE';
                    return 'LOW';
                  })()
                }
              </div>
            </div>

            <div className="form-group">
              <label>System Operational Status</label>
              <select className="form-input" value={sspSystemStatus} onChange={e => setSspSystemStatus(e.target.value)}>
                <option value="operational">Operational</option>
                <option value="under-development">Under Development</option>
                <option value="major-modification">Major Modification</option>
                <option value="disposition">Disposition</option>
              </select>
            </div>

            <div className="leveraged-auths-panel" style={{ background: 'var(--color-surface-3)', padding: '16px', borderRadius: '6px', border: '1px solid var(--color-border-subtle)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Leveraged Authorizations (Drittanbieter-Zertifikate)</span>
                <button type="button" className="btn-secondary btn-xs" onClick={() => setSspLeveragedAuths(prev => [...prev, { uuid: generateUUID(), title: '', 'date-authorized': '' }])}>+ Add Authorization</button>
              </div>
              {sspLeveragedAuths.length === 0 ? (
                <div className="empty-state-text" style={{ fontSize: '12px', padding: '6px 0' }}>No leveraged authorizations added yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sspLeveragedAuths.map((auth, aIdx) => (
                    <div key={auth.uuid} style={{ display: 'flex', gap: '10px', background: 'var(--color-surface-1)', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}>
                      <div style={{ flex: 2 }}>
                        <label style={{ fontSize: '9px' }}>Title (e.g. AWS FedRAMP Package)</label>
                        <input
                          type="text"
                          className="form-input"
                          value={auth.title || ''}
                          onChange={e => setSspLeveragedAuths(prev => prev.map((item, i) => i === aIdx ? { ...item, title: e.target.value } : item))}
                          placeholder="e.g. AWS FedRAMP moderate Authorization"
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '9px' }}>Date Authorized</label>
                        <input
                          type="date"
                          className="form-input"
                          value={auth['date-authorized'] || ''}
                          onChange={e => setSspLeveragedAuths(prev => prev.map((item, i) => i === aIdx ? { ...item, 'date-authorized': e.target.value } : item))}
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                        />
                      </div>
                      <button type="button" className="btn-delete" style={{ padding: '4px 8px', alignSelf: 'flex-end' }} onClick={() => setSspLeveragedAuths(prev => prev.filter((_, i) => i !== aIdx))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="auth-boundary-panel" style={{ background: 'var(--color-surface-3)', padding: '16px', borderRadius: '6px', border: '1px solid var(--color-border-subtle)' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>Authorization Boundary & Diagrams</span>
              <div className="form-group">
                <label style={{ fontSize: '11px' }}>Boundary Description</label>
                <textarea
                  className="form-textarea"
                  value={authBoundaryDesc}
                  onChange={e => setAuthBoundaryDesc(e.target.value)}
                  placeholder="Describe the network boundaries, API gateways, external system boundaries..."
                  rows={2}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Architecture Diagrams</span>
                <button type="button" className="btn-secondary btn-xs" onClick={() => setAuthBoundaryDiagrams(prev => [...prev, { uuid: generateUUID(), location: '', description: '' }])}>+ Add Diagram</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {authBoundaryDiagrams.map((diag, dIdx) => (
                  <div key={dIdx} style={{ display: 'flex', gap: '10px', background: 'var(--color-surface-1)', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '9px' }}>Location (URL / Path)</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          className="form-input"
                          value={diag.location || ''}
                          onChange={e => setAuthBoundaryDiagrams(prev => prev.map((item, i) => i === dIdx ? { ...item, location: e.target.value } : item))}
                          placeholder="e.g. /api/uploads/file.png"
                          style={{ fontSize: '12px', padding: '4px 8px', flex: 1 }}
                        />
                        <label className="btn-secondary btn-xs" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', margin: 0, padding: '4px 8px', fontSize: '11px', height: 'auto', whiteSpace: 'nowrap' }}>
                          Upload...
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => {
                                setAuthBoundaryDiagrams(prev => prev.map((item, i) => i === dIdx ? {
                                  ...item,
                                  location: reader.result,
                                  filename: file.name,
                                  mediaType: file.type
                                } : item));
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '9px' }}>Description</label>
                      <input
                        type="text"
                        className="form-input"
                        value={diag.description || ''}
                        onChange={e => setAuthBoundaryDiagrams(prev => prev.map((item, i) => i === dIdx ? { ...item, description: e.target.value } : item))}
                        placeholder="e.g. Logical Network Architecture"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      />
                    </div>
                    <button type="button" className="btn-delete" style={{ padding: '4px 8px', alignSelf: 'flex-end' }} onClick={() => setAuthBoundaryDiagrams(prev => prev.filter((_, i) => i !== dIdx))}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Network Architecture Panel */}
            <div className="net-architecture-panel" style={{ background: 'var(--color-surface-3)', padding: '16px', borderRadius: '6px', border: '1px solid var(--color-border-subtle)', marginTop: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>Network Architecture Diagrams & Description</span>
              <div className="form-group">
                <label style={{ fontSize: '11px' }}>Network Architecture Description</label>
                <textarea
                  className="form-textarea"
                  value={netArchDesc}
                  onChange={e => setNetArchDesc(e.target.value)}
                  placeholder="Describe the logical/physical network architecture, DMZ zones, subnets..."
                  rows={2}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Network Architecture Diagrams</span>
                <button type="button" className="btn-secondary btn-xs" onClick={() => setNetArchDiagrams(prev => [...prev, { uuid: generateUUID(), location: '', description: '' }])}>+ Add Diagram</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {netArchDiagrams.map((diag, dIdx) => (
                  <div key={dIdx} style={{ display: 'flex', gap: '10px', background: 'var(--color-surface-1)', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '9px' }}>Location (URL / Path)</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          className="form-input"
                          value={diag.location || ''}
                          onChange={e => setNetArchDiagrams(prev => prev.map((item, i) => i === dIdx ? { ...item, location: e.target.value } : item))}
                          placeholder="e.g. /api/uploads/file.png"
                          style={{ fontSize: '12px', padding: '4px 8px', flex: 1 }}
                        />
                        <label className="btn-secondary btn-xs" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', margin: 0, padding: '4px 8px', fontSize: '11px', height: 'auto', whiteSpace: 'nowrap' }}>
                          Upload...
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => {
                                setNetArchDiagrams(prev => prev.map((item, i) => i === dIdx ? {
                                  ...item,
                                  location: reader.result,
                                  filename: file.name,
                                  mediaType: file.type
                                } : item));
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '9px' }}>Description</label>
                      <input
                        type="text"
                        className="form-input"
                        value={diag.description || ''}
                        onChange={e => setNetArchDiagrams(prev => prev.map((item, i) => i === dIdx ? { ...item, description: e.target.value } : item))}
                        placeholder="e.g. DMZ Subnet Layout"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      />
                    </div>
                    <button type="button" className="btn-delete" style={{ padding: '4px 8px', alignSelf: 'flex-end' }} onClick={() => setNetArchDiagrams(prev => prev.filter((_, i) => i !== dIdx))}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Flow Panel */}
            <div className="data-flow-panel" style={{ background: 'var(--color-surface-3)', padding: '16px', borderRadius: '6px', border: '1px solid var(--color-border-subtle)', marginTop: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>Data Flow Diagrams & Description</span>
              <div className="form-group">
                <label style={{ fontSize: '11px' }}>Data Flow Description</label>
                <textarea
                  className="form-textarea"
                  value={dataFlowDesc}
                  onChange={e => setDataFlowDesc(e.target.value)}
                  placeholder="Describe data flows, encryption-in-transit boundaries, API payloads..."
                  rows={2}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Data Flow Diagrams</span>
                <button type="button" className="btn-secondary btn-xs" onClick={() => setDataFlowDiagrams(prev => [...prev, { uuid: generateUUID(), location: '', description: '' }])}>+ Add Diagram</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {dataFlowDiagrams.map((diag, dIdx) => (
                  <div key={dIdx} style={{ display: 'flex', gap: '10px', background: 'var(--color-surface-1)', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '9px' }}>Location (URL / Path)</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          className="form-input"
                          value={diag.location || ''}
                          onChange={e => setDataFlowDiagrams(prev => prev.map((item, i) => i === dIdx ? { ...item, location: e.target.value } : item))}
                          placeholder="e.g. /api/uploads/file.png"
                          style={{ fontSize: '12px', padding: '4px 8px', flex: 1 }}
                        />
                        <label className="btn-secondary btn-xs" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', margin: 0, padding: '4px 8px', fontSize: '11px', height: 'auto', whiteSpace: 'nowrap' }}>
                          Upload...
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = () => {
                                setDataFlowDiagrams(prev => prev.map((item, i) => i === dIdx ? {
                                  ...item,
                                  location: reader.result,
                                  filename: file.name,
                                  mediaType: file.type
                                } : item));
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '9px' }}>Description</label>
                      <input
                        type="text"
                        className="form-input"
                        value={diag.description || ''}
                        onChange={e => setDataFlowDiagrams(prev => prev.map((item, i) => i === dIdx ? { ...item, description: e.target.value } : item))}
                        placeholder="e.g. HTTPS payload pipeline"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      />
                    </div>
                    <button type="button" className="btn-delete" style={{ padding: '4px 8px', alignSelf: 'flex-end' }} onClick={() => setDataFlowDiagrams(prev => prev.filter((_, i) => i !== dIdx))}>✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="users-panel" style={{ background: 'var(--color-surface-3)', padding: '16px', borderRadius: '6px', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Users & Groups</span>
                <button type="button" className="btn-secondary btn-xs" onClick={() => setSspUsersList(prev => [...prev, { uuid: generateUUID(), title: '', description: '', 'role-ids': [] }])}>+ Add User Group</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sspUsersList.map((userGroup, uIdx) => (
                  <div key={userGroup.uuid} style={{ background: 'var(--color-surface-1)', padding: '12px', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold' }}>User Group #{uIdx + 1}</span>
                      <button type="button" className="btn-delete" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => setSspUsersList(prev => prev.filter(u => u.uuid !== userGroup.uuid))}>✕ Remove</button>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '9px' }}>Group Title</label>
                        <input
                          type="text"
                          className="form-input"
                          value={userGroup.title || ''}
                          onChange={e => setSspUsersList(prev => prev.map(u => u.uuid === userGroup.uuid ? { ...u, title: e.target.value } : u))}
                          placeholder="e.g. System Administrators"
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '9px' }}>Authorized Role IDs (comma-separated)</label>
                        <input
                          type="text"
                          className="form-input"
                          value={userGroup['role-ids'] ? userGroup['role-ids'].join(', ') : ''}
                          onChange={e => setSspUsersList(prev => prev.map(u => u.uuid === userGroup.uuid ? { ...u, 'role-ids': e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : u))}
                          placeholder="e.g. admin, auditor"
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '9px' }}>Description</label>
                      <textarea
                        className="form-textarea"
                        value={userGroup.description || ''}
                        onChange={e => setSspUsersList(prev => prev.map(u => u.uuid === userGroup.uuid ? { ...u, description: e.target.value } : u))}
                        placeholder="Describe the privileges and roles in this group..."
                        rows={1}
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>System Description</label>
              <textarea
                className="form-textarea"
                value={systemDescription}
                onChange={(e) => setSystemDescription(e.target.value)}
                placeholder="Explain the system architecture, bounds, and purpose..."
                rows={4}
              />
            </div>
          </div>
        )}

        {sspTab === 'components' && (
          <div className="ssp-tab-content">
            <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <label className="section-subtitle">Select Active System Components</label>
            </div>

            {activeComponentsList.length === 0 ? (
              <div className="empty-state-text">No components available. Create Component Definitions first!</div>
            ) : (
              <div className="components-checkbox-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeComponentsList.map(comp => (
                  <div key={comp.uuid} className="component-select-item" style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--color-surface-2)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)' }}>
                    <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={activeComponentUuids.includes(comp.uuid)}
                        onChange={() => handleToggleComponentActive(comp.uuid)}
                      />
                      <span className="checkbox-custom"></span>
                      <span className="component-title-text" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                        <strong style={{ fontSize: '15px' }}>{comp.title}</strong>
                        <span className="component-type-badge" style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-muted)', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', marginLeft: '8px', textTransform: 'uppercase', border: '1px solid var(--color-border)' }}>{comp.type}</span>
                      </span>
                    </label>

                    {activeComponentUuids.includes(comp.uuid) && (
                      <div className="component-details-panel" style={{ marginTop: '8px', paddingLeft: '32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div className="component-desc-view" style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: '1.4', background: 'var(--color-surface-1)', padding: '10px', borderRadius: '4px', borderLeft: '3px solid var(--color-accent)' }}>
                          {comp.description || <em style={{ color: 'var(--color-text-muted)' }}>No description provided in the Component Definition.</em>}
                        </div>

                        <div className="component-link-info" style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-accent-bg)', color: 'var(--color-accent)', width: '16px', height: '16px', borderRadius: '50%' }}>ℹ</span>
                          Linked to SSP Controls via component UUID: {comp.uuid}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {sspTab === 'controls' && (
          <div className="ssp-tab-content">
            {!selectedProfileId ? (
              <div className="empty-state-text">Please select a Profile in "System Info" first!</div>
            ) : loadingCatalogs ? (
              <div className="loading-indicator-inline">
                <span className="spinner spinner-sm" /> Resolving Profile controls…
              </div>
            ) : sspResolvedControls.length === 0 ? (
              <div className="empty-state-text">No controls resolved for this profile. Check the Profile baseline settings.</div>
            ) : (
              <div className="ssp-controls-mapping-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {sspResolvedControls.map(ctrl => {
                  const reqData = sspImplementedReqs[ctrl.id.toLowerCase()] || {};
                  return (
                    <div className="ssp-control-item" key={ctrl.id} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                      <div className="ssp-control-header" style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '10px', marginBottom: '14px' }}>
                        <h4 style={{ color: 'var(--color-accent-hover)', fontSize: '16px' }}>{ctrl.id.toUpperCase()}: {ctrl.title}</h4>
                      </div>
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label>Control Implementation Description</label>
                        <textarea
                          className="form-textarea"
                          value={reqData.description || ''}
                          onChange={(e) => handleUpdateControlDesc(ctrl.id, e.target.value)}
                          placeholder="How is this control implemented overall in your system?"
                          rows={2}
                        />
                      </div>

                      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Inheritance Type</label>
                          <select
                            className="form-input"
                            value={reqData.inheritanceType || 'none'}
                            onChange={(e) => {
                              setSspImplementedReqs(prev => {
                                const next = { ...prev };
                                const lowerId = ctrl.id.toLowerCase();
                                next[lowerId] = {
                                  ...next[lowerId],
                                  inheritanceType: e.target.value
                                };
                                return next;
                              });
                            }}
                          >
                            <option value="none">None (Implemented by System Owner)</option>
                            <option value="inherited">Inherited (Fully Inherited)</option>
                            <option value="shared">Shared (Partially Inherited / Shared)</option>
                          </select>
                        </div>
                        {(reqData.inheritanceType === 'inherited' || reqData.inheritanceType === 'shared') && (
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Leveraged Authorization Reference</label>
                            <select
                              className="form-input"
                              value={reqData.leveragedAuthUuid || ''}
                              onChange={(e) => {
                                setSspImplementedReqs(prev => {
                                  const next = { ...prev };
                                  const lowerId = ctrl.id.toLowerCase();
                                  next[lowerId] = {
                                    ...next[lowerId],
                                    leveragedAuthUuid: e.target.value
                                  };
                                  return next;
                                });
                              }}
                            >
                              <option value="">-- Select Leveraged Auth --</option>
                              {sspLeveragedAuths.map(auth => (
                                <option key={auth.uuid} value={auth.uuid}>{auth.title || 'Untitled Auth'}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {ctrl.params && ctrl.params.length > 0 && (
                        <div className="control-params-override" style={{ marginBottom: '16px', background: 'var(--color-surface-3)', padding: '12px', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Inline Parameter Overrides</span>
                          {ctrl.params.map(param => {
                            const hasSspVal = reqData.setParameters?.[param.id] !== undefined && reqData.setParameters[param.id] !== '';
                            const defaultVal = param.values ? param.values.join(', ') : '';
                            const paramVal = hasSspVal ? reqData.setParameters[param.id] : defaultVal;
                            const isPlaceholder = !hasSspVal && !defaultVal;

                            const patternStr = param.constraints?.[0]?.tests?.[0]?.expression || '';
                            const isValid = !patternStr || !paramVal || new RegExp(patternStr).test(paramVal);

                            const choices = param.select?.choice || [];

                            return (
                              <div key={param.id} className="param-override-row" style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: '600' }}><code>{param.id}</code> ({param.label}):</span>
                                  {isPlaceholder && (
                                    <span style={{ fontSize: '10px', background: 'rgba(230, 162, 60, 0.15)', color: '#e6a23c', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                      ⚠️ Open - Please fill in
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  {choices.length > 0 ? (
                                    <select
                                      className="form-input"
                                      style={{ 
                                        padding: '6px 10px', 
                                        fontSize: '13px', 
                                        flex: 1, 
                                        background: 'var(--color-surface)',
                                        border: !isValid ? '1px solid var(--color-danger)' : '1px solid var(--color-border)',
                                        color: 'var(--color-text)'
                                      }}
                                      value={reqData.setParameters?.[param.id] || ''}
                                      onChange={(e) => handleUpdateControlParam(ctrl.id, param.id, e.target.value)}
                                    >
                                      <option value="">-- Select Value --</option>
                                      {choices.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      className="form-input"
                                      style={{ 
                                        padding: '6px 10px', 
                                        fontSize: '13px', 
                                        flex: 1, 
                                        background: 'var(--color-surface)',
                                        border: !isValid ? '1px solid var(--color-danger)' : '1px solid var(--color-border)'
                                      }}
                                      value={paramVal}
                                      onChange={(e) => handleUpdateControlParam(ctrl.id, param.id, e.target.value)}
                                      placeholder="Set parameter value(s) in SSP..."
                                    />
                                  )}
                                </div>
                                {!isValid && patternStr && (
                                  <span style={{ fontSize: '11px', color: 'var(--color-danger)', marginTop: '2px' }}>
                                    ❌ Value does not match regex pattern: <code>{patternStr}</code>
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {currentActiveComponents.length === 0 ? (
                        <p className="empty-state-text" style={{ fontSize: '12px' }}>No active components selected for mapping. Add components in the "Active Components" tab.</p>
                      ) : (
                        <div className="ssp-component-mappings">
                          <label className="mappings-subtitle" style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '10px', color: 'var(--color-text-muted)' }}>Component-Specific Implementation</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {currentActiveComponents.map(comp => {
                              const compVal = reqData.byComponents?.[comp.uuid] || '';
                              const isMapped = reqData.byComponents?.[comp.uuid] !== undefined;

                              return (
                                <div className="ssp-component-mapping-row" key={comp.uuid} style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                                  <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: isMapped ? '8px' : '0' }}>
                                    <input
                                      type="checkbox"
                                      checked={isMapped}
                                      onChange={() => {
                                        setSspImplementedReqs(prev => {
                                          const next = { ...prev };
                                          const lowerId = ctrl.id.toLowerCase();
                                          const cur = next[lowerId] || {};
                                          const byComps = { ...(cur.byComponents || {}) };
                                          if (isMapped) {
                                            delete byComps[comp.uuid];
                                          } else {
                                            byComps[comp.uuid] = '';
                                          }
                                          next[lowerId] = {
                                            ...cur,
                                            byComponents: byComps
                                          };
                                          return next;
                                        });
                                      }}
                                    />
                                    <span className="checkbox-custom"></span>
                                    <span style={{ fontWeight: '500', fontSize: '13px' }}>{comp.title}</span>
                                  </label>
                                  {isMapped && (
                                    <textarea
                                      className="form-textarea inline-component-textarea"
                                      value={compVal}
                                      onChange={(e) => handleUpdateControlCompDesc(ctrl.id, comp.uuid, e.target.value)}
                                      placeholder={`Details of how ${comp.title} satisfies ${ctrl.id.toUpperCase()}...`}
                                      rows={2}
                                      style={{ marginTop: '8px', fontSize: '13px', background: 'var(--color-surface)' }}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderVisualApEditor = () => {
    const handleAddTask = () => {
      setApTasks(prev => [...prev, {
        uuid: generateUUID(),
        type: 'milestone',
        title: '',
        description: '',
        start: '',
        end: ''
      }]);
    };

    const handleRemoveTask = (index) => {
      setApTasks(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdateTask = (index, field, val) => {
      setApTasks(prev => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: val };
        return next;
      });
    };

    return (
      <div className="visual-ap-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label>Import System Security Plan (SSP)</label>
          <select
            className="form-input"
            value={selectedSspId}
            onChange={(e) => setSelectedSspId(e.target.value)}
          >
            <option value="">-- Select Target SSP --</option>
            {availableSsps.map(s => (
              <option key={s.uuid} value={s.uuid}>{s.title}</option>
            ))}
          </select>
        </div>

        <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <label className="section-subtitle">Assessment Tasks & Milestones</label>
          <button className="btn-primary btn-sm" type="button" onClick={handleAddTask}>
            + Add Task
          </button>
        </div>

        {apTasks.length === 0 ? (
          <div className="empty-state-text">No assessment tasks defined yet. Click "Add Task" to get started!</div>
        ) : (
          <div className="tasks-cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            {apTasks.map((task, idx) => (
              <div className="task-editor-card" key={task.uuid} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
                <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="task-badge" style={{ background: 'var(--color-accent-bg)', color: 'var(--color-accent-hover)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>{task.type}</span>
                  <button className="btn-delete" style={{ padding: '4px 8px', fontSize: '12px' }} type="button" onClick={() => handleRemoveTask(idx)}>
                    Remove
                  </button>
                </div>
                <div className="form-group">
                  <label>Task Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={task.title}
                    onChange={(e) => handleUpdateTask(idx, 'title', e.target.value)}
                    placeholder="Task Title (e.g. Vulnerability Scan / Code Review)"
                    required
                  />
                </div>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Type</label>
                    <select
                      className="form-input"
                      value={task.type}
                      onChange={(e) => handleUpdateTask(idx, 'type', e.target.value)}
                    >
                      <option value="milestone">Milestone</option>
                      <option value="action">Action Item</option>
                      <option value="review">Audit Review</option>
                      <option value="interview">Staff Interview</option>
                      <option value="test">Technical Test</option>
                    </select>
                  </div>
                  <div className="form-row-nested" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="form-group">
                      <label>Start Date</label>
                      <input
                        type="datetime-local"
                        className="form-input"
                        value={task.start}
                        onChange={(e) => handleUpdateTask(idx, 'start', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>End Date</label>
                      <input
                        type="datetime-local"
                        className="form-input"
                        value={task.end}
                        onChange={(e) => handleUpdateTask(idx, 'end', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    className="form-textarea"
                    value={task.description}
                    onChange={(e) => handleUpdateTask(idx, 'description', e.target.value)}
                    placeholder="Explain the scope and procedures for this task..."
                    rows={2}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Local Definitions / Custom Scope Assets */}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '20px', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Audit Scope / Local Definition Assets</span>
            <button type="button" className="btn-secondary btn-xs" onClick={() => setApLocalDefinitions(prev => [...prev, { uuid: generateUUID(), title: '', description: '' }])}>+ Add Local Asset</button>
          </div>
          {apLocalDefinitions.length === 0 ? (
            <div className="empty-state-text" style={{ fontSize: '11px' }}>No custom scope assets defined.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {apLocalDefinitions.map((ld, ldIdx) => (
                <div key={ld.uuid} style={{ display: 'flex', gap: '10px', background: 'var(--color-surface-2)', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      className="form-input"
                      value={ld.title}
                      onChange={e => setApLocalDefinitions(prev => prev.map((item, i) => i === ldIdx ? { ...item, title: e.target.value } : item))}
                      placeholder="e.g. Staging Test Environment IP-range"
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    />
                  </div>
                  <div style={{ flex: 2 }}>
                    <input
                      type="text"
                      className="form-input"
                      value={ld.description}
                      onChange={e => setApLocalDefinitions(prev => prev.map((item, i) => i === ldIdx ? { ...item, description: e.target.value } : item))}
                      placeholder="e.g. Subnet 10.0.4.0/24 containing staging APIs"
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    />
                  </div>
                  <button type="button" className="btn-delete" style={{ padding: '4px 8px' }} onClick={() => setApLocalDefinitions(prev => prev.filter((_, i) => i !== ldIdx))}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assessment Assets (Team & Software Tools) */}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '20px', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Assessment Team & Testing Tools</span>
            <button type="button" className="btn-secondary btn-xs" onClick={() => setApAssets(prev => [...prev, { uuid: generateUUID(), type: 'tool', title: '', description: '' }])}>+ Add Asset</button>
          </div>
          {apAssets.length === 0 ? (
            <div className="empty-state-text" style={{ fontSize: '11px' }}>No testers or tools defined.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {apAssets.map((asset, aIdx) => (
                <div key={asset.uuid} style={{ display: 'flex', gap: '10px', background: 'var(--color-surface-2)', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                  <div style={{ width: '120px' }}>
                    <select
                      className="form-input"
                      value={asset.type}
                      onChange={e => setApAssets(prev => prev.map((item, i) => i === aIdx ? { ...item, type: e.target.value } : item))}
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    >
                      <option value="tool">Testing Tool</option>
                      <option value="actor">Auditor / Team</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      className="form-input"
                      value={asset.title}
                      onChange={e => setApAssets(prev => prev.map((item, i) => i === aIdx ? { ...item, title: e.target.value } : item))}
                      placeholder={asset.type === 'tool' ? "e.g. Nessus Scanner (v10.5)" : "e.g. Bob (Lead Auditor)"}
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      className="form-input"
                      value={asset.description}
                      onChange={e => setApAssets(prev => prev.map((item, i) => i === aIdx ? { ...item, description: e.target.value } : item))}
                      placeholder="e.g. Purpose or certification details"
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    />
                  </div>
                  <button type="button" className="btn-delete" style={{ padding: '4px 8px' }} onClick={() => setApAssets(prev => prev.filter((_, i) => i !== aIdx))}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reviewed Controls & Methods */}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '20px', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Reviewed Controls & Test Methods</span>
            <button type="button" className="btn-secondary btn-xs" onClick={() => setApReviewedControls(prev => [...prev, { controlId: '', methods: [] }])}>+ Add Reviewed Control</button>
          </div>
          {apReviewedControls.length === 0 ? (
            <div className="empty-state-text" style={{ fontSize: '11px' }}>No controls selected for review.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {apReviewedControls.map((rc, rcIdx) => (
                <div key={rcIdx} style={{ display: 'flex', gap: '15px', background: 'var(--color-surface-2)', padding: '12px', borderRadius: '4px', border: '1px solid var(--color-border)', alignItems: 'center' }}>
                  <div style={{ width: '120px' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={rc.controlId}
                      onChange={e => setApReviewedControls(prev => prev.map((item, i) => i === rcIdx ? { ...item, controlId: e.target.value } : item))}
                      placeholder="e.g. ac-2"
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    />
                  </div>
                  <div style={{ flex: 1, display: 'flex', gap: '15px' }}>
                    {['examine', 'interview', 'test'].map(method => {
                      const isSel = (rc.methods || []).includes(method);
                      return (
                        <label key={method} className="checkbox-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => {
                              setApReviewedControls(prev => prev.map((item, i) => {
                                if (i !== rcIdx) return item;
                                const methods = [...(item.methods || [])];
                                const next = isSel ? methods.filter(m => m !== method) : [...methods, method];
                                return { ...item, methods: next };
                              }));
                            }}
                          />
                          <span className="checkbox-custom"></span>
                          <span style={{ textTransform: 'capitalize' }}>{method}</span>
                        </label>
                      );
                    })}
                  </div>
                  <button type="button" className="btn-delete" style={{ padding: '4px 8px' }} onClick={() => setApReviewedControls(prev => prev.filter((_, i) => i !== rcIdx))}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderVisualArEditor = () => {
    const handleAddFinding = () => {
      setArFindings(prev => [...prev, {
        uuid: generateUUID(),
        title: '',
        description: '',
        status: 'open',
        target: '',
        relatedObservations: [],
        associatedRisks: [],
        attestationState: 'satisfied',
        attestationStatement: ''
      }]);
    };

    const handleRemoveFinding = (index) => {
      setArFindings(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdateFinding = (index, field, val) => {
      setArFindings(prev => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: val };
        return next;
      });
    };

    return (
      <div className="visual-ar-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label>Import Assessment Plan (AP)</label>
          <select
            className="form-input"
            value={selectedApId}
            onChange={(e) => setSelectedApId(e.target.value)}
          >
            <option value="">-- Select Target Assessment Plan --</option>
            {availableAps.map(a => (
              <option key={a.uuid} value={a.uuid}>{a.title}</option>
            ))}
          </select>
        </div>

        <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <label className="section-subtitle">Assessment Results / Findings</label>
          <button className="btn-primary btn-sm" type="button" onClick={handleAddFinding}>
            + Add Finding
          </button>
        </div>

        {arFindings.length === 0 ? (
          <div className="empty-state-text">No findings reported yet. Click "Add Finding" to document results!</div>
        ) : (
          <div className="findings-cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            {arFindings.map((finding, idx) => (
              <div className="finding-editor-card" key={finding.uuid} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
                <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="finding-badge" style={{
                    background: finding.status === 'open' ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
                    color: finding.status === 'open' ? 'var(--color-danger)' : 'var(--color-success)',
                    padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase'
                  }}>{finding.status}</span>
                  <button className="btn-delete" style={{ padding: '4px 8px', fontSize: '12px' }} type="button" onClick={() => handleRemoveFinding(idx)}>
                    Remove
                  </button>
                </div>
                <div className="form-group">
                  <label>Finding Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={finding.title}
                    onChange={(e) => handleUpdateFinding(idx, 'title', e.target.value)}
                    placeholder="Finding Title (e.g. Port 22 open / Outdated OpenSSL)"
                    required
                  />
                </div>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Status</label>
                    <select
                      className="form-input"
                      value={finding.status}
                      onChange={(e) => handleUpdateFinding(idx, 'status', e.target.value)}
                    >
                      <option value="open">Open</option>
                      <option value="closed">Closed / Resolved</option>
                      <option value="risk-accepted">Risk Accepted</option>
                      <option value="mitigated">Mitigated</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Target / Control ID</label>
                    <input
                      type="text"
                      className="form-input"
                      value={finding.target}
                      onChange={(e) => handleUpdateFinding(idx, 'target', e.target.value)}
                      placeholder="e.g. ac-2 or software-component-uuid"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    className="form-textarea"
                    value={finding.description}
                    onChange={(e) => handleUpdateFinding(idx, 'description', e.target.value)}
                    placeholder="Document the exact findings, vulnerability details, and evidence..."
                    rows={2}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px', background: 'var(--color-surface-3)', padding: '12px', borderRadius: '6px', border: '1px solid var(--color-border-subtle)' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Related Observations</label>
                    {arObservations.length === 0 ? (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>No observations defined.</span>
                    ) : (
                      <div style={{ maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {arObservations.map(obs => {
                          const isChecked = (finding.relatedObservations || []).includes(obs.uuid);
                          return (
                            <label key={obs.uuid} style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  const currentList = finding.relatedObservations || [];
                                  const newList = isChecked ? currentList.filter(id => id !== obs.uuid) : [...currentList, obs.uuid];
                                  handleUpdateFinding(idx, 'relatedObservations', newList);
                                }}
                              />
                              {obs.description || obs.uuid.slice(0, 8)}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Associated Risks</label>
                    {arRisks.length === 0 ? (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>No risks defined.</span>
                    ) : (
                      <div style={{ maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {arRisks.map(risk => {
                          const isChecked = (finding.associatedRisks || []).includes(risk.uuid);
                          return (
                            <label key={risk.uuid} style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  const currentList = finding.associatedRisks || [];
                                  const newList = isChecked ? currentList.filter(id => id !== risk.uuid) : [...currentList, risk.uuid];
                                  handleUpdateFinding(idx, 'associatedRisks', newList);
                                }}
                              />
                              {risk.description || risk.uuid.slice(0, 8)}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '12px', background: 'var(--color-surface-3)', padding: '12px', borderRadius: '6px', border: '1px solid var(--color-border-subtle)' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Attestation (Kontroll-Attestierung)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '12px', alignItems: 'start' }}>
                    <div>
                      <select
                        className="form-input"
                        value={finding.attestationState || 'satisfied'}
                        onChange={(e) => handleUpdateFinding(idx, 'attestationState', e.target.value)}
                        style={{ fontSize: '12px', padding: '4px' }}
                      >
                        <option value="satisfied">Satisfies</option>
                        <option value="not-satisfied">Not Satisfied</option>
                      </select>
                    </div>
                    <div>
                      <textarea
                        className="form-textarea"
                        value={finding.attestationStatement || ''}
                        onChange={(e) => handleUpdateFinding(idx, 'attestationStatement', e.target.value)}
                        placeholder="Auditor Statement (e.g. Verified Cognito configurations...)"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                        rows={1}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 6: Assessment Log / Logbuch */}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '20px', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Assessment Log</span>
            <button type="button" className="btn-secondary btn-xs" onClick={() => setArLogs(prev => [...prev, { uuid: generateUUID(), start: '', end: '', description: '' }])}>+ Add Log Entry</button>
          </div>
          {arLogs.length === 0 ? (
            <div className="empty-state-text" style={{ fontSize: '11px' }}>No log entries recorded.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {arLogs.map((log, lIdx) => (
                <div key={log.uuid} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                    <div>
                      <label style={{ fontSize: '9px' }}>Start Time</label>
                      <input
                        type="datetime-local"
                        className="form-input"
                        value={log.start}
                        onChange={e => setArLogs(prev => prev.map((item, i) => i === lIdx ? { ...item, start: e.target.value } : item))}
                        style={{ fontSize: '12px', padding: '4px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '9px' }}>End Time</label>
                      <input
                        type="datetime-local"
                        className="form-input"
                        value={log.end}
                        onChange={e => setArLogs(prev => prev.map((item, i) => i === lIdx ? { ...item, end: e.target.value } : item))}
                        style={{ fontSize: '12px', padding: '4px' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={log.description}
                      onChange={e => setArLogs(prev => prev.map((item, i) => i === lIdx ? { ...item, description: e.target.value } : item))}
                      placeholder="e.g. Conducted automated scans / Staff interviews..."
                      style={{ fontSize: '12px', padding: '4px 8px', flex: 1 }}
                    />
                    <button type="button" className="btn-delete" style={{ padding: '4px 8px' }} onClick={() => setArLogs(prev => prev.filter((_, i) => i !== lIdx))}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 6: Observations (Beobachtungen & Beweisdaten) */}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '20px', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Observations (Beobachtungen & Beweise)</span>
            <button type="button" className="btn-secondary btn-xs" onClick={() => setArObservations(prev => [...prev, { uuid: generateUUID(), description: '', type: 'satisfies', evidence: '', componentUuid: '' }])}>+ Add Observation</button>
          </div>
          {arObservations.length === 0 ? (
            <div className="empty-state-text" style={{ fontSize: '11px' }}>No observations reported.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {arObservations.map((obs, oIdx) => (
                <div key={obs.uuid} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ width: '150px' }}>
                      <label style={{ fontSize: '9px' }}>Type</label>
                      <select
                        className="form-input"
                        value={obs.type}
                        onChange={e => setArObservations(prev => prev.map((item, i) => i === oIdx ? { ...item, type: e.target.value } : item))}
                        style={{ fontSize: '12px', padding: '4px' }}
                      >
                        <option value="satisfies">Satisfies</option>
                        <option value="under-review">Under Review</option>
                        <option value="fails">Fails</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '9px' }}>Observation ID: <code style={{ fontSize: '10px' }}>{obs.uuid.slice(0, 8)}</code></label>
                      <input
                        type="text"
                        className="form-input"
                        value={obs.description}
                        onChange={e => setArObservations(prev => prev.map((item, i) => i === oIdx ? { ...item, description: e.target.value } : item))}
                        placeholder="e.g. Verified Cognito auto-lock after 3 failed login attempts"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '9px' }}>Evidence (Log, file reference)</label>
                      <input
                        type="text"
                        className="form-input"
                        value={obs.evidence}
                        onChange={e => setArObservations(prev => prev.map((item, i) => i === oIdx ? { ...item, evidence: e.target.value } : item))}
                        placeholder="e.g. evidence/cognito-log.txt or screenshot.png"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      />
                    </div>
                    <div style={{ width: '200px' }}>
                      <label style={{ fontSize: '9px' }}>Associated Component</label>
                      <select
                        className="form-input"
                        value={obs.componentUuid || ''}
                        onChange={e => setArObservations(prev => prev.map((item, i) => i === oIdx ? { ...item, componentUuid: e.target.value } : item))}
                        style={{ fontSize: '12px', padding: '4px' }}
                      >
                        <option value="">-- No Component --</option>
                        {availableComponents.map(comp => (
                          <option key={comp.uuid} value={comp.uuid}>{comp.title || 'Untitled Component'}</option>
                        ))}
                      </select>
                    </div>
                    <button type="button" className="btn-delete" style={{ padding: '4px 8px', alignSelf: 'flex-end' }} onClick={() => setArObservations(prev => prev.filter((_, i) => i !== oIdx))}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 6: Risks (Risiko- & Schwachstellenanalyse) */}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '20px', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Identified Risks (Risiko- & Schwachstellenanalyse)</span>
            <button type="button" className="btn-secondary btn-xs" onClick={() => setArRisks(prev => [...prev, { uuid: generateUUID(), description: '', severity: 'medium', recommendation: '', observationUuid: '' }])}>+ Add Risk</button>
          </div>
          {arRisks.length === 0 ? (
            <div className="empty-state-text" style={{ fontSize: '11px' }}>No risks identified.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {arRisks.map((risk, rIdx) => (
                <div key={risk.uuid} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ width: '120px' }}>
                      <label style={{ fontSize: '9px' }}>Severity</label>
                      <select
                        className="form-input"
                        value={risk.severity}
                        onChange={e => setArRisks(prev => prev.map((item, i) => i === rIdx ? { ...item, severity: e.target.value } : item))}
                        style={{ fontSize: '12px', padding: '4px' }}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '9px' }}>Risk Description</label>
                      <input
                        type="text"
                        className="form-input"
                        value={risk.description}
                        onChange={e => setArRisks(prev => prev.map((item, i) => i === rIdx ? { ...item, description: e.target.value } : item))}
                        placeholder="e.g. Unused administrative accounts remain active indefinitely"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '9px' }}>Remediation Recommendation</label>
                      <input
                        type="text"
                        className="form-input"
                        value={risk.recommendation}
                        onChange={e => setArRisks(prev => prev.map((item, i) => i === rIdx ? { ...item, recommendation: e.target.value } : item))}
                        placeholder="e.g. Cognito-Scheduler to disable accounts after 14 days of inactivity"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      />
                    </div>
                    <div style={{ width: '180px' }}>
                      <label style={{ fontSize: '9px' }}>Referenced Observation</label>
                      <select
                        className="form-input"
                        value={risk.observationUuid}
                        onChange={e => setArRisks(prev => prev.map((item, i) => i === rIdx ? { ...item, observationUuid: e.target.value } : item))}
                        style={{ fontSize: '12px', padding: '4px' }}
                      >
                        <option value="">-- Select Observation --</option>
                        {arObservations.map(o => (
                          <option key={o.uuid} value={o.uuid}>{o.description.slice(0, 30)}...</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-delete" style={{ padding: '4px 8px' }} onClick={() => setArRisks(prev => prev.filter((_, i) => i !== rIdx))}>Remove Risk</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderVisualPoamEditor = () => {
    const handleAddPoamItem = () => {
      setPoamItems(prev => [...prev, {
        uuid: generateUUID(),
        title: '',
        description: '',
        remediation: '',
        status: 'planned',
        dueDate: ''
      }]);
    };

    const handleRemovePoamItem = (index) => {
      setPoamItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdatePoamItem = (index, field, val) => {
      setPoamItems(prev => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: val };
        return next;
      });
    };

    const handleImportRisks = async () => {
      if (!selectedArIdForImport) return;
      try {
        const res = await authFetch(`/api/documents/assessment-results/${selectedArIdForImport}`);
        if (res.ok) {
          const arDoc = await res.json();
          const ar = arDoc['assessment-results'] || {};
          const risks = ar.risks || [];
          const newPoamItems = risks.map(risk => ({
            uuid: generateUUID(),
            title: `Risk: ${risk.description ? (risk.description.length > 50 ? risk.description.slice(0, 50) + '...' : risk.description) : 'Unnamed Risk'}`,
            description: risk.description || '',
            remediation: risk.recommendation || '',
            status: 'planned',
            dueDate: '',
            props: [
              { name: 'source-risk-uuid', value: risk.uuid },
              { name: 'severity', value: risk.severity || 'medium' }
            ]
          }));
          setPoamItems(prev => [...prev, ...newPoamItems]);
          alert(`Successfully imported ${newPoamItems.length} risks from Assessment Results!`);
        } else {
          alert("Failed to load Assessment Results");
        }
      } catch (err) {
        alert("Error importing risks: " + err.message);
      }
    };

    return (
      <div className="visual-poam-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Risk Import Panel */}
        <div style={{ background: 'var(--color-surface-3)', padding: '16px', borderRadius: '6px', border: '1px solid var(--color-border-subtle)', marginBottom: '16px' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Import Risks from Assessment Results (Import Findings)</span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              className="form-input"
              value={selectedArIdForImport}
              onChange={e => setSelectedArIdForImport(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="">-- Select Assessment Report --</option>
              {availableArs.map(ar => (
                <option key={ar.uuid} value={ar.uuid}>{ar.title || 'Untitled Assessment Results'}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={handleImportRisks}
              disabled={!selectedArIdForImport}
            >
              Import Risks
            </button>
          </div>
        </div>

        <div className="section-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <label className="section-subtitle">Plan of Action & Milestones (POA&M) Items</label>
          <button className="btn-primary btn-sm" type="button" onClick={handleAddPoamItem}>
            + Add POA&M Item
          </button>
        </div>

        {poamItems.length === 0 ? (
          <div className="empty-state-text">No POA&M items defined yet. Click "Add POA&M Item" to get started!</div>
        ) : (
          <div className="poam-cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            {poamItems.map((item, idx) => (
              <div className="poam-editor-card" key={item.uuid} style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
                <div className="card-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="poam-badge" style={{
                    background: item.status === 'completed' ? 'var(--color-success-bg)' : item.status === 'ongoing' ? 'var(--color-accent-bg)' : 'var(--color-warning-bg)',
                    color: item.status === 'completed' ? 'var(--color-success)' : item.status === 'ongoing' ? 'var(--color-accent-hover)' : 'var(--color-warning)',
                    padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase'
                  }}>{item.status}</span>
                  <button className="btn-delete" style={{ padding: '4px 8px', fontSize: '12px' }} type="button" onClick={() => handleRemovePoamItem(idx)}>
                    Remove
                  </button>
                </div>
                <div className="form-group">
                  <label>Item Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={item.title}
                    onChange={(e) => handleUpdatePoamItem(idx, 'title', e.target.value)}
                    placeholder="POA&M Item Title (e.g. Patch Outdated OpenSSL on Web Server)"
                    required
                  />
                </div>
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Status</label>
                    <select
                      className="form-input"
                      value={item.status}
                      onChange={(e) => handleUpdatePoamItem(idx, 'status', e.target.value)}
                    >
                      <option value="planned">Planned</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                      <option value="delayed">Delayed</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Due Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={item.dueDate}
                      onChange={(e) => handleUpdatePoamItem(idx, 'dueDate', e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    className="form-textarea"
                    value={item.description}
                    onChange={(e) => handleUpdatePoamItem(idx, 'description', e.target.value)}
                    placeholder="Detailed explanation of the weakness or vulnerability identified..."
                    rows={2}
                  />
                </div>
                <div className="form-group">
                  <label>Remediation Plan</label>
                  <textarea
                    className="form-textarea"
                    value={item.remediation}
                    onChange={(e) => handleUpdatePoamItem(idx, 'remediation', e.target.value)}
                    placeholder="Specify remediation milestones, actions, and responsible parties..."
                    rows={2}
                  />
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                  <div className="form-group">
                    <label>Deviation Type (Sonderfreigabe)</label>
                    <select
                      className="form-input"
                      value={item.deviationType || 'none'}
                      onChange={(e) => handleUpdatePoamItem(idx, 'deviationType', e.target.value)}
                    >
                      <option value="none">No Deviation</option>
                      <option value="false-positive">False Positive (Fehlalarm)</option>
                      <option value="risk-acceptance">Risk Acceptance (Risikoakzeptanz)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Verification Evidence / Belegnachweis {item.status === 'completed' && <span className="required"> *</span>}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={item.evidence || ''}
                      onChange={(e) => handleUpdatePoamItem(idx, 'evidence', e.target.value)}
                      placeholder="e.g. commit: 9ef3a1b or logs/verify-run.txt"
                      required={item.status === 'completed'}
                    />
                  </div>
                </div>

                {(item.deviationType && item.deviationType !== 'none') && (
                  <div className="form-group" style={{ marginTop: '12px' }}>
                    <label>Deviation Rationale *</label>
                    <textarea
                      className="form-textarea"
                      value={item.deviationRationale || ''}
                      onChange={(e) => handleUpdatePoamItem(idx, 'deviationRationale', e.target.value)}
                      placeholder="Specify rationale, compensating controls, or operational necessity..."
                      rows={2}
                      required
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };



  if (!config) return null;

  const isVisualWide = (stage === 'catalogs' || stage === 'profiles' || stage === 'ssps' || stage === 'component-definitions' || stage === 'assessment-plans' || stage === 'assessment-results' || stage === 'poams' || stage === 'control-mappings') && editorMode === 'visual';

  return (
    <div className="editor-overlay">
      <div className={`editor-panel ${isVisualWide ? 'editor-panel-wide' : ''}`}>
        <div className="editor-header">
          <h3>{editDoc ? (stage === 'catalogs' ? `New ${config.label} (Clone)` : `Edit ${config.label}`) : `New ${config.label}`}</h3>
          <button className="btn-icon" onClick={onCancel} title="Close">✕</button>
        </div>

        <div className="editor-body">
          {(stage === 'catalogs' || stage === 'profiles' || stage === 'ssps' || stage === 'component-definitions' || stage === 'assessment-plans' || stage === 'assessment-results' || stage === 'poams' || stage === 'control-mappings') && (
            <div className="mode-toggle-bar">
              <button
                type="button"
                className={`mode-toggle-btn ${editorMode === 'visual' ? 'active' : ''}`}
                onClick={() => handleModeToggle('visual')}
              >
                {stage === 'catalogs' ? 'Catalog Metadata' : stage === 'profiles' ? 'Visual Tailoring' : stage === 'ssps' ? 'Visual SSP Builder' : stage === 'component-definitions' ? 'Visual Component Editor' : stage === 'assessment-plans' ? 'Visual AP Editor' : stage === 'assessment-results' ? 'Visual Results Editor' : stage === 'control-mappings' ? 'Mapping Collection Creator' : 'Visual POA&M Editor'}
              </button>
              <button
                type="button"
                className={`mode-toggle-btn ${editorMode === 'raw' ? 'active' : ''}`}
                onClick={() => handleModeToggle('raw')}
              >
                Raw JSON Editor
              </button>
            </div>
          )}

          {editorMode === 'visual' ? (
            <>
              <div className="form-group">
                <label>UUID</label>
                <div className="uuid-row">
                  <input
                    type="text"
                    value={uuid}
                    onChange={(e) => setUuid(e.target.value)}
                    className="form-input monospace"
                    placeholder="Document UUID"
                  />
                  <button className="btn-secondary btn-sm" type="button" onClick={() => setUuid(generateUUID())}>
                    Generate
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Title <span className="required">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="form-input"
                  placeholder={`${config.label} title`}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Version</label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="form-input"
                    placeholder="1.0.0"
                  />
                </div>
                <div className="form-group">
                  <label>OSCAL Version</label>
                  <input
                    type="text"
                    value={oscalVersion}
                    onChange={(e) => setOscalVersion(e.target.value)}
                    className="form-input"
                    placeholder="1.1.2"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="form-textarea"
                  placeholder="Optional notes or remarks"
                  rows={2}
                />
              </div>

              {stage === 'profiles' && editDoc && (
                <div className="form-group" style={{ background: 'var(--color-surface-2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)', marginBottom: '20px' }}>
                  <label style={{ fontWeight: 'bold', fontSize: '13px', display: 'block', marginBottom: '12px' }}>
                    Select Catalogs and Profiles as Import Baseline (Inputs)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                        Available Catalogs
                      </div>
                      {availableCatalogs.length === 0 ? (
                        <div className="empty-state-text" style={{ fontSize: '11px' }}>No catalogs available</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {availableCatalogs.map(cat => {
                            const isSelected = selectedCatalogIds.includes(cat.uuid);
                            return (
                              <label key={cat.uuid} className="checkbox-label catalog-select-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleCatalog(cat.uuid)}
                                />
                                <span className="checkbox-custom"></span>
                                <span className="catalog-title-text">{cat.title}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <div style={{ fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                        Available Profiles
                      </div>
                      {availableProfiles.filter(p => p.uuid !== uuid).length === 0 ? (
                        <div className="empty-state-text" style={{ fontSize: '11px' }}>No profiles available</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {availableProfiles.filter(p => p.uuid !== uuid).map(prof => {
                            const isSelected = selectedCatalogIds.includes(prof.uuid);
                            return (
                              <label key={prof.uuid} className="checkbox-label catalog-select-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleCatalog(prof.uuid)}
                                />
                                <span className="checkbox-custom"></span>
                                <span className="catalog-title-text">{prof.title}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {stage === 'profiles' && editDoc && (
                <div className="form-group" style={{ background: 'var(--color-surface-2)', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '12px' }}>Profile Roles (Metadata)</label>
                    <button
                      type="button"
                      className="btn-secondary btn-xs"
                      onClick={() => setProfileRoles(prev => [...prev, { id: `role-${generateUUID().slice(0, 4)}`, title: 'New Role' }])}
                    >
                      + Add Role
                    </button>
                  </div>
                  {profileRoles.length === 0 ? (
                    <div className="empty-state-text" style={{ fontSize: '11px' }}>No global roles defined in metadata. Add roles to map them to control responsibilities.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {profileRoles.map((role, rIdx) => (
                        <div key={rIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="text"
                            className="form-input text-xs"
                            style={{ flex: 1, padding: '4px 8px', background: 'var(--color-surface)' }}
                            value={role.id}
                            onChange={(e) => setProfileRoles(prev => prev.map((r, i) => i === rIdx ? { ...r, id: e.target.value } : r))}
                            placeholder="Role ID (e.g. ciso)"
                          />
                          <input
                            type="text"
                            className="form-input text-xs"
                            style={{ flex: 2, padding: '4px 8px', background: 'var(--color-surface)' }}
                            value={role.title}
                            onChange={(e) => setProfileRoles(prev => prev.map((r, i) => i === rIdx ? { ...r, title: e.target.value } : r))}
                            placeholder="Role Title (e.g. Chief Information Security Officer)"
                          />
                          <button
                            type="button"
                            className="btn-delete"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => setProfileRoles(prev => prev.filter((_, i) => i !== rIdx))}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {stage === 'catalogs' ? (
                renderVisualCatalogBuilder()
              ) : stage === 'profiles' ? (
                editDoc ? renderVisualTailoring() : null
              ) : stage === 'component-definitions' ? (
                renderVisualComponentEditor()
              ) : stage === 'ssps' ? (
                renderVisualSspBuilder()
              ) : stage === 'assessment-plans' ? (
                renderVisualApEditor()
              ) : stage === 'assessment-results' ? (
                renderVisualArEditor()
              ) : stage === 'poams' ? (
                renderVisualPoamEditor()
              ) : null}
            </>
          ) : (
            <div className="form-group" style={{ height: '100%', display: 'flex', flexDirection: 'column', flex: 1, margin: 0 }}>
              <label style={{ fontWeight: 'bold', marginBottom: '8px' }}>OSCAL Document JSON (Raw)</label>
              <textarea
                value={rawJsonText}
                onChange={(e) => setRawJsonText(e.target.value)}
                className="form-textarea monospace"
                style={{
                  flex: 1,
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  padding: '12px',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  minHeight: '450px',
                  resize: 'vertical'
                }}
                placeholder="Paste your raw OSCAL JSON here..."
              />
            </div>
          )}

          {validationResult && (
            <div className={`validation-result ${validationResult.ok ? 'valid' : 'invalid'}`}>
              {validationResult.ok ? '✅ ' : '❌ '}
              {validationResult.message}
            </div>
          )}

          {error && <div className="error-message">⚠️ {error}</div>}
        </div>

        <div className="editor-footer">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-secondary" onClick={handleValidate} disabled={validating}>
            {validating ? 'Validating…' : 'Validate'}
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || (editorMode === 'visual' && !title.trim())}>
            {saving ? 'Saving…' : editDoc ? (stage === 'catalogs' ? 'Create Catalog' : 'Update Document') : 'Create Document'}
          </button>
        </div>
      </div>
    </div>
  );
}
