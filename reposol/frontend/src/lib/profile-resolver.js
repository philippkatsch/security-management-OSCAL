/**
 * profile-resolver.js
 * Complete OSCAL profile resolution engine.
 *
 * Extracted from CatalogViewer.jsx (lines 3–535).
 *
 * This module resolves an OSCAL profile document into a virtual catalog by:
 *   1. Fetching all imported catalogs and profiles (recursively).
 *   2. Filtering controls by include/exclude rules and glob patterns.
 *   3. Merging imports (as-is, flat, or custom grouping).
 *   4. Applying profile modifications (set-parameters, alters).
 *   5. Reordering control keys to OSCAL standard order.
 *
 * Exported functions:
 *   - applyModify(catalog, modify)
 *   - fetchImportedCatalogs(profileDoc, cache)
 *   - resolveProfileSync(profileDoc, cache, keepAll)
 *   - matchesPattern(controlId, patterns)
 *   - filterControls(controls, includeAll, includedIds, includePatterns, excludedIds, excludePatterns, keepAll)
 *   - filterGroups(groups, includeAll, includedIds, includePatterns, excludedIds, excludePatterns, keepAll)
 */

import { reorderCatalog } from './oscal-utils.js';
import { authFetch } from './api.js';

// ---------------------------------------------------------------------------
// Pattern matching
// ---------------------------------------------------------------------------

/**
 * Test whether a control ID matches any of the given glob patterns.
 * Patterns use `*` as a wildcard (mapped to `.*` in regex).
 *
 * @param {string}   controlId - The control ID to test.
 * @param {string[]} patterns  - Array of glob pattern strings.
 * @returns {boolean}
 */
export function matchesPattern(controlId, patterns) {
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
}

// ---------------------------------------------------------------------------
// Control / group filtering
// ---------------------------------------------------------------------------

/**
 * Filter an array of controls based on include/exclude rules.
 *
 * When `keepAll` is true, excluded controls are retained but marked with
 * `isControlInactive: true` (used in the CatalogViewer editing mode so
 * the user can see which controls are excluded).
 *
 * @param {Array}   controls        - Array of OSCAL control objects.
 * @param {boolean} includeAll      - If true, all controls are included unless excluded.
 * @param {Set}     includedIds     - Set of lowercase control IDs to include.
 * @param {Array}   includePatterns - Glob patterns for inclusion.
 * @param {Set}     excludedIds     - Set of lowercase control IDs to exclude.
 * @param {Array}   excludePatterns - Glob patterns for exclusion.
 * @param {boolean} [keepAll=false] - If true, keep excluded controls marked inactive.
 * @returns {Array} Filtered (or annotated) control array.
 */
export function filterControls(controls, includeAll, includedIds, includePatterns, excludedIds, excludePatterns, keepAll = false, withChildControls = true, depth = 0) {
  if (!controls) return [];
  return controls.map(c => {
    const controlIdLower = c.id.toLowerCase();
    const hasInclusions = includedIds.size > 0 || includePatterns.length > 0;

    const hasIncludedChild = (ctrl) => {
      if (includedIds.has(ctrl.id.toLowerCase())) return true;
      if (matchesPattern(ctrl.id, includePatterns)) return true;
      if (ctrl.controls) {
        return ctrl.controls.some(sub => hasIncludedChild(sub));
      }
      return false;
    };

    let isIncluded;
    if (depth > 0 && !withChildControls) {
      isIncluded = includedIds.has(controlIdLower) || matchesPattern(c.id, includePatterns) || (c.controls && c.controls.some(sub => hasIncludedChild(sub)));
    } else {
      isIncluded = includeAll || !hasInclusions || hasIncludedChild(c);
    }

    const isExcluded = excludedIds.has(controlIdLower) || matchesPattern(c.id, excludePatterns);

    const isActive = isIncluded && !isExcluded;
    if (!isActive && !keepAll) return null;

    const filteredSub = filterControls(c.controls, includeAll, includedIds, includePatterns, excludedIds, excludePatterns, keepAll, withChildControls, depth + 1);
    return {
      ...c,
      isControlInactive: !isActive,
      controls: filteredSub.length > 0 ? filteredSub : undefined,
    };
  }).filter(Boolean);
}

/**
 * Filter an array of groups (and their nested groups/controls).
 *
 * @param {Array}   groups          - Array of OSCAL group objects.
 * @param {boolean} includeAll      - If true, all controls are included unless excluded.
 * @param {Set}     includedIds     - Set of lowercase control IDs to include.
 * @param {Array}   includePatterns - Glob patterns for inclusion.
 * @param {Set}     excludedIds     - Set of lowercase control IDs to exclude.
 * @param {Array}   excludePatterns - Glob patterns for exclusion.
 * @param {boolean} [keepAll=false] - If true, keep excluded controls marked inactive.
 * @returns {Array} Filtered (or annotated) group array.
 */
export function filterGroups(groups, includeAll, includedIds, includePatterns, excludedIds, excludePatterns, keepAll = false, withChildControls = true) {
  if (!groups) return [];
  return groups.map(g => {
    const filteredSubGroups = filterGroups(g.groups, includeAll, includedIds, includePatterns, excludedIds, excludePatterns, keepAll, withChildControls);
    const filteredCtrls = filterControls(g.controls, includeAll, includedIds, includePatterns, excludedIds, excludePatterns, keepAll, withChildControls, 0);
    if (!keepAll && filteredSubGroups.length === 0 && filteredCtrls.length === 0) return null;
    return {
      ...g,
      groups: filteredSubGroups.length > 0 ? filteredSubGroups : undefined,
      controls: filteredCtrls.length > 0 ? filteredCtrls : undefined,
    };
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Profile modification (set-parameters & alters)
// ---------------------------------------------------------------------------

/**
 * Apply profile `modify` directives to a resolved catalog.
 * Mutates the catalog in place.
 *
 * Handles:
 *   - `set-parameters` (override param values/labels)
 *   - `alters` (add/remove parts, props, params, links, controls)
 *   - `title-override` / `id-override` props
 *
 * @param {Object} catalog - The catalog object to modify.
 * @param {Object} modify  - The profile's `modify` section.
 */
export function applyModify(catalog, modify) {
  if (!modify) return;
  const setParams = modify['set-parameters'] || [];
  const alters = modify.alters || [];
  const paramMap = new Map(setParams.map(p => [(p['param-id'] || p.id)?.toLowerCase(), p]).filter(([k]) => Boolean(k)));
  const alterMap = new Map(alters.map(a => [a['control-id']?.toLowerCase(), a]));

  const mergeParamOverride = (param, override) => {
    if (!override) return param;
    const merged = { ...param };
    const fieldsToMerge = [
      'values',
      'label',
      'select',
      'constraints',
      'guidelines',
      'class',
      'props',
      'links',
      'usage',
      'remarks'
    ];
    fieldsToMerge.forEach(field => {
      if (override[field] !== undefined) {
        merged[field] = override[field];
      }
    });
    return merged;
  };

  const applyParamOverrides = (paramsList) => {
    if (!paramsList || !Array.isArray(paramsList)) return paramsList;
    return paramsList.map(param => {
      const pid = (param.id || param['param-id'])?.toLowerCase();
      const override = pid ? paramMap.get(pid) : null;
      return override ? mergeParamOverride(param, override) : param;
    });
  };

  const applyAltersToParts = (partsList, adds, removes) => {
    let result = partsList ? [...partsList] : [];

    // Apply adds before removes so a replacement part can be positioned
    // relative to the original part, then remove that original part.
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
              } else if (add.position === 'before' && add['by-id']) {
                const targetIdx = result.findIndex(p => p.id === add['by-id']);
                if (targetIdx >= 0) {
                  result.splice(targetIdx, 0, newPart);
                } else {
                  result.push(newPart);
                }
              } else if (add.position === 'after' && add['by-id']) {
                const targetIdx = result.findIndex(p => p.id === add['by-id']);
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
        if (remove['by-id']) {
          result = result.filter(p => p.id !== remove['by-id']);
        }
        if (remove['by-name']) {
          result = result.filter(p => p.name !== remove['by-name']);
        }
      });
    }

    // Recurse into nested parts
    return result.map(p => {
      if (p.parts) {
        return {
          ...p,
          parts: applyAltersToParts(p.parts, adds, removes),
        };
      }
      return p;
    });
  };

  const traverseControl = (ctrl) => {
    // Apply parameter overrides
    if (ctrl.params) {
      ctrl.params = applyParamOverrides(ctrl.params);
    }

    // Apply alter directives
    const alter = alterMap.get(ctrl.id?.toLowerCase());
    if (alter) {
      if (alter.removes) {
        alter.removes.forEach(remove => {
          if (remove['by-name']) {
            if (ctrl.props) ctrl.props = ctrl.props.filter(p => p.name !== remove['by-name']);
          }
          if (remove['by-id']) {
            if (ctrl.params) ctrl.params = ctrl.params.filter(p => p.id !== remove['by-id']);
            if (ctrl.links) ctrl.links = ctrl.links.filter(l => l.href !== remove['by-id'] && l.id !== remove['by-id']);
            if (ctrl.controls) ctrl.controls = ctrl.controls.filter(c => c.id !== remove['by-id']);
          }
          if (remove['by-item-name']) {
            if (remove['by-item-name'] === 'link' && ctrl.links) ctrl.links = [];
            if (remove['by-item-name'] === 'prop' && ctrl.props) ctrl.props = [];
          }
        });
      }

      if (ctrl.parts) {
        ctrl.parts = applyAltersToParts(ctrl.parts, alter.adds, alter.removes);
      }

      // Apply non-part additions (props, params, links, controls at control level)
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
    if (group.params) {
      group.params = applyParamOverrides(group.params);
    }
    if (group.controls) {
      group.controls.forEach(traverseControl);
    }
    if (group.groups) {
      group.groups.forEach(traverseGroup);
    }
  };

  if (catalog.params) {
    catalog.params = applyParamOverrides(catalog.params);
  }
  if (catalog.controls) {
    catalog.controls.forEach(traverseControl);
  }
  if (catalog.groups) {
    catalog.groups.forEach(traverseGroup);
  }
}

// ---------------------------------------------------------------------------
// Catalog fetching for profile resolution
// ---------------------------------------------------------------------------

/**
 * Recursively fetch all catalogs and profiles referenced by a profile's imports.
 *
 * This queries the backend to discover available catalogs and profiles, then
 * fetches each imported document (and recursively resolves nested profile
 * imports).
 *
 * Results are cached in a `Map<string, { type: string, data: Object }>` keyed
 * by lowercase UUID.
 *
 * @param {Object}      profileDoc          - The OSCAL profile document.
 * @param {Map}         [cache=new Map()]   - Existing cache to extend.
 * @param {Function}    [fetchFn=fetch]     - Optional custom fetch function (for testing).
 * @returns {Promise<Map>} The populated cache.
 */
export async function fetchImportedCatalogs(profileDoc, cache = new Map(), fetchFn = authFetch) {
  const profile = profileDoc.profile;
  if (!profile) return cache;
  const imports = profile.imports || [];

  let availableCatalogs = new Set();
  let availableProfiles = new Set();
  let registryTemplates = [];
  try {
    const listRes = await fetchFn('/api/documents/catalogs');
    if (listRes.ok) {
      const listData = await listRes.json();
      listData.forEach(doc => {
        if (doc.catalog && doc.catalog.uuid) {
          availableCatalogs.add(doc.catalog.uuid.toLowerCase());
        }
      });
    }
    const listProf = await fetchFn('/api/documents/profiles');
    if (listProf.ok) {
      const listProfData = await listProf.json();
      listProfData.forEach(doc => {
        if (doc.profile && doc.profile.uuid) {
          availableProfiles.add(doc.profile.uuid.toLowerCase());
        }
      });
    }
    const regRes = await fetchFn('/api/import/registry');
    if (regRes.ok) {
      registryTemplates = await regRes.json();
    }
  } catch (err) {
    console.error('Error listing documents or registry for profile resolution:', err);
  }

  await Promise.all(
    imports.map(async (imp) => {
      const match = imp.href ? imp.href.match(/([a-f0-9-]{36})/i) : null;
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

      let targetUuid = uuidLower;
      let targetType = null;

      // Check if this import refers to a back-matter resource
      if (imp.href && imp.href.startsWith('#')) {
        const resourceId = imp.href.substring(1).toLowerCase();
        const resources = profile.metadata?.resources || profile['back-matter']?.resources || [];
        const resource = resources.find(r => (r.uuid || '').toLowerCase() === resourceId || (r.id || '').toLowerCase() === resourceId);
        
        if (resource && resource.rlinks) {
          for (const rlink of resource.rlinks) {
            const rlinkHref = rlink.href || '';
            
            // 1. Try to extract UUID from rlink href
            const rlinkMatch = rlinkHref.match(/([a-f0-9-]{36})/i);
            if (rlinkMatch) {
              const rlinkUuid = rlinkMatch[1].toLowerCase();
              if (availableCatalogs.has(rlinkUuid)) {
                targetUuid = rlinkUuid;
                targetType = 'catalog';
                break;
              } else if (availableProfiles.has(rlinkUuid)) {
                targetUuid = rlinkUuid;
                targetType = 'profile';
                break;
              }
            }

            // 2. Try to match the filename of rlink href to registry templates
            const rlinkFilename = rlinkHref.split('/').pop()?.toLowerCase();
            if (rlinkFilename) {
              const matchedTemplate = registryTemplates.find(t => {
                const templateFilename = t.url?.split('/').pop()?.toLowerCase();
                return templateFilename === rlinkFilename;
              });
              if (matchedTemplate && matchedTemplate.uuid) {
                const templateUuid = matchedTemplate.uuid.toLowerCase();
                if (availableCatalogs.has(templateUuid)) {
                  targetUuid = templateUuid;
                  targetType = 'catalog';
                  break;
                } else if (availableProfiles.has(templateUuid)) {
                  targetUuid = templateUuid;
                  targetType = 'profile';
                  break;
                }
              }
            }
          }
        }
      }

      if (!targetType) {
        if (imp.href && (imp.href.includes('/catalogs/') || imp.href.includes('catalogs/'))) {
          targetType = 'catalog';
        } else if (imp.href && (imp.href.includes('/profiles/') || imp.href.includes('profiles/'))) {
          targetType = 'profile';
        } else if (availableCatalogs.has(targetUuid)) {
          targetType = 'catalog';
        } else if (availableProfiles.has(targetUuid)) {
          targetType = 'profile';
        }
      }

      if (targetType === 'catalog') {
        try {
          const res = await fetchFn(`/api/documents/catalogs/${targetUuid}`);
          if (res.ok) {
            const data = await res.json();
            cache.set(uuidLower, { type: 'catalog', data });
          }
        } catch (err) {
          console.error('Error fetching imported catalog:', err);
        }
      } else if (targetType === 'profile') {
        try {
          const res = await fetchFn(`/api/documents/profiles/${targetUuid}`);
          if (res.ok) {
            const data = await res.json();
            cache.set(uuidLower, { type: 'profile', data });
            await fetchImportedCatalogs(data, cache, fetchFn);
          }
        } catch (err) {
          console.error('Error fetching imported profile:', err);
        }
      }
    })
  );
  return cache;
}

// ---------------------------------------------------------------------------
// Synchronous profile resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a profile document into a virtual catalog using a pre-populated cache.
 *
 * This is a synchronous operation — all referenced catalogs/profiles must
 * already be present in `cache` (populated by `fetchImportedCatalogs`).
 *
 * @param {Object}  profileDoc - The OSCAL profile document.
 * @param {Map}     cache      - Map of UUID → { type, data } for imported documents.
 * @param {boolean} [keepAll=false] - If true, inactive controls are marked rather than removed.
 * @returns {{ catalog: Object }} Resolved virtual catalog wrapper.
 */
export function resolveProfileSync(profileDoc, cache, keepAll = false) {
  const profile = profileDoc.profile;
  if (!profile) return { catalog: {} };
  const imports = profile.imports || [];

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
      const res = resolveProfileSync(realDoc, cache, keepAll);
      resolvedImportedCatalog = res.catalog;
    }
    if (!resolvedImportedCatalog) continue;

    // Parse import filtering rules
    const includeAll = imp['include-all'] !== undefined;
    const includedIds = new Set(
      (imp['include-controls'] || []).flatMap(ic => (ic['with-ids'] || []).map(id => id.toLowerCase()))
    );
    const includePatterns = (imp['include-controls'] || []).flatMap(
      ic => (ic['matching'] || []).map(m => m.pattern).filter(Boolean)
    );
    const excludedIds = new Set(
      (imp['exclude-controls'] || []).flatMap(ec => (ec['with-ids'] || []).map(id => id.toLowerCase()))
    );
    const excludePatterns = (imp['exclude-controls'] || []).flatMap(ec => {
      const directPatterns = ec['matching-patterns'] || [];
      const matchingObjs = (ec['matching'] || []).map(m => m.pattern).filter(Boolean);
      return [...directPatterns, ...matchingObjs];
    });

    const withChildControls = imp['with-child-controls'] !== 'no';

    if (resolvedImportedCatalog.groups) {
      allMergedGroups.push(
        ...filterGroups(resolvedImportedCatalog.groups, includeAll, includedIds, includePatterns, excludedIds, excludePatterns, keepAll, withChildControls)
      );
    }
    if (resolvedImportedCatalog.controls) {
      allMergedControls.push(
        ...filterControls(resolvedImportedCatalog.controls, includeAll, includedIds, includePatterns, excludedIds, excludePatterns, keepAll, withChildControls, 0)
      );
    }
  }

  // Append local controls
  const localControls = profile['local-controls'] || [];
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

  // Collect all controls flatly for lookup by ID
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

  // Build resolved catalog based on merge strategy
  const merge = profile.merge || {};
  let resolvedCatalog;

  if (merge.flat) {
    resolvedCatalog = {
      uuid: profile.uuid,
      metadata: { ...profile.metadata, title: `${profile.metadata.title} (Resolved Profile)` },
      controls: Array.from(flatControlsMap.values()).map(c => ({ ...c, controls: undefined })),
    };
  } else if (merge.custom && ((merge.custom.groups && merge.custom.groups.length > 0) || merge.custom['insert-controls'])) {
    const resolveCustomGroup = (g) => {
      const groupCtrls = [];
      // Normalize insert-controls to array (backward compat with object format)
      const icRaw = g['insert-controls'];
      const icArray = Array.isArray(icRaw) ? icRaw : (icRaw ? [icRaw] : []);
      
      icArray.forEach(ic => {
        if (ic['include-all'] !== undefined) {
          // Include all remaining controls into this group
          flatControlsMap.forEach((ctrl) => {
            if (!groupCtrls.some(existing => existing.id === ctrl.id)) {
              groupCtrls.push(ctrl);
            }
          });
        }
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
                  } catch (e) { /* ignore invalid regex */ }
                }
              });
            }
          });
        }
      });
      // Apply order
      icArray.forEach(ic => {
        if (ic.order === 'ascending') {
          groupCtrls.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
        } else if (ic.order === 'descending') {
          groupCtrls.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));
        }
      });
      const subGroups = g.groups ? g.groups.map(resolveCustomGroup) : undefined;
      return {
        id: g.id,
        title: g.title,
        props: g.props,
        links: g.links,
        parts: g.parts,
        controls: groupCtrls.length > 0 ? groupCtrls : undefined,
        groups: subGroups && subGroups.length > 0 ? subGroups : undefined,
      };
    };
    const customGroups = (merge.custom.groups || []).map(resolveCustomGroup);
    
    // Resolve top-level insert-controls
    const topLevelCtrls = [];
    const topIcRaw = merge.custom['insert-controls'];
    const topIcArray = Array.isArray(topIcRaw) ? topIcRaw : (topIcRaw ? [topIcRaw] : []);
    
    topIcArray.forEach(ic => {
      if (ic['include-all'] !== undefined) {
        flatControlsMap.forEach((ctrl) => {
          if (!topLevelCtrls.some(existing => existing.id === ctrl.id)) topLevelCtrls.push(ctrl);
        });
      }
      if (ic['include-controls']) {
        ic['include-controls'].forEach(inc => {
          if (inc['with-ids']) {
            inc['with-ids'].forEach(id => {
              const ctrl = flatControlsMap.get(id.toLowerCase());
              if (ctrl) topLevelCtrls.push(ctrl);
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
                    if (regex.test(k) && !topLevelCtrls.some(existing => existing.id.toLowerCase() === k)) {
                      topLevelCtrls.push(flatControlsMap.get(k));
                    }
                  });
                } catch (e) { /* ignore invalid regex */ }
              }
            });
          }
        });
      }
      if (ic.order === 'ascending') {
        topLevelCtrls.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      } else if (ic.order === 'descending') {
        topLevelCtrls.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));
      }
    });

    resolvedCatalog = {
      uuid: profile.uuid,
      metadata: { ...profile.metadata, title: `${profile.metadata.title} (Resolved Profile)` },
      groups: customGroups.length > 0 ? customGroups : undefined,
      controls: topLevelCtrls.length > 0 ? topLevelCtrls : undefined,
    };
  } else {
    // Default (as-is)
    resolvedCatalog = {
      uuid: profile.uuid,
      metadata: { ...profile.metadata, title: `${profile.metadata.title} (Resolved Profile)` },
      groups: allMergedGroups.length > 0 ? allMergedGroups : undefined,
      controls: allMergedControls.length > 0 ? allMergedControls : undefined,
    };
  }

  // Apply modifications
  applyModify(resolvedCatalog, profile.modify);

  // Reorder keys to OSCAL standard order
  reorderCatalog(resolvedCatalog);

  return { catalog: resolvedCatalog };
}
