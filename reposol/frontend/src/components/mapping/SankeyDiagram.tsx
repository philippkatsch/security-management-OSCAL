import React, { useState, useMemo, useRef } from 'react';
import styles from './SankeyDiagram.module.css';
import { STATUS_CONFIG } from '@components/shared/status/statusConfig';

export interface SankeyControl {
  id: string;
  title?: string;
  group?: string;
}

export interface SankeyItemRef {
  'id-ref': string;
  type?: string;
}

export interface SankeyMapEntry {
  uuid: string;
  relationship: string;
  sources?: SankeyItemRef[];
  targets?: SankeyItemRef[];
  props?: Array<{ name: string; value: string }>;
  remarks?: string;
}

export interface SankeyDiagramProps {
  sourceControls: SankeyControl[];
  targetControls: SankeyControl[];
  maps: SankeyMapEntry[];
  selectedMapUuid?: string | null;
  onSelectMap?: (map: SankeyMapEntry) => void;
  filterRelationship?: string;
  sourceTitle?: string;
  targetTitle?: string;
}

export const RELATIONSHIP_COLORS: Record<string, string> = {
  'equal-to': 'hsl(270, 60%, 60%)',        // Purple
  'equivalent-to': 'hsl(142, 71%, 45%)',   // Green
  'subset-of': 'hsl(217, 91%, 60%)',      // Blue
  'superset-of': 'hsl(24, 98%, 53%)',     // Orange
  'intersects-with': 'hsl(45, 93%, 47%)', // Yellow
  'no-relationship': 'hsl(0, 72%, 51%)',  // Red
  'unmapped': 'hsl(0, 0%, 60%)'           // Gray
};

export function SankeyDiagram({
  sourceControls = [],
  targetControls = [],
  maps = [],
  selectedMapUuid,
  onSelectMap,
  filterRelationship: externalFilter = 'all',
  sourceTitle = 'Source Framework',
  targetTitle = 'Target Framework',
}: SankeyDiagramProps) {
  const [internalFilter, setInternalFilter] = useState<string>(externalFilter);
  const activeFilter = externalFilter !== 'all' ? externalFilter : internalFilter;

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showGaps, setShowGaps] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkKey, setHoveredLinkKey] = useState<string | null>(null);
  const [tooltipData, setTooltipData] = useState<{
    x: number;
    y: number;
    sourceId: string;
    targetId: string;
    relationship: string;
    confidence?: string;
    rationale?: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Filter maps based on relationship and search query
  const filteredMaps = useMemo(() => {
    return maps.filter((m) => {
      if (activeFilter !== 'all' && activeFilter !== 'unmapped-only') {
        if (m.relationship !== activeFilter) return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const srcMatch = m.sources?.some((s) => s['id-ref'].toLowerCase().includes(query));
        const tgtMatch = m.targets?.some((t) => t['id-ref'].toLowerCase().includes(query));
        const relMatch = m.relationship?.toLowerCase().includes(query);
        const remarkMatch = m.remarks?.toLowerCase().includes(query);
        if (!srcMatch && !tgtMatch && !relMatch && !remarkMatch) return false;
      }
      return true;
    });
  }, [maps, activeFilter, searchQuery]);

  // Identify mapped & unmapped controls
  const mappedSourceIds = useMemo(() => {
    const ids = new Set<string>();
    filteredMaps.forEach((m) => {
      m.sources?.forEach((s) => ids.add(s['id-ref']));
    });
    return ids;
  }, [filteredMaps]);

  const mappedTargetIds = useMemo(() => {
    const ids = new Set<string>();
    filteredMaps.forEach((m) => {
      m.targets?.forEach((t) => ids.add(t['id-ref']));
    });
    return ids;
  }, [filteredMaps]);

  const { mappedSources, unmappedSources } = useMemo(() => {
    const mapped: SankeyControl[] = [];
    const unmapped: SankeyControl[] = [];
    sourceControls.forEach((c) => {
      if (mappedSourceIds.has(c.id)) mapped.push(c);
      else unmapped.push(c);
    });
    return { mappedSources: mapped, unmappedSources: unmapped };
  }, [sourceControls, mappedSourceIds]);

  const { mappedTargets, unmappedTargets } = useMemo(() => {
    const mapped: SankeyControl[] = [];
    const unmapped: SankeyControl[] = [];
    targetControls.forEach((c) => {
      if (mappedTargetIds.has(c.id)) mapped.push(c);
      else unmapped.push(c);
    });
    return { mappedTargets: mapped, unmappedTargets: unmapped };
  }, [targetControls, mappedTargetIds]);

  // Node Dimensions and Coordinates
  const nodeWidth = 140;
  const nodeHeight = 30;
  const nodeGap = 8;
  const svgWidth = 900;
  const xSource = 40;
  const xTarget = svgWidth - 40 - nodeWidth;

  // Calculate layout nodes
  const { nodePositions, totalHeight } = useMemo(() => {
    const positions = new Map<string, { x: number; y: number; isGap: boolean; side: 'source' | 'target' }>();

    let currentYSource = 60;
    mappedSources.forEach((c) => {
      positions.set(`source-${c.id}`, { x: xSource, y: currentYSource, isGap: false, side: 'source' });
      currentYSource += nodeHeight + nodeGap;
    });

    if (showGaps && unmappedSources.length > 0) {
      currentYSource += 16; // gap separator
      unmappedSources.forEach((c) => {
        positions.set(`source-${c.id}`, { x: xSource, y: currentYSource, isGap: true, side: 'source' });
        currentYSource += nodeHeight + nodeGap;
      });
    }

    let currentYTarget = 60;
    mappedTargets.forEach((c) => {
      positions.set(`target-${c.id}`, { x: xTarget, y: currentYTarget, isGap: false, side: 'target' });
      currentYTarget += nodeHeight + nodeGap;
    });

    if (showGaps && unmappedTargets.length > 0) {
      currentYTarget += 16; // gap separator
      unmappedTargets.forEach((c) => {
        positions.set(`target-${c.id}`, { x: xTarget, y: currentYTarget, isGap: true, side: 'target' });
        currentYTarget += nodeHeight + nodeGap;
      });
    }

    const maxH = Math.max(currentYSource, currentYTarget) + 60;
    return { nodePositions: positions, totalHeight: Math.max(550, maxH) };
  }, [mappedSources, unmappedSources, mappedTargets, unmappedTargets, showGaps, xTarget]);

  // Generate Bezier flow links
  const links = useMemo(() => {
    const linkList: Array<{
      key: string;
      uuid: string;
      sourceId: string;
      targetId: string;
      relationship: string;
      confidence?: string;
      rationale?: string;
      pathD: string;
      strokeColor: string;
      mapEntry: SankeyMapEntry;
      midX: number;
      midY: number;
    }> = [];

    // Track connection counts to stagger vertical positions
    const sourceLinkCount: Record<string, number> = {};
    const targetLinkCount: Record<string, number> = {};

    filteredMaps.forEach((m) => {
      const relColor =
        STATUS_CONFIG['mapping-relationship']?.values?.[m.relationship]?.color ||
        RELATIONSHIP_COLORS[m.relationship] ||
        RELATIONSHIP_COLORS['no-relationship'];

      const confidence = (m as any)['confidence-score'] ?? m.props?.find((p) => p.name === 'confidence')?.value;
      const rationale = (m as any)['matching-rationale'] ?? m.props?.find((p) => p.name === 'rationale')?.value ?? m.remarks;

      m.sources?.forEach((srcRef) => {
        const srcPos = nodePositions.get(`source-${srcRef['id-ref']}`);
        if (!srcPos) return;

        m.targets?.forEach((tgtRef) => {
          const tgtPos = nodePositions.get(`target-${tgtRef['id-ref']}`);
          if (!tgtPos) return;

          const sCount = sourceLinkCount[srcRef['id-ref']] || 0;
          const tCount = targetLinkCount[tgtRef['id-ref']] || 0;
          sourceLinkCount[srcRef['id-ref']] = sCount + 1;
          targetLinkCount[tgtRef['id-ref']] = tCount + 1;

          const x1 = srcPos.x + nodeWidth;
          const y1 = srcPos.y + nodeHeight / 2 + (sCount % 3 - 1) * 3;
          const x2 = tgtPos.x;
          const y2 = tgtPos.y + nodeHeight / 2 + (tCount % 3 - 1) * 3;

          const dx = (x2 - x1) * 0.5;
          const cx1 = x1 + dx;
          const cx2 = x2 - dx;

          const pathD = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const key = `${m.uuid}-${srcRef['id-ref']}-${tgtRef['id-ref']}`;

          linkList.push({
            key,
            uuid: m.uuid,
            sourceId: srcRef['id-ref'],
            targetId: tgtRef['id-ref'],
            relationship: m.relationship,
            confidence,
            rationale,
            pathD,
            strokeColor: relColor,
            mapEntry: m,
            midX,
            midY,
          });
        });
      });
    });

    return linkList;
  }, [filteredMaps, nodePositions]);

  // Zoom Handlers
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(Number((prev + 0.15).toFixed(2)), 2.0));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(Number((prev - 0.15).toFixed(2)), 0.5));
  const handleResetZoom = () => setZoomLevel(1.0);

  // Link Hovering
  const handleLinkMouseEnter = (
    e: React.MouseEvent,
    link: typeof links[0]
  ) => {
    setHoveredLinkKey(link.key);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipData({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        sourceId: link.sourceId,
        targetId: link.targetId,
        relationship: link.relationship,
        confidence: link.confidence,
        rationale: link.rationale,
      });
    }
  };

  const handleLinkMouseLeave = () => {
    setHoveredLinkKey(null);
    setTooltipData(null);
  };

  return (
    <div className={styles.sankeyContainer} data-testid="sankey-diagram" ref={containerRef}>
      {/* Control Bar */}
      <div className={styles.controlBar}>
        <div className={styles.controlsGroup}>
          <input
            type="text"
            placeholder="Search controls..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            aria-label="Search controls"
          />

          <select
            value={activeFilter}
            onChange={(e) => setInternalFilter(e.target.value)}
            className={styles.filterSelect}
            aria-label="Filter relationship type"
          >
            <option value="all">All Relationships</option>
            <option value="equal-to">Equal To</option>
            <option value="equivalent-to">Equivalent To</option>
            <option value="subset-of">Subset Of</option>
            <option value="superset-of">Superset Of</option>
            <option value="intersects-with">Intersects With</option>
            <option value="no-relationship">No Relationship</option>
          </select>

          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={showGaps}
              onChange={(e) => setShowGaps(e.target.checked)}
            />
            Show Gap Nodes
          </label>
        </div>

        <div className={styles.zoomControls}>
          <button onClick={handleZoomOut} className={styles.zoomButton} title="Zoom Out">
            -
          </button>
          <span className={styles.zoomLevel}>{Math.round(zoomLevel * 100)}%</span>
          <button onClick={handleZoomIn} className={styles.zoomButton} title="Zoom In">
            +
          </button>
          <button onClick={handleResetZoom} className={styles.zoomButton} title="Reset Zoom">
            Reset
          </button>
        </div>
      </div>

      {/* Relationship Color Legend */}
      <div className={styles.legendBar}>
        <span style={{ fontWeight: 600, marginRight: 4 }}>Legend:</span>
        {Object.entries(RELATIONSHIP_COLORS).map(([rel, color]) => {
          if (rel === 'unmapped') return null;
          const label = STATUS_CONFIG['mapping-relationship']?.values?.[rel]?.label || rel;
          return (
            <div key={rel} className={styles.legendItem}>
              <div className={styles.legendSwatch} style={{ backgroundColor: color }} />
              <span>{label}</span>
            </div>
          );
        })}
      </div>

      {/* SVG Viewport Container */}
      <div className={styles.svgViewport}>
        <svg
          className={styles.sankeySvg}
          data-testid="sankey-svg"
          viewBox={`0 0 ${svgWidth} ${totalHeight}`}
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'top left',
            width: `${svgWidth * zoomLevel}px`,
            height: `${totalHeight * zoomLevel}px`,
          }}
        >
          {/* Column Headers */}
          <text x={xSource} y={35} className={styles.columnHeader}>
            {sourceTitle} ({sourceControls.length})
          </text>
          <text x={xTarget} y={35} className={styles.columnHeader}>
            {targetTitle} ({targetControls.length})
          </text>

          {/* Render Bézier Links */}
          <g className="sankey-links-layer">
            {links.map((link) => {
              const isSelected = selectedMapUuid === link.uuid;
              const isHovered = hoveredLinkKey === link.key;
              const isNodeConnected =
                hoveredNodeId === link.sourceId || hoveredNodeId === link.targetId;
              const isDimmed =
                (hoveredNodeId && !isNodeConnected) ||
                (hoveredLinkKey && !isHovered);

              let linkClassName = styles.flowLink;
              if (isSelected) linkClassName += ` ${styles.flowLinkSelected}`;
              else if (isHovered || isNodeConnected) linkClassName += ` ${styles.flowLinkHovered}`;
              else if (isDimmed) linkClassName += ` ${styles.flowLinkDimmed}`;

              return (
                <path
                  key={link.key}
                  data-testid={`sankey-link-${link.uuid}-${link.sourceId}-${link.targetId}`}
                  d={link.pathD}
                  className={linkClassName}
                  stroke={link.strokeColor}
                  strokeWidth={isSelected ? 5 : isHovered || isNodeConnected ? 4 : 2.5}
                  strokeOpacity={isDimmed ? 0.12 : isHovered || isSelected ? 0.95 : 0.55}
                  onMouseEnter={(e) => handleLinkMouseEnter(e, link)}
                  onMouseLeave={handleLinkMouseLeave}
                  onClick={() => onSelectMap && onSelectMap(link.mapEntry)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Mapping link from ${link.sourceId} to ${link.targetId}, relationship ${link.relationship}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectMap && onSelectMap(link.mapEntry);
                    }
                  }}
                />
              );
            })}
          </g>

          {/* Render Source Control Nodes */}
          <g className="sankey-source-nodes-layer">
            {(showGaps ? sourceControls : mappedSources).map((ctrl) => {
              const pos = nodePositions.get(`source-${ctrl.id}`);
              if (!pos) return null;
              const isGap = pos.isGap;
              const isHovered = hoveredNodeId === ctrl.id;

              return (
                <g
                  key={`src-${ctrl.id}`}
                  data-testid={`sankey-node-${ctrl.id}`}
                  className={styles.nodeGroup}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  tabIndex={0}
                  role="button"
                  aria-label={`Source node ${ctrl.id}: ${isGap ? 'Unmapped' : ctrl.title || ctrl.group || 'Mapped'}`}
                  onMouseEnter={() => setHoveredNodeId(ctrl.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onFocus={() => setHoveredNodeId(ctrl.id)}
                  onBlur={() => setHoveredNodeId(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setHoveredNodeId(ctrl.id);
                    }
                  }}
                >
                  <rect
                    width={nodeWidth}
                    height={nodeHeight}
                    className={`${styles.nodeRect} ${
                      isGap ? styles.nodeRectGap : styles.nodeRectSource
                    }`}
                    style={isHovered ? { strokeWidth: 2.5 } : undefined}
                  />
                  <text x={8} y={18} className={styles.nodeText}>
                    {ctrl.id}
                  </text>
                  <text x={nodeWidth - 8} y={18} textAnchor="end" className={styles.nodeSubtext}>
                    {isGap ? 'Unmapped' : ctrl.group || 'Mapped'}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Render Target Control Nodes */}
          <g className="sankey-target-nodes-layer">
            {(showGaps ? targetControls : mappedTargets).map((ctrl) => {
              const pos = nodePositions.get(`target-${ctrl.id}`);
              if (!pos) return null;
              const isGap = pos.isGap;
              const isHovered = hoveredNodeId === ctrl.id;

              return (
                <g
                  key={`tgt-${ctrl.id}`}
                  data-testid={`sankey-node-${ctrl.id}`}
                  className={styles.nodeGroup}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  tabIndex={0}
                  role="button"
                  aria-label={`Target node ${ctrl.id}: ${isGap ? 'Unmapped' : ctrl.title || ctrl.group || 'Mapped'}`}
                  onMouseEnter={() => setHoveredNodeId(ctrl.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onFocus={() => setHoveredNodeId(ctrl.id)}
                  onBlur={() => setHoveredNodeId(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setHoveredNodeId(ctrl.id);
                    }
                  }}
                >
                  <rect
                    width={nodeWidth}
                    height={nodeHeight}
                    className={`${styles.nodeRect} ${
                      isGap ? styles.nodeRectGap : styles.nodeRectTarget
                    }`}
                    style={isHovered ? { strokeWidth: 2.5 } : undefined}
                  />
                  <text x={8} y={18} className={styles.nodeText}>
                    {ctrl.id}
                  </text>
                  <text x={nodeWidth - 8} y={18} textAnchor="end" className={styles.nodeSubtext}>
                    {isGap ? 'Unmapped' : ctrl.group || 'Mapped'}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Floating Hover Tooltip */}
      {tooltipData && (
        <div
          className={styles.tooltip}
          data-testid="sankey-tooltip"
          style={{ left: `${tooltipData.x}px`, top: `${tooltipData.y}px` }}
        >
          <div className={styles.tooltipHeader}>
            <span>
              {tooltipData.sourceId} → {tooltipData.targetId}
            </span>
            <span style={{ fontSize: 10, textTransform: 'capitalize' }}>
              {tooltipData.relationship}
            </span>
          </div>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>Relationship:</span>
            <span className={styles.tooltipValue}>{tooltipData.relationship}</span>
          </div>
          {tooltipData.confidence && (
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>Confidence:</span>
              <span className={styles.tooltipValue}>{tooltipData.confidence}%</span>
            </div>
          )}
          {tooltipData.rationale && (
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipLabel}>Rationale:</span>
              <span className={styles.tooltipValue}>{tooltipData.rationale}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SankeyDiagram;
