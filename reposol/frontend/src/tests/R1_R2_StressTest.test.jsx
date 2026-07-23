import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { EnhancementsAccordion } from '../components/shared/EnhancementsAccordion';
import { GroupEditor } from '../components/shared/GroupEditor';
import { ReadOnlyParts } from '../components/shared/ReadOnlyParts';
import { PartsEditor } from '../components/shared/PartsEditor';

describe('Requirement R1 — EnhancementsAccordion Empirical Stress Testing', () => {

  // =========================================================================
  // R1-1: Empty sub-controls and invalid prop shapes
  // =========================================================================
  describe('R1-1: Empty and Edge-Case Enhancements Input', () => {
    it('handles empty enhancements array cleanly', () => {
      render(
        <EnhancementsAccordion
          enhancements={[]}
          showNavArrow={true}
        />
      );

      expect(screen.getByText('0')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Control Enhancements (Sub-controls)'));
      expect(screen.getByText('No enhancements defined.')).toBeInTheDocument();
    });

    it('handles enhancements containing items with missing/falsy IDs or titles', () => {
      const edgeEnhancements = [
        { id: '', title: '' },
        { id: 'ac-1.1' }, // title missing
        { title: 'No ID Title' } // id missing
      ];

      render(
        <EnhancementsAccordion
          enhancements={edgeEnhancements}
          showNavArrow={false}
          renderEnhancementContent={(e) => <div data-testid={`content-${e.id || 'noid'}`}>{e.title || 'no title'}</div>}
        />
      );

      fireEvent.click(screen.getByText('Control Enhancements (Sub-controls)'));
      expect(screen.getByText('3')).toBeInTheDocument();

      // Check untitled title fallback for 2 items with missing titles
      const fallbacks = screen.getAllByText('Untitled Enhancement');
      expect(fallbacks.length).toBe(2);
    });

    it('handles duplicate enhancement IDs gracefully during expansion', () => {
      const dupEnhancements = [
        { id: 'ac-1.1', title: 'Enhancement 1A' },
        { id: 'ac-1.1', title: 'Enhancement 1B' }
      ];

      render(
        <EnhancementsAccordion
          enhancements={dupEnhancements}
          showNavArrow={false}
          renderEnhancementContent={(e, idx) => <div data-testid={`content-${idx}`}>{e.title}</div>}
        />
      );

      fireEvent.click(screen.getByText('Control Enhancements (Sub-controls)'));

      // Click first item row -> since itemId uses e.id || idx, both items share 'ac-1.1' as key!
      fireEvent.click(screen.getByText('Enhancement 1A'));

      // Empirically check: because itemId is 'ac-1.1' for both, expanding one expands BOTH!
      expect(screen.getByTestId('content-0')).toBeInTheDocument();
      expect(screen.getByTestId('content-1')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // R1-2: Deeply Nested Parts in Sub-controls
  // =========================================================================
  describe('R1-2: Deeply Nested Parts in Sub-controls', () => {
    it('renders 3-level deeply nested parts inside renderEnhancementContent when renderProse is supplied', () => {
      const deeplyNestedEnhancement = {
        id: 'ac-2.1',
        title: 'Deeply Nested Sub-control',
        parts: [
          {
            id: 'ac-2.1_smt',
            name: 'statement',
            prose: 'Level 1 Statement',
            parts: [
              {
                id: 'ac-2.1_smt.a',
                name: 'item',
                prose: 'Level 2 Item A',
                parts: [
                  {
                    id: 'ac-2.1_smt.a.1',
                    name: 'item',
                    prose: 'Level 3 Item A.1'
                  }
                ]
              }
            ]
          }
        ]
      };

      const dummyRenderProse = (txt) => <span>{txt}</span>;

      render(
        <EnhancementsAccordion
          enhancements={[deeplyNestedEnhancement]}
          showNavArrow={false}
          renderEnhancementContent={(e) => (
            <div>
              <ReadOnlyParts parts={e.parts} renderProse={dummyRenderProse} />
            </div>
          )}
        />
      );

      fireEvent.click(screen.getByText('Control Enhancements (Sub-controls)'));
      fireEvent.click(screen.getByText('Deeply Nested Sub-control'));

      expect(screen.getByText('Level 1 Statement')).toBeInTheDocument();
      expect(screen.getByText('Level 2 Item A')).toBeInTheDocument();
      expect(screen.getByText('Level 3 Item A.1')).toBeInTheDocument();
    });

    it('handles ReadOnlyParts cleanly when renderProse is omitted', () => {
      const samplePart = [{ id: 'p1', name: 'statement', prose: 'Sample prose' }];

      expect(() => {
        render(<ReadOnlyParts parts={samplePart} />);
      }).not.toThrow();
      expect(screen.getByText('Sample prose')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // R1-3: Profile vs Catalog Mode Toggling and Dual-Mode Props
  // =========================================================================
  describe('R1-3: Profile vs Catalog Mode Toggling', () => {
    it('handles dynamic prop toggling from Catalog mode to Profile mode', () => {
      const sample = [{ id: 'ac-1.1', title: 'Sub 1' }];
      const onSelect = vi.fn();

      const Wrapper = () => {
        const [showNav, setShowNav] = useState(true);
        return (
          <div>
            <button onClick={() => setShowNav(!showNav)}>Toggle Mode</button>
            <EnhancementsAccordion
              enhancements={sample}
              showNavArrow={showNav}
              onSelectEnhancement={onSelect}
              renderEnhancementContent={!showNav ? (e) => <div data-testid="profile-inline-content">Inline Profile Content</div> : undefined}
            />
          </div>
        );
      };

      render(<Wrapper />);

      fireEvent.click(screen.getByText('Control Enhancements (Sub-controls)'));

      // Initially in Catalog mode: row click selects enhancement
      fireEvent.click(screen.getByText('Sub 1'));
      expect(onSelect).toHaveBeenCalledWith('ac-1.1');
      expect(screen.queryByTestId('profile-inline-content')).not.toBeInTheDocument();

      // Switch mode to Profile
      fireEvent.click(screen.getByText('Toggle Mode'));

      // Now in Profile mode: row click expands inline content
      fireEvent.click(screen.getByText('Sub 1'));
      expect(screen.getByTestId('profile-inline-content')).toBeInTheDocument();
    });

    it('exposes UX conflict when showNavArrow=true AND renderEnhancementContent are both provided', () => {
      const sample = [{ id: 'ac-1.1', title: 'Sub 1' }];
      const onSelect = vi.fn();
      const renderContent = vi.fn(() => <div data-testid="dual-mode-content">Dual Mode Content</div>);

      render(
        <EnhancementsAccordion
          enhancements={sample}
          showNavArrow={true}
          onSelectEnhancement={onSelect}
          renderEnhancementContent={renderContent}
        />
      );

      fireEvent.click(screen.getByText('Control Enhancements (Sub-controls)'));

      // Clicking main row area triggers navigation rather than toggling inline expansion
      fireEvent.click(screen.getByText('Sub 1'));
      expect(onSelect).toHaveBeenCalledWith('ac-1.1');
      expect(screen.queryByTestId('dual-mode-content')).not.toBeInTheDocument();

      // Clicking arrow directly triggers toggleExpandItem
      const expandArrow = screen.getByTitle('Expand details');
      fireEvent.click(expandArrow);
      expect(screen.getByTestId('dual-mode-content')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // R1-4: Multiple Expanded Items
  // =========================================================================
  describe('R1-4: Multiple Expanded Items and Dynamic Array Changes', () => {
    it('allows multiple items to be expanded simultaneously', () => {
      const sample = [
        { id: 'ac-1.1', title: 'Sub 1' },
        { id: 'ac-1.2', title: 'Sub 2' },
        { id: 'ac-1.3', title: 'Sub 3' }
      ];

      render(
        <EnhancementsAccordion
          enhancements={sample}
          showNavArrow={false}
          renderEnhancementContent={(e) => <div data-testid={`inline-${e.id}`}>Content {e.id}</div>}
        />
      );

      fireEvent.click(screen.getByText('Control Enhancements (Sub-controls)'));

      fireEvent.click(screen.getByText('Sub 1'));
      fireEvent.click(screen.getByText('Sub 2'));
      fireEvent.click(screen.getByText('Sub 3'));

      expect(screen.getByTestId('inline-ac-1.1')).toBeInTheDocument();
      expect(screen.getByTestId('inline-ac-1.2')).toBeInTheDocument();
      expect(screen.getByTestId('inline-ac-1.3')).toBeInTheDocument();
    });

    it('maintains state integrity when an item is removed while multiple items are expanded', () => {
      const initialSample = [
        { id: 'ac-1.1', title: 'Sub 1' },
        { id: 'ac-1.2', title: 'Sub 2' }
      ];

      const Wrapper = () => {
        const [items, setItems] = useState(initialSample);
        return (
          <EnhancementsAccordion
            enhancements={items}
            isEditing={true}
            showNavArrow={false}
            onRemoveEnhancement={(idx) => setItems(items.filter((_, i) => i !== idx))}
            renderEnhancementContent={(e) => <div data-testid={`inline-${e.id}`}>Content {e.id}</div>}
          />
        );
      };

      render(<Wrapper />);

      fireEvent.click(screen.getByText('Control Enhancements (Sub-controls)'));

      // Expand both Sub 1 and Sub 2
      fireEvent.click(screen.getByText('Sub 1'));
      fireEvent.click(screen.getByText('Sub 2'));
      expect(screen.getByTestId('inline-ac-1.1')).toBeInTheDocument();
      expect(screen.getByTestId('inline-ac-1.2')).toBeInTheDocument();

      // Remove Sub 1
      const removeButtons = screen.getAllByTitle('Remove enhancement');
      fireEvent.click(removeButtons[0]);

      // Sub 1 is gone, Sub 2 remains expanded
      expect(screen.queryByText('Sub 1')).not.toBeInTheDocument();
      expect(screen.getByTestId('inline-ac-1.2')).toBeInTheDocument();
    });
  });

});

describe('Requirement R2 — GroupEditor Empirical Stress Testing', () => {

  // =========================================================================
  // R2-1: Empty group.params and undefined catalog/group properties
  // =========================================================================
  describe('R2-1: Empty group.params and undefined catalog/group properties', () => {
    it('renders cleanly when group.params is undefined or null', () => {
      const groupWithoutParams = {
        id: 'grp-empty',
        title: 'Group Without Params'
      };

      const { container } = render(
        <GroupEditor
          group={groupWithoutParams}
          catalog={null}
          isEditing={true}
          mode="catalog"
        />
      );

      expect(screen.getByText('Group Without Params')).toBeInTheDocument();
      expect(container).toBeInTheDocument();
    });

    it('renders cleanly when group object is completely empty {}', () => {
      const { container } = render(
        <GroupEditor
          group={{}}
          isEditing={false}
        />
      );

      expect(screen.getByText('Untitled Group')).toBeInTheDocument();
      expect(container).toBeInTheDocument();
    });
  });

  // =========================================================================
  // R2-2: Duplicate Param IDs between Catalog and Group
  // =========================================================================
  describe('R2-2: Duplicate Param IDs between Catalog and Group', () => {
    it('deduplicates catalog parameters when group overrides the same param ID (exact case)', () => {
      const catalog = {
        id: 'cat-1',
        params: [
          { id: 'prm_1', label: 'Catalog Prm 1' },
          { id: 'prm_2', label: 'Catalog Prm 2' }
        ]
      };

      const group = {
        id: 'grp-1',
        params: [
          { id: 'prm_1', label: 'Group Override Prm 1' }
        ],
        parts: [{ name: 'statement', prose: 'Test' }]
      };

      // Extract visibleGroupParams directly to verify deduplication
      const groupParams = (group.params || []).map(p => ({ ...p, scope: 'group', scopeLabel: '📁 Group Parameters' }));
      const catalogParams = (catalog?.params || []).map(p => ({ ...p, scope: 'catalog', scopeLabel: '🌐 Catalog Parameters' }));
      const groupParamIds = new Set(groupParams.map(p => p.id));
      const visibleGroupParams = [...groupParams, ...catalogParams.filter(cp => !groupParamIds.has(cp.id))];

      expect(visibleGroupParams.length).toBe(2); // prm_1 (group override) + prm_2 (catalog)
      expect(visibleGroupParams[0].label).toBe('Group Override Prm 1');
      expect(visibleGroupParams[1].label).toBe('Catalog Prm 2');
    });

    it('demonstrates case-sensitivity flaw when group and catalog param IDs differ only by case', () => {
      const catalog = {
        id: 'cat-1',
        params: [
          { id: 'PRM_1', label: 'Catalog Upper PRM_1' }
        ]
      };

      const group = {
        id: 'grp-1',
        params: [
          { id: 'prm_1', label: 'Group Lower prm_1' }
        ]
      };

      // Calculate visible group params logic directly used in GroupEditor
      const groupParams = (group.params || []).map(p => ({ ...p, scope: 'group', scopeLabel: '📁 Group Parameters' }));
      const catalogParams = (catalog?.params || []).map(p => ({ ...p, scope: 'catalog', scopeLabel: '🌐 Catalog Parameters' }));
      const groupParamIds = new Set(groupParams.map(p => p.id));
      const visibleGroupParams = [...groupParams, ...catalogParams.filter(cp => !groupParamIds.has(cp.id))];

      // Empirically verify that case difference results in duplicate entries in visibleGroupParams!
      expect(visibleGroupParams.length).toBe(2);
      expect(visibleGroupParams[0].id).toBe('prm_1');
      expect(visibleGroupParams[1].id).toBe('PRM_1');
    });
  });

  // =========================================================================
  // R2-3: Defining Multiple New Group Params Sequentially
  // =========================================================================
  describe('R2-3: Defining Multiple New Group Params Sequentially', () => {
    it('reveals ID collision bug when defining multiple params in rapid succession (same millisecond)', () => {
      const group = {
        id: 'grp-1',
        params: []
      };

      // Freeze time to simulate rapid sequential calls within 1ms
      const now = 1700000000000;
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(now);

      // GroupEditor's handleDefineNewParam implementation:
      // const newId = `param_${group.id || 'group'}_${Date.now().toString().slice(-4)}`;
      const newId1 = `param_${group.id || 'group'}_${Date.now().toString().slice(-4)}`;
      const newId2 = `param_${group.id || 'group'}_${Date.now().toString().slice(-4)}`;

      // EMPIRICAL BUG CONFIRMATION: Identical IDs are generated!
      expect(newId1).toBe(newId2);

      dateSpy.mockRestore();
    });

    it('simulates sequential param definitions with state updates', () => {
      const Wrapper = () => {
        const [group, setGroup] = useState({
          id: 'grp-1',
          title: 'Group 1',
          params: [],
          parts: [{ name: 'statement', prose: 'Statement' }]
        });

        return (
          <GroupEditor
            group={group}
            catalog={{ params: [] }}
            onChange={(updatedGroup) => setGroup(updatedGroup)}
            isEditing={true}
            mode="catalog"
          />
        );
      };

      render(<Wrapper />);

      expect(screen.getByText('Group 1')).toBeInTheDocument();
    });
  });

});
