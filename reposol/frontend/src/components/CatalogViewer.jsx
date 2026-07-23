import { useState, useEffect, useMemo, useRef } from 'react';
import { authFetch } from '../lib/api';

const applyModify = (catalog, modify) => {
  if (!modify) return;
  const setParams = modify["set-parameters"] || [];
  const alters = modify.alters || [];
  const paramMap = new Map(setParams.map(p => [p["param-id"]?.toLowerCase(), p]));
  const alterMap = new Map(alters.map(a => [a["control-id"]?.toLowerCase(), a]));

  const applyAltersToParts = (partsList, adds, removes) => {
    let result = partsList ? [...partsList] : [];
    
    // Apply adds before removes so a replacement part can be positioned relative
    // to the original part, then remove that original part by its distinct ID.
    if (adds) {
      adds.forEach(add => {
        if (add.parts) {
          add.parts.forEach(newPart => {
            const idx = result.findIndex(p => p.id === newPart.id);
            if (idx >= 0) {
              result[idx] = { ...result[idx], ...newPart };
            } else {
              if (add.position === 'starting') {
                result.unshift(newPart);
              } else if (add.position === 'before' && add["by-id"]) {
                const targetIdx = result.findIndex(p => p.id === add["by-id"]);
                if (targetIdx >= 0) {
                  result.splice(targetIdx, 0, newPart);
                } else {
                  result.push(newPart);
                }
              } else if (add.position === 'after' && add["by-id"]) {
                const targetIdx = result.findIndex(p => p.id === add["by-id"]);
                if (targetIdx >= 0) {
                  result.splice(targetIdx + 1, 0, newPart);
                } else {
                  result.push(newPart);
                }
              } else {
                result.push(newPart);
              }
            }
          });
        }
      });
    }

    if (removes) {
      removes.forEach(remove => {
        if (remove["by-id"]) {
          result = result.filter(p => p.id !== remove["by-id"]);
        }
        if (remove["by-name"]) {
          result = result.filter(p => p.name !== remove["by-name"]);
        }
      });
    }

    // Recurse
    return result.map(p => {
      if (p.parts) {
        return {
          ...p,
          parts: applyAltersToParts(p.parts, adds, removes)
        };
      }
      return p;
    });
  };

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
      if (alter.removes) {
        alter.removes.forEach(remove => {
          if (remove["by-name"]) {
            if (ctrl.props) ctrl.props = ctrl.props.filter(p => p.name !== remove["by-name"]);
          }
          if (remove["by-id"]) {
            if (ctrl.params) ctrl.params = ctrl.params.filter(p => p.id !== remove["by-id"]);
            if (ctrl.links) ctrl.links = ctrl.links.filter(l => l.href !== remove["by-id"] && l.id !== remove["by-id"]);
            if (ctrl.controls) ctrl.controls = ctrl.controls.filter(c => c.id !== remove["by-id"]);
          }
          if (remove["by-item-name"]) {
            if (remove["by-item-name"] === 'link' && ctrl.links) ctrl.links = [];
            if (remove["by-item-name"] === 'prop' && ctrl.props) ctrl.props = [];
          }
        });
      }
      if (ctrl.parts) {
        ctrl.parts = applyAltersToParts(ctrl.parts, alter.adds, alter.removes);
      }
      // Also apply non-part changes if present in adds (props, params, links, controls at control level)
      if (alter.adds) {
        alter.adds.forEach(add => {
          if (add.props) {
            let props = ctrl.props ? [...ctrl.props] : [];
            add.props.forEach(newProp => {
              const idx = props.findIndex(p => p.name === newProp.name);
              if (idx >= 0) {
                props[idx] = newProp;
              } else {
                props.push(newProp);
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
                params.push(newParam);
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
                links.push(newLink);
              }
            });
            ctrl.links = links;
          }
          if (add.controls) {
            let subControls = ctrl.controls ? [...ctrl.controls] : [];
            add.controls.forEach(newSubCtrl => {
              const idx = subControls.findIndex(sc => sc.id === newSubCtrl.id);
              if (idx >= 0) {
                subControls[idx] = newSubCtrl;
              } else {
                if (add.position === 'starting') {
                  subControls.unshift(newSubCtrl);
                } else {
                  subControls.push(newSubCtrl);
                }
              }
            });
            ctrl.controls = subControls;
          }
        });
      }
    }
    
    // Apply title-override and id-override props
    if (ctrl.props) {
      const titleOverride = ctrl.props.find(p => p.name === 'title-override');
      if (titleOverride) {
        ctrl.title = titleOverride.value;
      }
      const idOverride = ctrl.props.find(p => p.name === 'id-override');
      if (idOverride) {
        ctrl.originalId = ctrl.id;
        ctrl.id = idOverride.value;
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

const fetchImportedCatalogs = async (profileDoc, cache = new Map()) => {
  const profile = profileDoc.profile;
  if (!profile) return cache;
  const imports = profile.imports || [];
  
  let availableCatalogs = new Set();
  let availableProfiles = new Set();
  try {
    const listRes = await authFetch('/api/documents/catalogs');
    if (listRes.ok) {
      const listData = await listRes.json();
      listData.forEach(doc => {
        if (doc.catalog && doc.catalog.uuid) {
          availableCatalogs.add(doc.catalog.uuid.toLowerCase());
        }
      });
    }
    const listProf = await authFetch('/api/documents/profiles');
    if (listProf.ok) {
      const listProfData = await listProf.json();
      listProfData.forEach(doc => {
        if (doc.profile && doc.profile.uuid) {
          availableProfiles.add(doc.profile.uuid.toLowerCase());
        }
      });
    }
  } catch (err) {
    console.error("Error listing documents for profile resolution:", err);
  }
  
  await Promise.all(
    imports.map(async (imp) => {
      const match = imp.href.match(/([a-f0-9-]{36})/i);
      const uuid = match ? match[1] : null;
      if (!uuid) return;
      const uuidLower = uuid.toLowerCase();
      
      const existing = cache.get(uuidLower);
      const existingCatalog = existing?.data?.catalog || existing?.catalog;
      const hasControlsOrGroups = existingCatalog && (
        (Array.isArray(existingCatalog.controls) && existingCatalog.controls.length > 0) ||
        (Array.isArray(existingCatalog.groups) && existingCatalog.groups.length > 0)
      );

      if (cache.has(uuidLower) && hasControlsOrGroups) return;
      
      let isCatalog = availableCatalogs.has(uuidLower) || (imp.href && (imp.href.includes('/catalogs/') || imp.href.includes('catalogs/')));
      let isProfile = !isCatalog && (availableProfiles.has(uuidLower) || (imp.href && (imp.href.includes('/profiles/') || imp.href.includes('profiles/'))));

      if (isCatalog) {
        try {
          const res = await authFetch(`/api/documents/catalogs/${uuid}`);
          if (res.ok) {
            const data = await res.json();
            cache.set(uuidLower, { type: 'catalog', data });
          }
        } catch (err) {
          console.error("Error fetching imported catalog:", err);
        }
      } else if (isProfile) {
        try {
          const res = await authFetch(`/api/documents/profiles/${uuid}`);
          if (res.ok) {
            const data = await res.json();
            cache.set(uuidLower, { type: 'profile', data });
            await fetchImportedCatalogs(data, cache);
          }
        } catch (err) {
          console.error("Error fetching imported profile:", err);
        }
      }
    })
  );
  return cache;
};

const resolveProfileSync = (profileDoc, cache, keepAll = false) => {
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

  const filterControls = (controls, includeAll, includedIds, includePatterns, excludedIds, excludePatterns, keepAllFlag = false) => {
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
      
      const isActive = isIncluded && !isExcluded;
      if (!isActive && !keepAllFlag) return null;
      
      const filteredSub = filterControls(c.controls, includeAll, includedIds, includePatterns, excludedIds, excludePatterns, keepAllFlag);
      return { 
        ...c, 
        isControlInactive: !isActive,
        controls: filteredSub.length > 0 ? filteredSub : undefined 
      };
    }).filter(Boolean);
  };

  const filterGroups = (groups, includeAll, includedIds, includePatterns, excludedIds, excludePatterns, keepAllFlag = false) => {
    if (!groups) return [];
    return groups.map(g => {
      const filteredSubGroups = filterGroups(g.groups, includeAll, includedIds, includePatterns, excludedIds, excludePatterns, keepAllFlag);
      const filteredCtrls = filterControls(g.controls, includeAll, includedIds, includePatterns, excludedIds, excludePatterns, keepAllFlag);
      if (!keepAllFlag && filteredSubGroups.length === 0 && filteredCtrls.length === 0) return null;
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
      const res = resolveProfileSync(realDoc, cache, keepAllFlag);
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

    if (resolvedImportedCatalog.groups) allMergedGroups.push(...filterGroups(resolvedImportedCatalog.groups, includeAll, includedIds, includePatterns, excludedIds, excludePatterns, keepAll));
    if (resolvedImportedCatalog.controls) allMergedControls.push(...filterControls(resolvedImportedCatalog.controls, includeAll, includedIds, includePatterns, excludedIds, excludePatterns, keepAll));
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
    if (ctrl.originalId) {
      flatControlsMap.set(ctrl.originalId.toLowerCase(), ctrl);
    }
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
    const keysOrder = ['id', 'class', 'title', 'params', 'props', 'links', 'parts', 'controls'];
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

// Helper to format prose text with parameter inserts
const formatProse = (prose, params = []) => {
  if (!prose) return '';
  
  // Replace {{ insert: param, param_id }} or similar placeholders
  const placeholderRegex = /\{\{\s*insert:\s*param,\s*([^\s}]+)\s*\}\}/g;
  
  const parts = [];
  let lastIndex = 0;
  let match;
  
  while ((match = placeholderRegex.exec(prose)) !== null) {
    const textBefore = prose.substring(lastIndex, match.index);
    if (textBefore) parts.push(textBefore);
    
    const paramId = match[1];
    const param = params?.find(p => p.id === paramId);
    const paramValue = param?.values?.[0] || param?.label || paramId;
    
    parts.push(
      <span key={match.index} className="control-param-insert" title={`Parameter: ${paramId}`}>
        {paramValue}
      </span>
    );
    
    lastIndex = placeholderRegex.lastIndex;
  }
  
  const textAfter = prose.substring(lastIndex);
  if (textAfter) parts.push(textAfter);
  
  return parts.length > 0 ? parts : prose;
};

// Recursive parts renderer for statement lists
const RenderParts = ({ parts, params }) => {
  if (!parts || parts.length === 0) return null;
  
  return (
    <ul className="parts-list">
      {parts.map((part, index) => {
        const hasChildren = part.parts && part.parts.length > 0;
        const labelProp = part.props?.find(p => p.name === 'label')?.value;
        
        return (
          <li key={part.id || index} className={`part-item ${part.name || ''}`}>
            {labelProp && (
              <span className="part-label">{labelProp}</span>
            )}
            <span className="part-prose">{formatProse(part.prose, params)}</span>
            {hasChildren && <RenderParts parts={part.parts} params={params} />}
          </li>
        );
      })}
    </ul>
  );
};

// Recursive parts editor for statement lists
const EditableParts = ({ parts, params, controlId, onPartProseChange, isPartModified, onRevertPart }) => {
  if (!parts || parts.length === 0) return null;
  
  return (
    <ul className="parts-list editing">
      {parts.map((part, index) => {
        const hasChildren = part.parts && part.parts.length > 0;
        const labelProp = part.props?.find(p => p.name === 'label')?.value;
        const modified = isPartModified ? isPartModified(controlId, part.id) : false;
        
        return (
          <li key={part.id || index} className={`part-item editing ${part.name || ''}`}>
            <div className="part-edit-row" style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
              {labelProp && (
                <span className="part-label" style={{ flexShrink: 0 }}>{labelProp}</span>
              )}
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ProseTextareaWithParams
                  className={`form-input part-prose-textarea ${modified ? 'modified' : ''}`}
                  value={part.prose || ''}
                  onChange={(e) => onPartProseChange(controlId, part.id, e.target.value)}
                  placeholder="Part text..."
                  rows={2}
                  style={modified ? { border: '1px solid var(--color-warning)', background: 'var(--color-warning-bg)' } : {}}
                  params={params}
                />
                {modified && onRevertPart && (
                  <button
                    type="button"
                    className="btn-secondary btn-xs"
                    onClick={() => onRevertPart(controlId, part.id)}
                    title="Reset"
                    style={{ padding: '4px 6px', height: 'fit-content' }}
                  >
                    ↺ Reset
                  </button>
                )}
              </div>
            </div>
            {hasChildren && (
              <EditableParts 
                parts={part.parts} 
                params={params} 
                controlId={controlId} 
                onPartProseChange={onPartProseChange}
                isPartModified={isPartModified}
                onRevertPart={onRevertPart}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
};

// A wrapper input component that debounces onChange updates
const DebouncedInput = ({ value, onChange, ...props }) => {
  const [localValue, setLocalValue] = useState(value || '');
  const timerRef = useRef(null);

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleChange = (e) => {
    const val = e.target.value;
    setLocalValue(val);
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    const fakeEvent = { target: { value: val } };
    const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
    if (isTest) {
      onChange(fakeEvent);
    } else {
      timerRef.current = setTimeout(() => {
        onChange(fakeEvent);
      }, 300); // 300ms debounce
    }
  };

  const handleBlur = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (localValue !== value) {
      const fakeEvent = { target: { value: localValue } };
      onChange(fakeEvent);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <input
      {...props}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};

// A wrapper textarea component that debounces onChange updates
const DebouncedTextarea = ({ value, onChange, ...props }) => {
  const [localValue, setLocalValue] = useState(value || '');
  const timerRef = useRef(null);

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleChange = (e) => {
    const val = e.target.value;
    setLocalValue(val);
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    
    const fakeEvent = { target: { value: val } };
    const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
    if (isTest) {
      onChange(fakeEvent);
    } else {
      timerRef.current = setTimeout(() => {
        onChange(fakeEvent);
      }, 300); // 300ms debounce
    }
  };

  const handleBlur = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (localValue !== value) {
      const fakeEvent = { target: { value: localValue } };
      onChange(fakeEvent);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <textarea
      {...props}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
};

const ProseTextareaWithParams = ({ value, onChange, params = [], className, rows, style, placeholder }) => {
  const [localValue, setLocalValue] = useState(value || '');
  const timerRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleChange = (e) => {
    const val = e.target.value;
    setLocalValue(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    
    const fakeEvent = { target: { value: val } };
    const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
    if (isTest) {
      onChange(fakeEvent);
    } else {
      timerRef.current = setTimeout(() => {
        onChange(fakeEvent);
      }, 300);
    }
  };

  const handleBlur = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange({ target: { value: localValue } });
  };

  const insertParamAtCursor = (paramId) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const textToInsert = `{{ insert: param, ${paramId} }}`;
    const nextVal = localValue.substring(0, start) + textToInsert + localValue.substring(end);
    setLocalValue(nextVal);
    
    if (timerRef.current) clearTimeout(timerRef.current);
    onChange({ target: { value: nextVal } });

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      <textarea
        ref={textareaRef}
        className={className}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        rows={rows}
        style={style}
        placeholder={placeholder}
      />
      {params && params.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', marginTop: '2px' }}>
          <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>➕ Insert Param:</span>
          {params.map(p => (
            <button
              key={p.id}
              type="button"
              className="btn-secondary btn-xs"
              onClick={() => insertParamAtCursor(p.id)}
              style={{ fontSize: '9px', padding: '1px 4px', border: '1px solid var(--color-border)', cursor: 'pointer', background: 'var(--color-surface-2)', borderRadius: '3px' }}
              title={`Insert placeholder for ${p.id}`}
            >
              {p.id}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function CatalogViewer({ catalogId, profileId, onClose, onEdit, initialEditMode = false }) {
  const [rawDoc, setRawDoc] = useState(null);
  const [loading, setLoading] = useState(!!catalogId || !!profileId);
  const [error, setError] = useState(null);
  const [cachedCatalogs, setCachedCatalogs] = useState(new Map());

  const [isEditing, setIsEditing] = useState(initialEditMode);

  const catalogDoc = useMemo(() => {
    if (!rawDoc) return null;
    if (catalogId) return rawDoc;
    return resolveProfileSync(rawDoc, cachedCatalogs, isEditing);
  }, [rawDoc, cachedCatalogs, isEditing, catalogId]);

  const missingImports = useMemo(() => {
    if (!profileId || !rawDoc?.profile?.imports) return [];
    return rawDoc.profile.imports
      .map(imp => {
        const match = imp.href.match(/([a-f0-9-]{36})/i);
        return match ? match[1]?.toLowerCase() : null;
      })
      .filter(uuid => uuid && !cachedCatalogs.has(uuid));
  }, [profileId, rawDoc, cachedCatalogs]);

  const [historyState, setHistoryState] = useState({ history: [], index: 0 });
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [autosaved, setAutosaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedControlId, setSelectedControlId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});

  const [editMode, setEditMode] = useState('visual'); // 'visual' or 'json'
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [schemaValidationError, setSchemaValidationError] = useState(null);
  const [validationSuccess, setValidationSuccess] = useState(false);

  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [saveVersionNumber, setSaveVersionNumber] = useState('');
  const [changeLog, setChangeLog] = useState([]);
  const [activeHistoryIndex, setActiveHistoryIndex] = useState(null);
  const [showChangeLog, setShowChangeLog] = useState(false);
  const [showDraftSaveModal, setShowDraftSaveModal] = useState(false);
  const [draftRemark, setDraftRemark] = useState('');
  const [publishVersion, setPublishVersion] = useState('');
  const [publishRemarks, setPublishRemarks] = useState('');
  const [showImportConfig, setShowImportConfig] = useState(false);
  const [allCatalogsList, setAllCatalogsList] = useState([]);
  const [registryTemplates, setRegistryTemplates] = useState([]);
  const [loadingImport, setLoadingImport] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customImportUrl, setCustomImportUrl] = useState('');
  const [overviewTab, setOverviewTab] = useState('metadata');
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingControlTitle, setEditingControlTitle] = useState(false);
  const [editingControlId, setEditingControlId] = useState(false);
  const [editingPropIndex, setEditingPropIndex] = useState(null);
  const [editingPropControlId, setEditingPropControlId] = useState(null);
  const [editingEnhancementId, setEditingEnhancementId] = useState(null);
  const [editingEnhancementTitle, setEditingEnhancementTitle] = useState(null);

  const lastParsedDocString = useRef('');

  const fetchVersionsList = (customStage, customDocId, currentVer) => {
    const docId = customDocId || catalogId || profileId;
    const stage = customStage || (catalogId ? 'catalogs' : 'profiles');
    if (!docId) return;
    authFetch(`/api/documents/${stage}/${docId}/versions`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch versions');
        return res.json();
      })
      .then(data => {
        setVersions(Array.isArray(data) ? data : []);
        if (currentVer) {
          setSelectedVersion(currentVer);
        } else if (rawDoc) {
          const ver = rawDoc[catalogId ? 'catalog' : 'profile']?.metadata?.version || '';
          setSelectedVersion(ver);
        }
      })
      .catch(err => console.warn('Could not fetch versions list:', err));
  };

  useEffect(() => {
    const docId = catalogId || profileId;
    const stage = catalogId ? 'catalogs' : 'profiles';
    if (!docId) return;

    setLoading(true);
    setError(null);
    authFetch(`/api/documents/${stage}/${docId}`)
      .then(res => {
        if (!res.ok) throw new Error(`${catalogId ? 'Catalog' : 'Profile'} not found: ${res.statusText}`);
        return res.json();
      })
      .then(async (data) => {
        setRawDoc(data);
        const currentVer = data[catalogId ? 'catalog' : 'profile']?.metadata?.version || '';
        setSelectedVersion(currentVer);

        const draft = localStorage.getItem(`reposol-draft-${docId}`);
        if (draft) setShowDraftPrompt(true);

        fetchVersionsList(stage, docId, currentVer);

        if (profileId) {
          try {
            const cache = await fetchImportedCatalogs(data);
            setCachedCatalogs(cache);
          } catch (err) {
            setError(`Profile resolution failed: ${err.message}`);
          }
        }
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [catalogId, profileId]);

  useEffect(() => {
    if (isEditing) {
      if (allCatalogsList.length === 0) {
        authFetch('/api/documents/catalogs')
          .then(res => res.json())
          .then(data => setAllCatalogsList(data))
          .catch(err => console.error("Error fetching catalogs list:", err));
      }
      if (!profileId && registryTemplates.length === 0) {
        authFetch('/api/import/registry')
          .then(res => res.json())
          .then(data => setRegistryTemplates(data))
          .catch(err => console.error("Error fetching registry templates:", err));
      }
    }
  }, [isEditing, profileId]);

  // Reactive Effect to fetch catalogs when imports change
  useEffect(() => {
    if (!profileId || !rawDoc?.profile?.imports) return;
    
    // Check if we need to fetch any missing catalog in rawDoc.profile.imports
    let hasMissing = false;
    for (const imp of rawDoc.profile.imports) {
      const match = imp.href.match(/([a-f0-9-]{36})/i);
      const uuid = match ? match[1]?.toLowerCase() : null;
      if (uuid && !cachedCatalogs.has(uuid)) {
        hasMissing = true;
        break;
      }
    }
    
    if (hasMissing) {
      fetchImportedCatalogs(rawDoc, new Map(cachedCatalogs)).then(newCache => {
        setCachedCatalogs(newCache);
        
        if (rawDoc?.profile) {
          updateDocumentState(doc => {
            pruneOrphanedAltersInDoc(doc, newCache);
          });
        }

        const defaultStrUuid = rawDoc?.profile?.merge?.custom?.defaultStructure;
        const currentGroups = rawDoc?.profile?.merge?.custom?.groups || [];
        if (defaultStrUuid && currentGroups.length === 0) {
          const cat = newCache.get(defaultStrUuid);
          const catalogObj = cat?.data?.catalog || cat?.catalog;
          if (catalogObj && catalogObj.groups && catalogObj.groups.length > 0) {
            updateDocumentState(doc => {
              if (doc.profile?.merge?.custom?.defaultStructure === defaultStrUuid) {
                doc.profile.merge.custom.groups = cloneGroups(catalogObj.groups);
              }
            });
          }
        }
      });
    }
  }, [rawDoc?.profile?.imports, profileId, cachedCatalogs]);

  const catalog = catalogDoc?.catalog;
  const metadata = catalog?.metadata || {};
  const rawMetadata = rawDoc?.profile?.metadata || rawDoc?.catalog?.metadata || {};

  const firstImport = rawDoc?.profile?.imports?.[0] || {};
  const includeAll = firstImport["include-all"] !== undefined;
  const includePatterns = firstImport["include-controls"]?.flatMap(ic => ic.matching?.map(m => m.pattern).filter(Boolean) || ic["with-ids"] || []) || [];
  const excludePatterns = firstImport["exclude-controls"]?.flatMap(ec => ec["matching-patterns"] || ec.matching?.map(m => m.pattern).filter(Boolean) || ec["with-ids"] || []) || [];
  const currentMergeMode = rawDoc?.profile?.merge?.flat ? 'flat' : (rawDoc?.profile?.merge?.custom ? 'custom' : 'as-is');
  const defaultStructureValue = rawDoc?.profile?.merge?.flat ? 'flat' : (rawDoc?.profile?.merge?.custom?.defaultStructure || '');

  const allCustomGroupsFlat = useMemo(() => {
    const list = [];
    const traverse = (g, depth = 0) => {
      list.push({ id: g.id, title: g.title, depth });
      if (g.groups) {
        g.groups.forEach(sub => traverse(sub, depth + 1));
      }
    };
    const groups = rawDoc?.profile?.merge?.custom?.groups || [];
    groups.forEach(g => traverse(g, 0));
    return list;
  }, [rawDoc?.profile?.merge?.custom?.groups]);



  const selectedControl = useMemo(() => {
    if (!selectedControlId || !catalogDoc?.catalog) return null;
    const findControl = (item) => {
      if (item.controls) {
        const found = item.controls.find(c => c.id.toLowerCase() === selectedControlId.toLowerCase());
        if (found) return found;
      }
      if (item.groups) {
        for (const g of item.groups) {
          const res = findControl(g);
          if (res) return res;
        }
      }
      return null;
    };
    return findControl(catalogDoc.catalog);
  }, [selectedControlId, catalogDoc]);

  const selectedGroup = useMemo(() => {
    if (!selectedGroupId || !catalogDoc) return null;
    const root = catalogDoc.catalog || catalogDoc.profile;
    const groups = root.groups || root.merge?.custom?.groups || [];
    const findGroupRec = (gList) => {
      for (const g of gList) {
        if (g.id?.toLowerCase() === selectedGroupId.toLowerCase()) return g;
        if (g.groups) {
          const f = findGroupRec(g.groups);
          if (f) return f;
        }
      }
      return null;
    };
    return findGroupRec(groups);
  }, [selectedGroupId, catalogDoc]);


  const usedTagsInfo = useMemo(() => {
    if (!catalogDoc?.catalog) return [];
    const tagsMap = new Map();
    const traverse = (item) => {
      if (item.props) {
        item.props.forEach(p => {
          if (p.name && p.name !== 'title-override' && p.name !== 'id-override') {
            if (!tagsMap.has(p.name)) {
              tagsMap.set(p.name, { name: p.name, values: new Set(), count: 0 });
            }
            const info = tagsMap.get(p.name);
            info.count += 1;
            if (p.value !== undefined && p.value !== '') {
              info.values.add(p.value);
            }
          }
        });
      }
      if (item.controls) {
        item.controls.forEach(traverse);
      }
      if (item.groups) {
        item.groups.forEach(traverse);
      }
    };
    traverse(catalogDoc.catalog);
    return Array.from(tagsMap.values()).map(info => ({
      name: info.name,
      values: Array.from(info.values).sort(),
      count: info.count
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogDoc]);

  const allCatalogPropNames = useMemo(() => {
    return usedTagsInfo.map(t => t.name);
  }, [usedTagsInfo]);

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function cloneGroups(groups) {
    if (!groups) return [];
    return groups.map(g => {
      const newG = {
        id: g.id || generateUUID().slice(0, 8),
        title: g.title || 'Untitled Group',
        groups: g.groups ? cloneGroups(g.groups) : undefined
      };
      
      const controlIds = [];
      if (g.controls) {
        g.controls.forEach(c => controlIds.push(c.id.toUpperCase()));
      }
      if (controlIds.length > 0) {
        newG['insert-controls'] = [{
          'include-controls': [{
            'with-ids': controlIds
          }]
        }];
      }
      return newG;
    });
  }

  const handleStartEditing = () => {
    setIsEditing(true);
    setHistoryState({
      history: [JSON.parse(JSON.stringify(rawDoc))],
      index: 0
    });
    if (profileId && rawDoc) {
      const resolved = resolveProfileSync(rawDoc, cachedCatalogs, true);
      setCatalogDoc(resolved);
    }
  };

  const handleSwitchEditMode = (mode) => {
    if (mode === editMode) return;
    
    if (mode === 'json') {
      const jsonStr = JSON.stringify(rawDoc, null, 2);
      setJsonText(jsonStr);
      lastParsedDocString.current = JSON.stringify(rawDoc);
      setJsonError(null);
      setSchemaValidationError(null);
      setValidationSuccess(false);
      setEditMode('json');
    } else {
      try {
        const parsed = JSON.parse(jsonText);
        
        if (profileId) {
          fetchImportedCatalogs(parsed).then(newCache => {
            setCachedCatalogs(newCache);
            
            updateDocumentState(doc => {
              Object.keys(doc).forEach(key => delete doc[key]);
              Object.assign(doc, parsed);
            });
            setJsonError(null);
            setEditMode('visual');
          }).catch(err => {
            alert(`Failed to resolve profile catalogs: ${err.message}`);
          });
        } else {
          updateDocumentState(doc => {
            Object.keys(doc).forEach(key => delete doc[key]);
            Object.assign(doc, parsed);
          });
          setJsonError(null);
          setEditMode('visual');
        }
      } catch (err) {
        setJsonError(`JSON Syntax Error: ${err.message}`);
        alert(`Cannot switch to Visual mode due to JSON syntax error:\n${err.message}`);
      }
    }
  };

  const handleJsonChange = (val) => {
    setJsonText(val);
    try {
      const parsed = JSON.parse(val);
      setJsonError(null);
      lastParsedDocString.current = JSON.stringify(parsed);
      
      setRawDoc(parsed);
      
      const docId = catalogId || profileId;
      localStorage.setItem(`reposol-draft-${docId}`, JSON.stringify(parsed));
      setAutosaved(true);
      setTimeout(() => setAutosaved(false), 2000);
    } catch (err) {
      setJsonError(err.message);
    }
  };

  const handleJsonBlur = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setHistoryState(prevState => {
        const { history, index } = prevState;
        const currentDoc = history[index];
        if (JSON.stringify(currentDoc) === JSON.stringify(parsed)) {
          return prevState;
        }
        
        const nextHistory = history.slice(0, index + 1);
        nextHistory.push(parsed);
        const nextIndex = nextHistory.length - 1;
        
        return {
          history: nextHistory,
          index: nextIndex
        };
      });
    } catch (err) {
      // ignore invalid json on blur
    }
  };

  const handleValidateOscal = async () => {
    setIsValidating(true);
    setSchemaValidationError(null);
    setValidationSuccess(false);
    try {
      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch (err) {
        throw new Error(`JSON Syntax Error: ${err.message}`);
      }
      
      const stage = catalogId ? 'catalogs' : 'profiles';
      const response = await authFetch(`/api/validate/${stage}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Validation failed.');
      }
      
      setValidationSuccess(true);
      
      setHistoryState(prevState => {
        const { history, index } = prevState;
        const currentDoc = history[index];
        if (JSON.stringify(currentDoc) === JSON.stringify(parsed)) {
          return prevState;
        }
        const nextHistory = history.slice(0, index + 1);
        nextHistory.push(parsed);
        return {
          history: nextHistory,
          index: nextHistory.length - 1
        };
      });
    } catch (err) {
      setSchemaValidationError(err.message);
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    if (editMode === 'json' && rawDoc) {
      const docStr = JSON.stringify(rawDoc);
      if (docStr !== lastParsedDocString.current) {
        setJsonText(JSON.stringify(rawDoc, null, 2));
        lastParsedDocString.current = docStr;
      }
    }
  }, [rawDoc, editMode]);

  const handleRestoreAutoDraft = () => {
    const docId = catalogId || profileId;
    const draftStr = localStorage.getItem(`reposol-draft-${docId}`);
    if (draftStr) {
      try {
        const draftDoc = JSON.parse(draftStr);
        setRawDoc(draftDoc);
        setHistoryState({
          history: [draftDoc],
          index: 0
        });
        setIsEditing(true);
        
        if (profileId) {
          fetchImportedCatalogs(draftDoc).then(cache => {
            setCachedCatalogs(cache);
          });
        }
      } catch (err) {
        console.error("Failed to restore draft:", err);
      }
    }
    setShowDraftPrompt(false);
  };

  const handleDiscardDraft = () => {
    const docId = catalogId || profileId;
    localStorage.removeItem(`reposol-draft-${docId}`);
    setShowDraftPrompt(false);
  };

  const pruneOrphanedAltersInDoc = (doc, cache) => {
    if (!doc?.profile?.modify?.alters || doc.profile.modify.alters.length === 0) return false;

    const validIds = new Set();
    const localControls = doc.profile["local-controls"] || [];
    const collectLocalCtrls = (ctrls) => {
      for (const c of ctrls) {
        if (c?.id) validIds.add(c.id.toLowerCase());
        if (c?.controls) collectLocalCtrls(c.controls);
      }
    };
    collectLocalCtrls(localControls);

    const imports = doc.profile.imports || [];
    let hasPendingCatalog = false;

    for (const imp of imports) {
      const match = imp.href?.match(/([a-f0-9-]{36})/i);
      const catUuid = match ? match[1]?.toLowerCase() : null;
      if (catUuid) {
        const catEntry = cache?.get?.(catUuid);
        const catObj = catEntry?.data?.catalog || catEntry?.catalog;
        if (catObj) {
          const collectCatCtrls = (ctrls) => {
            for (const c of ctrls) {
              if (c?.id) validIds.add(c.id.toLowerCase());
              if (c?.controls) collectCatCtrls(c.controls);
            }
          };
          if (catObj.controls) collectCatCtrls(catObj.controls);

          const collectGroups = (grps) => {
            for (const g of grps) {
              if (g?.controls) collectCatCtrls(g.controls);
              if (g?.groups) collectGroups(g.groups);
            }
          };
          if (catObj.groups) collectGroups(catObj.groups);
        } else {
          hasPendingCatalog = true;
        }
      }
    }

    if (hasPendingCatalog && validIds.size === 0) return false;

    const initialCount = doc.profile.modify.alters.length;
    doc.profile.modify.alters = doc.profile.modify.alters.filter(alt => {
      const cid = alt["control-id"];
      if (!cid) return false;
      return validIds.has(cid.toLowerCase());
    });

    if (doc.profile.modify.alters.length === 0) {
      delete doc.profile.modify.alters;
      if (doc.profile.modify && Object.keys(doc.profile.modify).length === 0) {
        delete doc.profile.modify;
      }
    }

    return (doc.profile?.modify?.alters?.length || 0) !== initialCount;
  };

  const updateDocumentState = (updater) => {
    setHistoryState(prevState => {
      const { history, index } = prevState;
      const currentDoc = history[index] || JSON.parse(JSON.stringify(rawDoc));
      if (!currentDoc) return prevState;
      
      const nextDoc = JSON.parse(JSON.stringify(currentDoc));
      updater(nextDoc);

      if (nextDoc?.profile) {
        pruneOrphanedAltersInDoc(nextDoc, cachedCatalogs);
      }

      
      const nextHistory = history.slice(0, index + 1);
      nextHistory.push(nextDoc);
      const nextIndex = nextHistory.length - 1;
      
      setRawDoc(nextDoc);

      const docId = catalogId || profileId;
      localStorage.setItem(`reposol-draft-${docId}`, JSON.stringify(nextDoc));
      setAutosaved(true);
      
      return {
        history: nextHistory,
        index: nextIndex
      };
    });
    setTimeout(() => setAutosaved(false), 2000);
  };

  const handleImportCatalogContent = async (templateId, customUrl) => {
    setLoadingImport(true);
    setError(null);
    try {
      let docUuid = '';
      if (templateId) {
        const importRes = await authFetch(`/api/import/registry/${templateId}`, { method: 'POST' });
        if (!importRes.ok) {
          const errData = await importRes.json();
          throw new Error(errData.detail || 'Import from registry failed');
        }
        const importData = await importRes.json();
        docUuid = importData.uuid;
      } else if (customUrl) {
        const importRes = await authFetch('/api/import/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: customUrl, validate_schema: true })
        });
        if (!importRes.ok) {
          const errData = await importRes.json();
          throw new Error(errData.detail || 'Import from URL failed');
        }
        const importData = await importRes.json();
        docUuid = importData.uuid;
      } else {
        return;
      }

      if (!docUuid) {
        throw new Error('No document UUID returned after import');
      }

      const docRes = await authFetch(`/api/documents/catalogs/${docUuid}`);
      if (!docRes.ok) {
        throw new Error('Failed to fetch imported catalog details');
      }
      const importedDoc = await docRes.json();
      if (!importedDoc || !importedDoc.catalog) {
        throw new Error('Invalid catalog structure imported');
      }

      const originalUuid = rawDoc.catalog.uuid;
      const importedVersion = importedDoc.catalog.metadata?.version || '1.0.0';
      const stage = 'catalogs';

      const newDoc = {
        catalog: {
          ...importedDoc.catalog,
          uuid: originalUuid,
        }
      };

      if (!newDoc.catalog.metadata) newDoc.catalog.metadata = {};
      if (!newDoc.catalog.metadata.revisions) newDoc.catalog.metadata.revisions = [];
      newDoc.catalog.metadata.revisions.push({
        title: `Version ${importedVersion}`,
        published: new Date().toISOString(),
        "last-modified": new Date().toISOString(),
        version: importedVersion,
        remarks: 'Imported from Registry Template / URL'
      });

      const response = await authFetch(`/api/documents/${stage}/${originalUuid}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDoc)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to save imported version.');
      }

      localStorage.removeItem(`reposol-draft-${originalUuid}`);

      setIsEditing(false);
      setEditMode('visual');
      setJsonError(null);
      setSchemaValidationError(null);
      setValidationSuccess(false);
      setHistoryState({ history: [], index: 0 });
      setChangeLog([]);

      setRawDoc(newDoc);
      setSelectedVersion(importedVersion);
      fetchVersionsList(stage, originalUuid, importedVersion);

      setSelectedTemplateId('');
      setCustomImportUrl('');
    } catch (err) {
      console.error(err);
      setError(`Catalog import failed: ${err.message}`);
    } finally {
      setLoadingImport(false);
    }
  };

  const renderCatalogImportTab = () => {
    return (
      <div style={{ paddingTop: '8px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          📥 Import Catalog Content / Load Template
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '20px', lineHeight: '1.4' }}>
          Import control content and structures directly into this catalog.
          <span style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}> WARNING:</span> This will overwrite all current groups and controls of this catalog.
          The UUID and title of this document will be preserved.
        </p>

        <div className="edit-form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label" style={{ fontWeight: '600', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
            A: Start from Registry Template / Load from Template
          </label>
          <select
            className="form-input"
            style={{ width: '100%', padding: '8px', fontSize: '13px', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '6px' }}
            value={selectedTemplateId}
            onChange={(e) => {
              setSelectedTemplateId(e.target.value);
              if (e.target.value) setCustomImportUrl('');
            }}
            disabled={loadingImport}
          >
            <option value="">-- Choose a registry template --</option>
            {registryTemplates.filter(t => t.model === 'catalog').map(t => (
              <option key={t.id} value={t.id}>{t.title} ({t.source})</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }}></div>
          <span>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }}></div>
        </div>

        <div className="edit-form-group" style={{ marginBottom: '24px' }}>
          <label className="form-label" style={{ fontWeight: '600', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
            B: Import from Web URL / Load Web JSON
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="https://raw.githubusercontent.com/.../catalog.json"
            value={customImportUrl}
            onChange={(e) => {
              setCustomImportUrl(e.target.value);
              if (e.target.value) setSelectedTemplateId('');
            }}
            style={{ width: '100%', padding: '8px', fontSize: '13px' }}
            disabled={loadingImport}
          />
        </div>

        <button
          type="button"
          className="btn-primary"
          style={{ width: '100%', padding: '10px', fontSize: '13px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
          disabled={loadingImport || (!selectedTemplateId && !customImportUrl.trim())}
          onClick={() => {
            if (confirm("Would you like to import the selected source and overwrite the current groups and controls of this catalog?")) {
              handleImportCatalogContent(selectedTemplateId, customImportUrl);
            }
          }}
        >
          {loadingImport ? '⏳ Importing content...' : '🚀 Import & Initialize Catalog'}
        </button>
      </div>
    );
  };

  const handleMetadataChange = (key, value) => {
    updateDocumentState(doc => {
      const root = doc.catalog || doc.profile;
      if (root) {
        if (!root.metadata) root.metadata = {};
        root.metadata[key] = value;
      }
    });
  };

  const handleUpdateMetadataArray = (field, index, subkey, val) => {
    updateDocumentState(doc => {
      const root = doc.catalog || doc.profile;
      if (root) {
        if (!root.metadata) root.metadata = {};
        if (!root.metadata[field]) root.metadata[field] = [];
        const item = root.metadata[field][index];
        if (item) {
          if (subkey === null) {
            root.metadata[field][index] = val;
          } else {
            item[subkey] = val;
          }
        }
      }
    });
  };

  const handleAddMetadataArrayItem = (field, defaultVal) => {
    updateDocumentState(doc => {
      const root = doc.catalog || doc.profile;
      if (root) {
        if (!root.metadata) root.metadata = {};
        if (!root.metadata[field]) root.metadata[field] = [];
        root.metadata[field].push(defaultVal);
      }
    });
  };

  const handleDeleteMetadataArrayItem = (field, index) => {
    updateDocumentState(doc => {
      const root = doc.catalog || doc.profile;
      if (root && root.metadata && root.metadata[field]) {
        root.metadata[field].splice(index, 1);
      }
    });
  };

  const handleUpdateResource = (index, subkey, val) => {
    updateDocumentState(doc => {
      const root = doc.catalog || doc.profile;
      if (root) {
        if (!root['back-matter']) root['back-matter'] = {};
        if (!root['back-matter'].resources) root['back-matter'].resources = [];
        const res = root['back-matter'].resources[index];
        if (res) {
          res[subkey] = val;
        }
      }
    });
  };

  const handleAddResource = () => {
    updateDocumentState(doc => {
      const root = doc.catalog || doc.profile;
      if (root) {
        if (!root['back-matter']) root['back-matter'] = {};
        if (!root['back-matter'].resources) root['back-matter'].resources = [];
        root['back-matter'].resources.push({
          uuid: generateUUID(),
          title: 'New Resource',
          description: '',
          citation: { text: '' },
          rlinks: []
        });
      }
    });
  };

  const handleDeleteResource = (index) => {
    updateDocumentState(doc => {
      const root = doc.catalog || doc.profile;
      if (root && root['back-matter'] && root['back-matter'].resources) {
        root['back-matter'].resources.splice(index, 1);
      }
    });
  };

  const handleUpdateGroupMetadata = (groupId, field, newValue) => {
    updateDocumentState(doc => {
      const root = doc.catalog || doc.profile;
      const groups = root.groups || root.merge?.custom?.groups || [];
      const findAndMutate = (gList) => {
        for (let i = 0; i < gList.length; i++) {
          if (gList[i].id?.toLowerCase() === groupId.toLowerCase()) {
            gList[i][field] = newValue;
            return true;
          }
          if (gList[i].groups && findAndMutate(gList[i].groups)) {
            return true;
          }
        }
        return false;
      };
      findAndMutate(groups);
    });
  };

  const handleUpdateGroupProps = (groupId, index, field, value) => {
    updateDocumentState(doc => {
      const root = doc.catalog || doc.profile;
      const groups = root.groups || root.merge?.custom?.groups || [];
      const findAndMutate = (gList) => {
        for (let i = 0; i < gList.length; i++) {
          if (gList[i].id?.toLowerCase() === groupId.toLowerCase()) {
            if (!gList[i].props) gList[i].props = [];
            if (field === null) {
              gList[i].props.splice(index, 1);
            } else if (index === -1) {
              gList[i].props.push({ name: 'new-prop', value: '' });
            } else {
              gList[i].props[index][field] = value;
            }
            return true;
          }
          if (gList[i].groups && findAndMutate(gList[i].groups)) {
            return true;
          }
        }
        return false;
      };
      findAndMutate(groups);
    });
  };

  const handleUpdateGroupLinks = (groupId, index, field, value) => {
    updateDocumentState(doc => {
      const root = doc.catalog || doc.profile;
      const groups = root.groups || root.merge?.custom?.groups || [];
      const findAndMutate = (gList) => {
        for (let i = 0; i < gList.length; i++) {
          if (gList[i].id?.toLowerCase() === groupId.toLowerCase()) {
            if (!gList[i].links) gList[i].links = [];
            if (field === null) {
              gList[i].links.splice(index, 1);
            } else if (index === -1) {
              gList[i].links.push({ href: '', text: '', rel: 'reference' });
            } else {
              gList[i].links[index][field] = value;
            }
            return true;
          }
          if (gList[i].groups && findAndMutate(gList[i].groups)) {
            return true;
          }
        }
        return false;
      };
      findAndMutate(groups);
    });
  };

  const handleUpdateGroupParts = (groupId, index, field, value) => {
    updateDocumentState(doc => {
      const root = doc.catalog || doc.profile;
      const groups = root.groups || root.merge?.custom?.groups || [];
      const findAndMutate = (gList) => {
        for (let i = 0; i < gList.length; i++) {
          if (gList[i].id?.toLowerCase() === groupId.toLowerCase()) {
            if (!gList[i].parts) gList[i].parts = [];
            if (field === null) {
              gList[i].parts.splice(index, 1);
            } else if (index === -1) {
              gList[i].parts.push({ id: `part-${generateUUID().slice(0, 4)}`, name: 'description', prose: '' });
            } else {
              gList[i].parts[index][field] = value;
            }
            return true;
          }
          if (gList[i].groups && findAndMutate(gList[i].groups)) {
            return true;
          }
        }
        return false;
      };
      findAndMutate(groups);
    });
  };

  const handleUpdateControlLinks = (resolvedId, index, field, value) => {
    const originalId = getOriginalControlId(resolvedId);
    if (!originalId) return;

    updateDocumentState(doc => {
      if (doc.catalog) {
        const mutateCatalog = (item) => {
          if (item.id?.toLowerCase() === originalId.toLowerCase()) {
            if (!item.links) item.links = [];
            if (field === null) {
              item.links.splice(index, 1);
            } else if (index === -1) {
              item.links.push({ href: '', text: '', rel: 'reference' });
            } else {
              item.links[index][field] = value;
            }
            return true;
          }
          if (item.controls) {
            for (const c of item.controls) {
              if (mutateCatalog(c)) return true;
            }
          }
          if (item.groups) {
            for (const g of item.groups) {
              if (mutateCatalog(g)) return true;
            }
          }
          return false;
        };
        mutateCatalog(doc.catalog);
      } else if (doc.profile) {
        const locals = doc.profile.modify?.["local-controls"] || [];
        const lc = locals.find(x => x.id?.toLowerCase() === originalId.toLowerCase());
        if (lc) {
          if (!lc.links) lc.links = [];
          if (field === null) {
            lc.links.splice(index, 1);
          } else if (index === -1) {
            lc.links.push({ href: '', text: '', rel: 'reference' });
          } else {
            lc.links[index][field] = value;
          }
          return;
        }

        if (!doc.profile.modify) doc.profile.modify = {};
        if (!doc.profile.modify.alters) doc.profile.modify.alters = [];
        const alters = doc.profile.modify.alters;
        let alter = alters.find(a => a["control-id"]?.toLowerCase() === originalId.toLowerCase());
        if (!alter) {
          alter = { "control-id": originalId, adds: [] };
          alters.push(alter);
        }
        if (!alter.adds) alter.adds = [];
        let addBlock = alter.adds.find(add => add.links);
        if (!addBlock) {
          addBlock = { links: [] };
          alter.adds.push(addBlock);
        }
        if (field === null) {
          addBlock.links.splice(index, 1);
        } else if (index === -1) {
          addBlock.links.push({ href: '', text: '', rel: 'reference' });
        } else {
          addBlock.links[index][field] = value;
        }
      }
    });
  };




  const handleCreateGlobalProperty = () => {
    updateDocumentState(doc => {
      const root = doc.catalog || doc.profile;
      if (root) {
        if (!root.metadata) root.metadata = {};
        if (!root.metadata.props) root.metadata.props = [];
        root.metadata.props.push({ name: 'custom-tag', value: 'value' });
      }
    });
  };

  const handleUpdateGlobalProperty = (index, field, value) => {
    updateDocumentState(doc => {
      const root = doc.catalog || doc.profile;
      if (root && root.metadata && root.metadata.props && root.metadata.props[index]) {
        root.metadata.props[index][field] = value;
      }
    });
  };

  const handleDeleteGlobalProperty = (index) => {
    updateDocumentState(doc => {
      const root = doc.catalog || doc.profile;
      if (root && root.metadata && root.metadata.props) {
        root.metadata.props.splice(index, 1);
      }
    });
  };

  const handleAddExistingTagToGlobal = (tagName, defaultValue = '') => {
    updateDocumentState(doc => {
      const root = doc.catalog || doc.profile;
      if (root) {
        if (!root.metadata) root.metadata = {};
        if (!root.metadata.props) root.metadata.props = [];
        const alreadyExists = root.metadata.props.some(p => p.name === tagName);
        if (!alreadyExists) {
          root.metadata.props.push({ name: tagName, value: defaultValue });
        }
      }
    });
  };

  const handleCreateParam = (controlId) => {
    updateDocumentState(doc => {
      if (doc.catalog) {
        const findAndAdd = (item) => {
          if (item.id?.toLowerCase() === controlId.toLowerCase()) {
            if (!item.params) item.params = [];
            const suffix = item.params.length + 1;
            item.params.push({
              id: `${item.id}_prm_${suffix}`,
              label: 'New parameter',
              values: []
            });
            return true;
          }
          if (item.controls) {
            for (const sub of item.controls) {
              if (findAndAdd(sub)) return true;
            }
          }
          if (item.groups) {
            for (const g of item.groups) {
              if (findAndAdd(g)) return true;
            }
          }
          return false;
        };
        findAndAdd(doc.catalog);
      }
    });
  };

  const handleDeleteParam = (controlId, paramId) => {
    updateDocumentState(doc => {
      if (doc.catalog) {
        const findAndDelete = (item) => {
          if (item.id?.toLowerCase() === controlId.toLowerCase()) {
            if (item.params) {
              item.params = item.params.filter(p => p.id.toLowerCase() !== paramId.toLowerCase());
            }
            return true;
          }
          if (item.controls) {
            for (const sub of item.controls) {
              if (findAndDelete(sub)) return true;
            }
          }
          if (item.groups) {
            for (const g of item.groups) {
              if (findAndDelete(g)) return true;
            }
          }
          return false;
        };
        findAndDelete(doc.catalog);
      }
    });
  };

  const handleParamChange = (paramId, field, value) => {
    updateDocumentState(doc => {
      if (doc.catalog) {
        const findAndUpdate = (item) => {
          if (item.params) {
            const p = item.params.find(x => x.id.toLowerCase() === paramId.toLowerCase());
            if (p) {
              if (field === 'values') {
                p.values = value.split(',').map(s => s.trim()).filter(Boolean);
              } else if (field === 'choices') {
                const choiceList = value.split(',').map(s => s.trim()).filter(Boolean);
                if (choiceList.length > 0) {
                  p.select = {
                    'how-many': p.select?.['how-many'] || 'one',
                    choice: choiceList
                  };
                } else {
                  delete p.select;
                }
              } else if (field === 'pattern') {
                if (value.trim()) {
                  p.constraints = [
                    {
                      description: 'Muster-Validierung',
                      tests: [
                        {
                          expression: value.trim(),
                          remarks: 'regex'
                        }
                      ]
                    }
                  ];
                } else {
                  delete p.constraints;
                }
              } else {
                p[field] = value;
              }
              return true;
            }
          }
          if (item.controls) {
            for (const sub of item.controls) {
              if (findAndUpdate(sub)) return true;
            }
          }
          if (item.groups) {
            for (const g of item.groups) {
              if (findAndUpdate(g)) return true;
            }
          }
          return false;
        };
        findAndUpdate(doc.catalog);
      } else if (doc.profile) {
        if (!doc.profile.modify) doc.profile.modify = {};
        if (!doc.profile.modify["set-parameters"]) doc.profile.modify["set-parameters"] = [];
        
        let p = doc.profile.modify["set-parameters"].find(x => x["param-id"].toLowerCase() === paramId.toLowerCase());
        if (!p) {
          p = { "param-id": paramId };
          doc.profile.modify["set-parameters"].push(p);
        }
        
        if (field === 'values') {
          p.values = value.split(',').map(s => s.trim()).filter(Boolean);
        } else {
          p[field] = value;
        }
      }
    });
  };

  const handlePartProseChange = (controlId, partId, value) => {
    updateDocumentState(doc => {
      if (doc.catalog) {
        const findAndUpdate = (item) => {
          if (item.id && item.id.toLowerCase() === controlId.toLowerCase()) {
            if (item.parts) {
              const findPart = (partsList) => {
                for (const p of partsList) {
                  if (p.id === partId) return p;
                  if (p.parts) {
                    const found = findPart(p.parts);
                    if (found) return found;
                  }
                }
                return null;
              };
              const part = findPart(item.parts);
              if (part) {
                part.prose = value;
                return true;
              } else {
                const name = (partId.includes('statement') || partId.includes('smt')) ? 'statement' : partId.includes('gdn') ? 'guidance' : 'discussion';
                item.parts.push({
                  id: partId,
                  name: name,
                  prose: value
                });
                return true;
              }
            }
          }
          if (item.controls) {
            for (const sub of item.controls) {
              if (findAndUpdate(sub)) return true;
            }
          }
          if (item.groups) {
            for (const g of item.groups) {
              if (findAndUpdate(g)) return true;
            }
          }
          return false;
        };
        findAndUpdate(doc.catalog);
      } else if (doc.profile) {
        if (!doc.profile.modify) doc.profile.modify = {};
        if (!doc.profile.modify.alters) doc.profile.modify.alters = [];
        
        let alter = doc.profile.modify.alters.find(x => x["control-id"].toLowerCase() === controlId.toLowerCase());
        if (!alter) {
          alter = { "control-id": controlId, "adds": [], "removes": [] };
          doc.profile.modify.alters.push(alter);
        }
        if (!alter.adds) alter.adds = [];
        if (!alter.removes) alter.removes = [];
        
        const originalPartId = partId.endsWith('_modified') ? partId.substring(0, partId.length - 9) : partId;
        
        let add = alter.adds.find(x => x.parts && x.parts.some(p => p.id === originalPartId || p.id === `${originalPartId}_modified`));
        if (!add) {
          add = {
            "position": "before",
            "by-id": originalPartId,
            "parts": [
              {
                "id": `${originalPartId}_modified`,
                "name": (originalPartId.includes('statement') || originalPartId.includes('smt')) ? 'statement' : originalPartId.includes('gdn') ? 'guidance' : 'discussion',
                "prose": value
              }
            ]
          };
          alter.adds.push(add);
        } else {
          const part = add.parts.find(p => p.id === originalPartId || p.id === `${originalPartId}_modified`);
          if (part) {
            part.prose = value;
          }
        }
        
        if (!alter.removes.some(r => r["by-id"] === originalPartId)) {
          alter.removes.push({ "by-id": originalPartId });
        }
      }
    });
  };

  const isPartModified = (ctrlId, partId) => {
    if (!profileId || !rawDoc || !rawDoc.profile) return false;
    const alters = rawDoc.profile.modify?.alters || [];
    const alter = alters.find(x => x["control-id"].toLowerCase() === ctrlId.toLowerCase());
    if (!alter) return false;
    return (alter.adds || []).some(add => add.parts && add.parts.some(p => p.id === partId || p.id === `${partId}_modified`));
  };

  const handleRevertPart = (ctrlId, partId) => {
    updateDocumentState(doc => {
      const alters = doc.profile?.modify?.alters || [];
      const alterIdx = alters.findIndex(x => x["control-id"].toLowerCase() === ctrlId.toLowerCase());
      if (alterIdx < 0) return;
      
      const alter = alters[alterIdx];
      if (alter.adds) {
        alter.adds = alter.adds.map(add => {
          if (add.parts) {
            add.parts = add.parts.filter(p => p.id !== partId && p.id !== `${partId}_modified`);
          }
          return add;
        }).filter(add => !add.parts || add.parts.length > 0);
      }
      if (alter.removes) {
        alter.removes = alter.removes.filter(r => r["by-id"] !== partId);
      }
      
      if ((!alter.adds || alter.adds.length === 0) && (!alter.removes || alter.removes.length === 0)) {
        alters.splice(alterIdx, 1);
      }
    });
  };

  const isControlActiveInDoc = (controlId) => {
    if (!rawDoc || !rawDoc.profile) return false;
    const profile = rawDoc.profile;
    
    const ctrlIdLower = controlId.toLowerCase();
    let targetImport = null;
    
    for (const imp of (profile.imports || [])) {
      const match = imp.href.match(/([a-f0-9-]{36})/i);
      const uuid = match ? match[1]?.toLowerCase() : null;
      if (!uuid || !cachedCatalogs.has(uuid)) continue;
      
      const cat = cachedCatalogs.get(uuid);
      const realDoc = cat.data || cat;
      const catalogObj = realDoc.catalog;
      
      const hasControl = (item) => {
        if (item.controls) {
          if (item.controls.some(c => c.id.toLowerCase() === ctrlIdLower)) return true;
          for (const sub of item.controls) {
            if (hasControl(sub)) return true;
          }
        }
        if (item.groups) {
          for (const g of item.groups) {
            if (hasControl(g)) return true;
          }
        }
        return false;
      };
      
      if (catalogObj && hasControl(catalogObj)) {
        targetImport = imp;
        break;
      }
    }
    
    const imp = targetImport || (profile.imports || [])[0];
    if (!imp) return false;

    const controlIdLower = controlId.toLowerCase();
    const includeAll = imp["include-all"] !== undefined;
    const includedIds = new Set((imp["include-controls"] || []).flatMap(ic => (ic["with-ids"] || []).map(id => id.toLowerCase())));
    const includePatterns = (imp["include-controls"] || []).flatMap(ic => (ic["matching"] || []).map(m => m.pattern).filter(Boolean));
    const excludedIds = new Set((imp["exclude-controls"] || []).flatMap(ec => (ec["with-ids"] || []).map(id => id.toLowerCase())));
    
    const matchesAnyPattern = (cid, patterns) => {
      if (!patterns || patterns.length === 0) return false;
      const cidLower = cid.toLowerCase();
      return patterns.some(pat => {
        const regexStr = '^' + pat.toLowerCase().replace(/\*/g, '.*') + '$';
        try {
          return new RegExp(regexStr).test(cidLower);
        } catch (e) {
          return false;
        }
      });
    };
    const excludePatterns = (imp["exclude-controls"] || []).flatMap(ec => {
      const directPatterns = ec["matching-patterns"] || [];
      const matchingObjs = (ec["matching"] || []).map(m => m.pattern).filter(Boolean);
      return [...directPatterns, ...matchingObjs];
    });

    const hasInclusions = includedIds.size > 0 || includePatterns.length > 0;
    const isIncluded = includeAll || !hasInclusions || includedIds.has(controlIdLower) || matchesAnyPattern(controlId, includePatterns);
    const isExcluded = excludedIds.has(controlIdLower) || matchesAnyPattern(controlId, excludePatterns);
    
    return isIncluded && !isExcluded;
  };

  const handleToggleControlSelection = (controlId, checked) => {
    updateDocumentState(doc => {
      const profile = doc.profile;
      if (!profile) return;
      
      const ctrlIdLower = controlId.toLowerCase();
      let targetImport = null;
      
      for (const imp of (profile.imports || [])) {
        const match = imp.href.match(/([a-f0-9-]{36})/i);
        const uuid = match ? match[1]?.toLowerCase() : null;
        if (!uuid || !cachedCatalogs.has(uuid)) continue;
        
        const cat = cachedCatalogs.get(uuid);
        const realDoc = cat.data || cat;
        const catalogObj = realDoc.catalog;
        
        const hasControl = (item) => {
          if (item.controls) {
            if (item.controls.some(c => c.id.toLowerCase() === ctrlIdLower)) return true;
            for (const sub of item.controls) {
              if (hasControl(sub)) return true;
            }
          }
          if (item.groups) {
            for (const g of item.groups) {
              if (hasControl(g)) return true;
            }
          }
          return false;
        };
        
        if (catalogObj && hasControl(catalogObj)) {
          targetImport = imp;
          break;
        }
      }
      
      const imp = targetImport || (profile.imports || [])[0];
      if (!imp) return;
      
      const ctrlIdUpper = controlId.toUpperCase();
      
      if (checked) {
        if (imp["exclude-controls"]) {
          imp["exclude-controls"] = imp["exclude-controls"].map(ec => {
            if (ec["with-ids"]) {
              ec["with-ids"] = ec["with-ids"].filter(id => id.toUpperCase() !== ctrlIdUpper && id.toLowerCase() !== ctrlIdLower);
            }
            return ec;
          }).filter(ec => !ec["with-ids"] || ec["with-ids"].length > 0);
          if (imp["exclude-controls"].length === 0) {
            delete imp["exclude-controls"];
          }
        }
        if (imp["include-all"] === undefined) {
          if (!imp["include-controls"]) {
            imp["include-controls"] = [{ "with-ids": [] }];
          }
          const ic = imp["include-controls"][0];
          if (!ic["with-ids"]) ic["with-ids"] = [];
          if (!ic["with-ids"].some(id => id.toUpperCase() === ctrlIdUpper || id.toLowerCase() === ctrlIdLower)) {
            ic["with-ids"].push(ctrlIdUpper);
          }
        }
        
      } else {
        if (imp["include-all"] !== undefined) {
          if (!imp["exclude-controls"]) {
            imp["exclude-controls"] = [{ "with-ids": [] }];
          }
          const ec = imp["exclude-controls"][0];
          if (!ec["with-ids"]) ec["with-ids"] = [];
          if (!ec["with-ids"].some(id => id.toUpperCase() === ctrlIdUpper || id.toLowerCase() === ctrlIdLower)) {
            ec["with-ids"].push(ctrlIdUpper);
          }
        } else {
          if (imp["include-controls"]) {
            imp["include-controls"] = imp["include-controls"].map(ic => {
              if (ic["with-ids"]) {
                ic["with-ids"] = ic["with-ids"].filter(id => id.toUpperCase() !== ctrlIdUpper && id.toLowerCase() !== ctrlIdLower);
              }
              return ic;
            }).filter(ic => ic["with-ids"] && ic["with-ids"].length > 0);
            if (imp["include-controls"].length === 0) {
              delete imp["include-controls"];
            }
          }
        }
      }
    });
  };

  const handleUndo = () => {
    setHistoryState(prevState => {
      const { history, index } = prevState;
      console.log("Undo action: current index =", index, "history length =", history.length);
      if (index > 0) {
        const nextIndex = index - 1;
        const nextDoc = history[nextIndex];
        setRawDoc(nextDoc);
        localStorage.setItem(`reposol-draft-${catalogId || profileId}`, JSON.stringify(nextDoc));
        return { history, index: nextIndex };
      }
      return prevState;
    });
  };

  const handleRedo = () => {
    setHistoryState(prevState => {
      const { history, index } = prevState;
      console.log("Redo action: current index =", index, "history length =", history.length);
      if (index < history.length - 1) {
        const nextIndex = index + 1;
        const nextDoc = history[nextIndex];
        setRawDoc(nextDoc);
        localStorage.setItem(`reposol-draft-${catalogId || profileId}`, JSON.stringify(nextDoc));
        return { history, index: nextIndex };
      }
      return prevState;
    });
  };

  const handleCancel = () => {
    if (window.confirm("Discard all unsaved changes?")) {
      localStorage.removeItem(`reposol-draft-${catalogId || profileId}`);
      setIsEditing(false);
      setEditMode('visual');
      setJsonError(null);
      setSchemaValidationError(null);
      setValidationSuccess(false);
      setHistoryState({ history: [], index: 0 });
      setChangeLog([]);
      
      setLoading(true);
      const fetchUrl = catalogId ? `/api/documents/catalogs/${catalogId}` : `/api/documents/profiles/${profileId}`;
      authFetch(fetchUrl)
        .then(res => res.json())
        .then(async (data) => {
          setRawDoc(data);
          if (!catalogId) {
            const cache = await fetchImportedCatalogs(data);
            setCachedCatalogs(cache);
          }
        })
        .finally(() => setLoading(false));
    }
  };

  const handleExitEdit = () => {
    setIsEditing(false);
    setEditMode('visual');
    setJsonError(null);
    setSchemaValidationError(null);
    setValidationSuccess(false);
    setHistoryState({ history: [], index: 0 });
    setChangeLog([]);
    
    setLoading(true);
    const fetchUrl = catalogId ? `/api/documents/catalogs/${catalogId}` : `/api/documents/profiles/${profileId}`;
    authFetch(fetchUrl)
      .then(res => res.json())
      .then(async (data) => {
        setRawDoc(data);
        if (!catalogId) {
          const cache = await fetchImportedCatalogs(data);
          setCachedCatalogs(cache);
        }
      })
      .finally(() => setLoading(false));
  };


  /**
   * Opens the draft-save modal so the user can add a remark.
   * The actual snapshot is created in handleConfirmSaveDraft.
   */
  const handleOpenSaveVersionModal = () => {
    const rootKey = catalogId ? 'catalog' : 'profile';
    const ver = rawDoc[rootKey]?.metadata?.version || '1.0.0';
    setSaveVersionNumber(ver);
    setDraftRemark('');
    setShowDraftSaveModal(true);
  };

  const handleConfirmSaveVersion = async () => {
    setSaving(true);
    setError(null);
    const docId = catalogId || profileId;
    try {
      let docToSave = rawDoc;
      if (editMode === 'json') {
        try {
          docToSave = JSON.parse(jsonText);
        } catch (err) {
          throw new Error(`JSON Syntax Error: ${err.message}`);
        }
      }
      
      const nextDoc = JSON.parse(JSON.stringify(docToSave));
      const stage = catalogId ? 'catalogs' : 'profiles';
      const rootKey = catalogId ? 'catalog' : 'profile';
      const root = nextDoc[rootKey];
      
      const oldVersion = root.metadata?.version || '1.0.0';
      const targetVersion = saveVersionNumber.trim() || oldVersion;
      
      if (!root.metadata) root.metadata = {};
      root.metadata.version = targetVersion;
      root.metadata['last-modified'] = new Date().toISOString();
      
      if (!root.metadata.revisions) root.metadata.revisions = [];
      root.metadata.revisions.push({
        title: `Version ${targetVersion}`,
        published: new Date().toISOString(),
        "last-modified": new Date().toISOString(),
        version: targetVersion,
        remarks: draftRemark || 'Version saved'
      });
      
      const response = await authFetch(`/api/documents/${stage}/${docId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextDoc)
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to save version.');
      }
      
      localStorage.removeItem(`reposol-draft-${docId}`);
      
      setIsEditing(false);
      setEditMode('visual');
      setJsonError(null);
      setSchemaValidationError(null);
      setValidationSuccess(false);
      setHistoryState({ history: [], index: 0 });
      setChangeLog([]);
      setShowDraftSaveModal(false);
      
      setRawDoc(nextDoc);
      setSelectedVersion(targetVersion);
      fetchVersionsList(stage, docId, targetVersion);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleVersionChange = async (verStr) => {
    if (!verStr) return;
    const docId = catalogId || profileId;
    const stage = catalogId ? 'catalogs' : 'profiles';
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/api/documents/${stage}/${docId}/versions/${verStr}`);
      if (!response.ok) throw new Error('Failed to load version');
      const data = await response.json();
      setRawDoc(data);
      setSelectedVersion(verStr);
      
      setActiveHistoryIndex(null);
      setHistoryState({ history: [data], index: 0 });
      
      if (profileId) {
        const cache = await fetchImportedCatalogs(data);
        setCachedCatalogs(cache);
      }
    } catch (e) {
      setError(`Failed to load version: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVersion = async (verStr) => {
    if (!window.confirm(`Are you sure you want to delete version ${verStr}?`)) {
      return;
    }
    const docId = catalogId || profileId;
    const stage = catalogId ? 'catalogs' : 'profiles';
    try {
      const response = await authFetch(`/api/documents/${stage}/${docId}/versions/${verStr}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Error deleting version');
      }
      
      // Reload the versions list
      fetchVersionsList(stage, docId, selectedVersion);
      
      // If we just deleted the loaded version, switch back to the main document version
      if (selectedVersion === verStr) {
        const mainVer = rawDoc[catalogId ? 'catalog' : 'profile']?.metadata?.version || '';
        setSelectedVersion(mainVer);
        const docRes = await authFetch(`/api/documents/${stage}/${docId}`);
        if (docRes.ok) {
          const docData = await docRes.json();
          setRawDoc(docData);
        }
      }
    } catch (err) {
      alert(`Error deleting version: ${err.message}`);
    }
  };

  const handleRestoreDraft = async (entry, idx) => {
    if (!entry.snapshot) {
      alert('This entry contains no snapshot and cannot be restored.');
      return;
    }
    const restored = JSON.parse(JSON.stringify(entry.snapshot));
    setRawDoc(restored);
    setActiveHistoryIndex(idx);
    setHistoryState({ history: [restored], index: 0 });
    if (profileId) {
      try {
        const cache = await fetchImportedCatalogs(restored);
        setCachedCatalogs(cache);
      } catch (e) {
        console.error('Could not fetch cache after restore:', e);
      }
    }
    if (!isEditing) setIsEditing(true);
  };

  const handleCopyDocument = async () => {
    if (!rawDoc) return;
    const newUuid = generateUUID();
    const copy = JSON.parse(JSON.stringify(rawDoc));
    const stage = catalogId ? 'catalogs' : 'profiles';
    const rootKey = catalogId ? 'catalog' : 'profile';
    copy[rootKey].uuid = newUuid;
    if (copy[rootKey].metadata) {
      copy[rootKey].metadata.title = (copy[rootKey].metadata.title || 'Untitled') + ' (Kopie)';
      copy[rootKey].metadata['last-modified'] = new Date().toISOString();
    }
    try {
      const response = await authFetch(`/api/documents/${stage}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(copy),
      });
      if (!response.ok) throw new Error('Copying failed.');
      window.history.pushState(null, '', `/${stage === 'catalogs' ? 'catalog' : 'profile'}/${newUuid}?edit=true`);
      window.location.reload();
    } catch (e) {
      alert(`Error copying: ${e.message}`);
    }
  };

  useEffect(() => {
    if (!isEditing) return;
    
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, historyState]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      window.history.pushState(null, '', profileId ? '/profiles' : '/catalogs');
      window.dispatchEvent(new Event('popstate'));
    }
  };

  // Helper to extract all controls recursively from groups/catalog
  const allControls = useMemo(() => {
    const list = [];
    const traverse = (item, groupTitle = '') => {
      if (item.controls) {
        item.controls.forEach(c => {
          list.push({ ...c, groupTitle });
          if (c.controls) {
            c.controls.forEach(sub => {
              list.push({ ...sub, groupTitle, parentId: c.id });
            });
          }
        });
      }
      if (item.groups) {
        item.groups.forEach(g => traverse(g, g.title || groupTitle));
      }
    };
    if (catalog) {
      traverse(catalog);
    }
    return list;
  }, [catalog]);

  // Helper to extract every single imported control from raw imported source catalogs
  const allImportedControls = useMemo(() => {
    const list = [];
    if (!rawDoc?.profile?.imports) return list;
    
    rawDoc.profile.imports.forEach(imp => {
      const match = imp.href.match(/([a-f0-9-]{36})/i);
      const uuid = match ? match[1]?.toLowerCase() : null;
      if (!uuid || !cachedCatalogs.has(uuid)) return;
      
      const catEntry = cachedCatalogs.get(uuid);
      const realDoc = catEntry.data || catEntry;
      const catalogObj = realDoc.catalog;
      if (!catalogObj) return;
      
      const traverse = (item) => {
        if (item.controls) {
          item.controls.forEach(c => {
            list.push(c);
          });
        }
        if (item.groups) {
          item.groups.forEach(g => traverse(g));
        }
      };
      traverse(catalogObj);
    });
    
    // Add local controls too
    const localControls = rawDoc?.profile?.["local-controls"] || [];
    list.push(...localControls);
    
    // Deduplicate by ID
    const seen = new Set();
    return list.filter(c => {
      const idUpper = c.id.toUpperCase();
      if (seen.has(idUpper)) return false;
      seen.add(idUpper);
      return true;
    });
  }, [rawDoc?.profile?.imports, cachedCatalogs, rawDoc?.profile?.["local-controls"]]);

  // Expand/collapse groups
  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
    setSelectedGroupId(groupId);
    setSelectedControlId(null);
  };


  // Filter groups and controls based on search query
  const groupedData = useMemo(() => {
    if (!catalog) return [];
    
    const groupsList = [];
    
    const collectGroups = (item) => {
      if (item.groups) {
        item.groups.forEach(g => {
          const controlsInGroup = [];
          const collectControls = (grp) => {
            if (grp.controls) {
              grp.controls.forEach(c => {
                controlsInGroup.push(c);
              });
            }
            if (grp.groups) {
              grp.groups.forEach(sub => collectControls(sub));
            }
          };
          collectControls(g);
          
          groupsList.push({
            id: g.id || g.title,
            title: g.title || 'Untitled Group',
            controls: controlsInGroup
          });
        });
      }
      if (item.controls && item.controls.length > 0) {
        const rootControlsGroup = groupsList.find(x => x.id === 'root');
        if (rootControlsGroup) {
          rootControlsGroup.controls.push(...item.controls);
        } else {
          groupsList.push({
            id: 'root',
            title: 'Controls / Unassigned',
            controls: [...item.controls]
          });
        }
      }
    };
    
    collectGroups(catalog);
    
    // Add "Unassigned Controls" virtual group in Custom merge mode when editing
    if (isEditing && profileId && currentMergeMode === 'custom') {
      const assignedIds = new Set();
      groupsList.forEach(g => {
        g.controls.forEach(c => assignedIds.add(c.id.toUpperCase()));
      });
      
      const unassignedControls = allImportedControls.filter(c => !assignedIds.has(c.id.toUpperCase()));
      if (unassignedControls.length > 0) {
        groupsList.push({
          id: 'unassigned-virtual-group',
          title: 'Unassigned Controls',
          controls: unassignedControls
        });
      }
    }
    
    return groupsList;
  }, [catalog, isEditing, profileId, currentMergeMode, allImportedControls]);

  // Filter groups and controls based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedData;
    
    const query = searchQuery.toLowerCase();
    return groupedData.map(g => {
      const matchingControls = g.controls.filter(c => 
        c.id.toLowerCase().includes(query) || 
        (c.title && c.title.toLowerCase().includes(query))
      );
      return {
        ...g,
        controls: matchingControls
      };
    }).filter(g => g.controls.length > 0);
  }, [groupedData, searchQuery]);

  // Helper functions formatProse, RenderParts, and EditableParts are declared at the file scope.

  if (loading) {
    return (
      <div className="catalog-viewer-subpage">
        <div className="catalog-viewer-header">
          <div className="viewer-title-area">
            <span className="viewer-badge">{profileId ? 'Profile Viewer' : 'Catalog Viewer'}</span>
            <h3>Loading {profileId ? 'Profile' : 'Catalog'}…</h3>
          </div>
          <button className="btn-secondary" onClick={handleClose}>← Back to {profileId ? 'Profiles' : 'Catalogs'}</button>
        </div>
        <div className="catalog-viewer-container" style={{ justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
          <div className="loading-indicator">
            <span className="spinner" /> Loading data…
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="catalog-viewer-subpage">
        <div className="catalog-viewer-header">
          <div className="viewer-title-area">
            <span className="viewer-badge">{profileId ? 'Profile Viewer' : 'Catalog Viewer'}</span>
            <h3>Error Loading {profileId ? 'Profile' : 'Catalog'}</h3>
          </div>
          <button className="btn-secondary" onClick={handleClose}>← Back to {profileId ? 'Profiles' : 'Catalogs'}</button>
        </div>
        <div className="catalog-viewer-container" style={{ justifyContent: 'center', alignItems: 'center', padding: '40px', flexDirection: 'column', gap: '16px' }}>
          <div className="error-message" style={{ margin: '0' }}>⚠️ {error}</div>
          <button className="btn-primary" onClick={handleClose}>Back to {profileId ? 'Profiles' : 'Catalogs'}</button>
        </div>
      </div>
    );
  }



  const getControlCustomGroupId = (controlId) => {
    const groups = rawDoc?.profile?.merge?.custom?.groups || [];
    const ctrlIdUpper = controlId.toUpperCase();
    
    const findInGroup = (g) => {
      if (g["insert-controls"]) {
        const hasIt = g["insert-controls"].some(ic => {
          if (ic["include-controls"]) {
            return ic["include-controls"].some(inc => {
              if (inc["with-ids"]) {
                return inc["with-ids"].some(id => id.toUpperCase() === ctrlIdUpper);
              }
              return false;
            });
          }
          return false;
        });
        if (hasIt) return g.id;
      }
      if (g.groups) {
        for (const sub of g.groups) {
          const res = findInGroup(sub);
          if (res) return res;
        }
      }
      return null;
    };
    
    for (const g of groups) {
      const res = findInGroup(g);
      if (res) return res;
    }
    return '';
  };


  const handleUpdateImportWildcards = (field, valueString) => {
    updateDocumentState(doc => {
      const imp = doc.profile?.imports?.[0];
      if (!imp) return;
      
      const patterns = valueString.split(',').map(s => s.trim()).filter(Boolean);
      if (field === 'include') {
        if (!imp["include-controls"]) imp["include-controls"] = [];
        const ic = imp["include-controls"][0] || { "with-ids": [] };
        ic.matching = patterns.map(p => ({ pattern: p }));
        imp["include-controls"] = [ic];
      } else if (field === 'exclude') {
        if (!imp["exclude-controls"]) imp["exclude-controls"] = [];
        const ec = imp["exclude-controls"][0] || { "with-ids": [] };
        ec["matching-patterns"] = patterns;
        imp["exclude-controls"] = [ec];
      }
    });
  };

  const handleUpdateMergeMode = (mode) => {
    if (mode === 'flat') {
      updateDocumentState(doc => {
        const profile = doc.profile;
        if (!profile) return;
        if (!profile.merge) profile.merge = {};
        profile.merge.flat = {};
        delete profile.merge.custom;
      });
    } else if (mode) {
      handleInitializeGroupsFromCatalog(mode);
    }
  };

  const getControlsInCustomGroup = (g) => {
    const ids = [];
    if (g['insert-controls']) {
      g['insert-controls'].forEach(ic => {
        if (ic['include-controls']) {
          ic['include-controls'].forEach(inc => {
            if (inc['with-ids']) {
              inc['with-ids'].forEach(id => {
                ids.push(id.toUpperCase());
              });
            }
          });
        }
      });
    }
    return ids;
  };

  const handleRemoveControlFromCustomGroup = (cId) => {
    updateDocumentState(doc => {
      const groups = doc.profile?.merge?.custom?.groups || [];
      const removeFromGroup = (g) => {
        if (g['insert-controls']) {
          g['insert-controls'] = g['insert-controls'].map(ic => {
            if (ic['include-controls']) {
              ic['include-controls'] = ic['include-controls'].map(inc => {
                if (inc['with-ids']) {
                  inc['with-ids'] = inc['with-ids'].filter(id => id.toUpperCase() !== cId.toUpperCase());
                }
                return inc;
              }).filter(inc => !inc['with-ids'] || inc['with-ids'].length > 0);
            }
            return ic;
          }).filter(ic => !ic['include-controls'] || ic['include-controls'].length > 0);
        }
        if (g.groups) {
          g.groups.forEach(removeFromGroup);
        }
      };
      groups.forEach(removeFromGroup);
    });
  };

  const handleInitializeGroupsFromCatalog = (catUuid) => {
    const catEntry = cachedCatalogs.get(catUuid.toLowerCase());
    if (!catEntry) return;
    const realDoc = catEntry.data || catEntry;
    const catalogObj = realDoc.catalog;
    if (!catalogObj) return;

    updateDocumentState(doc => {
      if (!doc.profile.merge) doc.profile.merge = {};
      doc.profile.merge.custom = {
        defaultStructure: catUuid,
        groups: cloneGroups(catalogObj.groups || [])
      };
      delete doc.profile.merge.flat;
    });
  };

  const isIncludeAllForImport = (catUuid) => {
    const imp = rawDoc?.profile?.imports?.find(i => i.href === `#${catUuid}` || i.href.includes(catUuid));
    return imp && imp['include-all'] !== undefined;
  };

  const handleToggleIncludeAllForImport = (catUuid, checked) => {
    updateDocumentState(doc => {
      const imp = doc.profile?.imports?.find(i => i.href === `#${catUuid}` || i.href.includes(catUuid));
      if (!imp) return;
      if (checked) {
        imp['include-all'] = {};
      } else {
        delete imp['include-all'];
      }
    });
  };

  const getExcludePatternsForImport = (catUuid) => {
    const imp = rawDoc?.profile?.imports?.find(i => i.href === `#${catUuid}` || i.href.includes(catUuid));
    if (!imp) return [];
    return (imp['exclude-controls'] || []).flatMap(ec => {
      const directPatterns = ec["matching-patterns"] || [];
      const matchingObjs = (ec["matching"] || []).map(m => m.pattern).filter(Boolean);
      return [...directPatterns, ...matchingObjs];
    });
  };

  const handleUpdateExcludePatternsForImport = (catUuid, valueString) => {
    const patterns = valueString.split(',').map(s => s.trim()).filter(Boolean);
    updateDocumentState(doc => {
      const imp = doc.profile?.imports?.find(i => i.href === `#${catUuid}` || i.href.includes(catUuid));
      if (!imp) return;
      if (patterns.length === 0) {
        delete imp['exclude-controls'];
      } else {
        imp['exclude-controls'] = [{
          'matching-patterns': patterns
        }];
      }
    });
  };

  const handleStartInlineEdit = (groupId) => {
    if (currentMergeMode !== 'custom') {
      const match = rawDoc?.profile?.imports?.[0]?.href?.match(/([a-f0-9-]{36})/i);
      const catUuid = match ? match[1]?.toLowerCase() : null;
      if (catUuid) {
        const catEntry = cachedCatalogs.get(catUuid);
        const realDoc = catEntry?.data || catEntry;
        const catalogObj = realDoc?.catalog;
        if (catalogObj) {
          updateDocumentState(doc => {
            if (!doc.profile.merge) doc.profile.merge = {};
            doc.profile.merge.custom = {
              defaultStructure: catUuid,
              groups: cloneGroups(catalogObj.groups || [])
            };
            delete doc.profile.merge.flat;
          });
        }
      }
    }
    setEditingGroupId(groupId);
  };

  const handleRenameGroup = (groupId, newTitle) => {
    if (!newTitle.trim()) return;
    updateDocumentState(doc => {
      const groups = doc.profile?.merge?.custom?.groups || [];
      const rename = (list) => {
        for (const g of list) {
          if (g.id === groupId) {
            g.title = newTitle;
            return true;
          }
          if (g.groups && rename(g.groups)) {
            return true;
          }
        }
        return false;
      };
      rename(groups);
    });
  };

  const handleAddCustomGroup = () => {
    const newGroupId = `group-${generateUUID().slice(0, 8)}`;
    
    updateDocumentState(doc => {
      if (!doc.profile.merge) doc.profile.merge = {};
      if (!doc.profile.merge.custom) {
        const match = doc.profile?.imports?.[0]?.href?.match(/([a-f0-9-]{36})/i);
        const catUuid = match ? match[1]?.toLowerCase() : null;
        if (catUuid) {
          const catEntry = cachedCatalogs.get(catUuid);
          const realDoc = catEntry?.data || catEntry;
          const catalogObj = realDoc?.catalog;
          doc.profile.merge.custom = {
            defaultStructure: catUuid,
            groups: catalogObj ? cloneGroups(catalogObj.groups || []) : []
          };
          delete doc.profile.merge.flat;
        } else {
          doc.profile.merge.custom = {
            defaultStructure: '',
            groups: []
          };
          delete doc.profile.merge.flat;
        }
      }
      
      const groups = doc.profile.merge.custom.groups || [];
      groups.push({
        id: newGroupId,
        title: 'New Group',
        "insert-controls": []
      });
      doc.profile.merge.custom.groups = groups;
    });
    
    setEditingGroupId(newGroupId);
  };

  const handleMoveControlToCustomGroup = (controlId, targetGroupId) => {
    updateDocumentState(doc => {
      const groups = doc.profile?.merge?.custom?.groups || [];
      
      const removeFromGroup = (g) => {
        if (g["insert-controls"]) {
          g["insert-controls"] = g["insert-controls"].map(ic => {
            if (ic["include-controls"]) {
              ic["include-controls"] = ic["include-controls"].map(inc => {
                if (inc["with-ids"]) {
                  inc["with-ids"] = inc["with-ids"].filter(id => id.toUpperCase() !== controlId.toUpperCase());
                }
                return inc;
              }).filter(inc => !inc["with-ids"] || inc["with-ids"].length > 0);
            }
            return ic;
          }).filter(ic => !ic["include-controls"] || ic["include-controls"].length > 0);
        }
        if (g.groups) {
          g.groups.forEach(removeFromGroup);
        }
      };
      groups.forEach(removeFromGroup);
      
      if (targetGroupId && targetGroupId !== 'unassigned-virtual-group') {
        const findAndAddToGroup = (g) => {
          if (g.id === targetGroupId) {
            if (!g["insert-controls"]) g["insert-controls"] = [];
            let ic = g["insert-controls"][0];
            if (!ic) {
              ic = { "include-controls": [{ "with-ids": [] }] };
              g["insert-controls"].push(ic);
            }
            if (!ic["include-controls"]) ic["include-controls"] = [{ "with-ids": [] }];
            let inc = ic["include-controls"][0];
            if (!inc) {
              inc = { "with-ids": [] };
              ic["include-controls"].push(inc);
            }
            if (!inc["with-ids"]) inc["with-ids"] = [];
            if (!inc["with-ids"].some(id => id.toUpperCase() === controlId.toUpperCase())) {
              inc["with-ids"].push(controlId.toUpperCase());
            }
            return true;
          }
          if (g.groups) {
            for (const sub of g.groups) {
              if (findAndAddToGroup(sub)) return true;
            }
          }
          return false;
        };
        
        for (const g of groups) {
          if (findAndAddToGroup(g)) break;
        }
      }
    });
  };

  const getOriginalControlId = (resolvedId) => {
    if (!resolvedId) return null;
    const alters = rawDoc?.profile?.modify?.alters || [];
    for (const alt of alters) {
      const idOverride = alt.adds?.flatMap(add => add.props || []).find(p => p.name === 'id-override');
      if (idOverride && idOverride.value?.toLowerCase() === resolvedId.toLowerCase()) {
        return alt["control-id"];
      }
    }
    const locals = rawDoc?.profile?.modify?.["local-controls"] || [];
    if (locals.some(lc => lc.id?.toLowerCase() === resolvedId.toLowerCase())) {
      return resolvedId;
    }
    return resolvedId;
  };

  const getCustomAddedSubControlParentId = (subId) => {
    const alters = rawDoc?.profile?.modify?.alters || [];
    for (const alt of alters) {
      const addCtrls = alt.adds?.flatMap(add => add.controls || []) || [];
      if (addCtrls.some(sc => sc.id?.toLowerCase() === subId.toLowerCase())) {
        return alt["control-id"];
      }
    }
    return null;
  };

  const handleUpdateControlMetadata = (resolvedId, field, newValue) => {
    if (!newValue || !newValue.trim()) return;

    const currentCtrl = findControlById(resolvedId);
    if (currentCtrl) {
      if (field === 'title' && currentCtrl.title === newValue.trim()) return;
      if (field === 'id' && currentCtrl.id === newValue.trim()) return;
    }

    const originalId = getOriginalControlId(resolvedId);
    if (!originalId) return;

    // Check if this is a custom added sub-control
    const customParentId = getCustomAddedSubControlParentId(originalId);
    if (customParentId) {
      updateDocumentState(doc => {
        const alters = doc.profile?.modify?.alters || [];
        const alter = alters.find(a => a["control-id"]?.toLowerCase() === customParentId.toLowerCase());
        if (alter && alter.adds) {
          alter.adds.forEach(add => {
            if (add.controls) {
              const sc = add.controls.find(c => c.id?.toLowerCase() === originalId.toLowerCase());
              if (sc) {
                if (field === 'title') {
                  sc.title = newValue;
                } else if (field === 'id') {
                  sc.id = newValue;
                  if (sc.parts) {
                    sc.parts.forEach(p => {
                      if (p.id && p.id.includes(originalId)) {
                        p.id = p.id.replace(originalId, newValue);
                      }
                    });
                  }
                }
              }
            }
          });
        }
      });
      if (field === 'id') {
        if (selectedControl && originalId.toLowerCase() === selectedControl.id.toLowerCase()) {
          setSelectedControlId(newValue);
        }
      }
      return;
    }

    const isLocal = rawDoc?.profile?.modify?.["local-controls"]?.some(lc => lc.id?.toLowerCase() === originalId.toLowerCase());

    if (isLocal) {
      updateDocumentState(doc => {
        const locals = doc.profile?.modify?.["local-controls"] || [];
        const lc = locals.find(x => x.id?.toLowerCase() === originalId.toLowerCase());
        if (lc) {
          if (field === 'title') {
            lc.title = newValue;
          } else if (field === 'id') {
            lc.id = newValue;
          }
        }
      });
      if (field === 'id') {
        if (selectedControl && originalId.toLowerCase() === selectedControl.id.toLowerCase()) {
          setSelectedControlId(newValue);
        }
      }
      return;
    }

    // Imported control
    updateDocumentState(doc => {
      if (!doc.profile.modify) doc.profile.modify = {};
      if (!doc.profile.modify.alters) doc.profile.modify.alters = [];
      const alters = doc.profile.modify.alters;
      
      let alter = alters.find(a => a["control-id"]?.toLowerCase() === originalId.toLowerCase());
      if (!alter) {
        alter = {
          "control-id": originalId,
          adds: []
        };
        alters.push(alter);
      }
      
      if (!alter.adds) alter.adds = [];
      
      if (field === 'title') {
        let addPropBlock = alter.adds.find(add => add.props && add.props.some(p => p.name === 'title-override'));
        if (!addPropBlock) {
          addPropBlock = { props: [] };
          alter.adds.push(addPropBlock);
        }
        const prop = addPropBlock.props.find(p => p.name === 'title-override');
        if (prop) {
          prop.value = newValue;
        } else {
          addPropBlock.props.push({ name: 'title-override', value: newValue });
        }
      } else if (field === 'id') {
        let addPropBlock = alter.adds.find(add => add.props && add.props.some(p => p.name === 'id-override'));
        if (!addPropBlock) {
          addPropBlock = { props: [] };
          alter.adds.push(addPropBlock);
        }
        const prop = addPropBlock.props.find(p => p.name === 'id-override');
        if (prop) {
          prop.value = newValue;
        } else {
          addPropBlock.props.push({ name: 'id-override', value: newValue });
        }
      }
    });

    if (field === 'id') {
      if (selectedControl && originalId.toLowerCase() === selectedControl.id.toLowerCase()) {
        setSelectedControlId(newValue);
      }
    }

  };

  const findControlById = (id) => {
    if (!id || !catalogDoc?.catalog) return null;
    const search = (item) => {
      if (item.id?.toLowerCase() === id.toLowerCase()) return item;
      if (item.controls) {
        for (const sub of item.controls) {
          const res = search(sub);
          if (res) return res;
        }
      }
      if (item.groups) {
        for (const g of item.groups) {
          const res = search(g);
          if (res) return res;
        }
      }
      return null;
    };
    return search(catalogDoc.catalog);
  };

  const handleUpdateProperty = (idx, name, value, targetControlId = null) => {
    const ctrl = targetControlId ? findControlById(targetControlId) : selectedControl;
    if (!ctrl || !name.trim()) return;
    const originalId = getOriginalControlId(ctrl.id);
    if (!originalId) return;

    const isLocal = rawDoc?.profile?.modify?.["local-controls"]?.some(lc => lc.id?.toLowerCase() === originalId.toLowerCase());

    if (isLocal) {
      updateDocumentState(doc => {
        const locals = doc.profile?.modify?.["local-controls"] || [];
        const lc = locals.find(x => x.id?.toLowerCase() === originalId.toLowerCase());
        if (lc) {
          if (!lc.props) lc.props = [];
          lc.props[idx] = { name, value };
        }
      });
      return;
    }

    updateDocumentState(doc => {
      if (!doc.profile.modify) doc.profile.modify = {};
      if (!doc.profile.modify.alters) doc.profile.modify.alters = [];
      const alters = doc.profile.modify.alters;
      
      let alter = alters.find(a => a["control-id"]?.toLowerCase() === originalId.toLowerCase());
      if (!alter) {
        alter = { "control-id": originalId, adds: [] };
        alters.push(alter);
      }
      
      if (!alter.adds) alter.adds = [];
      
      let addPropBlock = alter.adds.find(add => add.props);
      if (!addPropBlock) {
        addPropBlock = { props: [] };
        alter.adds.push(addPropBlock);
      }
      
      const existingIdx = addPropBlock.props.findIndex(p => p.name === name);
      if (existingIdx >= 0) {
        addPropBlock.props[existingIdx].value = value;
      } else {
        addPropBlock.props.push({ name, value });
      }
    });
  };

  const handleDeleteProperty = (idx, targetControlId = null) => {
    const ctrl = targetControlId ? findControlById(targetControlId) : selectedControl;
    if (!ctrl) return;
    const originalId = getOriginalControlId(ctrl.id);
    if (!originalId) return;
    const propToDelete = ctrl.props[idx];
    if (!propToDelete) return;

    const isLocal = rawDoc?.profile?.modify?.["local-controls"]?.some(lc => lc.id?.toLowerCase() === originalId.toLowerCase());

    if (isLocal) {
      updateDocumentState(doc => {
        const locals = doc.profile?.modify?.["local-controls"] || [];
        const lc = locals.find(x => x.id?.toLowerCase() === originalId.toLowerCase());
        if (lc && lc.props) {
          lc.props = lc.props.filter((_, i) => i !== idx);
        }
      });
      return;
    }

    updateDocumentState(doc => {
      if (!doc.profile.modify) doc.profile.modify = {};
      if (!doc.profile.modify.alters) doc.profile.modify.alters = [];
      const alters = doc.profile.modify.alters;
      
      let alter = alters.find(a => a["control-id"]?.toLowerCase() === originalId.toLowerCase());
      if (!alter) {
        alter = { "control-id": originalId, removes: [] };
        alters.push(alter);
      }
      
      if (!alter.removes) alter.removes = [];
      alter.removes.push({ "by-name": propToDelete.name });
      
      if (alter.adds) {
        alter.adds.forEach(add => {
          if (add.props) {
            add.props = add.props.filter(p => p.name !== propToDelete.name);
          }
        });
        alter.adds = alter.adds.filter(add => !add.props || add.props.length > 0);
      }
    });
  };

  const handleAddProperty = (customName = 'new-prop', customValue = 'value', targetControlId = null) => {
    const ctrl = targetControlId ? findControlById(targetControlId) : selectedControl;
    if (!ctrl) return;
    const originalId = getOriginalControlId(ctrl.id);
    if (!originalId) return;

    const isLocal = rawDoc?.profile?.modify?.["local-controls"]?.some(lc => lc.id?.toLowerCase() === originalId.toLowerCase());

    if (isLocal) {
      updateDocumentState(doc => {
        const locals = doc.profile?.modify?.["local-controls"] || [];
        const lc = locals.find(x => x.id?.toLowerCase() === originalId.toLowerCase());
        if (lc) {
          if (!lc.props) lc.props = [];
          lc.props.push({ name: customName, value: customValue });
        }
      });
      if (customName === 'new-prop') {
        const newIdx = (ctrl.props || []).length;
        setEditingPropIndex(newIdx);
        setEditingPropControlId(ctrl.id);
      }
      return;
    }

    updateDocumentState(doc => {
      if (!doc.profile.modify) doc.profile.modify = {};
      if (!doc.profile.modify.alters) doc.profile.modify.alters = [];
      const alters = doc.profile.modify.alters;
      
      let alter = alters.find(a => a["control-id"]?.toLowerCase() === originalId.toLowerCase());
      if (!alter) {
        alter = { "control-id": originalId, adds: [] };
        alters.push(alter);
      }
      
      if (!alter.adds) alter.adds = [];
      let addPropBlock = alter.adds.find(add => add.props);
      if (!addPropBlock) {
        addPropBlock = { props: [] };
        alter.adds.push(addPropBlock);
      }
      addPropBlock.props.push({ name: customName, value: customValue });
    });

    if (customName === 'new-prop') {
      const newIdx = (ctrl.props || []).length;
      setEditingPropIndex(newIdx);
      setEditingPropControlId(ctrl.id);
    }
  };

  const handleAddControlEnhancement = () => {
    if (!selectedControl) return;
    const parentId = getOriginalControlId(selectedControl.id);
    if (!parentId) return;

    const count = (selectedControl.controls || []).length + 1;
    const newSubId = `${parentId.toLowerCase()}-${count < 10 ? '0' + count : count}`;
    const newSubCtrl = {
      id: newSubId,
      title: `Enhancement ${newSubId.toUpperCase()}`,
      parts: [
        {
          id: `${newSubId}_smt`,
          name: "statement",
          prose: "Beschreibung der neuen Sicherheitsvorgabe..."
        }
      ]
    };

    const isLocal = rawDoc?.profile?.modify?.["local-controls"]?.some(lc => lc.id?.toLowerCase() === parentId.toLowerCase());

    if (isLocal) {
      updateDocumentState(doc => {
        const locals = doc.profile?.modify?.["local-controls"] || [];
        const lc = locals.find(x => x.id?.toLowerCase() === parentId.toLowerCase());
        if (lc) {
          if (!lc.controls) lc.controls = [];
          lc.controls.push(newSubCtrl);
        }
      });
      return;
    }

    updateDocumentState(doc => {
      if (!doc.profile.modify) doc.profile.modify = {};
      if (!doc.profile.modify.alters) doc.profile.modify.alters = [];
      const alters = doc.profile.modify.alters;
      
      let alter = alters.find(a => a["control-id"]?.toLowerCase() === parentId.toLowerCase());
      if (!alter) {
        alter = { "control-id": parentId, adds: [] };
        alters.push(alter);
      }
      
      if (!alter.adds) alter.adds = [];
      let addCtrlBlock = alter.adds.find(add => add.controls);
      if (!addCtrlBlock) {
        addCtrlBlock = { position: "ending", controls: [] };
        alter.adds.push(addCtrlBlock);
      }
      addCtrlBlock.controls.push(newSubCtrl);
    });
  };

  const handleDeleteControlEnhancement = (subId) => {
    if (!selectedControl || !window.confirm(`Are you sure you want to delete the enhancement "${subId}"?`)) return;
    const parentId = getOriginalControlId(selectedControl.id);
    if (!parentId) return;

    const isLocal = rawDoc?.profile?.modify?.["local-controls"]?.some(lc => lc.id?.toLowerCase() === parentId.toLowerCase());

    if (isLocal) {
      updateDocumentState(doc => {
        const locals = doc.profile?.modify?.["local-controls"] || [];
        const lc = locals.find(x => x.id?.toLowerCase() === parentId.toLowerCase());
        if (lc && lc.controls) {
          lc.controls = lc.controls.filter(c => c.id?.toLowerCase() !== subId.toLowerCase());
        }
      });
      return;
    }

    const customParentId = getCustomAddedSubControlParentId(subId);

    updateDocumentState(doc => {
      if (!doc.profile.modify) doc.profile.modify = {};
      if (!doc.profile.modify.alters) doc.profile.modify.alters = [];
      const alters = doc.profile.modify.alters;

      if (customParentId) {
        const alter = alters.find(a => a["control-id"]?.toLowerCase() === customParentId.toLowerCase());
        if (alter && alter.adds) {
          alter.adds.forEach(add => {
            if (add.controls) {
              add.controls = add.controls.filter(c => c.id?.toLowerCase() !== subId.toLowerCase());
            }
          });
          alter.adds = alter.adds.filter(add => !add.controls || add.controls.length > 0);
        }
        return;
      }

      let alter = alters.find(a => a["control-id"]?.toLowerCase() === parentId.toLowerCase());
      if (!alter) {
        alter = { "control-id": parentId, removes: [] };
        alters.push(alter);
      }
      if (!alter.removes) alter.removes = [];
      alter.removes.push({ "by-id": subId });
    });
  };

  return (
    <div className="catalog-viewer-subpage">
      <datalist id="catalog-prop-names">
        {allCatalogPropNames.map(name => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <div className={`catalog-viewer-header ${isEditing ? 'editing' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="viewer-title-area">
            <span className={`viewer-badge ${isEditing ? 'editing' : ''}`}>
              {isEditing ? (profileId ? 'Editing Profile Draft' : 'Editing Catalog Draft') : (profileId ? 'Profile Viewer' : 'Catalog Viewer')}
            </span>
            <h3 title={rawMetadata.title || metadata.title || `Untitled ${profileId ? 'Profile' : 'Catalog'}`}>{rawMetadata.title || metadata.title || `Untitled ${profileId ? 'Profile' : 'Catalog'}`}</h3>
          </div>
          <button
            type="button"
            className={!selectedControlId ? "btn-primary" : "btn-secondary"}
            onClick={() => setSelectedControlId(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              height: 'fit-content',
              marginTop: '12px'
            }}
            title="Go to Document Overview"
          >
            ℹ️ Document Overview
          </button>
        </div>
        
        {isEditing && (
          <div className="mode-toggle-bar" style={{ margin: 0, padding: 0, border: 'none' }}>
            <button 
              className={`mode-toggle-btn ${editMode === 'visual' ? 'active' : ''}`}
              onClick={() => handleSwitchEditMode('visual')}
            >
              Visual / Form
            </button>
            <button 
              className={`mode-toggle-btn ${editMode === 'json' ? 'active' : ''}`}
              onClick={() => handleSwitchEditMode('json')}
            >
              Raw JSON
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {autosaved && <span className="autosave-status">✓ Autosaved</span>}
          {isEditing ? (
            <>
              <button 
                className={`btn-secondary ${showChangeLog ? 'active' : ''}`} 
                onClick={() => setShowChangeLog(!showChangeLog)}
                title="Versions-Verlauf anzeigen"
                style={showChangeLog ? { border: '1px solid var(--color-accent)', color: 'var(--color-accent)' } : {}}
              >
                🕐 Versions {selectedVersion ? `(${selectedVersion})` : `(${versions.length})`}
              </button>
              <button 
                className="btn-secondary" 
                onClick={handleUndo} 
                disabled={historyState.index <= 0}
                title="Undo (Ctrl+Z)"
              >
                ↩ Undo
              </button>
              <button 
                className="btn-secondary" 
                onClick={handleRedo} 
                disabled={historyState.index >= historyState.history.length - 1}
                title="Redo (Ctrl+Y)"
              >
                ↪ Redo
              </button>
              <button 
                className="btn-secondary" 
                onClick={handleOpenSaveVersionModal} 
                disabled={saving}
                title="Save version in backend"
              >
                💾 Save Version
              </button>
              <button 
                className="btn-secondary" 
                onClick={handleCancel}
                disabled={saving}
              >
                Exit
              </button>
            </>
          ) : (
            <>
              {rawDoc && (
                <button
                  className="btn-primary"
                  onClick={handleStartEditing}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  ✏️ Edit {profileId ? 'Profile' : 'Catalog'}
                </button>
              )}
              {rawDoc && (
                <button
                  className={`btn-secondary ${showChangeLog ? 'active' : ''}`}
                  onClick={() => setShowChangeLog(!showChangeLog)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Versionsverlauf anzeigen"
                >
                  🕐 Versions {selectedVersion ? `(${selectedVersion})` : ''}
                </button>
              )}
              <button className="btn-secondary" onClick={handleClose} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>←</span> Back to {profileId ? 'Profiles' : 'Catalogs'}
              </button>
            </>
          )}
        </div>
      </div>
      
      {/* Broken references warning banner */}
      {missingImports.length > 0 && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderLeft: '4px solid #d97706',
          color: '#92400e',
          padding: '12px 16px',
          margin: '12px 24px 0 24px',
          borderRadius: '6px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <div>
            <strong>Broken References:</strong> The following imported resources (UUIDs) were not found in the system and could not be resolved: 
            <span style={{ fontFamily: 'monospace', marginLeft: '4px', background: '#fde68a', padding: '2px 4px', borderRadius: '3px' }}>
              {missingImports.join(', ')}
            </span>
          </div>
        </div>
      )}
      
      <div className="catalog-viewer-container">
        {editMode === 'json' ? (
          <div className="json-editor-workspace">
            <div className="json-editor-controls">
              <span className="workspace-label">Raw OSCAL JSON Editor</span>
              <button 
                type="button"
                className="btn-secondary btn-xs" 
                onClick={handleValidateOscal}
                disabled={isValidating}
              >
                {isValidating ? 'Validating...' : '🔍 Validate OSCAL'}
              </button>
            </div>
            
            {jsonError && (
              <div className="json-error-banner">
                <strong>Syntax Error:</strong> {jsonError}
              </div>
            )}
            
            {schemaValidationError && (
              <div className="schema-error-banner">
                <strong>OSCAL Schema Validation Error:</strong>
                <pre>{schemaValidationError}</pre>
              </div>
            )}
            
            {validationSuccess && (
              <div className="validation-success-banner">
                <strong>✓ Document is OSCAL Compliant!</strong> Ready to save or continue editing.
              </div>
            )}
            
            <textarea
              className="json-editor-textarea"
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              onBlur={handleJsonBlur}
              placeholder="Paste or write raw OSCAL JSON here..."
              spellCheck="false"
            />
          </div>
        ) : (
          <>
            {/* Sidebar Navigation */}
            <aside className="catalog-sidebar">
              {isEditing && profileId && (
                <div 
                  className="sidebar-grouping-config" 
                  style={{ 
                    padding: '12px', 
                    borderBottom: '1px solid var(--color-border)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '10px', 
                    background: 'var(--color-surface-2)',
                    borderRadius: '4px',
                    margin: '8px',
                    border: '1px solid var(--color-border)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Default Structure
                    </label>
                    <select
                      className="form-input"
                      style={{ fontSize: '12px', padding: '6px 10px', width: '100%', height: '32px' }}
                      value={defaultStructureValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          handleUpdateMergeMode(val);
                        }
                      }}
                    >
                      <option value="" disabled>-- Choose Structure --</option>
                      <option value="flat">None (Flat List)</option>
                      {allCatalogsList.filter(cat => {
                        const catUuid = cat.catalog?.uuid;
                        return rawDoc?.profile?.imports?.some(imp => imp.href === `#${catUuid}` || imp.href.includes(catUuid));
                      }).map(cat => (
                        <option key={cat.catalog.uuid} value={cat.catalog.uuid}>
                          {cat.catalog.metadata?.title || cat.catalog.uuid.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {currentMergeMode === 'custom' && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        style={{ fontSize: '11px', padding: '4px 8px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', height: '28px' }}
                        onClick={handleAddCustomGroup}
                      >
                        📁 + Add Group
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="sidebar-search">
            <input
              type="text"
              className="form-input search-input"
              placeholder="Search controls (e.g. AC-2)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>

          <div className="sidebar-groups-list">
            {filteredGroups.length === 0 ? (
              <div className="sidebar-empty">No controls found</div>
            ) : (
              filteredGroups.map(group => {
                const isExpanded = expandedGroups[group.id] || searchQuery.trim() !== '';
                return (
                  <div key={group.id} className="sidebar-group-item">
                    <div 
                      className={`sidebar-group-header ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleGroup(group.id)}
                      onDragOver={(e) => {
                        if (isEditing && currentMergeMode === 'custom') {
                          e.preventDefault();
                        }
                      }}
                      onDrop={(e) => {
                        if (isEditing && currentMergeMode === 'custom') {
                          const controlId = e.dataTransfer.getData('text/plain');
                          if (controlId) {
                            handleMoveControlToCustomGroup(controlId, group.id);
                          }
                        }
                      }}
                      style={{ display: 'flex', alignItems: 'center', width: '100%' }}
                    >
                      <span className="group-arrow">▸</span>
                      {editingGroupId === group.id && isEditing && profileId && group.id !== 'unassigned-virtual-group' && group.id !== 'root' ? (
                        <input
                          type="text"
                          defaultValue={group.title}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleRenameGroup(group.id, e.target.value);
                              setEditingGroupId(null);
                            } else if (e.key === 'Escape') {
                              setEditingGroupId(null);
                            }
                          }}
                          onBlur={(e) => {
                            handleRenameGroup(group.id, e.target.value);
                            setEditingGroupId(null);
                          }}
                          className="form-input"
                          style={{
                            fontSize: '13px',
                            padding: '2px 6px',
                            height: '24px',
                            flex: 1,
                            marginRight: '8px',
                            background: 'var(--color-surface-3)',
                            border: '1px solid var(--color-accent)',
                            borderRadius: '4px',
                            color: 'var(--color-text)'
                          }}
                        />
                      ) : (
                        <span 
                          className="group-title" 
                          title={group.title} 
                          style={{ flex: 1 }}
                          onDoubleClick={(e) => {
                            if (isEditing && profileId && group.id !== 'unassigned-virtual-group' && group.id !== 'root') {
                              e.stopPropagation();
                              handleStartInlineEdit(group.id);
                            }
                          }}
                        >
                          {group.title}
                        </span>
                      )}
                      
                      {isEditing && profileId && currentMergeMode === 'custom' && group.id !== 'unassigned-virtual-group' && group.id !== 'root' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete group "${group.title}"?`)) {
                              updateDocumentState(doc => {
                                const groups = doc.profile?.merge?.custom?.groups || [];
                                doc.profile.merge.custom.groups = groups.filter(x => x.id !== group.id);
                              });
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-danger)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            padding: '0 4px',
                            marginRight: '6px'
                          }}
                          title="Delete this custom group"
                        >
                          🗑
                        </button>
                      )}
                      
                      <span className="group-count">{group.controls.length}</span>
                    </div>
                    
                    {isExpanded && (
                      <div className="sidebar-controls-list" style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px 8px' }}>
                        {group.controls.map(control => {
                          const isSelected = selectedControl?.id === control.id;
                          const isActive = profileId ? (isEditing ? isControlActiveInDoc(control.id) : !control.isControlInactive) : true;
                          return (
                            <div
                              key={control.id}
                              className={`sidebar-control-row ${isSelected ? 'active' : ''} ${!isActive ? 'inactive' : ''}`}
                              draggable={isEditing && currentMergeMode === 'custom'}
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', control.id);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                width: '100%',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: isSelected ? 'var(--color-surface-3)' : 'transparent',
                                borderLeft: isSelected ? '3px solid var(--color-accent)' : '3px solid transparent',
                                transition: 'all 0.15s ease',
                                cursor: isEditing && currentMergeMode === 'custom' ? 'grab' : 'default'
                              }}
                            >
                              {isEditing && profileId && (
                                <input
                                  type="checkbox"
                                  checked={isActive}
                                  onChange={(e) => handleToggleControlSelection(control.id, e.target.checked)}
                                  style={{ marginRight: '8px', cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                                />
                              )}
                              <span
                                onClick={() => {
                                  setSelectedControlId(control.id);
                                  setSelectedGroupId(null);
                                }}
                                style={{
                                  flex: 1,
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  fontWeight: isSelected ? '600' : 'normal',
                                  color: isSelected ? 'var(--color-accent)' : 'var(--color-text)',
                                  textDecoration: !isActive ? 'line-through' : 'none',
                                  opacity: !isActive ? 0.5 : 1,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  padding: '6px 0',
                                }}
                                title={`${control.id.toUpperCase()}: ${control.title}`}
                              >
                                <span style={{ fontFamily: 'monospace', marginRight: '6px', fontWeight: 'bold' }}>{control.id.toUpperCase()}</span>
                                <span>{control.title}</span>
                              </span>
                              
                              {isEditing && profileId && currentMergeMode === 'custom' && (
                                <select
                                  value={getControlCustomGroupId(control.id)}
                                  onChange={(e) => handleMoveControlToCustomGroup(control.id, e.target.value)}
                                  style={{
                                    fontSize: '10px',
                                    padding: '2px 4px',
                                    marginLeft: '6px',
                                    borderRadius: '3px',
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-surface-2)',
                                    color: 'var(--color-text)',
                                    maxWidth: '85px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <option value="">-- Group --</option>
                                  {allCustomGroupsFlat.map(g => (
                                    <option key={g.id} value={g.id}>
                                      {'\u00A0\u00A0'.repeat(g.depth)}📁 {g.title}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>
        
        {/* Main Details Panel */}
        <main className="catalog-main-content">
          {showDraftPrompt && (
            <div className="draft-alert-banner">
              <span className="alert-icon">📝</span>
              <div className="alert-content">
                <strong>Unsaved draft found.</strong> Would you like to restore your last edits?
              </div>
              <div className="alert-actions">
                <button className="btn-primary btn-xs" onClick={handleRestoreAutoDraft}>Restore</button>
                <button className="btn-secondary btn-xs" onClick={handleDiscardDraft}>Discard</button>
              </div>
            </div>
          )}

          {selectedControl ? (
            <div className="control-detail-view">
              {/* Control Header */}
              {isEditing ? (
                <div className="control-detail-edit-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px', padding: '16px', background: 'var(--color-surface-2)', borderRadius: '6px', border: '1px solid var(--color-border)', width: '100%' }}>
                  
                  {/* Top Row: ID, Title, Type, and Group Selector */}
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap', width: '100%' }}>
                    {/* Control ID */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Control ID</span>
                      {editingControlId ? (
                        <input
                          type="text"
                          defaultValue={selectedControl.id}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateControlMetadata(selectedControl.id, 'id', e.target.value);
                              setEditingControlId(false);
                            } else if (e.key === 'Escape') {
                              setEditingControlId(false);
                            }
                          }}
                          onBlur={(e) => {
                            handleUpdateControlMetadata(selectedControl.id, 'id', e.target.value);
                            setEditingControlId(false);
                          }}
                          className="form-input"
                          style={{ fontSize: '14px', padding: '4px 8px', width: '120px', fontWeight: 'bold', height: '32px' }}
                        />
                      ) : (
                        <div 
                          className="control-id-badge" 
                          style={{ cursor: 'pointer', height: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', fontSize: '14px', fontWeight: 'bold' }}
                          title="Click to edit ID"
                          onClick={() => setEditingControlId(true)}
                        >
                          {selectedControl.id.toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Control Title / Name */}
                    {selectedControl.title && selectedControl.title.toLowerCase() !== selectedControl.id.toLowerCase() && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Control Title / Name</span>
                        {editingControlTitle ? (
                          <input
                            type="text"
                            defaultValue={selectedControl.title}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateControlMetadata(selectedControl.id, 'title', e.target.value);
                                setEditingControlTitle(false);
                              } else if (e.key === 'Escape') {
                                setEditingControlTitle(false);
                              }
                            }}
                            onBlur={(e) => {
                              handleUpdateControlMetadata(selectedControl.id, 'title', e.target.value);
                              setEditingControlTitle(false);
                            }}
                            className="form-input"
                            style={{ fontSize: '18px', padding: '4px 8px', width: '100%', fontWeight: 'bold', height: '32px' }}
                          />
                        ) : (
                          <h2 
                            style={{ 
                              cursor: 'pointer', 
                              margin: 0,
                              fontSize: '18px',
                              lineHeight: '32px',
                              flex: 1,
                              fontWeight: '600'
                            }} 
                            title="Click to edit title"
                            onClick={() => setEditingControlTitle(true)}
                          >
                            {selectedControl.title}
                          </h2>
                        )}
                      </div>
                    )}

                    {/* Type Badge */}
                    {selectedControl.class && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', marginLeft: 'auto' }}>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</span>
                        <span className="control-class-badge" style={{ margin: 0, height: '32px', display: 'inline-flex', alignItems: 'center', padding: '0 12px' }}>{selectedControl.class}</span>
                      </div>
                    )}
                  </div>

                  {/* Divider line between fields and properties */}
                  <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '0' }} />

                  {/* Properties, Links, Responsible Parties Row */}
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', width: '100%' }}>
                    {/* Properties */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <span style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Properties</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                        {(selectedControl.props || []).map((prop, idx) => {
                          if (prop.name === 'title-override' || prop.name === 'id-override') return null;
                          const isPropEditing = editingPropIndex === idx;
                          if (isPropEditing) {
                            return (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-surface-3)', border: '1px solid var(--color-accent)', padding: '2px 4px', borderRadius: '4px' }}>
                                <input
                                  type="text"
                                  defaultValue={prop.name}
                                  placeholder="Name"
                                  id={`prop-name-${idx}`}
                                  list="catalog-prop-names"
                                  style={{ fontSize: '10px', padding: '2px 4px', width: '80px', height: '20px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                                />
                                <span>:</span>
                                <input
                                  type="text"
                                  defaultValue={prop.value}
                                  placeholder="Wert"
                                  id={`prop-val-${idx}`}
                                  style={{ fontSize: '10px', padding: '2px 4px', width: '100px', height: '20px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newName = document.getElementById(`prop-name-${idx}`).value;
                                    const newVal = document.getElementById(`prop-val-${idx}`).value;
                                    handleUpdateProperty(idx, newName, newVal);
                                    setEditingPropIndex(null);
                                  }}
                                  style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }}
                                  title="Save"
                                >
                                  ✓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingPropIndex(null)}
                                  style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }}
                                  title="Cancel"
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          }

                          return (
                            <span 
                              key={idx} 
                              style={{ 
                                background: 'var(--color-surface-3)', 
                                border: '1px solid var(--color-border)', 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer'
                              }}
                              onDoubleClick={() => setEditingPropIndex(idx)}
                              title="Double click to edit"
                            >
                              <strong>{prop.name}:</strong> {prop.value}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProperty(idx);
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '12px', padding: '0 2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Delete"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                        
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn-secondary btn-xs"
                            onClick={() => handleAddProperty()}
                            style={{ padding: '2px 6px', fontSize: '10px', height: '20px', borderRadius: '4px' }}
                          >
                            + Custom Property
                          </button>
                          {rawMetadata.props && rawMetadata.props.length > 0 && (
                            <select
                              className="form-input"
                              style={{ padding: '2px 6px', fontSize: '10px', height: '20px', borderRadius: '4px', background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text)', maxWidth: '150px' }}
                              onChange={(e) => {
                                if (e.target.value) {
                                  const [name, val] = e.target.value.split(':::');
                                  handleAddProperty(name, val);
                                  e.target.value = '';
                                }
                              }}
                            >
                              <option value="">+ Assign Global Property...</option>
                              {rawMetadata.props.map((gp, gIdx) => (
                                <option key={gIdx} value={`${gp.name}:::${gp.value}`}>
                                  {gp.name}: {gp.value}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Links */}
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Links / References</span>
                        <button
                          type="button"
                          className="btn-secondary btn-xs"
                          onClick={() => handleUpdateControlLinks(selectedControl.id, -1, '', '')}
                          style={{ padding: '1px 6px', fontSize: '9px' }}
                        >
                          ➕ Add Link
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {(selectedControl.links || []).map((link, lIdx) => {
                          const resources = rawDoc?.catalog?.['back-matter']?.resources || rawDoc?.profile?.['back-matter']?.resources || [];
                          return (
                            <div key={lIdx} style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', border: '1px dashed var(--color-border)', padding: '4px', borderRadius: '4px', background: 'var(--color-surface-3)' }}>
                              <DebouncedInput
                                type="text"
                                className="form-input form-input-xs"
                                style={{ flex: '1 1 100px', fontSize: '10px', height: '22px', padding: '2px 4px' }}
                                value={link.text || ''}
                                onChange={(e) => handleUpdateControlLinks(selectedControl.id, lIdx, 'text', e.target.value)}
                                placeholder="Link Text"
                              />
                              <select
                                className="form-input"
                                style={{ flex: '1 1 80px', height: '22px', fontSize: '10px', padding: '2px' }}
                                value={link.rel || 'reference'}
                                onChange={(e) => handleUpdateControlLinks(selectedControl.id, lIdx, 'rel', e.target.value)}
                              >
                                <option value="reference">reference</option>
                                <option value="alternate">alternate</option>
                              </select>
                              {link.rel === 'reference' && resources.length > 0 ? (
                                <select
                                  className="form-input"
                                  style={{ flex: '2 1 120px', height: '22px', fontSize: '10px', padding: '2px' }}
                                  value={link.href || ''}
                                  onChange={(e) => handleUpdateControlLinks(selectedControl.id, lIdx, 'href', e.target.value)}
                                >
                                  <option value="">-- Resource --</option>
                                  {resources.map(r => (
                                    <option key={r.uuid} value={`#${r.uuid}`}>{r.title || r.uuid}</option>
                                  ))}
                                </select>
                              ) : (
                                <DebouncedInput
                                  type="text"
                                  className="form-input form-input-xs"
                                  style={{ flex: '2 1 120px', fontSize: '10px', height: '22px', padding: '2px 4px' }}
                                  value={link.href || ''}
                                  onChange={(e) => handleUpdateControlLinks(selectedControl.id, lIdx, 'href', e.target.value)}
                                  placeholder="href"
                                />
                              )}
                              <button
                                type="button"
                                className="btn-delete btn-xs"
                                onClick={() => handleUpdateControlLinks(selectedControl.id, lIdx, null, '')}
                                style={{ padding: '2px 4px', fontSize: '10px' }}
                              >
                                🗑️
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>


                  </div>
                </div>
              ) : (
                <>
                  {/* View Mode: Normal Header Sektion */}
                  <header className="control-detail-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', marginBottom: '16px' }}>
                    <div className="control-id-badge">{selectedControl.id.toUpperCase()}</div>
                    {selectedControl.title && selectedControl.title.toLowerCase() !== selectedControl.id.toLowerCase() && (
                      <h2 style={{ flex: 1, margin: 0 }}>{selectedControl.title}</h2>
                    )}
                    {selectedControl.class && (
                      <span className="control-class-badge" style={{ marginLeft: 'auto' }}>{selectedControl.class}</span>
                    )}
                  </header>

                  {/* View Mode: Properties and Links Box */}
                  {((selectedControl.props && selectedControl.props.some(p => p.name !== 'title-override' && p.name !== 'id-override')) || (selectedControl.links && selectedControl.links.length > 0)) && (
                    <div className="control-metadata-row" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px', padding: '12px', background: 'var(--color-surface-2)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                      {selectedControl.props && selectedControl.props.some(p => p.name !== 'title-override' && p.name !== 'id-override') && (
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <span style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Properties</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                            {selectedControl.props.map((prop, idx) => {
                              if (prop.name === 'title-override' || prop.name === 'id-override') return null;
                              return (
                                <span key={idx} style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <strong>{prop.name}:</strong> {prop.value}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {selectedControl.links && selectedControl.links.length > 0 && (
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <span style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Links / References</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {selectedControl.links.map((link, idx) => (
                              <a key={idx} href={link.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', fontSize: '11px', textDecoration: 'underline' }}>
                                {link.text || link.href}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              
              <div className="control-detail-body">
                {/* Control Statement */}
                <section className="detail-section">
                  <h4 className="section-label">Statement</h4>
                  <div className="control-statement-box">
                    {isEditing ? (
                      selectedControl.parts?.filter(p => p.name === 'statement').map((part, i) => (
                        <div key={i} className="statement-prose-root editing">
                          {part.prose !== undefined && (
                            <div className="part-edit-row" style={{ marginBottom: '12px' }}>
                              <span className="part-label-root">Statement Prose</span>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                                <ProseTextareaWithParams
                                  className={`form-input part-prose-textarea statement-root-textarea ${isPartModified(selectedControl.id, part.id) ? 'modified' : ''}`}
                                  value={part.prose || ''}
                                  onChange={(e) => handlePartProseChange(selectedControl.id, part.id, e.target.value)}
                                  placeholder="Statement text..."
                                  rows={3}
                                  style={isPartModified(selectedControl.id, part.id) ? { border: '1px solid var(--color-warning)', background: 'var(--color-warning-bg)' } : {}}
                                  params={selectedControl.params || []}
                                />
                                {isPartModified(selectedControl.id, part.id) && (
                                  <button
                                    type="button"
                                    className="btn-secondary btn-xs"
                                    onClick={() => handleRevertPart(selectedControl.id, part.id)}
                                    title="Reset"
                                    style={{ padding: '4px 6px', height: 'fit-content' }}
                                  >
                                    ↺ Reset
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                          {part.parts && (
                            <EditableParts 
                              parts={part.parts} 
                              params={selectedControl.params} 
                              controlId={selectedControl.id} 
                              onPartProseChange={handlePartProseChange}
                              isPartModified={isPartModified}
                              onRevertPart={handleRevertPart}
                            />
                          )}
                        </div>
                      ))
                    ) : (
                      selectedControl.parts?.filter(p => p.name === 'statement').map((part, i) => (
                        <div key={i} className="statement-prose-root">
                          {part.prose && <p className="prose-paragraph">{formatProse(part.prose, selectedControl.params)}</p>}
                          {part.parts && <RenderParts parts={part.parts} params={selectedControl.params} />}
                        </div>
                      ))
                    )}
                    {!selectedControl.parts?.some(p => p.name === 'statement') && (
                      <p className="no-statement-prose">No statement provided in catalog.</p>
                    )}
                  </div>
                </section>
                
                {/* Parameters */}
                {((selectedControl.params && selectedControl.params.length > 0) || (catalogId && isEditing)) && (
                  <section className="detail-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 className="section-label" style={{ margin: 0 }}>Parameters</h4>
                      {catalogId && isEditing && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleCreateParam(selectedControl.id)}
                          style={{ padding: '2px 8px', fontSize: '11px', height: 'fit-content' }}
                        >
                          ➕ Add Parameter
                        </button>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="params-edit-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {selectedControl.params?.map(param => {
                          const choicesStr = param.select?.choice ? param.select.choice.join(', ') : '';
                          const patternStr = param.constraints?.[0]?.tests?.[0]?.expression || '';
                          const paramVal = param.values ? param.values.join(', ') : '';
                          const isValid = !patternStr || !paramVal || new RegExp(patternStr).test(paramVal);
                          return (
                            <div key={param.id} className="param-edit-card" style={{ border: '1px solid var(--color-border)', borderRadius: '6px', padding: '12px', background: 'var(--color-surface-2)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-accent)' }}>PARAMETER</span>
                                {catalogId && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteParam(selectedControl.id, param.id)}
                                    style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}
                                    title="Delete Parameter"
                                  >
                                    🗑️ Delete
                                  </button>
                                )}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <label style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>ID</label>
                                  {catalogId ? (
                                    <DebouncedInput
                                      type="text"
                                      className="form-input form-input-xs"
                                      style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--color-surface)' }}
                                      value={param.id}
                                      onChange={(e) => handleParamChange(param.id, 'id', e.target.value)}
                                      placeholder="e.g. ac-2_prm_1"
                                    />
                                  ) : (
                                    <code>{param.id}</code>
                                  )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <label style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>CONSTRAINT DESCRIPTION / LABEL</label>
                                  <DebouncedInput
                                    type="text"
                                    className="form-input form-input-xs"
                                    style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--color-surface)' }}
                                    value={param.label || ''}
                                    onChange={(e) => handleParamChange(param.id, 'label', e.target.value)}
                                    placeholder="Constraint description..."
                                    disabled={!catalogId}
                                  />
                                </div>

                                {profileId && param.select?.choice && param.select.choice.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <label style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>VALUE (SELECT FROM CHOICES)</label>
                                    <select
                                      className="form-input"
                                      style={{ 
                                        padding: '4px 8px', 
                                        fontSize: '12px', 
                                        height: '30px', 
                                        background: 'var(--color-surface)',
                                        border: !isValid ? '1px solid var(--color-danger)' : '1px solid var(--color-border)',
                                        borderRadius: '4px',
                                        color: 'var(--color-text)'
                                      }}
                                      value={param.values?.[0] || ''}
                                      onChange={(e) => handleParamChange(param.id, 'values', e.target.value)}
                                    >
                                      <option value="">-- Select Value --</option>
                                      {param.select.choice.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <label style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
                                      {catalogId ? 'DEFAULT VALUES (COMMA-SEPARATED)' : 'VALUE'}
                                    </label>
                                    <DebouncedInput
                                      type="text"
                                      className="form-input form-input-xs"
                                      style={{ 
                                        padding: '4px 8px', 
                                        fontSize: '12px', 
                                        background: 'var(--color-surface)',
                                        border: !isValid ? '1px solid var(--color-danger)' : '1px solid var(--color-border)'
                                      }}
                                      value={paramVal}
                                      onChange={(e) => handleParamChange(param.id, 'values', e.target.value)}
                                      placeholder={catalogId ? "e.g. Value 1, Value 2" : "Set tailored value..."}
                                    />
                                  </div>
                                )}

                                {!catalogId && patternStr && paramVal && !isValid && (
                                  <span style={{ fontSize: '11px', color: 'var(--color-danger)', marginTop: '2px' }}>
                                    ❌ Value does not match regex pattern: <code>{patternStr}</code>
                                  </span>
                                )}

                                {catalogId && (
                                  <>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <label style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>CHOICES (COMMA-SEPARATED)</label>
                                      <DebouncedInput
                                        type="text"
                                        className="form-input form-input-xs"
                                        style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--color-surface)' }}
                                        value={choicesStr}
                                        onChange={(e) => handleParamChange(param.id, 'choices', e.target.value)}
                                        placeholder="e.g. choice1, choice2"
                                      />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <label style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>VALIDATION REGEX PATTERN</label>
                                      <DebouncedInput
                                        type="text"
                                        className="form-input form-input-xs"
                                        style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--color-surface)' }}
                                        value={patternStr}
                                        onChange={(e) => handleParamChange(param.id, 'pattern', e.target.value)}
                                        placeholder="e.g. ^[0-9]+ Days$"
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <table className="params-table">
                        <thead>
                          <tr>
                            <th>Parameter ID</th>
                            <th>Tailoring Details & Values</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedControl.params.map(param => (
                            <tr key={param.id}>
                              <td className="param-id-cell"><code>{param.id}</code></td>
                              <td className="param-desc-cell">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <div>
                                    <span className="param-label-text" style={{ fontWeight: 'bold' }}>{param.label || 'Parameter constraint'}</span>
                                    {param.class && <span className="badge" style={{ marginLeft: '6px', background: 'var(--color-surface-3)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>class: {param.class}</span>}
                                  </div>
                                  
                                  {param.usage && (
                                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                      <strong>Usage:</strong> {param.usage}
                                    </div>
                                  )}
                                  
                                  {param.select && (
                                    <div className="param-select-box" style={{ background: 'var(--color-surface-2)', padding: '6px', borderRadius: '4px', fontSize: '11px', marginTop: '4px' }}>
                                      <span className="select-how" style={{ fontWeight: 'bold' }}>Selection Choices (how-many: {param.select['how-many'] || param.select.how || 'one'}):</span>
                                      {param.select.choice && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                          {param.select.choice.map((c, idx) => (
                                            <span key={idx} style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', padding: '1px 6px', borderRadius: '10px', fontSize: '10px' }}>{c}</span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {param.constraints && param.constraints.length > 0 && (
                                    <div className="param-constraints-box" style={{ borderLeft: '2px solid var(--color-warning)', paddingLeft: '8px', fontSize: '11px', marginTop: '4px' }}>
                                      <strong>Validation Rules (Constraints):</strong>
                                      {param.constraints.map((c, idx) => (
                                        <div key={idx} style={{ marginTop: '2px' }}>
                                          {c.description && <div>{c.description}</div>}
                                          {c.tests?.[0] && (
                                            <div style={{ fontStyle: 'italic', fontSize: '10px', color: 'var(--color-text-muted)' }}>
                                              Test: <code>{c.tests[0].expression}</code> {c.tests[0].remarks && `(${c.tests[0].remarks})`}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {param.guidelines && param.guidelines.length > 0 && (
                                    <div className="param-guidelines-box" style={{ borderLeft: '2px solid var(--color-accent-dim)', paddingLeft: '8px', fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                      <strong>Guidelines:</strong>
                                      {param.guidelines.map((g, idx) => (
                                        <div key={idx}>{g.prose}</div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {param.values && (
                                    <div className="param-values-box" style={{ marginTop: '4px' }}>
                                      <strong>Values: </strong>
                                      <code>{param.values.join(', ')}</code>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>
                )}
                
                {/* Discussion / Guidance */}
                {(selectedControl.parts?.some(p => p.name === 'guidance' || p.name === 'discussion') || isEditing) && (
                  <section className="detail-section">
                    <h4 className="section-label">Guidance / Discussion</h4>
                    <div className="control-guidance-box">
                      {selectedControl.parts
                        ?.filter(p => p.name === 'guidance' || p.name === 'discussion')
                        .map((part, i) => (
                          <div key={i} className="guidance-content editing">
                            <span className="part-label-root" style={{ textTransform: 'capitalize' }}>{part.name}</span>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', marginTop: '6px' }}>
                                <ProseTextareaWithParams
                                  className={`form-input part-prose-textarea guidance-textarea ${isPartModified(selectedControl.id, part.id) ? 'modified' : ''}`}
                                  value={part.prose || ''}
                                  onChange={(e) => handlePartProseChange(selectedControl.id, part.id, e.target.value)}
                                  placeholder={`Enter ${part.name} prose...`}
                                  rows={4}
                                  style={isPartModified(selectedControl.id, part.id) ? { border: '1px solid var(--color-warning)', background: 'var(--color-warning-bg)', flex: 1 } : { flex: 1 }}
                                  params={selectedControl.params || []}
                                />
                                {isPartModified(selectedControl.id, part.id) && (
                                  <button
                                    type="button"
                                    className="btn-secondary btn-xs"
                                    onClick={() => handleRevertPart(selectedControl.id, part.id)}
                                    title="Reset"
                                    style={{ padding: '4px 6px', height: 'fit-content' }}
                                  >
                                    ↺ Reset
                                  </button>
                                )}
                              </div>
                            ) : (
                              part.prose && <p className="prose-paragraph">{formatProse(part.prose, selectedControl.params)}</p>
                            )}
                            {part.parts && (
                              isEditing ? (
                                <EditableParts 
                                  parts={part.parts} 
                                  params={selectedControl.params} 
                                  controlId={selectedControl.id} 
                                  onPartProseChange={handlePartProseChange}
                                  isPartModified={isPartModified}
                                  onRevertPart={handleRevertPart}
                                />
                              ) : (
                                <RenderParts parts={part.parts} params={selectedControl.params} />
                              )
                            )}
                          </div>
                        ))}
                      {isEditing && !selectedControl.parts?.some(p => p.name === 'guidance' || p.name === 'discussion') && (
                        <div className="add-guidance-placeholder" style={{ padding: '12px', border: '1px dashed var(--color-border)', borderRadius: '6px', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn-secondary btn-xs"
                            onClick={() => {
                              const guidanceId = `${selectedControl.id}_gdn`;
                              handlePartProseChange(selectedControl.id, guidanceId, '');
                            }}
                          >
                            ➕ Add Guidance
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                )}
                
                {/* Control Enhancements */}
                {((selectedControl.controls && selectedControl.controls.length > 0) || isEditing) && (
                  <section className="detail-section" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 className="section-label" style={{ margin: 0 }}>Control Enhancements</h4>
                      {isEditing && (
                        <button
                          type="button"
                          className="btn-secondary btn-xs"
                          onClick={handleAddControlEnhancement}
                          style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          ➕ Add Enhancement
                        </button>
                      )}
                    </div>
                    <div className="control-enhancements-list">
                      {(selectedControl.controls || []).map(sub => (
                        <div key={sub.id} className="enhancement-item">
                          <div 
                            className={isEditing ? "enhancement-header-edit" : "enhancement-header"} 
                            style={isEditing ? { 
                              display: 'flex', 
                              gap: '12px', 
                              marginBottom: '8px', 
                              alignItems: 'center', 
                              width: '100%' 
                            } : { 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              marginBottom: '8px' 
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {isEditing && (
                                <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Enhancement ID</span>
                              )}
                              {isEditing && editingEnhancementId === sub.id ? (
                                <input
                                  type="text"
                                  defaultValue={sub.id}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleUpdateControlMetadata(sub.id, 'id', e.target.value);
                                      setEditingEnhancementId(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingEnhancementId(null);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    handleUpdateControlMetadata(sub.id, 'id', e.target.value);
                                    setEditingEnhancementId(null);
                                  }}
                                  className="form-input"
                                  style={{ fontSize: '11px', padding: '2px 4px', width: '100px', height: '22px', fontWeight: 'bold' }}
                                />
                              ) : (
                                <span 
                                  className="enhancement-id" 
                                  style={{ cursor: isEditing ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 6px' }}
                                  title={isEditing ? "Click to edit ID" : undefined}
                                  onClick={() => {
                                    if (isEditing) setEditingEnhancementId(sub.id);
                                  }}
                                >
                                  {sub.id.toUpperCase()}
                                </span>
                              )}
                            </div>

                            {/* Only show Title / Name if it exists and is different from ID */}
                            {sub.title && sub.title.toLowerCase() !== sub.id.toLowerCase() && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                                {isEditing && (
                                  <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Enhancement Title / Name</span>
                                )}
                                {isEditing && editingEnhancementTitle === sub.id ? (
                                  <input
                                    type="text"
                                    defaultValue={sub.title}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleUpdateControlMetadata(sub.id, 'title', e.target.value);
                                        setEditingEnhancementTitle(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingEnhancementTitle(null);
                                      }
                                    }}
                                    onBlur={(e) => {
                                      handleUpdateControlMetadata(sub.id, 'title', e.target.value);
                                      setEditingEnhancementTitle(null);
                                    }}
                                    className="form-input"
                                    style={{ fontSize: '11px', padding: '2px 4px', width: '100%', height: '22px', fontWeight: 'bold' }}
                                  />
                                ) : (
                                  <h5 
                                    style={{ 
                                      cursor: isEditing ? 'pointer' : 'default', 
                                      margin: 0, 
                                      lineHeight: '22px',
                                      flex: 1,
                                      fontWeight: '600'
                                    }}
                                    title={isEditing ? "Click to edit title" : undefined}
                                    onClick={() => {
                                      if (isEditing) setEditingEnhancementTitle(sub.id);
                                    }}
                                  >
                                    {sub.title}
                                  </h5>
                                )}
                              </div>
                            )}

                            {/* Type Badge for Enhancement */}
                            {isEditing ? (
                              sub.class && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Type</span>
                                  <span className="control-class-badge" style={{ margin: 0, height: '22px', display: 'inline-flex', alignItems: 'center', padding: '0 8px', fontSize: '10px' }}>
                                    {sub.class.toUpperCase()}
                                  </span>
                                </div>
                              )
                            ) : (
                              sub.class && (
                                <span className="control-class-badge" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                  {sub.class.toUpperCase()}
                                </span>
                              )
                            )}

                            {isEditing && profileId && (
                              <button
                                type="button"
                                onClick={() => handleDeleteControlEnhancement(sub.id)}
                                style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '12px', marginLeft: 'auto' }}
                                title="Delete enhancement"
                              >
                                🗑
                              </button>
                            )}
                          </div>
                          
                          {isEditing && profileId && <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '8px 0' }} />}

                          <div className="enhancement-body">
                            {/* Enhancement Properties */}
                            {((sub.props && sub.props.some(p => p.name !== 'title-override' && p.name !== 'id-override')) || (isEditing && profileId)) && (
                              <div className="enhancement-properties-edit" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                                <span style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Properties</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                  {(sub.props || []).map((prop, idx) => {
                                    if (prop.name === 'title-override' || prop.name === 'id-override') return null;
                                    const isPropEditing = editingPropControlId === sub.id && editingPropIndex === idx;
                                    if (isPropEditing) {
                                      return (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-surface-3)', border: '1px solid var(--color-accent)', padding: '2px 4px', borderRadius: '4px' }}>
                                          <input
                                            type="text"
                                            defaultValue={prop.name}
                                            placeholder="Name"
                                            id={`prop-name-${sub.id}-${idx}`}
                                            list="catalog-prop-names"
                                            style={{ fontSize: '10px', padding: '2px 4px', width: '80px', height: '20px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                                          />
                                          <input
                                            type="text"
                                            defaultValue={prop.value}
                                            placeholder="Value"
                                            id={`prop-val-${sub.id}-${idx}`}
                                            style={{ fontSize: '10px', padding: '2px 4px', width: '100%', height: '20px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newName = document.getElementById(`prop-name-${sub.id}-${idx}`).value;
                                              const newVal = document.getElementById(`prop-val-${sub.id}-${idx}`).value;
                                              handleUpdateProperty(idx, newName, newVal, sub.id);
                                              setEditingPropIndex(null);
                                              setEditingPropControlId(null);
                                            }}
                                            style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }}
                                            title="Save"
                                          >
                                            ✓
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingPropIndex(null);
                                              setEditingPropControlId(null);
                                            }}
                                            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }}
                                            title="Cancel"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      );
                                    }

                                    return (
                                      <span 
                                        key={idx} 
                                        style={{ 
                                          background: 'var(--color-surface-3)', 
                                          border: '1px solid var(--color-border)', 
                                          padding: '2px 8px', 
                                          borderRadius: '4px', 
                                          fontSize: '11px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          cursor: (isEditing && profileId) ? 'pointer' : 'default'
                                        }}
                                        onDoubleClick={() => {
                                          if (isEditing && profileId) {
                                            setEditingPropIndex(idx);
                                            setEditingPropControlId(sub.id);
                                          }
                                        }}
                                        title={isEditing && profileId ? "Double click to edit" : undefined}
                                      >
                                        <strong>{prop.name}:</strong> {prop.value}
                                        {isEditing && profileId && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteProperty(idx, sub.id);
                                            }}
                                            style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '12px', padding: '0 2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            title="Delete"
                                          >
                                            ×
                                          </button>
                                        )}
                                      </span>
                                    );
                                  })}

                                  {isEditing && profileId && (
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                      <button
                                        type="button"
                                        className="btn-secondary btn-xs"
                                        onClick={() => handleAddProperty('new-prop', 'value', sub.id)}
                                        style={{ padding: '2px 6px', fontSize: '10px', height: '20px', borderRadius: '4px' }}
                                      >
                                        + Custom Property
                                      </button>
                                      {rawMetadata.props && rawMetadata.props.length > 0 && (
                                        <select
                                          className="form-input"
                                          style={{ padding: '2px 6px', fontSize: '10px', height: '20px', borderRadius: '4px', background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', color: 'var(--color-text)', maxWidth: '150px' }}
                                          onChange={(e) => {
                                            if (e.target.value) {
                                              const [name, val] = e.target.value.split(':::');
                                              handleAddProperty(name, val, sub.id);
                                              e.target.value = '';
                                            }
                                          }}
                                        >
                                          <option value="">+ Assign Global Property...</option>
                                          {rawMetadata.props.map((gp, gIdx) => (
                                            <option key={gIdx} value={`${gp.name}:::${gp.value}`}>
                                              {gp.name}: {gp.value}
                                            </option>
                                          ))}
                                        </select>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {isEditing ? (
                              sub.parts?.filter(p => p.name === 'statement').map((part, idx) => (
                                <div key={idx} className="statement-prose-root editing">
                                  {part.prose !== undefined && (
                                    <div className="part-edit-row" style={{ marginBottom: '8px' }}>
                                      <span className="part-label-root">Enhancement Statement Prose</span>
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                                        <ProseTextareaWithParams
                                          className={`form-input part-prose-textarea statement-root-textarea ${isPartModified(sub.id, part.id) ? 'modified' : ''}`}
                                          value={part.prose || ''}
                                          onChange={(e) => handlePartProseChange(sub.id, part.id, e.target.value)}
                                          placeholder="Enhancement statement..."
                                          rows={2}
                                          style={isPartModified(sub.id, part.id) ? { border: '1px solid var(--color-warning)', background: 'var(--color-warning-bg)' } : {}}
                                          params={sub.params || []}
                                        />
                                        {isPartModified(sub.id, part.id) && (
                                          <button
                                            type="button"
                                            className="btn-secondary btn-xs"
                                            onClick={() => handleRevertPart(sub.id, part.id)}
                                            title="Reset"
                                            style={{ padding: '4px 6px', height: 'fit-content' }}
                                          >
                                            ↺ Reset
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  {part.parts && (
                                    <EditableParts 
                                      parts={part.parts} 
                                      params={sub.params || selectedControl.params} 
                                      controlId={sub.id} 
                                      onPartProseChange={handlePartProseChange}
                                      isPartModified={isPartModified}
                                      onRevertPart={handleRevertPart}
                                    />
                                  )}
                                </div>
                              ))
                            ) : (
                              sub.parts?.filter(p => p.name === 'statement').map((part, idx) => (
                                <div key={idx} className="statement-prose-root">
                                  {part.prose && <p className="prose-paragraph">{formatProse(part.prose, sub.params || selectedControl.params)}</p>}
                                  {part.parts && <RenderParts parts={part.parts} params={sub.params || selectedControl.params} />}
                                </div>
                              ))
                            )}
                            
                            {/* Sub-parameters */}
                            {((sub.params && sub.params.length > 0) || (catalogId && isEditing)) && (
                              <div className="sub-params-box" style={{ marginTop: '12px', borderTop: '1px dashed var(--color-border-subtle)', paddingTop: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <span className="sub-section-label" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text-muted)' }}>Enhancement Parameters</span>
                                  {catalogId && isEditing && (
                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      onClick={() => handleCreateParam(sub.id)}
                                      style={{ padding: '2px 8px', fontSize: '11px', height: 'fit-content' }}
                                    >
                                      ➕ Add Parameter
                                    </button>
                                  )}
                                </div>
                                {isEditing ? (
                                  <div className="params-edit-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {sub.params?.map(param => {
                                      const choicesStr = param.select?.choice ? param.select.choice.join(', ') : '';
                                      const patternStr = param.constraints?.[0]?.tests?.[0]?.expression || '';
                                      const paramVal = param.values ? param.values.join(', ') : '';
                                      const isValid = !patternStr || !paramVal || new RegExp(patternStr).test(paramVal);
                                      return (
                                        <div key={param.id} className="param-edit-card" style={{ border: '1px solid var(--color-border)', borderRadius: '6px', padding: '12px', background: 'var(--color-surface-2)' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-accent)' }}>PARAMETER</span>
                                            {catalogId && (
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteParam(sub.id, param.id)}
                                                style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}
                                                title="Delete Parameter"
                                              >
                                                🗑️ Delete
                                              </button>
                                            )}
                                          </div>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                              <label style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>ID</label>
                                              {catalogId ? (
                                                <DebouncedInput
                                                  type="text"
                                                  className="form-input form-input-xs"
                                                  style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--color-surface)' }}
                                                  value={param.id}
                                                  onChange={(e) => handleParamChange(param.id, 'id', e.target.value)}
                                                  placeholder="e.g. ac-2.1_prm_1"
                                                />
                                              ) : (
                                                <code>{param.id}</code>
                                              )}
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                              <label style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>CONSTRAINT DESCRIPTION / LABEL</label>
                                              <DebouncedInput
                                                type="text"
                                                className="form-input form-input-xs"
                                                style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--color-surface)' }}
                                                value={param.label || ''}
                                                onChange={(e) => handleParamChange(param.id, 'label', e.target.value)}
                                                placeholder="Constraint description..."
                                                disabled={!catalogId}
                                              />
                                            </div>

                                            {profileId && param.select?.choice && param.select.choice.length > 0 ? (
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <label style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>VALUE (SELECT FROM CHOICES)</label>
                                                <select
                                                  className="form-input"
                                                  style={{ 
                                                    padding: '4px 8px', 
                                                    fontSize: '12px', 
                                                    height: '30px', 
                                                    background: 'var(--color-surface)',
                                                    border: !isValid ? '1px solid var(--color-danger)' : '1px solid var(--color-border)',
                                                    borderRadius: '4px',
                                                    color: 'var(--color-text)'
                                                  }}
                                                  value={param.values?.[0] || ''}
                                                  onChange={(e) => handleParamChange(param.id, 'values', e.target.value)}
                                                >
                                                  <option value="">-- Select Value --</option>
                                                  {param.select.choice.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                  ))}
                                                </select>
                                              </div>
                                            ) : (
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <label style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
                                                  {catalogId ? 'DEFAULT VALUES (COMMA-SEPARATED)' : 'VALUE'}
                                                </label>
                                                <DebouncedInput
                                                  type="text"
                                                  className="form-input form-input-xs"
                                                  style={{ 
                                                    padding: '4px 8px', 
                                                    fontSize: '12px', 
                                                    background: 'var(--color-surface)',
                                                    border: !isValid ? '1px solid var(--color-danger)' : '1px solid var(--color-border)'
                                                  }}
                                                  value={paramVal}
                                                  onChange={(e) => handleParamChange(param.id, 'values', e.target.value)}
                                                  placeholder={catalogId ? "e.g. Value 1, Value 2" : "Set tailored value..."}
                                                />
                                              </div>
                                            )}

                                            {!catalogId && patternStr && paramVal && !isValid && (
                                              <span style={{ fontSize: '11px', color: 'var(--color-danger)', marginTop: '2px' }}>
                                                ❌ Value does not match regex pattern: <code>{patternStr}</code>
                                              </span>
                                            )}

                                            {catalogId && (
                                              <>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                  <label style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>CHOICES (COMMA-SEPARATED)</label>
                                                  <DebouncedInput
                                                    type="text"
                                                    className="form-input form-input-xs"
                                                    style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--color-surface)' }}
                                                    value={choicesStr}
                                                    onChange={(e) => handleParamChange(param.id, 'choices', e.target.value)}
                                                    placeholder="e.g. choice1, choice2"
                                                  />
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                  <label style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>VALIDATION REGEX PATTERN</label>
                                                  <DebouncedInput
                                                    type="text"
                                                    className="form-input form-input-xs"
                                                    style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--color-surface)' }}
                                                    value={patternStr}
                                                    onChange={(e) => handleParamChange(param.id, 'pattern', e.target.value)}
                                                    placeholder="e.g. ^[0-9]+ Tage$"
                                                  />
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <table className="params-table" style={{ marginTop: '4px' }}>
                                    <tbody>
                                      {sub.params.map(param => (
                                        <tr key={param.id}>
                                          <td className="param-id-cell"><code>{param.id}</code></td>
                                          <td className="param-desc-cell">
                                            <span className="param-label-text">{param.label || 'Parameter constraint'}</span>
                                            {param.values && (
                                              <div className="param-values-box">
                                                <code>{param.values.join(', ')}</code>
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          ) : selectedGroup ? (
            <div className="control-detail-view group-detail-view" style={{ padding: '20px', background: 'var(--color-surface)', borderRadius: '8px', border: '1px solid var(--color-border)', minHeight: '300px' }}>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <header style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                      <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Group ID</label>
                      <DebouncedInput
                        type="text"
                        className="form-input"
                        value={selectedGroup.id || ''}
                        onChange={(e) => handleUpdateGroupMetadata(selectedGroup.id, 'id', e.target.value)}
                        placeholder="Group ID (e.g. ac)"
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 2 }}>
                      <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Group Title</label>
                      <DebouncedInput
                        type="text"
                        className="form-input"
                        value={selectedGroup.title || ''}
                        onChange={(e) => handleUpdateGroupMetadata(selectedGroup.id, 'title', e.target.value)}
                        placeholder="Group Title"
                      />
                    </div>
                  </header>

                  {/* Group Parts / Description */}
                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Description / Prose</label>
                      <button
                        type="button"
                        className="btn-secondary btn-xs"
                        onClick={() => handleUpdateGroupParts(selectedGroup.id, -1, 'description', '')}
                      >
                        ➕ Add Paragraph
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(selectedGroup.parts || []).map((part, pIdx) => (
                        <div key={pIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <DebouncedTextarea
                            className="form-input form-textarea"
                            rows={2}
                            style={{ flex: 1 }}
                            value={part.prose || ''}
                            onChange={(e) => handleUpdateGroupParts(selectedGroup.id, pIdx, 'prose', e.target.value)}
                            placeholder="Enter description..."
                          />
                          <button
                            type="button"
                            className="btn-delete btn-xs"
                            onClick={() => handleUpdateGroupParts(selectedGroup.id, pIdx, null, '')}
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Group Properties */}
                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Properties</label>
                      <button
                        type="button"
                        className="btn-secondary btn-xs"
                        onClick={() => handleUpdateGroupProps(selectedGroup.id, -1, '', '')}
                      >
                        ➕ Add Prop
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(selectedGroup.props || []).map((prop, prIdx) => (
                        <div key={prIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <DebouncedInput
                            type="text"
                            className="form-input form-input-xs"
                            style={{ flex: 1 }}
                            value={prop.name || ''}
                            onChange={(e) => handleUpdateGroupProps(selectedGroup.id, prIdx, 'name', e.target.value)}
                            placeholder="Name"
                          />
                          <DebouncedInput
                            type="text"
                            className="form-input form-input-xs"
                            style={{ flex: 1 }}
                            value={prop.value || ''}
                            onChange={(e) => handleUpdateGroupProps(selectedGroup.id, prIdx, 'value', e.target.value)}
                            placeholder="Value"
                          />
                          <button
                            type="button"
                            className="btn-delete btn-xs"
                            onClick={() => handleUpdateGroupProps(selectedGroup.id, prIdx, null, '')}
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Group Links */}
                  <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Links / References</label>
                      <button
                        type="button"
                        className="btn-secondary btn-xs"
                        onClick={() => handleUpdateGroupLinks(selectedGroup.id, -1, '', '')}
                      >
                        ➕ Add Link
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(selectedGroup.links || []).map((link, lIdx) => {
                        const resources = rawDoc?.catalog?.['back-matter']?.resources || rawDoc?.profile?.['back-matter']?.resources || [];
                        return (
                          <div key={lIdx} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', border: '1px dashed var(--color-border)', padding: '6px', borderRadius: '4px' }}>
                            <DebouncedInput
                              type="text"
                              className="form-input form-input-xs"
                              style={{ flex: '1 1 120px' }}
                              value={link.text || ''}
                              onChange={(e) => handleUpdateGroupLinks(selectedGroup.id, lIdx, 'text', e.target.value)}
                              placeholder="Link Text"
                            />
                            <select
                              className="form-input"
                              style={{ flex: '1 1 100px', height: '28px', fontSize: '12px' }}
                              value={link.rel || 'reference'}
                              onChange={(e) => handleUpdateGroupLinks(selectedGroup.id, lIdx, 'rel', e.target.value)}
                            >
                              <option value="reference">reference</option>
                              <option value="alternate">alternate</option>
                            </select>
                            {link.rel === 'reference' && resources.length > 0 ? (
                              <select
                                className="form-input"
                                style={{ flex: '2 1 180px', height: '28px', fontSize: '12px' }}
                                value={link.href || ''}
                                onChange={(e) => handleUpdateGroupLinks(selectedGroup.id, lIdx, 'href', e.target.value)}
                              >
                                <option value="">-- Select Resource --</option>
                                {resources.map(r => (
                                  <option key={r.uuid} value={`#${r.uuid}`}>{r.title || r.uuid}</option>
                                ))}
                              </select>
                            ) : (
                              <DebouncedInput
                                type="text"
                                className="form-input form-input-xs"
                                style={{ flex: '2 1 180px' }}
                                value={link.href || ''}
                                onChange={(e) => handleUpdateGroupLinks(selectedGroup.id, lIdx, 'href', e.target.value)}
                                placeholder="https://..."
                              />
                            )}
                            <button
                              type="button"
                              className="btn-delete btn-xs"
                              onClick={() => handleUpdateGroupLinks(selectedGroup.id, lIdx, null, '')}
                            >
                              🗑️
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <header style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div className="control-id-badge" style={{ background: 'var(--color-accent)' }}>GROUP</div>
                    <h2 style={{ flex: 1, margin: 0 }}>{selectedGroup.title || selectedGroup.id}</h2>
                    <span className="control-class-badge" style={{ marginLeft: 'auto' }}>{selectedGroup.class || 'family'}</span>
                  </header>

                  {/* Prose Description */}
                  {selectedGroup.parts && selectedGroup.parts.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      {selectedGroup.parts.map((part, pIdx) => (
                        <p key={pIdx} style={{ fontSize: '14px', lineHeight: '1.6', margin: '0 0 12px 0', color: 'var(--color-text)' }}>{part.prose}</p>
                      ))}
                    </div>
                  )}

                  {/* Props and Links Box */}
                  {((selectedGroup.props && selectedGroup.props.length > 0) || (selectedGroup.links && selectedGroup.links.length > 0)) && (
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '12px', background: 'var(--color-surface-2)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                      {selectedGroup.props && selectedGroup.props.length > 0 && (
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <span style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Properties</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {selectedGroup.props.map((p, idx) => (
                              <span key={idx} style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                                <strong>{p.name}:</strong> {p.value}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedGroup.links && selectedGroup.links.length > 0 && (
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <span style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>References</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {selectedGroup.links.map((link, idx) => (
                              <a key={idx} href={link.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', fontSize: '11px', textDecoration: 'underline' }}>
                                {link.text || link.href}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            isEditing ? (
              <div className="catalog-metadata-overview editing">
                <div className="overview-icon">📝</div>
                <h2>Document Metadata</h2>

                {/* Sub-tabs header for profiles & catalogs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '24px', gap: '4px' }}>
                  {[
                    { id: 'metadata', label: '📝 Metadata' },
                    profileId && { id: 'sources', label: '📥 Imported Catalogs' },
                    !profileId && { id: 'sources', label: '📥 Import Source' },
                    { id: 'global-tags', label: '🏷️ Properties' },
                    { id: 'resources', label: '📚 Resources' }
                  ].filter(Boolean).map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setOverviewTab(tab.id);
                      }}
                      style={{
                        padding: '10px 16px',
                        border: 'none',
                        background: 'none',
                        borderBottom: overviewTab === tab.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                        color: overviewTab === tab.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '13px',
                        transition: 'all 0.15s ease',
                        outline: 'none'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* TAB CONTENT */}
                {/* 1. Metadata tab */}
                {overviewTab === 'metadata' && (
                  <>
                    <div className="edit-form-group">
                      <label className="form-label">Document Title</label>
                      <DebouncedInput
                        type="text"
                        className="form-input"
                        value={rawMetadata.title || ''}
                        onChange={(e) => handleMetadataChange('title', e.target.value)}
                        placeholder="Document Title"
                      />
                    </div>

                    <div className="edit-form-row">
                      <div className="edit-form-group">
                        <label className="form-label">Version</label>
                        <DebouncedInput
                          type="text"
                          className="form-input"
                          value={rawMetadata.version || ''}
                          onChange={(e) => handleMetadataChange('version', e.target.value)}
                          placeholder="e.g. 1.0.0"
                        />
                      </div>
                      <div className="edit-form-group">
                        <label className="form-label">OSCAL Version</label>
                        <DebouncedInput
                          type="text"
                          className="form-input"
                          value={rawMetadata['oscal-version'] || ''}
                          onChange={(e) => handleMetadataChange('oscal-version', e.target.value)}
                          placeholder="e.g. 1.1.2"
                        />
                      </div>
                    </div>

                    <div className="edit-form-group">
                      <label className="form-label">Remarks / Description</label>
                      <DebouncedTextarea
                        className="form-input form-textarea"
                        value={rawMetadata.remarks || ''}
                        onChange={(e) => handleMetadataChange('remarks', e.target.value)}
                        placeholder="Enter a description or remarks for this document..."
                        rows={3}
                      />
                    </div>

                    {/* Roles section */}
                    <div style={{ marginTop: '24px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-accent)' }}>Global Roles</h4>
                        <button
                          type="button"
                          className="btn-secondary btn-xs"
                          onClick={() => handleAddMetadataArrayItem('roles', { id: `role-${generateUUID().slice(0, 4)}`, title: 'New Role' })}
                        >
                          ➕ Add Role
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(rawMetadata.roles || []).map((role, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <DebouncedInput
                              type="text"
                              className="form-input"
                              style={{ flex: 1, fontSize: '12px', padding: '4px 8px' }}
                              value={role.id || ''}
                              onChange={(e) => handleUpdateMetadataArray('roles', idx, 'id', e.target.value)}
                              placeholder="Role ID (e.g. compliance)"
                            />
                            <DebouncedInput
                              type="text"
                              className="form-input"
                              style={{ flex: 2, fontSize: '12px', padding: '4px 8px' }}
                              value={role.title || ''}
                              onChange={(e) => handleUpdateMetadataArray('roles', idx, 'title', e.target.value)}
                              placeholder="Role Title"
                            />
                            <button
                              type="button"
                              className="btn-delete btn-xs"
                              onClick={() => handleDeleteMetadataArrayItem('roles', idx)}
                              style={{ padding: '6px 8px' }}
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Parties section */}
                    <div style={{ marginTop: '24px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-accent)' }}>Global Parties</h4>
                        <button
                          type="button"
                          className="btn-secondary btn-xs"
                          onClick={() => handleAddMetadataArrayItem('parties', { uuid: generateUUID(), type: 'person', name: 'New Person' })}
                        >
                          ➕ Add Party
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(rawMetadata.parties || []).map((party, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', border: '1px dashed var(--color-border)', padding: '8px', borderRadius: '6px', background: 'var(--color-surface-2)' }}>
                            <div style={{ flex: '1 1 100%', fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>UUID: {party.uuid}</div>
                            <select
                              className="form-input"
                              style={{ flex: '1 1 120px', fontSize: '12px', padding: '4px 8px', height: '28px' }}
                              value={party.type || 'person'}
                              onChange={(e) => handleUpdateMetadataArray('parties', idx, 'type', e.target.value)}
                            >
                              <option value="person">Person</option>
                              <option value="organization">Organization</option>
                            </select>
                            <DebouncedInput
                              type="text"
                              className="form-input"
                              style={{ flex: '2 1 180px', fontSize: '12px', padding: '4px 8px' }}
                              value={party.name || ''}
                              onChange={(e) => handleUpdateMetadataArray('parties', idx, 'name', e.target.value)}
                              placeholder="Name"
                            />
                            <button
                              type="button"
                              className="btn-delete btn-xs"
                              onClick={() => handleDeleteMetadataArrayItem('parties', idx)}
                              style={{ padding: '6px 8px' }}
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Locations section */}
                    <div style={{ marginTop: '24px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-accent)' }}>Locations</h4>
                        <button
                          type="button"
                          className="btn-secondary btn-xs"
                          onClick={() => handleAddMetadataArrayItem('locations', { uuid: generateUUID(), title: 'New Location' })}
                        >
                          ➕ Add Location
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(rawMetadata.locations || []).map((loc, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', border: '1px dashed var(--color-border)', padding: '8px', borderRadius: '6px', background: 'var(--color-surface-2)' }}>
                            <div style={{ flex: '1 1 100%', fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>UUID: {loc.uuid}</div>
                            <DebouncedInput
                              type="text"
                              className="form-input"
                              style={{ flex: 1, fontSize: '12px', padding: '4px 8px' }}
                              value={loc.title || ''}
                              onChange={(e) => handleUpdateMetadataArray('locations', idx, 'title', e.target.value)}
                              placeholder="Location Title"
                            />
                            <button
                              type="button"
                              className="btn-delete btn-xs"
                              onClick={() => handleDeleteMetadataArrayItem('locations', idx)}
                              style={{ padding: '6px 8px' }}
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Responsible Parties section */}
                    <div style={{ marginTop: '24px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', color: 'var(--color-accent)' }}>Responsible Parties (Metadata)</h4>
                        <button
                          type="button"
                          className="btn-secondary btn-xs"
                          onClick={() => handleAddMetadataArrayItem('responsible-parties', { 'role-id': '', 'party-uuids': [] })}
                        >
                          ➕ Add Responsibility
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(rawMetadata['responsible-parties'] || []).map((rp, idx) => (
                          <div key={idx} style={{ border: '1px solid var(--color-border)', padding: '8px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--color-surface-2)' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <select
                                className="form-input"
                                style={{ flex: 1, fontSize: '12px', padding: '4px 8px', height: '28px' }}
                                value={rp['role-id'] || ''}
                                onChange={(e) => handleUpdateMetadataArray('responsible-parties', idx, 'role-id', e.target.value)}
                              >
                                <option value="">-- Select Role --</option>
                                {(rawMetadata.roles || []).map(r => (
                                  <option key={r.id} value={r.id}>{r.title || r.id}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="btn-delete btn-xs"
                                onClick={() => handleDeleteMetadataArrayItem('responsible-parties', idx)}
                                style={{ padding: '6px 8px' }}
                              >
                                🗑️
                              </button>
                            </div>
                            <div style={{ fontSize: '11px' }}>
                              <strong>Select Parties:</strong>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                {(rawMetadata.parties || []).map(p => {
                                  const partyUuids = rp['party-uuids'] || [];
                                  const isChecked = partyUuids.includes(p.uuid);
                                  return (
                                    <label key={p.uuid} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--color-surface)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--color-border)' }}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          const nextUuids = isChecked
                                            ? partyUuids.filter(id => id !== p.uuid)
                                            : [...partyUuids, p.uuid];
                                          handleUpdateMetadataArray('responsible-parties', idx, 'party-uuids', nextUuids);
                                        }}
                                      />
                                      {p.name}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* 1b. Properties tab */}
                {overviewTab === 'global-tags' && (
                  <div style={{ paddingTop: '8px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
                      <span>🏷️ Global Properties</span>
                      <button 
                        type="button" 
                        className="btn-secondary btn-xs" 
                        onClick={handleCreateGlobalProperty}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', fontSize: '10px' }}
                      >
                        ➕ Add Global Property
                      </button>
                    </h3>
                    <div className="global-props-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                      {(!rawMetadata.props || rawMetadata.props.length === 0) ? (
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                          Keine globalen Properties definiert.
                        </div>
                      ) : (
                        rawMetadata.props.map((prop, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <DebouncedInput
                              type="text"
                              className="form-input form-input-xs"
                              style={{ flex: 1, padding: '4px 8px', fontSize: '12px', height: '28px' }}
                              value={prop.name}
                              onChange={(e) => handleUpdateGlobalProperty(idx, 'name', e.target.value)}
                              placeholder="Name"
                              list="catalog-prop-names"
                            />
                            <span style={{ color: 'var(--color-text-muted)' }}>:</span>
                            <DebouncedInput
                              type="text"
                              className="form-input form-input-xs"
                              style={{ flex: 1, padding: '4px 8px', fontSize: '12px', height: '28px' }}
                              value={prop.value}
                              onChange={(e) => handleUpdateGlobalProperty(idx, 'value', e.target.value)}
                              placeholder="Value"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteGlobalProperty(idx)}
                              style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '0 4px', fontSize: '14px' }}
                              title="Delete global property"
                            >
                              🗑
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <h3 style={{ fontSize: '14px', fontWeight: '700', marginTop: '24px', marginBottom: '12px', color: 'var(--color-text)' }}>
                      🔍 Used / Existing Properties
                    </h3>
                    <div className="existing-props-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {usedTagsInfo.length === 0 ? (
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                          No used properties found in the document.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {usedTagsInfo.map((tag) => {
                            const isAlreadyGlobal = rawMetadata.props?.some(p => p.name === tag.name);
                            return (
                              <div key={tag.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                <div>
                                  <span style={{ fontWeight: 'bold', marginRight: '8px' }}>{tag.name}</span>
                                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginRight: '16px' }}>({tag.count}x used)</span>
                                  {tag.values.length > 0 && (
                                    <select className="form-input" style={{ display: 'inline-block', width: 'auto', padding: '2px 8px', fontSize: '11px', height: '24px', verticalAlign: 'middle', background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text)' }}>
                                      <option>Values ({tag.values.length})</option>
                                      {tag.values.map(val => (
                                        <option key={val} value={val}>{val}</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                                {!isAlreadyGlobal ? (
                                  <button
                                    type="button"
                                    className="btn-secondary btn-xs"
                                    onClick={() => handleAddExistingTagToGlobal(tag.name, tag.values[0] || '')}
                                    style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    ➕ Add as global property
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '11px', color: 'var(--color-accent)', fontWeight: '600' }}>✓ Already global</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Imported Catalogs tab / Import Source tab */}
                {overviewTab === 'sources' && (
                  profileId ? (
                    <div style={{ paddingTop: '8px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        📥 Imported Catalogs
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {allCatalogsList.length === 0 ? (
                          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>No catalogs found in system.</div>
                        ) : allCatalogsList.map(cat => {
                          const catUuid = cat.catalog?.uuid;
                          const isImported = rawDoc?.profile?.imports?.some(imp => imp.href === `#${catUuid}` || imp.href.includes(catUuid));
                          return (
                            <div
                              key={catUuid}
                              style={{
                                padding: '12px',
                                borderRadius: '6px',
                                border: '1px solid',
                                borderColor: isImported ? 'var(--color-accent)' : 'var(--color-border)',
                                background: isImported ? 'color-mix(in srgb, var(--color-accent) 4%, transparent)' : 'var(--color-surface-2)',
                              }}
                            >
                              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                                <input
                                  type="checkbox"
                                  checked={!!isImported}
                                  onChange={(e) => {
                                    const isChecked = e.target.checked;
                                    updateDocumentState(doc => {
                                      if (!doc.profile.imports) doc.profile.imports = [];
                                      let imports = doc.profile.imports;
                                      if (isChecked) {
                                        if (!imports.some(imp => imp.href === `#${catUuid}` || imp.href.includes(catUuid))) {
                                          imports.push({ href: `#${catUuid}`, 'include-all': {} });
                                        }
                                      } else {
                                        imports = imports.filter(imp => imp.href !== `#${catUuid}` && !imp.href.includes(catUuid));
                                        doc.profile.imports = imports;
                                      }

                                      // Automatic default structure logic based on selected imports
                                      if (imports.length === 1) {
                                        const singleImport = imports[0];
                                        const match = singleImport.href.match(/([a-f0-9-]{36})/i);
                                        const singleUuid = match ? match[1]?.toLowerCase() : null;
                                        if (singleUuid) {
                                          const cat = cachedCatalogs.get(singleUuid);
                                          const catalogObj = cat?.data?.catalog || cat?.catalog;
                                          if (catalogObj) {
                                            if (!doc.profile.merge) doc.profile.merge = {};
                                            doc.profile.merge.custom = {
                                              defaultStructure: singleUuid,
                                              groups: cloneGroups(catalogObj.groups || [])
                                            };
                                            delete doc.profile.merge.flat;
                                          } else {
                                            // Set defaultStructure immediately; groups will be populated in useEffect once fetched
                                            if (!doc.profile.merge) doc.profile.merge = {};
                                            doc.profile.merge.custom = {
                                              defaultStructure: singleUuid,
                                              groups: []
                                            };
                                            delete doc.profile.merge.flat;
                                          }
                                        }
                                      } else {
                                        // 0 or multiple catalogs imported -> reset default structure
                                        if (doc.profile.merge) {
                                          delete doc.profile.merge.custom;
                                          delete doc.profile.merge.flat;
                                        }
                                      }
                                    });
                                  }}
                                  style={{ cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                                />
                                <div>
                                  <div style={{ fontWeight: '600' }}>{cat.catalog?.metadata?.title || 'Untitled Catalog'}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 'normal' }}>UUID: {catUuid}</div>
                                </div>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    renderCatalogImportTab()
                  )
                )}

                {overviewTab === 'resources' && (
                  <div style={{ paddingTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: 'var(--color-text)' }}>📚 Back-Matter Resources</h3>
                      <button
                        type="button"
                        className="btn-secondary btn-xs"
                        onClick={handleAddResource}
                      >
                        ➕ Add Resource
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {(!rawDoc?.catalog?.['back-matter']?.resources && !rawDoc?.profile?.['back-matter']?.resources) ||
                      ((rawDoc?.catalog?.['back-matter']?.resources || []).length === 0 && (rawDoc?.profile?.['back-matter']?.resources || []).length === 0) ? (
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                          Keine Ressourcen definiert.
                        </div>
                      ) : (
                        (rawDoc?.catalog?.['back-matter']?.resources || rawDoc?.profile?.['back-matter']?.resources || []).map((res, idx) => (
                          <div key={idx} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px', background: 'var(--color-surface-2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>UUID: {res.uuid}</span>
                              <button
                                type="button"
                                className="btn-delete btn-xs"
                                onClick={() => handleDeleteResource(idx)}
                                style={{ padding: '4px 6px' }}
                              >
                                🗑️
                              </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Title</label>
                              <DebouncedInput
                                type="text"
                                className="form-input form-input-xs"
                                value={res.title || ''}
                                onChange={(e) => handleUpdateResource(idx, 'title', e.target.value)}
                                placeholder="Resource Title"
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Description</label>
                              <DebouncedTextarea
                                className="form-input form-textarea"
                                rows={2}
                                value={res.description || ''}
                                onChange={(e) => handleUpdateResource(idx, 'description', e.target.value)}
                                placeholder="Description"
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontSize: '10px', fontWeight: 'bold' }}>Citation / Source Text</label>
                              <DebouncedInput
                                type="text"
                                className="form-input form-input-xs"
                                value={res.citation?.text || ''}
                                onChange={(e) => {
                                  const cit = res.citation || {};
                                  handleUpdateResource(idx, 'citation', { ...cit, text: e.target.value });
                                }}
                                placeholder="e.g. NIST SP 800-53 Rev. 5"
                              />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div className="select-prompt" style={{ marginTop: '24px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                  <p>💡 Select a control from the sidebar to edit its statements, parameters, or guidance.</p>
                </div>
              </div>
            ) : (
              <div className="catalog-metadata-overview">
                <div className="overview-icon">📖</div>
                <h2>{metadata.title || 'Untitled Catalog'}</h2>

                {/* Sub-tabs header for profiles & catalogs in read-only mode */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '24px', gap: '4px' }}>
                  {[
                    { id: 'metadata', label: '📝 Metadata' },
                    profileId && { id: 'sources', label: '📥 Imported Catalogs' },
                    { id: 'global-tags', label: '🏷️ Properties' },
                    { id: 'resources', label: '📚 Resources' }
                  ].filter(Boolean).map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setOverviewTab(tab.id)}
                      style={{
                        padding: '10px 16px',
                        border: 'none',
                        background: 'none',
                        borderBottom: overviewTab === tab.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                        color: overviewTab === tab.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '13px',
                        transition: 'all 0.15s ease',
                        outline: 'none'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* TAB CONTENT (Read-Only) */}
                {/* 1. Metadata tab */}
                {overviewTab === 'metadata' && (
                  <>
                    <p className="catalog-desc">{metadata.remarks || 'No remarks provided.'}</p>
                    
                    <div className="metadata-grid">
                      <div className="meta-card">
                        <span className="meta-label">Version</span>
                        <span className="meta-val">{metadata.version || '—'}</span>
                      </div>
                      <div className="meta-card">
                        <span className="meta-label">OSCAL Version</span>
                        <span className="meta-val">{metadata['oscal-version'] || '—'}</span>
                      </div>
                      <div className="meta-card">
                        <span className="meta-label">Last Modified</span>
                        <span className="meta-val">
                          {metadata['last-modified'] ? new Date(metadata['last-modified']).toLocaleDateString() : '—'}
                        </span>
                      </div>
                      <div className="meta-card">
                        <span className="meta-label">Total Controls</span>
                        <span className="meta-val">{allControls.length}</span>
                      </div>
                    </div>
                  </>
                )}

                {/* 1b. Tags tab */}
                {overviewTab === 'global-tags' && (
                  <div style={{ paddingTop: '8px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: 'var(--color-text)' }}>
                      🏷️ Global Properties
                    </h3>
                    <div className="global-props-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                      {(!rawMetadata.props || rawMetadata.props.length === 0) ? (
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                          Keine globalen Properties definiert.
                        </div>
                      ) : (
                        rawMetadata.props.map((prop, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontWeight: '600', fontSize: '12px', minWidth: '100px' }}>{prop.name}:</span>
                            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{prop.value}</span>
                          </div>
                        ))
                      )}
                    </div>

                    <h3 style={{ fontSize: '14px', fontWeight: '700', marginTop: '24px', marginBottom: '12px', color: 'var(--color-text)' }}>
                      🔍 Verwendete / Existierende Tags
                    </h3>
                    <div className="existing-props-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {usedTagsInfo.length === 0 ? (
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                          Keine verwendeten Tags im Dokument gefunden.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {usedTagsInfo.map((tag) => (
                            <div key={tag.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-surface-2)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                              <div>
                                <span style={{ fontWeight: 'bold', marginRight: '8px' }}>{tag.name}</span>
                                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginRight: '16px' }}>({tag.count}x verwendet)</span>
                                {tag.values.length > 0 && (
                                  <select disabled className="form-input" style={{ display: 'inline-block', width: 'auto', padding: '2px 8px', fontSize: '11px', height: '24px', verticalAlign: 'middle', background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-text)' }}>
                                    <option>Werte ({tag.values.length})</option>
                                    {tag.values.map(val => (
                                      <option key={val} value={val}>{val}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Imported Catalogs tab */}
                {profileId && overviewTab === 'sources' && (
                  <div style={{ paddingTop: '8px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: 'var(--color-text)' }}>
                      📥 Imported Catalogs
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {allCatalogsList.filter(cat => {
                        const catUuid = cat.catalog?.uuid;
                        return rawDoc?.profile?.imports?.some(imp => imp.href === `#${catUuid}` || imp.href.includes(catUuid));
                      }).map(cat => (
                        <div
                          key={cat.catalog?.uuid}
                          style={{
                            padding: '12px',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface-2)',
                          }}
                        >
                          <div style={{ fontWeight: '600' }}>{cat.catalog?.metadata?.title || 'Untitled Catalog'}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>UUID: {cat.catalog?.uuid}</div>
                        </div>
                      ))}
                      {(!rawDoc?.profile?.imports || rawDoc.profile.imports.length === 0) && (
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                          No imported catalogs available.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {overviewTab === 'resources' && (
                  <div style={{ paddingTop: '8px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: 'var(--color-text)' }}>
                      📚 Back-Matter Resources
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(!rawDoc?.catalog?.['back-matter']?.resources && !rawDoc?.profile?.['back-matter']?.resources) ||
                      ((rawDoc?.catalog?.['back-matter']?.resources || []).length === 0 && (rawDoc?.profile?.['back-matter']?.resources || []).length === 0) ? (
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                          Keine Ressourcen definiert.
                        </div>
                      ) : (
                        (rawDoc?.catalog?.['back-matter']?.resources || rawDoc?.profile?.['back-matter']?.resources || []).map((res, idx) => (
                          <div key={idx} style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                            <div style={{ fontWeight: '600' }}>{res.title || 'Untitled Resource'}</div>
                            {res.description && <div style={{ fontSize: '12px', marginTop: '4px' }}>{res.description}</div>}
                            {res.citation?.text && (
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                <strong>Quelle:</strong> {res.citation.text}
                              </div>
                            )}
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px', fontFamily: 'monospace' }}>UUID: {res.uuid}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div className="select-prompt">
                  <p>💡 Select a control from the sidebar to inspect its statements, parameters, guidance, and enhancements.</p>
                </div>
              </div>
            )
          )}
        </main>
        {showChangeLog && (
          <aside className="changelog-drawer" style={{ width: '320px', borderLeft: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '13px' }}>🕐 Version History</h4>
              <button className="btn-icon" onClick={() => setShowChangeLog(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '14px' }}>✕</button>
            </div>
            <div style={{ padding: '12px', fontSize: '10px', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
              Click on a version to view its state. To edit, switch to edit mode.
            </div>
            <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
              {versions.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '20px' }}>
                  No versions found.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {versions.map((verEntry) => {
                    const isActive = selectedVersion === verEntry.version;
                    const ts = verEntry['last-modified'] ? new Date(verEntry['last-modified']) : null;
                    return (
                      <div
                        key={verEntry.version}
                        style={{
                          display: 'flex',
                          alignItems: 'stretch',
                          gap: '4px',
                          width: '100%'
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleVersionChange(verEntry.version)}
                          style={{
                            flex: 1,
                            padding: '8px 10px',
                            borderRadius: '6px',
                            border: '1px solid',
                            borderColor: isActive ? 'var(--color-accent)' : 'var(--color-border-subtle)',
                            background: isActive ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'var(--color-surface-2)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '11px',
                            color: 'var(--color-text)',
                            transition: 'border-color 0.15s, background 0.15s',
                          }}
                          title={`Load version ${verEntry.version}`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <span style={{ fontWeight: '600', color: isActive ? 'var(--color-accent)' : 'inherit' }}>
                              Version {verEntry.version} {isActive ? ' (Active)' : ''}
                            </span>
                            <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>
                              {ts ? `${ts.toLocaleDateString()} ${ts.toLocaleTimeString()}` : ''}
                            </span>
                          </div>
                          <div style={{ color: 'var(--color-text-muted)', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {verEntry.remarks || 'No remarks'}
                          </div>
                        </button>
                        {!isActive && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteVersion(verEntry.version);
                            }}
                            style={{
                              padding: '0 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border-subtle)',
                              background: 'var(--color-surface-2)',
                              cursor: 'pointer',
                              color: '#ff4d4d',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              transition: 'background 0.15s',
                            }}
                            title="Delete version"
                            className="btn-delete-version"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        )}
        </>
        )}
      </div>

      {/* ── Version Save Modal ────────────────────────────────────────── */}
      {showDraftSaveModal && (
        <div className="editor-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="editor-panel" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px', width: '90%', maxWidth: '440px' }}>
            <div className="editor-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>💾 Save Version</h3>
              <button className="btn-icon" onClick={() => setShowDraftSaveModal(false)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <div className="editor-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Warnings/Context */}
              {(() => {
                const latestVersion = versions[0]?.version;
                const isEditingLatest = !latestVersion || selectedVersion === latestVersion;
                if (!isEditingLatest) {
                  return (
                    <div style={{ background: 'color-mix(in srgb, var(--color-warning, #f59e0b) 15%, transparent)', border: '1px solid var(--color-warning, #f59e0b)', borderRadius: '6px', padding: '10px 12px', fontSize: '12px', color: 'var(--color-text)' }}>
                      ⚠️ You are editing an older version (<b>{selectedVersion}</b>). Overwriting is locked. Please assign a new version number.
                    </div>
                  );
                } else {
                  return (
                    <div style={{ background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', border: '1px solid var(--color-accent)', borderRadius: '6px', padding: '10px 12px', fontSize: '12px', color: 'var(--color-text)' }}>
                      ℹ️ You are editing the latest version (<b>{selectedVersion}</b>). You can update (overwrite) it or assign a new version number.
                    </div>
                  );
                }
              })()}

              {/* Version Input */}
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                  Version Number <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-text)',
                    fontSize: '13px'
                  }}
                  placeholder="e.g., 1.0.0, 1.1.0"
                  value={saveVersionNumber}
                  onChange={(e) => setSaveVersionNumber(e.target.value)}
                  autoFocus
                />
                
                {/* Validation Feedback */}
                {(() => {
                  const latestVersion = versions[0]?.version;
                  const isEditingLatest = !latestVersion || selectedVersion === latestVersion;
                  const isDuplicate = versions.some(v => v.version === saveVersionNumber.trim()) && saveVersionNumber.trim() !== selectedVersion;
                  
                  if (isDuplicate) {
                    return (
                      <div style={{ color: 'var(--color-danger, #ef4444)', fontSize: '11px', marginTop: '4px' }}>
                        ⚠️ This version number already exists. Please choose another one.
                      </div>
                    );
                  }
                  if (!isEditingLatest && saveVersionNumber.trim() === selectedVersion) {
                    return (
                      <div style={{ color: 'var(--color-danger, #ef4444)', fontSize: '11px', marginTop: '4px' }}>
                        ⚠️ Older versions cannot be overwritten.
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Remarks Input */}
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                  Remarks / Changelog <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted)' }}>(optional)</span>
                </label>
                <textarea
                  className="form-textarea"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-2)',
                    color: 'var(--color-text)',
                    fontSize: '13px'
                  }}
                  placeholder="What was changed in this version?"
                  rows={3}
                  value={draftRemark}
                  onChange={(e) => setDraftRemark(e.target.value)}
                  onKeyDown={(e) => {
                    const latestVersion = versions[0]?.version;
                    const isEditingLatest = !latestVersion || selectedVersion === latestVersion;
                    const isDuplicate = versions.some(v => v.version === saveVersionNumber.trim()) && saveVersionNumber.trim() !== selectedVersion;
                    const isInvalid = !saveVersionNumber.trim() || isDuplicate || (!isEditingLatest && saveVersionNumber.trim() === selectedVersion);
                    
                    if (e.key === 'Enter' && e.ctrlKey && !isInvalid) handleConfirmSaveVersion();
                    if (e.key === 'Escape') setShowDraftSaveModal(false);
                  }}
                />
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Ctrl+Enter to confirm, Esc to cancel</div>
              </div>
            </div>
            <div className="editor-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginTop: '16px' }}>
              <button className="btn-secondary" onClick={() => setShowDraftSaveModal(false)}>Cancel</button>
              {(() => {
                const latestVersion = versions[0]?.version;
                const isEditingLatest = !latestVersion || selectedVersion === latestVersion;
                const isDuplicate = versions.some(v => v.version === saveVersionNumber.trim()) && saveVersionNumber.trim() !== selectedVersion;
                const isInvalid = !saveVersionNumber.trim() || isDuplicate || (!isEditingLatest && saveVersionNumber.trim() === selectedVersion);
                
                return (
                  <button
                    className="btn-primary"
                    disabled={isInvalid || saving}
                    onClick={handleConfirmSaveVersion}
                  >
                    💾 Save Version
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
